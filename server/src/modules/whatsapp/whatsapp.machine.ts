import {
  CleaningType,
  CollectionSize,
  PropertySize,
  PropertyType,
  ServiceType,
  WasteType,
  type User,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { createLogger } from '../../lib/logger';
import { AppError } from '../../lib/errors';
import { formatMoney } from '../../lib/money';
import { businessToday, dayjs, minutesToDisplay, slotWindowLabel } from '../../lib/datetime';
import * as wa from '../../services/whatsapp.service';
import * as bookingsService from '../bookings/bookings.service';
import * as paymentsService from '../payments/payments.service';
import * as subscriptionsService from '../subscriptions/subscriptions.service';
import { listAddresses } from '../addresses/addresses.service';
import { getAvailability } from '../time-slots/time-slots.service';
import { quote } from '../pricing/pricing.service';
import { STATUS_LABELS, CUSTOMER_CANCELLABLE } from '../bookings/booking.status';
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from '../../config/contact';

const log = createLogger('whatsapp.machine');

/**
 * The WhatsApp conversation state machine (whatsapp.md).
 *
 * This module contains NO business logic. It maps conversation turns onto the
 * same services the mobile app calls (prd.md §33), so pricing, capacity,
 * service-area, cancellation and payment rules can never drift between the two
 * channels — there is only one copy of each.
 *
 * Identity comes solely from the verified WhatsApp phone number; nothing the
 * customer types is ever trusted as an id (whatsapp.md "SECURITY").
 */

export const STATES = {
  IDLE: 'IDLE',
  MAIN_MENU: 'MAIN_MENU',

  /** Shared booking flow — `serviceType` in the session decides the branch. */
  BOOK_ADDRESS: 'BOOK_ADDRESS',
  BOOK_DATE: 'BOOK_DATE',
  BOOK_SLOT: 'BOOK_SLOT',
  BOOK_CONFIRM: 'BOOK_CONFIRM',

  /** Waste-only steps. */
  WASTE_TYPE: 'WASTE_TYPE',
  WASTE_SIZE: 'WASTE_SIZE',

  /** Cleaning-only steps. */
  CLEANING_TYPE: 'CLEANING_TYPE',
  CLEANING_PROPERTY_TYPE: 'CLEANING_PROPERTY_TYPE',
  CLEANING_PROPERTY_SIZE: 'CLEANING_PROPERTY_SIZE',

  TRACK_PROMPT: 'TRACK_PROMPT',
  CANCEL_SELECT: 'CANCEL_SELECT',
  CANCEL_CONFIRM: 'CANCEL_CONFIRM',
  SUB_SELECT: 'SUB_SELECT',
  SUB_ACTION: 'SUB_ACTION',
} as const;

export type State = (typeof STATES)[keyof typeof STATES];

interface SessionData {
  serviceType?: ServiceType;
  addressId?: string;

  wasteTypes?: WasteType[];
  collectionSize?: CollectionSize;

  cleaningType?: CleaningType;
  propertyType?: PropertyType;
  propertySize?: PropertySize;

  scheduledDate?: string;
  timeSlotId?: string;
  quotedTotal?: number;

  /** Target of a pending cancel or subscription action. */
  targetId?: string;
}

// ---------------------------------------------------------------------------
// Choice tables — labels only; every value is a server enum.
// ---------------------------------------------------------------------------

const WASTE_TYPES: Array<{ id: WasteType; title: string }> = [
  { id: WasteType.HOUSEHOLD, title: 'Household' },
  { id: WasteType.FOOD, title: 'Food waste' },
  { id: WasteType.PLASTIC, title: 'Plastic' },
  { id: WasteType.CARDBOARD, title: 'Cardboard' },
  { id: WasteType.GARDEN, title: 'Garden waste' },
  { id: WasteType.COMMERCIAL, title: 'Commercial' },
  { id: WasteType.MIXED, title: 'Mixed waste' },
];

const SIZES: Array<{ id: CollectionSize; title: string; description: string }> = [
  { id: CollectionSize.SMALL, title: 'Small', description: '1–2 bags' },
  { id: CollectionSize.MEDIUM, title: 'Medium', description: '3–5 bags' },
  { id: CollectionSize.LARGE, title: 'Large', description: '6+ bags' },
  { id: CollectionSize.EXTRA_LARGE, title: 'Extra large', description: 'A full truck load' },
];

const CLEANING_TYPES: Array<{ id: CleaningType; title: string; description: string }> = [
  { id: CleaningType.REGULAR, title: 'Regular clean', description: 'Routine tidy and clean' },
  { id: CleaningType.DEEP, title: 'Deep clean', description: 'Top to bottom' },
  { id: CleaningType.OFFICE, title: 'Office clean', description: 'Workspaces' },
  { id: CleaningType.MOVE_IN, title: 'Move-in clean', description: 'Before you arrive' },
  { id: CleaningType.MOVE_OUT, title: 'Move-out clean', description: 'Before you leave' },
  { id: CleaningType.POST_EVENT, title: 'After an event', description: 'Party or gathering' },
];

const PROPERTY_TYPES: Array<{ id: PropertyType; title: string }> = [
  { id: PropertyType.APARTMENT, title: 'Apartment' },
  { id: PropertyType.HOUSE, title: 'House' },
  { id: PropertyType.OFFICE, title: 'Office' },
  { id: PropertyType.SHOP, title: 'Shop' },
  { id: PropertyType.OTHER, title: 'Other' },
];

const PROPERTY_SIZES: Array<{ id: PropertySize; title: string }> = [
  { id: PropertySize.ONE_BEDROOM, title: '1 bedroom' },
  { id: PropertySize.TWO_BEDROOM, title: '2 bedrooms' },
  { id: PropertySize.THREE_BEDROOM, title: '3 bedrooms' },
  { id: PropertySize.FOUR_PLUS_BEDROOM, title: '4+ bedrooms' },
];

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

const loadSession = async (phone: string) => {
  const existing = await prisma.whatsappSession.findUnique({ where: { phone } });

  // An expired session starts over rather than resuming a stale half-booking.
  if (existing && existing.expiresAt.getTime() > Date.now()) return existing;

  const expiresAt = new Date(Date.now() + env.WHATSAPP_SESSION_TTL_SECONDS * 1000);

  return prisma.whatsappSession.upsert({
    where: { phone },
    create: { phone, currentState: STATES.IDLE, sessionData: {}, expiresAt },
    update: { currentState: STATES.IDLE, sessionData: {}, expiresAt },
  });
};

const saveSession = (phone: string, state: State, data: SessionData) =>
  prisma.whatsappSession.update({
    where: { phone },
    data: {
      currentState: state,
      sessionData: data as never,
      expiresAt: new Date(Date.now() + env.WHATSAPP_SESSION_TTL_SECONDS * 1000),
    },
  });

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const sendMainMenu = async (phone: string, user: User | null): Promise<void> => {
  const greeting = user?.firstName ? `Welcome back, ${user.firstName}! 👋` : 'Welcome to BinMan 👋';

  await wa.sendList(phone, `${greeting}\n\nWhat would you like to do?`, 'Choose an option', [
    { id: 'MENU_WASTE', title: 'Waste pickup' },
    { id: 'MENU_CLEANING', title: 'Cleaning' },
    { id: 'MENU_TRACK', title: 'Track a booking' },
    { id: 'MENU_BOOKINGS', title: 'My bookings' },
    { id: 'MENU_CANCEL', title: 'Cancel a booking' },
    { id: 'MENU_SUBSCRIPTION', title: 'My subscription' },
    { id: 'MENU_SUPPORT', title: 'Contact support' },
  ]);
};

const sendAddressPicker = async (phone: string, userId: string): Promise<boolean> => {
  const addresses = await listAddresses(userId);
  const serviceable = addresses.filter((address) => address.serviceable);

  if (addresses.length === 0) {
    await wa.sendText(
      phone,
      "You don't have a saved address yet. Please add one in the BinMan app first, then come back here to book. 🏠",
    );
    return false;
  }

  if (serviceable.length === 0) {
    await wa.sendText(
      phone,
      "We don't collect at any of your saved addresses yet. We're expanding — please check the app for covered areas. 📍",
    );
    return false;
  }

  await wa.sendList(
    phone,
    'Where should we come?',
    'Select address',
    serviceable.slice(0, 10).map((address) => ({
      id: `ADDR_${address.id}`,
      title: address.label,
      description: `${address.addressLine}, ${address.area}`,
    })),
  );
  return true;
};

const sendDatePicker = async (phone: string): Promise<void> => {
  const today = dayjs.utc(businessToday(), 'YYYY-MM-DD');

  await wa.sendList(
    phone,
    'Which day should we come?',
    'Select date',
    Array.from({ length: 7 }, (_, index) => {
      const date = today.add(index, 'day');
      const label = index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : date.format('ddd D MMM');
      return { id: `DATE_${date.format('YYYY-MM-DD')}`, title: label, description: date.format('D MMMM') };
    }),
  );
};

const sendSlotPicker = async (phone: string, date: string): Promise<boolean> => {
  const available = (await getAvailability(date)).filter((slot) => slot.available);

  if (available.length === 0) {
    await wa.sendText(phone, 'Sorry, there are no slots left on that day. Please choose another date.');
    await sendDatePicker(phone);
    return false;
  }

  await wa.sendList(
    phone,
    'What time works for you?',
    'Select time',
    available.map((slot) => ({
      id: `SLOT_${slot.id}`,
      title: minutesToDisplay(slot.startTime),
      description: slotWindowLabel(slot.startTime, slot.endTime),
    })),
  );
  return true;
};

/** Prices the draft through the same service the app uses, then confirms. */
const sendQuoteAndConfirm = async (
  phone: string,
  data: SessionData,
): Promise<number> => {
  const address = await prisma.address.findUnique({ where: { id: data.addressId! } });
  const isWaste = data.serviceType === ServiceType.WASTE_COLLECTION;

  const priced = await quote({
    serviceType: data.serviceType!,
    ...(isWaste
      ? { wasteTypes: data.wasteTypes ?? [], collectionSize: data.collectionSize! }
      : { cleaningType: data.cleaningType!, propertySize: data.propertySize! }),
    ...(address ? { area: address.area, city: address.city } : {}),
  });

  const detail = isWaste
    ? `🗑️ ${humanise(data.collectionSize!)} · ${(data.wasteTypes ?? []).map(humanise).join(', ')}`
    : `🧹 ${humanise(data.cleaningType!)} · ${humanise(data.propertySize!)}`;

  await wa.sendButtons(
    phone,
    `Here's your booking:\n\n📍 ${address?.label ?? 'Address'} — ${address?.area ?? ''}\n📅 ${data.scheduledDate}\n${detail}\n\n*Total: ${priced.formatted.total}*\n\nShall I confirm this?`,
    [
      { id: 'CONFIRM_YES', title: 'Yes, confirm' },
      { id: 'CONFIRM_NO', title: 'No, cancel' },
    ],
  );

  return priced.total;
};

const humanise = (value: string): string => {
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Handles one inbound message. `input` is the button/list id when the customer
 * tapped something, or raw text when they typed.
 */
export const handleMessage = async (phone: string, input: string): Promise<void> => {
  const trimmed = input.trim();
  const user = await prisma.user.findUnique({ where: { phone } });
  const session = await loadSession(phone);
  const data = (session.sessionData ?? {}) as SessionData;

  wa.logInbound(phone, trimmed);

  /**
   * Identity is resolved FIRST, before any shortcut.
   *
   * Registration is deliberately app-only: the account, profile and addresses
   * are created there, and WhatsApp works off that identity (whatsapp.md
   * "CUSTOMER IDENTIFICATION"). Handling greetings above this check meant an
   * unregistered number saying "hi" was shown the full menu and could walk
   * into a flow that could never complete.
   */
  if (!user) {
    await wa.sendText(
      phone,
      'This number is not registered with BinMan yet. Please download the BinMan app and sign up with this phone number, then message me again. 📱',
    );
    return;
  }

  // Universal escape hatches, valid from any state.
  const lowered = trimmed.toLowerCase();
  if (['hi', 'hello', 'menu', 'start', 'hey'].includes(lowered)) {
    await saveSession(phone, STATES.MAIN_MENU, {});
    await sendMainMenu(phone, user);
    return;
  }
  if (['cancel', 'stop', 'exit'].includes(lowered)) {
    await saveSession(phone, STATES.IDLE, {});
    await wa.sendText(phone, 'No problem — I have cleared that. Send "menu" whenever you need me. 👋');
    return;
  }

  try {
    await route(phone, user, session.currentState as State, trimmed, data);
  } catch (err) {
    // The customer gets a readable message; details go to the logs.
    const message =
      err instanceof AppError && err.statusCode < 500
        ? err.message
        : 'Something went wrong on our end. Please try again, or send "menu" to start over.';
    log.error({ err, phone }, 'whatsapp flow error');
    await wa.sendText(phone, message);
  }
};

const route = async (
  phone: string,
  user: User,
  state: State,
  input: string,
  data: SessionData,
): Promise<void> => {
  if (input.startsWith('MENU_')) {
    await handleMenuChoice(phone, user, input);
    return;
  }

  switch (state) {
    // --- Shared: address ---------------------------------------------------
    case STATES.BOOK_ADDRESS: {
      if (!input.startsWith('ADDR_')) {
        await wa.sendText(phone, 'Please pick one of the addresses from the list.');
        return;
      }
      const next = { ...data, addressId: input.slice('ADDR_'.length) };

      if (data.serviceType === ServiceType.CLEANING) {
        await saveSession(phone, STATES.CLEANING_TYPE, next);
        await wa.sendList(phone, 'What kind of cleaning do you need?', 'Select service',
          CLEANING_TYPES.map((c) => ({ id: `CLEAN_${c.id}`, title: c.title, description: c.description })));
        return;
      }

      await saveSession(phone, STATES.WASTE_TYPE, next);
      await wa.sendList(phone, 'What type of waste do you have?', 'Select type',
        WASTE_TYPES.map((c) => ({ id: `TYPE_${c.id}`, title: c.title })));
      return;
    }

    // --- Waste branch ------------------------------------------------------
    case STATES.WASTE_TYPE: {
      if (!input.startsWith('TYPE_')) {
        await wa.sendText(phone, 'Please choose a waste type from the list.');
        return;
      }
      await saveSession(phone, STATES.WASTE_SIZE, {
        ...data,
        wasteTypes: [input.slice('TYPE_'.length) as WasteType],
      });
      await wa.sendList(phone, 'How much waste do you have?', 'Select size',
        SIZES.map((c) => ({ id: `SIZE_${c.id}`, title: c.title, description: c.description })));
      return;
    }

    case STATES.WASTE_SIZE: {
      if (!input.startsWith('SIZE_')) {
        await wa.sendText(phone, 'Please choose a size from the list.');
        return;
      }
      await saveSession(phone, STATES.BOOK_DATE, {
        ...data,
        collectionSize: input.slice('SIZE_'.length) as CollectionSize,
      });
      await sendDatePicker(phone);
      return;
    }

    // --- Cleaning branch ---------------------------------------------------
    case STATES.CLEANING_TYPE: {
      if (!input.startsWith('CLEAN_')) {
        await wa.sendText(phone, 'Please choose a cleaning service from the list.');
        return;
      }
      await saveSession(phone, STATES.CLEANING_PROPERTY_TYPE, {
        ...data,
        cleaningType: input.slice('CLEAN_'.length) as CleaningType,
      });
      await wa.sendList(phone, 'What kind of property is it?', 'Select property',
        PROPERTY_TYPES.map((c) => ({ id: `PROP_${c.id}`, title: c.title })));
      return;
    }

    case STATES.CLEANING_PROPERTY_TYPE: {
      if (!input.startsWith('PROP_')) {
        await wa.sendText(phone, 'Please choose a property type from the list.');
        return;
      }
      await saveSession(phone, STATES.CLEANING_PROPERTY_SIZE, {
        ...data,
        propertyType: input.slice('PROP_'.length) as PropertyType,
      });
      await wa.sendList(phone, 'How big is it?', 'Select size',
        PROPERTY_SIZES.map((c) => ({ id: `PSIZE_${c.id}`, title: c.title })));
      return;
    }

    case STATES.CLEANING_PROPERTY_SIZE: {
      if (!input.startsWith('PSIZE_')) {
        await wa.sendText(phone, 'Please choose a size from the list.');
        return;
      }
      await saveSession(phone, STATES.BOOK_DATE, {
        ...data,
        propertySize: input.slice('PSIZE_'.length) as PropertySize,
      });
      await sendDatePicker(phone);
      return;
    }

    // --- Shared: date, slot, confirm ---------------------------------------
    case STATES.BOOK_DATE: {
      if (!input.startsWith('DATE_')) {
        await wa.sendText(phone, 'Please pick a date from the list.');
        return;
      }
      const scheduledDate = input.slice('DATE_'.length);
      await saveSession(phone, STATES.BOOK_SLOT, { ...data, scheduledDate });
      await sendSlotPicker(phone, scheduledDate);
      return;
    }

    case STATES.BOOK_SLOT: {
      if (!input.startsWith('SLOT_')) {
        await wa.sendText(phone, 'Please pick a time from the list.');
        return;
      }
      const next = { ...data, timeSlotId: input.slice('SLOT_'.length) };
      const total = await sendQuoteAndConfirm(phone, next);
      await saveSession(phone, STATES.BOOK_CONFIRM, { ...next, quotedTotal: total });
      return;
    }

    case STATES.BOOK_CONFIRM: {
      if (input === 'CONFIRM_NO' || input.toLowerCase() === 'no') {
        await saveSession(phone, STATES.IDLE, {});
        await wa.sendText(phone, 'No problem, I have cancelled that. Send "menu" to start again.');
        return;
      }
      if (input !== 'CONFIRM_YES' && input.toLowerCase() !== 'yes') {
        await wa.sendText(phone, 'Please reply "Yes, confirm" or "No, cancel".');
        return;
      }

      const isWaste = data.serviceType === ServiceType.WASTE_COLLECTION;

      // Created through the ordinary service — same validation, same capacity
      // check, same price as the app.
      const booking = await bookingsService.createBooking(user.id, {
        serviceType: data.serviceType!,
        addressId: data.addressId!,
        scheduledDate: data.scheduledDate!,
        timeSlotId: data.timeSlotId!,
        ...(isWaste
          ? { wasteTypes: data.wasteTypes ?? [], collectionSize: data.collectionSize! }
          : {
              cleaningType: data.cleaningType!,
              propertyType: data.propertyType!,
              propertySize: data.propertySize!,
            }),
      });

      const payment = await paymentsService.initiatePayment(booking.id, user.id);

      await saveSession(phone, STATES.IDLE, {});
      await wa.sendText(
        phone,
        `✅ Booking *${booking.reference}* created!\n\nPlease complete your payment of ${payment.formattedAmount} here:\n${payment.checkoutUrl}\n\nYour booking is confirmed as soon as payment goes through.`,
      );
      return;
    }

    // --- Track -------------------------------------------------------------
    case STATES.TRACK_PROMPT: {
      await trackBooking(phone, user, input);
      return;
    }

    // --- Cancel (whatsapp.md "CANCELLATION") -------------------------------
    case STATES.CANCEL_SELECT: {
      if (!input.startsWith('CANCELBK_')) {
        await wa.sendText(phone, 'Please pick a booking from the list.');
        return;
      }
      const bookingId = input.slice('CANCELBK_'.length);
      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, userId: user.id },
        include: { timeSlot: true },
      });
      if (!booking) {
        await wa.sendText(phone, "I couldn't find that booking. Send \"menu\" to start again.");
        return;
      }

      await saveSession(phone, STATES.CANCEL_CONFIRM, { targetId: bookingId });
      await wa.sendButtons(
        phone,
        `Cancel *${booking.reference}*?\n\n📅 ${dayjs.utc(booking.scheduledDate).format('D MMM YYYY')} · ${slotWindowLabel(booking.timeSlot.startTime, booking.timeSlot.endTime)}\n\nRefunds are reviewed by our team and depend on how close to the pickup you cancel.`,
        [
          { id: 'CANCEL_YES', title: 'Yes, cancel it' },
          { id: 'CANCEL_NO', title: 'Keep booking' },
        ],
      );
      return;
    }

    case STATES.CANCEL_CONFIRM: {
      if (input !== 'CANCEL_YES' && input.toLowerCase() !== 'yes') {
        await saveSession(phone, STATES.IDLE, {});
        await wa.sendText(phone, 'Your booking is unchanged. 👍');
        return;
      }

      // The service owns the window and refund rules (whatsapp.md
      // "CANCELLATION": check status, cancellation window, refund policy).
      const result = await bookingsService.cancelBooking(
        data.targetId!,
        user.id,
        'Cancelled by customer over WhatsApp',
      );

      await saveSession(phone, STATES.IDLE, {});
      await wa.sendText(phone, `${result.message}\n\nBooking ${result.booking.reference} is cancelled.`);
      return;
    }

    // --- Subscription management -------------------------------------------
    case STATES.SUB_SELECT: {
      if (!input.startsWith('SUB_')) {
        await wa.sendText(phone, 'Please pick a subscription from the list.');
        return;
      }
      const subscriptionId = input.slice('SUB_'.length);
      const subscription = await subscriptionsService.getSubscription(subscriptionId, user.id);

      await saveSession(phone, STATES.SUB_ACTION, { targetId: subscriptionId });
      await wa.sendButtons(
        phone,
        `${humanise(subscription.frequency)} collection · ${subscription.amountFormatted} per pickup\n\nWhat would you like to do?`,
        [
          subscription.status === 'ACTIVE'
            ? { id: 'SUBACT_PAUSE', title: 'Pause it' }
            : { id: 'SUBACT_RESUME', title: 'Resume it' },
          { id: 'SUBACT_CANCEL', title: 'Cancel it' },
          { id: 'SUBACT_BACK', title: 'Leave it' },
        ],
      );
      return;
    }

    case STATES.SUB_ACTION: {
      const id = data.targetId!;

      if (input === 'SUBACT_BACK') {
        await saveSession(phone, STATES.IDLE, {});
        await wa.sendText(phone, 'No changes made. 👍');
        return;
      }

      if (input === 'SUBACT_CANCEL') {
        await subscriptionsService.cancelSubscription(id, user.id);
        await saveSession(phone, STATES.IDLE, {});
        await wa.sendText(
          phone,
          'Your subscription is cancelled. Bookings already scheduled are unaffected — you can still see them under "My bookings".',
        );
        return;
      }

      if (input === 'SUBACT_PAUSE' || input === 'SUBACT_RESUME') {
        const status = input === 'SUBACT_PAUSE' ? 'PAUSED' : 'ACTIVE';
        const updated = await subscriptionsService.updateSubscription(id, user.id, { status });
        await saveSession(phone, STATES.IDLE, {});
        await wa.sendText(
          phone,
          status === 'PAUSED'
            ? 'Your subscription is paused. Message me any time to resume it. ⏸️'
            : `Your subscription is active again. Next collection: ${updated.nextRunDateFormatted ?? 'being scheduled'}. ▶️`,
        );
        return;
      }

      await wa.sendText(phone, 'Please choose one of the options.');
      return;
    }

    default: {
      await saveSession(phone, STATES.MAIN_MENU, {});
      await sendMainMenu(phone, user);
    }
  }
};

