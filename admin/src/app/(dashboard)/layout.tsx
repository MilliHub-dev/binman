'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, tokens } from '@/lib/api';
import { getDashboard, me } from '@/lib/admin';

/**
 * The operations shell: sidebar, auth gate, and the one badge that matters —
 * how many bookings are sitting unassigned right now.
 *
 * Grouped by what an operator is doing, not by database table: the day's work
 * first, then the people and equipment, then configuration.
 */
const NAV = [
  {
    group: 'Operations',
    items: [
      { href: '/', label: 'Overview', icon: '▤' },
      { href: '/dispatch', label: 'Dispatch', icon: '⇄', badge: 'awaitingDispatch' as const },
      { href: '/bookings', label: 'Bookings', icon: '☰' },
    ],
  },
  {
    group: 'People & fleet',
    items: [
      { href: '/customers', label: 'Customers', icon: '☺' },
      { href: '/drivers', label: 'Drivers', icon: '⛟' },
      { href: '/trucks', label: 'Trucks', icon: '⬢' },
    ],
  },
  {
    group: 'Configuration',
    items: [
      { href: '/pricing', label: 'Pricing', icon: '₦' },
      { href: '/areas', label: 'Service areas', icon: '◎' },
      { href: '/reports', label: 'Reports', icon: '◫' },
    ],
  },
];

/**
 * Session presence, read as external state.
 *
 * Also listens for `storage`, so signing out in one tab signs out the others
 * instead of leaving a console that 401s on every click.
 */
const subscribeToSession = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const ready = useSyncExternalStore(
    subscribeToSession,
    () => tokens.get() !== null,
    // Server render assumes signed out, so the console never flashes into view
    // for a visitor who has no session.
    () => false,
  );

  useEffect(() => {
    if (!ready) router.replace('/login');
  }, [ready, router]);

  const profile = useQuery({
    queryKey: ['me'],
    queryFn: me,
    enabled: ready,
    retry: false,
  });

  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    enabled: ready,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (profile.error instanceof ApiError && profile.error.status === 401) {
      tokens.clear();
      router.replace('/login');
    }
  }, [profile.error, router]);

  if (!ready) return null;

  const signOut = () => {
    tokens.clear();
    router.replace('/login');
  };

  const badges = { awaitingDispatch: dashboard.data?.bookings.awaitingDispatch ?? 0 };

  const sidebar = (
    <div className="flex h-full flex-col bg-night text-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Image src="/img/logo.png" alt="" width={32} height={32} className="h-8 w-8" />
        <div>
          <p className="font-display text-sm font-extrabold leading-tight tracking-tight">BinMan</p>
          <p className="text-[11px] uppercase tracking-wider text-white/45">Operations</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Sections">
        {NAV.map((section) => (
          <div key={section.group} className="mb-5">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
              {section.group}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                const count = item.badge ? badges[item.badge] : 0;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active ? 'bg-white/10 font-semibold text-white' : 'text-white/65 hover:bg-white/5'
                      }`}
                    >
                      <span aria-hidden="true" className="w-4 text-center text-white/50">
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {count > 0 ? (
                        <span className="nums rounded-full bg-warn px-1.5 py-0.5 text-[10px] font-bold text-night">
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <p className="truncate px-2 text-sm font-medium">{profile.data?.fullName ?? '—'}</p>
        <p className="px-2 text-[11px] uppercase tracking-wider text-white/45">
          {profile.data?.role.replace(/_/g, ' ').toLowerCase() ?? ''}
        </p>
        <button
          type="button"
          onClick={signOut}
          className="mt-2 w-full rounded-lg px-2 py-2 text-left text-sm text-white/65 hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 lg:block">{sidebar}</aside>

      {/* Mobile drawer — dispatchers do occasionally work from a phone. */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-night/60"
          />
          <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-ink-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-lg px-2 py-1 text-xl"
          >
            ☰
          </button>
          <span className="font-display font-extrabold tracking-tight">BinMan Ops</span>
        </header>

        <main className="min-w-0 flex-1 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
