# InternLog

InternLog is an internship management workspace for students, workplace supervisors, academic supervisors and administrators. It includes a digital logbook, review workflow, InternAI writing assistant, internship vacancy browser, profile management and a progress dashboard.

## What's improved in this rewrite

- Refreshed the dashboard into a modern SaaS workspace with a clear hierarchy, responsive metric cards, weekly hours chart, placement milestones, recent logbook activity and quick actions.
- Refined the visual system with a calmer blue palette, more consistent spacing, clearer typography, interactive hover states and improved keyboard focus visibility.
- Kept the existing route structure and reusable UI components so the logbook, InternAI, vacancy, profile and account workflows remain connected.
- Dashboard figures for an administrator include illustrative sample totals where the current app does not yet have a connected university-wide data source. Treat these as demo figures, not live institutional reporting.

## Requirements

- Node.js 20 or later (Node.js 22 recommended)
- npm
- Optional: Supabase project credentials and an OpenAI-compatible API key for connected authentication / AI functionality

## Run locally

1. Extract the ZIP.
2. Open a terminal in the project directory (the folder containing `package.json`).
3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env` and fill in only the services you intend to use. Never commit `.env` or real API keys.
5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open the local URL printed by Vite in your terminal.

## Quality checks

Run these after dependencies have been installed:

```bash
npm run build
npm test
npm run lint
```

## Important deployment notes

- Without Supabase configuration, the app uses browser-local demo state. It is useful for evaluation, but it is not a shared multi-user database.
- Do not use real student records in a public deployment until server-side authorization, secure session handling, data access policies, and production authentication have been reviewed.
- Configure the AI provider before relying on InternAI. AI-generated wording should always be checked against the student's actual work.
- Some vacancy and administrator totals are demo content and should be connected to a trusted backend before production use.
