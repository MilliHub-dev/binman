# BinMan WASTE COLLECTION & HOME SERVICES PLATFORM

## UI/UX DESIGN & SCREEN SPECIFICATION

**Platform:** React Native Mobile App
**Primary Users:** Households, businesses, restaurants, offices
**Initial Market:** Nigeria
**Design Goal:** Simple, modern, trustworthy, fast and easy to use

---

# 1. DESIGN PRINCIPLES

The application should feel:

* Clean
* Simple
* Professional
* Trustworthy
* Modern
* Local/Nigerian-friendly
* Easy for non-technical users

The customer should be able to book waste collection within **less than 2–3 minutes**.

The primary action should always be obvious.

### Primary navigation

The bottom navigation should contain:

```text
┌─────────────────────────────────────┐
│                                     │
│            APP CONTENT              │
│                                     │
├─────────────────────────────────────┤
│  Home   Bookings   Services   Profile│
└─────────────────────────────────────┘
```

Recommended tabs:

1. Home
2. Bookings
3. Services
4. Profile

---

# 2. BRAND/UI SYSTEM

## Typography

Recommended:

* Inter
* Plus Jakarta Sans
* Manrope

Use one primary font consistently.

---

## UI Components

Create reusable components:

* Primary Button
* Secondary Button
* Input
* Dropdown
* Bottom Sheet
* Modal
* Card
* Status Badge
* Address Card
* Booking Card
* Service Card
* Notification Item
* Empty State
* Loading State
* Error State
* Confirmation Modal

---

# 3. SCREEN MAP

The customer app should contain the following screens:

```text
SPLASH
   ↓
ONBOARDING
   ↓
PHONE LOGIN
   ↓
OTP
   ↓
PROFILE SETUP
   ↓
HOME
   ├── Waste Pickup
   │      ├── Address
   │      ├── Waste Type
   │      ├── Waste Size
   │      ├── Date
   │      ├── Time
   │      ├── Review
   │      ├── Payment
   │      └── Confirmation
   │
   ├── Cleaning
   │      ├── Service
   │      ├── Property
   │      ├── Date
   │      ├── Time
   │      ├── Review
   │      ├── Payment
   │      └── Confirmation
   │
   ├── Track Booking
   │
   └── Notifications

BOOKINGS
   ├── Upcoming
   ├── Active
   └── Completed

PROFILE
   ├── Personal Information
   ├── Addresses
   ├── Payment Methods
   ├── Subscriptions
   ├── Notifications
   ├── Support
   └── Settings
```

---

# 4. SPLASH SCREEN

## Purpose

Introduce the brand while the application loads.

### UI

```text
┌───────────────────────────┐
│                           │
│                           │
│          LOGO             │
│                           │
│     [Company Name]        │
│                           │
│  Waste. Clean. Simple.    │
│                           │
│                           │
│          ● ● ●            │
│                           │
└───────────────────────────┘
```

Duration:

Approximately 1–2 seconds.

---

# 5. ONBOARDING SCREEN 1

### Heading

**Waste collection made simple.**

### Description

Schedule a pickup and let our team collect your waste from your doorstep.

### Visual

Use illustration showing:

* House
* Waste bin
* Collection truck

### Button

**Get Started**

---

# 6. ONBOARDING SCREEN 2

### Heading

**Schedule whenever you need us.**

### Description

Choose your preferred date and time and we'll handle the rest.

Button:

**Next**

---

# 7. ONBOARDING SCREEN 3

### Heading

**Clean homes. Cleaner communities.**

### Description

Book waste collection and professional cleaning services from one platform.

Button:

**Create Account**

---

# 8. PHONE NUMBER SCREEN

### Heading

**What's your phone number?**

Input:

```text
+234 | 801 234 5678
```

Button:

**Continue**

Small text:

> We'll send you a verification code.

---

# 9. OTP SCREEN

### Heading

**Verify your number**

Description:

> Enter the 6-digit code sent to your phone.

UI:

```text
[ _ ] [ _ ] [ _ ] [ _ ] [ _ ] [ _ ]
```

Actions:

**Verify**

**Resend code**

---

# 10. PROFILE SETUP

### Heading

**Tell us about yourself**

Fields:

* First name
* Last name
* Email

Optional:

* Profile photo

Button:

**Continue**

---

# 11. LOCATION PERMISSION

### Heading

**Where do you need our services?**

Description:

> Allow location access to help us find your address faster.

Buttons:

**Use My Location**

**Enter Address Manually**

---

# 12. HOME SCREEN

This is the most important screen.

### Header

```text
Good morning, Ekemini 👋

📍 Home
```

Notification icon on the right.

---

## Main booking card

Large primary card:

### **Need your waste collected?**

> Schedule a pickup and we'll come to you.

