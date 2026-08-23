import React from 'react';
import { LegalDocument, type LegalSection } from './LegalDocument';
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from '../../config/contact';

/**
 * Privacy policy.
 *
 * Written from what the app genuinely collects and which processors it genuinely
 * uses — the list of third parties matches the providers configured in the
 * server's environment, not a generic template. A policy that names services you
 * do not use, or omits ones you do, is worse than useless under the Nigeria Data
 * Protection Act.
 *
 * This is a working draft and needs review by a Nigerian data-protection
 * practitioner before launch.
 */

const SECTIONS: LegalSection[] = [
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

export const PrivacyScreen: React.FC = () => (
  <LegalDocument
    title="Privacy policy"
    lastUpdated="2026-08-17"
    intro="Your phone number, your address and where you are matter to us because the service cannot work without them. This explains exactly what we hold and why."
    sections={SECTIONS}
  />
);
