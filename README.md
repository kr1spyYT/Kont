# KONT

## Production Telegram game (Vercel + Neon)

1. Import the repository into Vercel and attach a PostgreSQL database from the Vercel Marketplace (Neon is supported).
2. In the database SQL editor, run [`db/schema.sql`](db/schema.sql).
3. Add these Vercel environment variables for Production and Preview:
   - `VITE_GAME_MODE=server`
   - `DATABASE_URL` or `POSTGRES_URL` (provided by the database integration)
   - `TELEGRAM_BOT_TOKEN` or `BOT_TOKEN` (the bot token, server-only; never use a `VITE_` prefix)
   - `OWNER_TELEGRAM_ID=1065784387`
4. Deploy the project and set the Telegram bot's Web App URL to the Vercel deployment URL.

The API verifies the signed Telegram `initData` on every request. It never uses the client-provided balance, inventory, XP, or role as authority. If server configuration is missing or the database schema has not been applied, the Telegram game shows an explicit setup error instead of switching to browser storage.

The first production login for Telegram ID `1065784387` asks whether to import an old local save or start fresh. In the local demo at `http://localhost:5177`, open the profile and download the save JSON, then select that file in the Telegram game. Import can be completed only once. Other Telegram accounts start with a clean profile.

## GitHub Pages demo

GitHub Pages intentionally builds with `VITE_GAME_MODE=demo`. It uses only that browser's `localStorage`, does not call the server API, and does not share progress or marketplace listings with Telegram accounts.

## Local development

`npm run dev` runs the localStorage demo. Configure a separate Vercel development environment with the variables above to test the server API locally; do not put the bot token in client code or commit a `.env` file.
