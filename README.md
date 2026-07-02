# Padel Summer League — GO PARK x The One

## Structure

```
padel-league/
├── index.html              Entry point — links everything below
├── css/
│   └── styles.css          All styling (extracted from the original single-file build)
├── src/
│   ├── state.js            Global state object, ID/claim-code generators, lookup helpers
│   ├── scoring.js          Score-result calc, set-score validation, standings/tiebreakers
│   ├── router.js           Page routing, rules sub-nav, group-tab helper
│   ├── roundrobin.js       Round-robin fixture generation (circle method)
│   ├── seed-data.js        Demo data: real team entrants, generated fixtures
│   ├── identity.js         Netlify Identity, admin/captain/viewer roles, local dev-mode
│   ├── utils.js            Activity log + toast notifications
│   ├── main.js             Bootstrap — runs last, calls seedData()/renderHome() etc.
│   ├── render/             One file per page: home, standings, matches, schedule,
│   │                       teams, submit, knockout
│   └── actions/            Click-handler logic grouped by feature: modals, score
│                           submission/confirmation/disputes, slot claiming, roster editing
└── package.json
```

## Why classic scripts, not ES modules (yet)

Every file loads as a plain `<script src="...">`, same as the original single-file version —
every function stays in global scope, so every `onclick="..."` attribute in the HTML keeps
working with zero changes. Load order in `index.html` matters: each file loads after anything
it calls, with `src/main.js` last since it's the only file that calls functions immediately
rather than in response to a click.

ES modules + a bundler (Vite) are the right move once the Firestore backend work starts — the
Firestore SDK genuinely benefits from real imports and tree-shaking. Doing that conversion in
the same pass as this structural split would have multiplied the risk of breaking something
for a change that was specifically about file organization, not behavior.

## Running locally

No build step required yet — it's static HTML/CSS/JS.

```bash
npm run dev
```

Or just open `index.html` directly in a browser (triggers local dev-mode auth bypass, see
`src/identity.js`).

## Known limitations (carried over from the original build, not introduced by this restructure)

- **No backend.** All state lives in the in-memory `S` object in `src/state.js`. Refreshing
  the page resets everything to the seed data in `src/seed-data.js`. This is the actual blocker
  for real deployment — see the Firestore discussion in chat history for the migration plan.
- **All permission checks (`canWrite()`, `canActOnMatch()`, `isAdminUser()`, etc. in
  `src/identity.js`) are client-side only.** They're a UX layer, not security — anyone with
  browser devtools can bypass them by editing `window` state directly. Firestore Security
  Rules are what would make these checks actually enforced.
