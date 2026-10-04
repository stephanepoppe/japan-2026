#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "anthropic>=1.9",
#     "typesafe-sdk>=0.7",
#     "python-dotenv>=1.0",
#     "pydantic>=2",
#     "pyyaml>=6",
# ]
# ///
"""Scan Gmail for Japan-trip bookings, extract them, write Obsidian notes.

    uv run japan_mail.py --dry-run
    uv run japan_mail.py
    uv run japan_mail.py --force        # ignore the cache, re-classify everything
    uv run japan_mail.py --self-check   # offline asserts, no API calls

Needs a .env next to this file:
    GMAIL_USER=you@gmail.com
    GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
    TYPESAFE_API_KEY=...
    ANTHROPIC_API_KEY=...
"""
from __future__ import annotations

import argparse
import base64
import email
import email.policy
import html
import imaplib
import json
import quopri
import re
import sqlite3
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field

HERE = Path(__file__).parent
VAULT = Path.home() / "Documents" / "Notes" / "Japan 2026"
CACHE_DB = HERE / ".japan_mail_cache.db"
SCAN_MONTHS = 12
PREVIEW_CHARS = 500          # what Jev sees of the body — see README note on blast radius
FETCH_OCTETS = 1500          # of the decoded text/plain part — 500 readable chars after HTML strip
WRITE_THRESHOLD = 0.80
TRIAGE_THRESHOLD = 0.50
EXTRACT_MODEL = "claude-opus-5"


# ---------------------------------------------------------------- extraction schema

class Booking(BaseModel):
    """One booking, flat.

    ponytail: this was a discriminated union of Flight | Stay | Transport | Activity,
    which is the nicer model — but four branches blew the structured-output grammar
    limit ("compiled grammar is too large"). One branch compiles; the JSON is identical.
    Fields not relevant to a kind stay null.
    """
    kind: Literal["flight", "stay", "transport", "activity"]
    name: str = Field(description="Property, airline+route, or activity title")
    start: str | None = Field(default=None, description="ISO YYYY-MM-DD, with time if known")
    end: str | None = Field(default=None, description="ISO YYYY-MM-DD")
    confirmation: str | None = Field(default=None, description="Booking/confirmation/reference number")
    pin: str | None = Field(default=None, description="Booking.com PIN, if present")
    cost: str | None = Field(default=None, description="Total with currency, e.g. '€436.84'")
    url: str | None = Field(default=None, description="Manage-booking link from the email, if present")
    city: str | None = Field(default=None, description="City, for stays")
    address: str | None = Field(default=None, description="Street address. Prefer the Japanese/original script where the email contains it; romanized only if that is all there is")
    origin: str | None = Field(default=None, description="Departure point, for flights and transport")
    destination: str | None = Field(default=None, description="Arrival point, for flights and transport")
    flight_number: str | None = Field(default=None, description="Flight or train number")
    notes: str | None = Field(default=None, description="Check-in time, host message, anything else")


# ---------------------------------------------------------------- pure helpers (self-checked)

_TAG = re.compile(r"<(script|style)\b.*?</\1>|<[^>]+>", re.S | re.I)
_WS = re.compile(r"\s+")


def strip_html(raw: str) -> str:
    """Tags out, entities decoded, whitespace collapsed.

    ponytail: regex, not a parser — this only ever feeds a 500-char classification
    preview, never the note body. Swap in html.parser if it starts mis-reading mail.
    """
    return _WS.sub(" ", html.unescape(_TAG.sub(" ", raw))).strip()


