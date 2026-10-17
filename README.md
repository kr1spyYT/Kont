# LootLand

## Production Telegram game (Vercel + Neon)

1. Import the repository into Vercel and attach a PostgreSQL database from the Vercel Marketplace (Neon is supported).
2. In the database SQL editor, run [`db/schema.sql`](db/schema.sql).
3. Add these Vercel environment variables for Production and Preview:
   - `VITE_GAME_MODE=server`
   - `DATABASE_URL` or `POSTGRES_URL` (provided by the database integration)
   - `TELEGRAM_BOT_TOKEN` or `BOT_TOKEN` (the bot token, server-only; never use a `VITE_` prefix)
   - `OWNER_TELEGRAM_ID=1065784387`
   - `ADMIN_TELEGRAM_ID` (Telegram ID allowed to use `/admin`; defaults to the owner ID)
   - `TELEGRAM_WEBHOOK_SECRET` (random secret used to authenticate Telegram webhook requests)
4. Deploy the project and set the Telegram bot's Web App URL to the Vercel deployment URL.
5. Register `https://<deployment>/api/telegram-webhook` as the bot webhook, passing the same `TELEGRAM_WEBHOOK_SECRET` as Telegram's `secret_token`. This endpoint handles `/admin` and admin callbacks. If the bot already has a webhook elsewhere, merge this handler into that bot before changing its webhook URL so existing bot commands keep working.

The Telegram `/admin` command opens a sectioned control panel for player lookup and moderation, auction listing review, live economy switches, player announcements, game analytics, and the container catalog. Player balance/XP adjustments and moderation take effect immediately; cancelled auction listings return to the seller's inventory. Broadcasts require explicit confirmation and are sent in small batches; players who have blocked the bot are reported as undeliverable.

Run the updated [`db/schema.sql`](db/schema.sql) in Neon to provision the admin session/settings tables, player moderation flag, and PostgreSQL-backed image storage. In `/admin`, send container and drop images as Telegram photos (not documents); the webhook stores the image bytes in `game_assets` and the game serves them from `/api/assets/<id>`. Existing static supplies continue to use their bundled images. Catalog edits are served to players within five seconds. The economy panel can pause container opening or marketplace activity and set the resale multiplier used for item and plate buyback.

The API verifies the signed Telegram `initData` on every request. It never uses the client-provided balance, inventory, XP, or role as authority. If server configuration is missing or the database schema has not been applied, the Telegram game shows an explicit setup error instead of switching to browser storage.

The player leaderboard and public player profiles are backed by PostgreSQL. Active player market listings refresh while the auction tab is open; the browser demo shows only its local player and does not share market data.

The first production login for Telegram ID `1065784387` asks whether to import an old local save or start fresh. In the local demo at `http://localhost:5177`, open the profile and download the save JSON, then select that file in the Telegram game. Import can be completed only once. Other Telegram accounts start with a clean profile.

## GitHub Pages demo

GitHub Pages intentionally builds with `VITE_GAME_MODE=demo`. It uses only that browser's `localStorage`, does not call the server API, and does not share progress or marketplace listings with Telegram accounts.

## Local development

`npm run dev` runs the localStorage demo. Configure a separate Vercel development environment with the variables above to test the server API locally; do not put the bot token in client code or commit a `.env` file.
