// src/identity.js
// Netlify Identity integration, admin/captain/viewer role resolution, local dev-mode bypass with role/team simulator.

// ════════ NETLIFY IDENTITY + ROLE RESOLUTION ════════
function showApp(){document.getElementById('auth-gate').classList.add('hidden');}
function hideApp(){document.getElementById('auth-gate').classList.remove('hidden');}

// Three tiers:
// - Admin (OnePadel team administrators, Netlify role="admin"): full read/write everywhere,
//   not restricted to any single team. Multiple people can hold this role simultaneously.
// - Captain (Netlify role="captain"): write access SCOPED to their own team only — matches
//   involving S.myTeamId. Cannot edit other teams' fixtures, scores, or disputes.
// - Viewer (no role / anyone else logged in): read-only everywhere.
function canWrite(){ return isAdminUser()||isCaptainUser(); } // "has some write role" — used for register-team gating
function isAdminUser(){ if(IS_LOCAL_DEV) return S.devRole==='admin'; return S.isAdmin===true; }
function isCaptainUser(){ if(IS_LOCAL_DEV) return S.devRole==='captain'; return S.isCaptain===true; }
// Group-wide administrative actions (generate fixtures, free-form match scheduling): admin only.
function canAdminister(){ return isAdminUser(); }
// Per-match actions (claim slot, submit/confirm score, dispute, reschedule): admin, or the
// captain of one of the two teams in that specific match.
function canActOnMatch(m){
  if(isAdminUser()) return true;
  if(!isCaptainUser()) return false;
  return m && (m.t1===S.myTeamId || m.t2===S.myTeamId);
}
// True only for the captain whose team actually submitted this pending score — used to hide
// their own Confirm/Dispute buttons, since a submitter confirming their own submission isn't
// verification, it's the same party grading itself. Admin is never treated as "the submitter"
// here even when submittedBy==='admin', because admin submissions never reach pending-confirm
// in the first place (they go straight to confirmed).
function isSubmitter(m){
  return !isAdminUser() && S.myTeamId && m.submittedBy===S.myTeamId;
}
function applyRoleGating(){
  const w=canWrite(), admin=canAdminister();
  const canRegister=w&&(isRegistrationOpen()||admin);
  ['nav-register-btn','hero-register-btn'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display=canRegister?'':'none';
  });
  const schBtn=document.getElementById('sch-page-btn');
  if(schBtn) schBtn.style.display=admin?'':'none'; // free-form scheduler is admin-only now
  const joinBtn=document.getElementById('nav-join-btn');
  if(joinBtn) joinBtn.style.display=(!w)?'':'none'; // only plain viewers need to claim a slot — captains/admins already have full access
  const notice=document.getElementById('viewer-notice');
  if(notice){
    if(!w){ notice.style.display='block'; notice.textContent='👁 Viewing in read-only mode — contact your coach if you need captain access to schedule matches or submit scores.'; }
    else if(!isRegistrationOpen()&&!admin){ notice.style.display='block'; notice.textContent=`⚠ Registration closed ${REGISTRATION_CUTOFF}. Contact an admin for late additions.`; }
    else notice.style.display='none';
  }
}

// Resolves role + team from a Netlify Identity user object.
// - Role comes from user.app_metadata.roles (native Netlify Identity feature, admin-assignable
//   in the dashboard with zero backend — Users tab → edit user → Roles). A user can hold
//   "admin", "captain", or no role (viewer).
// - Team ownership (for captains only — admins aren't scoped to a team) comes from matching
//   user.email against the email a captain entered at registration. Linking via a custom
//   app_metadata field instead would need the Identity Admin API + a serverless function,
//   which is backend infra this app doesn't have; email-matching needs none.
function resolveIdentity(user){
  const roles=(user&&user.app_metadata&&user.app_metadata.roles)||[];
  S.isAdmin=roles.includes('admin');
  S.isCaptain=roles.includes('captain');
  S.userEmail=user?user.email:null;
  S.myTeamId=null;
  S.myPlayerTeamId=null; // separate from myTeamId: a claimed roster slot grants READ personalization only, never write access
  if(S.userEmail&&!S.isAdmin){
    const match=Object.values(S.teams).find(t=>t.email&&t.email.toLowerCase()===S.userEmail.toLowerCase());
    if(match) S.myTeamId=match.id;
  }
  if(S.userEmail){
    Object.values(S.teams).forEach(t=>{
      (t.players||[]).forEach(p=>{
        if(p.claimedByEmail&&p.claimedByEmail.toLowerCase()===S.userEmail.toLowerCase()) S.myPlayerTeamId=t.id;
      });
    });
  }
}

