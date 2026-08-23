import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/LegalPage';
import { TERMS_SECTIONS } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms & conditions',
  description:
    'What you can expect from BinMan and what we expect from you: bookings, prices, cancellations and refunds.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & conditions"
      intro="These terms set out what you can expect from BinMan and what we expect from you. Please read them before booking."
      sections={TERMS_SECTIONS}
    />
  );
}
