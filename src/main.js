// src/main.js
// App bootstrap: seed data, populate initial dropdowns, render home.

// ════════ INIT ════════
seedData();
populateSchGroups();
populateDates('sch-date');
populateDates('rsch-date');
// renderHome() removed — page renders only after config + data snapshots resolve (appReady flag)
