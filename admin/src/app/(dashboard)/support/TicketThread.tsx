'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listTicketMessages, replyToTicket } from '@/lib/admin';
import { ErrorNote } from '@/components/ui';

/**
 * The conversation on one ticket, with a box to answer it.
 *
 * Support was one-way before this: staff could change a status and read the
 * customer's number, but the only way to actually respond was to pick up a
 * phone. A written reply also leaves a record of what was promised, which a
 * call does not.
 */
export function TicketThread({ ticketId }: { ticketId: string }) {
  const [body, setBody] = useState('');
  const queryClient = useQueryClient();

  const messages = useQuery({
    queryKey: ['ticket-messages', ticketId],
    queryFn: () => listTicketMessages(ticketId),
  });

  const send = useMutation({
    mutationFn: () => replyToTicket(ticketId, body.trim()),
    onSuccess: () => {
      setBody('');
      void queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] });
      // Replying moves an open ticket to in-progress, so the queue changes too.
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const items = messages.data ?? [];

  return (
    <div className="mt-3 rounded-lg border-2 border-ink-100 bg-ink-50 p-3">
      {messages.isLoading ? (
        <p className="text-sm text-ink-500">Loading conversation…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-500">No replies yet.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((message) => (
            <li
              key={message.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                message.fromStaff
                  ? 'ml-auto bg-brand/10 text-ink-800'
                  : 'mr-auto bg-white text-ink-700'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.body}</p>
              <p className="mt-1 text-[11px] text-ink-500">
                {message.fromStaff ? 'You' : 'Customer'} ·{' '}
                {new Date(message.createdAt).toLocaleString('en-NG', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </li>
          ))}
        </ol>
      )}

      {send.error ? <ErrorNote error={send.error} /> : null}

      <div className="mt-3 flex gap-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Write a reply — the customer sees this in the app."
          className="min-w-0 flex-1 rounded-lg border-2 border-ink-200 bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => send.mutate()}
          disabled={body.trim().length === 0 || send.isPending}
          className="shrink-0 self-end rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {send.isPending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
