// src/render/admin.js
// Admin dashboard — visible only to users with role:'admin'.
// Four sections: League Status, Pending Actions, User Management, Season Config.

function renderAdminPage(){
  if(!isAdminUser()){ document.getElementById('admin-container').innerHTML='<div class="alert alert-warn">Admin access required.</div>'; return; }
  renderAdminStatus();
  renderAdminActions();
  renderAdminUsers();
  renderAdminSeason();
}

// ── Section 1: League Status ──────────────────────────────────────────────────
function renderAdminStatus(){
  const teams   = Object.values(S.teams);
  const matches = Object.values(S.matches);
  const divs    = groups();
  const fixtureStatus = divs.map(g => {
    const hasFixtures = matches.some(m => m.group===g && m.round);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:13px;">${g}</span>
      <span class="chip ${hasFixtures?'chip-done':'chip-pending'}">${hasFixtures?'Fixtures generated':'No fixtures yet'}</span>
    </div>`;
  }).join('');

  const cutoff = new Date(REGISTRATION_CUTOFF);
  const today  = new Date();
  const daysLeft = Math.ceil((cutoff-today)/(1000*60*60*24));

  document.getElementById('admin-status').innerHTML=`
    <div class="grid-3" style="margin-bottom:16px;">
      <div class="card" style="text-align:center;">
        <div style="font-size:28px;font-weight:700;color:var(--accent);">${teams.length}</div>
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Teams registered</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-size:28px;font-weight:700;color:var(--brand);">${matches.filter(m=>m.status==='confirmed').length}</div>
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Matches confirmed</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-size:28px;font-weight:700;color:${daysLeft<=2?'var(--red)':daysLeft<=5?'var(--warn)':'var(--text)'};">${daysLeft>0?daysLeft:'CLOSED'}</div>
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Days to reg. cutoff</div>
      </div>
    </div>
    <div class="card">
      <div style="font-weight:700;margin-bottom:10px;font-size:13px;">Fixture Status by Division</div>
      ${fixtureStatus||'<div style="color:var(--muted);font-size:13px;">No divisions yet.</div>'}
    </div>`;
}

// ── Section 2: Pending Actions ────────────────────────────────────────────────
function renderAdminActions(){
  const matches   = Object.values(S.matches);
  const disputed  = matches.filter(m=>m.status==='disputed');
  const pending48 = matches.filter(m=>{
    if(m.status!=='pending-confirm') return false;
    // Flag if submitted more than 48 hours ago — scoreData.submittedAt not tracked yet,
    // so for now surface all pending-confirm matches as needing attention
    return true;
  });
  const unclaimed = matches.filter(m=>m.status==='unclaimed');

  const disputeCards = disputed.length
    ? disputed.map(m=>`
        <div class="card" style="border-left:3px solid var(--red);margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div>
              <div style="font-weight:600;font-size:13px;">${tn(m.t1)} vs ${tn(m.t2)} <span class="chip chip-dispute">DISPUTED</span></div>
              <div style="font-size:11px;color:var(--muted);">${m.group} · ${m.date||'no date'} · Court ${m.court||'?'}</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="openDisputeResolve('${m.id}')">⚖ Resolve</button>
          </div>
        </div>`).join('')
    : '<div style="color:var(--muted);font-size:13px;">No disputed matches.</div>';

  const pendingCards = pending48.length
    ? pending48.map(m=>`
        <div class="card" style="border-left:3px solid var(--warn);margin-bottom:8px;">
          <div style="font-weight:600;font-size:13px;">${tn(m.t1)} vs ${tn(m.t2)}</div>
          <div style="font-size:11px;color:var(--muted);">${m.group} · Submitted by ${tn(m.submittedBy)} — awaiting ${tn(m.t1===m.submittedBy?m.t2:m.t1)}</div>
        </div>`).join('')
    : '<div style="color:var(--muted);font-size:13px;">No scores awaiting confirmation.</div>';

  document.getElementById('admin-actions').innerHTML=`
    <div class="card" style="margin-bottom:12px;">
      <div style="font-weight:700;font-size:13px;color:var(--red);margin-bottom:10px;">⚖ Disputed Scores (${disputed.length})</div>
      ${disputeCards}
    </div>
    <div class="card">
      <div style="font-weight:700;font-size:13px;color:var(--warn);margin-bottom:10px;">⏳ Awaiting Confirmation (${pending48.length})</div>
      ${pendingCards}
    </div>`;
}

// ── Section 3: User Management ────────────────────────────────────────────────
async function renderAdminUsers(){
  const container = document.getElementById('admin-users');
  container.innerHTML='<div style="color:var(--muted);font-size:13px;">Loading users...</div>';

  try {
    const listUsers = firebase.functions('asia-east2').httpsCallable('listUsers');
    const result    = await listUsers({});
    const users     = result.data.users;
    const teamOptions = Object.values(S.teams)
      .map(t=>`<option value="${t.id}">${t.name} (${t.group})</option>`).join('');

    container.innerHTML=`
      <div class="card" style="margin-bottom:12px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:12px;">➕ Create Account</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
          <div><label class="form-label" style="font-size:10px;">Email</label><input class="form-input" id="new-user-email" placeholder="captain@email.com" style="width:200px;"></div>
          <div><label class="form-label" style="font-size:10px;">Temp Password</label><input class="form-input" id="new-user-pw" placeholder="Min 6 chars" style="width:150px;"></div>
          <div><label class="form-label" style="font-size:10px;">Role</label>
            <select class="form-select" id="new-user-role" onchange="toggleNewUserTeam()" style="width:110px;">
              <option value="viewer">Viewer</option>
              <option value="captain">Captain</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div id="new-user-team-wrap" style="display:none;"><label class="form-label" style="font-size:10px;">Team</label>
            <select class="form-select" id="new-user-team" style="width:180px;"><option value="">— select team —</option>${teamOptions}</select>
          </div>
          <button class="btn btn-primary btn-sm" onclick="adminCreateUser()">Create</button>
        </div>
      </div>
      <div class="card">
        <div style="font-weight:700;font-size:13px;margin-bottom:12px;">👥 All Users (${users.length})</div>
        <table style="width:100%;font-size:12px;border-collapse:collapse;">
          <thead><tr style="color:var(--muted);text-align:left;">
            <th style="padding:6px 8px;">Email</th>
            <th style="padding:6px 8px;">Role</th>
            <th style="padding:6px 8px;">Linked Team</th>
            <th style="padding:6px 8px;">Last Sign-in</th>
            <th style="padding:6px 8px;">Actions</th>
          </tr></thead>
          <tbody>${users.map(u=>{
            const teamName = u.teamId && S.teams[u.teamId] ? S.teams[u.teamId].name : '—';
            const roleColor = u.role==='admin'?'var(--gold)':u.role==='captain'?'var(--brand)':'var(--muted)';
            const isSelf    = u.uid === firebase.auth().currentUser?.uid;
            return `<tr style="border-top:1px solid var(--border);">
              <td style="padding:6px 8px;">${u.email}</td>
              <td style="padding:6px 8px;"><span style="color:${roleColor};font-weight:600;">${u.role}</span></td>
              <td style="padding:6px 8px;">${teamName}</td>
              <td style="padding:6px 8px;color:var(--muted);">${u.lastSignIn?new Date(u.lastSignIn).toLocaleDateString():'never'}</td>
              <td style="padding:6px 8px;">
                ${isSelf?'<span style="color:var(--muted);font-size:10px;">(you)</span>':`
                  <button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:10px;" onclick="openEditUserModal('${u.uid}','${u.email}','${u.role}','${u.teamId||''}')">Edit</button>
                  <button class="btn btn-danger btn-sm" style="padding:2px 8px;font-size:10px;margin-left:4px;" onclick="adminDeleteUser('${u.uid}','${u.email}')">Delete</button>`}
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;
  } catch(err){
    container.innerHTML=`<div class="alert alert-warn">Failed to load users: ${err.message}</div>`;
  }
}

// ── Section 4: Season Config ──────────────────────────────────────────────────
function renderAdminSeason(){
  document.getElementById('admin-season').innerHTML=`
    <div class="card">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;">🗓 Season Configuration</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Active Season</div>
          <div style="font-weight:700;font-size:16px;color:var(--accent);">${ACTIVE_SEASON}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">Change in src/state.js → ACTIVE_SEASON</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Registration Cutoff</div>
          <div style="font-weight:700;font-size:16px;color:${isRegistrationOpen()?'var(--accent)':'var(--red)'};">${REGISTRATION_CUTOFF}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">${isRegistrationOpen()?'Open':'Closed'}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">League Start</div>
          <div style="font-weight:700;font-size:16px;">11 Jul 2026</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Knockout Day</div>
          <div style="font-weight:700;font-size:16px;">4 Oct 2026</div>
        </div>
      </div>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">To start a new season: change ACTIVE_SEASON in src/state.js, update REGISTRATION_CUTOFF and leagueDates(), then redeploy. Past season data stays in Firestore tagged with the old season name.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="generateAllFixtures()">⚙ Generate All Fixtures</button>
        </div>
      </div>
    </div>`;
}

// ── User action helpers ───────────────────────────────────────────────────────
function toggleNewUserTeam(){
  const role = document.getElementById('new-user-role').value;
  document.getElementById('new-user-team-wrap').style.display = role==='captain' ? '' : 'none';
}

async function adminCreateUser(){
  const email  = document.getElementById('new-user-email').value.trim();
  const pw     = document.getElementById('new-user-pw').value;
  const role   = document.getElementById('new-user-role').value;
  const teamId = document.getElementById('new-user-team')?.value || null;
  if(!email||!pw){ showToast('Email and password required',true); return; }
  if(role==='captain'&&!teamId){ showToast('Select a team for this captain',true); return; }
  try {
    const createUser = firebase.functions('asia-east2').httpsCallable('createUser');
    await createUser({ email, password:pw, role, teamId:teamId||null });
    showToast(`Account created for ${email}`);
    renderAdminUsers();
  } catch(err){ showToast('Failed: ' + err.message, true); }
}

function openEditUserModal(uid, email, role, teamId){
  S.editUserId = uid;
  document.getElementById('edit-user-email-lbl').textContent = email;
  document.getElementById('edit-user-role').value = role;
  document.getElementById('edit-user-team').value = teamId || '';
  toggleEditUserTeam();
  openModal('editUserModal');
}
function toggleEditUserTeam(){
  const role = document.getElementById('edit-user-role').value;
  document.getElementById('edit-user-team-wrap').style.display = role==='captain' ? '' : 'none';
}
async function saveUserRole(){
  const role   = document.getElementById('edit-user-role').value;
  const teamId = document.getElementById('edit-user-team')?.value || null;
  if(role==='captain'&&!teamId){ showToast('Select a team for this captain',true); return; }
  try {
    const setRole = firebase.functions('asia-east2').httpsCallable('setUserRole');
    await setRole({ uid: S.editUserId, role, teamId: teamId||null });
    showToast('Role updated — user must sign out and back in to see the change');
    closeModal('editUserModal');
    renderAdminUsers();
  } catch(err){ showToast('Failed: ' + err.message, true); }
}
async function adminDeleteUser(uid, email){
  if(!confirm(`Delete account for ${email}? This cannot be undone.`)) return;
  try {
    const del = firebase.functions('asia-east2').httpsCallable('deleteUser');
    await del({ uid });
    showToast(`${email} deleted`);
    renderAdminUsers();
  } catch(err){ showToast('Failed: ' + err.message, true); }
}

async function generateAllFixtures(){
  if(!confirm('Generate fixtures for ALL divisions that do not have them yet?')) return;
  for(const g of groups()){
    const has = Object.values(S.matches).some(m=>m.group===g&&m.round);
    if(!has) await generateFixtures(g);
  }
  showToast('All fixtures generated');
}
