// src/identity.js
// Firebase Authentication — replaces Netlify Identity entirely.
// Role model (admin / captain / viewer) is carried by Firebase custom claims set server-side,
// not client-side app_metadata. This is the difference that makes permissions real:
// custom claims are embedded in the ID token and signed by Firebase — a user cannot edit them
// in devtools the way they could edit the old client-side S.isAdmin flag.
//
// HOW ROLES ARE ASSIGNED (Firebase Admin SDK — run once per user you want to promote):
//   admin.auth().setCustomUserClaims(uid, { role: 'admin' });    // OnePadel team member
//   admin.auth().setCustomUserClaims(uid, { role: 'captain' });  // team captain
//   No claim = read-only viewer (default for all new signups)
//
// HOW TEAM LINKING WORKS:
//   Captain  matched by email against team.email captured at registration.
//   Player   matched by email against player.claimedByEmail (claim-code flow).
//   Both still run against in-memory S.teams for now — once Firestore is wired these
//   become async reads instead, with no change needed to callers.

// ════════ FIREBASE INIT ════════
// firebase, db, and firebaseAuth are initialized in the inline <script> in index.html
// before any other script loads — this avoids all async ordering issues.
// Do NOT call firebase.initializeApp() or firebase.auth() here again.

// ════════ UI HELPERS ════════
function showApp(){ document.getElementById('auth-gate').classList.add('hidden'); }
function hideApp(){ document.getElementById('auth-gate').classList.remove('hidden'); }

// ════════ PERMISSION FUNCTIONS ════════
function isAdminUser(){
  if (IS_LOCAL_DEV) return S.devRole === 'admin';
  return S.isAdmin === true;
}
function isCaptainUser(){
  if (IS_LOCAL_DEV) return S.devRole === 'captain';
  return S.isCaptain === true;
}
function canWrite(){ return isAdminUser() || isCaptainUser(); }
function canAdminister(){ return isAdminUser(); }
function canActOnMatch(m){
  if (isAdminUser()) return true;
  if (!isCaptainUser()) return false;
  return m && (m.t1 === S.myTeamId || m.t2 === S.myTeamId);
}
function isSubmitter(m){
  return !isAdminUser() && S.myTeamId && m.submittedBy === S.myTeamId;
}
function canEditRoster(team){
  return isAdminUser() || (isCaptainUser() && S.myTeamId === team.id);
}

// ════════ ROLE + TEAM RESOLUTION ════════
async function resolveIdentity(firebaseUser){
  S.isAdmin = false;
  S.isCaptain = false;
  S.userEmail = null;
  S.myTeamId = null;
  S.myPlayerTeamId = null;
  if (!firebaseUser) return;

  S.userEmail = firebaseUser.email;

  // Ensure player profile doc exists — creates if first sign-in, no-op otherwise
  PlayersDB.ensureProfile(
    firebaseUser.uid,
    firebaseUser.email,
    firebaseUser.displayName
  ).catch(e => console.warn('ensureProfile:', e.message));

  // Force-refresh token to get latest role claim
  const tokenResult = await firebaseUser.getIdTokenResult(true);
  const role = tokenResult.claims.role || 'viewer';
  S.isAdmin   = role === 'admin';
  S.isCaptain = role === 'captain';

  // Team association now lives in /teamMembers/{uid}_{season} in Firestore.
  // This replaces teamId in custom claims — Firestore can be updated without
  // touching Auth, supports reassignment mid-season, and supports different
  // teams across seasons without any data migration.
  const membership = await MembersDB.getForUser(firebaseUser.uid);
  if (membership) {
    S.myTeamId = membership.teamId;
    // A captain who registered their own team gets a membership record immediately
    // but may not have the 'captain' claim yet (admin hasn't promoted them).
    // Treat them as captain locally so they can manage the team they just created.
    if (!S.isCaptain && membership.role === 'captain') S.isCaptain = true;
  }

  // Player claim-code linking — separate from captaincy, uses roster slot email
  if (S.userEmail){
    Object.values(S.teams).forEach(t => {
      (t.players || []).forEach(p => {
        if (p.claimedByEmail && p.claimedByEmail.toLowerCase() === S.userEmail.toLowerCase())
          S.myPlayerTeamId = t.id;
      });
    });
  }
}

