import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { handleMessage } from '../../src/modules/whatsapp/whatsapp.machine';
import {
  __reset,
  last,
  lastOptionIds,
  optionStartingWith,
  transcript,
} from './fakes/whatsapp';

/**
 * Picks tomorrow rather than the first offered date.
 *
 * Today's windows are all in the past when the suite runs in the evening, and
 * the machine correctly refuses them — so a test that always took the first
 * option would pass or fail depending on the clock.
 */
const pickFutureDate = (): string => {
  const dates = lastOptionIds().filter((id) => id.startsWith('DATE_'));
  return dates[1] ?? dates[0]!;
};

/**
 * The WhatsApp bot, driven turn by turn.
 *
 * The transport is faked, so these assert on the CONVERSATION — which prompt
 * appeared, which options were offered — and on the rows the bot creates
 * through the shared services. That is the property that matters: the bot must
 * produce exactly what the app would, because it calls the same code.
 */

const prisma = new PrismaClient();

const PHONE = '+2348111222333';
const OTHER_PHONE = '+2348111222999';

let userId = '';
let addressId = '';

/** Walks the shared prefix of both booking flows: menu → address. */
const openBookingFlow = async (menuChoice: 'MENU_WASTE' | 'MENU_CLEANING') => {
  await handleMessage(PHONE, 'hi');
  await handleMessage(PHONE, menuChoice);
  const addressOption = optionStartingWith('ADDR_');
  expect(addressOption, 'an address should be offered').toBeTruthy();
  await handleMessage(PHONE, addressOption!);
};