Button:

**Book Waste Pickup**

---

## Quick services

```text
┌──────────────┐ ┌──────────────┐
│      🗑️      │ │      🧹      │
│              │ │              │
│ Waste Pickup │ │   Cleaning   │
└──────────────┘ └──────────────┘
```

---

## Upcoming booking

If the customer has a booking:

```text
UPCOMING PICKUP

Tomorrow • 8:00 AM

📍 Ewet Estate

Medium Waste

[Track Pickup]
```

---

## Recurring service

Card:

**Never worry about waste again.**

> Set up weekly waste collection.

Button:

**Set Up Weekly Pickup**

---

# 13. BOOK WASTE PICKUP — STEP 1

### Heading

**Where should we collect from?**

Display saved addresses.

Example:

```text
┌────────────────────────────┐
│ 🏠 Home                    │
│ 15 Example Street          │
│ Ewet Estate, Uyo              │
│                         ✓  │
└────────────────────────────┘
```

Button:

**+ Add New Address**

Bottom:

**Continue**

---

# 14. ADD ADDRESS SCREEN

Fields:

* Address label
* House/building number
* Street
* Area
* City
* State
* Additional directions

Map preview.

Button:

**Save Address**

---

# 15. BOOK WASTE PICKUP — STEP 2

### Heading

**What type of waste do you have?**

Cards:

```text
🗑️ Household
🍽️ Food Waste
♻️ Plastic
📦 Cardboard
🌿 Garden Waste
🏢 Commercial
📦 Other
```

Customer selects one or multiple categories where applicable.

Button:

**Continue**

---

# 16. BOOK WASTE PICKUP — STEP 3

### Heading

**How much waste do you have?**

Display visual cards.

```text
┌─────────────┐
│     🗑️      │
│    SMALL    │
│  1–2 bags   │
└─────────────┘

┌─────────────┐
│     🗑️      │
│   MEDIUM    │
│  3–5 bags   │
└─────────────┘

┌─────────────┐
│     🗑️      │
│    LARGE    │
│   6+ bags   │
└─────────────┘
```

Pricing should appear on each card where appropriate.

---

# 17. BOOK WASTE PICKUP — STEP 4

### Heading

**When should we come?**

Date selector:

```text
Today
Fri 14
```

```text
Tomorrow
Sat 15
```

```text
Sun 16
```

Then:

### Choose a time

```text
7:00 – 9:00 AM
9:00 – 11:00 AM
11:00 AM – 1:00 PM
1:00 – 3:00 PM
```

Unavailable slots should be disabled.

Button:

**Continue**

---

# 18. BOOKING REVIEW

### Heading

**Review your pickup**

Display:

**Service**

Waste Collection

**Address**

15 Udo Udoma Avenue, Ewet Estate

**Waste**

Household

**Size**

Medium

**Date**

Saturday, August 15

**Time**

8:00 AM – 10:00 AM

---

### Price

```text
Collection        ₦X,XXX
Service fee       ₦XXX
-----------------------
Total             ₦X,XXX
```

Button:

**Continue to Payment**

---

# 19. PAYMENT SCREEN

### Heading

**Choose payment method**

Cards:

```text
💳 Card

🏦 Bank Transfer

👛 Wallet
```

Selected payment method gets highlighted.

Total displayed prominently.

Button:

**Pay ₦X,XXX**

---

# 20. PAYMENT PROCESSING

Display:

```text
Processing payment...

Please don't close the app.
```

Use a loading animation.

---

# 21. BOOKING SUCCESS

Large success illustration.

### Heading

**Pickup booked! 🎉**

Description:

> Your waste collection has been scheduled successfully.

Display:

```text
Booking #WST1024

Saturday
8:00 – 10:00 AM

📍 Ewet Estate, Uyo
```

Buttons:

**Track Pickup**

**Back to Home**

---

# 22. ACTIVE BOOKING SCREEN

### Heading

**Your pickup**

Status timeline:

```text
✓ Booking confirmed
      |
      ↓
✓ Team assigned
      |
      ↓
● Driver en route
      |
      ↓
○ Waste collected
```

Display:

* Driver name
* Truck information
* Estimated arrival
* Phone/contact option
* Map

Button:

**Contact Support**

---

# 23. DRIVER EN ROUTE

Display large map.

Driver marker:

🚛

Customer marker:

📍

Bottom card:

```text
Your collection team is on the way.

ETA: 15 minutes

Driver:
John

Truck:
TRK-024
```

---

# 24. ARRIVAL SCREEN

When driver arrives:

```text
Your collection team has arrived.

Please have your waste ready.
```

Optional button:

**Contact Driver**

---

# 25. COMPLETED BOOKING

### Heading

**Pickup completed**

