# BinMan — Web

Two things in one Next.js app:

- **`/`** — the public marketing site, statically generated for SEO and speed
- **`/driver`** — the driver & operations PWA from [`driver.md`](../driver.md)

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4

---

## Running it

```bash
cd webapp
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

The driver app needs the API in [`../server`](../server) running:

```bash
cd ../server && npm run dev
```

### Testing the driver app on a real phone

`localhost` means the phone itself, so point it at your machine's LAN IP:

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://192.168.1.20:4000
```

Then open `http://192.168.1.20:3000/driver` on the phone. The seed creates a
driver on **0800 000 0003**; with `OTP_DEBUG_RETURN=true` on the server, the
code is pre-filled.

> The service worker only registers in production (`npm run build && npm start`).
> In development its cache fights hot reload and produces stale-bundle bugs that
> look like application errors.

---

## Why one app instead of two

The landing page and the driver app share a palette, an API client and a
deployment. Splitting them would mean maintaining two copies of the design
tokens and two pipelines for what is, in traffic terms, a small site.

They are kept apart where it matters: marketing routes are static and indexable,
`/driver` is client-rendered, `noindex`, and behind OTP auth.

```
src/
  app/
    page.tsx              landing (static)
    manifest.ts           PWA manifest → /manifest.webmanifest
    driver/
      page.tsx            OTP login
      jobs/page.tsx       today's jobs + availability
      jobs/[id]/page.tsx  job detail + field workflow
  components/
    marketing/            SiteHeader
    driver/               JobDetail, ProofCapture, OfflineBar
  lib/
    api.ts                fetch client with token refresh
    driver.ts             typed driver endpoints
    offline.ts            IndexedDB action queue + job cache
public/sw.js              app-shell service worker
```

---

## The offline queue

Drivers work outdoors on patchy data. A collection marked complete behind a
building must not be lost, so **every field action is written to IndexedDB
first** and the UI advances immediately. The queue drains when signal returns.

```
tap "Waste Collected"
  └→ enqueue to IndexedDB       (instant, works offline)
     └→ flush on reconnect / focus / 30s tick
        └→ POST /driver/jobs/:id/status
```

Details that matter:

- **Order is preserved.** Oldest first, and the drain stops at the first offline
  failure — a status change must land before the proof that depends on it.
- **4xx responses are dropped, not retried.** The server rejected the action on
  its merits; replaying it fails identically forever.
- **Proof photos queue as Blobs.** IndexedDB rather than localStorage, which
  would base64-inflate them by a third.
- **The queue is always visible.** A banner shows pending count, so a driver
  never ends a shift believing everything synced when it didn't.

### What the service worker does and doesn't cache

It caches the **app shell** so the PWA opens with no signal. It deliberately
**never caches API responses** — a stale job list could send a driver to a
collection that was reassigned an hour ago.

The middle ground is a job cache in IndexedDB, written whenever the job list
loads. Offline, the driver sees the address and customer they last loaded,
clearly labelled as possibly out of date, instead of an error at the kerbside.

---

## Field-condition decisions

- **56px minimum tap target** via a single `.tap-target` utility, so no field
  control can accidentally be smaller. Well above the 44px baseline — this is
  used one-handed, sometimes with gloves.
- **Address first** on the job screen. It is what a driver needs before anything
  else; customer and load details come after.
- **Actions are pinned to the bottom.** Someone holding a bin bag should not
  have to scroll to find the next step.
- **The workflow only ever offers the next legal step.** The server's state
  machine rejects anything out of order, so the UI mirrors it rather than
  letting a driver hit a 409.
- **Complete is blocked without proof**, matching the server rule — a clear
  message beats a rejected request.
- **A failed collection always needs a reason** (`driver.md` §7).
- **GPS never blocks an action.** A fix can take 20 seconds indoors, so it is
  best-effort with a 4-second timeout.

---

## Verification status

Run in this environment:

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | succeeds — 5 static routes, 1 dynamic |
| Server smoke test | landing page, `/driver`, manifest and `sw.js` all serve; 404s work |

Confirmed live: the landing page renders its real title and content, `/driver`
returns `noindex`, and `/manifest.webmanifest` serves valid JSON with
`start_url: /driver`.

### Not yet verified

- **The offline queue has never been exercised against a real dead spot.** The
  logic is unit-testable but untested; the honest check is a phone in aeroplane
  mode completing a job, then reconnecting.
- **No driver has logged in.** The auth flow is wired to the same OTP endpoints
  the mobile app uses and typechecks against them, but no end-to-end run has
  happened.
- **Installability is unconfirmed.** The manifest and service worker are in
  place; whether Chrome offers "Add to home screen" needs a device over HTTPS.

### Known lint suppression

`src/app/driver/jobs/page.tsx` and `src/components/driver/JobDetail.tsx` each
carry one `react-hooks/set-state-in-effect` suppression for fetch-on-mount. Every
`setState` in those loaders runs after an `await`, so nothing is set
synchronously — the rule cannot see through the async boundary. If this app
grows more data loading, adopting TanStack Query (as the mobile app does) would
remove the suppressions and add caching.

---

## Before production

- [ ] Point `NEXT_PUBLIC_API_URL` at the deployed API and set `NEXT_PUBLIC_SITE_URL`
- [ ] Serve over HTTPS — service workers and geolocation both require it
- [ ] Replace the placeholder app-store links in the download section
- [ ] Add real Open Graph artwork (currently reuses onboarding art)
- [ ] Confirm the 0700 BINMAN number and support email
- [ ] Consider `next/font` for a brand typeface; the app currently uses the
      system stack
