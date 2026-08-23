import React from 'react';
import { LegalDocument, type LegalSection } from './LegalDocument';
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from '../../config/contact';

/**
 * Terms of service.
 *
 * Written against how BinMan actually behaves — the cancellation window, the
 * refund position, the payment provider — rather than generic boilerplate. Where
 * the app enforces a rule (two hours' notice, payment before dispatch), the
 * wording here matches the code, because terms that contradict the product are
 * worse than no terms.
 *
 * This is a working draft and needs review by a Nigerian lawyer before launch.
 * See the note in the repository's README.
 */

const SECTIONS: LegalSection[] = [
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

export const TermsScreen: React.FC = () => (
  <LegalDocument
    title="Terms & conditions"
    lastUpdated="2026-08-17"
    intro="These terms set out what you can expect from BinMan and what we expect from you. Please read them before booking."
    sections={SECTIONS}
  />
);
