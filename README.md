# JIIT Connections — Backend (rewritten)

## Setup

```bash
npm install
cp .env.example .env   # fill it in
npm run dev
```

**Before anything else:** rotate every credential that was in the old `.env`
(Atlas password, Cloudinary secret, Gmail app password, JWT secret). They were
committed to a public repo.

## What changed

| Area | Before | Now |
|---|---|---|
| Auth | `req.headers['userid']` — spoofable by anyone | `req.userId` from the verified JWT |
| Passwords | Returned in every profile payload | `select: false` on the schema |
| Password reset | No OTP required at all | Requires a signed verification token |
| Discovery | Loaded every user of a gender into Node | Indexed `$match` + `$sample`, projected |
| Conversations | Loaded entire message history, sliced in JS | One indexed aggregation |
| Chat history | Whole thread on every open | Cursor pagination (`?before=`) |
| Swipes | `Swipe`/`Match` never imported → always 500 | Single `Swipe` collection, unique index |
| `Match` model | Overwritten by a second `module.exports` | Its own file |
| Sockets | Trusted a `UserID` query param | JWT handshake + rooms |
| Uploads | Local disk path stored in Mongo | Buffer → Cloudinary CDN URL |
| Indexes | None | On every hot query path |
| Rate limiting | None | Login, OTP, writes, global |

## API

All routes are under `/api/v1`. Authenticated routes need
`Authorization: Bearer <token>`.

### Auth
| Method | Path | Body |
|---|---|---|
| POST | `/auth/otp/signup` | `{ email }` |
| POST | `/auth/otp/reset` | `{ email }` |
| POST | `/auth/otp/verify` | `{ email, otp, purpose }` → `verificationToken` |
| POST | `/auth/login` | `{ email, password }` → `token` |
| POST | `/auth/password/reset` | `{ verificationToken, newPassword }` |
| GET | `/auth/me` | — |

### Profile
| Method | Path |
|---|---|
| POST | `/profile` (needs `verificationToken`) |
| GET | `/profile/me` |
| PATCH | `/profile/me` |
| POST | `/profile/photo` (multipart, field `photo`) |
| GET | `/profile/:id` |
| DELETE | `/profile/me` |

### Discovery
| Method | Path |
|---|---|
| GET | `/discover/deck?limit=10` |
| GET | `/discover/search?q=&interests=&year=&page=` |
| POST | `/discover/swipe` — `{ targetUserId, direction }` |

### Matches
`GET /matches` · `DELETE /matches/:matchId`

### Messages
| Method | Path |
|---|---|
| GET | `/messages/conversations?page=1` |
| GET | `/messages/:userId?before=<ISO>&limit=30` |
| GET | `/messages/:userId/media` |
| POST | `/messages/:userId` (multipart optional, field `image`) |

### Confessions
`GET /confessions` · `POST /confessions` · `POST /confessions/:id/like` ·
`PATCH /confessions/:id` · `DELETE /confessions/:id`

## Socket.IO

Connect with the JWT, not a user id:

```js
const socket = io(API_URL, { auth: { token } });
```

Events you receive: `message:new`, `messages:seen`, `match:new`,
`presence:online`, `presence:offline`, `presence:list`,
`typing:start`, `typing:stop`.

Events you send: `typing:start` / `typing:stop` with `{ to: userId }`.

Messages are persisted over HTTP (`POST /messages/:userId`) and pushed over
the socket. Don't send message content over the socket directly — the old
`private-message` handler wrote nothing to the database, so messages vanished
on refresh.

## College email gate

Signups are restricted to `@mail.jiit.ac.in`, and the local part must be an
8-digit enrolment number:

```
23103188@mail.jiit.ac.in
^^  admission year -> 2023
```

Two env vars control this:

| Var | Effect |
|---|---|
| `ALLOWED_EMAIL_DOMAIN=mail.jiit.ac.in` | rejects any other domain |
| `REQUIRE_ENROLMENT_EMAIL=true` | rejects staff/alumni addresses like `principal@` |

Because the enrolment number carries the admission year, **year of study is
derived, never asked for**. A 4th year can't pose as a fresher. It is also
refreshed automatically: `GET /auth/me` recomputes it and writes the new value
if the August session rollover has happened since the last visit — one
conditional write per user per year, no cron needed.

`enrolmentNo` is stored with `select: false` and deliberately kept out of
`User.PUBLIC_FIELDS`. It identifies a specific real student, so exposing it on
a profile would let anyone map a dating profile to a name in the college
directory. Only `year` is public.

The same rule lives in `frontend/src/lib/enrolment.js` for inline validation.
If you change one, change both — `node scripts/../` parity is not automatic.

## Signup flow

1. `POST /auth/otp/signup { email }` — must be a `@mail.jiit.ac.in` enrolment address
2. `POST /auth/otp/verify { email, otp, purpose: "signup" }` → `verificationToken`
3. `POST /profile/photo` (multipart) → `url`
4. `POST /profile { verificationToken, name, password, age, profile: url, gender, interests, bio }` → `token`
   (`year` is ignored if sent — it comes from the enrolment number)

## Still to do

- OTPs live in a `Map`, so they only work with a single server process.
  Move to Redis before you scale past one instance.
- No report/block feature yet. Add one before real users touch this.
- Add tests around `discoveryController.swipe` — it's the most logic-heavy path.
