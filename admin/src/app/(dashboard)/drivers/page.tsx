'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createDriver, listDrivers, suspendDriver, updateDriver } from '@/lib/admin';
import { ApiError } from '@/lib/api';
import {
  Button,
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

/** Driver management (prd.md §27). */
export default function DriversPage() {
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    licenseNumber: '',
  });

  const drivers = useQuery({ queryKey: ['drivers'], queryFn: () => listDrivers() });

  const refresh = () => void client.invalidateQueries({ queryKey: ['drivers'] });

  const add = useMutation({
    mutationFn: () =>
      createDriver({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        ...(form.licenseNumber.trim() ? { licenseNumber: form.licenseNumber.trim() } : {}),
      }),
    onSuccess: () => {
      setAdding(false);
      setForm({ firstName: '', lastName: '', phone: '', licenseNumber: '' });
      setError(undefined);
      refresh();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not create driver.'),
  });

  const verify = useMutation({
    mutationFn: (id: string) => updateDriver(id, { verificationStatus: 'VERIFIED' }),
    onSuccess: refresh,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not verify driver.'),
  });

  const suspend = useMutation({
    mutationFn: suspendDriver,
    onSuccess: refresh,
    // The API refuses while the driver still has open jobs — surface that.
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not suspend driver.'),
  });

  const rows = drivers.data?.data ?? [];
  const canAdd = form.firstName.trim() && form.lastName.trim() && form.phone.replace(/\D/g, '').length >= 10;

  return (
    <>
      <PageHeader
        title="Drivers"
        subtitle="Collection staff and their verification status."
        action={<Button onClick={() => setAdding(true)}>Add driver</Button>}
      />

      {drivers.error ? (
        <div className="mb-5">
          <ErrorNote error={drivers.error} onRetry={drivers.refetch} />
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-fg">{error}</div>
      ) : null}

      <TableShell>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Phone</Th>
            <Th>Licence</Th>
            <Th>Default truck</Th>
            <Th>Verification</Th>
            <Th>Availability</Th>
            <Th right>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {drivers.isLoading ? (
            <Skeleton rows={6} cols={7} />
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={7} message="No drivers yet. Add your first one." />
          ) : (
            rows.map((driver) => (
              <tr key={driver.id} className="hover:bg-ink-50">
                <Td className="font-medium">
                  {[driver.user.firstName, driver.user.lastName].filter(Boolean).join(' ') || '—'}
                </Td>
                <Td className="whitespace-nowrap font-mono text-[13px]">{driver.user.phone}</Td>
                <Td className="text-ink-600">{driver.licenseNumber ?? '—'}</Td>
                <Td className="text-ink-600">{driver.defaultTruck?.truckNumber ?? '—'}</Td>
                <Td>
                  <StatusPill status={driver.verificationStatus} />
                </Td>
                <Td>
                  <StatusPill status={driver.availabilityStatus} />
                </Td>
                <Td right>
                  <div className="flex justify-end gap-1">
                    {driver.verificationStatus !== 'VERIFIED' ? (
                      <Button size="sm" variant="ghost" onClick={() => verify.mutate(driver.id)}>
                        Verify
                      </Button>
                    ) : null}
                    {driver.availabilityStatus !== 'SUSPENDED' ? (
                      <Button size="sm" variant="ghost" onClick={() => suspend.mutate(driver.id)}>
                        Suspend
                      </Button>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <Modal open={adding} title="Add driver" onClose={() => setAdding(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Last name">
              <Input
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Phone number" hint="They sign in to the driver app with this number.">
            <Input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="0801 234 5678"
              inputMode="numeric"
            />
          </Field>
          <Field label="Licence number (optional)">
            <Input
              value={form.licenseNumber}
              onChange={(event) => setForm({ ...form, licenseNumber: event.target.value })}
              placeholder="AKS-DRV-00123"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAdding(false)}>
            Cancel
          </Button>
          <Button disabled={!canAdd || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? 'Creating…' : 'Create driver'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
