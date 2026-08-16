# BinMan API

Backend for the BinMan waste collection & home services platform — the single
API behind the React Native app, the WhatsApp bot, the admin dashboard and the
driver app.

**Stack:** Node.js · TypeScript · Express 5 · PostgreSQL (Prisma) · Redis (BullMQ)
**Providers:** Flutterwave (payments) · Sendchamp (SMS + email) · Cloudinary (images) · Mapbox (geocoding) · FCM (push)

---

## Getting started

```bash
cd server
npm install
cp .env.example .env          # then fill in the secrets
docker compose up -d          # Postgres + Redis
npx prisma migrate dev --name init
npm run seed                  # service areas, time slots, PRICING, staff
npm run dev                   # API   → http://localhost:4000
npm run dev:worker            # background jobs (separate terminal)
```

Check it is alive:

```bash
curl http://localhost:4000/health/ready
```

> **Seeding is not optional.** Prices are never hardcoded in a client
> (`prd.md` §12), so pricing lives entirely in the `pricing_rules` table. With
> no rules seeded, every booking fails with `NO_PRICE_CONFIGURED` — by design.

### Signing in during development

**Admin console** — email and password:

```
email:    admin@binman.com
password: Admin@123dev
```

The seeded account is flagged `mustChangePassword`, so the console forces a
replacement on first sign-in. Override the defaults with `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` before seeding anything real.

**Customers and drivers** — OTP. Set `OTP_DEBUG_RETURN=true` and the code comes
back in the response instead of by SMS.

```bash
curl -X POST localhost:4000/api/v1/auth/request-otp \
  -H 'content-type: application/json' -d '{"phone":"08000000001"}'
# -> { "data": { "debugCode": "418302", ... } }

curl -X POST localhost:4000/api/v1/auth/verify-otp \
  -H 'content-type: application/json' -d '{"phone":"08000000001","otp":"418302"}'
```

`OTP_DEBUG_RETURN=true` is **rejected at boot** when `NODE_ENV` is `staging` or
`production`.

---

## Hosting regions matter more than anything in this codebase

Measured from Nigeria against Neon (us-east-2, Ohio) and Upstash (eu-central):

| Operation | Cost |
| --- | --- |
| Database round trip | ~370 ms |
| Redis command (warm) | ~280 ms |
| Redis first command after connect | 1.5–4.8 s |
| bcrypt compare (12 rounds) | ~530 ms |

A sign-in needs two database round trips, one Redis check and one bcrypt — so
it lands around **2.4s**, almost all of it network. No amount of application
tuning fixes that; moving Postgres and Redis to a region near your users
(`eu-west-1`, or `af-south-1` if available) would cut it several times over.

Two things already compensate for the worst of it:

- **Redis is warmed at boot** and kept alive with a periodic ping. That first
  command is slow enough to exceed the command timeout, so before warming, the
  first sign-in after a restart failed with `CACHE_UNAVAILABLE` while every
  later one worked.
- **Non-essential writes do not block responses.** `lastLoginAt` is stamped in
  the background rather than costing a round trip on every sign-in.

---

## Local ports

Each surface has a pinned port, so they never collide and `CORS_ORIGINS` never
drifts out of step:

| Surface | Port | Command |
| --- | --- | --- |
| API | 4000 | `cd server && npm run dev` |
| Website + driver PWA | 3000 | `cd webapp && npm run dev` |
| Admin console | 3001 | `cd admin && npm run dev` |
| Mobile app | — | `cd mobile && npx expo start` |

Browser surfaces must appear in `CORS_ORIGINS` or the API refuses them. The
mobile app sends no `Origin` header and is unaffected.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | API with hot reload |
| `npm run dev:worker` | Background worker with hot reload |
| `npm run build` / `npm start` | Compile to `dist/` and run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run prisma:migrate` | Create and apply a migration |
| `npm run prisma:studio` | Browse the database |
| `npm run seed` | Seed configuration data |

---

## Architecture

```
src/
  config/env.ts        Env parsed + validated once at boot; process exits if invalid
  lib/                 prisma, redis, logger, errors, money, phone, datetime, audit
  middleware/          authenticate, authorize, validate, rateLimit, errorHandler
  modules/<domain>/    <domain>.{routes,controller,service,schema}.ts
  services/            Provider seams: flutterwave, whatsapp, sms, push, storage
  queues/              BullMQ queues + the worker process
