'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listTickets,
  updateTicket,
  type SupportTicket,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/admin';
import { Card, EmptyRow, ErrorNote, PageHeader, Skeleton, TableShell, Td, Th } from '@/components/ui';

/**
 * The support queue (admin.md §12).
 *
 * Customers have been able to raise issues from the app since it shipped; the
 * API stored them and ordered them urgent-first, and nothing in here ever
 * showed them to anybody. A ticket landing in a table no member of staff can
 * open is the same as no support at all.
 */

const STATUS_TABS: Array<{ key: 'open' | TicketStatus; label: string; status?: TicketStatus }> = [
  { key: 'open', label: 'Needs a reply' },
  { key: 'IN_PROGRESS', label: 'In progress', status: 'IN_PROGRESS' },
  { key: 'RESOLVED', label: 'Resolved', status: 'RESOLVED' },
  { key: 'CLOSED', label: 'Closed', status: 'CLOSED' },
];

const PRIORITY_STYLE: Record<TicketPriority, string> = {
  URGENT: 'bg-danger-bg text-danger',
  HIGH: 'bg-warn-bg text-[#8a5200]',
  NORMAL: 'bg-ink-100 text-ink-700',
  LOW: 'bg-ink-100 text-ink-500',
};

const STATUS_STYLE: Record<TicketStatus, string> = {
  OPEN: 'bg-brand/10 text-brand',
  IN_PROGRESS: 'bg-warn-bg text-[#8a5200]',
  RESOLVED: 'bg-ok-bg text-ok',
  CLOSED: 'bg-ink-100 text-ink-500',
};

const age = (iso: string) => {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function SupportPage() {
  const [tab, setTab] = useState<'open' | TicketStatus>('open');
  const queryClient = useQueryClient();

  const active = STATUS_TABS.find((t) => t.key === tab)!;
  const tickets = useQuery({
    queryKey: ['tickets', tab],
    queryFn: () => listTickets(active.status ? { status: active.status } : { status: 'OPEN' }),
  });

  const change = useMutation({
    mutationFn: ({ id, ...input }: { id: string; status?: TicketStatus; priority?: TicketPriority }) =>
      updateTicket(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  });

  const items: SupportTicket[] = tickets.data?.data ?? [];

  return (
    <div>
      <PageHeader title="Support" subtitle="Issues raised by customers from the app" />

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setTab(option.key)}
            className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold ${
              tab === option.key
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-ink-200 bg-white text-ink-600'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tickets.error ? <ErrorNote error={tickets.error} /> : null}
      {change.error ? <ErrorNote error={change.error} /> : null}

      <div className="mt-4">
        <TableShell>
          <thead>
            <tr>
              <Th>Ticket</Th>
              <Th>Customer</Th>
              <Th>Issue</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {tickets.isLoading ? (
              <Skeleton rows={4} cols={6} />
            ) : items.length === 0 ? (
              <EmptyRow
                colSpan={6}
                message={
                  tab === 'open'
                    ? 'Nothing waiting for a reply.'
                    : 'No tickets with this status.'
                }
              />
            ) : (
              items.map((ticket) => (
                <tr key={ticket.id} className="align-top">
                  <Td>
                    <div className="font-mono text-xs">{ticket.ticketNumber}</div>
                    <div className="mt-0.5 text-xs text-ink-500">{age(ticket.createdAt)}</div>
                    {ticket.booking ? (
                      <div className="mt-0.5 font-mono text-[11px] text-ink-500">
                        {ticket.booking.reference}
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    <div className="font-semibold">
                      {[ticket.user.firstName, ticket.user.lastName].filter(Boolean).join(' ') ||
                        'Customer'}
                    </div>
                    {/* The number is the reply channel — there is no in-app thread. */}
                    <a href={`tel:${ticket.user.phone}`} className="text-xs text-brand">
                      {ticket.user.phone}
                    </a>
                  </Td>
                  <Td>
                    <div className="font-semibold">{ticket.subject}</div>
                    <p className="mt-0.5 max-w-md whitespace-pre-wrap text-sm text-ink-600">
                      {ticket.description}
                    </p>
                  </Td>
                  <Td>
                    <select
                      value={ticket.priority}
                      onChange={(e) =>
                        change.mutate({ id: ticket.id, priority: e.target.value as TicketPriority })
                      }
                      aria-label={`Priority for ${ticket.ticketNumber}`}
                      className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${PRIORITY_STYLE[ticket.priority]}`}
                    >
                      {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as TicketPriority[]).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td>
                    <span
                      className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${STATUS_STYLE[ticket.status]}`}
                    >
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1.5">
                      {ticket.status === 'OPEN' ? (
                        <button
                          type="button"
                          onClick={() => change.mutate({ id: ticket.id, status: 'IN_PROGRESS' })}
                          disabled={change.isPending}
                          className="rounded-lg border-2 border-ink-200 px-2.5 py-1 text-xs font-semibold"
                        >
                          Start
                        </button>
                      ) : null}
                      {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' ? (
                        <button
                          type="button"
                          onClick={() => change.mutate({ id: ticket.id, status: 'RESOLVED' })}
                          disabled={change.isPending}
                          className="rounded-lg bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          Resolve
                        </button>
                      ) : null}
                      {ticket.status === 'RESOLVED' ? (
                        <button
                          type="button"
                          onClick={() => change.mutate({ id: ticket.id, status: 'CLOSED' })}
                          disabled={change.isPending}
                          className="rounded-lg border-2 border-ink-200 px-2.5 py-1 text-xs font-semibold"
                        >
                          Close
                        </button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      </div>

      <Card className="mt-4">
        <p className="text-sm text-ink-600">
          There is no in-app reply thread yet — call or message the customer on the number above,
          then set the status here. Marking a ticket resolved notifies them in the app.
        </p>
      </Card>
    </div>
  );
}
