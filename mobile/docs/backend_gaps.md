# Backend gaps affecting the mobile app

Found while mapping the Flutter app's screens to real endpoints (see the
milestone report for full context). None of these were worked around with
invented endpoints or fake data — the affected screens are placeholders
instead. Listed here so whoever picks up the backend knows what mobile
needs next.

1. **No notifications API.** `backend/app/services/notifications/` is
   outbound-only (email/Slack/webhook from the scan pipeline). There is no
   `GET /notifications`, no unread count, no mark-as-read, and no device
   push-token registration endpoint. The Notifications screen can only ever
   show local, in-app events until this exists.
2. **No logout/token-revocation endpoint.** Refresh tokens are stateless
   JWTs that simply expire (7 days by default) — logging out is
   local-only (discard both tokens). No remote "sign out this device"
   is possible.
3. **No password-reset flow.** No `POST /auth/forgot-password` /
   `reset-password`.
4. **No single-repository fetch, create, or delete.** Only
   `GET /repositories` (list) and `PATCH /repositories/{id}/scheduled-scan`
   exist — a `Repository` row is only ever created as a side effect of
   `POST /scan` or `POST /scan/repository`. The Repository Details screen
   works around this by looking the repo up client-side out of the list
   response.
5. **No self-service profile update.** No endpoint for a user to change
   their own name/password. Only admin-driven
   `PATCH /auth/admin/users/{id}/role|active` on *other* users exists.
6. **No cross-scan findings or compliance view.** `GET /scan/{id}/findings`
   and `GET /scan/{id}/compliance` are scoped to one scan job — there's no
   "all findings across my repositories" or "portfolio compliance" rollup.
   Finding Explorer and Compliance are placeholders for this reason.
7. **No dedicated risk-trend / org risk-posture endpoint.** BRS numbers ride
   along on `ScanJob` (per scan) and `MyActivitySummary`/
   `TeamActivitySummary` (`averageBrsScore`). A real Risk Dashboard needs
   either a new endpoint or a client-side composition strategy — deferred.
8. **SAML SSO routes are non-functional placeholders** (`/auth/sso/saml/*`
   both return 503). Don't build against them.
9. **WebSocket auth is a `?token=` query param**, not an `Authorization`
   header (`/scan/{id}/ws`). Easy to get wrong porting the REST client's
   header-based pattern — flagged for whoever wires up live scan progress.
