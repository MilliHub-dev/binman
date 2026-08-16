# DATABASE DESIGN

## 1. USERS

```text
users
---------
id
first_name
last_name
phone
email
role
status
profile_image
created_at
updated_at
```

Roles:

```text
CUSTOMER
DRIVER
CLEANER
DISPATCHER
SUPPORT
ADMIN
SUPER_ADMIN
```

---

# 2. OTP VERIFICATIONS

```text
otp_verifications
-----------------
id
phone
otp_hash
expires_at
attempts
verified_at
created_at
```

---

# 3. ADDRESSES

```text
addresses
---------
id
user_id
label
address_line
area
city
state
latitude
longitude
instructions
contact_name
contact_phone
is_default
created_at
updated_at
```

---

# 4. BOOKINGS

```text
bookings
--------
id
booking_reference
user_id
service_type
address_id
scheduled_date
time_slot_id
status
subtotal
discount
total_amount
payment_status
notes
created_at
updated_at
```

Service types:

```text
WASTE_COLLECTION
CLEANING
```

---

# 5. WASTE BOOKINGS

```text
waste_bookings
--------------
id
booking_id
waste_type
collection_size
estimated_quantity
special_instructions
```

---

# 6. CLEANING BOOKINGS

```text
cleaning_bookings
-----------------
id
booking_id
cleaning_type
property_type
property_size
number_of_rooms
special_instructions
```

---

# 7. TIME SLOTS

```text
time_slots
----------
id
start_time
end_time
is_active
max_bookings
```

---

# 8. DRIVERS

```text
drivers
-------
id
user_id
license_number
license_expiry
verification_status
availability_status
current_latitude
current_longitude
created_at
updated_at
```

---

# 9. TRUCKS

```text
trucks
------
id
truck_number
registration_number
truck_type
capacity
status
current_latitude
current_longitude
created_at
updated_at
```

---

# 10. DRIVER ASSIGNMENTS

```text
booking_assignments
-------------------
id
booking_id
driver_id
truck_id
assigned_by
assigned_at
accepted_at
completed_at
status
```

---

# 11. BOOKING STATUS HISTORY

```text
booking_status_history
----------------------
id
booking_id
old_status
new_status
changed_by
reason
created_at
```

---

# 12. PAYMENTS

```text
payments
--------
id
booking_id
user_id
reference
provider
amount
currency
status
provider_transaction_id
paid_at
created_at
updated_at
```

---

# 13. SUBSCRIPTIONS

```text
subscriptions
-------------
id
user_id
service_type
frequency
amount
address_id
next_collection_date
status
start_date
end_date
created_at
updated_at
```

Frequency:

```text
WEEKLY
BIWEEKLY
MONTHLY
CUSTOM
```

---

# 14. NOTIFICATIONS

```text
notifications
-------------
id
user_id
channel
title
message
type
status
sent_at
created_at
```

---

# 15. REVIEWS

```text
reviews
-------
id
booking_id
user_id
rating
comment
created_at
```

---

# 16. SUPPORT TICKETS

```text
support_tickets
---------------
id
user_id
booking_id
subject
description
status
priority
assigned_to
created_at
updated_at
```

---

# 17. WHATSAPP SESSIONS

```text
whatsapp_sessions
-----------------
id
phone
user_id
current_state
session_data
expires_at
created_at
updated_at
```

---

# 18. AUDIT LOGS

```text
audit_logs
----------
id
user_id
action
entity
entity_id
old_data
new_data
ip_address
created_at
```

---

# 19. IMPORTANT DATABASE RELATIONSHIPS

```text
User
 |
 +---- Addresses
 |
 +---- Bookings
          |
          +---- Waste Booking
          |
          +---- Cleaning Booking
          |
          +---- Payment
          |
          +---- Assignment
                   |
                   +---- Driver
                   |
                   +---- Truck
```
