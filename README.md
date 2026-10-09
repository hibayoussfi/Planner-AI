# Planner AI

A phone-first weekly planner built with Expo, React Native and TypeScript. Make space for work, personal priorities and fitness without moving fixed appointments.

**Version 0.1 is an initial implementation, not an App Store release.** Local planning works without accounts or API keys. AI extraction and cloud backups require your own backend/Supabase configuration. Gmail, Google Calendar and direct EGYM Wellpass integration are not implemented yet.

## Run on your phone

Install Node.js 24 LTS and Git, then in PowerShell or a terminal:

```sh
git clone https://github.com/hibayoussfi/Planner-AI.git
cd Planner-AI
npm ci
npm start
```

Open the project with an Expo Go version that supports **Expo SDK 57**. On iPhone, scan the terminal QR code with Camera; on Android, use Expo Go. Keep the phone and computer on the same network. If Expo Go reports an SDK mismatch, use a compatible client or an EAS development/preview build. This repository does not include an already signed app.

For a browser preview, run `npm run web`. Browser support is for convenient testing; the UI is built from React Native components for iOS and Android.

If PowerShell blocks `npm.ps1`, use `npm.cmd ci` and `npm.cmd start` (no execution-policy changes needed).

## Try the first version

1. **Tasks:** add work, personal or fitness tasks, duration, priority and optional deadline. Edit, complete, reopen or delete them.
2. **Week:** add fixed appointments, including work hours, lunch or travel that must stay free of flexible tasks.
3. **Settings:** choose planning hours, flexible-task budget, buffer and whether to use weekends.
4. **Week → Generate weekly proposal:** review scheduled tasks and explanations for tasks that do not fit. Apply or discard the proposal.
5. **Today:** view the approved agenda and mark planned tasks complete.

Everything starts empty; no personal events or fabricated account connections are seeded. Plans and tasks survive app restarts using local storage.

### Scheduling rules

- Dates are local `YYYY-MM-DD` values; times are wall-clock minutes in the **device timezone**.
- Fixed appointments never move. Existing fixed overlaps are flagged.
- Incomplete tasks are ordered by earliest deadline, then higher priority. Tasks are placed in 15-minute increments, without splitting.
- Tasks must fit before the deadline (end of that local day), within planning hours, with the chosen buffers and daily flexible-task budget.
- Past times and disabled weekends are skipped. At most one fitness task is placed per day.
- Tasks already approved in another current/future week are excluded. An overdue incomplete task can be replanned, replacing its old block when approved.
- Applying a proposal replaces flexible blocks for the selected week. Other weeks and fixed events remain. Input changes invalidate an open proposal.
- This first scheduler uses deterministic rules, **not an LLM**. AI extracts task drafts; it does not control your calendar.

## Optional AI and accounts

### 1. Configure Supabase

Create your own Supabase project and run `database/001_backups.sql` once in its SQL editor. It enables row-level security so signed-in users can access only their own backups. Keep email confirmation enabled for public use.

Copy `.env.example` to `.env` and fill in:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:8787
```

The public Supabase key is designed to be included in the app; RLS protects data. **Never put a Supabase service-role key or OpenAI API key in an `EXPO_PUBLIC_` variable.** Restart Expo after changing environment variables.

Use Settings to create an account, confirm email if required, and sign in. Sessions stay in memory in this initial release, so sign in again after restarting. Signing out leaves local tasks on the device. Password reset, persistent secure sessions and account deletion UI remain future work.

### 2. Configure the Node backend

Copy `server/.env.example` to `server/.env`, then fill in the server-side OpenAI API key, a model supporting Responses API structured outputs, and the same Supabase project URL/public key. No specific model is hardcoded.

For a physical phone on a trusted LAN set `HOST=0.0.0.0`; the default binds to localhost. Use HTTPS for any hosted backend. Set `ALLOWED_ORIGINS` to exact browser origins you use, comma-separated. Native requests have no browser Origin header but still require valid authentication.

```sh
npm run server
```

Check `http://localhost:8787/health`. `aiConfigured` reports whether required variables are present, not whether credentials were verified.

