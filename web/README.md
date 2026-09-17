# React application

First implementation slice: general plan creation, task creation and completion. The full approved prototype remains the product reference; routine scheduling, execution tracking, thoughts, reflections, archive and review have not been ported yet.

## Development

Run in web/: npm ci, npm run dev.
Checks: npm run typecheck, npm test, npm run build, node scripts/smoke.mjs (after build).

## Supabase connection

Create a new Supabase project under the user's account. In its SQL Editor, apply supabase/migrations/0001_core.sql once to the new database. This is the first-slice schema, not the complete DATA-CONTRACT-v1 implementation.

Copy .env.example to .env.local locally. Set SUPABASE_URL and SUPABASE_SECRET_KEY from the project's API configuration. Keep the secret server-side; never use a NEXT_PUBLIC prefix or commit actual values. DATABASE_URL is reserved for later migration tooling and is not read by this app.

Restart the app and verify plan creation, task creation, completion, refresh persistence and stale revision handling against that project. Remote migration and these connected checks have not been performed yet. Vercel is not connected.

## Current behavior and limitations

The database is authoritative. Requests use a UUID receipt and expected revision within one transaction. Network-uncertain retries retain the same request; conflicts require a refresh and preserve the current form. Draft retention is currently in memory only, not across browser reloads. Missing storage configuration produces an explicit unavailable state, never a fake successful save.

The public single diary intentionally has no app login in T06. Server-only RPC credentials do not introduce end-user ownership: anyone able to reach the app can use its write API. Supabase anon/authenticated roles cannot directly access these tables or RPCs. The seed UUID identifies this one shared diary.

Tests execute the migration in local PGlite PostgreSQL; they do not prove remote Supabase deployment or multi-connection performance. Browser visual and mobile checks remain outstanding.
