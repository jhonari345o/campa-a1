# Customer workspaces

Client branding comes from `companies.brand_key`, resolved on the server through the authenticated membership. It is presentation only; email domains and URL parameters never grant access. Platform administrators retain the Ad Mavericks identity. A multi-company account receives the neutral identity until an explicit workspace selector is implemented.

Supported initial roles: `planner` (plan, save, request coordination) and `viewer` (read). Neither can approve orders, manage users or become a platform administrator through customer provisioning. The planning flow sends non-approvers to review instead of offering approval.

## Deployment order

1. Back up and apply `supabase/migrations/0017_customer_workspaces.sql` to the intended project, after migrations through 0016. This is transactional and rerunnable. Do not mark production validated based only on an offline test.
2. Run allow/deny checks with synthetic non-admin accounts in that environment: own plan read/save/request; other-company data read/write; approval denial; user-management denial; suspended-company denial. Confirm existing platform-admin operations and approved-order processing still work. Do not use real client content as test fixtures.
3. Deploy this application revision. The console checks the version RPC and blocks customer credential creation if the migration is absent. Existing workspaces have a compatibility read path while `brand_key` is absent.
4. Create the customer company and select the intended brand. Then provision its user from **Agregar usuario a una empresa**, after reviewing company, email and role. An existing Auth email is rejected, never overwritten or reset.
5. Deliver the generated password through an approved secure channel. No email/invitation is sent automatically. The customer completes their own legal acceptance. Never accept terms on their behalf.

Auth user creation and the database transaction are separate. The service-only provisioning function atomically validates the administrator, locks company seats, and writes profile, membership and audit. On failure the server attempts deletion of the newly created Auth user, then bans it if deletion fails; it does not display the credential. Investigate failed cleanup in Auth before retrying. A password-change/expiry flow remains a separate improvement; no forced rotation is claimed here.

## Validation

- `npm test`: includes membership-derived branding and customer input/role validation.
- `npm run build`: production compilation, lint and TypeScript.
- `scripts/test-customer-rls.mjs`: isolated PostgreSQL/PGlite tests with synthetic users. Install `@electric-sql/pglite` in a separate tools directory, set `PGLITE_MODULE` to its `dist/index.js`, then run the script with Node. Auth is stubbed and `citext` is represented as `text`; this is not an end-to-end Supabase Auth or production RLS audit.
- Compare desktop and mobile views, including planner CTA visibility above Mavi.

Léttera uses the existing approved source logo in `public/partners/lettera/` and charcoal/beige references from https://lettera.ec/. No official Léttera brand manual or Visby font license was available; the established application font is retained. Client records, credentials and commercial reports must not be committed to the repository.
