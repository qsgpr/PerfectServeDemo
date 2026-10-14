# Shiftline

A React Native and TypeScript care-team communication prototype built with Expo SDK 57. It runs on iOS, Android, and web. Supabase supports shared accounts and persistent conversations; local mode works without a backend.

## Features

- Skippable welcome tour for new registrations, with replay from Settings.
- Email password recovery and a dedicated reset-password screen.
- Responsive navigation: a sidebar on desktop browsers and bottom tabs on mobile.
- Searchable contacts and direct or department-based messaging.
- Monthly on-call calendar with local AM/PM times, completed-shift filtering, and grouping of matching assignments across departments.
- Text and photo conversations, typing indicators, read receipts, and priority.
- Persisted availability, quiet hours, backup routing, and shared shift handoffs.
- Nova AI replies with account/schedule context, image analysis, a visible recent-message window, and reviewed handoff drafts.
- Resolved conversation archives and fresh-chat resets.

## Run locally

Use Node.js 22.13 or newer and npm.

```sh
npm ci
npm start
# Browser preview
npm run web
# Expo Go on a phone connected to the same network
npm run phone
```

Without Supabase variables, the login screen offers a fictional sample account. All fixture names, messages, and schedules are fictional. The October 2026 schedule stores UTC timestamps, follows real time, and displays dates and times in the viewer's local timezone. It shows no coverage outside the seeded range.

## Shared accounts with Supabase

Copy `.env.example` to `.env.local` and set the Supabase URL and publishable key. Restart Expo after changing environment variables. Apply the SQL files in `supabase/migrations/` in filename order, then `supabase/seeds/october-2026.sql` and `supabase/seeds/department-coverage.sql` to seed fictional coverage. These files are already applied on the original development server.

Create two accounts and sign in on separate devices or browser profiles to try shared messaging. Conversation access is limited to participants; handoffs are limited to their sender and selected incoming account. New accounts are not automatically assigned shifts; regenerate the department seed deliberately after roster changes.

## Optional Nova server

Nova uses a separate Node service with Kimi credentials. Keep its environment file outside the repository. Set `MOONSHOT_API_KEY` there, then start the service:

```sh
node --env-file=/absolute/path/to/private-ai.env server/index.mjs
```

The service listens on port 8082. The app uses the Expo/browser host by default; set `EXPO_PUBLIC_AI_BASE_URL` if the phone needs a different reachable address. The AI server currently allows the original development hosts and browser port 8081; adjust `allowedHosts` in `server/index.mjs` for another development machine. AI failures retain the conversation and offer retry.

Nova can read the built-in fictional handoff board and team map, plus JPEG, PNG, and WebP photos shared in its conversation. It sends the last three user images within the recent-message context to Kimi K2.6; `MOONSHOT_VISION_MODEL` can override the vision model on the server. Image analysis allows 4 MB per photo and 8 MB total per request. Device photos are fetched through the signed-in user's Supabase permissions and checked against the saved conversation. Arbitrary URLs are not fetched. PDFs and other document attachments are not supported. Use fictional coordination images; visual summaries can contain errors and need review.

## Checks

```sh
npm run typecheck
npm run lint
npm test
# Isolated local-mode browser tests
SHIFTLINE_LOCAL_E2E=1 SHIFTLINE_E2E_URL=http://localhost:8083 npm run test:e2e
```

Cloud browser tests require disposable QA accounts via `SHIFTLINE_CLOUD_QA_FILE` and skip otherwise. Rollback-only SQL checks are in `supabase/tests/`.

## Project layout

- `src/app/`: Expo Router routes and navigation.
- `src/features/`: screens and feature-specific components.
- `src/components/`: shared controls and layouts.
- `src/domain/`: types and pure rules.
- `src/data/`: fixtures, local persistence, and cloud adapters.
- `src/state/`: shared providers and lifecycle hooks.
- `server/`: private AI-provider integration.
- `supabase/`: migrations, seeds, and access tests.
- `tests/`: unit and browser checks.

## Scope and branding

Voice/video controls simulate calls. Background push requires a signed native build and Apple/Android credentials; Expo Go is not the completed background-delivery setup. Snapshot fetching is not server pagination, and AI context is read-only. This prototype has no EHR integration and makes no HIPAA-compliance claim. Use fictional data and non-patient images.

This is an unofficial prototype, not a PerfectServe product. Referenced branding is documented in [asset attribution](assets/ATTRIBUTION.md); it is not covered by the code license. `app.json` includes the original EAS owner/project and app identifiers; configure your own before creating independent builds.
