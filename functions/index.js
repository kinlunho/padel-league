// functions/index.js
// Firebase Cloud Functions — server-side Admin SDK operations that cannot run in the browser.
// Deployed to: https://us-central1-padel-league-hk.cloudfunctions.net/
//
// All functions require the caller to be authenticated AND have role:'admin' in their
// custom claims. The check happens server-side in the function itself — a client-side
// isAdminUser() check is not sufficient because the client controls it.

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
admin.initializeApp();
const REGION = 'asia-east2';

// ── Helper: verify the caller is a signed-in admin ──────────────────────────
async function requireAdmin(context) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  const token = await admin.auth().verifyIdToken(context.auth.token.__raw || await admin.auth().createCustomToken(context.auth.uid));
  const user  = await admin.auth().getUser(context.auth.uid);
  const claims = user.customClaims || {};
  if (claims.role !== 'admin') throw new functions.https.HttpsError('permission-denied', 'Admin only.');
}

// ── setUserRole ──────────────────────────────────────────────────────────────
// Sets role + optional teamId custom claim on a Firebase Auth user.
// Called from the admin page when promoting a viewer to captain or admin.
// data: { uid, role: 'admin'|'captain'|'viewer', teamId: string|null }
exports.setUserRole = functions.region(REGION).https.onCall(async (data, context) => {
  // Verify caller token directly from context.auth
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }
  const callerRecord = await admin.auth().getUser(context.auth.uid);
  if ((callerRecord.customClaims || {}).role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }

  const { uid, role, teamId = null } = data;
  if (!uid || !role) throw new functions.https.HttpsError('invalid-argument', 'uid and role required.');
  if (!['admin','captain','viewer'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'role must be admin, captain, or viewer.');
  }

  await admin.auth().setCustomUserClaims(uid, { role, teamId: teamId || null });

  // Also update the /users/{uid} Firestore doc so the admin page can list roles
  // without needing to call Admin SDK listUsers() which has rate limits.
  await admin.firestore().collection('users').doc(uid).set({
    uid,
    email: (await admin.auth().getUser(uid)).email,
    role,
    teamId: teamId || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { success: true, uid, role, teamId };
});

// ── createUser ───────────────────────────────────────────────────────────────
// Creates a new Firebase Auth user. Admin only.
// data: { email, password, role: 'captain'|'viewer', teamId: string|null }
exports.createUser = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }
  const callerRecord = await admin.auth().getUser(context.auth.uid);
  if ((callerRecord.customClaims || {}).role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }

  const { email, password, role = 'viewer', teamId = null } = data;
  if (!email || !password) throw new functions.https.HttpsError('invalid-argument', 'email and password required.');

  const userRecord = await admin.auth().createUser({ email, password });
  await admin.auth().setCustomUserClaims(userRecord.uid, { role, teamId: teamId || null });

  await admin.firestore().collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid,
    email,
    role,
    teamId: teamId || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, uid: userRecord.uid, email, role };
});

// ── listUsers ─────────────────────────────────────────────────────────────────
// Returns all Firebase Auth users with their current role claims.
// Admin only. Used to populate the admin user management table.
exports.listUsers = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }
  const callerRecord = await admin.auth().getUser(context.auth.uid);
  if ((callerRecord.customClaims || {}).role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }

  const listResult = await admin.auth().listUsers(1000);
  const users = listResult.users.map(u => ({
    uid:    u.uid,
    email:  u.email,
    role:   (u.customClaims || {}).role   || 'viewer',
    teamId: (u.customClaims || {}).teamId || null,
    lastSignIn: u.metadata.lastSignInTime
  }));

  return { users };
});

// ── deleteUser ────────────────────────────────────────────────────────────────
// Deletes a Firebase Auth user. Admin only. Cannot delete yourself.
exports.deleteUser = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }
  const callerRecord = await admin.auth().getUser(context.auth.uid);
  if ((callerRecord.customClaims || {}).role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
  if (data.uid === context.auth.uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Cannot delete your own account.');
  }

  await admin.auth().deleteUser(data.uid);
  await admin.firestore().collection('users').doc(data.uid).delete();
  return { success: true };
});
