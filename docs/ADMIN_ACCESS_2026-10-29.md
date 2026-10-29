# Administrative connection verification — October 29, 2026

User reported completing browser OAuth for Supabase and Vercel. Verification used metadata-only, read-only calls; no database objects, records, authentication settings or deployments were changed.

## Supabase: verified tool access

The native Supabase MCP tools are exposed and actual calls succeeded against the expected RoleAide project, `qxhkrepvoqnsxcofarno`.

- Project API URL returned the expected project.
- Table listing recognized `public.resumes` and `private.service_usage`, with row-level security enabled on both.
- A catalog query confirmed `public.consume_service_quota(text)` exists and four policies are registered for `public.resumes`.
- Migration history listing returned an empty list. Schema objects nevertheless exist after the owner's SQL Editor execution. Do not rerun the non-idempotent migration simply to populate history.

This verifies the administrative connection's read access. Mutating permissions were not exercised. Actual email delivery, authenticated CRUD/isolation, provider flows and deployed acceptance are separate checks.

## Vercel: OAuth reported complete, tool access unverified

No Vercel tools are exposed in this session, so no project/deployment listing was possible. Do not claim administrative access based only on the successful browser message.

The bundled CLI's presence-only MCP listing still reports authentication status `unknown` for both servers. Since actual Supabase calls work, that field alone is not a reliable verdict on connection health.

## Change boundary

Notify Victor before major database, authentication, security, production configuration or deployment changes, explaining scope, impact and recovery. Read-only verification is not authorization to change critical layers. See `AGENTS.md`.
