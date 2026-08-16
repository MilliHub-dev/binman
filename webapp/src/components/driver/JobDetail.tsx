'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, tokens } from '@/lib/api';
import {
  currentPosition,
  FAILURE_REASONS,
  getJob,
  NEXT_ACTION,
  type Job,
} from '@/lib/driver';
import { enqueue, flush, readCachedJobs } from '@/lib/offline';
import { ProofCapture } from './ProofCapture';

/**
 * Job detail and the field workflow (driver.md §3–4, §7).
 *
 * Every action is queued to IndexedDB first and the UI advances immediately.
 * A driver behind a building gets the same experience as one on 4G; the queue
 * reconciles when signal returns.
 */
export function JobDetail({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [showFail, setShowFail] = useState(false);
  const [hasProof, setHasProof] = useState(false);
  /** True when the job on screen came from cache rather than the API. */
  const [stale, setStale] = useState(false);

  /** Local echo of the booking status so the UI can move while offline. */
  const [localStatus, setLocalStatus] = useState<string>();

  const load = useCallback(async () => {
    try {
      const data = await getJob(assignmentId);
      setJob(data);
      setLocalStatus(data.booking.status);
      setError(undefined);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        tokens.clear();
        router.replace('/driver');
        return;
      }
      // Offline: fall back to the copy cached by the job list.
      if (err instanceof ApiError && err.isOffline) {
        const cached = await readCachedJobs<Job>();
        const match = cached?.jobs.find((entry) => entry.assignmentId === assignmentId);
        if (match) {
          setJob(match);
          setLocalStatus(match.booking.status);
          setError(undefined);
          setStale(true);
          return;
        }
      }
      setError(err instanceof ApiError ? err.message : 'Could not load this job.');
    }
  }, [assignmentId, router]);

  useEffect(() => {
    if (!tokens.get()) {
      router.replace('/driver');
      return;
    }
    // `load` is async: every setState inside it runs after an await, so nothing
    // is set synchronously during this effect. The rule cannot see through the
    // async boundary, and fetch-on-mount is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, router]);

  const status = localStatus ?? job?.booking.status ?? '';
  const next = NEXT_ACTION[status] ?? null;
  const needsAccepting = job?.assignmentStatus === 'PENDING';

  /**
   * The server refuses COMPLETED without proof on file, so the button is
   * blocked here too — a driver should hit a clear message, not a 409.
   */
  const blockedForProof = next?.status === 'COMPLETED' && !hasProof;

  const accept = async () => {
    setBusy(true);
    await enqueue({ kind: 'accept', assignmentId });
    setJob((current) => (current ? { ...current, assignmentStatus: 'ACCEPTED' } : current));
    void flush().then(load);
    setBusy(false);
  };

  const advance = async () => {
    if (!next || blockedForProof) return;
    setBusy(true);

    const position = await currentPosition();
    await enqueue({
      kind: 'status',
      assignmentId,
      status: next.status,
      ...position,
    });

    setLocalStatus(next.status);
    void flush().then(load);
    setBusy(false);
  };

  const reportFailure = async (reason: string, description: string) => {
    setBusy(true);
    await enqueue({
      kind: 'fail',
      assignmentId,
      reason,
      ...(description ? { description } : {}),
    });
    setLocalStatus('FAILED');
    setShowFail(false);
    void flush().then(load);
    setBusy(false);
  };

  if (error && !job) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="rounded-card bg-danger-bg px-4 py-3 text-[#a81f24]">{error}</p>
        <button type="button" onClick={load} className="tap-target mt-4 w-full rounded-xl bg-brand font-semibold text-white">
          Try Again
        </button>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10" aria-busy="true">
        <div className="h-56 animate-pulse rounded-card bg-ink-200" />
      </main>
    );
  }

  const { booking } = job;
  const mapsUrl =
    booking.address.latitude && booking.address.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${booking.address.latitude},${booking.address.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${booking.address.addressLine}, ${booking.address.area}, ${booking.address.city}`,
        )}`;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-40 pt-4">
      <Link href="/driver/jobs" className="inline-flex items-center gap-1 py-2 text-ink-600">
        ← All jobs
      </Link>

      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">{booking.reference}</h1>
        <span className="rounded-md bg-ink-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-700">
          {status.replace(/_/g, ' ')}
        </span>
      </div>

      <p className="mt-1 text-lg font-semibold text-brand">{booking.timeSlot.window}</p>

      {stale ? (
        <p className="mt-3 rounded-lg bg-warn-bg px-3 py-2 text-sm text-[#8a5200]">
          Offline — these details were saved earlier and may have changed.
        </p>
      ) : null}

      {/* Address first — it is what the driver needs before anything else. */}
      <section className="mt-5 rounded-card border-2 border-ink-200 bg-white p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">Collect from</h2>
        <p className="mt-2 text-lg font-semibold">{booking.address.addressLine}</p>
        <p className="text-ink-600">
          {booking.address.area}, {booking.address.city}
        </p>

        {booking.address.instructions ? (
          <p className="mt-3 rounded-lg bg-warn-bg px-3 py-2 text-sm text-[#8a5200]">
            <span aria-hidden="true">📝</span> {booking.address.instructions}
          </p>
        ) : null}

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-target mt-4 flex items-center justify-center rounded-xl bg-ink-900 font-semibold text-white"
        >
          <span aria-hidden="true">🧭</span>&nbsp; Navigate
        </a>
      </section>

      <section className="mt-4 rounded-card border-2 border-ink-200 bg-white p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">Customer</h2>
        <p className="mt-2 text-lg font-semibold">
          {booking.customer.fullName ?? 'BinMan customer'}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <a
            href={`tel:${booking.address.contactPhone ?? booking.customer.phone}`}
            className="tap-target flex items-center justify-center rounded-xl border-2 border-ink-300 font-semibold"
          >
            📞 Call
          </a>
          <a
            href={`https://wa.me/${(booking.address.contactPhone ?? booking.customer.phone).replace(/^\+/, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap-target flex items-center justify-center rounded-xl border-2 border-ink-300 font-semibold"
          >
            💬 WhatsApp
          </a>
        </div>
      </section>

      {booking.waste ? (
        <section className="mt-4 rounded-card border-2 border-ink-200 bg-white p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">The load</h2>
          <p className="mt-2 text-lg font-semibold capitalize">
            {booking.waste.collectionSize.toLowerCase().replace(/_/g, ' ')}
          </p>
          <p className="text-ink-600">
            {booking.waste.wasteTypes
              .map((type) => type.toLowerCase().replace(/_/g, ' '))
              .join(', ')}
          </p>
          {booking.waste.specialInstructions ? (
            <p className="mt-3 text-sm text-ink-600">{booking.waste.specialInstructions}</p>
          ) : null}
        </section>
      ) : null}

      {showProof ? (
        <ProofCapture
          assignmentId={assignmentId}
          onDone={() => {
            setHasProof(true);
            setShowProof(false);
          }}
          onCancel={() => setShowProof(false)}
        />
      ) : null}

      {showFail ? (
        <FailureSheet
          busy={busy}
          onSubmit={reportFailure}
          onCancel={() => setShowFail(false)}
        />
      ) : null}

      {/* Actions are pinned: a driver holding a bin bag should not have to
          scroll to find the next step. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-ink-200 bg-white p-4">
        <div className="mx-auto max-w-2xl space-y-2">
          {needsAccepting ? (
            <button
              type="button"
              onClick={accept}
              disabled={busy}
              className="tap-target w-full rounded-xl bg-brand text-lg font-bold text-white disabled:opacity-45"
            >
              Accept Job
            </button>
          ) : status === 'ARRIVED' || status === 'COLLECTED' ? (
            <>
              <button
                type="button"
                onClick={() => setShowProof(true)}
                className={`tap-target w-full rounded-xl text-lg font-bold ${
                  hasProof ? 'bg-leaf-50 text-leaf-800' : 'bg-ink-900 text-white'
                }`}
              >
                {hasProof ? '✓ Proof captured' : '📷 Capture Proof'}
              </button>
              {next ? (
                <button
                  type="button"
                  onClick={advance}
                  disabled={busy || blockedForProof}
                  className="tap-target w-full rounded-xl bg-brand text-lg font-bold text-white disabled:opacity-45"
                >
                  {next.label}
                </button>
              ) : null}
              {blockedForProof ? (
                <p className="text-center text-sm text-ink-600">
                  Capture proof of collection before completing.
                </p>
              ) : null}
            </>
          ) : next ? (
            <button
              type="button"
              onClick={advance}
              disabled={busy}
              className="tap-target w-full rounded-xl bg-brand text-lg font-bold text-white disabled:opacity-45"
            >
              {next.label}
            </button>
          ) : (
            <p className="py-2 text-center font-semibold text-leaf-700">
              ✓ This job is finished
            </p>
          )}

          {next && !needsAccepting ? (
            <button
              type="button"
              onClick={() => setShowFail(true)}
              className="tap-target w-full text-sm font-medium text-danger"
            >
              Can&apos;t complete this job
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
}

/** A failed collection always needs a reason (driver.md §7). */
function FailureSheet({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (reason: string, description: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink-900/55" role="dialog" aria-modal="true">
      <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5">
        <h2 className="text-xl font-extrabold tracking-tight">Why can&apos;t you complete it?</h2>
        <p className="mt-1 text-sm text-ink-600">
          Operations needs the reason to sort out the customer.
        </p>

        <div className="mt-4 space-y-2">
          {FAILURE_REASONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setReason(option.value)}
              className={`tap-target flex w-full items-center justify-between rounded-xl border-2 px-4 text-left font-medium ${
                reason === option.value ? 'border-brand bg-brand-50' : 'border-ink-200'
              }`}
            >
              {option.label}
              {reason === option.value ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Anything else operations should know?"
          rows={3}
          className="mt-3 w-full rounded-xl border-2 border-ink-200 p-3 outline-none focus:border-brand"
        />

        <button
          type="button"
          onClick={() => onSubmit(reason, description)}
          disabled={!reason || busy}
          className="tap-target mt-3 w-full rounded-xl bg-danger text-lg font-bold text-white disabled:opacity-45"
        >
          Report Problem
        </button>
        <button type="button" onClick={onCancel} className="tap-target mt-1 w-full text-ink-600">
          Back
        </button>
      </div>
    </div>
  );
}
