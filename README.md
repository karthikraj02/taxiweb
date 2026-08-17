# TaxiWeb — Udupi Taxi

Full-stack taxi booking platform. React + Vite frontend, Node/Express + MongoDB
API, Socket.IO for live tracking and chat, Razorpay for payments.

---

## Architecture

```
taxiweb/
├── client/                 React SPA (Vite)
│   └── src/
│       ├── api/            single axios client, CSRF + token refresh
│       ├── components/     UI
│       ├── context/        auth + driver session
│       ├── hooks/          useSocket, useDriverLocation (real GPS)
│       └── utils/          place resolution
│
├── server/
│   ├── config/             validated env (fails fast), db connection
│   ├── constants/          booking state machine
│   ├── dto/                explicit response shapes (PII allow-lists)
│   ├── middleware/         auth, validation, rate limits, errors
│   ├── models/             Mongoose schemas + indexes
│   ├── routes/             HTTP layer
│   ├── services/           pricing, routing, dispatch, tokens, OTP, payments
│   ├── socket/             authenticated + authorised realtime
│   ├── validators/         Zod schemas
│   └── tests/              unit + integration suites
│
└── docs/DEPLOYMENT.md
```

## Getting started

```bash
git clone <repo> && cd taxiweb
npm run install:all

cp server/.env.example server/.env      # fill in MONGODB_URI at minimum
cp client/.env.example client/.env

npm run dev                             # API :5000, client :3000
```

Create an admin:
```bash
cd server && node scripts/create_admin.js you@example.com
```

## Security model

The values below are **never** accepted from a client. Each was client-controlled
in a previous revision.

| Value              | Source of truth                                              |
|--------------------|--------------------------------------------------------------|
| Fare               | `services/pricing.js`, from server-resolved distance          |
| Distance / ETA     | `services/routing.js` (Google / OSRM / configured estimate)   |
| Payment amount     | `booking.fare`, re-checked against Razorpay's own record      |
| Booking status     | State machine, `constants/bookingStates.js`                   |
| Payment status     | Set only after signature verification or a signed webhook     |
| Driver assignment  | Atomic conditional update, `services/dispatch.js`             |
| Driver GPS         | Authenticated driver session; no id in the request            |
| Chat sender        | Authenticated socket principal                                |
| User role          | Server-assigned; rejected if present in a request body        |

Other controls: bcrypt-hashed OTPs with attempt caps and cooldowns; hashed,
rotating refresh tokens with reuse detection; RBAC with ownership scoping inside
queries; Zod validation on every endpoint (which also blocks NoSQL operator
injection); Helmet CSP/HSTS; env-driven CORS; per-route rate limits; upload
validation by magic bytes; audit logging of privileged actions; secret redaction
in logs.

See `SECURITY.md` for reporting.

## Tests

```bash
cd server
npm test          # unit always; integration when a database is reachable
npm run test:db   # integration mandatory — fails if no database
```

Integration tests need MongoDB. They use `mongodb-memory-server` (downloads a
binary on first run) or an instance you point at:

```bash
MONGODB_TEST_URI=mongodb://localhost:27017/taxiweb_test npm run test:db
```

Without a database the DB-backed suites are reported as **skipped**, never as
passed.

## API overview

All responses use one envelope:

```jsonc
// success
{ "success": true, "data": { } }

// failure
{ "success": false, "error": { "code": "BOOKING_NOT_FOUND", "message": "…" }, "requestId": "…" }
```

Mutating requests need the `x-csrf-token` header (fetch from `GET /api/csrf-token`);
the bundled API client handles this automatically.

| Method | Path                                   | Access   |
|--------|----------------------------------------|----------|
| POST   | `/api/auth/register` `/login` `/refresh` `/logout` | public   |
| POST   | `/api/auth/request-otp` `/verify-otp`  | public   |
| POST   | `/api/auth/change-password` `/logout-all` | customer |
| POST   | `/api/pricing/quote`                   | customer |
| GET    | `/api/pricing/tariffs`                 | public   |
| POST   | `/api/bookings`                        | customer |
| GET    | `/api/bookings` `/api/bookings/:id`    | owner    |
| POST   | `/api/bookings/:id/dispatch`           | owner    |
| DELETE | `/api/bookings/:id`                    | owner    |
| POST   | `/api/payments/razorpay/order` `/verify` | owner  |
| POST   | `/api/webhooks/razorpay`               | Razorpay |
| PUT    | `/api/drivers/me/location` `/availability` | driver |
| GET    | `/api/driver/requests` `/stats` `/rides` | approved driver |
| POST   | `/api/driver/requests/:id/accept`      | approved driver |
| POST   | `/api/driver/rides/:id/advance`        | assigned driver |
| POST   | `/api/contact`                         | public   |
| GET    | `/api/reviews`                         | public   |
| POST   | `/api/reviews/booking/:id`             | owner, completed ride |
| \*     | `/api/admin/*`                         | admin    |

`POST /api/bookings` accepts an optional `Idempotency-Key` header; replaying the
same key returns the original booking instead of creating a duplicate.

## Booking lifecycle

```
pending → payment_pending → confirmed → dispatching → driver_assigned
                                    → driver_en_route → driver_arrived
                                    → in_progress → completed
```

Every transition is validated server-side. Illegal jumps (`pending → completed`,
`completed → in_progress`, `cancelled → driver_assigned`) are rejected for all
roles, admins included.

## Deployment

The API and Socket.IO require a **persistent Node process** — they cannot run as
serverless functions. See `docs/DEPLOYMENT.md`.
