# Japan 2026

Gmail → Jev → Claude → a PWA you can install on your phone.

## What it does

`japan_mail.py` sweeps the last 12 months of Gmail over IMAP, uses **Jev** (TypeSafe
System One) to decide which messages are Japan-trip bookings, and sends only those to
**Claude** for structured extraction. Output goes two places: Markdown notes for Obsidian,
and `data/bookings.json` for the app.

The app (Vite + React, Cloudflare Pages) shows the current day's bookings with addresses,
Google Maps links and tap-to-copy confirmation numbers, plus the full itinerary, a
yen/euro calculator and a Japanese phrasebook. Day items you add live in Cloudflare D1
so both phones see the same list.

## Setup

```bash
./setup.sh          # walks the steps that need your hands
```

Then:

```bash
uv run japan_mail.py            # generate data/bookings.json
git add -A && git commit -m init && git push -u origin main
```

## Day to day

```bash
uv run japan_mail.py --self-check     # offline asserts, no API calls, no network
uv run japan_mail.py --dry-run        # classify + extract, write nothing
uv run japan_mail.py --limit 300      # only the 300 most recent, for tuning
uv run japan_mail.py --force          # ignore the classification cache
npm run dev                           # app at localhost:5173
node src/lib/bookings.test.mjs        # trip-day grouping logic
```

`.japan_mail_cache.db` caches one row per message so re-runs are nearly free — a full
sweep classifies ~19,000 messages, a re-run classifies only what's new.

## How classification is tuned

Jev answers two questions per message: `is_booking` (a probability) and `trip`
(japan / other). The thresholds in `japan_mail.py`:

- `is_booking ≥ 0.80` **and** confidently `japan` → extract and write a note
- `0.50–0.80` → listed in `_Inbox.md` for you to eyeball
- `< 0.50`, or confidently another trip → skipped

Observed calibration on this mailbox: booking confirmations and receipts land at
0.81–0.97, correspondence *about* a booking at 0.53–0.79, unrelated mail below that.
Only sender, subject and the first 500 characters of the body are sent to Jev; full
bodies go to Claude only for messages that clear the bar.

## Privacy

`data/bookings.json` contains confirmation numbers, Booking.com PINs and the addresses
you're sleeping at. **Keep the repo private** and keep Cloudflare Access in front of the
site. `.env` and the cache are gitignored.
