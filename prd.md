# WASTE COLLECTION & HOME SERVICES PLATFORM

## Product Requirements Document (PRD)

**Version:** 1.0
**Date:** August 2026
**Platform:** Mobile Application + WhatsApp + Admin Dashboard
**Frontend:** React Native
**Backend:** Node.js
**Database:** PostgreSQL
**Primary Market:** Nigeria
**Initial Launch:** Uyo, Akwa Ibom State, Nigeria

---

## 1. PRODUCT OVERVIEW

The platform is an on-demand waste collection and household services application designed to make it easy for households, businesses, restaurants, offices, and other organizations to dispose of waste without having to physically transport it to a dumping location.

Customers will be able to:

* Register an account.
* Add and manage addresses.
* Request waste collection.
* Select a preferred pickup date.
* Select a preferred pickup time.
* Choose the type/quantity of waste.
* Make payments.
* Track pickup requests.
* Receive pickup notifications.
* View pickup history.
* Schedule recurring waste collection.
* Request household cleaning services.

Customers will also be able to perform the same core activities through WhatsApp after their phone number has been registered on the platform.

The company owns and manages its trucks and collection staff. Customers do not provide their own waste collectors or trucks.

---

# 2. PROBLEM STATEMENT

Many households and businesses in Nigeria experience difficulties disposing of waste conveniently and reliably.

Common problems include:

1. Lack of convenient waste collection.
2. Irregular collection schedules.
3. Difficulty transporting waste.
4. Poor coordination between customers and waste collectors.
5. Lack of transparent pricing.
6. Difficulty finding reliable cleaning services.
7. Lack of digital tracking of waste collection.
8. Poor customer communication.
9. Limited access to scheduled or recurring waste collection.

The platform solves this problem by creating a centralized digital system through which customers can request waste collection and household services.

---

# 3. PRODUCT VISION

To become a leading digital platform for convenient waste collection, household cleaning, and environmental services across Nigeria and eventually West Africa.

---

# 4. PRODUCT OBJECTIVES

### Primary objectives

* Make waste disposal convenient.
* Allow customers to schedule waste pickup digitally.
* Build an efficient company-controlled collection operation.
* Digitize dispatch and pickup management.
* Provide customers with reliable pickup notifications.
* Create recurring waste collection subscriptions.
* Introduce household cleaning services.
* Provide both mobile-app and WhatsApp access.

### Business objectives

* Acquire recurring household customers.
* Acquire restaurants and businesses.
* Generate recurring subscription revenue.
* Increase truck utilization.
* Optimize collection routes.
* Build a scalable waste-management network.

---

# 5. TARGET USERS

## 5.1 Household Customers

Individuals or families requiring regular or occasional waste collection.

## 5.2 Business Customers

Examples:

* Restaurants
* Hotels
* Offices
* Shops
* Schools
* Event centers
* Supermarkets
* Estates
* Commercial buildings

## 5.3 Cleaning Customers

Customers requiring:

* Home cleaning
* Office cleaning
* Deep cleaning
* Regular cleaning
* Weekend cleaning

## 5.4 Internal Staff

The company will manage:

* Drivers
* Waste collection workers
* Cleaning workers
* Dispatchers
* Operations managers
* Customer support agents
* Administrators.

---

# 6. CUSTOMER APP

## 6.1 Registration

Customers should be able to register using:

* Phone number
* OTP verification
* Name
* Email address (optional initially)

The phone number becomes the primary customer identifier.

After registration, the customer can connect/use the same phone number through WhatsApp.

---

# 7. LOGIN

Customer login should support:

* Phone number
* OTP

Optional future authentication:

* Email/password
* Google
* Apple

---

# 8. CUSTOMER PROFILE

Customers can manage:

* Full name
* Phone number
* Email
* Profile photo
* Saved addresses
* Preferred payment method
* Notification preferences

---

# 9. ADDRESS MANAGEMENT

Customers can add multiple addresses.

Each address should contain:

* Address name
* House/building number
* Street
* Area
* City
* State
* Latitude
* Longitude
* Additional directions
* Contact person
* Contact phone number

Example:

**Home**

> No. 15 Udo Udoma Avenue, Ewet Housing Estate, Uyo

---

# 10. WASTE COLLECTION

The main action on the platform is:

**"Request Waste Pickup"**

The customer selects:

1. Pickup address.
2. Waste type.
3. Estimated quantity/size.
4. Pickup date.
5. Preferred pickup time.
6. Additional instructions.
7. Payment method.

---

# 11. WASTE TYPES

Initial categories:

* Household waste
* Food waste
* Plastic
* Paper
* Cardboard
* Mixed waste
* Garden waste
* Commercial waste
* Other

Future categories can include:

* E-waste
* Metal
* Glass
* Recyclables
* Construction waste

---

# 12. PICKUP SIZE

The system should support configurable collection sizes.

Example:

