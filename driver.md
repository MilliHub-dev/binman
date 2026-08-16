# DRIVER & OPERATIONS APP SPECIFICATION this will be build on the webapp along side the landing page

## 1. DRIVER LOGIN

Driver uses:

* Phone number
* OTP

---

# 2. DRIVER HOME

Display:

* Today's jobs
* Completed jobs
* Pending jobs
* Earnings if applicable
* Current status

---

# 3. JOB DETAILS

Each job shows:

* Customer name
* Phone
* Address
* Map
* Waste type
* Collection size
* Scheduled time
* Special instructions
* Booking reference

---

# 4. JOB ACTIONS

Driver can:

**Accept**

↓

**Start Route**

↓

**Arrived**

↓

**Collect Waste**

↓

**Upload Proof**

↓

**Complete**

---

# 5. LOCATION

The driver application can periodically send:

```text
latitude
longitude
timestamp
```

Only while on active jobs, unless continuous tracking is specifically required.

---

# 6. PROOF OF COLLECTION

Driver uploads:

* Photo
* GPS location
* Timestamp

Optional:

* Customer signature/confirmation

---

# 7. FAILED COLLECTION

Driver can select:

* Customer unavailable
* Wrong address
* Access problem
* Waste unavailable
* Vehicle issue
* Other

A failed collection requires a reason.
