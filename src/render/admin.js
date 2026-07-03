// src/render/admin.js
// Admin dashboard — visible only to users with role:'admin'.

function renderAdminPage(){
  if(!isAdminUser()){
    document.getElementById('admin-container').innerHTML='<div class="alert alert-warn">Admin access required.</div>';
    return;
  }
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

  const fixtureStatus = divs.length ? divs.map(g => {
    const hasFixtures = matches.some(m => m.group===g && m.round);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:13px;">${g}</span>
      <span class="chip ${hasFixtures?'chip-done':'chip-pending'}">${hasFixtures?'Fixtures generated':'No fixtures yet'}</span>
    </div>`;
  }).join('') : '<div style="color:var(--muted);font-size:13px;padding:8px 0;">No divisions yet — teams must register first.</div>';

  const cutoff   = new Date(REGISTRATION_CUTOFF);
  const today    = new Date();
  const daysLeft = Math.ceil((cutoff - today) / (1000*60*60*24));

  document.getElementById('admin-status').innerHTML=`
    <div class="alert alert-blue" style="margin-bottom:14px;font-size:12px;">
      <strong>What this section shows:</strong> A real-time snapshot of the current season's health.
      Use it to confirm teams are registering, check whether fixtures have been generated per division,
      and monitor how many days remain before registration closes. Once registration closes on
      <strong>${REGISTRATION_CUTOFF}</strong>, use the "Generate All Fixtures" button in Season
      Configuration to create the round-robin schedule for each division.
    </div>
    <div class="grid-3" style="margin-bottom:16px;">
      <div class="card" style="text-align:center;">
        <div style="font-size:28px;font-weight:700;color:var(--accent);">${teams.length}</div>
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Teams registered</div>
        <div style="font-size:10px;color:var(--muted);margin-top:4px;">Season: ${ACTIVE_SEASON}</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-size:28px;font-weight:700;color:var(--brand);">${matches.filter(m=>m.status==='confirmed').length}</div>
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Matches confirmed</div>
        <div style="font-size:10px;color:var(--muted);margin-top:4px;">of ${matches.length} total fixtures</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-size:28px;font-weight:700;color:${daysLeft<=2?'var(--red)':daysLeft<=5?'var(--warn)':'var(--text)'};">${daysLeft>0?daysLeft:'CLOSED'}</div>
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Days to reg. cutoff</div>
        <div style="font-size:10px;color:var(--muted);margin-top:4px;">Cutoff: ${REGISTRATION_CUTOFF}</div>
      </div>
    </div>
    <div class="card">
      <div style="font-weight:700;margin-bottom:10px;font-size:13px;">Fixture Status by Division</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px;">Fixtures must be generated once per division after registration closes. Once generated they cannot be re-generated — new teams added after this point must be scheduled manually by admin.</div>
      ${fixtureStatus}
    </div>`;
}

// ── Section 2: Pending Actions ────────────────────────────────────────────────
function renderAdminActions(){
  const matches  = Object.values(S.matches);
  const disputed = matches.filter(m=>m.status==='disputed');
  const pending  = matches.filter(m=>m.status==='pending-confirm');

  const disputeCards = disputed.length
    ? disputed.map(m=>`
        <div class="card" style="border-left:3px solid var(--red);margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div>
              <div style="font-weight:600;font-size:13px;">${tn(m.t1)} vs ${tn(m.t2)} <span class="chip chip-dispute">DISPUTED</span></div>
              <div style="font-size:11px;color:var(--muted);">${m.group} · ${m.date||'no date'} · Court ${m.court||'?'}</div>
              ${m.scoreData?`<div style="font-size:11px;color:var(--red);margin-top:3px;">Last submitted: ${scoreDisplay(m)}</div>`:''}
            </div>
            <button class="btn btn-danger btn-sm" onclick="openDisputeResolve('${m.id}')">⚖ Resolve</button>
          </div>
        </div>`).join('')
    : '<div style="color:var(--muted);font-size:13px;">No disputed matches — nothing needs your arbitration right now.</div>';

  const pendingCards = pending.length
    ? pending.map(m=>`
        <div class="card" style="border-left:3px solid var(--warn);margin-bottom:8px;">
          <div style="font-weight:600;font-size:13px;">${tn(m.t1)} vs ${tn(m.t2)}</div>
          <div style="font-size:11px;color:var(--muted);">${m.group} · Score submitted by ${tn(m.submittedBy)} — waiting on ${tn(m.t1===m.submittedBy?m.t2:m.t1)} to confirm</div>
          <div style="font-size:10px;color:var(--muted);margin-top:3px;">If the opposing captain is unresponsive, you can confirm or dispute this score directly from the Submit Score page.</div>
        </div>`).join('')
    : '<div style="color:var(--muted);font-size:13px;">No scores awaiting confirmation.</div>';

  document.getElementById('admin-actions').innerHTML=`
    <div class="alert alert-blue" style="margin-bottom:14px;font-size:12px;">
      <strong>What this section shows:</strong> Matches that need your attention right now.
      <strong>Disputed scores</strong> occur when a captain rejects the opponent's submitted score — you
      are the final arbiter per league rules. Click "Resolve" to enter the correct score; your decision
      is final and does not require opponent confirmation.
      <strong>Awaiting confirmation</strong> are scores submitted by one captain but not yet confirmed
      by the other — these resolve themselves, but you can intervene if a captain is unresponsive.
    </div>
    <div class="card" style="margin-bottom:12px;">
      <div style="font-weight:700;font-size:13px;color:var(--red);margin-bottom:10px;">⚖ Disputed Scores (${disputed.length})</div>
      ${disputeCards}
    </div>
    <div class="card">
      <div style="font-weight:700;font-size:13px;color:var(--warn);margin-bottom:10px;">⏳ Awaiting Confirmation (${pending.length})</div>
      ${pendingCards}
    </div>`;
}

// ── Section 3: User Management ────────────────────────────────────────────────
async function renderAdminUsers(){
  const container = document.getElementById('admin-users');
  container.innerHTML=`
    <div class="alert alert-blue" style="margin-bottom:14px;font-size:12px;">
      <strong>What this section does:</strong> Create Firebase login accounts for captains and players,
      and assign their role. Three roles exist:
      <strong>Viewer</strong> — read-only access, can see standings and schedule but cannot submit scores or schedule matches.
      <strong>Captain</strong> — linked to one specific team; can schedule that team's matches, submit and confirm scores, and edit their roster.
      <strong>Admin</strong> — full access to everything including this dashboard.
      <br><br>
      <strong>Workflow for adding a captain:</strong> Create their account here with a temporary password →
      their role is set to Captain and linked to their team → share the URL and temporary password with them →
      they use "Forgot password" to set their own. They must sign out and back in after any role change.
    </div>
    <div style="color:var(--muted);font-size:13px;">Loading users...</div>`;

  try {
    const listUsers = firebase.app().functions('asia-east2').httpsCallable('listUsers');
    const result    = await listUsers({});
    const users     = result.data.users;
    const teamOptions = Object.values(S.teams)
      .map(t=>`<option value="${t.id}">${t.name} (${t.group})</option>`).join('');

    container.innerHTML=`
      <div class="alert alert-blue" style="margin-bottom:14px;font-size:12px;">
        <strong>What this section does:</strong> Create Firebase login accounts for captains and players,
        and assign their role. Three roles exist:
        <strong>Viewer</strong> — read-only, can see standings and schedule.
        <strong>Captain</strong> — linked to one team; can schedule matches, submit and confirm scores, edit roster.
        <strong>Admin</strong> — full access including this dashboard.
        <br><br>
        <strong>Workflow:</strong> Create account → share URL + temp password → they use "Forgot password" to set their own.
        Role changes take effect after the user signs out and back in.
      </div>
      <div class="card" style="margin-bottom:12px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;">➕ Create Account</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:12px;">Create a login for a captain or team member. Set a temporary password — they should reset it via "Forgot password" on first login.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
          <div><label class="form-label" style="font-size:10px;">Email</label><input class="form-input" id="new-user-email" placeholder="captain@email.com" style="width:200px;"></div>
          <div><label class="form-label" style="font-size:10px;">Temp Password</label><input class="form-input" id="new-user-pw" placeholder="Min 6 chars" style="width:150px;"></div>
          <div><label class="form-label" style="font-size:10px;">Role</label>
            <select class="form-select" id="new-user-role" onchange="toggleNewUserTeam()" style="width:120px;">
              <option value="viewer">Viewer</option>
              <option value="captain">Captain</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div id="new-user-team-wrap" style="display:none;">
            <label class="form-label" style="font-size:10px;">Team</label>
            <select class="form-select" id="new-user-team" style="width:200px;">
              <option value="">— select team —</option>${teamOptions}
            </select>
          </div>
          <button class="btn btn-primary btn-sm" onclick="adminCreateUser()">Create Account</button>
        </div>
      </div>
      <div class="card">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;">👥 All Users (${users.length})</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:12px;">Edit a user's role or linked team at any time. To reassign a captain to a different team — e.g. if leadership changes mid-season — click Edit, change the linked team, and save. The user must sign out and back in for the change to take effect.</div>
        <table style="width:100%;font-size:12px;border-collapse:collapse;">
          <thead><tr style="color:var(--muted);text-align:left;font-size:10px;text-transform:uppercase;">
            <th style="padding:6px 8px;">Email</th>
            <th style="padding:6px 8px;">Role</th>
            <th style="padding:6px 8px;">Linked Team</th>
            <th style="padding:6px 8px;">Last Sign-in</th>
            <th style="padding:6px 8px;">Actions</th>
          </tr></thead>
          <tbody>${users.map(u=>{
            const teamName  = u.teamId && S.teams[u.teamId] ? S.teams[u.teamId].name : '—';
            const roleColor = u.role==='admin'?'var(--gold)':u.role==='captain'?'var(--brand)':'var(--muted)';
            const isSelf    = u.uid === firebase.auth().currentUser?.uid;
            return `<tr style="border-top:1px solid var(--border);">
              <td style="padding:8px;">${u.email}${u.displayName?`<div style="font-size:10px;color:var(--muted);">${u.displayName}</div>`:''}</td>
              <td style="padding:8px;"><span style="color:${roleColor};font-weight:600;">${u.role}</span></td>
              <td style="padding:8px;">${u.teamName || (u.teamId && S.teams[u.teamId] ? S.teams[u.teamId].name : '—')}</td>
              <td style="padding:8px;color:var(--muted);">${u.lastSignIn?new Date(u.lastSignIn).toLocaleDateString('en-HK'):'never'}</td>
              <td style="padding:8px;">
                ${isSelf
                  ?'<span style="font-size:10px;color:var(--muted);">(you)</span>'
                  :`<button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:10px;" onclick="openEditUserModal('${u.uid}','${u.email}','${u.role}','${u.teamId||''}')">Edit</button>
                    <button class="btn btn-danger btn-sm" style="padding:2px 8px;font-size:10px;margin-left:4px;" onclick="adminDeleteUser('${u.uid}','${u.email}')">Delete</button>`}
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;
  } catch(err){
    container.innerHTML=`
      <div class="alert alert-warn">Failed to load users: ${err.message}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:8px;">This section requires the Cloud Functions to be deployed and your account to have admin role. If you just deployed, wait 30 seconds and refresh.</div>`;
  }
}

// ── Section 4: Season Config ──────────────────────────────────────────────────
function renderAdminSeason(){
  const c = S.config || {};
  const locked = c.seasonLocked;
  document.getElementById('admin-season').innerHTML=`
    <div class="alert alert-blue" style="margin-bottom:14px;font-size:12px;">
      <strong>What this section does:</strong> Controls all league dates, season label, and entry fee.
      Changes take effect immediately for all users — no redeploy needed.
      <br><br>
      <strong>Season label</strong> drives the nav brand, browser title, and login screen.
      <strong>Active season</strong> is the Firestore filter — changing it hides all current data and starts a clean slate.
      The season is <strong>locked</strong> once fixtures are generated to prevent accidental resets.
    </div>
    <div class="card" style="margin-bottom:12px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;">📋 Current Season Info</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Season Label (shown in UI)</div>
          <input class="form-input" id="cfg-label" value="${c.seasonLabel||''}" placeholder="e.g. Summer League 2026">
        </div>
        <div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Entry Fee</div>
          <input class="form-input" id="cfg-fee" value="${c.entryFee||'HKD 3,500'}" placeholder="HKD 3,500">
        </div>
        <div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Registration Cutoff</div>
          <input class="form-input" id="cfg-cutoff" type="date" value="${c.registrationCutoff||''}">
        </div>
        <div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">League Start</div>
          <input class="form-input" id="cfg-start" type="date" value="${c.leagueStart||''}">
        </div>
        <div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">League End (last match weekend)</div>
          <input class="form-input" id="cfg-end" type="date" value="${c.leagueEnd||''}">
        </div>
        <div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Knockout Day</div>
          <input class="form-input" id="cfg-knockout" type="date" value="${c.knockoutDay||''}">
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="saveLeagueConfig()">Save Changes</button>
      <p id="cfg-msg" style="font-size:11px;min-height:16px;margin-top:8px;"></p>
    </div>

    <div class="card" style="border:1px solid ${locked?'var(--red)':'var(--border)'};">
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;">🔄 Season Change ${locked?'<span style="color:var(--red);font-size:11px;">· LOCKED — fixtures generated</span>':''}</div>
      ${locked
        ? `<div style="font-size:12px;color:var(--muted);">Season is locked because fixtures have been generated. To start a new season you must first confirm all matches are complete.</div>
           <button class="btn btn-danger btn-sm" style="margin-top:10px;" onclick="unlockSeason()">⚠ Unlock Season (use with caution)</button>`
        : `<div style="font-size:12px;color:var(--muted);margin-bottom:12px;">Changing the active season immediately hides ALL current teams, matches, and standings — they remain in Firestore tagged with the old season name. New teams register under the new season. This cannot be undone without a code change.</div>
           <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
             <div><label class="form-label" style="font-size:10px;">Season Slug</label>
               <select class="form-select" id="cfg-new-slug">
                 <option value="summer">summer</option>
                 <option value="winter">winter</option>
                 <option value="spring">spring</option>
               </select>
             </div>
             <div><label class="form-label" style="font-size:10px;">Year</label>
               <input class="form-input" id="cfg-new-year" value="${new Date().getFullYear()}" placeholder="2027">
             </div>
             <div style="display:flex;align-items:flex-end;">
               <button class="btn btn-danger btn-sm" style="width:100%;" onclick="changeSeasonWithGuard()">Start New Season</button>
             </div>
           </div>`
      }
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-ghost btn-sm" onclick="generateAllFixtures()">⚙ Generate All Fixtures</button>
      ${!locked?`<button class="btn btn-ghost btn-sm" onclick="lockSeasonNow()">🔒 Lock Season</button>`:''}
    </div>`;
}

async function saveLeagueConfig(){
  const msgEl = document.getElementById('cfg-msg');
  msgEl.style.color = '#f87171';
  msgEl.textContent = '';
  try {
    await ConfigDB.save({
      seasonLabel:        document.getElementById('cfg-label').value.trim(),
      entryFee:           document.getElementById('cfg-fee').value.trim(),
      registrationCutoff: document.getElementById('cfg-cutoff').value,
      leagueStart:        document.getElementById('cfg-start').value,
      leagueEnd:          document.getElementById('cfg-end').value,
      knockoutDay:        document.getElementById('cfg-knockout').value,
    });
    msgEl.style.color = '#4ade80';
    msgEl.textContent = 'Saved — changes are live for all users immediately.';
  } catch(err){ msgEl.textContent = 'Failed: ' + err.message; }
}

async function changeSeasonWithGuard(){
  const slug = document.getElementById('cfg-new-slug').value;
  const year = document.getElementById('cfg-new-year').value.trim();
  if(!year || isNaN(year)){ showToast('Enter a valid year', true); return; }
  const newSeason = `${year}-${slug}`;
  const label     = `${slug.charAt(0).toUpperCase()+slug.slice(1)} League ${year}`;
  const confirmed = confirm(
    `⚠ START NEW SEASON: ${label}\n\n` +
    `Active season will change from "${ACTIVE_SEASON}" to "${newSeason}".\n\n` +
    `ALL current teams, matches, and standings will be hidden immediately.\n` +
    `They are NOT deleted — they remain in Firestore tagged "${ACTIVE_SEASON}".\n\n` +
    `This affects every logged-in user right now. Continue?`
  );
  if(!confirmed) return;
  try {
    await ConfigDB.changeSeason(newSeason, label, slug, year);
    showToast(`Season changed to ${label}`);
    renderAdminSeason();
  } catch(err){ showToast('Blocked: ' + err.message, true); }
}

async function lockSeasonNow(){
  if(!confirm('Lock this season? Admins will need to unlock manually to start a new one.')) return;
  await ConfigDB.lockSeason();
  showToast('Season locked');
  renderAdminSeason();
}

async function unlockSeason(){
  if(!confirm('⚠ Unlock season? This allows starting a new season which hides all current data.')) return;
  await db.collection('config').doc('league').set({ seasonLocked: false }, { merge: true });
  showToast('Season unlocked');
  renderAdminSeason();
}
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
  const teamName = teamId && S.teams[teamId] ? S.teams[teamId].name : null;
  if(!email||!pw){ showToast('Email and password required',true); return; }
  if(role==='captain'&&!teamId){ showToast('Select a team for this captain',true); return; }
  try {
    const createUser = firebase.app().functions('asia-east2').httpsCallable('createUser');
    await createUser({ email, password:pw, role, teamId:teamId||null, teamName });
    showToast(`Account created for ${email}`);
    renderAdminUsers();
  } catch(err){ showToast('Failed: ' + err.message, true); }
}

function openEditUserModal(uid, email, role, teamId){
  S.editUserId = uid;
  document.getElementById('edit-user-email-lbl').textContent = email;
  document.getElementById('edit-user-role').value = role;
  // Populate team options
  const sel = document.getElementById('edit-user-team');
  sel.innerHTML = '<option value="">— no team —</option>' +
    Object.values(S.teams).map(t=>`<option value="${t.id}">${t.name} (${t.group})</option>`).join('');
  sel.value = teamId || '';
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
  const teamName = teamId && S.teams[teamId] ? S.teams[teamId].name : null;
  if(role==='captain'&&!teamId){ showToast('Select a team for this captain',true); return; }
  try {
    const setRole = firebase.app().functions('asia-east2').httpsCallable('setUserRole');
    await setRole({ uid: S.editUserId, role, teamId: teamId||null, teamName });
    showToast('Role updated — user must sign out and back in for the change to take effect');
    closeModal('editUserModal');
    renderAdminUsers();
  } catch(err){ showToast('Failed: ' + err.message, true); }
}
async function adminDeleteUser(uid, email){
  if(!confirm(`Delete account for ${email}? This cannot be undone.`)) return;
  try {
    const del = firebase.app().functions('asia-east2').httpsCallable('deleteUser');
    await del({ uid });
    showToast(`${email} deleted`);
    renderAdminUsers();
  } catch(err){ showToast('Failed: ' + err.message, true); }
}

async function generateAllFixtures(){
  if(!confirm('Generate fixtures for ALL divisions that do not have them yet? Only do this after registration closes.')) return;
  for(const g of groups()){
    const has = Object.values(S.matches).some(m=>m.group===g&&m.round);
    if(!has) await generateFixtures(g);
  }
  showToast('All fixtures generated');
  renderAdminStatus();
}
