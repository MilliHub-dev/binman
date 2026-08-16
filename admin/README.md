# BinMan Operations

The internal dashboard: dispatch, bookings, customers, fleet, pricing and
reports. All nine sections of [`admin.md`](../admin.md).

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · TanStack Query

---

## Running it

```bash
cd admin
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

Needs the API in [`../server`](../server) running:

```bash
cd ../server && npm run dev
```

Sign in with email and password:

| Account | Email | Password | Role |
| --- | --- | --- | --- |
| Admin | `admin@binman.com` | `Admin@123dev` | `SUPER_ADMIN` |
| Dispatcher | `dispatch@binman.com` | `Admin@123dev` | `DISPATCHER` |

Both seeded accounts are flagged `mustChangePassword`, so the console drops you
straight onto a change-password form and will not let you reach the dashboard
until you have replaced it. That is deliberate — a seeded password is a
published one.

> Redis must be running to sign in. The login rate limiter deliberately **fails
> closed**: without a working throttle an unthrottled password endpoint is a
> brute-force target, so the server refuses rather than allowing it. You'll get
> a clear `CACHE_UNAVAILABLE` 503, not a mystery error.

---

## Why a separate app

`admin/` deploys on its own to its own domain. The operations console is a
different audience and a different security boundary from the public site — it
can be IP-restricted or put behind a VPN without touching customer-facing
infrastructure, and it never ships in the same bundle as marketing pages.

It shares the brand palette with the website and mobile app, but applies it
differently: this is a tool that gets **scanned and operated**, not read. Colour
carries *state* here (amber needs a human, blue is progressing, green is done,
red failed) and the brand blue is reserved for things you can click.

```
src/
  app/
    login/                email + password, with forced first change
    (dashboard)/
      layout.tsx          sidebar, auth gate, unassigned badge
      page.tsx            overview
      dispatch/           assign driver + truck
      bookings/           filter, search, inspect, cancel, unassign
      customers/          list + detail drawer
      drivers/ trucks/    fleet management
      pricing/ areas/     configuration
      reports/            revenue, volume, driver performance, CSV
  components/ui.tsx       primitives
  lib/
    api.ts                fetch client with de-duplicated token refresh
    admin.ts              typed wrappers over 37 admin endpoints
    format.ts             money, dates, status → semantic tone
```

---

## Things that are deliberate

**Summary before detail.** The overview leads with the numbers that decide
whether today is going well, and anything *awaiting a human* is promoted above
the statistics as a call to action — the unassigned-bookings banner links
straight to dispatch, and the count also badges the sidebar.

**Dispatch is one job.** Pick a booking, pick a driver, pick a truck, assign.
Selecting a driver pre-fills the truck they normally drive. The action bar
sticks to the viewport so it stays reachable however long the fleet list runs.
The board polls every 20s — paid bookings arrive continuously.

**The UI only offers legal actions.** The server's state machine is the
authority; screens mirror it rather than letting an operator hit a 409. Where
the API refuses on business grounds — suspending a driver with open jobs,
taking a truck off the road mid-route — the message is surfaced verbatim.

**Cancellation requires a reason**, matching the API, and it goes to the audit
log and the customer.

**Money is entered in naira, stored in kobo.** Conversion happens at the form
boundary only.

**No pricing rules = nobody can book.** The pricing screen says so explicitly
rather than showing an empty table, because an unpriced combination fails
checkout with `NO_PRICE_CONFIGURED`.

**Session state uses `useSyncExternalStore`**, so signing out in one tab signs
out the others instead of leaving a console that 401s on every click.

---

## Verification status

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | succeeds — 10 static routes |
| Route smoke test | all 10 routes return 200; `/login` returns `noindex, nofollow, nocache` |

**Sign-in is verified.** 12 integration tests on the server cover the password
flow end to end — correct credentials, wrong password, unknown email returning
an identical error, non-staff refused, forced password change, and the old
password ceasing to work.

### Not yet verified

**No operator has clicked through the UI.** Redis is unavailable on this
machine and the login limiter fails closed without it, so while the auth flow is
proven at the API level, nobody has driven these screens against live data.

The honest test: start Redis, start the API, sign in as `admin@binman.com`, and
walk a booking from the dispatch board to a completed job.

---

## Before production

- [ ] Set `NEXT_PUBLIC_API_URL` to the deployed API
- [ ] Deploy to its own domain and restrict access (IP allowlist or VPN)
- [ ] Serve over HTTPS
- [ ] Confirm role boundaries suit your team — `SUPPORT` currently sees
      bookings and customers but cannot dispatch or change configuration
- [ ] Consider shortening the access-token TTL for this app specifically; an
      operations console is a higher-value session than a customer's
