// src/render/admin.js
// Admin dashboard — visible only to users with role:'admin'.

let _adminTab = 'active'; // tracks current admin tab

function renderAdminPage(){
  if(!isAdminUser()){
    document.getElementById('admin-container').innerHTML='<div class="alert alert-warn">Admin access required.</div>';
    return;
  }
  // Render the tab shell once, then render the active tab content
  const container = document.getElementById('admin-container');
  // Count pending items for badge
  const disputes  = Object.values(S.matches).filter(m=>m.status==='disputed').length;
  const pending   = Object.values(S.matches).filter(m=>m.status==='pending-confirm').length;
  const unassigned= Object.values(S.teams).filter(t=>t.group==='Unassigned').length;
  const activeBadge = (disputes+pending) > 0
    ? `<span style="background:var(--red);color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;margin-left:4px;">${disputes+pending}</span>` : '';
  const teamBadge = unassigned > 0
    ? `<span style="background:var(--warn);color:#000;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;margin-left:4px;">${unassigned}</span>` : '';

  container.innerHTML = `
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:0;">
      ${[
        ['active',  `Active Season${activeBadge}`],
        ['teams',   `Team Management${teamBadge}`],
        ['users',   'User Management'],
        ['league',  'League Setup'],
      ].map(([id,label])=>`
        <button onclick="switchAdminTab('${id}')" id="atab-${id}"
          style="padding:8px 16px;border:none;border-bottom:2px solid ${_adminTab===id?'var(--brand)':'transparent'};
          background:transparent;color:${_adminTab===id?'var(--text)':'var(--muted)'};
          font-size:13px;font-weight:${_adminTab===id?'600':'400'};cursor:pointer;
          font-family:'Space Grotesk',sans-serif;white-space:nowrap;transition:all 0.15s;">
          ${label}
        </button>`).join('')}
    </div>
    <div id="admin-tab-content"></div>`;

  renderAdminTabContent();
}

function switchAdminTab(tab){
  _adminTab = tab;
  renderAdminPage();
}

function renderAdminTabContent(){
  const el = document.getElementById('admin-tab-content');
  if(!el) return;
  if(_adminTab === 'active'){
    el.innerHTML = `
      <div style="font-weight:700;font-size:13px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">League Status</div>
      <div id="admin-status"></div>
      <div style="font-weight:700;font-size:13px;color:var(--warn);text-transform:uppercase;letter-spacing:1px;margin:20px 0 12px;">Pending Actions</div>
      <div id="admin-actions"></div>`;
    renderAdminStatus();
    renderAdminActions();
  } else if(_adminTab === 'teams'){
    el.innerHTML = `
      <div style="font-weight:700;font-size:13px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Team Management</div>
      <div id="admin-teams-content"></div>`;
    renderAdminTeams();
  } else if(_adminTab === 'users'){
    el.innerHTML = `
      <div style="font-weight:700;font-size:13px;color:var(--brand);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">User Management</div>
      <div id="admin-users"></div>`;
    renderAdminUsers();
  } else if(_adminTab === 'league'){
    el.innerHTML = `
      <div style="font-weight:700;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">League Setup</div>
      <div id="admin-season"></div>`;
    renderAdminSeason();
    renderDivisionRows();
  }
}

// ── Team Management tab ───────────────────────────────────────────────────────
function renderAdminTeams(){
  const container = document.getElementById('admin-teams-content');
  if(!container) return;
  const unassigned = Object.values(S.teams).filter(t=>t.group==='Unassigned');
  const DIVISIONS  = getDivisions();
  const allGroups  = groups();

  let html = '';
  if(unassigned.length){
    html += `<div class="alert alert-warn" style="margin-bottom:16px;">
      ⚠ ${unassigned.length} team${unassigned.length!==1?'s':''} awaiting division assignment —
      ${unassigned.map(t=>`<strong>${t.name}</strong>`).join(', ')}
    </div>`;
  }

  // Group tabs
  html += `<div class="group-tabs" style="margin-bottom:16px;">
    ${allGroups.map(g=>`<button class="group-tab" onclick="filterAdminTeams('${g}',this)" style="padding:6px 14px;border-radius:6px;border:none;background:var(--surface2);color:var(--muted);font-size:12px;cursor:pointer;margin-right:4px;">${g}</button>`).join('')}
  </div>
  <div id="admin-teams-list"></div>`;

  container.innerHTML = html;

  // Auto-click Unassigned if there are any, else first group
  const firstTab = container.querySelector('.group-tab');
  if(firstTab){
    const unassignedTab = [...container.querySelectorAll('.group-tab')]
      .find(b=>b.textContent.trim()==='Unassigned');
    filterAdminTeams(unassigned.length ? 'Unassigned' : allGroups[0],
      unassigned.length ? unassignedTab : firstTab);
  }
}