// ════════ NAV USER PILL ════════
function roleLabel(){
  if (isAdminUser())   return 'Admin';
  if (isCaptainUser()) return 'Captain';
  return 'Viewer';
}
function setNavUser(user){
  const pill = document.getElementById('nav-user');
  if (!user){ pill.style.display = 'none'; return; }
  const label = roleLabel();
  const color = label==='Admin' ? 'var(--gold)' : label==='Captain' ? 'var(--brand)' : 'var(--muted)';
  // Show display name if set, otherwise fall back to the part before @ in the email
  const displayName = user.displayName || (user.email ? user.email.split('@')[0] : user.email);
  document.getElementById('nav-user-email').innerHTML =
    `${displayName} <span style="color:${color};font-weight:700;">· ${label}</span>`;
  pill.style.display = 'flex';
}

// ════════ ROLE GATING (UX LAYER) ════════
function applyRoleGating(){
  const w = canWrite(), admin = canAdminister();
  // Any signed-in user can register a team during open registration.
  // Use S.userEmail (set by resolveIdentity) not firebase.auth().currentUser
  // which may be null when applyRoleGating runs due to async auth timing.
  // After registration cutoff, only admins can register teams (late manual entries only)
  const canRegister = admin || (isRegistrationOpen() && !!S.userEmail);
  ['nav-register-btn','hero-register-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = canRegister ? '' : 'none';
    if (admin && !isRegistrationOpen()) {
      el.textContent = id === 'nav-register-btn' ? '+ Add Team (Admin)' : 'Add Team (Admin Only)';
      el.style.opacity = '0.7';
    }
  });
  // Profile tab visible to all signed-in users
  const profileTab = document.getElementById('nav-profile-tab');
  if(profileTab) profileTab.style.display = S.userEmail ? '' : 'none';

  const schBtn = document.getElementById('sch-page-btn');
  if (schBtn) schBtn.style.display = admin ? '' : 'none';
  const joinBtn = document.getElementById('nav-join-btn');
  if (joinBtn) joinBtn.style.display = !w ? '' : 'none';
  const profileBtn = document.getElementById('nav-profile-btn');
  if (profileBtn) profileBtn.style.display = S.userEmail ? '' : 'none';
  const adminTab = document.getElementById('nav-admin-tab');
  if (adminTab) adminTab.style.display = admin ? '' : 'none';
  const adminLabel = document.getElementById('admin-season-label');
  if (adminLabel) adminLabel.textContent = ACTIVE_SEASON;
  // Populate team dropdowns in edit user modal whenever roles change
  const editTeamSel = document.getElementById('edit-user-team');
  if (editTeamSel && editTeamSel.options.length <= 1) {
    editTeamSel.innerHTML = '<option value="">— select team —</option>' +
      Object.values(S.teams).map(t=>`<option value="${t.id}">${t.name} (${t.group})</option>`).join('');
  }
  const notice = document.getElementById('viewer-notice');
  if (notice){
    if (!w){
      notice.style.display = 'block';
      notice.textContent = '👁 Viewing in read-only mode — contact your coach for captain access.';
    } else if (!isRegistrationOpen() && !admin){
      notice.style.display = 'block';
      notice.textContent = `⚠ Registration closed ${REGISTRATION_CUTOFF}. Contact an admin for late additions.`;
    } else {
      notice.style.display = 'none';
    }
  }
}

