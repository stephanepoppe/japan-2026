#!/usr/bin/env bash
# Interactive setup for the Japan 2026 PWA.
# Walks the steps that need your hands: GitHub repo, Cloudflare account, D1, Access.
set -uo pipefail

B=$'\e[1m'; D=$'\e[2m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'
ok()   { echo "  ${G}✓${N} $*"; }
warn() { echo "  ${Y}!${N} $*"; }
bad()  { echo "  ${R}✗${N} $*"; }
step() { echo; echo "${B}── $* ${N}"; }
ask()  { local a; read -rp "  $1 " a; echo "$a"; }
pause(){ read -rp "  ${D}press enter when done${N} " _; }

PROJECT=japan-2026
echo "${B}Japan 2026 — setup${N}"
echo "${D}Stops at each thing only you can do. Safe to re-run.${N}"

# ---------------------------------------------------------------- prerequisites
step "1/7  Tools"
for c in node npm uv git; do
  if command -v "$c" >/dev/null; then ok "$c $("$c" --version 2>&1 | head -1)"
  else bad "$c missing"; MISSING=1; fi
done
if command -v gh >/dev/null; then ok "gh $(gh --version | head -1 | awk '{print $3}')"
else warn "gh not installed — you'll create the repo in the browser instead"; fi
[ "${MISSING:-}" = 1 ] && { echo; bad "Install the missing tools first (brew install node uv git)"; exit 1; }

# ---------------------------------------------------------------- npm install
step "2/7  Frontend dependencies"
if [ -d node_modules ]; then ok "node_modules present"
else echo "  running npm install…"; npm install --silent && ok "installed" || { bad "npm install failed"; exit 1; }
fi

# ---------------------------------------------------------------- cloudflare login
step "3/7  Cloudflare login"
if npx --yes wrangler whoami 2>/dev/null | grep -qi "account"; then
  ok "already logged in"
  npx --yes wrangler whoami 2>/dev/null | sed -n '3,6p' | sed 's/^/    /'
else
  echo "  A browser window will open to authorise wrangler."
  pause
  npx --yes wrangler login || { bad "login failed"; exit 1; }
  ok "logged in"
fi

echo
echo "  Your Cloudflare ${B}Account ID${N} is in the output above (or on any domain's"
echo "  overview page, right-hand column)."
ACCOUNT_ID=$(ask "Paste your Cloudflare Account ID:")
[ -z "$ACCOUNT_ID" ] && { bad "needed for the GitHub secret later"; exit 1; }

# ---------------------------------------------------------------- d1
step "4/7  D1 database (stores the day items you add)"
if npx --yes wrangler d1 list 2>/dev/null | grep -q "$PROJECT"; then
  ok "database '$PROJECT' already exists"
else
  npx --yes wrangler d1 create "$PROJECT" || { bad "d1 create failed"; exit 1; }
fi

echo
echo "  Copy the ${B}database_id${N} from the output above."
DB_ID=$(ask "Paste the database_id:")
if [ -n "$DB_ID" ]; then
  if command -v python3 >/dev/null; then
    python3 - "$DB_ID" <<'PY'
import re, sys, pathlib
p = pathlib.Path("wrangler.toml")
p.write_text(re.sub(r'database_id = ".*"', f'database_id = "{sys.argv[1]}"', p.read_text()))
PY
    ok "wrangler.toml updated"
  else
    warn "set database_id manually in wrangler.toml"
  fi
fi

echo "  Applying the schema…"
npx --yes wrangler d1 execute "$PROJECT" --remote --file=schema.sql \
  && ok "items table created" || warn "schema may already be applied — check the error above"

# ---------------------------------------------------------------- pages project
step "5/7  Cloudflare Pages project"
if npx --yes wrangler pages project list 2>/dev/null | grep -q "$PROJECT"; then
  ok "project '$PROJECT' exists"
else
  npx --yes wrangler pages project create "$PROJECT" --production-branch=main \
    && ok "created" || warn "create failed — may already exist"
fi

echo
echo "  ${B}Bind D1 to the Pages project${N} — this part has no CLI equivalent:"
echo "    1. dash.cloudflare.com → Workers & Pages → ${B}$PROJECT${N}"
echo "    2. Settings → Bindings → Add → D1 database"
echo "    3. Variable name: ${B}DB${N}   Database: ${B}$PROJECT${N}"
echo "    4. Save, for ${B}both${N} Production and Preview"
pause