function filterAdminTeams(group, btn){
  // Highlight active tab
  document.querySelectorAll('#admin-teams-content .group-tab').forEach(b=>{
    b.style.background='var(--surface2)';b.style.color='var(--muted)';b.style.fontWeight='400';
  });
  if(btn){ btn.style.background='var(--brand)';btn.style.color='#fff';btn.style.fontWeight='600'; }

  const DIVISIONS = getDivisions();
  const teams = teamsByGroup(group);
  const list  = document.getElementById('admin-teams-list');
  if(!list) return;
  if(!teams.length){ list.innerHTML='<div style="color:var(--muted);font-size:13px;">No teams in this group.</div>'; return; }

  list.innerHTML = `<div class="grid-2">${teams.map(t=>`
    <div class="card" style="border-left:3px solid ${t.group==='Unassigned'?'var(--warn)':'var(--accent)'};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:700;font-size:14px;">${t.name}</div>
          ${t.captainEmail?`<div style="font-size:10px;color:var(--muted);">Registered by: ${t.captainEmail}</div>`:''}
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
          <select class="form-select" id="div-sel-${t.id}" style="font-size:11px;padding:3px 6px;width:150px;">
            ${DIVISIONS.map(d=>`<option value="${d}"${d===t.group?' selected':''}>${d}</option>`).join('')}
          </select>
          <button class="btn btn-${t.group==='Unassigned'?'primary':'ghost'} btn-sm"
            onclick="assignDivision('${t.id}')">${t.group==='Unassigned'?'Assign':'Move'}</button>
          <button class="btn btn-ghost btn-sm" onclick="openRosterEdit('${t.id}')">✎ Roster</button>
          <button class="btn btn-danger btn-sm" onclick="adminDeleteTeam('${t.id}','${t.name.replace(/'/g,"\\'")}')">✕</button>
        </div>
      </div>
      <div>${(t.players||[]).map((p,i)=>{
        const nprp=p.nprp?`<span style="font-size:9px;color:var(--brand);font-weight:600;"> NPRP ${p.nprp}</span>`:'';
        return `<div style="font-size:12px;color:var(--muted);margin-bottom:1px;">
          👤 ${p.name||'—'}${i===0?' <span style="font-size:9px;color:var(--accent);background:rgba(74,222,128,0.1);padding:1px 4px;border-radius:4px;">cap</span>':''}
          ${p.phone?`· ${p.phone}`:''}${nprp}</div>`;
      }).join('')}</div>
      ${(()=>{const r=(t.players||[]).map(p=>parseFloat(p.nprp)).filter(n=>!isNaN(n));
        return r.length?`<div style="font-size:10px;color:var(--brand);margin-top:6px;">avg NPRP ${(r.reduce((a,b)=>a+b,0)/r.length).toFixed(1)}</div>`:'';}
      )()}
    </div>`).join('')}</div>`;
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
  const rescheduleRequests = matches.filter(m=>m.rescheduleRequest);

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

  const rescheduleCards = rescheduleRequests.length
    ? rescheduleRequests.map(m=>{
        const r=m.rescheduleRequest;
        const requester=S.teams[r.requestedBy]?.name||r.requestedBy;
        return `<div class="card" style="border-left:3px solid var(--brand);margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
            <div>
              <div style="font-weight:600;font-size:13px;">${tn(m.t1)} vs ${tn(m.t2)}</div>
              <div style="font-size:11px;color:var(--muted);">${m.group} · Current: ${m.date||'unscheduled'} ${m.time||''} Court ${m.court||'?'}</div>
              <div style="font-size:11px;color:var(--brand);margin-top:3px;">Proposed: ${r.proposedDate} ${r.proposedTime} Court ${r.proposedCourt} — by ${requester}</div>
              ${r.reason?`<div style="font-size:11px;color:var(--muted);margin-top:2px;font-style:italic;">"${r.reason}"</div>`:''}
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              <button class="btn btn-primary btn-sm" onclick="approveReschedule('${m.id}')">✓ Approve</button>
              <button class="btn btn-danger btn-sm" onclick="rejectReschedule('${m.id}')">✕ Reject</button>
            </div>
          </div>
        </div>`;
      }).join('')
    : '<div style="color:var(--muted);font-size:13px;">No reschedule requests pending.</div>';

  document.getElementById('admin-actions').innerHTML=`
    <div class="alert alert-blue" style="margin-bottom:14px;font-size:12px;">
      <strong>What this section shows:</strong> Matches needing your attention.
      <strong>Reschedule requests</strong> are captain-submitted slot changes pending your approval.
      <strong>Disputed scores</strong> require your arbitration as final arbiter per league rules.
      <strong>Awaiting confirmation</strong> resolve themselves but you can intervene if a captain is unresponsive.
    </div>
    ${rescheduleRequests.length?`<div class="card" style="margin-bottom:12px;border:1px solid var(--brand);">
      <div style="font-weight:700;font-size:13px;color:var(--brand);margin-bottom:10px;">📅 Reschedule Requests (${rescheduleRequests.length})</div>
      ${rescheduleCards}
    </div>`:''}
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
  const locked = c.seasonLocked;// Fixture generation state: check each division (excluding Unassigned)
  const activeDivs = groups().filter(g => g !== 'Unassigned');
  const divsWithFixtures = activeDivs.filter(g =>
    Object.values(S.matches).some(m => m.group === g && m.round)
  );
  const allFixturesGenerated = activeDivs.length > 0 && divsWithFixtures.length === activeDivs.length;
  const someFixturesGenerated = divsWithFixtures.length > 0;
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

    <!-- ── Division Manager ── -->
    <div class="card" style="margin-bottom:12px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:4px;">🏅 Division Manager</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:12px;">
        Add, remove, or rename divisions. Set NPRP ranges to drive auto-seeding.
        Divisions are ordered highest tier first — this order controls seeding priority and display order throughout the app.
        Changes take effect immediately for all users.
      </div>
      <div id="div-manager-rows"></div>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="addDivisionRow()">+ Add Division</button>
      <div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="saveDivisions()">Save Divisions</button>
        <p id="div-msg" style="font-size:11px;min-height:16px;margin:0;"></p>
      </div>
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
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
      <div style="margin-bottom:12px;">
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
          ${allFixturesGenerated
            ? `<button class="btn btn-ghost btn-sm" style="white-space:nowrap;opacity:0.45;cursor:not-allowed;" disabled>✓ Fixtures Generated</button>`
            : `<button class="btn btn-ghost btn-sm" style="white-space:nowrap;" onclick="generateAllFixtures()">⚙ Generate All Fixtures</button>`
          }
          <div style="font-size:11px;color:var(--muted);">
            ${allFixturesGenerated
              ? `All ${activeDivs.length} division${activeDivs.length!==1?'s':''} have fixtures. To add a team after generation, schedule their matches manually.`
              : someFixturesGenerated
                ? `${divsWithFixtures.length} of ${activeDivs.length} divisions have fixtures. Running again will generate for remaining divisions only.
                   <strong>Only run after registration closes (${REGISTRATION_CUTOFF})</strong>.`
                : `Creates the full round-robin match schedule for every division.
                   <strong>Only run this after registration closes (${REGISTRATION_CUTOFF})</strong> —
                   any team added after generation gets no automatic matches and must be scheduled manually.`
            }
          </div>
        </div>
        ${!locked?`<div style="display:flex;align-items:flex-start;gap:10px;">
          <button class="btn btn-ghost btn-sm" style="white-space:nowrap;" onclick="lockSeasonNow()">🔒 Lock Season</button>
          <div style="font-size:11px;color:var(--muted);">
            Prevents accidental season change once play has started. Run this after generating fixtures.
            A locked season blocks "Start New Season" until you explicitly unlock it —
            unlocking requires a second confirmation and is only possible from this League Setup tab.
            ${locked?'<strong style="color:var(--red);">Currently locked.</strong> Use the Unlock button above to enable season changes.':''}
          </div>
        </div>`:''}
      </div>
    </div>`;
}

