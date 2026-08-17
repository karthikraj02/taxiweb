# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately rather than opening a public
issue. Include reproduction steps and the impact you observed. We aim to
acknowledge within 72 hours.

## Controls in place

- **Authentication** — short-lived access JWTs with an audience claim; opaque
  refresh tokens stored only as SHA-256 hashes, rotated on every use, with
  family-wide revocation on replay. Cookies are HttpOnly, Secure and SameSite.
- **Passwords** — bcrypt (cost 12), complexity policy, lockout after repeated
  failures, and full session revocation on change or reset.
- **OTP** — CSPRNG-generated, bcrypt-hashed at rest, expiring, attempt-capped,
  cooldown-limited, single-use. Never returned in an API response.
- **Authorisation** — RBAC plus resource ownership applied inside the query, so
  an unauthorised document is never loaded. Missing resources return 404 rather
  than 403 to avoid confirming existence.
- **Payments** — mandatory HMAC signature verification with constant-time
  comparison, independent confirmation against the gateway, and amount/currency
  checks against the server-calculated fare. There is no bypass path.
- **Webhooks** — signature verified over the raw request body; idempotency
  enforced by a unique index.
- **Input validation** — Zod on every endpoint with strict object shapes, which
  rejects both unexpected fields (mass assignment) and NoSQL operator injection.
- **Realtime** — Socket.IO handshakes are authenticated; room membership is
  authorised against booking ownership; sender identity is server-derived.
- **Uploads** — validated by magic bytes rather than filename, size-capped, and
  stored under random keys.
- **Transport & headers** — Helmet with a restrictive CSP, HSTS in production,
  and env-driven CORS with no hardcoded origins.
- **Auditing & logging** — privileged actions are recorded with actor, before/
  after values, IP and request id. Logs redact credentials and payment data.

## Known limitations

- Rate limiting is in-memory and therefore per-process. Use a Redis-backed store
  before running multiple instances.
- File storage has only a local-disk driver; configure object storage before
  deploying to a host with an ephemeral filesystem.
- Admin accounts do not yet support MFA.
