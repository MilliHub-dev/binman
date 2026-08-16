# API SPECIFICATION

## AUTH

### POST /api/v1/auth/request-otp

Request:

```json
{
  "phone": "+2348000000000"
}
```

### POST /api/v1/auth/verify-otp

```json
{
  "phone": "+2348000000000",
  "otp": "123456"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "JWT",
    "refreshToken": "JWT",
    "user": {}
  }
}
```

---

# USER

### GET /api/v1/users/me

Returns authenticated user.

### PATCH /api/v1/users/me

Updates profile.

---

# ADDRESSES

### GET /api/v1/addresses

Returns customer's addresses.

### POST /api/v1/addresses

```json
{
  "label": "Home",
  "addressLine": "15 Example Street",
  "area": "Ewet Housing Estate",
  "city": "Uyo",
  "state": "Akwa Ibom",
  "latitude": 5.0377,
  "longitude": 7.9128
}
```

### PATCH /api/v1/addresses/:id

Update address.

### DELETE /api/v1/addresses/:id

Delete address.

---

# BOOKINGS

### POST /api/v1/bookings

```json
{
  "serviceType": "WASTE_COLLECTION",
  "addressId": "address-id",
  "scheduledDate": "2026-08-20",
  "timeSlotId": "slot-id",
  "wasteType": "HOUSEHOLD",
  "collectionSize": "MEDIUM",
  "notes": "Please call when you arrive."
}
```

### GET /api/v1/bookings

Returns customer's bookings.

### GET /api/v1/bookings/:id

Returns booking details.

### POST /api/v1/bookings/:id/cancel

Cancel booking.

---

# PAYMENTS

### POST /api/v1/payments/initiate

Creates payment transaction.

### GET /api/v1/payments/:reference

Checks payment.

### POST /api/v1/payments/webhook

Receives payment provider webhook.

---

# DRIVER

### GET /api/v1/driver/jobs

Returns assigned jobs.

### GET /api/v1/driver/jobs/:id

Returns job details.

### POST /api/v1/driver/jobs/:id/accept

Accept job.

### POST /api/v1/driver/jobs/:id/status

Update job status.

Example:

```json
{
  "status": "DRIVER_EN_ROUTE"
}
```

### POST /api/v1/driver/jobs/:id/proof

Upload proof of collection.

---

# ADMIN

### GET /api/v1/admin/bookings

List all bookings.

### POST /api/v1/admin/bookings/:id/assign

```json
{
  "driverId": "driver-id",
  "truckId": "truck-id"
}
```

### PATCH /api/v1/admin/bookings/:id

Update booking.

### GET /api/v1/admin/drivers

List drivers.

### GET /api/v1/admin/trucks

List trucks.

### GET /api/v1/admin/dashboard

Dashboard statistics.

---

# WHATSAPP

### POST /api/v1/whatsapp/webhook

Receives incoming WhatsApp messages.

The WhatsApp service should translate conversations into backend API calls.

Example:

```text
WhatsApp
   ↓
Webhook
   ↓
Identify customer
   ↓
Determine conversation state
   ↓
Call booking service
   ↓
Return response
```

---

# SUBSCRIPTIONS

### POST /api/v1/subscriptions

Create recurring service.

### GET /api/v1/subscriptions

List subscriptions.

### PATCH /api/v1/subscriptions/:id

Update subscription.

### POST /api/v1/subscriptions/:id/cancel

Cancel subscription.
