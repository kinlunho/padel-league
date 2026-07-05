// src/render/profile.js
// Player profile page — My Profile sub-tab + Player Directory sub-tab.
// My Profile: photo, hand, position, NPRP trend chart, match history, stats.
// Directory: searchable list of all players, click-through to their profile.

// ── Sub-tab routing ───────────────────────────────────────────────────────────

function renderProfilePage(){
  const tab = S.profileTab || 'mine';
  document.querySelectorAll('.profile-tab').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.profile-tab[onclick*="${tab}"]`);
  if(activeBtn) activeBtn.classList.add('active');
  if(tab === 'mine') renderMyProfile();
  else if(tab === 'directory') renderPlayerDirectory();
  else if(tab === 'settings') renderProfileSettings();
}

function setProfileTab(tab, el){
  S.profileTab = tab;
  document.querySelectorAll('.profile-tab').forEach(b => b.classList.remove('active'));
  if(el) el.classList.add('active');
  if(tab === 'mine') renderMyProfile();
  else if(tab === 'directory') renderPlayerDirectory();
  else if(tab === 'settings') renderProfileSettings();
}

// ── My Profile ────────────────────────────────────────────────────────────────

async function renderMyProfile(){
  const container = document.getElementById('profile-content');
  if(!S.userEmail){ container.innerHTML='<div style="color:var(--muted);">Sign in to view your profile.</div>'; return; }
  container.innerHTML = '<div style="color:var(--muted);font-size:13px;">Loading profile…</div>';

  const uid = firebase.auth().currentUser?.uid;
  if(!uid){ container.innerHTML='<div style="color:var(--muted);">Could not load profile.</div>'; return; }

  // Load profile doc — create if missing
  await PlayersDB.ensureProfile(uid, S.userEmail, firebase.auth().currentUser?.displayName);
  const profile = await PlayersDB.getProfile(uid);
  if(!profile){ container.innerHTML='<div style="color:var(--muted);">Profile not found.</div>'; return; }

  // Get team and match stats
  const myTeamId = S.myTeamId;
  const team = myTeamId ? S.teams[myTeamId] : null;
  const allMatches = Object.values(S.matches).filter(m =>
    myTeamId && (m.t1===myTeamId||m.t2===myTeamId) && m.status==='confirmed'
  ).sort((a,b) => (b.date||'').localeCompare(a.date||''));

  const wins   = allMatches.filter(m => { const r=calcResult(m.scoreData); return r&&((r.result==='win1'&&m.t1===myTeamId)||(r.result==='win2'&&m.t2===myTeamId)); }).length;
  const draws  = allMatches.filter(m => { const r=calcResult(m.scoreData); return r&&r.result==='draw'; }).length;
  const losses = allMatches.length - wins - draws;
  const winRate = allMatches.length ? Math.round((wins/allMatches.length)*100) : 0;

  const hand     = profile.hand     || null;
  const position = profile.position || null;
  const photoURL = profile.photoURL || null;
  const nprpHistory = (profile.nprpHistory||[]).sort((a,b)=>a.season.localeCompare(b.season));

  // My player record from roster (for current NPRP)
  const myPlayerRecord = team?.players?.find(p => p.claimedByEmail === S.userEmail);
  const currentNPRP = myPlayerRecord?.nprp || null;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:start;margin-bottom:24px;flex-wrap:wrap;">

      <!-- Photo -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
        <div id="profile-photo-wrap" style="width:90px;height:90px;border-radius:50%;overflow:hidden;background:var(--surface-1);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="document.getElementById('photo-input').click()">
          ${photoURL
            ? `<img src="${photoURL}" style="width:100%;height:100%;object-fit:cover;">`
            : `<span style="font-size:32px;">👤</span>`}
        </div>
        <input type="file" id="photo-input" accept="image/*" style="display:none;" onchange="uploadProfilePhoto(this)">
        <button class="btn btn-ghost btn-sm" style="font-size:10px;" onclick="document.getElementById('photo-input').click()">
          ${photoURL?'Change photo':'Add photo'}
        </button>
        <div id="photo-upload-status" style="font-size:10px;color:var(--muted);"></div>
      </div>

      <!-- Identity -->
      <div>
        <div style="font-size:20px;font-weight:700;margin-bottom:4px;">${firebase.auth().currentUser?.displayName||S.userEmail}</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">${S.userEmail}</div>
        ${team ? `<div style="font-size:12px;margin-bottom:4px;">🏸 <strong>${team.name}</strong> · ${team.group}</div>` : ''}
        ${currentNPRP ? `<div style="font-size:13px;color:var(--brand);font-weight:600;margin-bottom:8px;">NPRP ${currentNPRP}</div>` : ''}

        <!-- Hand + Position -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">
          <div>
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Playing Hand</div>
            <select class="form-select" id="pref-hand" style="font-size:12px;width:110px;" onchange="saveProfilePrefs()">
              <option value="">Not set</option>
              <option value="right" ${hand==='right'?'selected':''}>Right</option>
              <option value="left"  ${hand==='left' ?'selected':''}>Left</option>
            </select>
          </div>
          <div>
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Court Position</div>
            <select class="form-select" id="pref-position" style="font-size:12px;width:110px;" onchange="saveProfilePrefs()">
              <option value="">Not set</option>
              <option value="left"  ${position==='left' ?'selected':''}>Left side</option>
              <option value="right" ${position==='right'?'selected':''}>Right side</option>
            </select>
          </div>
        </div>
        <div id="prefs-status" style="font-size:10px;color:var(--accent);margin-top:6px;min-height:14px;"></div>
      </div>
    </div>

    <!-- NPRP Trend -->
    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:10px;">📈 NPRP History</div>
      ${nprpHistory.length >= 2
        ? renderNPRPChart(nprpHistory)
        : nprpHistory.length === 1
          ? `<div style="color:var(--muted);font-size:12px;">Only one data point so far (${nprpHistory[0].season}: NPRP ${nprpHistory[0].nprp}). Trend will appear after more seasons.</div>`
          : `<div style="color:var(--muted);font-size:12px;font-style:italic;">No NPRP history yet — snapshots are captured when fixtures are generated each season.</div>`
      }
    </div>

    <!-- Stats -->
    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;">📊 Season Stats</div>
      ${allMatches.length
        ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;text-align:center;">
            <div><div style="font-size:24px;font-weight:700;color:var(--text-primary);">${allMatches.length}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Played</div></div>
            <div><div style="font-size:24px;font-weight:700;color:var(--accent);">${wins}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Won</div></div>
            <div><div style="font-size:24px;font-weight:700;color:var(--red);">${losses}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Lost</div></div>
            <div><div style="font-size:24px;font-weight:700;color:var(--brand);">${winRate}%</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Win Rate</div></div>
          </div>`
        : '<div style="color:var(--muted);font-size:12px;font-style:italic;">No confirmed matches yet this season.</div>'
      }
    </div>

    <!-- Match History -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-weight:700;font-size:13px;">🗓 Match History</div>
        ${allMatches.length > 5
          ? `<div style="display:flex;gap:6px;">
              <button class="btn btn-ghost btn-sm" id="hist-5-btn" onclick="showMatchHistory(5)" style="font-size:10px;">Last 5</button>
              <button class="btn btn-ghost btn-sm" id="hist-all-btn" onclick="showMatchHistory(999)" style="font-size:10px;">All</button>
            </div>`
          : ''}
      </div>
      <div id="match-history-list">
        ${renderMatchHistoryRows(allMatches.slice(0,5), myTeamId)}
      </div>
    </div>`;

  // Store for toggle
  S._profileMatches = allMatches;
  S._profileTeamId  = myTeamId;
}

function renderMatchHistoryRows(matches, myTeamId){
  if(!matches.length) return '<div style="color:var(--muted);font-size:12px;font-style:italic;">No matches yet.</div>';
  return matches.map(m => {
    const r = calcResult(m.scoreData);
    const isT1 = m.t1 === myTeamId;
    const won  = r && ((r.result==='win1'&&isT1)||(r.result==='win2'&&!isT1));
    const lost = r && ((r.result==='win2'&&isT1)||(r.result==='win1'&&!isT1));
    const draw = r && r.result==='draw';
    const resultLabel = won?'W':lost?'L':draw?'D':'?';
    const resultColor = won?'var(--accent)':lost?'var(--red)':'var(--muted)';
    const opp = tn(isT1?m.t2:m.t1);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="width:24px;height:24px;border-radius:50%;background:${resultColor};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;">${resultLabel}</div>
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:600;">vs ${opp}</div>
        <div style="font-size:10px;color:var(--muted);">${m.date||'—'} · ${m.group}</div>
      </div>
      <div style="font-size:11px;font-family:'Space Mono',monospace;color:var(--text-primary);">${scoreDisplay(m)}</div>
    </div>`;
  }).join('');
}

