// src/render/profile.js
// Player profile page — My Profile sub-tab + Player Directory sub-tab.
// My Profile: photo, hand, position, OPLR trend chart, match history, stats.
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

  // Get team and match stats — league matches
  const myTeamId = S.myTeamId;
  const team = myTeamId ? S.teams[myTeamId] : null;
  const leagueMatches = Object.values(S.matches).filter(m =>
    myTeamId && (m.t1===myTeamId||m.t2===myTeamId) && m.status==='confirmed'
  ).sort((a,b) => (b.date||'').localeCompare(a.date||''));

  // Event games — find from OPPR history (format != 'league')
  const oplrHistory = profile.oplrHistory || [];
  const eventGames = oplrHistory.filter(h => h.format && h.format !== 'league');
  const eventWins   = eventGames.filter(h => h.opponent === 'win').length;
  const eventLosses = eventGames.filter(h => h.opponent === 'loss').length;
  const eventDraws  = eventGames.filter(h => h.opponent === 'draw').length;

  // Combined stats
  const leagueWins   = leagueMatches.filter(m => { const r=calcResult(m.scoreData); return r&&((r.result==='win1'&&m.t1===myTeamId)||(r.result==='win2'&&m.t2===myTeamId)); }).length;
  const leagueDraws  = leagueMatches.filter(m => { const r=calcResult(m.scoreData); return r&&r.result==='draw'; }).length;
  const leagueLosses = leagueMatches.length - leagueWins - leagueDraws;

  const wins   = leagueWins   + eventWins;
  const losses = leagueLosses + eventLosses;
  const draws  = leagueDraws  + eventDraws;
  const allMatches = leagueMatches; // keep for match history display
  const totalPlayed = leagueMatches.length + eventGames.length;
  const winRate = totalPlayed ? Math.round((wins/totalPlayed)*100) : 0;

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
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
          <div style="font-size:20px;font-weight:700;">${firebase.auth().currentUser?.displayName||S.userEmail}</div>
          ${profile.currentOPLR
            ? `<div style="font-family:'Space Mono',monospace;font-size:15px;font-weight:700;color:var(--brand);background:rgba(99,102,241,0.1);padding:3px 10px;border-radius:20px;border:1px solid rgba(99,102,241,0.3);">OPPR ${profile.currentOPLR.toFixed(2)}</div>`
            : currentNPRP ? `<div style="font-size:13px;color:var(--muted);padding:3px 10px;border-radius:20px;border:1px solid var(--border);">NPRP ${currentNPRP}</div>` : ''}
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">${S.userEmail}</div>
        ${team ? `<div style="font-size:12px;margin-bottom:4px;">🏸 <strong>${team.name}</strong> · ${team.group}</div>` : ''}

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
          <div>
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">NPRP Rating</div>
            <select class="form-select" id="pref-nprp" style="font-size:12px;width:100px;" onchange="saveProfilePrefs()">
              <option value="">Not set</option>
              ${[1.0,1.5,2.0,2.5,3.0,3.5,4.0,4.5,5.0,5.5,6.0,6.5,7.0].map(v=>
                `<option value="${v}" ${parseFloat(currentNPRP)===v?'selected':''}>${v}</option>`
              ).join('')}
            </select>
            <div style="font-size:9px;color:var(--muted);margin-top:2px;">Your WPR/national rating</div>
          </div>
        </div>
        <div id="prefs-status" style="font-size:10px;color:var(--accent);margin-top:6px;min-height:14px;"></div>
      </div>
    </div>

    <!-- OPLR -->
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-weight:700;font-size:13px;">📈 OnePadel Player Rating</div>
        ${profile.currentOPLR
          ? `<div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:var(--brand);">${profile.currentOPLR.toFixed(2)}</div>`
          : currentNPRP
            ? `<div style="font-size:12px;color:var(--muted);">Starting from NPRP ${currentNPRP}</div>`
            : ''}
      </div>
      ${(()=>{
        const oplrHist = profile.oplrHistory || [];
        const matchCount = oplrHist.length;
        const phase = matchCount < 21 ? 'Calibrating' : matchCount < 50 ? 'Active' : 'Locked';
        const phaseColor = matchCount < 21 ? 'var(--warn)' : matchCount < 50 ? 'var(--brand)' : 'var(--accent)';
        const phaseNote = matchCount < 21
          ? `Calibrating (${matchCount}/20 matches) — rating swings are expected and normal this early.`
          : matchCount < 50
            ? `Active (${matchCount}/49 matches) — rating is stabilising.`
            : `Locked (${matchCount}+ matches) — max ±0.20 per match.`;

        const calibrationBadge = `<div style="font-size:10px;color:${phaseColor};margin-top:4px;">
          ⚡ ${phaseNote}
        </div>`;

        if(oplrHist.length >= 2){
          return (renderOPLRChart(oplrHist) || '') + calibrationBadge;
        }
        if(oplrHist.length === 1){
          return `<div style="color:var(--muted);font-size:12px;">Rating: ${oplrHist[0].oplr.toFixed(2)} after 1 match. Trend appears after 2+ matches.</div>${calibrationBadge}`;
        }
        return `<div style="color:var(--muted);font-size:12px;font-style:italic;">No matches yet — OPLR starts from your NPRP and updates after each confirmed match.</div>
          <div style="font-size:10px;color:var(--warn);margin-top:4px;">⚡ Calibrating (0/20 matches) — early ratings swing significantly as the system finds your level.</div>`;
      })()}
    </div>

    <!-- Stats -->
    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;">📊 Season Stats</div>
      ${totalPlayed
        ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;text-align:center;">
            <div><div style="font-size:24px;font-weight:700;color:var(--text-primary);">${totalPlayed}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Played</div></div>
            <div><div style="font-size:24px;font-weight:700;color:var(--accent);">${wins}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Won</div></div>
            <div><div style="font-size:24px;font-weight:700;color:var(--red);">${losses}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Lost</div></div>
            <div><div style="font-size:24px;font-weight:700;color:var(--brand);">${winRate}%</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Win Rate</div></div>
          </div>
          ${eventGames.length?`<div style="margin-top:8px;font-size:10px;color:var(--muted);">
            League: ${leagueMatches.length} · Events: ${eventGames.length} (${eventWins}W ${eventLosses}L)
          </div>`:''}
          `
        : '<div style="color:var(--muted);font-size:12px;font-style:italic;">No confirmed matches yet this season.</div>'
      }
    </div>

    <!-- Event game history from OPLR -->
    ${eventGames.length ? `
    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;">🎾 Event Match History</div>
      ${eventGames.slice().reverse().slice(0,5).map(h => {
        const fmtIcon = h.format==='mexicano'?'🔄':h.format==='americano'?'🤝':'👑';
        const won = h.opponent==='win';
        const lost = h.opponent==='loss';
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
          <div style="width:24px;height:24px;border-radius:50%;background:${won?'var(--accent)':lost?'var(--red)':'var(--muted)'};
            display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#000;flex-shrink:0;">
            ${won?'W':lost?'L':'D'}
          </div>
          <div style="font-size:18px;flex-shrink:0;">${fmtIcon}</div>
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:600;">OPPR ${h.oplr?.toFixed(2)||'—'}</div>
            <div style="font-size:10px;color:var(--muted);">${h.date||'—'} · ${h.format}</div>
          </div>
          <div style="font-size:12px;font-family:'Space Mono',monospace;
            color:${h.delta>0?'var(--accent)':h.delta<0?'var(--red)':'var(--muted)'};">
            ${h.delta>0?'+':''}${h.delta?.toFixed(2)||'0'}
          </div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <!-- Event participation (loaded async below) -->
    <div class="card" id="profile-events-card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px;">🎾 Events Played</div>
      <div id="profile-events-content" style="color:var(--muted);font-size:12px;font-style:italic;">Loading...</div>
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

  // Load events async — doesn't block initial render
  loadProfileEvents(uid);
}

// ── Profile events loader ────────────────────────────────────────────────────

async function loadProfileEvents(uid){
  const card = document.getElementById('profile-events-content');
  if(!card) return;

  try {
    const events = await EventsDB.listByParticipant(uid);
    if(!events.length){
      card.innerHTML = '<span style="font-style:italic;">No events yet — join a Mexicano or Americano to see your event history here.</span>';
      return;
    }

    const formatIcon = {mexicano:'🔄',americano:'🤝',king:'👑'};
    const formatLabel = {mexicano:'Mexicano',americano:'Americano',king:'King of the Court'};

    card.innerHTML = events.map(e => {
      const s = e.standings?.[uid];
      const pos = s ? Object.values(e.standings)
        .filter(p=>!p.withdrawn)
        .sort((a,b)=>b.points-a.points||b.gamesWon-a.gamesWon)
        .findIndex(p=>p.uid===uid) + 1 : null;
      const total = s ? Object.values(e.standings).filter(p=>!p.withdrawn).length : null;
      const medal = pos===1?'🥇':pos===2?'🥈':pos===3?'🥉':null;

      return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:20px;flex-shrink:0;">${formatIcon[e.type]||'🎾'}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.name}</div>
          <div style="font-size:10px;color:var(--muted);">${formatLabel[e.type]||e.type} · ${e.date||'—'} · Round ${e.currentRound||0}${e.totalRounds?' of '+e.totalRounds:''}</div>
        </div>
        ${s ? `<div style="text-align:right;flex-shrink:0;">
          <div style="font-size:13px;font-weight:700;color:var(--brand);">${medal||'#'+pos} of ${total}</div>
          <div style="font-size:10px;color:var(--muted);">${s.points} pts · ${s.played} matches</div>
        </div>` : ''}
      </div>`;
    }).join('');
  } catch(err){
    if(err.message?.includes('index')){
      card.innerHTML = '<span style="color:var(--warn);font-size:11px;">⚠ Firestore index required for events query. Create index: events → participants (array) + date (desc).</span>';
    } else {
      card.innerHTML = `<span style="color:var(--muted);font-size:12px;">Could not load events: ${err.message}</span>`;
    }
  }
}

async function adminSetNprp(uid, selectId){
  if(!isAdminUser()){ showToast('Admin only',true); return; }
  const val = parseFloat(document.getElementById(selectId)?.value);
  if(!val){ showToast('Select an NPRP value',true); return; }
  try {
    await db.collection('players').doc(uid).update({
      selfReportedNprp: val,
      nprpHistory: firebase.firestore.FieldValue.arrayUnion({
        nprp: val, season: ACTIVE_SEASON,
        date: new Date().toISOString().split('T')[0],
        division: 'Admin-set'
      })
    });
    showToast(`NPRP set to ${val}`);
  } catch(err){ showToast('Failed: '+err.message, true); }
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
  <div style="font-size:10px;color:var(--muted);margin-top:4px;">${history.length} season${history.length!==1?'s':''} · OPPR scale 1–7</div>`;
}

// ── Preferences save (hand + position) ───────────────────────────────────────

async function saveProfilePrefs(){
  const uid = firebase.auth().currentUser?.uid;
  if(!uid) return;
  const hand     = document.getElementById('pref-hand')?.value     || null;
  const position = document.getElementById('pref-position')?.value || null;
  const nprpVal  = document.getElementById('pref-nprp')?.value;
  const nprp     = nprpVal ? parseFloat(nprpVal) : null;
  try {
    const updates = { hand, position };
    if(nprp) updates.selfReportedNprp = nprp;
    await PlayersDB.updateProfile(uid, updates);
    // Also update nprpHistory on player doc for OPPR seeding
    if(nprp){
      await db.collection('players').doc(uid).update({
        nprpHistory: firebase.firestore.FieldValue.arrayUnion({
          nprp, season: ACTIVE_SEASON,
          date: new Date().toISOString().split('T')[0],
          division: 'Self-reported'
        })
      });
    }
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
    return { ...p, team, nprp: playerRecord?.nprp||null, currentOPLR: p.currentOPLR||null };
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
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px;">
                <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.displayName||p.email}</div>
                ${p.currentOPLR
                  ? `<span style="font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:var(--brand);background:rgba(99,102,241,0.1);padding:1px 7px;border-radius:10px;border:1px solid rgba(99,102,241,0.3);">${p.currentOPLR.toFixed(2)}</span>`
                  : p.nprp ? `<span style="font-size:11px;color:var(--muted);padding:1px 7px;border-radius:10px;border:1px solid var(--border);">NPRP ${p.nprp}</span>` : ''}
              </div>
              ${p.team
                ? `<div style="font-size:11px;color:var(--muted);">${p.team.name}</div>`
                : '<div style="font-size:11px;color:var(--muted);">No team</div>'}
              <div style="display:flex;gap:8px;margin-top:3px;flex-wrap:wrap;">
                ${p.nprp?`<span style="font-size:10px;color:var(--brand);font-weight:600;">OPPR ${p.nprp}</span>`:''}
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

  // Include event games from OPPR history
  const vOplrHistory = profile.oplrHistory || [];
  const vEventGames  = vOplrHistory.filter(h => h.format && h.format !== 'league');
  const vEventWins   = vEventGames.filter(h => h.opponent==='win').length;
  const vEventLosses = vEventGames.filter(h => h.opponent==='loss').length;

  const leagueWinsV  = allMatches.filter(m=>{const r=calcResult(m.scoreData);return r&&((r.result==='win1'&&m.t1===myTeamId)||(r.result==='win2'&&m.t2===myTeamId));}).length;
  const leagueLossV  = allMatches.length - leagueWinsV;
  const wins         = leagueWinsV + vEventWins;
  const losses       = leagueLossV + vEventLosses;
  const totalPlayed  = allMatches.length + vEventGames.length;
  const winRate      = totalPlayed ? Math.round((wins/totalPlayed)*100) : 0;

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
          ${nprp?`<div style="font-size:13px;color:var(--brand);font-weight:600;margin-top:4px;">OPPR ${nprp}</div>`:''}
          <div style="display:flex;gap:10px;margin-top:4px;">
            ${profile.hand?`<span style="font-size:11px;color:var(--muted);">${profile.hand==='right'?'Right':'Left'} hand</span>`:''}
            ${profile.position?`<span style="font-size:11px;color:var(--muted);">${profile.position.charAt(0).toUpperCase()+profile.position.slice(1)} side</span>`:''}
          </div>
          ${isAdminUser()?`
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
            <span style="font-size:10px;color:var(--muted);text-transform:uppercase;">Set NPRP:</span>
            <select class="form-select" id="admin-nprp-${uid}" style="font-size:12px;width:90px;">
              <option value="">—</option>
              ${[1.0,1.5,2.0,2.5,3.0,3.5,4.0,4.5,5.0,5.5,6.0,6.5,7.0].map(v=>
                '<option value="'+v+'" '+(parseFloat(nprp)===v?'selected':'')+'>'+v+'</option>'
              ).join('')}
            </select>
            <button class="btn btn-ghost btn-sm" style="font-size:11px;"
              onclick="adminSetNprp('${uid}','admin-nprp-${uid}')">Save</button>
          </div>`:''}
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-weight:700;font-size:13px;">📈 OnePadel Player Rating</div>
        ${profile.currentOPLR?`<div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:var(--brand);">${profile.currentOPLR.toFixed(2)}</div>`:''}
      </div>
      ${(()=>{
        const oh = profile.oplrHistory||[];
        if(oh.length>=2) return renderOPLRChart(oh)||'';
        if(oh.length===1) return '<div style="color:var(--muted);font-size:12px;">Rating: '+oh[0].oplr.toFixed(2)+' after 1 match.</div>';
        return '<div style="color:var(--muted);font-size:12px;font-style:italic;">No matches yet — OPPR starts from NPRP after first confirmed match.</div>';
      })()}
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;">📊 Season Stats</div>
      ${totalPlayed
        ?`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;text-align:center;">
            <div><div style="font-size:22px;font-weight:700;">${totalPlayed}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Played</div></div>
            <div><div style="font-size:22px;font-weight:700;color:var(--accent);">${wins}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Won</div></div>
            <div><div style="font-size:22px;font-weight:700;color:var(--red);">${losses}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Lost</div></div>
            <div><div style="font-size:22px;font-weight:700;color:var(--brand);">${winRate}%</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Win Rate</div></div>
          </div>
          ${vEventGames.length?`<div style="font-size:10px;color:var(--muted);margin-top:6px;">League: ${allMatches.length} · Events: ${vEventGames.length} (${vEventWins}W ${vEventLosses}L)</div>`:''}`
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
