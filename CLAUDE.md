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
3. **Gallery polling**: Home page polls `GET /api/photos/[eventId]` every 5 seconds → lists R2 objects → returns public URLs

### Server-Side (`src/lib/server/`)

- `r2.ts` — Cloudflare R2 client (AWS SDK v3 S3-compatible). Provides `getPresignedUploadUrl()` and `listEventPhotos()`. R2 objects stored at `events/{eventId}/{photoId}.jpg`.

### API Routes

- `GET /api/photos/[eventId]` — Returns `{ photos: string[] }` (public URLs, newest first)
- `POST /api/photos/[eventId]` — Returns `{ uploadUrl: string, photoId: string }` (presigned PUT URL, 10 min expiry)

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
```