beforeAll(async () => {
  // A registered customer with a serviceable address — the bot refuses to book
  // without both, which is itself covered below.
  const user = await prisma.user.create({
    data: {
      phone: PHONE,
      firstName: 'Aniema',
      lastName: 'Etim',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
  });
  userId = user.id;

  const area = await prisma.serviceArea.findFirst({ where: { isActive: true } });
  const address = await prisma.address.create({
    data: {
      userId,
      label: 'Home',
      addressLine: '12 Udo Udoma Avenue',
      area: area!.name,
      city: area!.city,
      state: area!.state,
      serviceAreaId: area!.id,
      isDefault: true,
    },
  });
  addressId = address.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(() => {
  __reset();
});

describe('Identity', () => {
  it('turns an unregistered number away instead of registering it', async () => {
    await handleMessage(OTHER_PHONE, 'hi');

    // Registration is app-only: the account, profile and addresses are created
    // there, and WhatsApp works off that identity (whatsapp.md).
    expect(transcript()).toContain('not registered');
    expect(await prisma.user.findUnique({ where: { phone: OTHER_PHONE } })).toBeNull();
  });

  it('greets a registered customer by name and offers the full menu', async () => {
    await handleMessage(PHONE, 'hi');

    expect(last()?.body).toContain('Aniema');
    expect(lastOptionIds()).toEqual(
      expect.arrayContaining([
        'MENU_WASTE',
        'MENU_CLEANING',
        'MENU_TRACK',
        'MENU_BOOKINGS',
        'MENU_CANCEL',
        'MENU_SUBSCRIPTION',
        'MENU_SUPPORT',
      ]),
    );
  });

  it('"cancel" clears an in-progress flow from any state', async () => {
    await openBookingFlow('MENU_WASTE');
    await handleMessage(PHONE, 'cancel');

    const session = await prisma.whatsappSession.findUnique({ where: { phone: PHONE } });
    expect(session?.currentState).toBe('IDLE');
  });
});

describe('Waste booking', () => {
  it('walks type → size → date → time → quote → confirm and creates a booking', async () => {
    await openBookingFlow('MENU_WASTE');

    await handleMessage(PHONE, optionStartingWith('TYPE_')!);
    await handleMessage(PHONE, optionStartingWith('SIZE_')!);
    await handleMessage(PHONE, pickFutureDate());

    const slot = optionStartingWith('SLOT_');
    expect(slot, 'a slot should be available').toBeTruthy();
    await handleMessage(PHONE, slot!);

    // The quote comes from the pricing service, not from the bot.
    expect(last()?.body).toMatch(/Total: ₦/);
    expect(lastOptionIds()).toContain('CONFIRM_YES');

    await handleMessage(PHONE, 'CONFIRM_YES');

    const booking = await prisma.booking.findFirst({
      where: { userId, serviceType: 'WASTE_COLLECTION' },
      orderBy: { createdAt: 'desc' },
      include: { wasteBooking: true },
    });

    expect(booking).not.toBeNull();
    expect(booking!.status).toBe('PENDING_PAYMENT');
    expect(booking!.wasteBooking).not.toBeNull();
    // The customer is handed a checkout link, never asked for card details.
    expect(transcript()).toContain('checkout.test/pay/');
  });

  it('declining at the confirm step creates nothing', async () => {
    const before = await prisma.booking.count({ where: { userId } });

    await openBookingFlow('MENU_WASTE');
    await handleMessage(PHONE, optionStartingWith('TYPE_')!);
    await handleMessage(PHONE, optionStartingWith('SIZE_')!);
    await handleMessage(PHONE, pickFutureDate());
    await handleMessage(PHONE, optionStartingWith('SLOT_')!);
    await handleMessage(PHONE, 'CONFIRM_NO');

    expect(await prisma.booking.count({ where: { userId } })).toBe(before);
  });

  it('re-prompts instead of advancing when the reply is not a valid choice', async () => {
    await openBookingFlow('MENU_WASTE');
    await handleMessage(PHONE, 'blue');

    expect(last()?.body).toContain('choose a waste type');
    const session = await prisma.whatsappSession.findUnique({ where: { phone: PHONE } });
    expect(session?.currentState).toBe('WASTE_TYPE');
  });
});

describe('Cleaning booking', () => {
  it('walks service → property → size → date → time and creates a cleaning booking', async () => {
    await openBookingFlow('MENU_CLEANING');

    // A combination the seed actually prices. Taking whichever option happened
    // to be listed first would make this pass or fail on menu ordering rather
    // than on the flow being correct.
    expect(lastOptionIds()).toContain('CLEAN_REGULAR');
    await handleMessage(PHONE, 'CLEAN_REGULAR');

    await handleMessage(PHONE, optionStartingWith('PROP_')!);

    expect(lastOptionIds()).toContain('PSIZE_ONE_BEDROOM');
    await handleMessage(PHONE, 'PSIZE_ONE_BEDROOM');

    await handleMessage(PHONE, pickFutureDate());
    await handleMessage(PHONE, optionStartingWith('SLOT_')!);

    // ₦8,000 base for REGULAR / ONE_BEDROOM plus the ₦1,000 cleaning service
    // fee, both from the seeded pricing rules — so this pins that the bot
    // quotes through the pricing service rather than inventing a number.
    expect(last()?.body).toContain('₦9,000.00');
    expect(lastOptionIds()).toContain('CONFIRM_YES');

    await handleMessage(PHONE, 'CONFIRM_YES');

    const booking = await prisma.booking.findFirst({
      where: { userId, serviceType: 'CLEANING' },
      orderBy: { createdAt: 'desc' },
      include: { cleaningBooking: true },
    });

    expect(booking).not.toBeNull();
    expect(booking!.cleaningBooking).not.toBeNull();
  });
});

describe('Cancellation', () => {
  /**
   * Each test books its own subject through the bot.
   *
   * Reusing whatever earlier tests left behind meant a test could find nothing
   * to cancel, return early and still report green — the flow untested.
   */
  const bookSomethingCancellable = async (): Promise<string> => {
    await openBookingFlow('MENU_WASTE');
    await handleMessage(PHONE, optionStartingWith('TYPE_')!);
    await handleMessage(PHONE, optionStartingWith('SIZE_')!);
    await handleMessage(PHONE, pickFutureDate());
    await handleMessage(PHONE, optionStartingWith('SLOT_')!);
    await handleMessage(PHONE, 'CONFIRM_YES');

    const booking = await prisma.booking.findFirst({
      where: { userId, status: 'PENDING_PAYMENT' },
      orderBy: { createdAt: 'desc' },
    });
    expect(booking, 'the booking fixture should exist').not.toBeNull();
    __reset();
    return booking!.id;
  };

  it('offers only bookings the lifecycle actually allows cancelling', async () => {
    const bookingId = await bookSomethingCancellable();
    await handleMessage(PHONE, 'hi');
    await handleMessage(PHONE, 'MENU_CANCEL');

    const offered = lastOptionIds().filter((id) => id.startsWith('CANCELBK_'));
    const ids = offered.map((id) => id.replace('CANCELBK_', ''));
    expect(ids, 'the booking just made should be offered').toContain(bookingId);
    const bookings = await prisma.booking.findMany({ where: { id: { in: ids } } });

    // Nothing already under way should ever appear in this list.
    for (const booking of bookings) {
      expect(['PENDING_PAYMENT', 'PAID', 'PENDING_ASSIGNMENT', 'ASSIGNED']).toContain(
        booking.status,
      );
    }
  });

  it('cancels through the shared service and reports the refund position', async () => {
    const bookingId = await bookSomethingCancellable();

    await handleMessage(PHONE, 'hi');
    await handleMessage(PHONE, 'MENU_CANCEL');
    await handleMessage(PHONE, `CANCELBK_${bookingId}`);

    expect(lastOptionIds()).toContain('CANCEL_YES');
    await handleMessage(PHONE, 'CANCEL_YES');

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe('CANCELLED');
    // The refund wording comes from the service, so both channels say the same.
    expect(transcript()).toMatch(/cancelled/i);
  });

  it('keeps the booking when the customer backs out', async () => {
    const bookingId = await bookSomethingCancellable();

    await handleMessage(PHONE, 'hi');
    await handleMessage(PHONE, 'MENU_CANCEL');
    await handleMessage(PHONE, `CANCELBK_${bookingId}`);
    await handleMessage(PHONE, 'CANCEL_NO');

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).not.toBe('CANCELLED');
  });
});

describe('Subscription management', () => {
  let subscriptionId = '';

  beforeAll(async () => {
    const slot = await prisma.timeSlot.findFirst({ where: { isActive: true } });
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        serviceType: 'WASTE_COLLECTION',
        frequency: 'WEEKLY',
        daysOfWeek: [6],
        timeSlotId: slot!.id,
        addressId,
        amount: 300_000,
        wasteTypes: ['HOUSEHOLD'],
        collectionSize: 'MEDIUM',
        status: 'ACTIVE',
        startDate: new Date(),
      },
    });
    subscriptionId = subscription.id;
  });

  it('pauses an active subscription', async () => {
    await handleMessage(PHONE, 'hi');
    await handleMessage(PHONE, 'MENU_SUBSCRIPTION');
    await handleMessage(PHONE, `SUB_${subscriptionId}`);

    expect(lastOptionIds()).toContain('SUBACT_PAUSE');
    await handleMessage(PHONE, 'SUBACT_PAUSE');

    const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    expect(subscription?.status).toBe('PAUSED');
  });

  it('offers resume once paused, and resumes', async () => {
    await handleMessage(PHONE, 'hi');
    await handleMessage(PHONE, 'MENU_SUBSCRIPTION');
    await handleMessage(PHONE, `SUB_${subscriptionId}`);

    expect(lastOptionIds()).toContain('SUBACT_RESUME');
    await handleMessage(PHONE, 'SUBACT_RESUME');

    const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    expect(subscription?.status).toBe('ACTIVE');
  });

  it('cancels a subscription', async () => {
    await handleMessage(PHONE, 'hi');
    await handleMessage(PHONE, 'MENU_SUBSCRIPTION');
    await handleMessage(PHONE, `SUB_${subscriptionId}`);
    await handleMessage(PHONE, 'SUBACT_CANCEL');

    const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    expect(subscription?.status).toBe('CANCELLED');
    // Work already scheduled is not withdrawn.
    expect(transcript()).toContain('already scheduled are unaffected');
  });
});

