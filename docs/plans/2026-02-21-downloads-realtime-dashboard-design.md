# Design: Photo Downloads, Real-Time Updates, Event Dashboard

**Date:** 2026-02-21
**Status:** Approved

## 1. Secret Host Link

### Data Change
Add `hostKey` (20-char nanoid) to `EventMeta` in `r2.ts`. Generated at event creation alongside the `eventId`.

### Flow
1. Host creates event -> server generates `eventId` + `hostKey`, stores both in `meta.json`
2. Host is redirected to `/event/[eventId]/created?key=[hostKey]` — a one-time secret reveal page
3. Reveal page shows the host key in large monospace font with copy button, warning that it will only be shown once, and a "Copy Manage Link" button
4. Host clicks "I've saved it, continue" -> proceeds to `/event/[eventId]`
5. `hostKey` is stored in localStorage (`keepsly_host_keys` -> `{ [eventId]: hostKey }`) for convenience
6. On `/event/[eventId]`, if localStorage has a hostKey for the event, show a "Manage Event" button

### New Routes
- `/event/[eventId]/created` — one-time secret reveal page (only accessible right after creation)

## 2. Photo Downloads

### Individual Download
- Tapping a photo in `PhotoGallery` opens a lightbox/modal overlay
- Modal shows full-size image with prev/next navigation and a Download button
- Download: fetch the R2 public URL as a blob, trigger save via temporary `<a download>` element

### Bulk Download (ZIP)
- "Download All Photos" button appears above gallery when photos exist
- Hits `GET /api/photos/[eventId]/download`
- Server lists R2 objects, streams them into a ZIP using `archiver`
- Response: `Content-Type: application/zip`, `Content-Disposition: attachment; filename="[eventName]-photos.zip"`
- ZIP is built incrementally (streamed), not buffered in memory

### New API Route
- `GET /api/photos/[eventId]/download` — streams ZIP of all event photos

### New Component
- `PhotoLightbox.svelte` — modal overlay with full-size image, prev/next, download button

## 3. Real-Time Gallery Updates (SSE)

### Endpoint
- `GET /api/photos/[eventId]/stream` — SSE stream

### Message Format
```
event: photos
data: {"photos": ["url1", "url2", ...], "count": 12}
```

### Client Behavior
- Replace `setInterval` polling with `EventSource` connection
- On receiving `photos` event, reactively update gallery
- `EventSource` handles auto-reconnect natively
- Set `retry: 5000` for reconnect interval
- After 3 failed reconnects, fall back to 5-second polling

### Vercel Consideration
- Serverless functions have execution time limits
- SSE endpoint polls R2 every 3-5 seconds server-side, sends events on change
- Connection will eventually timeout; `EventSource` reconnects automatically

### Where Used
- `/event/[eventId]` (host view)
- `/gallery?event=[eventId]`
- `/event/[eventId]/manage` (dashboard)

## 4. Event Dashboard

### Route
`/event/[eventId]/manage?key=[hostKey]`

### Auth
- Server load function reads `?key` param
- Fetches `meta.json`, compares against stored `hostKey`
- Mismatch or missing -> 403

### Layout
1. **Event header** — name, banner, created date
2. **Stats cards** — total photos, time remaining / "Expired"
3. **Quick actions** — QR code, copy upload link, copy gallery link, Download All (ZIP)
4. **Photo grid with moderation** — gallery grid with delete button (trash icon) per photo, confirmation before delete
5. **Real-time** — uses SSE stream for live updates

### New API Endpoints
- `DELETE /api/photos/[eventId]/[photoId]?key=[hostKey]` — deletes photo from R2 after validating hostKey

### New Server Function
- `deletePhoto(eventId, photoId)` in `r2.ts` — deletes `events/{eventId}/{photoId}.jpg` from R2

## Summary of All New Routes/Endpoints

| Route/Endpoint | Type | Purpose |
|---|---|---|
| `/event/[eventId]/created` | Page | One-time host key reveal |
| `/event/[eventId]/manage` | Page | Host dashboard |
| `GET /api/photos/[eventId]/download` | API | ZIP download |
| `GET /api/photos/[eventId]/stream` | API | SSE stream |
| `DELETE /api/photos/[eventId]/[photoId]` | API | Photo deletion (host only) |

## New Components

| Component | Purpose |
|---|---|
| `PhotoLightbox.svelte` | Full-size photo modal with download |

## Data Changes

| Field | Change |
|---|---|
| `EventMeta.hostKey` | New 20-char nanoid, stored in `meta.json` |