def decode_part(mime_headers: bytes, payload: bytes) -> str:
    """Decode a MIME part using its own Content-Transfer-Encoding.

    The payload is deliberately truncated mid-stream by the IMAP partial fetch,
    so base64 has to be trimmed to a 4-byte boundary or b64decode rejects it.
    """
    cte = ""
    if (mm := re.search(rb"content-transfer-encoding:\s*(\S+)", mime_headers, re.I)):
        cte = mm.group(1).decode("ascii", "replace").lower()
    if cte == "base64":
        compact = b"".join(payload.split())
        payload = base64.b64decode(compact[: len(compact) // 4 * 4])
    elif cte == "quoted-printable":
        payload = quopri.decodestring(payload)
    return payload.decode("utf-8", "replace")


def decide_tier(is_booking: float, trip: str, trip_conf: float) -> str:
    """write | triage | skip — the two-tier rule from Q11, gated on the trip question."""
    if is_booking < TRIAGE_THRESHOLD:
        return "skip"
    if trip != "japan" and trip_conf >= WRITE_THRESHOLD:
        return "skip"                     # confidently some other trip
    if is_booking >= WRITE_THRESHOLD and trip == "japan" and trip_conf >= WRITE_THRESHOLD:
        return "write"
    return "triage"


def safe_filename(kind: str, start: str | None, name: str) -> str:
    """Date-only, never date+time: one email says 2026-10-07T16:00 and the next says
    2026-10-07 for the same booking, and embedding the time made two notes."""
    slug = re.sub(r"[^\w\s-]", "", name, flags=re.U).strip()
    slug = _WS.sub(" ", slug)[:60].strip() or "untitled"
    day = (start or "undated")[:10]
    return f"{kind} {day} {slug}.md".replace("/", "-")


def merge_fm(old: dict, new: dict) -> dict:
    """New wins, but never overwrites a real value with a null.

    A reminder email carries less detail than the original confirmation and arrives
    later; without this, processing in date order would erase the good fields.
    """
    out = dict(old)
    for k, v in new.items():
        if v is not None or k not in out:
            out[k] = v
    return out


def _soft_key(b: dict) -> str:
    """Identity without a confirmation number: kind + first day + squashed name."""
    name = re.sub(r"[^a-z0-9]", "", (b.get("name") or "").lower())[:28]
    return f"{b.get('kind')}:{(b.get('start') or '')[:10]}:{name}"


def booking_key(b: dict) -> str:
    return f"conf:{b['confirmation']}" if b.get("confirmation") else _soft_key(b)


def merge_bookings(rows: list[dict]) -> list[dict]:
    """Collapse the several emails describing one booking into a single record.

    Two passes, because the emails disagree about what they carry: the confirmation
    email has the number, the "pack your bags" reminder often doesn't. Matching on the
    number alone splits one booking in two, so an unnumbered record is folded into a
    numbered one when kind, first day and name all agree.
    """
    by_key: dict[str, dict] = {}
    # Numbered records first, so unnumbered ones have something to attach to.
    for b in sorted(rows, key=lambda b: 0 if b.get("confirmation") else 1):
        k = booking_key(b)
        if k in by_key:
            by_key[k] = merge_fm(by_key[k], b)
            continue
        if not b.get("confirmation"):
            soft = _soft_key(b)
            hit = next((kk for kk, v in by_key.items() if _soft_key(v) == soft), None)
            if hit:
                by_key[hit] = merge_fm(by_key[hit], b)
                continue
        by_key[k] = b
    return sorted(by_key.values(), key=lambda b: (b.get("start") or "9999", b.get("kind", "")))


def self_check() -> None:
    assert strip_html("<p>Hi&nbsp;<b>there</b></p>") == "Hi there"
    assert strip_html("<style>a{}</style>Body") == "Body"
    assert strip_html("<head><title>x</title></head>Real text") == "x Real text"

    assert decide_tier(0.95, "japan", 0.99) == "write"
    assert decide_tier(0.95, "other", 0.99) == "skip"      # Épernay Airbnb must not land here
    assert decide_tier(0.20, "japan", 0.99) == "skip"      # marketing
    assert decide_tier(0.65, "japan", 0.99) == "triage"    # unsure it's a booking
    assert decide_tier(0.95, "other", 0.60) == "triage"    # unsure which trip
    assert decide_tier(0.95, "japan", 0.60) == "triage"

    assert safe_filename("stay", "2026-10-07", "Sumo Town Deluxe / Ryogoku") == \
        "stay 2026-10-07 Sumo Town Deluxe Ryogoku.md"
    assert safe_filename("flight", None, "") == "flight undated untitled.md"
    assert (safe_filename("stay", "2026-10-07T16:00", "Ryogoku")
            == safe_filename("stay", "2026-10-07", "Ryogoku")), "time precision must not split a booking"

    assert decode_part(b"Content-Transfer-Encoding: base64",
                       b"SGVsbG8gT3Nha2EhIFBJTjogNzQ1Mw==") == "Hello Osaka! PIN: 7453"
    assert decode_part(b"Content-Transfer-Encoding: base64", b"SGVsbG8gT3Nha2Eh____"[:16]) == "Hello Osaka!"
    assert decode_part(b"Content-Transfer-Encoding: quoted-printable", b"Priv=C3=A9") == "Privé"
    assert decode_part(b"", b"plain bytes") == "plain bytes"

    old = {"cost": "€436.84", "confirmation": "6277501036", "notes": "PIN 9223"}
    new = {"cost": None, "confirmation": "6277501036", "notes": "Pack your bags"}
    merged = merge_fm(old, new)
    assert merged["cost"] == "€436.84", "reminder email must not wipe the price"
    assert merged["notes"] == "Pack your bags"

    # one booking described by three emails: confirmation, receipt, then a thin reminder
    rows = [
        {"kind": "stay", "name": "Ryogoku", "start": "2026-10-07T16:00", "confirmation": "ABC",
         "cost": "€436.84", "pin": "9223", "url": "https://x", "notes": None},
        {"kind": "stay", "name": "Ryogoku", "start": "2026-10-07", "confirmation": "ABC",
         "cost": None, "pin": None, "url": None, "notes": "receipt"},
        {"kind": "stay", "name": "Ryogoku", "start": "2026-10-07", "confirmation": "ABC",
         "cost": None, "pin": None, "url": None, "notes": "Pack your bags"},
    ]
    merged = merge_bookings(rows)
    assert len(merged) == 1, f"three emails, one booking, got {len(merged)}"
    assert merged[0]["cost"] == "€436.84" and merged[0]["pin"] == "9223"
    assert merged[0]["url"] == "https://x"
    assert merged[0]["notes"] == "Pack your bags"
    # One booking, two emails, only one carrying the number: still one booking.
    split = merge_bookings([
        {"kind": "stay", "name": "Sumo Town Ryogoku", "start": "2026-10-07", "end": "2026-10-11",
         "confirmation": "HMDYXCX4H2", "cost": "€512"},
        {"kind": "stay", "name": "Sumo Town Ryogoku", "start": "2026-10-07", "end": "2026-10-11",
         "confirmation": None, "cost": None, "notes": "Pack your bags"},
    ])
    assert len(split) == 1, f"unnumbered reminder must fold into its booking, got {len(split)}"
    assert split[0]["confirmation"] == "HMDYXCX4H2"
    assert split[0]["cost"] == "€512"
    assert split[0]["notes"] == "Pack your bags"

    # distinct bookings with no confirmation must stay distinct
    assert len(merge_bookings([
        {"kind": "stay", "name": "A", "start": "2026-10-07", "confirmation": None},
        {"kind": "stay", "name": "B", "start": "2026-10-13", "confirmation": None},
    ])) == 2

    print("self-check ok")


# ---------------------------------------------------------------- cache

def open_cache() -> sqlite3.Connection:
    db = sqlite3.connect(CACHE_DB)
    db.execute("CREATE TABLE IF NOT EXISTS seen (msgid TEXT PRIMARY KEY, tier TEXT, prob REAL)")
    db.commit()
    return db


# ---------------------------------------------------------------- gmail

def find_all_mail(m: imaplib.IMAP4_SSL) -> str:
    """Locate the All Mail folder by its \\All special-use flag.

    Gmail localizes the [Gmail]/* folder names — this account calls it
    "[Gmail]/Alle e-mail". The flag is the same in every language.
    """
    typ, boxes = m.list()
    if typ != "OK":
        raise RuntimeError(f"LIST failed: {typ}")
    for raw in boxes:
        line = raw.decode("utf-8", "replace")
        if r"\All" in line:
            return line.rsplit(' "', 1)[-1].rstrip('"')
    raise RuntimeError("no folder with the \\All flag — is this a Gmail account?")


def connect(user: str, password: str) -> imaplib.IMAP4_SSL:
    m = imaplib.IMAP4_SSL("imap.gmail.com")
    m.login(user, password)
    box = find_all_mail(m)
    typ, detail = m.select(f'"{box}"', readonly=True)
    if typ != "OK":  # select returns NO rather than raising; don't let it slide
        raise RuntimeError(f"could not select {box!r}: {typ} {detail}")
    print(f"selected {box}", file=sys.stderr)
    return m


def fetch_previews(m: imaplib.IMAP4_SSL, since: date, limit: int | None = None,
                   search: str | None = None, seen: set[str] | None = None) -> list[dict]:
    """Headers for every candidate, body previews only for messages not already classified.

    Two phases on purpose. Headers are a few hundred bytes each and fetch in seconds;
    the text/plain slice is the expensive part. Since the cache is keyed on Message-ID
    and you need the headers to learn it, phase one is unavoidable — but phase two can
    skip everything already decided, which is what makes a re-run fast instead of a
    full-price repeat.
    """
    criterion = search or f'(SINCE {since.strftime("%d-%b-%Y")})'
    typ, data = m.search(None, criterion)
    if typ != "OK":
        raise RuntimeError(f"IMAP SEARCH rejected {criterion!r}: {data}")
    seqs = data[0].split()
    print(f"{len(seqs)} messages matching {criterion}", file=sys.stderr)
    if limit:
        seqs = seqs[-limit:]
        print(f"  limited to the {len(seqs)} most recent", file=sys.stderr)

    # ---- phase 1: headers only
    by_seq: dict[str, dict] = {}
    for i in range(0, len(seqs), 500):
        chunk = b",".join(seqs[i:i + 500]).decode()
        typ, resp = m.fetch(chunk, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID)])")
        for item in resp:
            if not isinstance(item, tuple):
                continue
            seq_m = re.match(r"\s*(\d+)\s*\(", item[0].decode("utf-8", "replace"))
            if not seq_m:
                continue
            msg = email.message_from_bytes(item[1], policy=email.policy.default)
            msgid = str(msg.get("Message-ID", "")).strip()
            if not msgid:
                continue
            by_seq[seq_m.group(1)] = {
                "seq": seq_m.group(1), "msgid": msgid,
                "sender": str(msg.get("From", "")), "subject": str(msg.get("Subject", "")),
                "date": str(msg.get("Date", "")), "preview": "",
            }
    print(f"  {len(by_seq)} headers", file=sys.stderr)

    # ---- phase 2: body previews, only for what the cache hasn't already decided
    seen = seen or set()
    need = [sq for sq, r in by_seq.items() if r["msgid"] not in seen]
    print(f"  {len(by_seq) - len(need)} already classified, {len(need)} need a preview",
          file=sys.stderr)

    for i in range(0, len(need), 200):
        chunk = ",".join(need[i:i + 200])
        typ, resp = m.fetch(chunk, f"(BODY.PEEK[1.MIME] BODY.PEEK[1]<0.{FETCH_OCTETS}>)")
        cur = None
        for item in resp:
            if not isinstance(item, tuple):
                continue
            prefix = item[0].decode("utf-8", "replace")
            if (seq_m := re.match(r"\s*(\d+)\s*\(", prefix)):
                cur = by_seq.get(seq_m.group(1))
            if cur is None:
                continue
            if "1.MIME" in prefix:
                cur["_mime"] = item[1]
            elif "[1]" in prefix:
                cur["_body"] = item[1]
        print(f"  previews {min(i + 200, len(need))}/{len(need)}", file=sys.stderr)

    for r in by_seq.values():
        if "_body" in r:
            r["preview"] = strip_html(decode_part(r.get("_mime", b""), r["_body"]))[:PREVIEW_CHARS]
        r.pop("_mime", None)
        r.pop("_body", None)
    return list(by_seq.values())