describe('Tracking', () => {
  /**
   * A booking belonging to somebody else, built here rather than borrowed from
   * whatever another test file happened to leave behind — this file has to be
   * runnable on its own for the check to mean anything.
   */
  let strangerReference = '';

  beforeAll(async () => {
    const stranger = await prisma.user.create({
      data: { phone: '+2348111222444', firstName: 'Ubong', role: 'CUSTOMER', status: 'ACTIVE' },
    });
    const area = await prisma.serviceArea.findFirst({ where: { isActive: true } });
    const strangerAddress = await prisma.address.create({
      data: {
        userId: stranger.id,
        label: 'Home',
        addressLine: '4 Atiku Abubakar Way',
        area: area!.name,
        city: area!.city,
        state: area!.state,
        serviceAreaId: area!.id,
      },
    });
    const slot = await prisma.timeSlot.findFirst({ where: { isActive: true } });
    const booking = await prisma.booking.create({
      data: {
        reference: 'BMTEST0001',
        userId: stranger.id,
        serviceType: 'WASTE_COLLECTION',
        addressId: strangerAddress.id,
        serviceAreaId: area!.id,
        scheduledDate: new Date('2026-12-01'),
        timeSlotId: slot!.id,
        subtotal: 250_000,
        serviceFee: 50_000,
        totalAmount: 300_000,
      },
    });
    strangerReference = booking.reference;
  });

  it('will not reveal a booking that belongs to someone else', async () => {
    await handleMessage(PHONE, 'hi');
    await handleMessage(PHONE, 'MENU_TRACK');
    await handleMessage(PHONE, strangerReference);

    // A reference alone must never be enough to read someone else's booking:
    // references are short and guessable, so the lookup is scoped to the caller.
    expect(transcript()).toContain("couldn't find a booking");
    // No detail of any kind leaks alongside the refusal.
    expect(transcript()).not.toMatch(/Status:/);
  });

  it('shows status and schedule for the customer’s own booking', async () => {
    const own = await prisma.booking.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    expect(own, 'earlier tests should have left a booking').not.toBeNull();

    await handleMessage(PHONE, 'hi');
    await handleMessage(PHONE, 'MENU_TRACK');
    await handleMessage(PHONE, own!.reference);

    expect(last()?.body).toContain(own!.reference);
    expect(last()?.body).toMatch(/Status:/);
  });
});