// ---------------------------------------------------------------------------
// Menu handlers
// ---------------------------------------------------------------------------

const handleMenuChoice = async (phone: string, user: User, choice: string): Promise<void> => {
  switch (choice) {
    case 'MENU_WASTE':
    case 'MENU_CLEANING': {
      const serviceType =
        choice === 'MENU_CLEANING' ? ServiceType.CLEANING : ServiceType.WASTE_COLLECTION;
      const hasAddress = await sendAddressPicker(phone, user.id);
      await saveSession(phone, hasAddress ? STATES.BOOK_ADDRESS : STATES.IDLE, { serviceType });
      return;
    }

    case 'MENU_TRACK': {
      await saveSession(phone, STATES.TRACK_PROMPT, {});
      await wa.sendText(phone, 'Please send me your booking reference (for example WST7K2M4Q).');
      return;
    }

    case 'MENU_BOOKINGS': {
      const { items } = await bookingsService.listBookings(user.id, {
        scope: 'upcoming',
        page: 1,
        limit: 5,
      });

      if (items.length === 0) {
        await wa.sendText(phone, 'You have no upcoming bookings. Send "menu" to book one. 🗑️');
        await saveSession(phone, STATES.IDLE, {});
        return;
      }

      const lines = items
        .map(
          (booking) =>
            `*${booking.reference}* — ${STATUS_LABELS[booking.status]}\n📅 ${booking.scheduledDate} · ${booking.timeSlot.window}\n📍 ${booking.address.area}`,
        )
        .join('\n\n');

      await wa.sendText(phone, `Your upcoming bookings:\n\n${lines}`);
      await saveSession(phone, STATES.IDLE, {});
      return;
    }

    case 'MENU_CANCEL': {
      const { items } = await bookingsService.listBookings(user.id, {
        scope: 'upcoming',
        page: 1,
        limit: 10,
      });

      // Only offer what the lifecycle actually allows the customer to cancel,
      // so nobody picks a booking and is then refused.
      const cancellable = items.filter((booking) => CUSTOMER_CANCELLABLE.includes(booking.status));

      if (cancellable.length === 0) {
        await wa.sendText(
          phone,
          'You have no bookings that can be cancelled right now. Once a team is on the way, please call support instead. 📞',
        );
        await saveSession(phone, STATES.IDLE, {});
        return;
      }

      await wa.sendList(
        phone,
        'Which booking would you like to cancel?',
        'Select booking',
        cancellable.map((booking) => ({
          id: `CANCELBK_${booking.id}`,
          title: booking.reference,
          description: `${booking.scheduledDate} · ${booking.address.area}`,
        })),
      );
      await saveSession(phone, STATES.CANCEL_SELECT, {});
      return;
    }

    case 'MENU_SUBSCRIPTION': {
      const subscriptions = await subscriptionsService.listSubscriptions(user.id);

      if (subscriptions.length === 0) {
        await wa.sendText(
          phone,
          'You have no subscription yet. You can set up weekly collection in the BinMan app. 🔁',
        );
        await saveSession(phone, STATES.IDLE, {});
        return;
      }

      await wa.sendList(
        phone,
        'Which subscription would you like to manage?',
        'Select',
        subscriptions.map((subscription) => ({
          id: `SUB_${subscription.id}`,
          title: humanise(subscription.frequency),
          description: `${subscription.address.area} · ${subscription.amountFormatted}`,
        })),
      );
      await saveSession(phone, STATES.SUB_SELECT, {});
      return;
    }

    case 'MENU_SUPPORT': {
      await wa.sendText(
        phone,
        `Our support team is here to help.\n\n📞 Call: ${SUPPORT_PHONE_DISPLAY}\n📧 Email: ${SUPPORT_EMAIL}\n\nOr just describe your issue here and an agent will pick it up.`,
      );
      await saveSession(phone, STATES.IDLE, {});
      return;
    }

    default: {
      await sendMainMenu(phone, null);
    }
  }
};

