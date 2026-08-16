# BinMan API reference

Base URL: `/api/v1`

100 endpoints. Generated from the route definitions in `src/modules/*/*.routes.ts`.

## Conventions

Every response uses one envelope (`trsa.md` §6):

```jsonc
// success
{ "success": true, "message": "Booking created successfully", "data": { } }

// list endpoints add meta
{ "success": true, "message": "Success", "data": [], "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 1, "hasNextPage": false } }

// error
{ "success": false, "message": "Unable to create booking", "error": { "code": "SLOT_FULL", "requestId": "…" } }
```

Authentication is `Authorization: Bearer <accessToken>`. Access tokens last 15
minutes; refresh tokens are opaque, rotate on every use, and are revoked
wholesale if a already-used one is replayed.

**Money is in kobo.** `250000` is ₦2,500.

Access column: **—** public · **User** any signed-in account · **Staff**
support/dispatcher/admin · **Dispatch** dispatcher/admin · **Admin**
admin/super-admin · **Driver** driver/cleaner.

---

## Auth

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/auth/login` | — | **Staff only.** Email + password. 10 attempts per 15 min per email, fails closed. |
| POST | `/auth/change-password` | User | Requires the current password; revokes all other sessions. |
| POST | `/auth/request-otp` | — | Sends a code. 5 per 15 min per number. Returns `isNewUser`. |
| POST | `/auth/verify-otp` | — | Returns tokens. **Creates the account on first success.** |
| POST | `/auth/refresh` | — | Rotates the refresh token. |
| POST | `/auth/logout` | User | `allDevices: true` revokes every session. |
| POST | `/auth/complete-profile` | User | The profile-setup screen (`ui.md` §10). |

## Users

| Method | Path | Access |
| --- | --- | --- |
| GET | `/users/me` | User |
| PATCH | `/users/me` | User |
| PATCH | `/users/me/notification-preferences` | User |
| PUT | `/users/me/push-token` | User |
| POST | `/users/me/avatar` | User (multipart, field `image`) |

## Addresses

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/addresses` | User | Each address carries a `serviceable` flag. |
| POST | `/addresses` | User | Tagged with a service area on write. |
| PATCH | `/addresses/:id` | User | |
| DELETE | `/addresses/:id` | User | Soft delete; refuses if bookings are live. |
| POST | `/addresses/:id/default` | User | |

## Scheduling & pricing

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/time-slots` | — | Active slots. |
| GET | `/time-slots/availability?date=&days=` | — | Per-date capacity; `days>1` returns a range. |
| GET | `/service-areas` | — | Where we operate. |
| GET | `/pricing` | — | "From ₦X" figures for the Services screen. |
| GET | `/geo/search?q=` | User | Mapbox forward geocoding. Token stays server-side. |
| GET | `/geo/reverse?latitude=&longitude=` | User | "Use my location"; also returns whether we cover the spot. |
| POST | `/pricing/quote` | Optional | **Server-side price for the review screen.** Accepts `addressId` when signed in. |

## Bookings

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/bookings` | User | Price computed server-side. Serializable capacity check. |
| GET | `/bookings?scope=upcoming\|active\|completed` | User | Matches the tabs in `ui.md` §26. |
| GET | `/bookings/:id` | User | |
| GET | `/bookings/reference/:reference` | User | The WhatsApp "track" lookup. |
| GET | `/bookings/:id/timeline` | User | Status history for the tracking screen. |
| POST | `/bookings/:id/cancel` | User | Returns `refundEligible`; refunds are not automatic. |
| POST | `/bookings/:id/reschedule` | User | Only before a team is assigned. |

## Payments

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/payments/initiate` | User | Returns a Flutterwave checkout URL. Reuses a live session. |
| GET | `/payments` | User | Payment history. |
| GET | `/payments/:reference` | User | Poll after returning from checkout; re-verifies with the provider. |
| POST | `/payments/webhook` | — | **Flutterwave.** Requires a valid `verif-hash`. Idempotent. |

## Subscriptions

| Method | Path | Access |
| --- | --- | --- |
| POST | `/subscriptions` | User |
| GET | `/subscriptions` | User |
| GET | `/subscriptions/:id` | User |
| PATCH | `/subscriptions/:id` | User (also pause/resume) |
| POST | `/subscriptions/:id/cancel` | User |

## Notifications, reviews, support

| Method | Path | Access |
| --- | --- | --- |
| GET | `/notifications?unreadOnly=` | User |
| GET | `/notifications/unread-count` | User |
| POST | `/notifications/:id/read` | User |
| POST | `/notifications/read-all` | User |
| POST | `/reviews` | User (completed bookings only, once) |
| GET | `/reviews` | User |
| GET | `/reviews/summary` | Staff |
| POST | `/support/tickets` | User |
| GET | `/support/tickets` | User |
| GET | `/support/admin/tickets` | Staff |
| PATCH | `/support/admin/tickets/:id` | Staff |

## Driver app

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/driver/home` | Driver | Today's counters + active job. |
| GET | `/driver/jobs?scope=today` | Driver | |
| GET | `/driver/jobs/:id` | Driver | |
| POST | `/driver/jobs/:id/accept` | Driver | |
| POST | `/driver/jobs/:id/status` | Driver | En route → arrived → collected → completed. |
| POST | `/driver/jobs/:id/proof` | Driver | Multipart, field `photos`. **Required before completing.** |
| POST | `/driver/jobs/:id/fail` | Driver | Reason is mandatory. |
| POST | `/driver/location` | Driver | |
| PATCH | `/driver/availability` | Driver | |

