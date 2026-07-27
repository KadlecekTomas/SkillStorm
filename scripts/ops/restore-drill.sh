#!/usr/bin/env bash
# Eduto — nanečisto obnova zálohy (restore drill).
#
# Záloha, kterou jsi nikdy neobnovil, není záloha. Tenhle skript vezme
# poslední (nebo zvolenou) zálohu, obnoví ji do dočasné databáze, zkontroluje
# že v ní data opravdu jsou, a po sobě uklidí. Nic produkčního nesahá.
#
# Usage:
#   scripts/ops/restore-drill.sh                      # poslední denní záloha
#   scripts/ops/restore-drill.sh --file <cesta.dump>  # konkrétní záloha
#   scripts/ops/restore-drill.sh --keep               # nechat DB pro ruční šťourání
#
# Connection (admin) přes standardní libpq proměnné:
#   PGHOST (default localhost), PGPORT (default 5432), PGUSER (default postgres), PGPASSWORD
#
# Výstup: PASS/FAIL na každou kontrolu a nenulový exit kód při selhání,
# takže se to dá pověsit do cronu jako měsíční cvičení.
#
# Runbook: docs/ops/backup-restore.md
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
FILE=""
KEEP=0
DRILL_DB="eduto_drill_$(date +%Y%m%d_%H%M%S)_test"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"

fail=0
check() {
  local label="$1" ok="$2" detail="${3:-}"
  if [[ "$ok" == "1" ]]; then
    printf '  PASS  %-42s %s\n' "$label" "$detail"
  else
    printf '  FAIL  %-42s %s\n' "$label" "$detail"
    fail=1
  fi
}

cleanup() {
  if [[ "$KEEP" == "1" ]]; then
    echo
    echo "Databáze $DRILL_DB ponechána (--keep). Ukliď ji ručně:"
    echo "  dropdb $DRILL_DB"
    return
  fi
  psql -q -d postgres -c "DROP DATABASE IF EXISTS \"$DRILL_DB\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo
echo "=== Nanečisto obnova zálohy ==="

# 1) Vyber zálohu
if [[ -z "$FILE" ]]; then
  FILE="$(find "$BACKUP_DIR" -name '*.dump' -type f -print0 2>/dev/null \
    | xargs -0 ls -t 2>/dev/null | head -1 || true)"
fi
[[ -n "$FILE" && -f "$FILE" ]] || {
  echo "ERROR: žádná záloha nenalezena (BACKUP_DIR=$BACKUP_DIR). Použij --file." >&2
  exit 1
}

age_days=$(( ( $(date +%s) - $(stat -f %m "$FILE" 2>/dev/null || stat -c %Y "$FILE") ) / 86400 ))
echo "Záloha: $FILE"
echo "Stáří:  ${age_days} dní"
echo "Cíl:    $DRILL_DB (dočasná)"
echo

# 2) Checksum — poškozený dump je horší než žádný, protože budí falešný klid
if [[ -f "$FILE.sha256" ]]; then
  if (cd "$(dirname "$FILE")" && shasum -a 256 -c "$(basename "$FILE").sha256" >/dev/null 2>&1); then
    check "checksum souhlasí" 1
  else
    check "checksum souhlasí" 0 "dump je poškozený"
    exit 1
  fi
else
  check "checksum přítomen" 0 "chybí .sha256 (jen varování)"
fi

# 3) Stáří zálohy — starší než 2 dny znamená, že cron neběží
check "záloha není starší než 2 dny" "$([[ $age_days -le 2 ]] && echo 1 || echo 0)" "${age_days} dní"

# 4) Obnova do dočasné databáze
createdb "$DRILL_DB"
pg_restore --no-owner --no-privileges --dbname "$DRILL_DB" "$FILE" \
  >/dev/null 2>/tmp/drill-restore.log || true

# pg_restore vrací nenulový kód i u neškodných varování — rozhoduje obsah logu.
# Známý šum: novější pg_dump zapisuje SET direktivy, které starší server nezná
# (transaction_timeout od PG17). Data to neovlivní, ale stojí za zmínku.
if grep -q "transaction_timeout" /tmp/drill-restore.log; then
  echo "  INFO  pg_dump je novější než cílový server (transaction_timeout)"
fi

real_errors=$(grep -iE "error|fatal" /tmp/drill-restore.log \
  | grep -v "transaction_timeout" \
  | grep -vc "errors ignored on restore" || true)

check "pg_restore bez skutečných chyb" \
  "$([[ "$real_errors" == "0" ]] && echo 1 || echo 0)" \
  "$([[ "$real_errors" == "0" ]] && echo "" || echo "${real_errors}x, viz /tmp/drill-restore.log")"

# 5) Data opravdu existují — prázdná obnovená DB projde „restorem" taky
q() { psql -tAq -d "$DRILL_DB" -c "$1" 2>/dev/null || echo "ERR"; }

tables=$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
check "schéma obnoveno" "$([[ "$tables" =~ ^[0-9]+$ && "$tables" -gt 20 ]] && echo 1 || echo 0)" "${tables} tabulek"

for t in users organizations memberships; do
  n=$(q "SELECT count(*) FROM \"$t\";")
  check "tabulka $t má data" "$([[ "$n" =~ ^[0-9]+$ && "$n" -gt 0 ]] && echo 1 || echo 0)" "${n} řádků"
done

# 6) Integrita vazeb — obnova, která rozbije tenanty, je k ničemu
orphan=$(q "SELECT count(*) FROM memberships m LEFT JOIN organizations o ON o.organization_id = m.organization_id WHERE o.organization_id IS NULL;")
check "žádná osiřelá členství" "$([[ "$orphan" == "0" ]] && echo 1 || echo 0)" "${orphan} osiřelých"

# 7) Migrace jsou kompletní
applied=$(q "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;")
pending=$(q "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL;")
check "migrace dokončené" "$([[ "$pending" == "0" ]] && echo 1 || echo 0)" "${applied} hotových, ${pending} nedokončených"

echo
if [[ "$fail" == "0" ]]; then
  echo "✅ Cvičení prošlo — tuhle zálohu lze obnovit."
else
  echo "❌ Cvičení selhalo. Záloha není použitelná, dokud to nevyřešíš."
fi
exit "$fail"
