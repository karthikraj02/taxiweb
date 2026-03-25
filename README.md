# Udupi Taxi - Premium Cab Service

A full-stack MERN taxi booking web application for Udupi, Karnataka. Book reliable cabs for outstation trips, local travel, and tour packages.

## Features

- 🚕 Real-time taxi booking with fare estimation
- 🔐 JWT authentication with OTP login (Twilio)
- 💳 Razorpay payment integration
- 📍 Live driver tracking with Socket.IO
- 🗺️ Google Maps integration
- 📱 Fully responsive design

## Prerequisites

- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Twilio account (for OTP SMS)
- Razorpay account (for payments)
- Google Maps API Key (for maps & autocomplete)

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd taxiweb

# Install all dependencies
npm run install:all
```

## Environment Variables

### Server (`server/.env`)

```
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/taxiweb?retryWrites=true&w=majority
JWT_SECRET=your_very_long_jwt_secret_key_here_min_32_chars
JWT_REFRESH_SECRET=your_very_long_refresh_secret_key_here_min_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
NODE_ENV=development

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret

OTP_EXPIRY_MINUTES=10
```

### Client (`client/.env`)

```
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id_here
VITE_API_URL=http://localhost:5000
```

## Running the Application

### Development

```bash
# Run both client and server concurrently
npm run dev
```

- Server: http://localhost:5000
- Client: http://localhost:3000

### Production

```bash
# Build the client
npm run build

# Start the server (serves API only; deploy client build separately)
npm start
```

## API Documentation

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/request-otp` | Request OTP for phone login |
| POST | `/api/auth/verify-otp` | Verify OTP and login |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout and revoke token |
| GET | `/api/auth/me` | Get current user (protected) |

### Bookings (`/api/bookings`) — All Protected

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bookings` | Create a new booking |
| GET | `/api/bookings` | List user's bookings |
| GET | `/api/bookings/:id` | Get booking details |
| PUT | `/api/bookings/:id/status` | Update status (admin) |
| DELETE | `/api/bookings/:id` | Cancel booking |

### Pricing (`/api/pricing`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pricing/estimate` | Get fare estimate |
| GET | `/api/pricing/tariffs` | Get all tariffs |

### Payments (`/api/payments`) — Protected

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/razorpay/order` | Create Razorpay order |
| POST | `/api/payments/razorpay/verify` | Verify payment signature |

### Drivers (`/api/drivers`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/drivers` | List available drivers |
| GET | `/api/drivers/:id` | Get driver by ID |
| POST | `/api/drivers` | Create driver (admin) |
| PUT | `/api/drivers/:id/location` | Update driver location |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |

## Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `joinBookingRoom` | Client → Server | Join a booking's room |
| `driverLocation` | Server → Client | Driver location update |
| `bookingStatus` | Server → Client | Booking status change |
| `joinedRoom` | Server → Client | Confirmation of room join |

## Tech Stack

- **Frontend**: React 18, Vite, Socket.IO Client, Axios, React Hot Toast
- **Backend**: Node.js, Express, MongoDB, Mongoose, Socket.IO
- **Auth**: JWT (access + refresh tokens), OTP via Twilio
- **Payments**: Razorpay
- **Maps**: Google Maps API

## License

MIT
