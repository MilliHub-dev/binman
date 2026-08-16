# Going to production

Everything below is configuration on the hosting platforms. No further code
changes are needed; the server refuses to boot with `NODE_ENV=production` until
these are right, which is deliberate — each guard exists because the failure it
prevents is silent.

## 1. Render (API) — environment variables

```
NODE_ENV=production
OTP_DEBUG_RETURN=false
SMS_PROVIDER=sendchamp
EMAIL_PROVIDER=sendchamp
CORS_ORIGINS=https://binman.ng,https://www.binman.ng,https://admin.binman.ng
```

Plus fresh secrets. **Do not reuse the development values** — they are in the
repository's history and in every developer's `.env`, so anyone who has seen
either can mint a token for any account, administrators included.

```
JWT_ACCESS_SECRET=<48 random bytes, base64url>
JWT_REFRESH_SECRET=<different 48 random bytes>
FLUTTERWAVE_WEBHOOK_SECRET_HASH=<24 random bytes, hex — must match the value set in the Flutterwave dashboard>
```

Generate them with:

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Rotating the JWT secrets signs every existing session out. That is the correct
behaviour when moving off shared development keys.

## 2. Blockers that configuration alone will not fix

**The Sendchamp sender ID must be one they have approved.** The credential is
valid, but the sender name is not:

```
sender_name=BinMan     -> 400  "invalid sender name: BinMan"
sender_name=Sendchamp  -> 200  accepted
```

Set `SENDCHAMP_SENDER_NAME=Sendchamp` to go live now. Register `BinMan` as a
sender ID in the Sendchamp dashboard and switch once approved — that string is
what recipients see as the sender, so it is worth having.

**Flutterwave keys are LIVE.** `FLUTTERWAVE_SECRET_KEY` in `.env` is a live
credential, so every booking taken will move real money. Confirm that is
intended before the first customer arrives.

**The webhook hash must match Flutterwave.** The value above is only half of the
pair; set the same string in the Flutterwave dashboard's webhook configuration.
Without it, valid callbacks are rejected and paid bookings never advance.

## 3. Database

`prisma migrate deploy` against the production database, then `npm run seed` for
service areas, time slots and pricing. The seed also creates
`admin@binman.com` with a published password and `mustChangePassword: true` —
sign in once and change it before anyone else can.

## 4. Web (Vercel or equivalent)

Both apps default to the hosted API in code, so they need no variable to work.
Set `NEXT_PUBLIC_API_URL` only to point somewhere else.

Whatever domains they end up on must appear in `CORS_ORIGINS` above, or every
browser request fails preflight.

## 5. Mobile

`eas build --profile production --platform android`. The profile already carries
`EXPO_PUBLIC_API_URL=https://binman-kx0b.onrender.com`.

Check before submitting: the Android adaptive icon is `img/logo.png`, a 1.1MB
square including the wordmark. Launchers mask adaptive icons to a circle and
trim the outer ~25%, so the wordmark will be cropped. A foreground with just the
mark and generous padding survives the mask.

## 6. Hosting

Render's free tier suspends instances when idle, and a cold start runs past 20
seconds. The mobile client waits 45s to accommodate that, but a customer opening
the app to a 45-second pause is a bad first impression. A plan that does not
sleep is the fix.
