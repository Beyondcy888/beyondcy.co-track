#!/usr/bin/env bash
# =====================================================================
# Beyondcy backup: whole database -> numbered SQL files (restorable in the
# Supabase SQL Editor) + uploaded images -> one password-protected ZIP
# named DD-MM-YYYY.zip -> Google Drive.  Run by .github/workflows/backup.yml.
#
# This repo is PUBLIC: never print data, only counts.
# =====================================================================
set -euo pipefail

: "${PGHOST:?Missing secret SUPABASE_DB_HOST}"
: "${PGUSER:?Missing secret SUPABASE_DB_USER}"
: "${PGPASSWORD:?Missing secret SUPABASE_DB_PASSWORD}"
: "${BACKUP_ZIP_PASSWORD:?Missing secret BACKUP_ZIP_PASSWORD}"
: "${GDRIVE_RCLONE_CONF:?Missing secret GDRIVE_RCLONE_CONF}"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/17/bin}"
KEEP_DAYS="${KEEP_DAYS:-30}"
DRIVE_FOLDER="${DRIVE_FOLDER:-BEYONDCY-TRACKER-BACKUP}"
WORK="${WORK_DIR:-$PWD/backup-work}"
PSQL=("$PG_BIN/psql" -X -At -v ON_ERROR_STOP=1)
DUMP=("$PG_BIN/pg_dump" --no-owner --no-privileges)

DAY=$(TZ=Asia/Jakarta date +%d-%m-%Y)              # e.g. 17-11-2026
NAME="$DAY"
DIR="$WORK/beyondcy-backup-$DAY"
rm -rf "$WORK"; mkdir -p "$DIR"

# make pg_dump output safe for the Supabase SQL Editor
clean_sql() {
  sed -E \
    -e '/^\\(restrict|unrestrict)( |$)/d' \
    -e '/^DROP SCHEMA IF EXISTS public;$/d' \
    -e '/^CREATE SCHEMA public;$/d' \
    -e '/^COMMENT ON SCHEMA public IS /d' \
    -e '/^SET transaction_timeout/d'
}

header() {  # $1 = file, $2 = title, $3 = when to run
  printf -- '-- =====================================================================\n-- Beyondcy backup %s (WIB) - %s\n-- %s\n-- =====================================================================\n\n' \
    "$DAY" "$2" "$3" > "$1"
}

echo "== 1/6 Structure (01_schema.sql)"
F="$DIR/01_schema.sql"
header "$F" "01 SCHEMA: tables, functions, triggers, security rules" \
  "Run FIRST. Removes and recreates every tracker table (empty), then files 02-04 refill them."
{
  echo "-- things outside the public schema that depend on it are removed first (04 recreates them)"
  "${PSQL[@]}" -c "select format('drop trigger if exists %I on auth.users;', t.tgname)
                     from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = p.pronamespace
                    where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal and n.nspname = 'public'"
  "${PSQL[@]}" -c "select format('drop policy if exists %I on storage.objects;', policyname)
                     from pg_policies where schemaname = 'storage' and tablename = 'objects' order by 1"
  echo
  # keep permissions (GRANT/REVOKE): some protections, e.g. the 'people' view, rely on them
  "$PG_BIN/pg_dump" --no-owner --schema-only --schema=public --clean --if-exists | clean_sql
  echo
  echo "-- permissions exactly as at backup time (Supabase gives new tables broad default"
  echo "-- access, so everything is reset first, then the original grants are re-applied)"
  "${PSQL[@]}" -c "
    select format('revoke all on %s %I.%I from public, anon, authenticated, service_role;',
                  case c.relkind when 'S' then 'sequence' else 'table' end, n.nspname, c.relname)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','p','v','m','S')
    union all
    select format('grant %s on %s %I.%I to %s;', a.privilege_type,
                  case c.relkind when 'S' then 'sequence' else 'table' end, n.nspname, c.relname,
                  case when a.grantee = 0 then 'public' else quote_ident(r.rolname) end)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) a
      left join pg_roles r on r.oid = a.grantee
     where n.nspname = 'public' and c.relkind in ('r','p','v','m','S') and a.grantee <> c.relowner
    union all
    select format('revoke all on function %I.%I(%s) from public, anon, authenticated, service_role;', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    union all
    select format('grant execute on function %I.%I(%s) to %s;', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid),
                  case when a.grantee = 0 then 'public' else quote_ident(r.rolname) end)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      left join pg_roles r on r.oid = a.grantee
     where n.nspname = 'public' and a.grantee <> p.proowner"
} >> "$F"