def fetch_bodies(user: str, password: str, m: imaplib.IMAP4_SSL,
                 hits: list[dict]) -> tuple[imaplib.IMAP4_SSL, list[tuple[dict, str]]]:
    """Full bodies for the hits, reconnecting when Gmail drops the connection.

    Gmail closes IMAP connections mid-run — rate limiting, idle time, its own reasons.
    A long-running mail tool has to survive that rather than explain it, so on abort we
    reconnect and re-find the message by Message-ID (sequence numbers are per-session
    and meaningless on the new connection).
    """
    out: list[tuple[dict, str]] = []
    for r in hits:
        for attempt in range(1, 4):
            try:
                out.append((r, fetch_full_body(m, r["seq"])))
                break
            except (imaplib.IMAP4.abort, imaplib.IMAP4.error, OSError) as e:
                if attempt == 3:
                    print(f"  ! body fetch gave up on {r['subject'][:50]}: {e}", file=sys.stderr)
                    break
                print(f"  · reconnecting ({e})", file=sys.stderr)
                try:
                    m.logout()
                except Exception:
                    pass
                m = connect(user, password)
                typ, d = m.search(None, f'(HEADER Message-ID "{r["msgid"]}")')
                found = d[0].split() if typ == "OK" and d and d[0] else []
                if found:
                    r = {**r, "seq": found[-1].decode()}
    return m, out


