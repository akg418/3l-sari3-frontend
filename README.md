# 3l sari3 - Frontend

React client for temporary chat channels. Vite, React 18, React Router, and a
WebSocket client that expects to be disconnected.

> The API it talks to lives in
> [3l-sari3-backend](https://github.com/akg418/3l-sari3-backend). Start that
> first - this app is not much use without it.

---

## Contents

- [Architecture](#architecture)
- [Design decisions](#design-decisions)
- [Requirements](#requirements)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Running](#running)
- [Pages and routing](#pages-and-routing)
- [State management](#state-management)
- [How the WebSocket layer works](#how-the-websocket-layer-works)
- [Countdowns and clock skew](#countdowns-and-clock-skew)
- [Validation](#validation)
- [Error handling](#error-handling)
- [Styling and animation](#styling-and-animation)
- [Testing](#testing)
- [Extending the UI](#extending-the-ui)

---

## Architecture

```
src/
├── api/            fetch transport + one module per API resource
├── components/
│   ├── common/     Button, Field, Modal, Countdown, Badge, toasts, feedback
│   ├── layout/     Header, AppLayout, AuthLayout
│   ├── channels/   ChannelCard, ChannelDirectory, MembersPanel, create and join modals
│   └── chat/       MessageList, MessageItem, MessageComposer, attachments
├── context/        Auth, Realtime, Channels, Toast providers
├── hooks/          useCountdown, useChannelChat, useJoinChannel, useForm
├── pages/          Login, Register, All channels, My channels, Channel, 404
├── routes/         route table and the protected / public-only gates
├── styles/         design tokens, base, components, layout
├── utils/          validation mirror, server clock, formatting, error copy
├── websocket/      event names and the RealtimeClient
├── config.js       environment-derived configuration
├── App.jsx         provider composition
└── main.jsx        entry point
```

Responsibilities are kept apart: components render, hooks hold behaviour,
contexts own shared state, and `api/` plus `websocket/` are the only modules
that know a server exists.

---

## Design decisions

**Context + `useReducer`, not Redux.** The app has three pieces of shared
state - session, channel directory, and the open conversation. Reducers give
predictable transitions and testability; a store library would be ceremony at
this size. The seams are drawn so that swapping `ChannelsContext` for a data
layer such as React Query later would not touch a single component.

**One normalised channel store.** "All channels" and "My channels" are two
views over the same map keyed by id, so a realtime update is applied once and
both views stay consistent.

**One socket per tab.** `RealtimeClient` is a singleton that refuses to open a
second connection - React effects and reconnect timers can both ask to connect,
and two sockets would double every event.

**Server time is the only time.** Every API response and socket frame carries
`meta.serverTime`; the client keeps a rolling offset and renders countdowns
against it. A browser clock that is ten minutes off shows correct remaining
time, and the client never decides that a channel has expired.

**Optimistic sends, reconciled by correlation id.** A message appears
immediately as a dimmed bubble tagged with a `clientMessageId`. The server's
ack carries that id back, and the broadcast carries the stored message; the
reducer matches them and drops the placeholder. A send that fails is marked
rather than silently lost.

**Channels are addressed by name.** The URL carries the channel's unique name -
`/channels/general` - and never its UUID. The name is resolved to a channel
once, from the directory if it is already loaded and otherwise from the API,
which accepts a name as readily as an id. A refresh or a shared link therefore
lands on the right channel, and a private channel still prompts for its
password rather than failing.

**Attachments upload as they are picked.** Choosing, dropping or pasting a file
starts its upload immediately, so progress is real and sending is instant.
Uploads start from an effect rather than inside a state updater - React
StrictMode invokes updaters twice, which would upload every file twice.

**Images are fetched, not linked.** Attachments are only served to members, and
an `<img src>` cannot carry an Authorization header, so the bytes are fetched
with one and wrapped in an object URL, shared through a small cache and
released when the channel closes. A signed URL in the `src` would have been
simpler and also a shareable link to private content.

**Plain CSS with tokens.** One tokens file drives colour, spacing, radius and
motion, including the dark theme. No CSS framework, so the production bundle is
around 68 kB gzipped in total.

---

## Requirements

- Node.js 18 or newer
- The backend running and reachable

---

## Installation

```bash
cd frontend
npm install
cp .env.example .env
```

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3005/api` | Backend REST base URL |
| `VITE_WS_URL` | derived from `VITE_API_URL` | WebSocket endpoint. Leave unset when the API and socket share a host |
| `VITE_APP_NAME` | `3l sari3` | Product name in the header and footer |

Only non-secret configuration belongs here: anything in a `VITE_` variable ends
up in the bundle.

---

## Running

```bash
npm run dev       # http://localhost:3006
npm run build
npm run preview
npm test
```

The backend's `CORS_ORIGINS` must include the dev server origin -
`http://localhost:3006` is already in its `.env.example`.

---

## Pages and routing

| Route | Page | Access |
|---|---|---|
| `/login` | Sign in | Signed-out only |
| `/register` | Create an account | Signed-out only |
| `/channels` | All channels + create | Protected |
| `/my-channels` | Channels you have joined, soonest expiry first | Protected |
| `/channels/:channelName` | Chat | Protected |
| `/` | Redirects to `/channels` | - |
| anything else | Not found | Protected |

`ProtectedRoute` renders a spinner while the stored token is re-validated, so a
reload never flashes the login screen at a signed-in user, and it remembers
where the user was heading so sign-in returns them there.

---

## State management

| Provider | Owns |
|---|---|
| `ToastProvider` | The notification queue. `key` collapses repeats instead of stacking them |
| `AuthProvider` | Session. Token in `localStorage`, re-validated against `/auth/me` on boot; a `401` anywhere ends the session centrally |
| `RealtimeProvider` | The socket's lifetime, bound to the session, plus connection status |
| `ChannelsProvider` | The normalised channel directory and the create/join/leave actions |

Local state stays local: `useChannelChat` owns one conversation, `useForm` owns
one form.

### Realtime reactions

| Event | Effect |
|---|---|
| `channel:created` | The channel appears in the directory immediately |
| `channel:expiring` | A warning toast, and the card and chat header switch to their urgent style |
| `channel:expired` | The channel is removed from every list; if it is the one being viewed, the view closes and the user is redirected to All channels |
| `message:new` | Appended to the open conversation, de-duplicated by id |
| `channel:activity` | Increments the unread badge for a channel you are not watching |
| `channel:read` | Clears that badge, including from another tab |
| `channel:members` | Replaces the roster wholesale - a snapshot cannot drift |
| `channel:presence` | Flips one member between online and away |
| `channel:member_joined` / `_left` | An inline note in the transcript |

---

## How the WebSocket layer works

`src/websocket/RealtimeClient.js` assumes the connection is temporary.

**Connect and authenticate.** On open, the client sends `auth:authenticate`
with the stored token and waits for `auth:authenticated` before considering
itself ready. Nothing else is sent before that.

**Correlated requests.** `request()` attaches a `requestId` and returns a
promise that settles on the frame carrying that id - resolved with the reply, or
rejected with the API's structured error. A correlated reply is never also
delivered to broadcast listeners, so a caller and a global handler cannot both
act on the same outcome.

**Reconnection.** An unexpected close schedules a retry with exponential
backoff and jitter, capped at 15 seconds, so many clients do not all return at
the same instant. Each new socket re-authenticates from scratch.

**Subscription replay.** The client remembers which channels the application
*wants* to be in and re-joins them after every reconnect. Because membership
already exists server-side, a private channel is replayed **without** its
password - the secret is never retained.

**Missed events.** Re-joining returns the channel's recent history, so anything
that arrived while the client was away is recovered. The directory is also
re-read whenever the socket becomes ready again.

**No duplicate connections.** `connect()` is a no-op while a socket is alive.

**Dead-connection detection.** Browsers cannot send protocol pings, so the
client sends an application `ping` every 25 seconds and recycles the socket if
no `pong` arrives within 10 - the usual symptom after a laptop wakes from
sleep.

**Giving up correctly.** Close code `4401` means the token was rejected;
retrying would fail identically, so the client stops and the app signs the user
out.

The status is always visible in the header - `Live`, `Connecting`,
`Reconnecting`, `Offline` - so a reconnect is never a silent stall.

---

## Search, filters and paging

The directory is searched and filtered **by the server**, because with paging a
client can only filter what it has already fetched. The text inputs are
debounced so typing stays responsive while the query behind them fires once,
and a stale response for an abandoned query is discarded rather than allowed to
overwrite the current one.

Scrolling loads the next page through an IntersectionObserver sentinel, with a
button underneath as a fallback for keyboard users.

"My Channels" wears the same controls but filters in the browser: that list is
bounded by what one person has joined and is already loaded in full, so a round
trip per keystroke would buy nothing. `matchesFilters` is shared between the two
so their behaviour cannot drift, and it is also what decides whether a
newly-announced channel belongs on the page you are currently looking at.

## Unread messages

Channels you have joined show an unread badge, and the header carries the
total. The count comes from the server on load, then moves live: a
`channel:activity` nudge increments it, and a `channel:read` - which the server
sends to *every* one of your sessions - clears it, so reading in one tab
updates another.

Having a channel open counts as reading it only while the tab is **visible**;
a background window keeps accumulating, which is what you want when you come
back to it.

## Members and presence

The channel view carries a members panel. It shows everyone who has joined,
with the owner marked, and distinguishes those connected right now from those
who are simply away - the two are different facts, and conflating them would
make a member who closed a tab look as though they had left.

The roster arrives with the join acknowledgement, is replaced wholesale when
membership changes, and is nudged by presence deltas as people connect and
disconnect. On a narrow screen it becomes a slide-over rather than a column.

## Attachments

The composer accepts files by picker, drag-and-drop or paste. Each file is
checked against the server's published limits before anything is sent, then
uploaded straight away with a progress bar; images show a local preview
immediately. Sending references the finished uploads, so the message itself is
instant.

In the transcript, images render inline and open full size in a new tab;
everything else appears as a card with its name, type and size, and a download
button. Both go through the authorised endpoint - there is no URL that works
without membership.

Abandoning a draft is safe: the uploads are never claimed by a message, and
the server sweeps them up.

## Countdowns and clock skew

`syncWithServer` in `src/utils/serverClock.js` updates an offset from every
response, assuming a symmetric round trip so most network latency is removed.
`serverNow()` is what `useCountdown` measures against; it ticks once a second
and switches style at five minutes and at one minute.

`isExpired` from the hook only affects presentation - the label stops at
`00:00` and the card dims. The channel is only actually gone when the server
says so via `channel:expired`.

---

## Validation

`src/utils/validation.js` mirrors the backend's rules so a user gets immediate,
specific feedback: why a username is invalid, not just that it is. It is a
convenience, not a gate - the server re-validates everything, and its field
errors are mapped back onto the form when they disagree.

---

## Error handling

Raw backend messages are never displayed. `src/utils/errorMessages.js` maps the
API's stable error codes to copy a person can act on, and an unrecognised code
degrades to a neutral message rather than leaking internals. Validation
`details` are turned into per-field errors; everything else becomes an inline
alert or a toast.

---

## Styling and animation

Four stylesheets: `tokens.css` (every colour, space and motion value, plus the
`prefers-color-scheme` dark theme), `base.css` (typography, keyframes),
`components.css`, `layout.css`.

Animation is deliberately restrained - a button lift on hover, a card lift on
hover, page transitions, messages rising in, modals scaling in, toasts sliding
in, and a slow pulse on a countdown in its final minute. Everything is short,
and all of it collapses under `prefers-reduced-motion: reduce`.

Responsive from roughly 360 px up: the channel grid, forms and header all
reflow, and the chat view fills the viewport with its own scroll region.

Accessibility: labelled fields with `aria-describedby` error links, a dialog
that traps and restores focus and closes on Escape, a polite live region for
toasts, visible focus rings, and `Enter` to send with `Shift+Enter` for a
newline.

---

## Testing

```bash
npm test
```

```
src/test/
├── RealtimeClient.test.js       reconnection, replay, correlation, heartbeat
├── ChannelFilters.test.jsx      debounced search, filters, clearing
├── channelFiltering.test.js     the predicate shared by both channel lists
├── useAttachmentDraft.test.js   staging, limits, progress, failures, cleanup
├── MessageAttachments.test.jsx  inline images, file cards, authorised loading
├── MembersPanel.test.jsx        roster, owner badge, online versus away
├── validation.test.js           the rules that mirror the backend
├── serverClock.test.js          clock offset, latency compensation, formatting
├── ChannelCard.test.jsx         rendering, lock icon, join/open, countdown
└── MockWebSocket.js             a hand-driven socket stand-in
```

`RealtimeClient` is driven frame by frame against a mock socket with fake
timers, which covers the behaviour that is hardest to verify by hand: no
duplicate sockets, re-authentication on every new socket, subscription replay
without resending passwords, backoff growth, in-flight requests rejected rather
than left hanging, and giving up on a rejected token.

The attachment draft is tested for the mistakes that are easy to make and hard
to see: uploading a file exactly once despite StrictMode's double render,
rejecting an unsupported type or an oversized file before any bytes leave,
applying the right size limit per kind, and releasing preview URLs on removal.

---

## Extending the UI

| Feature | Where it goes |
|---|---|
| Audio and video messages | `MessageAttachments` branches on `kind`; add a case beside the image and file ones |
| Typing indicators, presence | A new event in `websocket/events.js` and a subscription in `useChannelChat` |
| Reactions, read receipts | Extra state in the chat reducer; message ids are stable |
| Search, infinite history | `loadOlder` and the keyset cursor are already in place |
| Theming | `styles/tokens.css` only |
