'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignBooking, getDispatchBoard, type DispatchBoard } from '@/lib/admin';
import { naira, today } from '@/lib/format';
import { ApiError } from '@/lib/api';
import { Button, Card, ErrorNote, Input, PageHeader, StatusPill } from '@/components/ui';

/**
 * Dispatch (admin.md §4, prd.md §29).
 *
 * Two columns: work waiting on the left, the fleet on the right. Pick a job,
 * pick a driver, pick a truck, assign. That is the entire job of this screen and
 * nothing else competes with it.
 *
 * Polls every 20s — new paid bookings arrive continuously and a dispatcher
 * should not have to refresh to see them.
 */
export default function DispatchPage() {
  const client = useQueryClient();
  const [date, setDate] = useState(today());
  const [bookingId, setBookingId] = useState<string>();
  const [driverId, setDriverId] = useState<string>();
  const [truckId, setTruckId] = useState<string>();
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string }>();

  const board = useQuery({
    queryKey: ['dispatch', date],
    queryFn: () => getDispatchBoard(date),
    refetchInterval: 20_000,
  });

  const assign = useMutation({
    mutationFn: () => assignBooking(bookingId!, { driverId, ...(truckId ? { truckId } : {}) }),
    onSuccess: () => {
      setNote({ tone: 'ok', text: 'Assigned. The driver will see it on their app.' });
      setBookingId(undefined);
      setDriverId(undefined);
      setTruckId(undefined);
      void client.invalidateQueries({ queryKey: ['dispatch'] });
      void client.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => {
      setNote({
        tone: 'error',
        text: error instanceof ApiError ? error.message : 'Could not assign this booking.',
      });
    },
  });

  const data = board.data;
  const selectedBooking = data?.unassigned.find((item) => item.id === bookingId);
  const canAssign = Boolean(bookingId && driverId) && !assign.isPending;

  return (
    <>
      <PageHeader
        title="Dispatch"
        subtitle="Assign paid bookings to a driver and truck."
        action={
          <Input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setBookingId(undefined);
            }}
            className="w-auto"
            aria-label="Dispatch date"
          />
        }
      />

      {board.error ? (
        <div className="mb-6">
          <ErrorNote error={board.error} onRetry={board.refetch} />
        </div>
      ) : null}

      {note ? (
        <div
          className={`mb-6 rounded-xl px-4 py-3 text-sm ${
            note.tone === 'ok' ? 'bg-ok-bg text-ok-fg' : 'bg-danger-bg text-danger-fg'
          }`}
          role="status"
        >
          {note.text}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        {/* LEFT — work waiting */}
        <section aria-labelledby="unassigned-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="unassigned-heading" className="font-display text-base font-bold tracking-tight">
              Waiting to be assigned
            </h2>
            <span className="nums rounded-full bg-ink-100 px-2.5 py-1 text-xs font-bold text-ink-700">
              {data?.unassigned.length ?? 0}
            </span>
          </div>

          {board.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-ink-200" />
              ))}
            </div>
          ) : (data?.unassigned.length ?? 0) === 0 ? (
            <Card className="py-14 text-center">
              <p className="text-2xl" aria-hidden="true">
                ✓
              </p>
              <p className="mt-2 font-semibold">Everything is assigned</p>
              <p className="mt-1 text-sm text-ink-600">
                Nothing is waiting for a team on this date.
              </p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {data!.unassigned.map((booking) => {
                const selected = bookingId === booking.id;
                return (
                  <li key={booking.id}>
                    <button
                      type="button"
                      onClick={() => setBookingId(selected ? undefined : booking.id)}
                      aria-pressed={selected}
                      className={`w-full rounded-xl border-2 bg-white p-4 text-left transition-colors ${
                        selected ? 'border-brand bg-brand-50' : 'border-ink-200 hover:border-ink-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[13px] font-bold">{booking.reference}</span>
                        <div className="flex items-center gap-2">
                          <StatusPill status={booking.paymentStatus} />
                          <span className="nums text-sm font-bold">{naira(booking.totalAmount)}</span>
                        </div>
                      </div>

                      <p className="mt-2 font-display text-lg font-bold tracking-tight">
                        {booking.window}
                      </p>

                      <p className="mt-0.5 text-sm text-ink-700">
                        {booking.addressLine}, {booking.area}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-600">
                        <span>{booking.customer}</span>
                        <span className="font-mono">{booking.phone}</span>
                        {booking.collectionSize ? (
                          <span className="capitalize">
                            {booking.collectionSize.toLowerCase().replace(/_/g, ' ')} load
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* RIGHT — the fleet, plus the assign action */}
        <section aria-labelledby="fleet-heading" className="space-y-6">
          <div>
            <h2 id="fleet-heading" className="mb-3 font-display text-base font-bold tracking-tight">
              Drivers
            </h2>
            <div className="space-y-2">
              {(data?.drivers ?? []).map((driver) => {
                const selected = driverId === driver.id;
                const unavailable = driver.status === 'SUSPENDED';
                return (
                  <button
                    key={driver.id}
                    type="button"
                    disabled={unavailable}
                    onClick={() => {
                      setDriverId(selected ? undefined : driver.id);
                      // Pre-fill the truck they normally drive; still overridable.
                      if (!selected && driver.defaultTruck) setTruckId(driver.defaultTruck.id);
                    }}
                    aria-pressed={selected}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 bg-white p-3 text-left transition-colors disabled:opacity-45 ${
                      selected ? 'border-brand bg-brand-50' : 'border-ink-200 hover:border-ink-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{driver.name ?? driver.phone}</p>
                      <p className="nums text-xs text-ink-500">
                        {driver.jobsToday} job{driver.jobsToday === 1 ? '' : 's'} today
                        {driver.defaultTruck ? ` · ${driver.defaultTruck.truckNumber}` : ''}
                      </p>
                    </div>
                    <StatusPill status={driver.status} />
                  </button>
                );
              })}
              {(data?.drivers.length ?? 0) === 0 && !board.isLoading ? (
                <Card className="text-center text-sm text-ink-500">No drivers on the system yet.</Card>
              ) : null}
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-display text-base font-bold tracking-tight">Trucks</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {(data?.trucks ?? []).map((truck) => {
                const selected = truckId === truck.id;
                const unavailable = truck.status === 'MAINTENANCE' || truck.status === 'OUT_OF_SERVICE';
                return (
                  <button
                    key={truck.id}
                    type="button"
                    disabled={unavailable}
                    onClick={() => setTruckId(selected ? undefined : truck.id)}
                    aria-pressed={selected}
                    className={`rounded-xl border-2 bg-white p-3 text-left transition-colors disabled:opacity-45 ${
                      selected ? 'border-brand bg-brand-50' : 'border-ink-200 hover:border-ink-300'
                    }`}
                  >
                    <p className="text-sm font-semibold">{truck.truckNumber}</p>
                    <p className="text-xs text-ink-500">{truck.truckType}</p>
                    <div className="mt-1.5">
                      <StatusPill status={truck.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* The action bar sticks so it is reachable however long the fleet list runs. */}
          <div className="sticky bottom-4">
            <Card className="shadow-lg">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                Ready to assign
              </p>
              <p className="mt-1.5 text-sm">
                {selectedBooking ? (
                  <>
                    <span className="font-mono font-bold">{selectedBooking.reference}</span>
                    {driverId ? (
                      <>
                        {' → '}
                        <span className="font-semibold">
                          {data?.drivers.find((d) => d.id === driverId)?.name ?? 'driver'}
                        </span>
                        {truckId
                          ? ` · ${data?.trucks.find((t) => t.id === truckId)?.truckNumber ?? ''}`
                          : ''}
                      </>
                    ) : (
                      <span className="text-ink-500"> — now pick a driver</span>
                    )}
                  </>
                ) : (
                  <span className="text-ink-500">Pick a booking on the left to start.</span>
                )}
              </p>

              <Button
                onClick={() => assign.mutate()}
                disabled={!canAssign}
                className="mt-3 w-full"
              >
                {assign.isPending ? 'Assigning…' : 'Assign Booking'}
              </Button>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}

export type { DispatchBoard };
