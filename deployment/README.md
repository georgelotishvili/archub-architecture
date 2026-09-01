# Archub production deployment helpers

These scripts are intentionally server-side and fixed to the current cPanel
layout:

- application: `/home/archubge/public_html/archub`
- virtualenv: `/home/archubge/virtualenv/public_html/archub/3.11`
- domain document root: `/home/archubge/public_html/archub.ge`
- private backups: `/home/archubge/backups`

They refuse to run as a user other than `archubge`, use a non-blocking atomic
`flock`, set a private umask, never print `.env` values, and never use Alembic
`stamp`.

## Files

- `preflight_backup.sh`: backup and inspection only; never deploys.
- `deploy.sh`: one-shot backup, validation, dependency installation, safe code
  overlay, migration upgrade, Passenger restart, and live status checks.
- `common.sh`: fixed paths, lock, and backup primitives.
- `preflight_helper.py`: online SQLite backup, JSON schema/count/integrity
  report, read-only upload audit, and health JSON validation.
- `sync_tree.py`: validated, fully staged, no-delete code overlay with atomic
  per-file replacements and protected runtime paths.

Use LF line endings on the server and make the entry points executable:

```bash
chmod 700 deployment/preflight_backup.sh deployment/deploy.sh
chmod 600 deployment/common.sh deployment/preflight_helper.py deployment/sync_tree.py
```

## Preflight only

```bash
cd /home/archubge/public_html/archub
bash deployment/preflight_backup.sh
```

The script prints `BACKUP_DIR` and `PREFLIGHT_REPORT`. The backup directory is
mode `0700`; individual files are mode `0600`. It contains:

- `database.db`: SQLite online-backup snapshot, not an unsafe live file copy;
- `preflight-report.json`: integrity, foreign-key violations, legacy
  `photo`/`project_likes` orphan checks, case-insensitive duplicate user-email
  checks, Alembic revision, table schemas/indexes/counts, and upload audit;
- `code.tar.gz` and `uploads.tar.gz`;
- `.env` and the domain `.htaccess`;
- `pip-freeze.txt` and `SHA256SUMS`.

Inspect the report without exposing `.env`:

```bash
/home/archubge/virtualenv/public_html/archub/3.11/bin/python \
  -m json.tool /home/archubge/backups/archub-deploy-REPLACE/preflight-report.json
```

The upload audit never converts or edits files. Readable extension/content
format mismatches are warnings and do not stop deployment because the current
application deliberately keeps `nosniff` disabled for legacy upload URLs.
Deployment fails closed only when a database-referenced upload is missing,
unreadable/corrupt, symlinked, or has an invalid stored path.
Database preflight also fails closed when SQLite reports a foreign-key
violation, when legacy `photo`/`project_likes` rows reference missing parents,
or when more than one user email has the same `lower(email)` value. Details and
counts are recorded only in the private preflight report.

## One-shot deployment

Upload/extract a complete release tree to a private staging directory under
`/home/archubge`, then run:

```bash
ARCHUB_RELEASE=/home/archubge/releases/archub-REPLACE
bash "$ARCHUB_RELEASE/deployment/deploy.sh" --source "$ARCHUB_RELEASE"
```

The deploy entry point must be the copy inside that exact release directory;
the script rejects execution from the live application tree.

The deploy script performs, under one lock:

1. Complete preflight backup and JSON audit.
2. Release compile check.
3. `pip install -r requirements.txt` and `pip check` in the fixed virtualenv.
4. Copy the sync helper into the checksummed private backup, fully stage and
   validate the release, then replace code atomically per file. The overlay
   never deletes destination entries and always preserves `.env`, SQLite DB,
   uploads, logs, temp files, virtualenv, and `.htaccess`.
5. Live compile check.
6. `flask db upgrade`, followed by `flask db check` and `flask db current`.
7. Passenger `tmp/restart.txt` marker.
8. HTTPS `/healthz` JSON and homepage HTTP 200 checks.

