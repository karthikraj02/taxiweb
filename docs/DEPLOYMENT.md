# Deployment Architecture

## Why the previous setup could not work

The repository shipped `server/vercel.json` deploying `index.js` as a Vercel
serverless function. Socket.IO needs a **persistent process holding open
connections**; a serverless function is invoked per request and torn down.
Live tracking and chat could not have worked in that deployment, regardless of
the client code. That file has been deleted.

Local disk had the same problem: driver documents were written to
`server/uploads/`, which on a serverless host does not survive between
invocations.

## Target architecture

| Component  | Where                                    | Why                                        |
|------------|------------------------------------------|--------------------------------------------|
| Frontend   | Vercel / Netlify / Cloudflare Pages      | Static SPA build, CDN-served               |
| API + WS   | Render / Railway / Fly.io / VPS          | **Persistent Node process** — required     |
| Database   | MongoDB Atlas                            | Managed, backed up, supports 2dsphere      |
| Files      | Cloudflare R2 / AWS S3 / Cloudinary      | Durable object storage (see caveat below)  |
| Payments   | Razorpay                                 | Orders, checkout, webhooks, refunds        |
| Routing    | Google Distance Matrix or OSRM           | Real road distance and ETA                 |

```
Browser ──HTTPS──> Vercel (static SPA)
   │
   ├──XHR (credentials: include)──> api.yourdomain.com  ┐
   └──WebSocket ──────────────────> api.yourdomain.com  ┘  one persistent Node process
                                          │
                        ┌─────────────────┼─────────────────┐
                        ▼                 ▼                 ▼
                  MongoDB Atlas      Razorpay         Object storage
```

## Cookie requirements

The frontend and API are on different origins, so auth cookies are issued with
`SameSite=None; Secure; HttpOnly`. Two consequences:

1. **The API must be served over HTTPS.** Browsers reject `SameSite=None`
   without `Secure`.
2. `CLIENT_URL` (and any extra `ALLOWED_ORIGINS`) must exactly match the
   frontend origin, including scheme and any `www.`.

Putting both behind one domain (`example.com` and `example.com/api`) avoids
third-party cookie restrictions entirely and is the more robust option.

## Deployment steps

### 1. MongoDB Atlas
Create a cluster, add a database user, allow your API host's egress IPs.
Indexes are declared in the schemas and created by Mongoose on connect.

### 2. API (Render shown; Railway/Fly are equivalent)
- Root directory: `server`
- Build: `npm ci`
- Start: `npm start`
- Health check path: `/api/health`
- Set every variable from `server/.env.example`.

The process **exits on boot** if a required secret is missing. That is
deliberate: a failed deploy is visible, whereas an API running with a fallback
secret is a silent compromise.

### 3. Razorpay webhook
Dashboard → Settings → Webhooks:
- URL: `https://api.yourdomain.com/api/webhooks/razorpay`
- Events: `payment.captured`, `payment.failed`, `refund.created`, `refund.processed`
- Copy the signing secret into `RAZORPAY_WEBHOOK_SECRET`.

The webhook route is mounted **before** the JSON body parser so the signature
can be verified against the exact bytes Razorpay signed.

### 4. Frontend
- Root directory: `client`
- Build: `npm ci && npm run build`
- Output: `dist`
- Env: `VITE_API_URL=https://api.yourdomain.com`

### 5. First admin
```bash
cd server && node scripts/create_admin.js you@yourdomain.com
```
Prints a generated password once. There is no default credential.

## Known gaps requiring your credentials

These are **not implemented** and are called out rather than stubbed:

1. **Object storage.** `services/storage.js` validates uploads properly
   (magic bytes, size, random keys) but only has a local-disk driver. On a
   platform with an ephemeral filesystem, driver documents will be lost on
   restart, and the service logs a warning saying so at runtime. Adding an S3/R2
   driver means implementing one `put` function in that file.

2. **Redis-backed rate limiting.** Limits are per-process. Running more than one
   API instance multiplies every limit by the instance count. Add
   `rate-limit-redis` and a `REDIS_URL` before scaling horizontally.

3. **Routing provider.** Defaults to `haversine`, a geometric estimate. Set
   `ROUTING_PROVIDER=google` (with a key) or `osrm` for real road distances.
   Fares are computed from whatever this returns, so it directly affects billing.
