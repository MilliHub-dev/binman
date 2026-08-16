'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { currentPosition } from '@/lib/driver';
import { enqueue, flush } from '@/lib/offline';

const MAX_PHOTOS = 5;
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Proof of collection (prd.md §16, driver.md §6): photo + GPS + timestamp.
 *
 * The capture input uses `capture="environment"`, which opens the rear camera
 * directly on Android and iOS rather than a file browser.
 *
 * Photos are queued as Blobs in IndexedDB, so a collection photographed in a
 * dead spot uploads later rather than being lost — which is the whole point of
 * proof: it is the evidence that settles a disputed collection.
 */
export function ProofCapture({
  assignmentId,
  onDone,
  onCancel,
}: {
  assignmentId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Previews are derived from `photos`, so they are computed during render
  // rather than pushed into state from an effect. The effect exists only to
  // revoke the object URLs, which would otherwise leak.
  const previews = useMemo(() => photos.map((photo) => URL.createObjectURL(photo)), [photos]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const addPhotos = (fileList: FileList | null) => {
    if (!fileList) return;
    setError(undefined);

    const incoming = Array.from(fileList);
    const tooBig = incoming.find((file) => file.size > MAX_BYTES);
    if (tooBig) {
      setError('One of those photos is over 8MB. Try again with a smaller shot.');
      return;
    }

    setPhotos((current) => [...current, ...incoming].slice(0, MAX_PHOTOS));
  };

  const submit = async () => {
    if (photos.length === 0) return;
    setBusy(true);

    const position = await currentPosition();
    await enqueue({
      kind: 'proof',
      assignmentId,
      photos,
      ...position,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });

    // Fire the flush but do not wait: the driver should be able to carry on
    // whether or not there is signal right now.
    void flush();
    setBusy(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink-900/55" role="dialog" aria-modal="true">
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5">
        <h2 className="text-xl font-extrabold tracking-tight">Proof of collection</h2>
        <p className="mt-1 text-sm text-ink-600">
          Take a photo of the collected waste. Your location and the time are recorded automatically.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(event) => addPhotos(event.target.files)}
          className="sr-only"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={photos.length >= MAX_PHOTOS}
          className="tap-target mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-300 text-lg font-semibold disabled:opacity-45"
        >
          <span aria-hidden="true">📷</span>
          {photos.length === 0 ? 'Take Photo' : `Add Another (${photos.length}/${MAX_PHOTOS})`}
        </button>

        {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}

        {previews.length > 0 ? (
          <ul className="mt-4 grid grid-cols-3 gap-2">
            {previews.map((url, index) => (
              <li key={url} className="relative">
                {/* A local blob preview; next/image would add nothing here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Proof photo ${index + 1}`}
                  className="h-24 w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                  aria-label={`Remove photo ${index + 1}`}
                  className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-sm text-white"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes (optional) — e.g. collected 4 bags"
          rows={2}
          className="mt-4 w-full rounded-xl border-2 border-ink-200 p-3 outline-none focus:border-brand"
        />

        <button
          type="button"
          onClick={submit}
          disabled={photos.length === 0 || busy}
          className="tap-target mt-3 w-full rounded-xl bg-brand text-lg font-bold text-white disabled:opacity-45"
        >
          {busy ? 'Saving…' : 'Save Proof'}
        </button>
        <button type="button" onClick={onCancel} className="tap-target mt-1 w-full text-ink-600">
          Cancel
        </button>
      </div>
    </div>
  );
}
