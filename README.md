# Keepsly

**Memories for keeps.** A digital photo album for event-based photo sharing. Create an event, share the QR code with guests, and watch the gallery fill up in real time.

## How It Works

1. **Create an event** — Give it a name, set a photo limit per guest, choose an upload deadline, and optionally add a banner image.
2. **Share the QR code** — Guests scan it (or use the link) to open the upload page on their phone.
3. **Guests upload photos** — Photos are compressed client-side and uploaded directly to cloud storage via presigned URLs.
4. **Live gallery** — The gallery polls for new photos every 5 seconds so uploads appear in near real-time.

## Tech Stack

- **Framework**: [SvelteKit 2](https://kit.svelte.dev/) with Svelte 5 runes
- **Language**: TypeScript
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Storage**: [Cloudflare R2](https://developers.cloudflare.com/r2/) (S3-compatible)
- **Image compression**: [browser-image-compression](https://github.com/nicolo-ribaudo/browser-image-compression)
- **QR codes**: [qrcode](https://github.com/soldair/node-qrcode)
- **IDs**: [nanoid](https://github.com/ai/nanoid) (10-char)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)
- A [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket with public access enabled

### Setup

```bash
# Clone the repo
git clone https://github.com/<your-username>/keepsly.git
cd keepsly

# Install dependencies
pnpm install

# Copy the example env file and fill in your R2 credentials
cp .env.example .env
```

### Environment Variables

| Variable | Description |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET_NAME` | Bucket name (default: `keepsly-uploads`) |
| `R2_PUBLIC_URL` | Public bucket URL (e.g. `https://pub-xxx.r2.dev`) |

### Development

```bash
pnpm dev        # Start dev server on port 5173
pnpm check      # TypeScript & Svelte type checking
pnpm build      # Production build
pnpm preview    # Preview production build
```

## Project Structure

```
src/
├── lib/
│   ├── components/     # Reusable Svelte components (QRCode, PhotoGallery, etc.)
│   ├── server/
│   │   └── r2.ts       # Cloudflare R2 client (presigned URLs, listing)
│   └── utils/
│       ├── compress.ts  # Client-side image compression (≤1MB JPEG)
│       └── upload.ts    # Upload with progress tracking
├── routes/
│   ├── +page.svelte              # Home — Create or View
│   ├── create-event/             # Event creation form
│   ├── event/[eventId]/          # Event dashboard (QR, links, gallery)
│   ├── upload/[eventId]/         # Guest upload page
│   ├── gallery/                  # Gallery viewer with upload support
│   └── api/
│       └── photos/[eventId]/     # GET (list) & POST (presigned upload URL)
```

## License

MIT
