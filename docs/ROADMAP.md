# Next implementation milestones

## 1. Verify the initial app on a real phone

Install a compatible Expo client or build with EAS. Verify keyboard use, screen reader labels, tap targets, persistence across restart, foreground/background behaviour and small-screen layouts. Run Supabase SQL and verify two test users cannot read each other's backups. Test sign-up confirmation, token expiry, sign-out, restore and live AI extraction with non-sensitive examples.

## 2. Google integration

Create a Google OAuth application with correct iOS/Android redirect configuration. Start with minimum read scopes for Calendar and selected Gmail content; do not request Gmail sending permission. Exchange and refresh provider tokens server-side and encrypt them at rest. Implement revoke/disconnect and deletion. Support Google consent/verification requirements before wider distribution.

Gmail should produce reviewable tasks with stable source message IDs, deduplication, no automatic replies and untrusted-source handling. Calendar should first import fixed events with provider IDs, all-day/recurrence handling, IANA timezone conversion, updates/deletions and incremental sync. Only then add an explicit “Export approved plan” action with a change preview, idempotency and conflict checks.

## 3. Wellpass fitness planning

Confirm whether EGYM partner access covers the specific user-facing discovery/booking use case. Do not equate available studio/vendor integrations with member API access. Until an approved API path exists, keep fitness tasks manual; add recurring fitness goals and optional venue/travel duration fields without claiming live availability.

## 4. Scheduling quality and release

Add recurring work hours, protected meals/free time, energy/daypart preferences, chunkable tasks and an undo/history model. Handle timezone travel explicitly. Move from manual backups to versioned cloud records with conflict-aware sync and account isolation. Add secure persistent sessions, account deletion, reminders and device-level tests before beta distribution.
