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
// firebaseConfig loaded from src/firebase-config.js (gitignored)
const firebaseApp  = firebase.initializeApp(firebaseConfig);
const firebaseAuth = firebase.auth();

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

  // Force-refresh token to get latest custom claims without requiring re-login
  const tokenResult = await firebaseUser.getIdTokenResult(true);
  const role = tokenResult.claims.role || 'viewer';
  S.isAdmin   = role === 'admin';
  S.isCaptain = role === 'captain';

  if (S.userEmail && !S.isAdmin){
    const match = Object.values(S.teams).find(t =>
      t.email && t.email.toLowerCase() === S.userEmail.toLowerCase()
    );
    if (match) S.myTeamId = match.id;
  }
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
  document.getElementById('nav-user-email').innerHTML =
    `${user.email} <span style="color:${color};font-weight:700;">· ${label}</span>`;
  pill.style.display = 'flex';
}

// ════════ ROLE GATING (UX LAYER) ════════
function applyRoleGating(){
  const w = canWrite(), admin = canAdminister();
  const canRegister = w && (isRegistrationOpen() || admin);
  ['nav-register-btn','hero-register-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = canRegister ? '' : 'none';
  });
  const schBtn = document.getElementById('sch-page-btn');
  if (schBtn) schBtn.style.display = admin ? '' : 'none';
  const joinBtn = document.getElementById('nav-join-btn');
  if (joinBtn) joinBtn.style.display = !w ? '' : 'none';
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

// ════════ DEV FLAG ════════
// Keep this const before the if blocks so both branches can read it.
const IS_LOCAL_DEV = location.protocol === 'file:' || location.hostname === 'localhost';

// ════════ PRODUCTION: Firebase Auth state listener ════════
if (!IS_LOCAL_DEV){
  firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
    await resolveIdentity(firebaseUser);
    if (firebaseUser){
      showApp();
      setNavUser(firebaseUser);
      applyRoleGating();
      renderHome();
    } else {
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