echo "== 2/6 User accounts (02_auth_users.sql)"
F="$DIR/02_auth_users.sql"
header "$F" "02 USER ACCOUNTS (logins keep their passwords)" \
  "Run SECOND. Accounts that already exist are skipped."
"${DUMP[@]}" --data-only --column-inserts --on-conflict-do-nothing \
  -t auth.users -t auth.identities | clean_sql >> "$F"

echo "== 3/6 Tracker data (03-NN_data_<table>.sql)"
# tables ordered so every table comes after the tables it refers to
mapfile -t TABLES < <("${PSQL[@]}" -c "
  with recursive t as (
    select c.oid, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'),
  dep as (
    select distinct con.conrelid as child, con.confrelid as parent
      from pg_constraint con join t p on p.oid = con.confrelid
     where con.contype = 'f' and con.conrelid <> con.confrelid),
  lvl as (
    select t.oid, 0 as depth from t
    union all
    select d.child, l.depth + 1 from dep d join lvl l on l.oid = d.parent where l.depth < 50)
  select t.relname from t join lvl on lvl.oid = t.oid
  group by t.relname order by max(lvl.depth), t.relname")
i=0
for tbl in "${TABLES[@]}"; do
  i=$((i+1)); NN=$(printf '%02d' "$i")
  F="$DIR/03-${NN}_data_${tbl}.sql"
  header "$F" "03-$NN DATA: public.$tbl" "Run after 02, in number order (03-01, 03-02, ...)."
  {
    echo "alter table public.\"$tbl\" disable trigger user;"
    "${DUMP[@]}" --data-only --column-inserts -t "public.\"$tbl\"" | clean_sql
    "${PSQL[@]}" -c "select format('select setval(%L, coalesce((select max(%I) from public.%I), 1), (select count(*) > 0 from public.%I));',
                                   pg_get_serial_sequence(format('public.%I', c.relname), a.attname), a.attname, c.relname, c.relname)
                       from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
                      where n.nspname = 'public' and c.relname = '$tbl' and a.attnum > 0 and not a.attisdropped
                        and pg_get_serial_sequence(format('public.%I', c.relname), a.attname) is not null"
    echo "alter table public.\"$tbl\" enable trigger user;"
  } >> "$F"
done

echo "== 4/6 Finishing touches (04_finish.sql)"
F="$DIR/04_finish.sql"
header "$F" "04 FINISH: sign-up trigger, storage buckets + rules, live updates, timers" \
  "Run LAST."
{
  echo "-- sign-up trigger (creates a profile for each new user)"
  "${PSQL[@]}" -c "select format('drop trigger if exists %I on auth.users;', t.tgname) || chr(10) || pg_get_triggerdef(t.oid) || ';'
                     from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace n on n.oid = p.pronamespace
                    where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal and n.nspname = 'public'"
  echo; echo "-- storage buckets"
  "${PSQL[@]}" -c "select format('insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %L, %s, %L) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;',
                                  id, name, public, coalesce(file_size_limit::text, 'null'), allowed_mime_types)
                     from storage.buckets order by id"
  echo; echo "-- storage security rules"
  "${PSQL[@]}" -c "select format('drop policy if exists %I on storage.objects;', policyname) || chr(10) ||
                          format('create policy %I on storage.objects as %s for %s to %s', policyname, permissive, cmd,
                                 array_to_string(roles, ', '))
                          || coalesce(' using (' || qual || ')', '')
                          || coalesce(' with check (' || with_check || ')', '') || ';'
                     from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname"
  echo; echo "-- live updates (realtime)"
  "${PSQL[@]}" -c "select format('do \$\$ begin alter publication supabase_realtime add table %I.%I; exception when duplicate_object then null; end \$\$;', schemaname, tablename)
                     from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by tablename"
  if [ "$("${PSQL[@]}" -c "select count(*) from pg_namespace where nspname in ('cron','vault')")" = "2" ]; then
    echo; echo "-- notification timers and their shared secret"
    "${PSQL[@]}" -c "select format('do \$\$ begin if not exists (select 1 from vault.secrets where name = %L) then perform vault.create_secret(%L, %L); end if; end \$\$;', name, decrypted_secret, name)
                       from vault.decrypted_secrets where name like 'beyondcy\_%' order by name"
    "${PSQL[@]}" -c "select format('select cron.unschedule(jobid) from cron.job where jobname = %L;', jobname) || chr(10) ||
                            format('select cron.schedule(%L, %L, %L);', jobname, schedule, command)
                       from cron.job where jobname like 'beyondcy-%' order by jobname"
  fi
  echo; echo "-- check: row counts after restore"
  echo "select 'auth.users' as table_name, count(*) from auth.users"
  for tbl in "${TABLES[@]}"; do echo "union all select 'public.$tbl', count(*) from public.\"$tbl\""; done
  echo "order by 1;"
} >> "$F"

