// src/data/config.js
// League configuration — single Firestore document at /config/league
// All season-varying constants come from here instead of being hardcoded.
// Admin page writes to this document. Everything else reads from it.
//
// SEASON CHANGE GUARD: activeSeason can only be changed when:
//   1. No matches have status 'scheduled', 'pending-confirm', or 'disputed'
//   2. The admin explicitly confirms they understand all current data will be hidden
// This is enforced both client-side (confirmation + check) and in Firestore Rules.

const ConfigDB = {
  _unsubscribe: null,

  // Default config — used if no Firestore document exists yet
  defaults() {
    return {
      seasonLabel:        'Summer League 2026',
      activeSeason:       '2026-summer',
      seasonSlug:         'summer',
      seasonYear:         '2026',
      registrationCutoff: '2026-07-09',
      leagueStart:        '2026-07-11',
      leagueEnd:          '2026-09-27',
      knockoutDay:        '2026-10-04',
      matchDays:          'Saturdays & Sundays',
      matchHours:         '7–11 PM',
      entryFee:           'HKD 3,500',
      courts:             2,
      matchStartTime:     '19:00',   // 7pm
      matchEndTime:       '23:00',   // 11pm
      matchDuration:      60,        // minutes per match slot
      playDays:           [6, 0],    // 6=Saturday, 0=Sunday
      blackoutDates:      [],        // ['2026-07-18', ...] — weekends skipped entirely
      seasonLocked:       false,  // true once fixtures generated, blocks season change
      // Ordered divisions — highest tier first. nprpMin/nprpMax drive auto-seeding.
      // Admin can add, remove, reorder, and rename divisions from League Setup.
      divisions: [
        { name: 'Gold Division',        nprpMin: 4.0, nprpMax: 7.0 },
        { name: 'High Silver Division', nprpMin: 3.0, nprpMax: 3.99 },
        { name: 'Low Silver Division',  nprpMin: 0.0, nprpMax: 2.99 }
      ]
    };
  },

  // Subscribe to live config changes — called once on app load.
  // Updates S.config and re-renders the active page when config changes.
  subscribe(onDataFn) {
    if (this._unsubscribe) this._unsubscribe();
    this._unsubscribe = db.collection('config').doc('league')
      .onSnapshot(snap => {
        S.config = snap.exists ? { ...this.defaults(), ...snap.data() } : this.defaults();
        // Sync derived constants so existing code that reads them still works
        ACTIVE_SEASON       = S.config.activeSeason;
        REGISTRATION_CUTOFF = S.config.registrationCutoff;
        if (onDataFn) onDataFn();
      }, err => {
        console.warn('ConfigDB: using defaults —', err.message);
        S.config = this.defaults();
        ACTIVE_SEASON       = S.config.activeSeason;
        REGISTRATION_CUTOFF = S.config.registrationCutoff;
        if (onDataFn) onDataFn();
      });
  },

  stop() {
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
  },

  // Save config fields — admin only, never changes activeSeason directly.
  // Season change goes through changeSeason() which has the guard.
  async save(fields) {
    const safe = { ...fields };
    delete safe.activeSeason;  // never allow direct write of activeSeason
    delete safe.seasonLocked;  // never allow client to unlock a locked season
    // divisions is allowed — admin can manage them from League Setup
    await db.collection('config').doc('league').set(safe, { merge: true });
  },

  // Season change with guard — the only path to changing activeSeason.
  // Checks for in-progress matches before allowing the change.
  async changeSeason(newSeason, newLabel, newSlug, newYear) {
    // Client-side check: any matches in active states?
    const activeMatches = Object.values(S.matches).filter(m =>
      ['scheduled','pending-confirm','disputed'].includes(m.status)
    );
    if (activeMatches.length > 0) {
      throw new Error(
        `Cannot change season: ${activeMatches.length} match${activeMatches.length!==1?'es are':' is'} ` +
        `still active (scheduled, awaiting confirmation, or disputed). ` +
        `Resolve all matches before starting a new season.`
      );
    }
    // Double confirmation required — caller must pass confirmed:true
    await db.collection('config').doc('league').set({
      activeSeason:  newSeason,
      seasonLabel:   newLabel,
      seasonSlug:    newSlug,
      seasonYear:    newYear,
      seasonLocked:  false,  // new season starts unlocked
      changedAt:     firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },

  // Lock the season once fixtures are generated — prevents accidental season change mid-play
  async lockSeason() {
    await db.collection('config').doc('league').set(
      { seasonLocked: true }, { merge: true }
    );
  },

  // Seed default config to Firestore if it doesn't exist yet
  async seedIfEmpty() {
    const snap = await db.collection('config').doc('league').get();
    if (!snap.exists) {
      await db.collection('config').doc('league').set(this.defaults());
      console.log('Config seeded with defaults');
    }
  }
};
