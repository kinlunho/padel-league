// src/data/teams.js
// Firestore data layer for teams.
// Exposes: TeamsDB.subscribe(), TeamsDB.save(), TeamsDB.update(), TeamsDB.remove()
// All render functions that previously read S.teams directly now get called automatically
// by the onSnapshot listener whenever Firestore data changes.

const db = firebase.firestore();

const TeamsDB = {
  _unsubscribe: null,

  // Start listening to the teams collection. Fires onDataFn() every time data changes.
  // Must be called after authentication — Firestore rejects reads from unauthenticated
  // users in production mode.
  subscribe(onDataFn) {
    if (this._unsubscribe) this._unsubscribe();
    this._unsubscribe = db.collection('teams')
      .orderBy('group')
      .onSnapshot(snapshot => {
        // Replace S.teams entirely on every update — all existing code that reads
        // S.teams keeps working without modification.
        S.teams = {};
        snapshot.forEach(doc => {
          S.teams[doc.id] = { id: doc.id, ...doc.data() };
        });
        if (onDataFn) onDataFn();
      }, err => {
        console.error('TeamsDB.subscribe error:', err);
      });
  },

  stop() {
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
  },

  // Save a new team — called from registerTeam()
  async save(teamData) {
    const ref = db.collection('teams').doc();
    const doc = { ...teamData, id: ref.id, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    await ref.set(doc);
    return ref.id;
  },

  // Update specific fields on an existing team — called from saveRosterEdit()
  async update(teamId, fields) {
    await db.collection('teams').doc(teamId).update(fields);
  },

  // Hard-delete — admin only
  async remove(teamId) {
    await db.collection('teams').doc(teamId).delete();
  },

  // Bulk-write seed teams to Firestore — run once from browser console as admin:
  //   TeamsDB.seedAll(S.teams)
  async seedAll(teamsObject) {
    const batch = db.batch();
    Object.values(teamsObject).forEach(team => {
      const ref = db.collection('teams').doc(team.id);
      batch.set(ref, team);
    });
    await batch.commit();
    console.log('Seeded', Object.values(teamsObject).length, 'teams to Firestore');
  }
};
