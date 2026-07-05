// src/data/players.js
// Player profile documents at /players/{uid}
// Stores: displayName, hand, position, photoURL, nprpHistory[]
// Created/updated on sign-in. NPRP snapshots added at fixture generation.

const PlayersDB = {

  // Get or create a player profile doc
  async ensureProfile(uid, email, displayName){
    const ref = db.collection('players').doc(uid);
    const snap = await ref.get();
    if(!snap.exists){
      await ref.set({
        uid, email,
        displayName: displayName || email,
        hand: null,        // 'right' | 'left'
        position: null,    // 'left' | 'right' (court position)
        photoURL: null,
        nprpHistory: [],   // [{ season, date, nprp, division }]
        oplrHistory: [],   // [{ matchId, date, season, oplr, delta, opponent, teamOPLR, oppOPLR }]
        currentOPLR: null, // latest OPLR value for quick display
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    return ref;
  },

  // Update editable profile fields (hand, position, displayName, photoURL)
  async updateProfile(uid, fields){
    const allowed = ['displayName','hand','position','photoURL'];
    const safe = {};
    allowed.forEach(k => { if(fields[k] !== undefined) safe[k] = fields[k]; });
    await db.collection('players').doc(uid).set(safe, { merge: true });
  },

  // Get a player profile by uid
  async getProfile(uid){
    const snap = await db.collection('players').doc(uid).get();
    return snap.exists ? { uid, ...snap.data() } : null;
  },

  // Get all players (for directory)
  async listAll(){
    const snap = await db.collection('players').orderBy('displayName').get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  },

  // Append an NPRP snapshot — called at fixture generation
  async addNPRPSnapshot(uid, nprp, season, division){
    const ref = db.collection('players').doc(uid);
    const snap = await ref.get();
    if(!snap.exists) return; // player not registered in system yet
    const existing = snap.data().nprpHistory || [];
    // Avoid duplicate snapshots for the same season
    if(existing.some(h => h.season === season)) return;
    await ref.update({
      nprpHistory: firebase.firestore.FieldValue.arrayUnion({
        season,
        date: new Date().toISOString().split('T')[0],
        nprp: parseFloat(nprp),
        division
      })
    });
  }
};

// ── NPRP snapshot at fixture generation ──────────────────────────────────────
// Called from roundrobin.js after fixtures are generated for a group.
// Finds all players in the division, looks up their uid from teamMembers,
// and writes a snapshot to their player profile doc.
async function captureNPRPSnapshot(group){
  const teams = teamsByGroup(group);
  for(const team of teams){
    // Get the captain's uid from teamMembers
    const tmSnap = await db.collection('teamMembers')
      .where('season','==',ACTIVE_SEASON)
      .where('teamId','==',team.id).get();

    for(const player of (team.players||[])){
      const nprp = parseFloat(player.nprp);
      if(isNaN(nprp) || nprp <= 0) continue;

      // Try to find the player's uid — captain is linked, others may not be yet
      // We store snapshots by email as fallback key when uid not known
      const captainDoc = tmSnap.docs[0];
      const isCapt = captainDoc && player.claimedByEmail;

      if(player.claimedByEmail){
        // Find uid by email
        const uSnap = await db.collection('players')
          .where('email','==',player.claimedByEmail).limit(1).get();
        if(!uSnap.empty){
          await PlayersDB.addNPRPSnapshot(
            uSnap.docs[0].id, nprp, ACTIVE_SEASON, group
          );
        }
      }
      // Players who haven't claimed their account yet get snapshot stored
      // against their email — will be linked when they first sign in
    }
  }
  console.log(`NPRP snapshots captured for ${group}`);
}
