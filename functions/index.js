// functions/index.js
// Firebase Cloud Functions — server-side Admin SDK operations.
// Team association now lives in /teamMembers/{uid}_{season}, not in custom claims.
// Claims carry role only. This allows mid-season reassignment and cross-season
// membership history without touching Auth.

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
admin.initializeApp();
const REGION       = 'asia-east2';
const ACTIVE_SEASON = '2026-summer'; // must match src/state.js ACTIVE_SEASON

// ── Auth helper ──────────────────────────────────────────────────────────────
async function requireAdmin(context) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  const caller = await admin.auth().getUser(context.auth.uid);
  if ((caller.customClaims || {}).role !== 'admin')
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
}

// ── setUserRole ──────────────────────────────────────────────────────────────
// Sets role custom claim. If role is 'captain', also writes a teamMembers record.
// data: { uid, role, teamId?, teamName? }
exports.setUserRole = functions.region(REGION).https.onCall(async (data, context) => {
  await requireAdmin(context);
  const { uid, role, teamId = null, teamName = null } = data;
  if (!uid || !role) throw new functions.https.HttpsError('invalid-argument', 'uid and role required.');
  if (!['admin','captain','viewer'].includes(role))
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');

  // Role goes in the claim — no teamId in claims anymore
  await admin.auth().setCustomUserClaims(uid, { role });

  const userRecord = await admin.auth().getUser(uid);

  // Update /users doc
  await admin.firestore().collection('users').doc(uid).set({
    uid, email: userRecord.email, role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // Write/update teamMembers record if assigning captain with a team
  if (role === 'captain' && teamId) {
    const docId = `${uid}_${ACTIVE_SEASON}`;
    await admin.firestore().collection('teamMembers').doc(docId).set({
      uid, season: ACTIVE_SEASON, teamId,
      teamName: teamName || '',
      role: 'captain',
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    // Also stamp the team document with the new captain
    await admin.firestore().collection('teams').doc(teamId).update({
      captainUid:   uid,
      captainEmail: userRecord.email
    });
  }

  // If demoting from captain, remove their teamMembers record
  if (role !== 'captain') {
    const docId = `${uid}_${ACTIVE_SEASON}`;
    await admin.firestore().collection('teamMembers').doc(docId).delete().catch(()=>{});
  }

  return { success: true, uid, role, teamId };
});

// ── createUser ───────────────────────────────────────────────────────────────
exports.createUser = functions.region(REGION).https.onCall(async (data, context) => {
  await requireAdmin(context);
  const { email, password, role = 'viewer', teamId = null, teamName = null } = data;
  if (!email || !password) throw new functions.https.HttpsError('invalid-argument', 'email and password required.');

  const userRecord = await admin.auth().createUser({ email, password });
  await admin.auth().setCustomUserClaims(userRecord.uid, { role });

  await admin.firestore().collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid, email, role, teamId: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (role === 'captain' && teamId) {
    const docId = `${userRecord.uid}_${ACTIVE_SEASON}`;
    await admin.firestore().collection('teamMembers').doc(docId).set({
      uid: userRecord.uid, season: ACTIVE_SEASON, teamId,
      teamName: teamName || '', role: 'captain',
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await admin.firestore().collection('teams').doc(teamId).update({
      captainUid: userRecord.uid, captainEmail: email
    }).catch(()=>{});
  }

  return { success: true, uid: userRecord.uid, email, role };
});

// ── listUsers ─────────────────────────────────────────────────────────────────
exports.listUsers = functions.region(REGION).https.onCall(async (data, context) => {
  await requireAdmin(context);

  const listResult = await admin.auth().listUsers(1000);

  // Fetch all teamMembers for this season to enrich the user list
  const membersSnap = await admin.firestore().collection('teamMembers')
    .where('season', '==', ACTIVE_SEASON).get();
  const membersByUid = {};
  membersSnap.docs.forEach(d => { membersByUid[d.data().uid] = d.data(); });

  const users = listResult.users.map(u => {
    const membership = membersByUid[u.uid];
    return {
      uid:         u.uid,
      email:       u.email,
      displayName: u.displayName || '',
      role:        (u.customClaims || {}).role || 'viewer',
      teamId:      membership ? membership.teamId   : null,
      teamName:    membership ? membership.teamName : null,
      lastSignIn:  u.metadata.lastSignInTime
    };
  });

  return { users };
});

// ── deleteUser ────────────────────────────────────────────────────────────────
exports.deleteUser = functions.region(REGION).https.onCall(async (data, context) => {
  await requireAdmin(context);
  if (data.uid === context.auth.uid)
    throw new functions.https.HttpsError('invalid-argument', 'Cannot delete your own account.');

  await admin.auth().deleteUser(data.uid);
  await admin.firestore().collection('users').doc(data.uid).delete().catch(()=>{});
  // Remove their teamMembers record if any
  const docId = `${data.uid}_${ACTIVE_SEASON}`;
  await admin.firestore().collection('teamMembers').doc(docId).delete().catch(()=>{});

  return { success: true };
});

// ── deleteTeam ────────────────────────────────────────────────────────────────
// Deletes a team and all its matches for the active season.
// Also demotes the captain back to viewer and removes their teamMembers record.
// Caller must pass force:true if the season is locked (has confirmed matches).
exports.deleteTeam = functions.region(REGION).https.onCall(async (data, context) => {
  await requireAdmin(context);
  const { teamId, force = false } = data;
  if (!teamId) throw new functions.https.HttpsError('invalid-argument', 'teamId required.');

  const firestore = admin.firestore();

  // Check season lock
  const configSnap = await firestore.collection('config').doc('league').get();
  const seasonLocked = configSnap.exists && configSnap.data().seasonLocked;
  if (seasonLocked && !force) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Season is locked — confirmed matches exist. Pass force:true to delete anyway.'
    );
  }

  // Fetch all matches for this team this season
  const allMatches = await firestore.collection('matches')
    .where('season', '==', ACTIVE_SEASON).get();
  const teamMatches = allMatches.docs.filter(d =>
    d.data().t1 === teamId || d.data().t2 === teamId
  );
  const confirmedCount = teamMatches.filter(d =>
    d.data().status === 'confirmed'
  ).length;

  // Batch delete matches in chunks of 499
  for (let i = 0; i < teamMatches.length; i += 499) {
    const batch = firestore.batch();
    teamMatches.slice(i, i + 499).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  // Demote captain, remove teamMembers record
  const memberSnap = await firestore.collection('teamMembers')
    .where('season', '==', ACTIVE_SEASON)
    .where('teamId', '==', teamId).get();
  for (const doc of memberSnap.docs) {
    const uid = doc.data().uid;
    await admin.auth().setCustomUserClaims(uid, { role: 'viewer' }).catch(() => {});
    await firestore.collection('users').doc(uid)
      .set({ role: 'viewer', teamId: null }, { merge: true }).catch(() => {});
    await doc.ref.delete();
  }

  // Delete team document
  await firestore.collection('teams').doc(teamId).delete();

  return { success: true, matchesDeleted: teamMatches.length, confirmedDeleted: confirmedCount };
});