In **AI**, paste notes or email text. Tapping “Send text to AI” explicitly sends that text to the backend and OpenAI. The server validates the Supabase session, requests structured task drafts with `store: false`, validates the result, and returns drafts for review. Edit the title, duration or deadline before approving each task. Category and priority can be changed in Tasks. Nothing is automatically scheduled, emailed or booked.

### 3. Manual cloud backup

Settings offers **Save a cloud backup** and **Restore latest backup**. Each save creates a new snapshot and preserves older ones. Restore requires explicit confirmation and replaces local planner data. This is not live sync or a merge system. Backups follow the timezone/wall-clock limitations below. Account owners can delete their backups through Supabase; cloud deletion UI is not included yet.

## Integration status

| Capability | v0.1 |
| --- | --- |
| Native iOS/Android UI and browser preview | Implemented; physical device testing still required |
| Tasks, fixed appointments, Today/Week views | Implemented |
| Weekly proposal, buffers, limits, approve/discard | Implemented |
| Local persistence | Implemented |
| Supabase email/password auth and private manual backups | Implemented; requires project setup and live verification |
| OpenAI task extraction from notes/pasted email | Implemented; requires server credentials and live verification |
| Gmail inbox reading | Not implemented; OAuth and consent flow needed |
| Google Calendar read/write | Not implemented; event IDs, sync and approval flow needed |
| EGYM Wellpass | Manual fitness tasks only; no login, scraping or bookings |
| Push reminders, background replanning, App Store release | Not implemented |

Wellpass's official developer material describes partner integrations, not unrestricted access to a member's weekly activity. Partner access and the relevant booking API must be established before a direct connection can be promised. Until then, enter fitness tasks and book separately in Wellpass.

## Development and verification

```sh
npm run check       # TypeScript, Expo ESLint, scheduler + mocked backend tests
npm run build:web   # Production browser bundle
npx expo export --platform ios --platform android
```

GitHub Actions runs checks and a browser export on pushes/PRs. Tests cover overlaps, buffers, deadlines, overload, past slots, weekends, fitness spacing, calendar boundaries, corrupt state, token enforcement, input/output validation, refusal handling and rate limiting. Backend tests mock Supabase/OpenAI: passing tests do not claim that live accounts are connected.

`eas.json` provides preview/production build profiles. A native binary requires your Expo account, project configuration and signing credentials; iOS distribution requires Apple's applicable setup. No deployment or store submission is performed by this repository.

## Structure

```text
src/app/          Expo Router screens
src/components/   Shared mobile UI
src/core/         Pure scheduling, validation and state format
src/state/        Local persistence and optional cloud/API client
server/           Authenticated Node HTTP API and AI task extraction
database/         Supabase backup table with RLS
tests/            Scheduler and backend tests
docs/             Architecture and next implementation steps
```

## Known limits before production

The local data store is not encrypted by this app. Do not treat v0.1 as a secure inbox vault. Source email text is never saved in planner state, but approved task titles can contain private information. Provider retention rules still apply despite `store: false`.

Wall-clock schedules do not convert when you travel to another timezone. Overnight events, recurring appointments, multi-day tasks and ambiguous/repeated DST hours need a richer event model before calendar sync. The scheduler is a first-fit algorithm, not a global optimiser; it can report unscheduled work even if a more complex arrangement exists. Fitness sessions may be scheduled at any time within planning hours; location, opening hours, travel and class availability are not queried.

The API limit is 20 extraction requests per user per hour **per server process**. Production needs a shared rate limiter, ingress/body/time limits, account abuse controls, monitoring without private-text logging and provider spend limits. Authentication and database policies must be exercised against the configured Supabase project before release.

## Official references

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Supabase React Native authentication](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [EGYM developer portal and partner paths](https://developer.egym.com/)
