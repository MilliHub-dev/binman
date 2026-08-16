# TECHNICAL REQUIREMENTS & SYSTEM ARCHITECTURE

## 1. TECHNOLOGY STACK

### Mobile

**React Native**

Recommended:

* React Native
* TypeScript
* React Navigation
* React Query/TanStack Query
* Zustand or Redux Toolkit
* Firebase Cloud Messaging

### Backend

**Node.js**

Recommended:

* Node.js
* TypeScript
* NestJS OR Express.js
* PostgreSQL
* Prisma ORM
* Redis
* BullMQ for background jobs

### Admin

Recommended:

* React
* TypeScript
* Next.js
* Tailwind CSS



---

# 2. HIGH-LEVEL ARCHITECTURE

```text
                    CUSTOMER
                       |
             +---------+---------+
             |                   |
       React Native          WhatsApp
             |                   |
             +---------+---------+
                       |
                    API Gateway
                       |
                  Node.js API
                       |
       +---------------+----------------+
       |               |                |
   PostgreSQL        Redis          File Storage
       |               |                |
       +---------------+----------------+
                       |
          +------------+------------+
          |            |            |
      Payments      Maps        Notifications
          |            |            |
      Flutterwave   Google Maps   FCM/SMS/WhatsApp
```

---

# 3. BACKEND MODULES

Backend should be modular.

Suggested modules:

```text
auth
users
addresses
customers
bookings
waste
pricing
payments
drivers
trucks
dispatch
cleaning
subscriptions
notifications
whatsapp
support
reviews
reports
admin
```

---

# 4. AUTHENTICATION

Use OTP authentication.

Flow:

```text
User enters phone number
        ↓
Backend generates OTP
        ↓
OTP sent
        ↓
User submits OTP
        ↓
Backend validates OTP
        ↓
JWT issued
        ↓
User authenticated
```

OTP should:

* Expire after a short period.
* Have maximum attempts.
* Be rate-limited.
* Never be stored as plaintext if persisted.

---

# 5. API STRUCTURE

Base:

```text
/api/v1/
```

Example:

```text
/api/v1/auth
/api/v1/users
/api/v1/addresses
/api/v1/bookings
/api/v1/payments
/api/v1/drivers
/api/v1/trucks
/api/v1/dispatch
/api/v1/cleaning
/api/v1/subscriptions
/api/v1/notifications
/api/v1/whatsapp
```

---

# 6. API RESPONSE STANDARD

Successful response:

```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Unable to create booking",
  "error": {
    "code": "BOOKING_ERROR"
  }
}
```

---

# 7. ROLE-BASED ACCESS CONTROL

Permissions should be role-based.

Example:

```text
CUSTOMER
  → Own bookings
  → Own addresses
  → Own payments

DRIVER
  → Assigned bookings
  → Own profile
  → Assigned truck

DISPATCHER
  → Bookings
  → Drivers
  → Trucks
  → Assignment

ADMIN
  → Full operations

SUPER_ADMIN
  → System configuration
```

---

# 8. BACKGROUND JOBS

Use Redis + BullMQ for:

* WhatsApp messages
* SMS
* Push notifications
* Payment verification
* Recurring bookings
* Reminder notifications
* Route processing
* Reports

Example:

```text
Booking created
      ↓
Queue notification
      ↓
Worker processes job
      ↓
WhatsApp/Push notification sent
```

---

# 9. PAYMENT ARCHITECTURE

Never trust payment status from the mobile application.

Correct process:

```text
Customer initiates payment
        ↓
Backend creates transaction
        ↓
Payment provider
        ↓
Customer pays
        ↓
Payment provider webhook
        ↓
Backend verifies transaction
        ↓
Booking marked PAID
```

---

# 10. WEBHOOK SECURITY

Payment webhooks must:

* Verify provider signature.
* Validate transaction.
* Prevent duplicate processing.
* Use idempotency.
* Store webhook event.

---

# 11. MAPS

Use mapping services for:

* Address selection
* Geocoding
* Reverse geocoding
* Navigation
* Distance calculation
* Future route optimization

Every address should ideally store:

```text
latitude
longitude
formatted_address
```

---

# 12. NOTIFICATION ARCHITECTURE

Notification channels:

```text
Push Notification
SMS
WhatsApp
Email
```

Notification service should abstract providers.

Example:

```text
NotificationService.send({
  userId,
  type,
  channel,
  message
})
```

This makes it possible to replace providers later.

---

# 13. LOGGING

Log:

* API requests
* Errors
* Authentication events
* Payments
* Booking changes
* Driver assignment
* WhatsApp events
* Admin actions

Sensitive information must not be logged.

---

# 14. ENVIRONMENT MANAGEMENT

Use:

```text
Development
Staging
Production
```

Never store production credentials inside GitHub.

Use environment variables/secrets manager.

Example:

```text
DATABASE_URL
JWT_SECRET
REDIS_URL
PAYMENT_SECRET
WHATSAPP_TOKEN
MAPS_API_KEY
AWS_ACCESS_KEY
AWS_SECRET_KEY
```

---

# 15. CI/CD

Recommended:

```text
Developer
   ↓
GitHub
   ↓
Pull Request
   ↓
Automated Tests
   ↓
Build
   ↓
Staging
   ↓
Approval
   ↓
Production
```

---

# 16. TESTING

Backend:

* Unit tests
* Integration tests
* API tests
* Payment webhook tests

Mobile:

* Component tests
* Navigation tests
* API integration tests

End-to-end:

```text
Register
→ Add address
→ Book pickup
→ Pay
→ Admin assignment
→ Driver completion
→ Customer notification
```

---

# 17. PERFORMANCE

The backend should be designed to support increasing traffic.

Use:

* Database indexes
* Pagination
* Redis caching
* Background workers
* Connection pooling
* CDN for images
* Object storage for files

---

# 18. DISASTER RECOVERY

Database:

* Automated backups
* Point-in-time recovery where available

Files:

* S3/object storage

Infrastructure:

* Infrastructure as code recommended

---

# 19. AUDIT LOG

Every important administrative action should be recorded.

Example:

```text
Admin:
John

Action:
Assigned booking #1234

Previous:
Unassigned

New:
Driver #56

Timestamp:
2026-08-14 08:15
```
