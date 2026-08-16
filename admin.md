# ADMIN DASHBOARD SPECIFICATION

## 1. DASHBOARD

Display:

* Total customers
* Today's bookings
* Pending pickups
* Completed pickups
* Active drivers
* Active trucks
* Today's revenue
* Monthly revenue
* Failed pickups
* Cleaning bookings

---

# 2. LIVE OPERATIONS

Admin should see:

```text
Pending
Assigned
En Route
Arrived
Collected
Completed
```

Map view:

```text
Customer Pickup
       ↓
     Driver
       ↓
     Truck
```

---

# 3. BOOKING MANAGEMENT

Features:

* Search
* Filter
* Sort
* View
* Assign
* Reschedule
* Cancel
* Complete
* Export

Filters:

* Date
* Area
* Status
* Service
* Driver
* Payment status

---

# 4. DISPATCH SCREEN

Dispatcher sees:

### Unassigned

```text
Booking #1024
Ewet Estate
08:00 AM
Medium Waste
Paid
```

Available drivers:

```text
Driver A — Available
Driver B — Available
Driver C — Busy
```

Available trucks:

```text
Truck 01 — Available
Truck 02 — Available
```

Dispatcher selects:

```text
Driver A
Truck 01
```

Click:

**ASSIGN**

---

# 5. CUSTOMER MANAGEMENT

Admin can:

* Search customers
* View profile
* View addresses
* View booking history
* View payments
* View subscriptions
* Suspend account
* Contact customer

---

# 6. PRICING MANAGEMENT

Admin can configure:

```text
Service
Waste type
Collection size
Location
Price
```

Example:

```text
Household
Small
₦X

Household
Medium
₦X

Household
Large
₦X
```

---

# 7. SERVICE AREA MANAGEMENT

Admin should define operating areas.

Example:

```text
Uyo
 ├── Ewet Housing Estate
 ├── Shelter Afrique
 ├── Osongama Estate
 ├── Aka Road
 ├── Oron Road
 ├── Nwaniba Road
 ├── Ikot Ekpene Road
 ├── Abak Road
 └── Itam
```

Bookings outside service areas should either be rejected or placed into a waitlist.

---

# 8. REPORTS

Reports:

* Revenue
* Bookings
* Customers
* Drivers
* Trucks
* Pickup performance
* Failed bookings
* Subscription revenue
* Cleaning revenue

Export:

* CSV
* Excel
* PDF

---

# 9. ADMIN SETTINGS

Admin should manage:

* Pricing
* Time slots
* Service areas
* Waste categories
* Cleaning categories
* Notifications
* Payment configuration
* User roles
* System settings