* Small
* Medium
* Large
* Extra Large
* Custom

Pricing must be configurable from the admin dashboard.

The company should NOT hard-code prices inside the mobile application.

---

# 13. PICKUP DATE & TIME

Customers select:

**Date**

* Today
* Tomorrow
* Future date

**Time**

Example:

* 7:00 AM – 9:00 AM
* 9:00 AM – 11:00 AM
* 11:00 AM – 1:00 PM
* 1:00 PM – 3:00 PM

Time slots should be configurable by administrators.

---

# 14. PICKUP REQUEST STATUS

Every request should have a status.

Possible statuses:

```text
PENDING_PAYMENT
PAID
PENDING_ASSIGNMENT
ASSIGNED
DRIVER_EN_ROUTE
ARRIVED
COLLECTED
COMPLETED
CANCELLED
FAILED
```

---

# 15. DRIVER/PICKUP WORKFLOW

The company owns and manages the collection trucks.

After a customer creates a pickup request:

1. Request enters the system.
2. Admin/dispatcher receives notification.
3. Dispatcher reviews request.
4. Dispatcher assigns truck/driver/team.
5. Driver receives assignment.
6. Driver travels to customer.
7. Driver marks "En Route".
8. Customer receives notification.
9. Driver arrives.
10. Driver collects waste.
11. Driver marks collection completed.
12. Customer receives completion notification.
13. Pickup appears in history.

---

# 16. PROOF OF COLLECTION

Drivers should be able to submit:

* Photo
* GPS coordinates
* Timestamp
* Optional customer confirmation

This helps prevent false completion reports.

---

# 17. CUSTOMER NOTIFICATIONS

Notifications should be sent through:

* Push notification
* WhatsApp
* SMS where required

Examples:

> Your waste pickup has been scheduled for tomorrow at 8:00 AM.

> Your collection team is on the way.

> Your waste has been successfully collected.

---

# 18. RECURRING WASTE COLLECTION

Customers should be able to subscribe to recurring pickup.

Examples:

* Weekly
* Twice weekly
* Monthly
* Custom schedule

Example:

**Every Saturday at 8:00 AM**

The system automatically creates future pickup jobs.

---

# 19. CLEANING SERVICES

The platform will also provide cleaning services.

Customers can request:

* Regular home cleaning
* Deep cleaning
* Office cleaning
* Move-in cleaning
* Move-out cleaning
* Weekend cleaning
* Post-event cleaning

---

# 20. CLEANING BOOKING FLOW

Customer:

1. Selects "Cleaning".
2. Selects service.
3. Selects property type.
4. Selects property size.
5. Selects date.
6. Selects time.
7. Provides address.
8. Adds special instructions.
9. Sees price.
10. Makes payment.
11. Booking is assigned to cleaning staff.
12. Customer receives updates.
13. Cleaning is completed.
14. Customer confirms completion.
15. Customer rates service.

---

# 21. PAYMENTS

The platform should support:

* Card
* Bank transfer
* Wallet
* Other locally supported payment methods

Payment provider should be configurable.

The system must store:

* Transaction ID
* Customer ID
* Amount
* Currency
* Payment status
* Service
* Booking ID
* Provider response
* Timestamp

---

# 22. CUSTOMER WALLET

Future feature.

Customers can:

* Add funds.
* Receive refunds.
* Pay from wallet.
* View wallet transactions.

---

# 23. RATINGS & REVIEWS

After completed services, customers can rate:

* Waste collection
* Cleaning service

Rating:

**1–5 stars**

Optional:

* Comment
* Complaint
* Photo

---

# 24. CUSTOMER SUPPORT

Customers should be able to contact support through:

* In-app chat
* WhatsApp
* Phone
* Email

---

# 25. ADMIN DASHBOARD

The admin dashboard is the operational center of the business.

Administrators should be able to:

* View customers.
* View bookings.
* Create bookings.
* Assign drivers.
* Assign trucks.
* Manage cleaning staff.
* Manage service areas.
* Manage prices.
* Manage time slots.
* Manage subscriptions.
* Manage payments.
* View reports.
* Manage complaints.
* Manage notifications.

---

# 26. ADMIN DASHBOARD — BOOKING MANAGEMENT

Admin can:

* View all bookings.
* Filter by date.
* Filter by area.
* Filter by status.
* Search customer.
* Assign driver.
* Assign truck.
* Change booking status.
* Cancel booking.
* Reschedule booking.

---

# 27. DRIVER MANAGEMENT

Admin can create/manage:

* Driver name
* Phone
* ID
* License information
* Profile photo
* Status
* Assigned truck
* Current location
* Availability

Statuses:

```text
AVAILABLE
BUSY
OFFLINE
SUSPENDED
```

---

# 28. TRUCK MANAGEMENT

Each truck should have:

* Truck ID
* Registration number
* Type
* Capacity
* Driver
* Status
* Current location
* Maintenance information