def fetch_full_body(m: imaplib.IMAP4_SSL, seq: str) -> str:
    typ, resp = m.fetch(seq, "(RFC822)")
    msg = email.message_from_bytes(resp[0][1], policy=email.policy.default)
    body = msg.get_body(preferencelist=("plain", "html"))
    if body is None:
        return ""
    text = body.get_content()
    return strip_html(text) if body.get_content_subtype() == "html" else text


# ---------------------------------------------------------------- jev gate

JEV_QUESTIONS = None  # built lazily so --self-check needs no SDK import


def build_questions():
    from typesafe_sdk import Choice, Noul
    return {
        "is_booking": Noul(instructions=(
            "This email confirms, receipts, or reminds about a specific travel booking the "
            "recipient has actually made: a flight, an accommodation stay, a train or transport "
            "reservation, or a booked activity. Price alerts, recommendations, newsletters, "
            "discount offers, login codes and account notices are NOT bookings."
        )),
        "trip": Choice(
            instructions="Which trip does this email concern?",
            criteria={
                "japan": "A trip to Japan — Tokyo, Kyoto, Osaka, Hiroshima, Hakone, Koyasan, "
                         "Nikko, Sumida, Ryogoku, or any other Japanese place.",
                "other": "Any other destination, or no specific trip at all.",
            },
        ),
    }


