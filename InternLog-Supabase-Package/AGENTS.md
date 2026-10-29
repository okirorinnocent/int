## Project rules
- InternAI calls live in `src/lib/ai/internai.server.ts` behind the `askInternAI` server function; keep prompts and the API key server-side.
- Role and logbook state currently live in `src/lib/store.tsx` (browser storage) until accounts and a database are added; keep UI reading through `useApp()` so storage can be swapped.
