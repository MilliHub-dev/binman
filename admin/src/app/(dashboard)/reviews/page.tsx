'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRatingSummary, listReviews, type AdminReview } from '@/lib/admin';
import { Card, EmptyRow, ErrorNote, PageHeader, Skeleton, TableShell, Td, Th } from '@/components/ui';

/**
 * Ratings and reviews (admin.md §23).
 *
 * The data has been arriving since the app shipped a rating screen; there was
 * simply nowhere in here to read it. An average tells you there is a problem —
 * the comments tell you which driver, which area, and what happened, which is
 * the only version anyone can act on.
 *
 * Poor ratings lead by default. Nobody opens this page to enjoy the five-stars.
 */

const FILTERS = [
  { key: 'poor', label: 'Needs attention (1–3)', params: { maxRating: 3 } },
  { key: 'good', label: 'Positive (4–5)', params: { minRating: 4 } },
  { key: 'all', label: 'All reviews', params: {} },
] as const;

const Stars = ({ rating }: { rating: number }) => (
  <span
    className={rating <= 2 ? 'text-danger' : rating === 3 ? 'text-[#a96908]' : 'text-brand'}
    aria-label={`${rating} out of 5`}
  >
    <span aria-hidden="true" className="tracking-tight">
      {'★'.repeat(rating)}
      <span className="text-ink-300">{'★'.repeat(5 - rating)}</span>
    </span>
  </span>
);

/**
 * The rating screen folds its quick tags into the first line of the comment,
 * separated from any free text by a blank line. Splitting them back out here
 * keeps the tags scannable instead of buried in a paragraph.
 */
const splitComment = (comment: string | null) => {
  if (!comment) return { tags: [] as string[], text: '' };
  const [head, ...rest] = comment.split('\n\n');
  const looksLikeTags = head.includes(' · ') || (rest.length > 0 && head.length < 80);
  return looksLikeTags
    ? { tags: head.split(' · ').map((t) => t.trim()).filter(Boolean), text: rest.join('\n\n') }
    : { tags: [], text: comment };
};

export default function ReviewsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('poor');
  const active = FILTERS.find((f) => f.key === filter)!;

  const summary = useQuery({ queryKey: ['rating-summary'], queryFn: getRatingSummary });
  const reviews = useQuery({
    queryKey: ['reviews', filter],
    queryFn: () => listReviews(active.params),
  });

  const items: AdminReview[] = reviews.data?.data ?? [];
  const total = summary.data?.total ?? 0;

  return (
    <div>
      <PageHeader title="Ratings" subtitle="What customers said after the job" />

      {/* Distribution first: the shape of the scores is the headline. */}
      <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Average</p>
          {summary.isLoading ? (
            <div className="mt-2 h-10 w-24 animate-pulse rounded bg-ink-200" />
          ) : (
            <>
              <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums">
                {summary.data?.average.toFixed(1) ?? '—'}
              </p>
              <p className="mt-1 text-sm text-ink-600">
                from {total} review{total === 1 ? '' : 's'}
              </p>
            </>
          )}
        </Card>

        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Distribution</p>
          <div className="mt-3 space-y-1.5">
            {[...(summary.data?.distribution ?? [])].reverse().map((row) => {
              const share = total > 0 ? (row.count / total) * 100 : 0;
              return (
                <div key={row.rating} className="flex items-center gap-3 text-sm">
                  <span className="w-8 tabular-nums text-ink-600">{row.rating}★</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className={`h-full rounded-full ${row.rating <= 2 ? 'bg-danger' : row.rating === 3 ? 'bg-[#f5a623]' : 'bg-brand'}`}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums text-ink-600">{row.count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold ${
              filter === option.key
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-ink-200 bg-white text-ink-600'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {reviews.error ? <ErrorNote error={reviews.error} /> : null}

      <div className="mt-4">
      <TableShell>
        <thead>
          <tr>
            <Th>Rating</Th>
            <Th>Customer</Th>
            <Th>Job</Th>
            <Th>Attended by</Th>
            <Th>What they said</Th>
          </tr>
        </thead>
        <tbody>
          {reviews.isLoading ? (
            <Skeleton rows={4} cols={5} />
          ) : items.length === 0 ? (
            <EmptyRow colSpan={5} message="No reviews in this range yet." />
          ) : (
            items.map((review) => {
              const { tags, text } = splitComment(review.comment);
              return (
                <tr key={review.id} className="align-top">
                  <Td>
                    <Stars rating={review.rating} />
                    <div className="mt-1 text-xs text-ink-500">
                      {new Date(review.createdAt).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </div>
                  </Td>
                  <Td>
                    <div className="font-semibold">{review.customer.name ?? 'Customer'}</div>
                    <div className="text-xs text-ink-500">{review.customer.phone}</div>
                  </Td>
                  <Td>
                    <div className="font-mono text-xs">{review.booking.reference}</div>
                    <div className="text-xs text-ink-500">
                      {review.booking.area ?? '—'}
                      {review.booking.city ? `, ${review.booking.city}` : ''}
                    </div>
                  </Td>
                  <Td>
                    {review.attendedBy ? (
                      <>
                        <div>{review.attendedBy.name ?? '—'}</div>
                        <div className="text-xs text-ink-500">
                          {review.attendedBy.role === 'DRIVER' ? 'Driver' : 'Cleaner'}
                        </div>
                      </>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </Td>
                  <Td>
                    {tags.length > 0 ? (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                              review.rating <= 3
                                ? 'bg-danger-bg text-danger'
                                : 'bg-ink-100 text-ink-700'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {text ? (
                      <p className="max-w-md text-sm text-ink-700">{text}</p>
                    ) : tags.length === 0 ? (
                      <span className="text-ink-400">No comment</span>
                    ) : null}
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableShell>
      </div>
    </div>
  );
}