def classify(client, rec: dict) -> dict:
    """One Jev call per message. Only sender, subject and a 500-char preview leave the machine."""
    global JEV_QUESTIONS
    if JEV_QUESTIONS is None:
        JEV_QUESTIONS = build_questions()
    r = client.system_one(
        state={"from": rec["sender"], "subject": rec["subject"], "preview": rec["preview"]},
        questions=JEV_QUESTIONS,
    )
    is_booking = r.answers["is_booking"].noul
    trip = r.answers["trip"]
    return {**rec, "prob": is_booking,
            "tier": decide_tier(is_booking, trip.choice, trip.confidence)}


# ---------------------------------------------------------------- extraction + notes

EXTRACT_PROMPT = (
    "Extract the travel booking from this email. The email may be in Dutch, English or Japanese; "
    "extract faithfully but write all field values in English (keep proper names in their original "
    "script). Dates as YYYY-MM-DD. If a field is genuinely absent, leave it null — do not guess."
)


def extract(client, rec: dict, body: str):
    resp = client.messages.parse(
        model=EXTRACT_MODEL,
        max_tokens=16000,
        # Pulling named fields out of a short email is mechanical, not a reasoning task.
        # At default (high) effort each call took ~60s, which made a 20-booking run
        # 10+ minutes of wall clock; low effort does the same job in seconds.
        output_config={"effort": "low"},
        system=EXTRACT_PROMPT,
        messages=[{"role": "user", "content":
                   f"From: {rec['sender']}\nSubject: {rec['subject']}\nDate: {rec['date']}\n\n{body[:40000]}"}],
        output_format=Booking,
    )
    return resp.parsed_output


def write_note(b, rec: dict, dry: bool) -> Path:
    fm = {
        "type": b.kind,
        "start": b.start,
        "end": b.end,
        "confirmation": b.confirmation,
        "cost": b.cost,
        "source_id": rec["msgid"],
    }
    for extra in ("origin", "destination", "flight_number", "city", "address", "location"):
        if (v := getattr(b, extra, None)) is not None:
            fm[extra] = v

    # Dedup: the confirmation number is the booking's identity across confirmation,
    # receipt and reminder emails. Without one, fall back to the message id.
    key = b.confirmation or rec["msgid"]
    existing = next((p for p in VAULT.glob("*.md")
                     if p.name != "_Inbox.md"
                     and (yaml.safe_load(p.read_text().split("---")[1]) or {}).get("confirmation") == key), None) \
        if b.confirmation and VAULT.exists() else None

    if existing is not None:
        old = yaml.safe_load(existing.read_text().split("---")[1]) or {}
        fm = merge_fm(old, fm)
        path = existing
    else:
        path = VAULT / safe_filename(b.kind, b.start, b.name)

    doc = (f"---\n{yaml.safe_dump(fm, allow_unicode=True, sort_keys=False)}---\n\n"
           f"# {b.name}\n\n{b.notes or ''}\n")
    if not dry:
        VAULT.mkdir(parents=True, exist_ok=True)
        path.write_text(doc, encoding="utf-8")
    return path


GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"


def geocode(city: str, _cache: dict[str, tuple[float, float] | None] = {}) -> tuple | None:
    """City name -> (lat, lon) via Open-Meteo's free geocoder.

    Resolved here rather than in the browser so the coordinates are committed, work
    offline, and can be corrected by hand in bookings.json when a geocode is wrong.
    Never fatal: weather is a nice-to-have, a booking without coordinates just has none.
    """
    key = city.strip().lower()
    if key in _cache:
        return _cache[key]
    try:
        q = urllib.parse.urlencode({"name": city.split(",")[0].strip(),
                                    "count": 1, "language": "en"})
        with urllib.request.urlopen(f"{GEOCODE_URL}?{q}", timeout=10) as r:
            hits = json.loads(r.read()).get("results") or []
        _cache[key] = (hits[0]["latitude"], hits[0]["longitude"]) if hits else None
    except Exception as e:
        print(f"  ! geocode failed for {city!r}: {e}", file=sys.stderr)
        _cache[key] = None
    return _cache[key]


def add_coords(rows: list[dict]) -> list[dict]:
    """Fill lat/lon on stays that have a city and don't already have coordinates."""
    for b in rows:
        if b.get("kind") != "stay" or not b.get("city"):
            continue
        if b.get("lat") is not None:
            continue                                # already resolved, possibly by hand
        if (hit := geocode(b["city"])):
            b["lat"], b["lon"] = hit
    return rows


