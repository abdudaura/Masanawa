# Railway project graph

This directory is the source-controlled application-service graph for Masanawa.

The PostgreSQL service is intentionally bootstrapped by `scripts/railway/rebuild-production.sh` before this graph is applied because a fresh database password must be generated at deployment time and must never be committed to Git.

Expected database service name: `masanawa-db`.

The graph then creates/reconciles:
- `masanawa-gateway`
- `masanawa-worker`
- `masanawa-ops`

All services deploy from `Baatiku/masanawa@main` and consume the database through the Railway reference `${{ masanawa-db.DATABASE_URL }}`.

Temporary billing, call/APK-builder, and legacy ChatWithStars dashboard deployments are deliberately excluded until their true main-branch Masanawa service entrypoints are complete. They must not be fossilized into the portable platform definition.

Use:
```bash
railway config plan
railway config apply
```

For a new account/project, use the GitHub **Rebuild Railway Production** workflow rather than applying this file directly.
