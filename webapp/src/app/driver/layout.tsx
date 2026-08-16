import type { Metadata } from 'next';
import { OfflineBar } from '@/components/driver/OfflineBar';
import { RegisterServiceWorker } from '@/components/driver/RegisterServiceWorker';

export const metadata: Metadata = {
  title: 'Driver',
  // An internal tool has no business in search results.
  robots: { index: false, follow: false },
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-50">
      <RegisterServiceWorker />
      <OfflineBar />
      {children}
    </div>
  );
}