Statuses:

```text
AVAILABLE
ASSIGNED
ON_ROUTE
MAINTENANCE
OUT_OF_SERVICE
```

---

# 29. DISPATCH SYSTEM

The dispatcher should see:

* New pickup requests.
* Pickup location.
* Pickup time.
* Customer information.
* Truck availability.
* Driver availability.

The dispatcher can assign jobs manually.

Future versions can automatically recommend optimal assignments.

---

# 30. MAP

Admin should have a map showing:

* Pickup locations
* Active trucks
* Drivers
* Completed pickups
* Pending pickups

Google Maps or another mapping provider can be integrated.

---

# 31. WHATSAPP INTEGRATION

The same customer phone number used during app registration will be used for WhatsApp services.

The WhatsApp system connects to the same backend API.

The WhatsApp interface should allow customers to:

* Register.
* Verify account.
* Request pickup.
* Select saved address.
* Select date.
* Select time.
* Select waste type.
* Confirm booking.
* Pay.
* Check booking status.
* Cancel booking.
* View upcoming booking.
* Request cleaning.
* Contact support.

---

# 32. SAMPLE WHATSAPP FLOW

Customer:

> Hi

Bot:

> Welcome to [Company Name]. What would you like to do?

Options:

1. Book Waste Pickup
2. Book Cleaning
3. Track Booking
4. View My Bookings
5. Contact Support

Customer:

> 1

Bot:

> Where should we collect the waste?

Options:

* Home
* Office
* Restaurant
* Other

The system retrieves saved addresses.

Bot:

> Which address should we use?

Customer selects address.

Bot:

> Select pickup date.

Customer selects date.

Bot:

> Select pickup time.

Customer selects time.

Bot:

> What type of waste do you have?

Customer selects waste category.

Bot:

> Your estimated price is ₦X. Would you like to continue?

Customer:

> Yes

Bot:

> Please complete payment.

After successful payment:

> Your pickup has been confirmed.

---

# 33. WHATSAPP ARCHITECTURE

The WhatsApp bot must NOT have a separate business logic system.

Architecture:

```text
React Native App
        |
        |
     REST API
        |
   Node.js Backend
        |
   PostgreSQL
        |
 ---------------------
 |        |          |
Admin   WhatsApp   Payments
Panel      API       API
```

Both the mobile application and WhatsApp should consume the same backend services.

---

# 34. NON-FUNCTIONAL REQUIREMENTS

The platform should be:

* Secure
* Scalable
* Fast
* Mobile-friendly
* Reliable
* Auditable
* Maintainable

API response target:

**< 500ms** for normal API requests where practical.

The backend must support horizontal scaling.

---

# 35. SECURITY

Implement:

* JWT authentication
* OTP verification
* Role-based access control
* Password hashing where passwords are used
* HTTPS
* API rate limiting
* Input validation
* Database encryption where appropriate
* Secure secrets management
* Audit logging

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

# 36. MVP FEATURES

The first release should contain:

### Customer

* Registration
* OTP login
* Profile
* Addresses
* Waste pickup
* Date/time selection
* Pricing
* Payment
* Booking history
* Notifications

### Operations

* Admin login
* Customer management
* Booking management
* Driver management
* Truck management
* Manual dispatch
* Pickup status management

### Driver

* Login
* Assigned jobs
* Job details
* Navigation
* Status updates
* Proof of collection

### WhatsApp

* Customer identification
* Waste booking
* Booking status
* Notifications

### Cleaning

Cleaning should initially be implemented only if operational capacity is available. Otherwise it should be Phase 2.

---

# 37. FUTURE FEATURES

Potential future features:

* Automatic route optimization
* Live truck tracking
* AI demand forecasting
* Recycling marketplace
* Waste classification
* Smart bins
* Corporate waste-management contracts
* Estate management
* Carbon footprint reporting
* Loyalty points
* Referral program
* Customer wallet
* Multi-city operations
* Fleet management
* Automated recurring billing
* Recycling rewards

---

# 38. SUCCESS METRICS

Track:

* Registered users
* Active users
* Number of pickups
* Completed pickups
* Failed pickups
* Average pickup value
* Revenue
* Monthly recurring revenue
* Customer retention
* Subscription rate
* Driver utilization
* Truck utilization
* Average response time
* Average pickup completion time
* Customer rating
* WhatsApp bookings
* App bookings
* Cleaning bookings

---

# 39. MVP SUCCESS CRITERIA

The MVP is considered successful when:

1. Customer can register.
2. Customer can add address.
3. Customer can request pickup.
4. Customer can pay.
5. Admin receives request.
6. Admin can assign driver/truck.
7. Driver receives assignment.
8. Driver can complete pickup.
9. Customer receives notifications.
10. Booking history is recorded.
11. Same customer can book through WhatsApp.
12. Admin can manage the complete operation.
