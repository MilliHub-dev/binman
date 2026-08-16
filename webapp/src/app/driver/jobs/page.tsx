'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, tokens } from '@/lib/api';
import { getHome, getJobs, setAvailability, type DriverHome, type Job } from '@/lib/driver';
import { cacheJobs, readCachedJobs } from '@/lib/offline';

/** Driver home + today's jobs (driver.md §2). */
export default function JobsPage() {
  const router = useRouter();
  const [home, setHome] = useState<DriverHome>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [scope, setScope] = useState<'today' | 'upcoming' | 'completed'>('today');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [homeData, jobList] = await Promise.all([getHome(), getJobs(scope)]);
      setHome(homeData);
      setJobs(jobList);
      setError(undefined);
      // Kept so the detail screen can still render at the kerbside.
      if (scope === 'today') void cacheJobs(jobList);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        tokens.clear();
        router.replace('/driver');
        return;
      }
      if (err instanceof ApiError && err.isOffline) {
        const cached = await readCachedJobs<Job>();
        if (cached) {
          setJobs(cached.jobs);
          setError(
            `Offline — showing jobs from ${new Date(cached.cachedAt).toLocaleTimeString('en-NG', {
              hour: '2-digit',
              minute: '2-digit',
            })}.`,
          );
        } else {
          setError('You are offline and we have nothing saved yet.');
        }
      } else {
        setError('Could not load your jobs.');
      }
    } finally {
      setLoading(false);
    }
  }, [scope, router]);

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

  const toggleAvailability = async () => {
    if (!home) return;
    const next = home.availabilityStatus === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
    // Optimistic: the switch must feel instant on a slow connection.
    setHome({ ...home, availabilityStatus: next });
    try {
      await setAvailability(next);
    } catch {
      setHome({ ...home });
    }
  };

  const signOut = () => {
    tokens.clear();
    router.replace('/driver');
  };

  const available = home?.availabilityStatus === 'AVAILABLE';

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-5">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Today&apos;s jobs</h1>
          <p className="text-sm text-ink-600">
            {new Date().toLocaleDateString('en-NG', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <button type="button" onClick={signOut} className="p-2 text-sm text-ink-500 underline">
          Sign out
        </button>
      </header>

      {/* Availability is the driver's most-used control, so it sits at the top. */}
      <button
        type="button"
        onClick={toggleAvailability}
        aria-pressed={available}
        className={`tap-target mb-5 flex w-full items-center justify-between rounded-card border-2 px-5 ${
          available ? 'border-leaf bg-leaf-50' : 'border-ink-300 bg-white'
        }`}
      >
        <span className="flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${available ? 'bg-leaf-600' : 'bg-ink-400'}`}
            aria-hidden="true"
          />
          <span className="font-semibold">{available ? 'Available for jobs' : 'Off duty'}</span>
        </span>
        <span className="text-sm text-ink-500">{available ? 'Tap to go off duty' : 'Tap to go on duty'}</span>
      </button>

      {home ? (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: home.today.total },
            { label: 'Completed', value: home.today.completed },
            { label: 'Remaining', value: home.today.remaining },
          ].map((stat) => (
            <div key={stat.label} className="rounded-card border border-ink-200 bg-white p-4 text-center">
              <p className="text-3xl font-extrabold tracking-tight">{stat.value}</p>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-ink-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex rounded-xl bg-ink-100 p-1">
        {(['today', 'upcoming', 'completed'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setScope(value);
              setLoading(true);
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold capitalize ${
              scope === value ? 'bg-brand text-white' : 'text-ink-600'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mb-4 rounded-xl bg-warn-bg px-4 py-3 text-sm text-[#8a5200]">{error}</p>
      ) : null}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-card bg-ink-200" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-card border border-dashed border-ink-300 bg-white p-10 text-center">
          <p className="text-4xl" aria-hidden="true">
            ☕
          </p>
          <p className="mt-3 font-semibold">No jobs {scope === 'today' ? 'today' : `${scope}`}</p>
          <p className="mt-1 text-sm text-ink-600">
            {scope === 'today' ? 'Dispatch will assign work here as it comes in.' : 'Nothing here yet.'}
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {jobs.map((job) => (
            <li key={job.assignmentId}>
              <JobRow job={job} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-warn-bg text-[#8a5200]',
  ACCEPTED: 'bg-brand-50 text-brand-800',
  EN_ROUTE: 'bg-leaf-50 text-leaf-800',
  ARRIVED: 'bg-leaf-50 text-leaf-800',
  COMPLETED: 'bg-leaf-50 text-leaf-800',
  FAILED: 'bg-danger-bg text-[#a81f24]',
};

function JobRow({ job }: { job: Job }) {
  const { booking } = job;
  const needsAccepting = job.assignmentStatus === 'PENDING';

  return (
    <Link
      href={`/driver/jobs/${job.assignmentId}`}
      className={`block rounded-card border-2 bg-white p-4 transition-colors ${
        needsAccepting ? 'border-warn' : 'border-ink-200 hover:border-brand-300'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-500">
          {booking.serviceType === 'WASTE_COLLECTION' ? 'Waste collection' : 'Cleaning'}
        </span>
        <span
          className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${
            STATUS_STYLE[job.assignmentStatus] ?? 'bg-ink-100 text-ink-600'
          }`}
        >
          {needsAccepting ? 'New' : job.assignmentStatus.replace(/_/g, ' ')}
        </span>
      </div>

      <p className="mt-2 text-xl font-bold tracking-tight">{booking.timeSlot.window}</p>

      <p className="mt-1 font-medium text-ink-800">
        <span aria-hidden="true">📍</span> {booking.address.addressLine}, {booking.address.area}
      </p>

      <div className="mt-3 flex items-center justify-between text-sm text-ink-600">
        <span>{booking.customer.fullName ?? booking.customer.phone}</span>
        <span>
          {booking.waste
            ? `${booking.waste.collectionSize.toLowerCase().replace(/_/g, ' ')} load`
            : booking.reference}
        </span>
      </div>
    </Link>
  );
}