Display:

✓ Waste successfully collected.

Booking details.

Then:

### Rate your experience

```text
☆ ☆ ☆ ☆ ☆
```

Comment:

> Tell us how we did.

Button:

**Submit Review**

---

# 26. BOOKINGS SCREEN

Tabs:

```text
Upcoming | Active | Completed
```

Booking card:

```text
WASTE COLLECTION

Tomorrow • 8:00 AM

📍 Ewet Estate

Medium

CONFIRMED

[View Details]
```

---

# 27. EMPTY BOOKINGS

Illustration.

### Heading

**No bookings yet**

Description:

> Your waste collection bookings will appear here.

Button:

**Book a Pickup**

---

# 28. SERVICES SCREEN

Display service cards.

```text
┌─────────────────────────┐
│ 🗑️                      │
│ Waste Collection        │
│ From ₦X,XXX             │
│                         │
│ [Book Now]              │
└─────────────────────────┘

┌─────────────────────────┐
│ 🧹                      │
│ Home Cleaning           │
│ From ₦X,XXX             │
│                         │
│ [Book Now]              │
└─────────────────────────┘
```

Future services can be added here.

---

# 29. CLEANING SERVICE SCREEN

### Heading

**What kind of cleaning do you need?**

Options:

* Regular Cleaning
* Deep Cleaning
* Office Cleaning
* Move-in Cleaning
* Move-out Cleaning
* Post-event Cleaning

---

# 30. CLEANING PROPERTY SCREEN

Select:

### Property type

* Apartment
* House
* Office
* Shop
* Other

### Property size

* 1 Bedroom
* 2 Bedrooms
* 3 Bedrooms
* 4+ Bedrooms

---

# 31. CLEANING DATE/TIME

Same date/time component used for waste collection.

---

# 32. CLEANING REVIEW

Display:

```text
Cleaning Service
Deep Cleaning

Property
3 Bedroom Apartment

Date
Saturday

Time
10:00 AM

Total
₦XX,XXX
```

Button:

**Book Cleaning**

---

# 33. PROFILE SCREEN

Header:

```text
Ekemini Effiong
+234 XXX XXX XXXX
```

Menu:

```text
Personal Information
My Addresses
Payment Methods
Subscriptions
Notifications
Help & Support
Terms & Conditions
Privacy Policy
Logout
```

---

# 34. ADDRESSES SCREEN

Display saved addresses.

Each card:

```text
🏠 Home

15 Example Street
Ewet Estate, Uyo

[Edit]
```

Button:

**+ Add Address**

---

# 35. SUBSCRIPTIONS SCREEN

Display:

### Weekly Waste Collection

```text
Every Saturday
8:00 AM

₦X,XXX / week

ACTIVE
```

Actions:

**Manage**

**Pause**

**Cancel**

---

# 36. CREATE SUBSCRIPTION

### Heading

**Set up regular collection**

Select:

Frequency:

* Weekly
* Every 2 weeks
* Monthly

Day:

* Monday
* Tuesday
* Wednesday
* Thursday
* Friday
* Saturday
* Sunday

Time:

* Available time slots

Address:

* Saved address

Button:

**Activate Subscription**

---

# 37. NOTIFICATIONS SCREEN

Examples:

```text
🚛 Your driver is on the way.

10 minutes ago
```

```text
✓ Your waste was collected successfully.

2 hours ago
```

```text
📅 Reminder: your pickup is tomorrow.

Yesterday
```

---

# 38. SUPPORT SCREEN

Options:

```text
💬 Chat with Support

📱 Call Support

💬 WhatsApp Support

❓ Frequently Asked Questions
```

---

# 39. ERROR STATES

Every important screen must have an error state.

Example:

### Something went wrong

> We couldn't load your bookings.

Button:

**Try Again**

---

# 40. NETWORK OFFLINE STATE

Display:

```text
You're offline.

Please check your internet connection.
```

The application should preserve important unsent data where appropriate.

---

# 41. LOADING STATES

Do not display blank screens.

Use:

* Skeleton loaders
* Spinners
* Progress indicators

---

# 42. CONFIRMATION MODALS

Before cancellation:

### Cancel this pickup?

> Are you sure you want to cancel this booking?

Buttons:

**Keep Booking**

**Cancel Pickup**

---

# 43. WHATSAPP UI EXPERIENCE

The WhatsApp experience should mirror the mobile application.

Main menu:

```text
👋 Welcome!

What would you like to do?

1️⃣ Book Waste Pickup
2️⃣ Book Cleaning
3️⃣ Track Booking
4️⃣ My Bookings
5️⃣ Subscription
6️⃣ Support
```

The user should never have to repeat their address if it already exists in their account.

---

# 44. ADMIN DASHBOARD UI

