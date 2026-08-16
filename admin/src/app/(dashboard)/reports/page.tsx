'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  bookingsReport,
  driverReport,
  exportBookingsUrl,
  revenueReport,
} from '@/lib/admin';
import { daysAgo, naira, statusTone, today } from '@/lib/format';
import {
  Button,
  Card,
  EmptyRow,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Skeleton,
  TableShell,
  Td,
  Th,
} from '@/components/ui';

const PRESETS = [
  { label: 'Last 7 days', from: () => daysAgo(7) },
  { label: 'Last 30 days', from: () => daysAgo(30) },
  { label: 'Last 90 days', from: () => daysAgo(90) },
];

/** Reports (admin.md §8), including the CSV export. */
export default function ReportsPage() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());

  const revenue = useQuery({ queryKey: ['report-revenue', from, to], queryFn: () => revenueReport(from, to) });
  const bookings = useQuery({ queryKey: ['report-bookings', from, to], queryFn: () => bookingsReport(from, to) });
  const drivers = useQuery({ queryKey: ['report-drivers', from, to], queryFn: () => driverReport(from, to) });

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Revenue, volume and driver performance over a date range."
        action={
          <a
            href={exportBookingsUrl(from, to)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Export CSV
          </a>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
          <div className="flex gap-2 pb-0.5">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                size="sm"
                variant="secondary"
                onClick={() => {
                  setFrom(preset.from());
                  setTo(today());
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {revenue.error ? (
        <div className="mb-6">
          <ErrorNote error={revenue.error} onRetry={revenue.refetch} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Revenue"
          value={revenue.data?.totalRevenueFormatted}
          loading={revenue.isLoading}
        />
        <Metric
          label="Transactions"
          value={revenue.data ? String(revenue.data.transactionCount) : undefined}
          loading={revenue.isLoading}
        />
        <Metric
          label="Average booking"
          value={revenue.data?.averageTransactionFormatted}
          loading={revenue.isLoading}
        />
        <Metric
          label="Completion rate"
          value={bookings.data ? `${bookings.data.completionRate}%` : undefined}
          loading={bookings.isLoading}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-base font-bold tracking-tight">Bookings by status</h2>
          <Card>
            {bookings.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-ink-200" />
                ))}
              </div>
            ) : (
              (() => {
                const rows = (bookings.data?.byStatus ?? []).filter((row) => row.count > 0);
                if (rows.length === 0) {
                  return <p className="py-6 text-center text-sm text-ink-500">No bookings in this range.</p>;
                }
                const max = Math.max(...rows.map((row) => row.count));
                return (
                  <div className="space-y-3">
                    {rows.map((row) => {
                      const tone = statusTone(row.status);
                      return (
                        <div key={row.status} className="flex items-center gap-3">
                          <span className="w-36 shrink-0 text-[13px] text-ink-700">{tone.label}</span>
                          <div className="h-5 flex-1 overflow-hidden rounded bg-ink-100">
                            <div
                              className={`h-full ${tone.bg}`}
                              style={{ width: `${Math.max((row.count / max) * 100, 5)}%` }}
                            />
                          </div>
                          <span className="nums w-10 shrink-0 text-right text-sm font-semibold">
                            {row.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </Card>
        </div>

        <div>
          <h2 className="mb-3 font-display text-base font-bold tracking-tight">Bookings by area</h2>
          <Card>
            {bookings.isLoading ? (
              <div className="h-40 animate-pulse rounded bg-ink-200" />
            ) : (bookings.data?.byArea ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">No data for this range.</p>
            ) : (
              <ul className="space-y-2">
                {(bookings.data?.byArea ?? [])
                  .sort((a, b) => b.count - a.count)
                  .map((area) => (
                    <li
                      key={area.serviceAreaId ?? area.name}
                      className="flex items-center justify-between border-b border-ink-100 pb-2 last:border-0"
                    >
                      <span className="text-sm">{area.name}</span>
                      <span className="nums text-sm font-semibold">{area.count}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <h2 className="mb-3 mt-8 font-display text-base font-bold tracking-tight">
        Driver performance
      </h2>
      <TableShell>
        <thead>
          <tr>
            <Th>Driver</Th>
            <Th>Phone</Th>
            <Th right>Jobs</Th>
            <Th right>Completed</Th>
            <Th right>Failed</Th>
            <Th right>Completion rate</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {drivers.isLoading ? (
            <Skeleton rows={4} cols={6} />
          ) : (drivers.data?.drivers ?? []).length === 0 ? (
            <EmptyRow colSpan={6} message="No driver activity in this range." />
          ) : (
            (drivers.data?.drivers ?? [])
              .sort((a, b) => b.totalJobs - a.totalJobs)
              .map((driver) => (
                <tr key={driver.driverId} className="hover:bg-ink-50">
                  <Td className="font-medium">{driver.name ?? '—'}</Td>
                  <Td className="whitespace-nowrap font-mono text-[13px]">{driver.phone}</Td>
                  <Td right className="nums">
                    {driver.totalJobs}
                  </Td>
                  <Td right className="nums text-ok-fg">
                    {driver.completed}
                  </Td>
                  <Td right className={`nums ${driver.failed > 0 ? 'text-danger-fg' : ''}`}>
                    {driver.failed}
                  </Td>
                  <Td right className="nums font-semibold">
                    {driver.completionRate}%
                  </Td>
                </tr>
              ))
          )}
        </tbody>
      </TableShell>

      {revenue.data && revenue.data.byService.length > 0 ? (
        <>
          <h2 className="mb-3 mt-8 font-display text-base font-bold tracking-tight">
            Revenue by service
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {revenue.data.byService.map((service) => (
              <Card key={service.serviceType}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                  {service.serviceType === 'WASTE_COLLECTION' ? 'Waste collection' : 'Cleaning'}
                </p>
                <p className="nums mt-1 font-display text-2xl font-extrabold tracking-tight">
                  {naira(service.revenue)}
                </p>
                <p className="nums mt-0.5 text-sm text-ink-600">{service.bookings} bookings</p>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

function Metric({ label, value, loading }: { label: string; value?: string; loading?: boolean }) {
  return (
    <Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-ink-200" />
      ) : (
        <p className="nums mt-1 font-display text-2xl font-extrabold tracking-tight">
          {value ?? '—'}
        </p>
      )}
    </Card>
  );
}