def write_json(path: Path, rows: list[dict]) -> None:
    """Merge this run's extractions into whatever is already on disk, then rewrite.

    Called after every successful extraction. Reading the existing file back matters:
    a run that gets killed half way leaves its results behind, and the cache means the
    next run only extracts what's missing — so without this merge the second run would
    replace the first run's bookings instead of completing the set.
    """
    existing = []
    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8")).get("bookings", [])
        except (json.JSONDecodeError, OSError):
            pass                                    # corrupt or unreadable: start fresh
    path.parent.mkdir(parents=True, exist_ok=True)
    merged = add_coords(merge_bookings([*existing, *rows]))
    path.write_text(json.dumps({"bookings": merged}, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")


def write_triage(rows: list[dict], dry: bool) -> None:
    if not rows:
        return
    lines = ["# Needs a look\n",
             f"_{len(rows)} emails Jev wasn't sure about (p {TRIAGE_THRESHOLD}–{WRITE_THRESHOLD})._\n"]
    for r in sorted(rows, key=lambda r: -r["prob"]):
        lines.append(f"- **{r['prob']:.2f}** · {r['date'][:16]} · `{r['sender']}` — {r['subject']}")
    if not dry:
        VAULT.mkdir(parents=True, exist_ok=True)
        (VAULT / "_Inbox.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="classify and extract, write nothing")
    ap.add_argument("--force", action="store_true", help="ignore the cache")
    ap.add_argument("--limit", type=int, help="stop after N messages (for tuning)")
    ap.add_argument("--search", metavar="IMAP",
                    help="raw IMAP search criterion instead of the date sweep, e.g. "
                         "--search '(X-GM-RAW \"from:booking.com OR from:airbnb.com\")'. "
                         "Gmail accepts X-GM-RAW with normal Gmail search syntax. Skips "
                         "scanning the whole window when you already know the senders.")
    ap.add_argument("--since", metavar="YYYY-MM-DD",
                    help="override the scan window start. The preview fetch is the slow "
                         "part (~1 min per 1,500 messages) and runs every time, because a "
                         "message has to be fetched before its id can be checked against "
                         "the cache. Narrow this when you only care about recent mail. "
                         "ponytail: the real fix is UID-based incremental fetch "
                         "(SEARCH UID <last+1>:*) — worth it if this gets run often.")
    ap.add_argument("--json", metavar="PATH", default="data/bookings.json",
                    help="also write structured bookings here for the PWA (default: data/bookings.json)")
    ap.add_argument("--self-check", action="store_true", help="offline asserts, no API calls")
    args = ap.parse_args()

    if args.self_check:
        return self_check()

    import anthropic
    from dotenv import load_dotenv
    from typesafe_sdk import TypeSafeClient
    import os

    load_dotenv(HERE / ".env")
    user, pw = os.environ["GMAIL_USER"], os.environ["GMAIL_APP_PASSWORD"]

    db = open_cache()
    if args.force:
        db.execute("DELETE FROM seen")
        db.commit()
    seen = {r[0] for r in db.execute("SELECT msgid FROM seen")}

    m = connect(user, pw)
    since = (datetime.strptime(args.since, "%Y-%m-%d").date() if args.since
             else date.today() - timedelta(days=SCAN_MONTHS * 30))
    records = fetch_previews(m, since, args.limit, args.search, seen)
    todo = [r for r in records if r["msgid"] not in seen]
    print(f"{len(records) - len(todo)} cached, {len(todo)} to classify", file=sys.stderr)

    ts = TypeSafeClient()
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda r: classify(ts, r), todo))

    # Cache skips and triage now; cache a 'write' only once it has actually been
    # extracted. Otherwise a run killed mid-extraction leaves the message marked done
    # and no later run ever retries it — the data is simply lost.
    for r in results:
        if r["tier"] != "write":
            db.execute("INSERT OR REPLACE INTO seen VALUES (?,?,?)", (r["msgid"], r["tier"], r["prob"]))
    db.commit()

    hits = [r for r in results if r["tier"] == "write"]
    triage = [r for r in results if r["tier"] == "triage"]
    print(f"{len(hits)} bookings, {len(triage)} uncertain, "
          f"{len(results) - len(hits) - len(triage)} skipped", file=sys.stderr)

    ac = anthropic.Anthropic()
    extracted: list[dict] = []

    # Bodies first, serially: imaplib's connection is not thread-safe.
    m, bodies = fetch_bodies(user, pw, m, hits)
    try:
        m.logout()                                  # done with IMAP before the slow part
    except Exception:
        pass

    def one(pair):
        r, body = pair
        try:
            return r, extract(ac, r, body), None
        except Exception as e:                      # one bad email must not kill the run
            return r, None, e

    # Extraction dominates the wall clock — Opus on a full email body is ~40s each,
    # so 16 of them serially is 10+ minutes. Same pool size as the Jev stage.
    with ThreadPoolExecutor(max_workers=6) as pool:
        for r, b, err in pool.map(one, bodies):
            if err is not None:
                # Drop it from the cache: classified but never extracted, so a re-run
                # must retry it rather than treat it as done and silently skip it.
                db.execute("DELETE FROM seen WHERE msgid = ?", (r["msgid"],))
                db.commit()
                print(f"  ! extract failed for {r['subject'][:60]}: {err}", file=sys.stderr)
                continue
            extracted.append({**b.model_dump(), "source_id": r["msgid"],
                              "source_subject": r["subject"]})
            path = write_note(b, r, args.dry_run)
            print(f"  {'would write' if args.dry_run else 'wrote'} {path.name}", file=sys.stderr)
            # Flush after every success: a run that dies at message 15 of 16 used to
            # lose everything, because the JSON was only written at the very end.
            if args.json and not args.dry_run:
                write_json(Path(args.json), extracted)
            # Safely on disk — only now is it legitimate to call this one done.
            db.execute("INSERT OR REPLACE INTO seen VALUES (?,?,?)",
                       (r["msgid"], "write", r["prob"]))
            db.commit()

    write_triage(triage, args.dry_run)
    if args.json and extracted:
        merged = merge_bookings(extracted)
        if not args.dry_run:
            write_json(Path(args.json), extracted)
        print(f"  {'would write' if args.dry_run else 'wrote'} {args.json} "
              f"({len(merged)} bookings from {len(extracted)} emails)", file=sys.stderr)
    print(f"\nnotes in {VAULT}" + (" (dry run — nothing written)" if args.dry_run else ""))


if __name__ == "__main__":
    main()