// ════════ AUTH GATE ACTIONS (called from index.html buttons) ════════
function openSignIn(){
  const email    = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;
  const errEl    = document.getElementById('signin-error');
  errEl.style.color = '#f87171';
  errEl.textContent = '';
  if (!email || !password){ errEl.textContent = 'Enter your email and password.'; return; }
  firebaseAuth.signInWithEmailAndPassword(email, password)
    .catch(err => {
      errEl.textContent =
        (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found')
          ? 'Email or password incorrect.'
          : err.message;
    });
}
function handleSignOut(){ firebaseAuth.signOut(); }

// ════════ PROFILE ════════
function openProfileModal(){
  const user = firebaseAuth.currentUser;
  if(!user) return;
  document.getElementById('profile-name').value  = user.displayName || '';
  document.getElementById('profile-email').value = user.email || '';
  document.getElementById('profile-new-pw').value     = '';
  document.getElementById('profile-confirm-pw').value = '';
  document.getElementById('profile-error').textContent = '';
  openModal('profileModal');
}

async function saveProfile(){
  const user    = firebaseAuth.currentUser;
  const errEl   = document.getElementById('profile-error');
  const newName = document.getElementById('profile-name').value.trim();
  const newPw   = document.getElementById('profile-new-pw').value;
  const confPw  = document.getElementById('profile-confirm-pw').value;
  errEl.textContent = '';

  if(!newName){ errEl.textContent = 'Display name cannot be empty.'; return; }

  try {
    // Update display name
    if(newName !== user.displayName){
      await user.updateProfile({ displayName: newName });
      // Refresh nav immediately
      setNavUser(firebaseAuth.currentUser);
      // Update Firestore user doc so admin sees the new name
      await db.collection('users').doc(user.uid).update({ displayName: newName }).catch(()=>{});
    }

    // Update password if provided
    if(newPw){
      if(newPw.length < 6){ errEl.textContent = 'Password must be at least 6 characters.'; return; }
      if(newPw !== confPw){ errEl.textContent = 'Passwords do not match.'; return; }
      await user.updatePassword(newPw);
    }

    closeModal('profileModal');
    showToast('Profile updated');
  } catch(err){
    if(err.code === 'auth/requires-recent-login'){
      errEl.textContent = 'Session expired — sign out and back in, then try again.';
    } else {
      errEl.textContent = err.message;
    }
  }
}

function openProfileModal(){
  const user = firebaseAuth.currentUser;
  if(!user) return;
  document.getElementById('profile-name').value  = user.displayName || '';
  document.getElementById('profile-email').value = user.email || '';
  document.getElementById('profile-password').value = '';
  const msgEl = document.getElementById('profile-msg');
  msgEl.textContent = '';
  msgEl.style.color = '#f87171';
  document.getElementById('profileModal').classList.add('open');
}

async function saveProfile(){
  const user     = firebaseAuth.currentUser;
  const name     = document.getElementById('profile-name').value.trim();
  const password = document.getElementById('profile-password').value;
  const msgEl    = document.getElementById('profile-msg');
  msgEl.style.color = '#f87171';
  msgEl.textContent = '';
  try {
    if(name && name !== user.displayName){
      await user.updateProfile({ displayName: name });
      await db.collection('users').doc(user.uid).set({ displayName: name }, { merge: true });
    }
    if(password){
      if(password.length < 6){ msgEl.textContent = 'Password must be at least 6 characters.'; return; }
      await user.updatePassword(password);
    }
    setNavUser(firebaseAuth.currentUser);
    msgEl.style.color = '#4ade80';
    msgEl.textContent = 'Profile updated!';
    setTimeout(() => closeModal('profileModal'), 1200);
  } catch(err){
    msgEl.textContent = err.code === 'auth/requires-recent-login'
      ? 'Sign out and back in first, then change your password.'
      : err.message;
  }
}

function showResetView(){
  document.getElementById('auth-signin-view').style.display = 'none';
  document.getElementById('auth-signup-view').style.display = 'none';
  document.getElementById('auth-reset-view').style.display  = '';
  document.getElementById('reset-email').value = document.getElementById('signin-email').value;
  document.getElementById('reset-msg').textContent = '';
}
function showSignInView(){
  document.getElementById('auth-reset-view').style.display  = 'none';
  document.getElementById('auth-signup-view').style.display = 'none';
  document.getElementById('auth-signin-view').style.display = '';
  document.getElementById('signin-error').textContent = '';
}
function showSignupView(){
  document.getElementById('auth-signin-view').style.display = 'none';
  document.getElementById('auth-reset-view').style.display  = 'none';
  document.getElementById('auth-signup-view').style.display = '';
  document.getElementById('signup-error').textContent = '';
  // Pre-fill email if they already typed it on the sign-in screen
  const existingEmail = document.getElementById('signin-email').value;
  if(existingEmail) document.getElementById('signup-email').value = existingEmail;
}

// Self-registration: creates a Firebase Auth account with role:'viewer'.
// The user can then see the app in read-only mode. An admin must promote them
// to captain and link their team before they can schedule or submit scores.
async function selfRegister(){
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const name     = document.getElementById('signup-name').value.trim();
  const errEl    = document.getElementById('signup-error');
  errEl.style.color = '#f87171';
  errEl.textContent = '';

  if(!email || !password){ errEl.textContent = 'Email and password required.'; return; }
  if(password.length < 6){ errEl.textContent = 'Password must be at least 6 characters.'; return; }
  if(!name){ errEl.textContent = 'Enter your name so your coach can identify you.'; return; }

  try {
    const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
    // Update display name so admin can see who requested access
    await cred.user.updateProfile({ displayName: name });
    // Create a viewer-role Firestore user doc so they appear in the Admin user list
    await db.collection('users').doc(cred.user.uid).set({
      uid: cred.user.uid,
      email,
      displayName: name,
      role: 'viewer',
      teamId: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Auth state change fires automatically — app will load as viewer
  } catch(err){
    errEl.textContent =
      err.code === 'auth/email-already-in-use' ? 'An account with this email already exists. Try signing in instead.' :
      err.code === 'auth/invalid-email'         ? 'Invalid email address.' :
      err.message;
  }
}
function sendResetEmail(){
  const email = document.getElementById('reset-email').value.trim();
  const msgEl = document.getElementById('reset-msg');
  msgEl.style.color = '#f87171';
  msgEl.textContent = '';
  if (!email){ msgEl.textContent = 'Enter your email address.'; return; }
  firebaseAuth.sendPasswordResetEmail(email)
    .then(() => {
      msgEl.style.color = '#4ade80';
      msgEl.textContent = 'Reset link sent — check your inbox (and spam folder).';
    })
    .catch(err => {
      msgEl.textContent = err.code === 'auth/user-not-found'
        ? 'No account found for that email.'
        : err.message;
    });
}

// ════════ DEV FLAG ════════
// Keep this const before the if blocks so both branches can read it.
// ════════ DEV FLAG ════════
// PRODUCTION: set to false. For local development, change back to:
// const IS_LOCAL_DEV = location.protocol === 'file:' || location.hostname === 'localhost';
const IS_LOCAL_DEV = false;

// ════════ PRODUCTION: Firebase Auth state listener ════════
if (!IS_LOCAL_DEV){
  firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser){
      // Config loads first — it sets ACTIVE_SEASON and REGISTRATION_CUTOFF
      // which TeamsDB and MatchesDB queries depend on
      let configReady = false, teamsReady = false;

      // Timeout fallback — if either subscription hangs (empty collection, rules issue,
      // slow network), render after 4s rather than spinning forever.
      const readyTimer = setTimeout(() => {
        if(!S.appReady){
          console.warn('App ready timeout — rendering with available data');
          S.appReady = true;
          const skel = document.getElementById('app-skeleton');
          if(skel) skel.style.display = 'none';
          renderPage(document.querySelector('.page.active')?.id.replace('page-','') || 'home');
        }
      }, 4000);

      function tryReady(){
        if(configReady && teamsReady && !S.appReady){
          S.appReady = true;
          clearTimeout(readyTimer);
          const skel = document.getElementById('app-skeleton');
          if(skel) skel.style.display = 'none';
          renderPage(document.querySelector('.page.active')?.id.replace('page-','') || 'home');
        } else if(S.appReady){
          renderPage(document.querySelector('.page.active')?.id.replace('page-','') || 'home');
        }
      }

      ConfigDB.subscribe(() => {
        applyConfigToUI();
        configReady = true;
        // Only subscribe to teams/matches AFTER config sets ACTIVE_SEASON —
        // querying before this means TeamsDB uses the default season value
        // and may return empty, causing the 4s timeout to fire every load.
        if(!teamsReady){
          TeamsDB.subscribe(() => { teamsReady = true; tryReady(); });
          MatchesDB.subscribe(() => { tryReady(); });
        }
        tryReady();
      });
      await resolveIdentity(firebaseUser);
      showApp();
      setNavUser(firebaseUser);
      applyRoleGating();
    } else {
      ConfigDB.stop();
      TeamsDB.stop();
      MatchesDB.stop();
      hideApp();
      setNavUser(null);
    }
  });
}

