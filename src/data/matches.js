// src/data/matches.js
// Firestore data layer for matches.
// Exposes: MatchesDB.subscribe(), MatchesDB.save(), MatchesDB.update()

const MatchesDB = {
  _unsubscribe: null,

  subscribe(onDataFn) {
    if (this._unsubscribe) this._unsubscribe();
    this._unsubscribe = db.collection('matches')
      .onSnapshot(snapshot => {
        S.matches = {};
        snapshot.forEach(doc => {
          S.matches[doc.id] = { id: doc.id, ...doc.data() };
        });
        if (onDataFn) onDataFn();
      }, err => {
        console.error('MatchesDB.subscribe error:', err);
      });
  },

  stop() {
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
  },

  // Create a new match document — called from scheduleMatch(), generateFixtures(),
  // confirmClaimSlot(), confirmQuickSchedule()
  async save(matchData) {
    const ref = db.collection('matches').doc();
    const doc = { ...matchData, id: ref.id, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    await ref.set(doc);
    return ref.id;
  },

  // Update match fields — called from submitScore(), confirmScore(), disputeScore(),
  // confirmReschedule(), openDisputeResolve()
  async update(matchId, fields) {
    await db.collection('matches').doc(matchId).update(fields);
  },

  // Bulk-write seed matches to Firestore — run once from browser console as admin:
  //   MatchesDB.seedAll(S.matches)
  async seedAll(matchesObject) {
    // Firestore batch writes are capped at 500 ops — chunk if needed
    const all = Object.values(matchesObject);
    const chunks = [];
    for (let i = 0; i < all.length; i += 499) chunks.push(all.slice(i, i + 499));
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach(match => {
        const ref = db.collection('matches').doc(match.id);
        batch.set(ref, match);
      });
      await batch.commit();
    }
    console.log('Seeded', all.length, 'matches to Firestore');
  }
};
