'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelBooking,
  listBookings,
  unassignBooking,
  type AdminBooking,
  type BookingFilters,
} from '@/lib/admin';
import { naira, shortDate } from '@/lib/format';
import { ApiError } from '@/lib/api';
import {
  Button,
  Card,
  EmptyRow,
  ErrorNote,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatusPill,
  TableShell,
  Td,
  Th,
} from '@/components/ui';

const STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PENDING_ASSIGNMENT',
  'ASSIGNED',
  'DRIVER_EN_ROUTE',
  'ARRIVED',
  'COLLECTED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
];

/** Booking management (admin.md §3): search, filter, inspect, intervene. */
export default function BookingsPage() {
  const client = useQueryClient();
  const [filters, setFilters] = useState<BookingFilters>({ page: 1 });
  const [searchDraft, setSearchDraft] = useState('');
  const [detail, setDetail] = useState<AdminBooking>();
  const [cancelling, setCancelling] = useState<AdminBooking>();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  const bookings = useQuery({
    queryKey: ['bookings', filters],
    queryFn: () => listBookings(filters),
  });

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['bookings'] });
    void client.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const doCancel = useMutation({
    mutationFn: () => cancelBooking(cancelling!.id, reason.trim()),
    onSuccess: () => {
      setCancelling(undefined);
      setReason('');
      setError(undefined);
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not cancel this booking.'),
  });

  const doUnassign = useMutation({
    mutationFn: (id: string) => unassignBooking(id, 'Returned to queue by operations'),
    onSuccess: () => {
      setDetail(undefined);
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not unassign this booking.'),
  });

  const update = (patch: Partial<BookingFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: 1 }));

  const meta = bookings.data?.meta;
  const rows = bookings.data?.data ?? [];

  return (
    <>
      <PageHeader title="Bookings" subtitle="Every booking across the platform." />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Search">
            <Input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && update({ search: searchDraft })}
              placeholder="Reference, name or phone"
            />
          </Field>
          <Field label="Status">
            <Select
              value={filters.status ?? ''}
              onChange={(event) => update({ status: event.target.value || undefined })}
            >
              <option value="">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.toLowerCase().replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input
              type="date"
              value={filters.from ?? ''}
              onChange={(event) => update({ from: event.target.value || undefined })}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={filters.to ?? ''}
              onChange={(event) => update({ to: event.target.value || undefined })}
            />
          </Field>
        </div>

        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => update({ search: searchDraft })}>
            Apply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearchDraft('');
              setFilters({ page: 1 });
            }}
          >
            Clear
          </Button>
        </div>
      </Card>

      {bookings.error ? (
        <div className="mb-5">
          <ErrorNote error={bookings.error} onRetry={bookings.refetch} />
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-fg">{error}</div>
      ) : null}

      <TableShell>
        <thead>
          <tr>
            <Th>Reference</Th>
            <Th>Date</Th>
            <Th>Customer</Th>
            <Th>Area</Th>
            <Th>Driver</Th>
            <Th>Payment</Th>
            <Th>Status</Th>
            <Th right>Total</Th>
            <Th right>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {bookings.isLoading ? (
            <Skeleton rows={8} cols={9} />
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={9} message="No bookings match these filters." />
          ) : (
            rows.map((booking) => (
              <tr key={booking.id} className="hover:bg-ink-50">
                <Td>
                  <button
                    type="button"
                    onClick={() => setDetail(booking)}
                    className="font-mono text-[13px] font-semibold text-brand hover:underline"
                  >
                    {booking.reference}
                  </button>
                </Td>
                <Td className="whitespace-nowrap text-ink-600">
                  {shortDate(booking.scheduledDate)}
                  <span className="block text-xs text-ink-400">{booking.timeSlot.window}</span>
                </Td>
                <Td className="whitespace-nowrap">
                  {booking.customer.name ?? '—'}
                  <span className="block font-mono text-xs text-ink-400">{booking.customer.phone}</span>
                </Td>
                <Td className="whitespace-nowrap text-ink-600">{booking.address.area}</Td>
                <Td className="whitespace-nowrap text-ink-600">
                  {booking.assignment?.driver?.fullName ?? (
                    <span className="text-ink-400">Unassigned</span>
                  )}
                </Td>
                <Td>
                  <StatusPill status={booking.paymentStatus} />
                </Td>
                <Td>
                  <StatusPill status={booking.status} label={booking.statusLabel} />
                </Td>
                <Td right className="nums font-semibold">
                  {naira(booking.pricing.total)}
                </Td>
                <Td right>
                  <div className="flex justify-end gap-1">
                    {booking.assignment ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => doUnassign.mutate(booking.id)}
                      >
                        Unassign
                      </Button>
                    ) : null}
                    {!['COMPLETED', 'CANCELLED'].includes(booking.status) ? (
                      <Button size="sm" variant="ghost" onClick={() => setCancelling(booking)}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      {meta && meta.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="nums text-sm text-ink-600">
            Page {meta.page} of {meta.totalPages} · {meta.total} bookings
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={meta.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!meta.hasNextPage}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {/* Detail */}
      <Modal open={Boolean(detail)} title={detail?.reference ?? ''} onClose={() => setDetail(undefined)}>
        {detail ? (
          <dl className="space-y-3 text-sm">
            {[
              ['Status', detail.statusLabel],
              ['Payment', detail.paymentStatus],
              ['Scheduled', `${shortDate(detail.scheduledDate)} · ${detail.timeSlot.window}`],
              ['Customer', `${detail.customer.name ?? '—'} · ${detail.customer.phone}`],
              ['Address', `${detail.address.addressLine}, ${detail.address.area}`],
              [
                'Driver',
                detail.assignment?.driver?.fullName
                  ? `${detail.assignment.driver.fullName}${
                      detail.assignment.truck ? ` · ${detail.assignment.truck.truckNumber}` : ''
                    }`
                  : 'Unassigned',
              ],
              ['Total', naira(detail.pricing.total)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-6 border-b border-ink-100 pb-2">
                <dt className="text-ink-500">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Modal>

      {/* Cancel — reason is mandatory, matching the API. */}
      <Modal
        open={Boolean(cancelling)}
        title={`Cancel ${cancelling?.reference ?? ''}?`}
        onClose={() => setCancelling(undefined)}
      >
        <p className="text-sm text-ink-600">
          The customer is notified. Refunds are handled separately — cancelling here does not move
          money.
        </p>
        <div className="mt-4">
          <Field label="Reason" hint="Recorded in the audit log and shown to the customer.">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Truck breakdown, rescheduled by phone"
              autoFocus
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelling(undefined)}>
            Keep booking
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 3 || doCancel.isPending}
            onClick={() => doCancel.mutate()}
          >
            {doCancel.isPending ? 'Cancelling…' : 'Cancel booking'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
