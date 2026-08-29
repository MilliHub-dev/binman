import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/LegalPage';
import { PRIVACY_SECTIONS } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'What personal data BinMan collects, why we hold it, who else sees it, and what you can ask us to do with it.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="Your phone number, your address and where you are matter to us because the service cannot work without them. This explains exactly what we hold and why."
      sections={PRIVACY_SECTIONS}
    />
  );
}