const trackBooking = async (phone: string, user: User, reference: string): Promise<void> => {
  const booking = await prisma.booking.findFirst({
    // Scoped to this user — a reference alone must never expose someone
    // else's booking.
    where: { reference: reference.trim().toUpperCase(), userId: user.id },
    include: {
      timeSlot: true,
      address: true,
      assignments: {
        where: { status: { notIn: ['REASSIGNED', 'CANCELLED'] } },
        take: 1,
        orderBy: { assignedAt: 'desc' },
        include: { driver: { include: { user: true } }, truck: true },
      },
    },
  });

  if (!booking) {
    await wa.sendText(
      phone,
      "I couldn't find a booking with that reference on this number. Please check and try again, or send \"menu\".",
    );
    return;
  }

  const assignment = booking.assignments[0];
  const driverName = assignment?.driver?.user
    ? [assignment.driver.user.firstName, assignment.driver.user.lastName].filter(Boolean).join(' ')
    : null;

  await wa.sendText(
    phone,
    [
      `*Booking ${booking.reference}*`,
      '',
      `Status: ${STATUS_LABELS[booking.status]}`,
      `📅 ${dayjs.utc(booking.scheduledDate).format('D MMM YYYY')} · ${slotWindowLabel(booking.timeSlot.startTime, booking.timeSlot.endTime)}`,
      `📍 ${booking.address.addressLine}, ${booking.address.area}`,
      ...(driverName ? [`🚛 Driver: ${driverName}`] : []),
      ...(assignment?.truck ? [`Truck: ${assignment.truck.truckNumber}`] : []),
      '',
      `Total: ${formatMoney(booking.totalAmount, booking.currency)}`,
    ].join('\n'),
  );
  await saveSession(phone, STATES.IDLE, {});
};
