'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTruck, listTrucks, updateTruck } from '@/lib/admin';
import { ApiError } from '@/lib/api';
import {
  Button,
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

const STATUSES = ['AVAILABLE', 'ASSIGNED', 'ON_ROUTE', 'MAINTENANCE', 'OUT_OF_SERVICE'] as const;

/** Truck management (prd.md §28). */
export default function TrucksPage() {
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const [form, setForm] = useState({
    truckNumber: '',
    registrationNumber: '',
    truckType: 'Compactor',
    capacity: '',
  });

  const trucks = useQuery({ queryKey: ['trucks'], queryFn: () => listTrucks() });
  const refresh = () => void client.invalidateQueries({ queryKey: ['trucks'] });

  const add = useMutation({
    mutationFn: () =>
      createTruck({
        truckNumber: form.truckNumber.trim(),
        registrationNumber: form.registrationNumber.trim(),
        truckType: form.truckType.trim(),
        ...(form.capacity.trim() ? { capacity: form.capacity.trim() } : {}),
      }),
    onSuccess: () => {
      setAdding(false);
      setForm({ truckNumber: '', registrationNumber: '', truckType: 'Compactor', capacity: '' });
      setError(undefined);
      refresh();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not add truck.'),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateTruck(id, { status }),
    onSuccess: () => {
      setError(undefined);
      refresh();
    },
    // The API refuses to take a truck off the road mid-job — show why.
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not update truck.'),
  });

  const rows = trucks.data?.data ?? [];
  const canAdd = form.truckNumber.trim() && form.registrationNumber.trim() && form.truckType.trim();

  return (
    <>
      <PageHeader
        title="Trucks"
        subtitle="Fleet and road status."
        action={<Button onClick={() => setAdding(true)}>Add truck</Button>}
      />

      {trucks.error ? (
        <div className="mb-5">
          <ErrorNote error={trucks.error} onRetry={trucks.refetch} />
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-fg">{error}</div>
      ) : null}

      <TableShell>
        <thead>
          <tr>
            <Th>Truck</Th>
            <Th>Registration</Th>
            <Th>Type</Th>
            <Th>Capacity</Th>
            <Th>Status</Th>
            <Th right>Set status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {trucks.isLoading ? (
            <Skeleton rows={5} cols={6} />
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={6} message="No trucks yet. Add your first one." />
          ) : (
            rows.map((truck) => (
              <tr key={truck.id} className="hover:bg-ink-50">
                <Td className="font-semibold">{truck.truckNumber}</Td>
                <Td className="whitespace-nowrap font-mono text-[13px]">{truck.registrationNumber}</Td>
                <Td className="text-ink-600">{truck.truckType}</Td>
                <Td className="text-ink-600">{truck.capacity ?? '—'}</Td>
                <Td>
                  <StatusPill status={truck.status} />
                </Td>
                <Td right>
                  <Select
                    value={truck.status}
                    aria-label={`Status for ${truck.truckNumber}`}
                    onChange={(event) =>
                      setStatus.mutate({ id: truck.id, status: event.target.value })
                    }
                    className="w-44"
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status.toLowerCase().replace(/_/g, ' ')}
                      </option>
                    ))}
                  </Select>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <Modal open={adding} title="Add truck" onClose={() => setAdding(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Truck number" hint="Your internal reference, e.g. TRK-004">
              <Input
                value={form.truckNumber}
                onChange={(event) => setForm({ ...form, truckNumber: event.target.value })}
                placeholder="TRK-004"
                autoFocus
              />
            </Field>
            <Field label="Registration">
              <Input
                value={form.registrationNumber}
                onChange={(event) => setForm({ ...form, registrationNumber: event.target.value })}
                placeholder="UYO-104-XA"
              />
            </Field>
          </div>
          <Field label="Type">
            <Select
              value={form.truckType}
              onChange={(event) => setForm({ ...form, truckType: event.target.value })}
            >
              {['Compactor', 'Tipper', 'Open truck', 'Van'].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </Select>
          </Field>
          <Field label="Capacity (optional)">
            <Input
              value={form.capacity}
              onChange={(event) => setForm({ ...form, capacity: event.target.value })}
              placeholder="5 tonnes"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAdding(false)}>
            Cancel
          </Button>
          <Button disabled={!canAdd || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? 'Adding…' : 'Add truck'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
