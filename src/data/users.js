// src/data/users.js
// Firestore data layer for user profiles (role + team linking).
// The /users/{uid} document is created on first login and updated when roles change.
// This replaces the email-matching approach in resolveIdentity() — roles are now stored
// in Firestore rather than inferred from team.email comparison.

const UsersDB = {

  // Called from resolveIdentity() after Firebase Auth confirms who is logged in.
  // Returns the user doc, creating it if this is the user's first login.
  async getOrCreate(firebaseUser) {
    const ref = db.collection('users').doc(firebaseUser.uid);
    const snap = await ref.get();
    if (snap.exists) return snap.data();

    // First login — create a viewer-role profile
    const newUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      role: 'viewer',
      teamId: null,          // set by admin when a captain is linked to a team
      claimedTeamId: null,   // set when a player claims a roster slot via code
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(newUser);
    return newUser;
  },

  // Admin promotes a user to captain or admin role.
  // Also call Firebase Admin SDK separately to set the custom claim so the JWT reflects it.
  async setRole(uid, role, teamId = null) {
    await db.collection('users').doc(uid).update({
      role,
      teamId: teamId || null
    });
  },

  // Called from confirmJoinPlayer() when a player enters a claim code
  async claimRosterSlot(uid, teamId) {
    await db.collection('users').doc(uid).update({ claimedTeamId: teamId });
  },

  // List all users — admin dashboard use only
  async listAll() {
    const snap = await db.collection('users').orderBy('email').get();
    return snap.docs.map(d => d.data());
  }
};
