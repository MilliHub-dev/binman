# BinMan — Customer App

React Native (Expo SDK 57) customer app for the BinMan waste collection &
home services platform.

**Stack:** Expo 57 · React Native 0.86 · TypeScript · React Navigation · TanStack Query · Zustand

---

## Running it

```bash
cd mobile
npm install
npx expo start          # scan the QR with Expo Go, or press i / a
```

The app talks to the backend in [`../server`](../server). Start that first:

```bash
cd ../server && npm run dev
```

### Pointing at the API

`localhost` means "this device" — an Android emulator or a physical phone
cannot reach your laptop that way. Set the LAN IP:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 npx expo start
```

| Where you run it | API URL |
| --- | --- |
| iOS simulator | `http://localhost:4000` (default) |
| Android emulator | `http://10.0.2.2:4000` |
| Physical device | `http://<your-lan-ip>:4000` |

### Signing in during development

With `OTP_DEBUG_RETURN=true` on the server, the OTP comes back in the API
response and the app **pre-fills the code box** — so you can walk the whole flow
without an SMS provider. The seeded admin is `0800 000 0001`.

---

## Architecture

```
src/
  api/          client (auth + refresh), typed endpoints, TanStack Query hooks
  components/   design-system primitives — Button, Card, Input, Screen, states
  navigation/   typed navigators; RootNavigator switches auth vs app
  screens/      one folder per area: auth, home, booking, bookings, profile
  store/        Zustand — session and the in-progress booking draft
  theme/        colours, spacing, typography, shadows
  utils/        formatting (money, dates, phone)
```

**Server state lives in TanStack Query, not Zustand.** Zustand holds only two
things: who is signed in, and the booking currently being built. Everything else
is a cache of the server, and treating it that way is what keeps the two in sync.

### Conventions

- **Money is kobo.** The API sends `250000` for ₦2,500. Nothing divides by 100
  inline — it goes through `formatNaira` in `utils/format.ts`.
- **No price is ever computed in the app** (prd.md §12). The size cards show
  "from ₦X" out of the server's price list, and the review screen fetches a
  fresh quote before payment.
- **Every screen uses `<Screen>`**, which owns safe areas, keyboard avoidance
  and the pinned footer. That is what keeps the primary button at the same
  height everywhere.

---

## Things that are deliberate

**One refresh at a time.** Six queries firing on app open would trigger six
token refreshes; five would be rejected as reuse, and the server treats reuse as
theft by revoking every session. `api/client.ts` shares a single in-flight
refresh across all callers.

**A network failure never signs you out.** Refresh only clears the session when
the server actually rejects the token. A timeout leaves it intact, so losing
signal mid-booking does not dump you back at the login screen.

**Tokens live in the device keychain** via `expo-secure-store`, never
AsyncStorage. They are cached in memory so the hot path avoids a native round
trip per request.

**The payment screen trusts nothing the browser says.** Checkout runs in a
system browser; on return the app polls `GET /payments/:reference`, and the
server re-verifies against Flutterwave before confirming. If polling times out,
the copy says the booking may still complete rather than claiming failure —
because it might.

**Unavailable time slots are shown disabled with the reason**, not hidden. A
customer who cannot find the 8am slot assumes the app is broken, not that it is
full.

**The booking draft is not persisted.** A half-finished draft restored days
later would carry a stale date and a stale price.

---

## Screens

~30 screens covering the whole customer MVP:

| Area | Screens |
| --- | --- |
| Auth | Onboarding (4 panels), Phone, OTP, Profile setup |
| Home | Home, Services, Notifications |
| Booking | Address, Add address, Waste type, Waste size, Cleaning type, Property, Date & time, Review, Payment, Confirmation |
| Bookings | List (upcoming/active/completed), Detail, Track pickup, Rate service |
| Profile | Profile, Personal info, Addresses, Subscriptions, Create subscription, Notification settings, Support |

---

## Brand

Colours are sampled from `img/logo.png`: azure `#189CF0` and green `#84C024`.
Blue leads — it is what the supplied mockups use for the selected state — and
green carries the environmental accents (recycling, completion, "on the way").

Artwork in `img/` is wired through `src/assets.ts`. Metro resolves `require`
at build time, so paths there must stay static.

---

## Verification status

Run in this environment:

- `npx tsc --noEmit` — clean, **56 source files under `strict`**
- `npx expo-doctor` — **21/21 checks pass**
- `npx expo config` — resolves correctly

**Not yet run:** the app has never been launched. There is no iOS simulator,
Android SDK, CocoaPods or Watchman on the build machine, so nothing here has
been rendered on a device. Typechecking and doctor prove it compiles and is
configured correctly — they do not prove it looks right. Expect layout
adjustments on first run.

### Known gaps

- **No live map on the tracking screen.** ui.md §23 wants the driver's position
  on a map; `@rnmapbox/maps` needs a dev build, so the screen currently shows the
  status timeline and driver card. The coordinates are already in the API
  response, so adding the map is a self-contained change.
- **Push notifications are not wired up.** `expo-notifications` is installed and
  configured, but nothing requests a token or calls
  `PUT /users/me/push-token` yet. The server side is ready.
- **Cleaning flow reuses the waste date/time and review screens**, which is
  correct per ui.md §31, but cleaning pricing needs seeding to be bookable.

---

## Before release

- [ ] Set `EXPO_PUBLIC_API_URL` to the staging/production API
- [ ] Fill `extra.eas.projectId` and run `eas build`
- [ ] Request a push token on first launch and register it with the server
- [ ] Add `@rnmapbox/maps` and the live tracking map
- [ ] Replace emoji tab icons with a proper icon set
- [ ] Bundle the brand font (ui.md §2 suggests Inter / Plus Jakarta Sans)