## Admin

| Method | Path | Access |
| --- | --- | --- |
| GET | `/admin/dashboard` | Staff |
| GET | `/admin/operations/live` | Staff |
| GET | `/admin/operations/map` | Staff |
| GET | `/admin/bookings` | Staff |
| GET | `/admin/bookings/:id` | Staff |
| PATCH | `/admin/bookings/:id/status` | Dispatch |
| POST | `/admin/bookings/:id/cancel` | Dispatch |
| GET | `/admin/dispatch?date=` | Dispatch |
| POST | `/admin/bookings/:id/assign` | Dispatch |
| POST | `/admin/bookings/:id/unassign` | Dispatch |
| GET | `/admin/customers` | Staff |
| GET | `/admin/customers/:id` | Staff |
| PATCH | `/admin/customers/:id/status` | Admin |
| GET | `/admin/drivers` · `/admin/drivers/:id` | Staff |
| POST | `/admin/drivers` | Admin |
| PATCH | `/admin/drivers/:id` | Admin |
| POST | `/admin/drivers/:id/suspend` | Admin |
| GET | `/admin/trucks` | Staff |
| POST | `/admin/trucks` · PATCH `/admin/trucks/:id` | Admin |
| GET | `/admin/pricing` | Staff |
| POST | `/admin/pricing` · PATCH `/admin/pricing/:id` | Admin |
| POST | `/admin/pricing/preview` | Admin |
| GET | `/admin/service-areas` | Staff |
| POST | `/admin/service-areas` · PATCH `/admin/service-areas/:id` | Admin |
| GET | `/admin/time-slots` | Staff |
| POST | `/admin/time-slots` · PATCH `/admin/time-slots/:id` | Admin |
| GET | `/admin/reports/revenue` · `/bookings` · `/drivers` · `/subscriptions` | Staff |
| GET | `/admin/reports/export/bookings?format=csv` | Staff |
| GET | `/admin/audit-logs` | Admin |

## Provider webhooks

| Method | Path | Verification |
| --- | --- | --- |
| POST | `/payments/webhook` | Flutterwave `verif-hash` header |
| POST | `/webhooks/sendchamp` | Shared secret header; updates delivery status |
| GET/POST | `/whatsapp/webhook` | Meta `x-hub-signature-256` |

All three are unauthenticated by necessity — the provider calls us — and all
three are idempotent via the `webhook_events` unique index.

## WhatsApp

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/whatsapp/webhook` | — | Meta subscription handshake. |
| POST | `/whatsapp/webhook` | — | Verified by `x-hub-signature-256`; deduplicated by message id. |

## Health

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Liveness. |
| GET | `/health/ready` | Readiness — checks Postgres and Redis. |

---

## Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422 | Field-level `details[]` included. |
| `TOKEN_MISSING` / `TOKEN_INVALID` / `TOKEN_EXPIRED` | 401 | |
| `REFRESH_TOKEN_REUSED` | 401 | Replay detected; all sessions revoked. |
| `ACCOUNT_SUSPENDED` | 403 | |
| `INSUFFICIENT_ROLE` | 403 | |
| `OTP_COOLDOWN` / `OTP_RATE_LIMITED` | 429 | |
| `OTP_INVALID` / `OTP_EXPIRED` / `OTP_MAX_ATTEMPTS` | 401/400 | |
| `OUTSIDE_SERVICE_AREA` | 400 | Not covered yet. |
| `SERVICE_AREA_WAITLIST` | 400 | Paused; waitlist available. |
| `NO_PRICE_CONFIGURED` | 400 | No pricing rule matches — a config gap. |
| `SLOT_FULL` | 409 | Capacity reached for that date. |
| `SLOT_IN_PAST` / `DATE_IN_PAST` / `DATE_TOO_FAR` | 400 | |
| `INVALID_STATUS_TRANSITION` | 409 | Blocked by the state machine. |
| `BOOKING_NOT_CANCELLABLE` | 409 | Job already under way. |
| `PROOF_REQUIRED` | 409 | Cannot complete without proof. |
| `ALREADY_PAID` | 409 | |
| `PAYMENT_INITIATION_FAILED` | 503 | Flutterwave unreachable or refused. |
| `INVALID_WEBHOOK_SIGNATURE` | 401 | |
| `DUPLICATE_RESOURCE` | 409 | Unique constraint. |
| `RATE_LIMITED` | 429 | |
| `INVALID_CREDENTIALS` | 401 | Wrong password OR unknown email — deliberately identical. |
| `LOGIN_RATE_LIMITED` | 429 | Too many password attempts for that email. |
| `PASSWORD_TOO_SHORT` / `PASSWORD_TOO_WEAK` | 400 | |
| `NOT_STAFF` | 403 | Valid credentials, but the role has no console access. |
| `CACHE_UNAVAILABLE` | 503 | Redis down; OTP and login fail closed. |
| `DATABASE_UNAVAILABLE` | 503 | Postgres unreachable — the client should retry. |
| `GEOCODING_UNAVAILABLE` | 503 | Mapbox lookup failed; fall back to manual entry. |
| `STORAGE_NOT_CONFIGURED` | 503 | Cloudinary credentials missing. |
| `UPLOAD_FAILED` | 503 | Cloudinary rejected the image. |