```

**The rule:** routes validate, controllers translate HTTP, **services own the
business logic**. The WhatsApp bot calls the same services the mobile app does
(`prd.md` §33) — it holds no rules of its own, so the two channels cannot drift.

### Conventions worth knowing

- **Money is an integer number of kobo.** ₦2,500 is `250000`. Flutterwave speaks
  naira, and that conversion happens in exactly one place (`lib/money.ts`).
- **Phone numbers are E.164** (`+2348012345678`). Normalisation happens during
  validation, so every layer below sees one spelling. This is the identity key
  shared by the app, WhatsApp and SMS.
- **Time slots are minutes from midnight** (`07:00` → `420`), interpreted in
  `Africa/Lagos`, never the server's timezone.
- **Every response uses one envelope** (`trsa.md` §6) and carries an
  `x-request-id` you can grep the logs for.

---

## Things that are deliberate

**Booking creation runs at `SERIALIZABLE` isolation.** Slot capacity is a
read-then-write decision; at `READ COMMITTED` two customers can both see the
last free place and both take it. Postgres aborts one transaction instead.

**A booking's status only ever changes through the state machine** in
`modules/bookings/booking.status.ts`. Customer, driver, dispatcher and payment
webhook all go through `transitionBooking`, so no path can skip payment or
complete a job that was never collected.

**The client can never mark a booking paid.** A booking becomes `PAID` only
after the status is read back from the Flutterwave API — the webhook body is
treated as a notification that something happened, never as evidence of what
(`trsa.md` §9). Amount and currency are re-checked before crediting; a mismatch
records the payment as `FAILED` and leaves the booking unpaid.

**Webhooks are idempotent** via a unique `(provider, eventKey)` index. A
redelivery hits a duplicate-key error and is skipped rather than double-applied.

**A driver cannot complete a job without proof of collection.** That is the
entire point of `prd.md` §16, so it is enforced in the service, not the client.

**Staff use passwords; customers and drivers use OTP.** The two prove different
things — a password proves knowledge of a secret, an OTP proves possession of a
phone — so they are separate flows with separate threat models. Operations staff
work at a shared desk where waiting for an SMS every session is friction with no
security benefit; a customer's phone number IS their identity.

**A failed sign-in is indistinguishable from an unknown email.** Both return the
same `INVALID_CREDENTIALS`, and an unknown address still costs a bcrypt compare
so response timing cannot be used to enumerate staff accounts either.

**Rate limits are in Redis**, so they hold across instances. The OTP limiters
fail *closed* when Redis is unavailable — serving OTP traffic unthrottled would
turn a cache outage into an SMS-bill attack. Everything else fails *open*.

**Refunds are not automatic.** Cancelling inside the window flags
`refundEligible`; a human decides. A truck already dispatched has incurred cost.

**Dead push tokens are cleared, not retried.** When FCM reports a token as
unregistered — the usual meaning of an app uninstall — the token is removed from
the user and the job is marked failed without consuming five retries on a device
that no longer exists.

**Provider credentials never reach a client.** The app calls `/api/v1/geo/*`
rather than holding a Mapbox token, and Cloudinary uploads are signed
server-side. Sendchamp's "public key" is its secret API credential despite the
name — it is server-only too.

---

## Webhook setup

Three providers call us. **None of them has a `*_WEBHOOK_URL` env var** — the
provider calls us, so each URL is registered on that provider's dashboard. What
we store is the secret that proves the call is genuine.

| Provider | Path | Secret env var |
| --- | --- | --- |
| Flutterwave | `/api/v1/payments/webhook` | `FLUTTERWAVE_WEBHOOK_SECRET_HASH` |
| Sendchamp | `/api/v1/webhooks/sendchamp` | `SENDCHAMP_WEBHOOK_SECRET` |
| WhatsApp | `/api/v1/whatsapp/webhook` | `WHATSAPP_APP_SECRET` |

### Sendchamp — delivery status

`SENT` only means we handed the message to Sendchamp. This callback is what
turns a notification into `DELIVERED` or `FAILED`. Without it, a message that
never reached the handset stays recorded as sent, and support cannot answer
"I never got my code".

Register `<public API origin>/api/v1/webhooks/sendchamp` on the Sendchamp
dashboard and set the same shared secret in `SENDCHAMP_WEBHOOK_SECRET`.

> Sendchamp's signing scheme is not consistently documented across their
> products, so the handler accepts the secret from any of the headers they are
> known to use. **Confirm the actual mechanism for your account** — if it signs
> with an HMAC instead, swap `isAuthentic()` in
> `modules/notifications/delivery-webhook.routes.ts` for a digest over
> `req.rawBody`, which app.ts already captures.

### Firebase Cloud Messaging

`FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL` and `FCM_PRIVATE_KEY` all come from a
single service-account JSON:

1. [Firebase Console](https://console.firebase.google.com) → select your project
2. Gear icon → **Project settings** → **Service accounts** tab
3. **Generate new private key** → downloads a `.json`
4. Copy `project_id`, `client_email` and `private_key` into the three vars

That JSON can push a notification to every BinMan user — treat it like a
password, and delete the download once the values are in `.env`.

**The private-key trap:** the JSON stores newlines as the two characters `\` +
`n`. Paste the value exactly as it appears, wrapped in double quotes, on one
line. `config/env.ts` unescapes it at boot, so a key that looks wrong in the
file is still correct in memory:

```
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADAN...\n-----END PRIVATE KEY-----\n"
```

Setting `PUSH_PROVIDER=fcm` without all three values — or with a key that is not
a PEM — fails at boot rather than silently dropping notifications later.

The mobile app needs its own Firebase config (`google-services.json` /
`GoogleService-Info.plist`). These server credentials only **send**; they do not
let a device receive.

### Flutterwave webhook setup

There is **no `FLUTTERWAVE_WEBHOOK_URL` env var**, because Flutterwave calls us —
the URL is registered on their dashboard, not read from our config. What we
store is `FLUTTERWAVE_WEBHOOK_SECRET_HASH`, the shared secret that proves an
incoming request really came from them.

The path is fixed by the route table:

```
<public API origin>/api/v1/payments/webhook
```

| Environment | URL |
| --- | --- |
| Local | `https://<your-tunnel>.ngrok-free.app/api/v1/payments/webhook` |
| Staging | `https://api-staging.binman.ng/api/v1/payments/webhook` |
| Production | `https://api.binman.ng/api/v1/payments/webhook` |

Flutterwave cannot reach `localhost`, so development needs a tunnel:

```bash
ngrok http 4000        # then use the https URL it prints
```

**Register it:** Flutterwave dashboard → Settings → Webhooks. Paste the URL,
set a **Secret hash**, and put that same string in `FLUTTERWAVE_WEBHOOK_SECRET_HASH`.
Requests whose `verif-hash` header does not match are rejected with 401 before
any processing happens.

### Do not confuse it with the redirect URL

`FLUTTERWAVE_REDIRECT_URL` is where the **customer's browser** lands after
checkout — a frontend page (`http://localhost:3000/payments/callback`). It is
not an API route and carries no authority: the page should call
`GET /api/v1/payments/:reference`, which re-verifies against Flutterwave, rather
than trusting the status in the redirect query string.

The webhook and the redirect are independent, and both are safe to fire. Payment
confirmation is idempotent, and a booking is marked paid only after the status is
read back from the Flutterwave API. If the webhook never arrives at all, a
reconciliation worker polls the provider and expires the booking if it was never
paid — the slot is never held hostage by a missing callback.

---

## Gaps this backend closed in the spec

`db.md` was missing tables that other documents require. These now exist:

| Added | Required by |
| --- | --- |
| `pricing_rules` | `admin.md` §6 — admin-configurable pricing |
| `service_areas` | `admin.md` §7 — coverage, reject/waitlist |
| `collection_proofs` | `prd.md` §16, `driver.md` §6 |
| `collection_failures` | `driver.md` §7 — a failure needs a reason |
| `refresh_tokens` | Token rotation and revocation |
| `webhook_events` | `trsa.md` §10 — webhook idempotency |
| `driver_locations` | `driver.md` §5 — route history |
| `cleaner_id` on assignments | Cleaning jobs had no assignment path |

Other corrections:

- `time_slots.max_bookings` is enforced **per date**, by counting live bookings
  on that day. As a global cap it could never have limited anything.
- `POST /pricing/quote` was missing from `api.md`, but the review screen in
  `ui.md` §18 cannot show a price without it.
- The PRD's "twice weekly" and the schema's `BIWEEKLY` are different things;
  both exist as separate frequencies.

---

## API surface

98 endpoints under `/api/v1`. The full table is in [`docs/API.md`](docs/API.md).

| Group | Purpose |
| --- | --- |
| `/auth` | OTP request/verify, refresh, logout, profile setup |
| `/users` | Profile, notification preferences, push token, avatar |
| `/addresses` | Address book with service-area tagging |
| `/geo` | Mapbox forward/reverse geocoding |
| `/time-slots` | Slots and per-date availability |
| `/pricing` | Public price list, server-side quote |
| `/bookings` | Create, list, track, cancel, reschedule |
| `/payments` | Flutterwave initiate, verify, **webhook** |
| `/subscriptions` | Recurring collection |
| `/notifications` | In-app feed, unread count |
| `/reviews`, `/support` | Ratings, support tickets |
| `/driver` | Jobs, status flow, proof, failure, location |
| `/admin` | Dashboard, dispatch, fleet, customers, config, reports |
| `/whatsapp` | Meta Cloud API webhook |

---

## Verification status

Verified against a live Neon Postgres instance:

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | **29 unit tests passing** |
| `npm run test:integration` | **50 end-to-end tests passing** |
| Migration + seed | applied to a real database |

The integration suite runs the full journey from `trsa.md` §16 over real HTTP
against a real database — register → address → quote → book → pay → dispatch →
driver → proof → complete → review — plus the negative cases that matter:
wrong OTP, cross-customer access, out-of-area booking, forged webhook
signature, wrong payment amount, skipped lifecycle step, completion without
proof.

Redis, BullMQ and Flutterwave are aliased to fakes (`tests/integration/fakes/`).
That is deliberate for Flutterwave: the keys in `.env` are LIVE, and a test must
never be able to reach them.

```bash
npm run test:integration     # spins up its own schema, seeds, runs, reports
```

### Test isolation

Integration tests run against a dedicated `binman_test` Postgres schema, created
and truncated by `tests/integration/global-setup.ts`. Development data in
`public` is never touched. The setup deliberately avoids
`prisma db push --force-reset`, which resets the whole datasource — it creates
the schema explicitly and truncates by table name instead.

Neon suspends idle compute and takes several seconds to wake, which is longer
than the Prisma CLI will wait, so the setup warms the connection (with retries)
before any CLI command runs.

### Still unverified

Flutterwave has been written against the v3 API but **never exercised against a
live sandbox** — the integration suite uses a fake. Verify with real test keys
before launch, particularly the `verif-hash` header and the amount check in
`confirmFromProvider`. The same applies to Sendchamp and FCM: both are
implemented and boot-validated, but no message has been sent through either.

## Before production

- [ ] `OTP_DEBUG_RETURN=false` (enforced at boot, but check anyway)
- [ ] Real `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (`openssl rand -base64 48`), and they must differ
- [ ] `FLUTTERWAVE_WEBHOOK_SECRET_HASH` set and matching the dashboard
- [ ] `STORAGE_DRIVER=cloudinary` with real credentials — proof photos are
      dispute evidence and must not sit on an ephemeral container disk
- [ ] `SMS_PROVIDER=sendchamp` and `EMAIL_PROVIDER=sendchamp`, with an approved
      sender ID; keep `SENDCHAMP_SMS_ROUTE=dnd` so OTPs reach DND subscribers
- [ ] `MAPBOX_ACCESS_TOKEN` set — without it addresses save with null
      coordinates and cannot be plotted or navigated to
- [ ] Register the webhook URL on the Flutterwave dashboard (see below)
- [ ] `PUSH_PROVIDER=fcm` with a Firebase service-account key (see below)
- [ ] Run the worker as its own process, with its own restart policy
