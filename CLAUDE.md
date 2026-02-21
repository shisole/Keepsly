# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` — Start dev server (Vite, port 5173)
- `pnpm build` — Production build
- `pnpm preview` — Preview production build
- `pnpm check` — TypeScript and Svelte type checking (`svelte-kit sync && svelte-check`)

No test framework is configured.

## Architecture

**Keepsly** — "Memories for keeps." A digital album built with SvelteKit 2 + TypeScript + Tailwind CSS 4 for event-based photo sharing. Guests scan a QR code to upload photos that appear in a live gallery.

### Key Data Flow

1. **Event creation**: Home page form action generates a 10-char nanoid → returns eventId
2. **Photo upload**: Guest visits `/upload/[eventId]` → captures/selects photos → client compresses to ≤1MB JPEG → POST to `/api/photos/[eventId]` gets a presigned R2 URL → PUT file directly to R2
3. **Gallery view**: `GET /api/photos/[eventId]?limit=20` loads first page → infinite scroll loads more via `?cursor` → SSE stream (`/api/photos/[eventId]/stream`) provides real-time updates

### Server-Side (`src/lib/server/`)

- `r2.ts` — Cloudflare R2 client (AWS SDK v3 S3-compatible). Provides `listEventPhotos()`, `listEventPhotosPaginated()`, `uploadPhoto()`, `deletePhoto()`, and event meta helpers. R2 objects stored at `events/{eventId}/{photoId}.jpg`. Thumbnails stored at `events/{eventId}/{photoId}_thumb.jpg` (400px longest edge, 80% JPEG quality, generated at upload time via sharp). Clients derive thumbnail URLs by replacing `.jpg` with `_thumb.jpg`; an `onerror` fallback loads the full-size image for pre-existing photos without thumbnails.

### API Routes

- `GET /api/photos/[eventId]` — List photos (public URLs, newest first)
  - **Without pagination**: returns `{ photos, eventName, maxPhotos, uploadDeadline, bannerUrl }`
  - **With pagination**: add `?limit=20` and optionally `?cursor`, `?offset`, or `?page`. Returns `{ photos, nextCursor, total, eventName, maxPhotos, uploadDeadline, bannerUrl }`. Priority: `cursor > offset > page`.
  - Omitting `limit` returns all photos (backward compatible)
- `POST /api/photos/[eventId]` — Upload a photo (JPEG body) → returns `{ photoId }`
- `DELETE /api/photos/[eventId]/[photoId]?key=[hostKey]` — Delete a photo (host key required)
- `GET /api/photos/[eventId]/stream` — SSE stream for real-time photo updates
- `GET /api/photos/[eventId]/download` — Download all photos as ZIP

### Client Utilities (`src/lib/utils/`)

- `compress.ts` — Wraps `browser-image-compression`; skips files already ≤1MB JPEG

### Conventions

- **Svelte 5 runes**: Use `$state`, `$derived`, `$effect`, `$props` (not legacy stores)
- **Environment variables**: Access via `$env/dynamic/private` in server code only
- **Styling**: Tailwind utility classes; custom theme colors defined in `src/app.css`
- **IDs**: 10-char nanoid for both events and photos

## Environment Variables

Configured in `.env` (see `.env.example`):

```
R2_ACCOUNT_ID        # Cloudflare account ID
R2_ACCESS_KEY_ID     # R2 API token access key
R2_SECRET_ACCESS_KEY # R2 API token secret
R2_BUCKET_NAME       # Bucket name (default: keepsly-uploads)
R2_PUBLIC_URL        # Public bucket URL (e.g., https://pub-xxx.r2.dev)
PUBLIC_GA_ID         # Google Analytics 4 measurement ID (optional, e.g., G-XXXXXXXXXX)
```
