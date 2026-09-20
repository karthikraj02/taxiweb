# Udupi Taxi: mobile app

React Native (Expo) app for Android and iOS, using the **same backend** as the
website (`server/`). The website in `client/` is unchanged and keeps working.

| | Customer | Driver |
|---|---|---|
| Sign in | email + password, or phone OTP | email OTP |
| Does | book with a server-calculated fare, pay with Razorpay, track the trip, cancel, review | go online, share location, accept requests, run the ride |

## Run it on your phone (2 minutes)

1. Install **Expo Go** from the Play Store / App Store.
2. In this folder:

   ```bash
   npm install
   npx expo start
   ```

3. Scan the QR code with Expo Go (Android) or the Camera app (iOS). Phone and
   computer must be on the same Wi-Fi.

The app talks to the deployed backend (`https://taxiweb-backend.vercel.app`) by
default. Other options:

```bash
npm run web         # quick look in a browser (payments are phone-only)
npm run typecheck   # TypeScript check
```

### Using a local backend

```bash
# mobile/.env.local  (not committed)
EXPO_PUBLIC_API_URL=http://192.168.1.20:5000
```

Use your computer's LAN IP, not `localhost`: a phone cannot reach your
computer's `localhost`. The server needs no changes for the app.

## Build an installable app

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview   # an APK you can install and share
eas build --platform ios --profile production    # needs an Apple developer account
```

Before publishing, replace the placeholder icons and splash in `assets/`
(`icon.png`, `splash-icon.png`, `android-icon-*.png`) and set your own
`ios.bundleIdentifier` / `android.package` in `app.json` if `in.udupitaxi.app`
is not right.

## How it talks to the backend

The API authenticates with HttpOnly cookies and a CSRF token, exactly like the
website. React Native keeps a native cookie jar, so `src/api/client.ts` mirrors
the website's client:

* fetches a CSRF token before any write, and refetches + retries once if stale
* on a `401`, rotates the refresh cookie once and retries
* customer and driver sessions are separate and can be signed in together
* never sends a fare, distance or amount: the server prices from coordinates

Native requests carry no `Origin` header, which the server's CORS policy allows.
**No backend changes are required.**

## Good to know

* **Payments** open Razorpay checkout in a WebView (works in Expo Go, no native
  SDK). The server re-verifies the signature and amount before confirming.
  It needs the backend's Razorpay keys (test keys are fine).
* **Live status is polled every 10 s.** The Vercel backend cannot run Socket.IO,
  so there is no realtime push or in-app chat yet. Hosting `server/index.js` on
  a normal Node host (Render, Railway, Fly) would allow it.
* **Driver documents** (licence, RC, insurance) are uploaded on the website
  today; the app shows the approval status and unlocks by itself once an admin
  approves the driver.
* Places come from a fixed list (`src/data/places.ts`, the same as the website)
  because the server prices from real coordinates and nothing is guessed.

## Layout

```
src/
  api/          axios client (CSRF, refresh) and typed endpoints
  components/   ui kit, place picker, trip card
  context/      customer and driver sessions
  data/         places, fleet, tours (same content as the website)
  hooks/        driver location sharing
  navigation/   tabs + stack, typed routes
  screens/      Home, Book, Checkout, Payment, Trips, TripDetail, Account,
                Auth, Tours, Contact, DriverAuth, DriverDashboard
  utils/        formatting, time slots, confirm dialog
```