## Sidebar

```text
Dashboard

Operations
  ├── Bookings
  ├── Dispatch
  └── Live Tracking

Customers

Drivers

Trucks

Cleaning

Subscriptions

Payments

Reports

Support

Settings
```

---

# 45. ADMIN DASHBOARD HOME

Top cards:

```text
Today's Bookings       124

Completed              98

Pending                16

Revenue                ₦XXX,XXX
```

Below:

### Today's Operations

Table:

```text
Booking | Customer | Area | Time | Driver | Status
```

---

# 46. ADMIN BOOKING TABLE

Columns:

```text
Booking ID
Customer
Service
Location
Date
Time
Payment
Driver
Status
Actions
```

Actions:

**View**

**Assign**

**Reschedule**

**Cancel**

---

# 47. ADMIN DISPATCH SCREEN

Two-column interface.

Left:

### Pending pickups

Right:

### Available drivers

Example:

```text
PENDING

#WST1024
Ewet Estate
8:00 AM
Medium
```

Driver:

```text
John Doe
Available

Truck:
TRK-024
Available
```

Button:

**Assign**

---

# 48. ADMIN LIVE MAP

Map displays:

* Trucks
* Drivers
* Pickup locations

Legend:

```text
🟢 Available
🟡 On Route
🔴 Busy
⚫ Offline
```

---

# 49. DRIVER APP UI

## Home

```text
Good morning, John

Today's Jobs: 8
Completed: 4
Remaining: 4
```

---

# 50. DRIVER JOB CARD

```text
WASTE COLLECTION

8:00 AM

📍 Ewet Estate

Medium Waste

Customer:
Ekemini

[View Job]
```

---

# 51. DRIVER JOB DETAILS

Display:

* Customer
* Phone
* Address
* Map
* Waste type
* Size
* Notes

Buttons:

**Accept Job**

**Navigate**

---

# 52. DRIVER STATUS FLOW

Buttons change according to state:

```text
Accept Job
     ↓
Start Route
     ↓
Arrived
     ↓
Collect Waste
     ↓
Upload Proof
     ↓
Complete Job
```

---

# 53. DESIGN HANDOFF REQUIREMENTS

The UI/UX designer should provide:

* Figma file
* Design system
* Colors
* Typography
* Icons
* Components
* Mobile screens
* Admin dashboard screens
* Driver screens
* Empty states
* Error states
* Loading states
* Success states
* Responsive layouts
* Prototype
* User flows

---

# 54. REQUIRED FIGMA FLOWS

The Figma prototype must demonstrate:

### Flow 1

Registration → Home

### Flow 2

Home → Waste Pickup → Payment → Confirmation

### Flow 3

Confirmation → Tracking → Completion

### Flow 4

Home → Cleaning → Payment → Confirmation

### Flow 5

Home → Subscription

### Flow 6

Admin → Booking → Dispatch → Driver Assignment

### Flow 7

Driver → Job → Navigation → Collection → Completion

---

# 55. SCREEN COUNT — INITIAL VERSION

The designer should expect approximately:

### Customer App

**35–45 screens/states**

### Driver App

**10–15 screens/states**

### Admin Dashboard

**15–25 screens/views**

### WhatsApp

**10+ conversation states**

The exact number can change during design, but every important user flow must have a designed state.

---

# 56. MOST IMPORTANT DESIGN RULE

Do not make the application feel like a complicated logistics application.

The customer should open the application and immediately understand:

**"I need my waste collected."**

The primary journey should be:

```text
OPEN APP
   ↓
BOOK PICKUP
   ↓
SELECT ADDRESS
   ↓
SELECT WASTE
   ↓
SELECT SIZE
   ↓
SELECT DATE/TIME
   ↓
PAY
   ↓
TRACK
   ↓
DONE
```

The same journey should be available through WhatsApp.

---

# 57. UI/UX ACCEPTANCE CRITERIA

Before development begins, the design must answer:

* What happens when a user has no address?
* What happens when a location is outside the service area?
* What happens when a time slot is full?
* What happens when payment fails?
* What happens when a driver cannot complete a pickup?
* What happens when a customer cancels?
* What happens when there are no bookings?
* What happens when the user is offline?
* What happens when the customer has multiple addresses?
* What happens when a subscription payment fails?
* What happens when a driver is unavailable?

Every one of these states should have a defined UI.

---

# 58. DESIGN DELIVERABLE

The final Figma project should be organized as:

```text
00 — Cover
01 — Design System
02 — Components
03 — Customer App
04 — Driver App
05 — Admin Dashboard
06 — WhatsApp Flow
07 — User Flows
08 — Prototype
09 — Developer Handoff
```

The UI should be built with reusable components so that future services can be added without redesigning the entire application.