echo "== 5/6 Images (storage files)"
if [ -n "${S3_ACCESS_KEY_ID:-}" ] && [ -n "${S3_SECRET_ACCESS_KEY:-}" ] && [ -n "${S3_ENDPOINT:-}" ]; then
  export RCLONE_CONFIG_SUPA_TYPE=s3 RCLONE_CONFIG_SUPA_PROVIDER=Other \
         RCLONE_CONFIG_SUPA_ENDPOINT="$S3_ENDPOINT" RCLONE_CONFIG_SUPA_REGION="${S3_REGION:-ap-southeast-1}" \
         RCLONE_CONFIG_SUPA_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" RCLONE_CONFIG_SUPA_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
         RCLONE_CONFIG_SUPA_FORCE_PATH_STYLE=true
  mkdir -p "$DIR/storage-files"
  for b in $(rclone lsd supa: | awk '{print $NF}'); do
    rclone copy "supa:$b" "$DIR/storage-files/$b" --quiet
  done
  echo "image files: $(find "$DIR/storage-files" -type f | wc -l)"
else
  echo "Storage secrets not set - images skipped (database backup is still complete)."
fi

# row counts (numbers only - safe for public logs) + README
{
  echo "Beyondcy backup $DAY (WIB)"
  echo "auth.users $("${PSQL[@]}" -c 'select count(*) from auth.users')"
  for tbl in "${TABLES[@]}"; do echo "public.$tbl $("${PSQL[@]}" -c "select count(*) from public.\"$tbl\"")"; done
  [ -d "$DIR/storage-files" ] && echo "image files $(find "$DIR/storage-files" -type f | wc -l)"
} > "$DIR/row-counts.txt"
cat "$DIR/row-counts.txt"

cat > "$DIR/README.txt" <<README
BEYONDCY BACKUP $DAY  (made at about 02:00 WIB)

WHAT'S INSIDE
  01_schema.sql            structure: tables, functions, security rules
  02_auth_users.sql        user accounts (logins and passwords)
  03-NN_data_<table>.sql   the data, one file per table
  04_finish.sql            sign-up trigger, storage buckets and rules, live updates, timers
  storage-files/           uploaded images (banners, profile photos, note pictures)
  row-counts.txt           how many rows each table had

HOW TO RESTORE (Supabase -> SQL Editor)
  Always restore into a project you can afford to overwrite. 01 deletes the
  current tracker tables and rebuilds them before the data goes back in.
  1. Open each .sql file in a text editor, copy everything, paste it into a NEW
     query in the SQL Editor and click Run. Go strictly in file-name order:
     01, 02, 03-01, 03-02, ... 03-NN, 04.
  2. Supabase will warn about "destructive operations" for 01 - that is expected.
  3. The last result of 04 lists row counts: compare them with row-counts.txt.
  4. Images: upload the folders in storage-files/ back into the bucket with the
     same name (Supabase -> Storage), keeping the same folder structure.
  If a file is too large for the SQL Editor, ask for help to run it with psql.
  Ask Claude before restoring - it's easy, but it's worth doing carefully.
README

echo "== 6/6 Encrypted ZIP -> Google Drive"
( cd "$WORK" && 7z a -tzip -mem=AES256 -mx=7 -p"$BACKUP_ZIP_PASSWORD" "$NAME.zip" "beyondcy-backup-$DAY" > /dev/null )
ls -lh "$WORK/$NAME.zip" | awk '{print "zip size: " $5}'
CONF_FILE="$(mktemp)"
printf '%s\n' "$GDRIVE_RCLONE_CONF" > "$CONF_FILE"
rclone --config "$CONF_FILE" copy "$WORK/$NAME.zip" "gdrive:$DRIVE_FOLDER" --quiet
rclone --config "$CONF_FILE" lsf "gdrive:$DRIVE_FOLDER" --include "$NAME.zip" | grep -qx "$NAME.zip" \
  || { echo "Upload to Google Drive could not be confirmed"; exit 1; }
rclone --config "$CONF_FILE" delete "gdrive:$DRIVE_FOLDER" --min-age "${KEEP_DAYS}d" \
  --include "[0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9].zip" --quiet
echo "backups in Drive: $(rclone --config "$CONF_FILE" lsf "gdrive:$DRIVE_FOLDER" --include '*.zip' | wc -l)"
rm -f "$CONF_FILE"; rm -rf "$WORK"
echo "Done: $NAME.zip"