Any failed step exits non-zero and prints the backup directory. Never bypass a
migration failure with `flask db stamp`.
After dependency mutation begins, a failed deploy verifies the backup and
attempts to restore the prior code and pinned package versions. Passenger is
restarted only when the old code is restored and compiles. Newly introduced
packages and files may remain installed but unused because automated deletion
is deliberately disabled. Review failed-release-only files manually. The
database is deliberately never restored automatically; the consistent SQLite
snapshot is kept for review.

## Manual rollback

Failed deployments automatically attempt a verified code/dependency rollback.
Database rollback is intentionally manual because a migration may not be safely
reversible. If the automatic rollback is incomplete or the database must be
restored, freeze site writes first and use the exact `BACKUP_DIR` printed by the failed
deployment. Do not use `flask db downgrade`; restore the consistent DB snapshot.

1. Acquire the same deployment lock in a dedicated terminal and keep that
   terminal open for the entire rollback:

   ```bash
   exec 9>/home/archubge/.archub-deploy.lock
   flock -n 9 || exit 1
   ```

2. Verify the private backup before using it:

   ```bash
   cd /home/archubge/backups/archub-deploy-REPLACE
   sha256sum --check SHA256SUMS
   ```

3. Restore code without deleting runtime data:

   ```bash
   ARCHUB_ROLLBACK_STAGE=$(mktemp -d /home/archubge/rollback-stage.XXXXXX)
   tar -xzf code.tar.gz -C "$ARCHUB_ROLLBACK_STAGE"
   /home/archubge/virtualenv/public_html/archub/3.11/bin/python \
     ./sync_tree.py \
     --source "$ARCHUB_ROLLBACK_STAGE" \
     --destination /home/archubge/public_html/archub \
     --home-root /home/archubge
   ```

   The helper protects private/runtime data and never deletes destination
   entries. Files introduced only by a failed release remain until they are
   identified from the release manifest and reviewed manually.

4. Restore private configuration and the recorded Python package versions.
   Packages introduced only by the failed deployment may remain installed:

   ```bash
   install -m 600 .env /home/archubge/public_html/archub/.env
   install -m 644 .htaccess /home/archubge/public_html/archub.ge/.htaccess
   /home/archubge/virtualenv/public_html/archub/3.11/bin/python \
     -m pip install --no-input -r pip-freeze.txt
   /home/archubge/virtualenv/public_html/archub/3.11/bin/python -m pip check
   ```

5. With writes still frozen, restore SQLite atomically from the verified closed
   backup file, preserving the failed DB for diagnosis:

   ```bash
   cd /home/archubge/public_html/archub
   cp -p database.db "/home/archubge/backups/failed-database-$(date -u +%Y%m%dT%H%M%SZ).db"
   install -m 600 /home/archubge/backups/archub-deploy-REPLACE/database.db database.db.rollback-new
   /home/archubge/virtualenv/public_html/archub/3.11/bin/python - <<'PY'
   import sqlite3
   connection = sqlite3.connect('file:database.db.rollback-new?mode=ro', uri=True)
   assert connection.execute('PRAGMA integrity_check').fetchone() == ('ok',)
   assert list(connection.execute('PRAGMA foreign_key_check')) == []
   connection.close()
   PY
   mv -f database.db.rollback-new database.db
   ```

6. Restore uploads only if they were independently changed after the backup:

   ```bash
   tar -xzf /home/archubge/backups/archub-deploy-REPLACE/uploads.tar.gz \
     -C /home/archubge/public_html/archub/static
   ```

7. Restart Passenger, release maintenance, and verify health:

   ```bash
   touch /home/archubge/public_html/archub/tmp/restart.txt
   curl --fail --silent --show-error https://archub.ge/healthz
   curl --fail --silent --show-error --output /dev/null https://archub.ge/
   ```

Remove the rollback staging directory only after the site and data have been
verified. Keep the backup until a later retention decision.