// ════════ LOCAL DEV MODE ════════
// Bypasses Firebase Auth when running from file:// or localhost.
// Remove this entire block before going live.
if (IS_LOCAL_DEV){
  S.devRole   = 'admin';
  S.devTeamId = null;

  function applyDevRole(){
    S.isAdmin   = S.devRole === 'admin';
    S.isCaptain = S.devRole === 'captain';
    S.userEmail = (S.isCaptain && S.devTeamId)
      ? (S.teams[S.devTeamId]?.email || 'dev@local')
      : 'dev@local';
    S.myTeamId = null;
    S.myPlayerTeamId = null;
    if (S.isCaptain && S.devTeamId) S.myTeamId = S.devTeamId;
    else if (S.isCaptain){
      const first = Object.values(S.teams)[0];
      if (first){ S.devTeamId = first.id; S.myTeamId = first.id; }
    }
    setNavUser({ email: S.devRole==='captain' && S.devTeamId
      ? S.teams[S.devTeamId]?.name + ' (captain, dev)'
      : 'dev@local (bypass)' });
    applyRoleGating();
  }

  document.addEventListener('DOMContentLoaded', () => {
    showApp();
    applyDevRole();

    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:var(--warn);color:#000;font-size:11px;font-weight:700;padding:5px 10px;z-index:10000;font-family:monospace;display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;';
    banner.innerHTML = `⚠ LOCAL DEV MODE — Firebase Auth bypassed &nbsp;·&nbsp; Testing as:
      <select id="dev-role-select" style="background:#000;color:#fb923c;border:none;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;font-family:monospace;cursor:pointer;">
        <option value="admin">Admin</option>
        <option value="captain">Captain</option>
        <option value="viewer">Viewer</option>
      </select>
      <select id="dev-team-select" style="background:#000;color:#fb923c;border:none;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;font-family:monospace;cursor:pointer;display:none;"></select>`;
    document.body.appendChild(banner);

    function populateDevTeamSelect(){
      const sel = document.getElementById('dev-team-select');
      sel.innerHTML = Object.values(S.teams)
        .map(t => `<option value="${t.id}">${t.name} (${t.group})</option>`)
        .join('');
      if (S.devTeamId) sel.value = S.devTeamId;
    }
    populateDevTeamSelect();

    document.getElementById('dev-role-select').addEventListener('change', e => {
      S.devRole = e.target.value;
      document.getElementById('dev-team-select').style.display = S.devRole==='captain' ? '' : 'none';
      if (S.devRole==='captain' && !S.devTeamId)
        S.devTeamId = Object.values(S.teams)[0]?.id;
      applyDevRole();
      renderPage(document.querySelector('.page.active').id.replace('page-',''));
    });
    document.getElementById('dev-team-select').addEventListener('change', e => {
      S.devTeamId = e.target.value;
      applyDevRole();
      renderPage(document.querySelector('.page.active').id.replace('page-',''));
    });
  });
}
