'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getDashboard, getLiveOperations, listBookings } from '@/lib/admin';
import { longDate, naira, statusTone } from '@/lib/format';
import { Card, ErrorNote, PageHeader, StatusPill, Skeleton, TableShell, Td, Th, EmptyRow } from '@/components/ui';

/**
 * Overview (admin.md §1).
 *
 * Summary before detail: the numbers that decide whether today is going well
 * sit at the top, with anything that needs a human made visually louder than
 * anything that is simply progressing.
 */
export default function OverviewPage() {
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, refetchInterval: 60_000 });
  const live = useQuery({ queryKey: ['live-ops'], queryFn: getLiveOperations, refetchInterval: 30_000 });
  const recent = useQuery({
    queryKey: ['bookings', 'recent'],
    queryFn: () => listBookings({ page: 1 }),
  });

  const data = dashboard.data;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={data ? longDate(data.date) : 'Today at a glance'}
      />

      {dashboard.error ? (
        <div className="mb-6">
          <ErrorNote error={dashboard.error} onRetry={dashboard.refetch} />
        </div>
      ) : null}

      {/* Anything awaiting a human is surfaced first and styled as a call to
          action, not a statistic. */}
      {data && data.bookings.awaitingDispatch > 0 ? (
        <Link
          href="/dispatch"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/40 bg-warn-bg px-5 py-4 transition-colors hover:bg-warn-bg/70"
        >
          <p className="text-warn-fg">
            <span className="nums font-display text-xl font-extrabold">
              {data.bookings.awaitingDispatch}
            </span>{' '}
            <span className="font-semibold">
              paid booking{data.bookings.awaitingDispatch === 1 ? '' : 's'} waiting to be assigned
            </span>
          </p>
          <span className="text-sm font-semibold text-warn-fg">Go to dispatch →</span>
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Bookings today" value={data?.bookings.today} loading={dashboard.isLoading} />
        <Stat label="Completed" value={data?.bookings.completed} loading={dashboard.isLoading} tone="ok" />
        <Stat label="In progress" value={data?.bookings.pending} loading={dashboard.isLoading} />
        <Stat
          label="Failed today"
          value={data?.bookings.failed}
          loading={dashboard.isLoading}
          tone={data?.bookings.failed ? 'danger' : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Revenue today"
          value={data ? naira(data.revenue.today) : undefined}
          loading={dashboard.isLoading}
        />
        <Stat
          label="Revenue this month"
          value={data ? naira(data.revenue.month) : undefined}
          loading={dashboard.isLoading}
        />
        <Stat label="Active drivers" value={data?.fleet.activeDrivers} loading={dashboard.isLoading} />
        <Stat label="Customers" value={data?.customers.total} loading={dashboard.isLoading} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        {/* Live operations: the day's pipeline as a bar per status. */}
        <Card>
          <h2 className="font-display text-base font-bold tracking-tight">Today&apos;s pipeline</h2>
          <p className="mt-0.5 text-sm text-ink-600">Where every booking scheduled today sits.</p>

          <div className="mt-5 space-y-3">
            {live.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-ink-200" />
                ))}
              </div>
            ) : (
              (() => {
                const rows = (live.data?.statuses ?? []).filter((row) => row.count > 0);
                if (rows.length === 0) {
                  return <p className="py-6 text-center text-sm text-ink-500">Nothing scheduled today.</p>;
                }
                const max = Math.max(...rows.map((row) => row.count));
                return rows.map((row) => {
                  const tone = statusTone(row.status);
                  return (
                    <div key={row.status} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 text-[13px] text-ink-700">{tone.label}</span>
                      <div className="h-6 flex-1 overflow-hidden rounded bg-ink-100">
                        <div
                          className={`h-full ${tone.bg}`}
                          style={{ width: `${Math.max((row.count / max) * 100, 6)}%` }}
                        />
                      </div>
                      <span className="nums w-8 shrink-0 text-right text-sm font-semibold">
                        {row.count}
                      </span>
                    </div>
                  );
                });
              })()
            )}
          </div>
        </Card>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold tracking-tight">Latest bookings</h2>
            <Link href="/bookings" className="text-sm font-semibold text-brand hover:text-brand-600">
              View all →
            </Link>
          </div>

          <TableShell>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Customer</Th>
                <Th>Area</Th>
                <Th>Status</Th>
                <Th right>Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {recent.isLoading ? (
                <Skeleton rows={6} cols={5} />
              ) : (recent.data?.data ?? []).length === 0 ? (
                <EmptyRow colSpan={5} message="No bookings yet." />
              ) : (
                (recent.data?.data ?? []).slice(0, 6).map((booking) => (
                  <tr key={booking.id} className="hover:bg-ink-50">
                    <Td>
                      <Link
                        href={`/bookings?search=${booking.reference}`}
                        className="font-mono text-[13px] font-semibold text-brand hover:underline"
                      >
                        {booking.reference}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">{booking.customer.name ?? booking.customer.phone}</Td>
                    <Td className="whitespace-nowrap text-ink-600">{booking.address.area}</Td>
                    <Td>
                      <StatusPill status={booking.status} label={booking.statusLabel} />
                    </Td>
                    <Td right className="nums font-semibold">
                      {naira(booking.pricing.total)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableShell>
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value?: number | string;
  loading?: boolean;
  tone?: 'ok' | 'danger';
}) {
  const accent =
    tone === 'ok' ? 'text-ok-fg' : tone === 'danger' ? 'text-danger-fg' : 'text-ink-900';

  return (
    <Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-20 animate-pulse rounded bg-ink-200" />
      ) : (
        <p className={`nums mt-1 font-display text-3xl font-extrabold tracking-tight ${accent}`}>
          {value ?? '—'}
        </p>
      )}
    </Card>
  );
}
