'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createServiceArea,
  listServiceAreas,
  listTimeSlots,
  updateServiceArea,
  updateTimeSlot,
} from '@/lib/admin';
import { naira } from '@/lib/format';
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
  Skeleton,
  StatusPill,
  TableShell,
  Td,
  Th,
} from '@/components/ui';

const minutesToLabel = (minutes: number) => {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

/**
 * Service areas and time slots (admin.md §7, §9).
 *
 * Both decide whether a customer can book at all, so they live together: a
 * booking needs a covered area AND a slot with capacity left.
 */
export default function AreasPage() {
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const [form, setForm] = useState({ name: '', city: 'Uyo', state: 'Akwa Ibom', surcharge: '0' });

  const areas = useQuery({ queryKey: ['areas'], queryFn: listServiceAreas });
  const slots = useQuery({ queryKey: ['time-slots'], queryFn: listTimeSlots });

  const add = useMutation({
    mutationFn: () =>
      createServiceArea({
        name: form.name.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        // Entered in naira, stored in kobo.
        surcharge: Math.round(Number(form.surcharge || 0) * 100),
      }),
    onSuccess: () => {
      setAdding(false);
      setForm({ name: '', city: 'Uyo', state: 'Akwa Ibom', surcharge: '0' });
      setError(undefined);
      void client.invalidateQueries({ queryKey: ['areas'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not add area.'),
  });

  const toggleArea = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateServiceArea(id, { isActive }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['areas'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not update area.'),
  });

  const changeCapacity = useMutation({
    mutationFn: ({ id, maxBookings }: { id: string; maxBookings: number }) =>
      updateTimeSlot(id, { maxBookings }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['time-slots'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not update slot.'),
  });

  return (
    <>
      <PageHeader
        title="Service areas & slots"
        subtitle="Where you collect, and how many jobs each window can take."
        action={<Button onClick={() => setAdding(true)}>Add area</Button>}
      />

      {error ? (
        <div className="mb-5 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-fg">{error}</div>
      ) : null}

      {areas.error ? (
        <div className="mb-5">
          <ErrorNote error={areas.error} onRetry={areas.refetch} />
        </div>
      ) : null}

      <h2 className="mb-3 font-display text-base font-bold tracking-tight">Coverage</h2>
      <TableShell>
        <thead>
          <tr>
            <Th>Area</Th>
            <Th>City</Th>
            <Th>State</Th>
            <Th right>Surcharge</Th>
            <Th>Status</Th>
            <Th right>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {areas.isLoading ? (
            <Skeleton rows={6} cols={6} />
          ) : (areas.data ?? []).length === 0 ? (
            <EmptyRow colSpan={6} message="No service areas configured — nobody can book." />
          ) : (
            (areas.data ?? []).map((area) => (
              <tr key={area.id} className="hover:bg-ink-50">
                <Td className="font-medium">{area.name}</Td>
                <Td className="text-ink-600">{area.city}</Td>
                <Td className="text-ink-600">{area.state}</Td>
                <Td right className="nums">
                  {area.surcharge > 0 ? naira(area.surcharge) : '—'}
                </Td>
                <Td>
                  <StatusPill status={area.isActive ? 'ACTIVE' : 'OFFLINE'} label={area.isActive ? 'Active' : 'Paused'} />
                </Td>
                <Td right>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleArea.mutate({ id: area.id, isActive: !area.isActive })}
                  >
                    {area.isActive ? 'Pause' : 'Activate'}
                  </Button>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <h2 className="mb-3 mt-8 font-display text-base font-bold tracking-tight">
        Collection windows
      </h2>
      <p className="mb-3 text-sm text-ink-600">
        Capacity is per day — each window can take this many bookings on any single date.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {slots.isLoading
          ? [0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-ink-200" />)
          : (slots.data ?? []).map((slot) => (
              <Card key={slot.id}>
                <p className="font-display font-bold tracking-tight">
                  {minutesToLabel(slot.startTime)} – {minutesToLabel(slot.endTime)}
                </p>
                <div className="mt-3">
                  <Field label="Max bookings per day">
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      defaultValue={slot.maxBookings}
                      onBlur={(event) => {
                        const value = Number(event.target.value);
                        if (value > 0 && value !== slot.maxBookings) {
                          changeCapacity.mutate({ id: slot.id, maxBookings: value });
                        }
                      }}
                    />
                  </Field>
                </div>
                <StatusPill
                  status={slot.isActive ? 'ACTIVE' : 'OFFLINE'}
                  label={slot.isActive ? 'Offered' : 'Hidden'}
                />
              </Card>
            ))}
      </div>

      <Modal open={adding} title="Add service area" onClose={() => setAdding(false)}>
        <div className="space-y-3">
          <Field label="Area name" hint="Must match how customers write it on their address.">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ewet Housing Estate"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Input
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
            </Field>
            <Field label="State">
              <Input
                value={form.state}
                onChange={(event) => setForm({ ...form, state: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Surcharge (₦)" hint="Added to every booking in this area. 0 for none.">
            <Input
              type="number"
              min={0}
              value={form.surcharge}
              onChange={(event) => setForm({ ...form, surcharge: event.target.value })}
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAdding(false)}>
            Cancel
          </Button>
          <Button disabled={!form.name.trim() || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? 'Adding…' : 'Add area'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
