'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCustomer, listCustomers, setCustomerStatus } from '@/lib/admin';
import { shortDate } from '@/lib/format';
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

/** Customer management (admin.md §5). */
export default function CustomersPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string>();
  const [error, setError] = useState<string>();

  const customers = useQuery({
    queryKey: ['customers', { search, page }],
    queryFn: () => listCustomers({ search: search || undefined, page }),
  });

  const detail = useQuery({
    queryKey: ['customer', openId],
    queryFn: () => getCustomer(openId!),
    enabled: Boolean(openId),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) =>
      setCustomerStatus(id, status),
    onSuccess: () => {
      setError(undefined);
      void client.invalidateQueries({ queryKey: ['customers'] });
      void client.invalidateQueries({ queryKey: ['customer'] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not update this customer.'),
  });

  const meta = customers.data?.meta;
  const rows = customers.data?.data ?? [];
  const record = detail.data;

  return (
    <>
      <PageHeader title="Customers" subtitle="Everyone who has signed up." />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Field label="Search">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setSearch(draft);
                    setPage(1);
                  }
                }}
                placeholder="Name, phone or email"
              />
            </Field>
          </div>
          <Button
            onClick={() => {
              setSearch(draft);
              setPage(1);
            }}
          >
            Search
          </Button>
          {search ? (
            <Button
              variant="ghost"
              onClick={() => {
                setDraft('');
                setSearch('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </Card>

      {customers.error ? (
        <div className="mb-5">
          <ErrorNote error={customers.error} onRetry={customers.refetch} />
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
            <Th>Email</Th>
            <Th right>Bookings</Th>
            <Th right>Addresses</Th>
            <Th>Joined</Th>
            <Th>Status</Th>
            <Th right>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {customers.isLoading ? (
            <Skeleton rows={8} cols={8} />
          ) : rows.length === 0 ? (
            <EmptyRow colSpan={8} message="No customers match that search." />
          ) : (
            rows.map((customer) => (
              <tr key={customer.id} className="hover:bg-ink-50">
                <Td>
                  <button
                    type="button"
                    onClick={() => setOpenId(customer.id)}
                    className="font-medium text-brand hover:underline"
                  >
                    {customer.fullName ?? 'Unnamed'}
                  </button>
                </Td>
                <Td className="whitespace-nowrap font-mono text-[13px]">{customer.phone}</Td>
                <Td className="text-ink-600">{customer.email ?? '—'}</Td>
                <Td right className="nums">
                  {customer.counts.bookings}
                </Td>
                <Td right className="nums">
                  {customer.counts.addresses}
                </Td>
                <Td className="whitespace-nowrap text-ink-600">{shortDate(customer.createdAt)}</Td>
                <Td>
                  <StatusPill status={customer.status} />
                </Td>
                <Td right>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={toggleStatus.isPending}
                    onClick={() =>
                      toggleStatus.mutate({
                        id: customer.id,
                        status: customer.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED',
                      })
                    }
                  >
                    {customer.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                  </Button>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      {meta && meta.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="nums text-sm text-ink-600">
            Page {meta.page} of {meta.totalPages} · {meta.total} customers
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!meta.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Modal
        open={Boolean(openId)}
        title={record?.fullName ?? 'Customer'}
        onClose={() => setOpenId(undefined)}
      >
        {detail.isLoading ? (
          <div className="h-40 animate-pulse rounded-lg bg-ink-200" />
        ) : record ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-ink-50">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                  Lifetime value
                </p>
                <p className="nums mt-1 font-display text-xl font-extrabold">
                  {record.lifetimeValueFormatted}
                </p>
              </Card>
              <Card className="bg-ink-50">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                  Paid bookings
                </p>
                <p className="nums mt-1 font-display text-xl font-extrabold">
                  {record.successfulPayments}
                </p>
              </Card>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                Recent bookings
              </p>
              <ul className="space-y-1.5">
                {(record.recentBookings ?? []).slice(0, 6).map((booking) => (
                  <li
                    key={booking.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-ink-50 px-3 py-2"
                  >
                    <span className="font-mono text-[13px]">{booking.reference}</span>
                    <StatusPill status={booking.status} />
                  </li>
                ))}
                {(record.recentBookings ?? []).length === 0 ? (
                  <li className="text-ink-500">No bookings yet.</li>
                ) : null}
              </ul>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
