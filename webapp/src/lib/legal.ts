import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from './contact';

/**
 * The legal documents, shared by the website and the mobile app.
 *
 * Extracted from the app's own screens rather than retyped: terms that differ
 * between where someone agreed to them and where they later read them are worse
 * than having only one copy. `npm run check:legal` compares the two and fails if
 * they drift.
 */

export interface LegalSection {
  heading: string;
  body?: string[];
  bullets?: string[];
}

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'Who we are',
    body: [
      'BinMan is an on-demand waste collection and home services platform operating in Uyo, Akwa Ibom State, Nigeria. In these terms, "we", "us" and "BinMan" mean the BinMan service; "you" means the person using it.',
      'These terms apply whenever you use the BinMan app, our website, or book with us over WhatsApp.',
    ],
  },
  {
    heading: 'Your account',
    body: [
      'You sign in with your phone number and a one-time code sent by SMS. You are responsible for keeping access to that number secure — anyone who can receive your codes can use your account.',
      'You must give accurate details, including a collection address we can actually find. We may suspend an account used for fraud, abuse of our staff, or repeated no-shows.',
    ],
  },
  {
    heading: 'Booking a collection or cleaning',
    body: [
      'A booking is a request until it is paid for. Once payment succeeds we confirm the booking and assign a team on the scheduled day.',
      'We serve specific areas of Uyo. If your address falls outside the areas we cover, the app will tell you before you pay.',
    ],
    bullets: [
      'You choose the date and a time window, not an exact time.',
      'Someone should be reachable on the phone number attached to the booking on the day.',
      'Waste must be accessible from the point you describe. Our team will not enter a locked property.',
    ],
  },
  {
    heading: 'Prices and payment',
    body: [
      'Prices are shown in Nigerian Naira and calculated by us from the service, the size or property type, and your area. Some areas carry a surcharge, which is included in the total you see before you pay.',
      'You always see the full amount before paying. We never charge more than the total displayed at checkout.',
      'Payments are processed by Flutterwave. We do not receive or store your card details.',
    ],
  },
  {
    heading: 'Changing or cancelling',
    body: [
      'You can cancel a booking yourself while it is awaiting payment, paid, awaiting assignment, or assigned. Once a team is on the way, cancellation is handled by our support team instead.',
      'Cancellations made at least two hours before your time window are eligible for a refund. Later than that, a truck may already have been dispatched and the cost incurred, so a refund is at our discretion.',
      'Refunds are not automatic. Our team reviews each one and, where approved, returns the money by the method you paid with.',
    ],
  },
  {
    heading: 'Regular collections',
    body: [
      'A regular collection plan creates bookings automatically on the days you choose. You can pause, resume or cancel a plan at any time from the app.',
      'Cancelling a plan stops future collections being created. Collections already scheduled are unaffected and will still happen.',
    ],
  },
  {
    heading: 'What we will not collect',
    body: ['For the safety of our team and to comply with the law, we do not collect:'],
    bullets: [
      'Hazardous, medical, chemical or radioactive waste.',
      'Asbestos, solvents, paints, oils, or pressurised containers.',
      'Anything on fire, smouldering, or hot.',
      'Human or animal remains.',
    ],
  },
  {
    heading: 'If something goes wrong',
    body: [
      'If we miss a collection or do it badly, tell us through Help & support in the app. We will put it right or refund you.',
      'Our responsibility is limited to the value of the affected booking. We are not liable for indirect losses, such as lost income, arising from a missed or delayed collection.',
    ],
  },
  {
    heading: 'Your conduct',
    body: [
      'Our collection teams are entitled to work without abuse or threat. We will end a job and may close an account where a team member is threatened, and we will report violence to the police.',
    ],
  },
  {
    heading: 'Changes to these terms',
    body: [
      'We may update these terms as the service changes. The date at the top shows when they last changed, and continuing to use BinMan after a change means you accept the updated terms.',
    ],
  },
  {
    heading: 'Law and contact',
    body: [
      'These terms are governed by the laws of the Federal Republic of Nigeria, and disputes fall to the courts of Akwa Ibom State.',
      `Questions about these terms: ${SUPPORT_EMAIL}, or call ${SUPPORT_PHONE_DISPLAY}. You can also reach us through Help & support in the app.`,
    ],
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: 'What this covers',
    body: [
      'This policy explains what personal data BinMan collects when you use our app, website or WhatsApp service, why we hold it, and what you can ask us to do with it.',
      'We handle personal data in line with the Nigeria Data Protection Act 2023.',
    ],
  },
  {
    heading: 'What we collect',
    body: ['We collect only what the service needs to work:'],
    bullets: [
      'Your phone number — this is how you sign in, and how a driver reaches you on the day.',
      'Your name, and your email address if you give us one.',
      'Your collection addresses, including any map location you set and any directions you add.',
      'Your bookings, payments, and any ratings or messages you send us.',
      'Your device location, only while you are using "Use my current location" to set an address, and only with your permission.',
      'Photographs our team takes as proof that a collection happened.',
      'Basic technical information from your device so notifications reach the right phone.',
    ],
  },
  {
    heading: 'What we do with it',
    body: ['We use your data to:'],
    bullets: [
      'Take and fulfil your bookings, and get a team to the right address.',
      'Take payment and issue refunds.',
      'Send you the verification codes you need to sign in.',
      'Tell you what is happening with a collection — confirmed, on the way, done.',
      'Answer your support requests and act on your ratings.',
      'Understand demand by area so we can decide where to operate.',
    ],
  },
  {
    heading: 'Who else sees it',
    body: [
      'We do not sell your personal data. We share the minimum necessary with the companies that make the service work:',
    ],
    bullets: [
      'Flutterwave — processes your payment. They receive your payment details; we never see or store your card.',
      'Sendchamp — sends your SMS verification codes and any email we send you.',
      'Mapbox — turns addresses into map locations and works out driving routes. They receive the address or coordinates being looked up.',
      'Cloudinary — stores photographs, including proof-of-collection images.',
      'Google Firebase — delivers push notifications to your device.',
      'Meta (WhatsApp) — where you choose to book or get updates over WhatsApp.',
      'Our own collection teams, who see the name, phone number, address and directions for the job they are assigned.',
    ],
  },
  {
    heading: 'Where your data is held',
    body: [
      'Our systems run on servers outside Nigeria, and the providers listed above may process data outside Nigeria. Where that happens we rely on the contractual protections those providers offer.',
    ],
  },
  {
    heading: 'How long we keep it',
    body: [
      'We keep booking and payment records for as long as we are required to for tax and accounting purposes.',
      'Verification codes are short-lived and expire within minutes. Proof-of-collection photographs are kept while a booking could still be disputed.',
      'If you ask us to delete your account, we remove your personal details and keep only what the law requires us to retain.',
    ],
  },
  {
    heading: 'Your rights',
    body: ['Under the Nigeria Data Protection Act 2023 you can ask us to:'],
    bullets: [
      'Show you the personal data we hold about you.',
      'Correct anything that is wrong.',
      'Delete your data, where we are not required to keep it.',
      'Stop sending you marketing messages — this never affects messages about a booking you have made.',
      'Withdraw a permission you gave us, such as access to your location.',
    ],
  },
  {
    heading: 'Keeping it safe',
    body: [
      'Your session is protected by tokens stored in your device keychain rather than ordinary storage. Traffic between the app and our servers is encrypted. Verification codes are stored hashed, never in plain text, and access to customer data is limited to staff who need it.',
      'No system is perfectly secure. If a breach affects your data we will tell you and the regulator as the law requires.',
    ],
  },
  {
    heading: 'Children',
    body: [
      'BinMan is not intended for children under 18. We do not knowingly collect data from them, and will delete it if we discover we have.',
    ],
  },
  {
    heading: 'Contact us',
    body: [
      `To exercise any of the rights above, or to ask how your data is handled, contact us at ${SUPPORT_EMAIL} or call ${SUPPORT_PHONE_DISPLAY}.`,
      'If you are not satisfied with our response, you can complain to the Nigeria Data Protection Commission.',
    ],
  },
];

export const LEGAL_LAST_UPDATED = '2026-08-17';