# ---------------------------------------------------------------- github
step "6/7  GitHub repo and secrets"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then ok "git repo initialised"
else git init -q && git branch -M main && ok "git initialised"; fi

if [ -z "$(git config user.email 2>/dev/null)" ]; then
  warn "no git user.email set — commits will fail"
fi

REPO=$(ask "GitHub repo to use (owner/name), or blank to skip:")
if [ -n "$REPO" ] && command -v gh >/dev/null; then
  if gh repo view "$REPO" >/dev/null 2>&1; then ok "repo exists"
  else
    echo "  Creating ${B}private${N} repo (your booking PINs and addresses go in it)…"
    gh repo create "$REPO" --private --source=. --remote=origin \
      && ok "created and wired as origin" || bad "create failed"
  fi

  echo
  echo "  Setting the six Actions secrets. Values are read from .env where present."
  # shellcheck disable=SC1091
  [ -f .env ] && set -a && . ./.env && set +a
  for k in GMAIL_USER GMAIL_APP_PASSWORD TYPESAFE_API_KEY ANTHROPIC_API_KEY; do
    v="${!k:-}"
    if [ -n "$v" ]; then
      printf '%s' "$v" | gh secret set "$k" --repo "$REPO" >/dev/null && ok "$k set from .env"
    else
      warn "$k not in .env — set it with: gh secret set $k --repo $REPO"
    fi
  done
  printf '%s' "$ACCOUNT_ID" | gh secret set CLOUDFLARE_ACCOUNT_ID --repo "$REPO" >/dev/null \
    && ok "CLOUDFLARE_ACCOUNT_ID set"

  echo
  echo "  ${B}Create a Cloudflare API token${N} (the one secret that can't be scripted):"
  echo "    dash.cloudflare.com/profile/api-tokens → Create Token → ${B}Create Custom Token${N}"
  echo "    Permissions (all three, all ${B}Account${N} scope):"
  echo "      • Cloudflare Pages      → ${B}Edit${N}   ${D}(deploy)${N}"
  echo "      • D1                    → ${B}Edit${N}   ${D}(schema + queries)${N}"
  echo "      • Account Settings      → ${B}Read${N}   ${D}(resolve the account)${N}"
  echo "    Account Resources: include your account. No zone resources needed."
  TOKEN=$(ask "Paste the token (hidden input not used — it stays local):")
  if [ -n "$TOKEN" ]; then
    printf '%s' "$TOKEN" | gh secret set CLOUDFLARE_API_TOKEN --repo "$REPO" >/dev/null \
      && ok "CLOUDFLARE_API_TOKEN set"
  else
    warn "skipped — deploys will fail until you set it"
  fi
else
  echo "  Skipping gh automation. Create a ${B}private${N} repo and add these secrets by hand:"
  echo "    CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID,"
  echo "    GMAIL_USER, GMAIL_APP_PASSWORD, TYPESAFE_API_KEY, ANTHROPIC_API_KEY"
  pause
fi

# ---------------------------------------------------------------- access
step "7/7  Passphrase (Cloudflare Access can't cover a pages.dev URL)"
echo "  Access needs a domain you own on Cloudflare; ${B}japan-2026.pages.dev${N} is not one."
echo "  So the site is gated by one shared passphrase instead. Pick something you can"
echo "  type on a phone and tell the other person."
PASS=$(ask "Passphrase to protect the site:")
if [ -n "$PASS" ]; then
  printf '%s' "$PASS" | npx --yes wrangler pages secret put TRIP_PASSPHRASE --project-name="$PROJECT" \
    && ok "TRIP_PASSPHRASE set on $PROJECT" || warn "failed — set it in the dashboard under Settings → Variables"
  printf 'TRIP_PASSPHRASE=%s\n' "$PASS" > .dev.vars
  ok ".dev.vars written for local dev"
else
  warn "skipped — without it the site is open to anyone with the URL"
fi

echo
echo "${B}Done.${N} Next:"
echo "  ${D}# generate the booking data${N}"
echo "  uv run japan_mail.py"
echo "  ${D}# first deploy${N}"
echo "  git add -A && git commit -m 'japan 2026 pwa' && git push -u origin main"
echo
echo "  Then open ${B}https://$PROJECT.pages.dev${N} on your phone and"
echo "  Share → Add to Home Screen."