// ── Division Manager ────────────────────────────────────────────────────────

function renderDivisionRows(){
  const divs = S.config?.divisions || [
    { name:'Gold Division',        nprpMin:4.0, nprpMax:7.0 },
    { name:'High Silver Division', nprpMin:3.0, nprpMax:3.99 },
    { name:'Low Silver Division',  nprpMin:0.0, nprpMax:2.99 }
  ];
  const el = document.getElementById('div-manager-rows');
  if(!el) return;
  el.innerHTML = divs.map((d,i) => `
    <div class="div-row" data-index="${i}" style="display:grid;grid-template-columns:1fr 90px 90px auto auto;gap:8px;align-items:center;margin-bottom:8px;">
      <input class="form-input" placeholder="Division name" value="${d.name||''}"
        style="font-size:12px;" oninput="updateDivRow(${i},'name',this.value)">
      <div>
        <div style="font-size:9px;color:var(--muted);margin-bottom:2px;">NPRP Min</div>
        <input class="form-input" type="number" min="0" max="7" step="0.1" value="${d.nprpMin}"
          style="font-size:12px;" oninput="updateDivRow(${i},'nprpMin',parseFloat(this.value))">
      </div>
      <div>
        <div style="font-size:9px;color:var(--muted);margin-bottom:2px;">NPRP Max</div>
        <input class="form-input" type="number" min="0" max="7" step="0.1" value="${d.nprpMax}"
          style="font-size:12px;" oninput="updateDivRow(${i},'nprpMax',parseFloat(this.value))">
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${i>0?`<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px;" onclick="moveDivRow(${i},-1)">▲</button>`:'<div style="height:24px;"></div>'}
        ${i<divs.length-1?`<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px;" onclick="moveDivRow(${i},1)">▼</button>`:'<div style="height:24px;"></div>'}
      </div>
      <button class="btn btn-danger btn-sm" style="font-size:10px;" onclick="removeDivRow(${i})"
        ${divs.length<=1?'disabled':''}>✕</button>
    </div>`).join('');
}

// In-memory working copy of divisions being edited
let _editDivs = null;

function getEditDivs(){
  if(!_editDivs) _editDivs = JSON.parse(JSON.stringify(S.config?.divisions || [
    { name:'Gold Division',        nprpMin:4.0, nprpMax:7.0 },
    { name:'High Silver Division', nprpMin:3.0, nprpMax:3.99 },
    { name:'Low Silver Division',  nprpMin:0.0, nprpMax:2.99 }
  ]));
  return _editDivs;
}

function updateDivRow(i, field, val){
  getEditDivs()[i][field] = val;
}

function moveDivRow(i, dir){
  const divs = getEditDivs();
  const j = i + dir;
  if(j<0||j>=divs.length) return;
  [divs[i],divs[j]] = [divs[j],divs[i]];
  renderDivisionRows();
}

function removeDivRow(i){
  const divs = getEditDivs();
  if(divs.length <= 1){ showToast('Must have at least one division', true); return; }
  if(!confirm(`Remove "${divs[i].name}"? Teams assigned to this division will not be moved automatically.`)) return;
  divs.splice(i,1);
  renderDivisionRows();
}

function addDivisionRow(){
  const divs = getEditDivs();
  divs.push({ name:'New Division', nprpMin:0.0, nprpMax:7.0 });
  renderDivisionRows();
}

async function saveDivisions(){
  const divs = getEditDivs();
  const msgEl = document.getElementById('div-msg');
  // Validate: all names non-empty, all ranges valid
  for(const d of divs){
    if(!d.name.trim()){ showToast('All divisions must have a name', true); return; }
    if(isNaN(d.nprpMin)||isNaN(d.nprpMax)){ showToast(`Invalid NPRP range for ${d.name}`, true); return; }
    if(d.nprpMin > d.nprpMax){ showToast(`${d.name}: Min must be ≤ Max`, true); return; }
  }
  try {
    await ConfigDB.save({ divisions: divs });
    _editDivs = null; // reset working copy — will reload from config
    msgEl.style.color='#4ade80';
    msgEl.textContent='Divisions saved — seeding thresholds updated immediately.';
    addLog(`Divisions updated: ${divs.map(d=>d.name).join(', ')}`,'var(--brand)');
  } catch(err){ msgEl.style.color='#f87171'; msgEl.textContent='Failed: '+err.message; }
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
async function approveReschedule(matchId){
  const m=S.matches[matchId]; const r=m.rescheduleRequest;
  if(!r){showToast('No request found',true);return;}
  const conflict=Object.values(S.matches).find(x=>x.id!==matchId&&x.date===r.proposedDate&&x.time===r.proposedTime&&parseInt(x.court)===r.proposedCourt);
  if(conflict){showToast(`Conflict: ${tn(conflict.t1)} vs ${tn(conflict.t2)} already booked there`,true);return;}
  try{
    await MatchesDB.update(matchId,{date:r.proposedDate,time:r.proposedTime,court:r.proposedCourt,rescheduleRequest:null});
    addLog(`✓ Reschedule approved: ${tn(m.t1)} vs ${tn(m.t2)} → ${r.proposedDate} ${r.proposedTime}`,'var(--accent)');
    showToast('Reschedule approved — slot updated');
  }catch(err){showToast('Failed: '+err.message,true);}
}
async function rejectReschedule(matchId){
  const m=S.matches[matchId];
  if(!confirm(`Reject reschedule for ${tn(m.t1)} vs ${tn(m.t2)}?\n\nMatch stays at current slot.`)) return;
  try{
    await MatchesDB.update(matchId,{rescheduleRequest:null});
    addLog(`✕ Reschedule rejected: ${tn(m.t1)} vs ${tn(m.t2)} stays at ${m.date} ${m.time}`,'var(--red)');
    showToast('Request rejected');
  }catch(err){showToast('Failed: '+err.message,true);}
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
  let total=0;
  for(const g of groups()){
    const has=Object.values(S.matches).some(m=>m.group===g&&m.round);
    if(!has){ await generateFixtures(g); total++; }
  }
  showToast(total>0?`Fixtures generated for ${total} division${total!==1?'s':''}`:'All divisions already have fixtures');
  renderAdminPage(); // re-render current tab rather than assuming a specific element exists
}
