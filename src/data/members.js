// src/data/members.js
// Firestore data layer for team membership.
// Document ID format: {uid}_{season} — supports one membership per user per season,
// with full history preserved across seasons without any data migration.
//
// This replaces teamId in Firebase custom claims as the source of team association.
// Claims carry role:'captain'|'viewer' only. Team linkage lives here, in Firestore,
// where it can be updated without touching Auth and without requiring re-login.
//
// Collections:
//   /teamMembers/{uid}_{season}
//     uid, season, teamId, teamName, role: 'captain'|'player', joinedAt

const MembersDB = {

  // Get the current season membership for a specific user.
  // Called from resolveIdentity() after auth state change.
  async getForUser(uid) {
    const docId = `${uid}_${ACTIVE_SEASON}`;
    try {
      const snap = await db.collection('teamMembers').doc(docId).get();
      return snap.exists ? snap.data() : null;
    } catch(err) {
      console.error('MembersDB.getForUser error:', err);
      return null;
    }
  },

  // Create or update membership for a user in the active season.
  // Called when: captain registers a team, admin assigns a captain, player claims a slot.
  async set(uid, teamId, teamName, memberRole = 'captain') {
    const docId = `${uid}_${ACTIVE_SEASON}`;
    await db.collection('teamMembers').doc(docId).set({
      uid,
      season:   ACTIVE_SEASON,
      teamId,
      teamName,
      role:     memberRole,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },

  // Remove a user's membership for the active season.
  // Used when a captain leaves a team or is reassigned.
  async remove(uid) {
    const docId = `${uid}_${ACTIVE_SEASON}`;
    await db.collection('teamMembers').doc(docId).delete();
  },

  // List all members for a specific team this season.
  // Used in the Admin dashboard to show who is linked to a team.
  async getForTeam(teamId) {
    const snap = await db.collection('teamMembers')
      .where('season', '==', ACTIVE_SEASON)
      .where('teamId', '==', teamId)
      .get();
    return snap.docs.map(d => d.data());
  },

  // List all memberships for the active season — admin overview only.
  async listAll() {
    const snap = await db.collection('teamMembers')
      .where('season', '==', ACTIVE_SEASON)
      .get();
    return snap.docs.map(d => d.data());
  }
};