function roleLabel(){
  if(isAdminUser()) return 'Admin';
  if(isCaptainUser()) return 'Captain';
  return 'Viewer';
}
function setNavUser(user){
  const pill=document.getElementById('nav-user');
  if(!user){pill.style.display='none';return;}
  const label=roleLabel();
  const color=label==='Admin'?'var(--gold)':label==='Captain'?'var(--brand)':'var(--muted)';
  document.getElementById('nav-user-email').innerHTML=`${user.email} <span style="color:${color};font-weight:700;">· ${label}</span>`;
  pill.style.display='flex';
}

// ── LOCAL DEV MODE ──
// Running from file:// or localhost bypasses real Netlify Identity so you can test without
// deploying. A 3-way role toggle (Admin → Captain → Viewer) lets you preview all three
// experiences without needing separately invited accounts. Remove before going live.
const IS_LOCAL_DEV = location.protocol === 'file:' || location.hostname === 'localhost';

// To test REAL login + real Netlify-assigned roles locally instead of bypassing, comment out
// the IS_LOCAL_DEV block below and uncomment this line with your actual site URL:
// netlifyIdentity.init({ APIUrl: 'https://YOUR-SITE-NAME.netlify.app/.netlify/identity' });

if (IS_LOCAL_DEV) {
  S.devRole='admin';
  S.devTeamId=null; // which team to simulate as captain
  function applyDevRole(){
    const roles = S.devRole==='admin'?['admin']:S.devRole==='captain'?['captain']:[];
    if(S.devRole==='captain'){
      const team=S.devTeamId?S.teams[S.devTeamId]:Object.values(S.teams)[0];
      if(team&&!S.devTeamId) S.devTeamId=team.id;
      resolveIdentity({email: team?team.email:'dev@local', app_metadata:{roles}});
    } else {
      resolveIdentity({email:'dev@local', app_metadata:{roles}});
    }
    setNavUser({email:S.devRole==='captain'&&S.devTeamId?S.teams[S.devTeamId].name+' (captain, dev)':'dev@local (bypass mode)'});
    applyRoleGating();
  }
  document.addEventListener('DOMContentLoaded', () => {
    showApp();
    applyDevRole();
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:var(--warn);color:#000;text-align:center;font-size:11px;font-weight:700;padding:5px 10px;z-index:10000;font-family:monospace;display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;';
    banner.innerHTML = `⚠ LOCAL DEV MODE — auth bypassed, not connected to Netlify &nbsp;·&nbsp; Testing as:
      <select id="dev-role-select" style="background:#000;color:#fb923c;border:none;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;font-family:monospace;cursor:pointer;">
        <option value="admin">Admin</option>
        <option value="captain">Captain</option>
        <option value="viewer">Viewer</option>
      </select>
      <select id="dev-team-select" style="background:#000;color:#fb923c;border:none;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;font-family:monospace;cursor:pointer;display:none;"></select>`;
    document.body.appendChild(banner);

    function populateDevTeamSelect(){
      const sel=document.getElementById('dev-team-select');
      sel.innerHTML=Object.values(S.teams).map(t=>`<option value="${t.id}">${t.name} (${t.group})</option>`).join('');
      if(S.devTeamId) sel.value=S.devTeamId;
    }
    populateDevTeamSelect();

    document.getElementById('dev-role-select').addEventListener('change', (e)=>{
      S.devRole=e.target.value;
      document.getElementById('dev-team-select').style.display=S.devRole==='captain'?'':'none';
      if(S.devRole==='captain'&&!S.devTeamId) S.devTeamId=Object.values(S.teams)[0]?.id;
      applyDevRole();
      renderPage(document.querySelector('.page.active').id.replace('page-',''));
    });
    document.getElementById('dev-team-select').addEventListener('change', (e)=>{
      S.devTeamId=e.target.value;
      applyDevRole();
      renderPage(document.querySelector('.page.active').id.replace('page-',''));
    });
  });
} else {
  netlifyIdentity.on('init',user=>{
    if(user){resolveIdentity(user);showApp();}else{hideApp();}
    setNavUser(user||null);applyRoleGating();
  });
  netlifyIdentity.on('login',user=>{
    netlifyIdentity.close();resolveIdentity(user);showApp();setNavUser(user);applyRoleGating();
    addLog('Signed in as '+user.email+' ('+roleLabel()+')','var(--accent)');renderHome();
  });
  netlifyIdentity.on('logout',()=>{hideApp();setNavUser(null);S.isAdmin=false;S.isCaptain=false;S.myTeamId=null;applyRoleGating();});
}



