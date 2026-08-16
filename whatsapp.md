# WHATSAPP INTEGRATION SPECIFICATION

## OBJECTIVE

Allow registered customers to access the platform without opening the mobile application.

The WhatsApp number must match the customer's registered phone number.

---

# CUSTOMER IDENTIFICATION

When a WhatsApp message arrives:

```text
Phone Number
     ↓
Search user
     ↓
User exists?
   /       \
 YES       NO
 ↓          ↓
Continue   Registration
```

If the number is registered, the system loads the customer's account.

---

# MENU

```text
Welcome 👋

What would you like to do?

1. Waste Pickup
2. Cleaning
3. Track Booking
4. My Bookings
5. Manage Subscription
6. Support
```

---

# WASTE BOOKING

```text
Waste Pickup
     ↓
Select Address
     ↓
Select Waste Type
     ↓
Select Size
     ↓
Select Date
     ↓
Select Time
     ↓
Calculate Price
     ↓
Confirm
     ↓
Payment
     ↓
Booking Created
```

---

# TRACKING

Customer:

> Track my booking

Bot:

```text
Booking #WST1024

Status:
Driver En Route 🚛

Estimated arrival:
8:30 AM
```

---

# CANCELLATION

Customer can cancel based on business rules.

The system must check:

* Current status
* Cancellation window
* Refund policy

---

# SECURITY

The WhatsApp system must never trust customer-provided IDs.

Customer identity must be determined from the WhatsApp phone number and authenticated backend session.