function showMatchHistory(limit){
  const matches = S._profileMatches || [];
  const teamId  = S._profileTeamId;
  document.getElementById('match-history-list').innerHTML =
    renderMatchHistoryRows(limit >= 999 ? matches : matches.slice(0, limit), teamId);
}

// ── NPRP Trend Chart (inline SVG) ────────────────────────────────────────────

function renderNPRPChart(history){
  const W=320, H=100, PAD=24;
  const vals = history.map(h=>h.nprp);
  const minV = Math.max(0, Math.min(...vals)-0.5);
  const maxV = Math.min(7, Math.max(...vals)+0.5);
  const xStep = (W-PAD*2)/(history.length-1);
  const yScale = v => H - PAD - ((v-minV)/(maxV-minV||1))*(H-PAD*2);

  const points = history.map((h,i) => `${PAD+i*xStep},${yScale(h.nprp)}`).join(' ');
  const dots = history.map((h,i) => `
    <circle cx="${PAD+i*xStep}" cy="${yScale(h.nprp)}" r="4" fill="var(--brand)"/>
    <text x="${PAD+i*xStep}" y="${yScale(h.nprp)-8}" text-anchor="middle" font-size="9" fill="var(--brand)">${h.nprp}</text>
    <text x="${PAD+i*xStep}" y="${H-4}" text-anchor="middle" font-size="8" fill="var(--muted)">${h.season.replace('-',' ')}</text>`).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;overflow:visible;">
    <polyline points="${points}" fill="none" stroke="var(--brand)" stroke-width="2"/>
    ${dots}
  </svg>
  <div style="font-size:10px;color:var(--muted);margin-top:4px;">${history.length} season${history.length!==1?'s':''} · NPRP scale 1–7</div>`;
}

// ── Preferences save (hand + position) ───────────────────────────────────────

async function saveProfilePrefs(){
  const uid = firebase.auth().currentUser?.uid;
  if(!uid) return;
  const hand     = document.getElementById('pref-hand')?.value     || null;
  const position = document.getElementById('pref-position')?.value || null;
  try {
    await PlayersDB.updateProfile(uid, { hand, position });
    const st = document.getElementById('prefs-status');
    if(st){ st.textContent='Saved ✓'; setTimeout(()=>{ st.textContent=''; },2000); }
  } catch(err){ showToast('Failed to save: '+err.message, true); }
}

// ── Photo upload ──────────────────────────────────────────────────────────────

async function uploadProfilePhoto(input){
  const file = input.files[0];
  if(!file) return;
  const uid = firebase.auth().currentUser?.uid;
  if(!uid){ showToast('Not signed in',true); return; }

  const statusEl = document.getElementById('photo-upload-status');
  if(statusEl) statusEl.textContent='Uploading…';

  try {
    const ref = storage.ref(`profiles/${uid}/avatar`);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    await PlayersDB.updateProfile(uid, { photoURL: url });
    // Update display
    const wrap = document.getElementById('profile-photo-wrap');
    if(wrap) wrap.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
    if(statusEl) statusEl.textContent='';
    showToast('Photo updated!');
  } catch(err){
    if(statusEl) statusEl.textContent='Upload failed';
    showToast('Upload failed: '+err.message, true);
  }
  input.value=''; // reset so same file can be re-selected
}

// ── Settings tab ─────────────────────────────────────────────────────────────

function renderProfileSettings(){
  const container = document.getElementById('profile-content');
  if(!S.userEmail){
    container.innerHTML='<div style="color:var(--muted);">Sign in to access settings.</div>';
    return;
  }

  const currentUser = firebase.auth().currentUser;

  container.innerHTML=`
    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:14px;">👤 Account</div>

      <div class="form-group">
        <label class="form-label">Display Name</label>
        <input class="form-input" id="settings-name" placeholder="Your name (shown in nav and to others)"
          value="${currentUser?.displayName||''}">
        <div style="font-size:11px;color:var(--muted);margin-top:4px;">
          Shown in the nav bar and to the admin instead of your email.
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" value="${S.userEmail}" disabled style="opacity:0.5;cursor:not-allowed;">
        <div style="font-size:11px;color:var(--muted);margin-top:4px;">
          Email cannot be changed — contact an admin.
        </div>
      </div>

      <button class="btn btn-primary btn-sm" onclick="saveSettingsName()">Save Name</button>
      <p id="settings-name-msg" style="font-size:11px;min-height:14px;margin-top:6px;"></p>
    </div>

    <div class="card">
      <div style="font-weight:700;font-size:13px;margin-bottom:14px;">🔒 Change Password</div>
      <div class="form-group">
        <label class="form-label">New Password</label>
        <input class="form-input" id="settings-pw" type="password" placeholder="Min 6 characters">
      </div>
      <div class="form-group">
        <label class="form-label">Confirm New Password</label>
        <input class="form-input" id="settings-pw2" type="password" placeholder="Repeat new password">
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px;">
        If your session is old you may be asked to sign in again before the change takes effect.
      </div>
      <button class="btn btn-primary btn-sm" onclick="saveSettingsPassword()">Change Password</button>
      <p id="settings-pw-msg" style="font-size:11px;min-height:14px;margin-top:6px;"></p>
    </div>`;
}

async function saveSettingsName(){
  const name = document.getElementById('settings-name')?.value.trim();
  const msg  = document.getElementById('settings-name-msg');
  if(!name){ msg.style.color='var(--red)'; msg.textContent='Name cannot be empty.'; return; }
  try {
    await firebase.auth().currentUser.updateProfile({ displayName: name });
    // Also update player profile doc
    const uid = firebase.auth().currentUser?.uid;
    if(uid) await PlayersDB.updateProfile(uid, { displayName: name });
    // Update nav display
    const navEl = document.getElementById('nav-user-email');
    if(navEl) navEl.textContent = name;
    msg.style.color='var(--accent)'; msg.textContent='Name updated ✓';
    setTimeout(()=>{ msg.textContent=''; },2500);
  } catch(err){ msg.style.color='var(--red)'; msg.textContent=err.message; }
}

async function saveSettingsPassword(){
  const pw  = document.getElementById('settings-pw')?.value;
  const pw2 = document.getElementById('settings-pw2')?.value;
  const msg = document.getElementById('settings-pw-msg');
  if(!pw){ msg.style.color='var(--red)'; msg.textContent='Enter a new password.'; return; }
  if(pw.length < 6){ msg.style.color='var(--red)'; msg.textContent='Password must be at least 6 characters.'; return; }
  if(pw !== pw2){ msg.style.color='var(--red)'; msg.textContent='Passwords do not match.'; return; }
  try {
    await firebase.auth().currentUser.updatePassword(pw);
    document.getElementById('settings-pw').value='';
    document.getElementById('settings-pw2').value='';
    msg.style.color='var(--accent)'; msg.textContent='Password changed ✓';
    setTimeout(()=>{ msg.textContent=''; },2500);
  } catch(err){
    if(err.code==='auth/requires-recent-login'){
      msg.style.color='var(--warn)';
      msg.textContent='Session too old — sign out and back in, then try again.';
    } else {
      msg.style.color='var(--red)'; msg.textContent=err.message;
    }
  }
}

// ── Player Directory ──────────────────────────────────────────────────────────

async function renderPlayerDirectory(){
  const container = document.getElementById('profile-content');
  container.innerHTML='<div style="color:var(--muted);font-size:13px;">Loading players…</div>';

  try {
    const players = await PlayersDB.listAll();
    if(!players.length){
      container.innerHTML='<div style="color:var(--muted);font-size:13px;font-style:italic;">No player profiles yet — they are created when players first sign in.</div>';
      return;
    }

    container.innerHTML=`
      <div style="margin-bottom:12px;">
        <input class="form-input" id="dir-search" placeholder="Search by name or email…"
          oninput="filterDirectory()" style="max-width:300px;">
      </div>
      <div id="dir-list">
        ${renderDirectoryCards(players)}
      </div>`;
    S._directoryPlayers = players;
  } catch(err){
    container.innerHTML=`<div style="color:var(--red);font-size:13px;">Failed to load: ${err.message}</div>`;
  }
}

function renderDirectoryCards(players){
  if(!players.length) return '<div style="color:var(--muted);font-size:13px;">No results.</div>';

  // Enrich each player with their team reference
  const enriched = players.map(p => {
    const team = Object.values(S.teams).find(t =>
      t.season===ACTIVE_SEASON && t.players?.some(pl=>pl.claimedByEmail===p.email)
    );
    const playerRecord = team?.players?.find(pl=>pl.claimedByEmail===p.email);
    return { ...p, team, nprp: playerRecord?.nprp||null };
  });

  // Group by division — ordered by getDivisions() + Unassigned at end
  const divOrder = [...getDivisions(), 'Unassigned', 'No team'];
  const byDiv = {};
  divOrder.forEach(d => byDiv[d] = []);

  enriched.forEach(p => {
    const key = p.team ? p.team.group : 'No team';
    if(!byDiv[key]) byDiv[key] = [];
    byDiv[key].push(p);
  });

  return divOrder
    .filter(div => byDiv[div]?.length)
    .map(div => {
      const divPlayers = byDiv[div];
      const cards = divPlayers.map(p => {
        const hand = p.hand ? (p.hand==='right'?'Right hand':'Left hand') : null;
        const pos  = p.position ? `${p.position.charAt(0).toUpperCase()+p.position.slice(1)} side` : null;
        return `<div class="card" style="cursor:pointer;" onclick="viewPlayerProfile('${p.uid}')">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:44px;height:44px;border-radius:50%;overflow:hidden;background:var(--surface-1);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              ${p.photoURL
                ? `<img src="${p.photoURL}" style="width:100%;height:100%;object-fit:cover;">`
                : `<span style="font-size:18px;">👤</span>`}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.displayName||p.email}</div>
              ${p.team
                ? `<div style="font-size:11px;color:var(--muted);">${p.team.name}</div>`
                : '<div style="font-size:11px;color:var(--muted);">No team</div>'}
              <div style="display:flex;gap:8px;margin-top:3px;flex-wrap:wrap;">
                ${p.nprp?`<span style="font-size:10px;color:var(--brand);font-weight:600;">NPRP ${p.nprp}</span>`:''}
                ${hand?`<span style="font-size:10px;color:var(--muted);">${hand}</span>`:''}
                ${pos ?`<span style="font-size:10px;color:var(--muted);">${pos}</span>` :''}
              </div>
            </div>
          </div>
        </div>`;
      }).join('');

      const divColor = div==='Gold Division'?'var(--gold)':div==='No team'?'var(--muted)':'var(--brand)';
      return `<div style="margin-bottom:24px;">
        <div style="font-size:12px;font-weight:700;color:${divColor};text-transform:uppercase;
                    letter-spacing:0.5px;margin-bottom:10px;padding-bottom:6px;
                    border-bottom:1px solid var(--border);">
          ${div} <span style="font-weight:400;color:var(--muted);">(${divPlayers.length})</span>
        </div>
        <div class="grid-2">${cards}</div>
      </div>`;
    }).join('');
}

function filterDirectory(){
  const q = document.getElementById('dir-search')?.value.toLowerCase()||'';
  const players = (S._directoryPlayers||[]).filter(p =>
    (p.displayName||'').toLowerCase().includes(q) ||
    (p.email||'').toLowerCase().includes(q)
  );
  const el = document.getElementById('dir-list');
  if(el) el.innerHTML = renderDirectoryCards(players);
}

async function viewPlayerProfile(uid){
  const container = document.getElementById('profile-content');
  container.innerHTML='<div style="color:var(--muted);font-size:13px;">Loading…</div>';

  const profile = await PlayersDB.getProfile(uid);
  if(!profile){ container.innerHTML='<div style="color:var(--muted);">Profile not found.</div>'; return; }

  const team = Object.values(S.teams).find(t =>
    t.season===ACTIVE_SEASON && t.players?.some(p=>p.claimedByEmail===profile.email)
  );
  const playerRecord = team?.players?.find(p=>p.claimedByEmail===profile.email);
  const nprp = playerRecord?.nprp||null;
  const nprpHistory=(profile.nprpHistory||[]).sort((a,b)=>a.season.localeCompare(b.season));
  const myTeamId = team?.id;

  const allMatches = myTeamId
    ? Object.values(S.matches).filter(m=>
        (m.t1===myTeamId||m.t2===myTeamId)&&m.status==='confirmed'
      ).sort((a,b)=>(b.date||'').localeCompare(a.date||''))
    : [];
  const wins = allMatches.filter(m=>{const r=calcResult(m.scoreData);return r&&((r.result==='win1'&&m.t1===myTeamId)||(r.result==='win2'&&m.t2===myTeamId));}).length;
  const losses = allMatches.length - wins;
  const winRate = allMatches.length?Math.round((wins/allMatches.length)*100):0;

  container.innerHTML=`
    <button class="btn btn-ghost btn-sm" style="margin-bottom:16px;" onclick="setProfileTab('directory',document.querySelector('.profile-tab:nth-child(2)'))">← Back to Directory</button>
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:var(--surface-1);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${profile.photoURL?`<img src="${profile.photoURL}" style="width:100%;height:100%;object-fit:cover;">`:`<span style="font-size:28px;">👤</span>`}
        </div>
        <div>
          <div style="font-size:18px;font-weight:700;">${profile.displayName||profile.email}</div>
          ${team?`<div style="font-size:12px;color:var(--muted);">${team.name} · ${team.group}</div>`:''}
          ${nprp?`<div style="font-size:13px;color:var(--brand);font-weight:600;margin-top:4px;">NPRP ${nprp}</div>`:''}
          <div style="display:flex;gap:10px;margin-top:4px;">
            ${profile.hand?`<span style="font-size:11px;color:var(--muted);">${profile.hand==='right'?'Right':'Left'} hand</span>`:''}
            ${profile.position?`<span style="font-size:11px;color:var(--muted);">${profile.position.charAt(0).toUpperCase()+profile.position.slice(1)} side</span>`:''}
          </div>
        </div>
      </div>
    </div>

    ${nprpHistory.length>=2?`<div class="card" style="margin-bottom:16px;"><div style="font-weight:700;font-size:13px;margin-bottom:10px;">📈 NPRP History</div>${renderNPRPChart(nprpHistory)}</div>`:''}

    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;">📊 Season Stats</div>
      ${allMatches.length
        ?`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;text-align:center;">
            <div><div style="font-size:22px;font-weight:700;">${allMatches.length}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Played</div></div>
            <div><div style="font-size:22px;font-weight:700;color:var(--accent);">${wins}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Won</div></div>
            <div><div style="font-size:22px;font-weight:700;color:var(--red);">${losses}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Lost</div></div>
            <div><div style="font-size:22px;font-weight:700;color:var(--brand);">${winRate}%</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Win Rate</div></div>
          </div>`
        :'<div style="color:var(--muted);font-size:12px;font-style:italic;">No confirmed matches yet.</div>'
      }
    </div>

    <div class="card">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;">🗓 Match History</div>
      ${renderMatchHistoryRows(allMatches.slice(0,5), myTeamId)}
      ${allMatches.length>5?`<button class="btn btn-ghost btn-sm" style="margin-top:8px;font-size:11px;" onclick="this.previousElementSibling&&(document.getElementById('match-history-list').innerHTML=renderMatchHistoryRows(${JSON.stringify(allMatches.map(m=>m.id))}.map(id=>S.matches[id]),'${myTeamId}'))">Show all ${allMatches.length}</button>`:''}
    </div>`;

  S._profileMatches = allMatches;
  S._profileTeamId  = myTeamId;
}
