// src/render/tournaments.js
// Tournament page — registration, seeding, group stage, knockout

let S_tournament = null;   // currently viewed tournament
let S_tournamentMatches = []; // loaded matches

function renderTournamentsPage(){
  const container = document.getElementById('tournaments-content');
  if(!container) return;
  if(S_tournament) renderTournamentDetail(container);
  else renderTournamentList(container);
}

// ── List ──────────────────────────────────────────────────────────────────────

function renderTournamentList(container){
  const all = Object.values(S.tournaments||{})
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const statusColor = {
    registration:'var(--accent)', seeding:'var(--gold)',
    groups:'var(--brand)', knockout:'var(--warn)', complete:'var(--muted)'
  };
  const statusLabel = {
    registration:'📋 Registration Open', seeding:'🌱 Seeding',
    groups:'🎾 Group Stage', knockout:'⚔ Knockout', complete:'✓ Complete'
  };

  const createBtn = isAdminUser()
    ? `<button class="btn btn-primary btn-sm" onclick="openCreateTournamentModal()">+ Create Tournament</button>`
    : '';

  if(!all.length){
    container.innerHTML=`<div style="text-align:center;padding:40px 0;">
      <div style="font-size:32px;margin-bottom:12px;">🏆</div>
      <div style="font-weight:600;font-size:14px;margin-bottom:6px;">No tournaments yet</div>
      <div style="color:var(--muted);font-size:13px;margin-bottom:16px;">
        ${isAdminUser()?'Create the first tournament below.':'Tournaments will appear here when scheduled.'}
      </div>${createBtn}</div>`;
    return;
  }

  const active    = all.filter(t=>t.status!=='complete');
  const completed = all.filter(t=>t.status==='complete');

  const renderCard = t => {
    const regs = t.registrations||[];
    const confirmed = regs.filter(r=>r.status==='confirmed');
    const waitlist  = regs.filter(r=>r.status==='waitlist');
    const setsLabel = t.format?.sets===1 ? '1 set + super TB' : '2 sets + super TB';
    return `<div class="card" style="cursor:pointer;border-left:3px solid ${statusColor[t.status]||'var(--border)'};"
      onclick="openTournamentDetail('${t.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div style="font-size:20px;">🏆</div>
        <span style="font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;
          background:${statusColor[t.status]}22;color:${statusColor[t.status]};">
          ${statusLabel[t.status]||t.status}
        </span>
      </div>
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${t.name}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">
        📅 ${t.date||'TBC'}${t.endDate&&t.endDate!==t.date?` – ${t.endDate}`:''}
        ${t.venue?` · 📍 ${t.venue}`:''}
      </div>
      <div style="font-size:11px;color:var(--muted);">
        👥 ${confirmed.length}/${t.drawSize||16} teams confirmed
        ${waitlist.length?`· ${waitlist.length} waitlisted`:''}
        · ${setsLabel}
      </div>
      ${confirmed.length>0?`<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
        ${confirmed.slice(0,3).map((r,i)=>`<div style="font-size:11px;padding:1px 0;">
          ${['🥇','🥈','🥉'][i]||'·'} ${r.player1.name} & ${r.player2.name}
          ${r.seed?`<span style="color:var(--muted);">#${r.seed}</span>`:''}
        </div>`).join('')}
        ${confirmed.length>3?`<div style="font-size:10px;color:var(--muted);">+${confirmed.length-3} more</div>`:''}
      </div>`:''}
    </div>`;
  };

  container.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:13px;color:var(--muted);">${active.length} active · ${completed.length} completed</div>
      ${createBtn}
    </div>
    ${active.length?`<div class="grid-2">${active.map(renderCard).join('')}</div>`:''}
    ${completed.length?`<div style="margin-top:${active.length?'24px':'0'};">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;
        letter-spacing:1px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--border);">
        ✓ Completed Tournaments
      </div>
      <div class="grid-2">${completed.map(renderCard).join('')}</div>
    </div>`:''}`;
}

// ── Detail ────────────────────────────────────────────────────────────────────

async function openTournamentDetail(tid){
  S_tournament = S.tournaments[tid];
  if(!S_tournament) return;
  S_tournamentMatches = await TournamentsDB.getMatches(tid);
  renderTournamentsPage();
}

function closeTournamentDetail(){
  S_tournament = null;
  S_tournamentMatches = [];
  renderTournamentsPage();
}

function renderTournamentDetail(container){
  const t = S_tournament;
  if(!t){ renderTournamentList(container); return; }

  const regs = t.registrations||[];
  const confirmed = regs.filter(r=>r.status==='confirmed');
  const waitlist  = regs.filter(r=>r.status==='waitlist');
  const setsLabel = t.format?.sets===1?'1 set + super tiebreak':'2 sets + super tiebreak';

  // Determine which sub-view to show based on status
  const phase = t.status;

  container.innerHTML=`
    <button class="btn btn-ghost btn-sm" style="margin-bottom:16px;" onclick="closeTournamentDetail()">← All Tournaments</button>

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
      <div>
        <div style="font-size:22px;font-weight:700;">${t.name}</div>
        <div style="font-size:12px;color:var(--muted);">
          📅 ${t.date||'TBC'}${t.endDate&&t.endDate!==t.date?` – ${t.endDate}`:''}
          ${t.venue?` · 📍 ${t.venue}`:''}
          · ${setsLabel} · Draw: ${t.drawSize||16}
        </div>
      </div>
      ${isAdminUser()?`<div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${phase==='registration'?`
          <button class="btn btn-primary btn-sm" onclick="openTournamentSeedingPanel('${t.id}')">🌱 Seed & Start</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteTournament('${t.id}','${t.name.replace(/'/g,"\\'")}')" style="color:var(--red);">Delete</button>`:''}
        ${phase==='seeding'?`<button class="btn btn-primary btn-sm" onclick="startGroupStage('${t.id}')">▶ Start Group Stage</button>`:''}
        ${phase==='groups'?`<button class="btn btn-primary btn-sm" onclick="generateKOFromGroups('${t.id}')">→ Generate Knockout</button>`:''}
        ${phase==='knockout'?`<button class="btn btn-ghost btn-sm" onclick="completeTournament('${t.id}')">✓ Complete</button>`:''}
      </div>`:''}
    </div>

    <!-- Phase tabs -->
    <div class="group-tabs" style="margin-bottom:16px;">
      <button class="group-tab ${!['groups','knockout','complete'].includes(phase)?'active':''}"
        onclick="setTournamentTab('registration',this)">Registration (${confirmed.length})</button>
      <button class="group-tab ${phase==='groups'?'active':''}"
        onclick="setTournamentTab('groups',this)">Group Stage</button>
      <button class="group-tab ${phase==='knockout'||phase==='complete'?'active':''}"
        onclick="setTournamentTab('knockout',this)">Knockout</button>
    </div>

    <div id="tournament-tab-content"></div>`;

  // Render default tab
  const defaultTab = phase==='groups'?'groups':phase==='knockout'||phase==='complete'?'knockout':'registration';
  renderTournamentTab(defaultTab);
}

function setTournamentTab(tab, el){
  document.querySelectorAll('.group-tab').forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');
  renderTournamentTab(tab);
}

function renderTournamentTab(tab){
  const container = document.getElementById('tournament-tab-content');
  if(!container) return;
  const t = S_tournament;
  if(!t) return;

  if(tab==='registration') renderTournamentRegistration(container, t);
  else if(tab==='groups')  renderTournamentGroups(container, t);
  else if(tab==='knockout') renderTournamentKnockout(container, t);
}

// ── Registration tab ──────────────────────────────────────────────────────────

function renderTournamentRegistration(container, t){
  const regs = t.registrations||[];
  const confirmed = regs.filter(r=>r.status==='confirmed')
    .sort((a,b)=>(a.seed||999)-(b.seed||999));
  const waitlist = regs.filter(r=>r.status==='waitlist');

  // Check if current user is already registered
  const myEmail = firebase.auth().currentUser?.email;
  const myReg = myEmail ? regs.find(r=>
    r.player1.email===myEmail||r.player2.email===myEmail) : null;
  const isOpen = t.status==='registration';
  const isFull = confirmed.length >= (t.drawSize||16);

  container.innerHTML=`
    <!-- Register form -->
    ${isOpen&&!myReg?`
    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;">
        ${isFull?'📋 Join Waitlist':'+ Register Your Pair'}
      </div>
      ${isFull?`<div style="font-size:12px;color:var(--warn);margin-bottom:10px;">
        Draw is full (${t.drawSize} teams). You'll be added to the waitlist.
      </div>`:''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div>
          <label class="form-label" style="font-size:10px;">Player 1 Name</label>
          <input class="form-input" id="treg-p1name" placeholder="Your name">
          <input class="form-input" id="treg-p1email" placeholder="Email (optional)" style="margin-top:6px;">
        </div>
        <div>
          <label class="form-label" style="font-size:10px;">Player 2 Name</label>
          <input class="form-input" id="treg-p2name" placeholder="Partner name">
          <input class="form-input" id="treg-p2email" placeholder="Email (optional)" style="margin-top:6px;">
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="registerForTournament('${t.id}')">
        ${isFull?'Join Waitlist':'Register'}
      </button>
    </div>`:''}

    ${myReg&&isOpen?`<div class="card" style="margin-bottom:16px;border-left:3px solid var(--accent);">
      <div style="font-size:13px;font-weight:600;">✓ You're registered</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px;">
        ${myReg.player1.name} & ${myReg.player2.name} ·
        ${myReg.status==='waitlist'?'<span style="color:var(--warn);">Waitlisted</span>':'<span style="color:var(--accent);">Confirmed</span>'}
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px;font-size:11px;color:var(--red);"
        onclick="withdrawFromTournament('${t.id}','${myReg.pairId}')">Withdraw</button>
    </div>`:''}

    <!-- Confirmed teams -->
    <div style="font-weight:700;font-size:13px;margin-bottom:8px;">
      Registered Teams (${confirmed.length}/${t.drawSize||16})
    </div>
    ${!confirmed.length
      ?'<div style="color:var(--muted);font-size:12px;font-style:italic;">No registrations yet.</div>'
      :confirmed.map((r,i)=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
          ${r.seed
            ?`<div style="font-family:'Space Mono',monospace;font-weight:700;font-size:13px;
                width:28px;color:var(--gold);">#${r.seed}</div>`
            :`<div style="width:28px;font-size:12px;color:var(--muted);">${i+1}</div>`}
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;">${r.player1.name} & ${r.player2.name}</div>
            <div style="font-size:10px;color:var(--muted);">Registered ${r.registeredAt?.split('T')[0]||'—'}</div>
          </div>
          ${isAdminUser()&&isOpen?`
            <button class="btn btn-ghost btn-sm" style="font-size:10px;"
              onclick="adminRemoveTeam('${t.id}','${r.pairId}')">✕</button>`:''}
        </div>`).join('')}

    <!-- Waitlist -->
    ${waitlist.length?`
    <div style="margin-top:16px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:var(--warn);">
        ⏳ Waitlist (${waitlist.length})
      </div>
      ${waitlist.map((r,i)=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);opacity:0.8;">
          <div style="width:28px;font-size:12px;color:var(--warn);">W${i+1}</div>
          <div style="flex:1;">
            <div style="font-size:13px;">${r.player1.name} & ${r.player2.name}</div>
          </div>
          ${isAdminUser()?`
            <button class="btn btn-ghost btn-sm" style="font-size:10px;color:var(--accent);"
              onclick="promoteFromWaitlist('${t.id}','${r.pairId}')">Promote</button>
            <button class="btn btn-ghost btn-sm" style="font-size:10px;"
              onclick="adminRemoveTeam('${t.id}','${r.pairId}')">✕</button>`:''}
        </div>`).join('')}
    </div>`:''}`;
}

// ── Group Stage tab ───────────────────────────────────────────────────────────

function renderTournamentGroups(container, t){
  const groups = t.groups||[];
  if(!groups.length){
    container.innerHTML='<div style="color:var(--muted);font-size:12px;font-style:italic;">Groups not yet generated. Admin must seed and start group stage.</div>';
    return;
  }

  container.innerHTML=groups.map(group=>{
    const standings = calcTournamentGroupStandings(t, group.groupId, S_tournamentMatches);
    const groupMatches = S_tournamentMatches.filter(m=>m.groupId===group.groupId&&m.phase==='group');
    const advanceCount = t.advancePerGroup||2;

    return `<div class="card" style="margin-bottom:16px;padding:0;overflow:hidden;">
      <div style="padding:12px 16px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border);">
        Group ${group.name}
      </div>
      <!-- Standings -->
      <table style="width:100%;">
        <thead><tr style="font-size:10px;color:var(--muted);">
          <th style="padding:6px 12px;text-align:left;">#</th>
          <th style="padding:6px 12px;text-align:left;">Pair</th>
          <th style="padding:6px 8px;text-align:center;">P</th>
          <th style="padding:6px 8px;text-align:center;">W</th>
          <th style="padding:6px 8px;text-align:center;">L</th>
          <th style="padding:6px 8px;text-align:center;">Sets</th>
          <th style="padding:6px 8px;text-align:center;">Games</th>
          <th style="padding:6px 12px;text-align:center;">Pts</th>
        </tr></thead>
        <tbody>
          ${standings.map((s,i)=>`
            <tr style="border-top:1px solid var(--border);${i<advanceCount?'background:rgba(74,222,128,0.04)':''}">
              <td style="padding:8px 12px;font-family:'Space Mono',monospace;font-weight:700;
                color:${i<advanceCount?'var(--accent)':'var(--muted)'};">${i+1}</td>
              <td style="padding:8px 12px;font-weight:600;font-size:12px;">${s.name}
                ${i<advanceCount?'<span style="font-size:9px;color:var(--accent);"> ↑ADV</span>':''}
              </td>
              <td style="padding:8px;text-align:center;font-size:12px;">${s.played}</td>
              <td style="padding:8px;text-align:center;color:var(--accent);font-size:12px;">${s.won}</td>
              <td style="padding:8px;text-align:center;color:var(--red);font-size:12px;">${s.lost}</td>
              <td style="padding:8px;text-align:center;font-size:11px;color:var(--muted);">${s.setsWon}-${s.setsLost}</td>
              <td style="padding:8px;text-align:center;font-size:11px;color:var(--muted);">${s.gamesWon}-${s.gamesLost}</td>
              <td style="padding:8px 12px;text-align:center;font-family:'Space Mono',monospace;font-weight:700;color:var(--brand);">${s.points}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <!-- Matches -->
      <div style="padding:12px 16px;border-top:1px solid var(--border);">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Matches</div>
        ${!groupMatches.length
          ?'<div style="font-size:12px;color:var(--muted);font-style:italic;">No matches scheduled yet.</div>'
          :groupMatches.map(m=>`
            <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
              <div style="flex:1;font-size:12px;font-weight:${m.winner==='A'?'700':'400'};
                color:${m.winner==='A'?'var(--text-primary)':'var(--muted)'};">${m.pairA?.name||'—'}</div>
              <div style="font-size:11px;text-align:center;min-width:80px;">
                ${m.status==='confirmed'
                  ?renderTournamentScore(m.score, t.format)
                  :isAdminUser()
                    ?`<button class="btn btn-ghost btn-sm" style="font-size:10px;"
                        onclick="openTournamentScoreEntry('${t.id}','${m.id}')">Enter Score</button>`
                    :'<span style="color:var(--muted);">Pending</span>'}
              </div>
              <div style="flex:1;text-align:right;font-size:12px;font-weight:${m.winner==='B'?'700':'400'};
                color:${m.winner==='B'?'var(--text-primary)':'var(--muted)'};">${m.pairB?.name||'—'}</div>
            </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function renderTournamentScore(score, format){
  if(!score) return '<span style="color:var(--muted);">—</span>';
  const sets = (score.sets||[]).map(s=>`<span>${s.a}-${s.b}</span>`).join(' ');
  const st = score.superTb ? ` <span style="font-size:10px;color:var(--muted);">[${score.superTb.a}-${score.superTb.b}]</span>` : '';
  return `<span style="font-family:'Space Mono',monospace;font-size:12px;font-weight:700;">${sets}${st}</span>`;
}

// ── Knockout tab ──────────────────────────────────────────────────────────────

function renderTournamentKnockout(container, t){
  const koMatches = S_tournamentMatches.filter(m=>m.phase==='ko')
    .sort((a,b)=>(a.round||0)-(b.round||0));

  if(!koMatches.length){
    container.innerHTML='<div style="color:var(--muted);font-size:12px;font-style:italic;">Knockout bracket not yet generated.</div>';
    return;
  }

  const rounds = [...new Set(koMatches.map(m=>m.round))].sort((a,b)=>a-b);
  const roundNames = {1:'Final',2:'Semi-finals',4:'Quarter-finals',8:'Round of 16'};

  container.innerHTML=rounds.map(r=>{
    const rMatches = koMatches.filter(m=>m.round===r);
    const totalRounds = Math.max(...rounds);
    const roundName = roundNames[totalRounds/r] || `Round of ${rMatches.length*2}`;
    return `<div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;
        letter-spacing:1px;margin-bottom:10px;">${roundName}</div>
      <div class="grid-2">
        ${rMatches.map(m=>`
          <div class="card" style="border-left:3px solid ${m.status==='confirmed'?'var(--accent)':'var(--border)'};">
            <div style="font-size:10px;color:var(--muted);margin-bottom:6px;">
              ${m.court?`Court ${m.court} · `:''}${m.scheduledAt||'Time TBC'}
            </div>
            <div style="font-weight:${m.winner==='A'?'700':'400'};font-size:13px;
              color:${m.winner==='A'?'var(--text-primary)':'var(--muted)'};">
              ${m.winner==='A'?'🏆 ':''} ${m.pairA?.name||'TBD'}
            </div>
            <div style="font-size:11px;color:var(--muted);margin:4px 0;">vs</div>
            <div style="font-weight:${m.winner==='B'?'700':'400'};font-size:13px;
              color:${m.winner==='B'?'var(--text-primary)':'var(--muted)'};">
              ${m.winner==='B'?'🏆 ':''} ${m.pairB?.name||'TBD'}
            </div>
            ${m.status==='confirmed'
              ?`<div style="margin-top:8px;">${renderTournamentScore(m.score, t.format)}</div>`
              :isAdminUser()&&m.pairA&&m.pairB
                ?`<button class="btn btn-ghost btn-sm" style="margin-top:8px;font-size:10px;"
                    onclick="openTournamentScoreEntry('${t.id}','${m.id}')">Enter Score</button>`
                :''}
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

// ── Score entry modal ─────────────────────────────────────────────────────────

let _currentTournamentMatch = null;

function openTournamentScoreEntry(tournamentId, matchId){
  const t = S_tournament;
  const m = S_tournamentMatches.find(x=>x.id===matchId);
  if(!t||!m) return;
  _currentTournamentMatch = {tournamentId, matchId, match:m};

  const sets = t.format?.sets||2;
  const existingScore = m.score||{sets:[],superTb:null};

  let setInputs = '';
  for(let i=0;i<sets;i++){
    const s = existingScore.sets[i]||{a:'',b:''};
    setInputs += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="font-size:11px;color:var(--muted);width:50px;">Set ${i+1}</span>
      <input type="number" min="0" max="7" id="ts-s${i}-a" value="${s.a}"
        style="width:52px;padding:6px;border-radius:4px;border:1px solid var(--border);
        background:var(--surface-1);color:var(--text-primary);text-align:center;font-size:16px;font-weight:700;">
      <span style="color:var(--muted);font-weight:700;">–</span>
      <input type="number" min="0" max="7" id="ts-s${i}-b" value="${s.b}"
        style="width:52px;padding:6px;border-radius:4px;border:1px solid var(--border);
        background:var(--surface-1);color:var(--text-primary);text-align:center;font-size:16px;font-weight:700;">
    </div>`;
  }

  document.getElementById('tournament-score-modal-content').innerHTML=`
    <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${m.pairA?.name||'—'}</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">vs ${m.pairB?.name||'—'}</div>
    ${setInputs}
    <div id="ts-supertb-wrap" style="margin-top:8px;">
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">
        Super Tiebreak (if sets tied)
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="number" min="0" id="ts-st-a" value="${existingScore.superTb?.a||''}"
          style="width:52px;padding:6px;border-radius:4px;border:1px solid var(--border);
          background:var(--surface-1);color:var(--text-primary);text-align:center;font-size:16px;font-weight:700;">
        <span style="color:var(--muted);font-weight:700;">–</span>
        <input type="number" min="0" id="ts-st-b" value="${existingScore.superTb?.b||''}"
          style="width:52px;padding:6px;border-radius:4px;border:1px solid var(--border);
          background:var(--surface-1);color:var(--text-primary);text-align:center;font-size:16px;font-weight:700;">
        <span style="font-size:10px;color:var(--muted);">First to 10, win by 2, no cap</span>
      </div>
    </div>
    <div id="ts-score-error" style="color:var(--red);font-size:11px;margin-top:8px;min-height:16px;"></div>`;

  openModal('tournamentScoreModal');
}

async function submitTournamentScore(){
  if(!_currentTournamentMatch) return;
  const {tournamentId, matchId, match} = _currentTournamentMatch;
  const t = S_tournament;
  const sets = t.format?.sets||2;

  const setScores = [];
  for(let i=0;i<sets;i++){
    const a = parseInt(document.getElementById(`ts-s${i}-a`)?.value);
    const b = parseInt(document.getElementById(`ts-s${i}-b`)?.value);
    setScores.push({a,b});
  }

  const stA = document.getElementById('ts-st-a')?.value;
  const stB = document.getElementById('ts-st-b')?.value;
  const superTb = stA!==''&&stB!==''&&stA!==undefined
    ? {a:parseInt(stA), b:parseInt(stB)} : null;

  const scoreData = {sets:setScores, superTb};
  const validation = validateTournamentScore(scoreData, t.format);

  if(!validation.valid){
    document.getElementById('ts-score-error').textContent = validation.message;
    return;
  }

  // Save match
  const updated = {
    ...match,
    score: scoreData,
    winner: validation.winner,
    status: 'confirmed',
    enteredBy: firebase.auth().currentUser?.email,
    enteredAt: new Date().toISOString()
  };

  await TournamentsDB.saveMatch(tournamentId, matchId, updated);

  // Recalculate standings
  S_tournamentMatches = await TournamentsDB.getMatches(tournamentId);
  const allStandings = {};
  (t.groups||[]).forEach(g=>{
    const gs = calcTournamentGroupStandings(t, g.groupId, S_tournamentMatches);
    gs.forEach(s=>{ allStandings[s.pairId]=s; });
  });
  await TournamentsDB.update(tournamentId, {standings:allStandings});
  S_tournament = await TournamentsDB.get(tournamentId);
  S.tournaments[tournamentId] = S_tournament;

  closeModal('tournamentScoreModal');
  showToast('Score saved');
  renderTournamentsPage();
}

// ── Admin actions ─────────────────────────────────────────────────────────────

async function registerForTournament(tid){
  const p1name  = document.getElementById('treg-p1name')?.value.trim();
  const p1email = document.getElementById('treg-p1email')?.value.trim()||null;
  const p2name  = document.getElementById('treg-p2name')?.value.trim();
  const p2email = document.getElementById('treg-p2email')?.value.trim()||null;
  if(!p1name||!p2name){ showToast('Enter both player names',true); return; }

  const t = S.tournaments[tid];
  const regs = t.registrations||[];
  const confirmed = regs.filter(r=>r.status==='confirmed');
  const isFull = confirmed.length >= (t.drawSize||16);
  const pairId = generatePairId(p1name, p2name, t.date);

  const newReg = {
    pairId, registeredAt: new Date().toISOString(),
    status: isFull ? 'waitlist' : 'confirmed',
    seed: null,
    player1:{name:p1name, email:p1email,
      uid: p1email ? (Object.values(S.players||{}).find(p=>p.email===p1email)?.uid||null) : null},
    player2:{name:p2name, email:p2email,
      uid: p2email ? (Object.values(S.players||{}).find(p=>p.email===p2email)?.uid||null) : null}
  };

  await TournamentsDB.update(tid, {
    registrations: firebase.firestore.FieldValue.arrayUnion(newReg)
  });
  showToast(isFull ? 'Added to waitlist' : 'Registered successfully');
  S_tournament = await TournamentsDB.get(tid);
  S.tournaments[tid] = S_tournament;
  renderTournamentsPage();
}

async function withdrawFromTournament(tid, pairId){
  if(!confirm('Withdraw your registration?')) return;
  const t = S.tournaments[tid];
  const reg = (t.registrations||[]).find(r=>r.pairId===pairId);
  if(!reg) return;
  await TournamentsDB.update(tid, {
    registrations: firebase.firestore.FieldValue.arrayRemove(reg)
  });
  // Auto-promote first waitlisted team
  const waitlist = (t.registrations||[]).filter(r=>r.status==='waitlist'&&r.pairId!==pairId);
  if(reg.status==='confirmed' && waitlist.length){
    const promote = {...waitlist[0], status:'confirmed'};
    await TournamentsDB.update(tid, {
      registrations: firebase.firestore.FieldValue.arrayRemove(waitlist[0])
    });
    await TournamentsDB.update(tid, {
      registrations: firebase.firestore.FieldValue.arrayUnion(promote)
    });
    showToast(`${promote.player1.name} & ${promote.player2.name} promoted from waitlist`);
  } else {
    showToast('Withdrawn');
  }
  S_tournament = await TournamentsDB.get(tid);
  S.tournaments[tid] = S_tournament;
  renderTournamentsPage();
}

async function adminRemoveTeam(tid, pairId){
  const t = S.tournaments[tid];
  const reg = (t.registrations||[]).find(r=>r.pairId===pairId);
  if(!reg) return;
  await TournamentsDB.update(tid, {
    registrations: firebase.firestore.FieldValue.arrayRemove(reg)
  });
  showToast('Team removed');
  S_tournament = await TournamentsDB.get(tid);
  S.tournaments[tid] = S_tournament;
  renderTournamentsPage();
}

async function promoteFromWaitlist(tid, pairId){
  if(!isAdminUser()) return;
  const t = S.tournaments[tid];
  const regs = t.registrations||[];
  const reg = regs.find(r=>r.pairId===pairId&&r.status==='waitlist');
  if(!reg) return;
  const confirmed = regs.filter(r=>r.status==='confirmed');
  if(confirmed.length >= (t.drawSize||16)){ showToast('Draw is full',true); return; }
  const updated = {...reg, status:'confirmed'};
  await TournamentsDB.update(tid, {
    registrations: firebase.firestore.FieldValue.arrayRemove(reg)
  });
  await TournamentsDB.update(tid, {
    registrations: firebase.firestore.FieldValue.arrayUnion(updated)
  });
  showToast('Team promoted to confirmed');
  S_tournament = await TournamentsDB.get(tid);
  S.tournaments[tid] = S_tournament;
  renderTournamentsPage();
}

// ── Seeding panel ─────────────────────────────────────────────────────────────

function openTournamentSeedingPanel(tid){
  const t = S.tournaments[tid];
  if(!t) return;
  const confirmed = (t.registrations||[]).filter(r=>r.status==='confirmed');

  document.getElementById('tournament-seeding-content').innerHTML=`
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">
      Drag or type seed numbers. Seeding determines snake draw into groups.
      ${confirmed.length} teams · Draw size: ${t.drawSize||16}
    </div>
    <div id="seed-list">
      ${confirmed.map((r,i)=>`
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);"
          data-pairid="${r.pairId}">
          <span style="font-size:11px;color:var(--muted);width:20px;">${i+1}</span>
          <div style="flex:1;font-size:13px;font-weight:600;">${r.player1.name} & ${r.player2.name}</div>
          <input type="number" min="1" max="${confirmed.length}"
            value="${r.seed||i+1}" id="seed-${r.pairId}"
            style="width:52px;padding:4px;border-radius:4px;border:1px solid var(--border);
            background:var(--surface-1);color:var(--text-primary);text-align:center;font-size:14px;">
        </div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
      <div>
        <label class="form-label" style="font-size:10px;">Groups</label>
        <select class="form-select" id="seed-group-count">
          ${[2,3,4,6,8].map(n=>`<option value="${n}" ${Math.ceil(confirmed.length/4)===n?'selected':''}>${n} groups</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label" style="font-size:10px;">Advance per group</label>
        <select class="form-select" id="seed-advance">
          <option value="1">1 team</option>
          <option value="2" selected>2 teams</option>
          <option value="3">3 teams</option>
        </select>
      </div>
    </div>`;

  openModal('tournamentSeedingModal');
}

async function confirmSeeding(tid){
  const t = S.tournaments[tid]||S_tournament;
  if(!t) return;
  const confirmed = (t.registrations||[]).filter(r=>r.status==='confirmed');
  const groupCount = parseInt(document.getElementById('seed-group-count')?.value||'4');
  const advancePerGroup = parseInt(document.getElementById('seed-advance')?.value||'2');

  // Read seeds
  const seeded = confirmed.map(r=>({
    ...r,
    seed: parseInt(document.getElementById(`seed-${r.pairId}`)?.value||'999')
  })).sort((a,b)=>a.seed-b.seed);

  // Snake seeding into groups: 1→A, 2→B, 3→C, 4→C, 5→B, 6→A ...
  const groupNames = 'ABCDEFGH'.slice(0,groupCount).split('');
  const groups = groupNames.map((name,i)=>({
    groupId:`group_${i}`, name, pairIds:[]
  }));

  seeded.forEach((team,i)=>{
    const cycle = Math.floor(i/groupCount);
    const posInCycle = i % groupCount;
    const groupIdx = cycle%2===0 ? posInCycle : groupCount-1-posInCycle;
    groups[groupIdx].pairIds.push(team.pairId);
  });

  // Update registrations with seeds
  const updatedRegs = (t.registrations||[]).map(r=>{
    const s = seeded.find(x=>x.pairId===r.pairId);
    return s ? {...r, seed:s.seed} : r;
  });

  await TournamentsDB.update(tid||t.id, {
    registrations: updatedRegs,
    groups, advancePerGroup,
    status: 'seeding'
  });

  closeModal('tournamentSeedingModal');
  showToast(`${groupCount} groups seeded with snake draw`);
  S_tournament = await TournamentsDB.get(tid||t.id);
  S.tournaments[S_tournament.id] = S_tournament;
  renderTournamentsPage();
}

async function startGroupStage(tid){
  const t = S.tournaments[tid];
  if(!t||!isAdminUser()) return;
  const groups = t.groups||[];
  if(!groups.length){ showToast('Seed teams first',true); return; }

  // Generate round-robin matches per group
  let matchCount = 0;
  for(const group of groups){
    const pairs = group.pairIds.map(pid=>{
      const reg = (t.registrations||[]).find(r=>r.pairId===pid);
      return reg ? {pairId:pid, name:`${reg.player1.name} & ${reg.player2.name}`} : null;
    }).filter(Boolean);

    // Round-robin: every pair vs every other pair
    for(let i=0;i<pairs.length;i++){
      for(let j=i+1;j<pairs.length;j++){
        const matchId = `${group.groupId}_m${i}_${j}`;
        matchCount++;
        await TournamentsDB.saveMatch(tid, matchId, {
          id: matchId,
          phase: 'group',
          groupId: group.groupId,
          round: null,
          pairAId: pairs[i].pairId,
          pairBId: pairs[j].pairId,
          pairA: pairs[i],
          pairB: pairs[j],
          score: null, winner: null,
          status: 'pending',
          scheduledAt: null, court: null
        });
      }
    }
  }

  await TournamentsDB.update(tid, {status:'groups'});
  showToast(`Group stage started — ${matchCount} matches generated`);
  S_tournament = await TournamentsDB.get(tid);
  S.tournaments[tid] = S_tournament;
  S_tournamentMatches = await TournamentsDB.getMatches(tid);
  renderTournamentsPage();
}

async function generateKOFromGroups(tid){
  if(!isAdminUser()) return;
  const t = S.tournaments[tid];
  if(!t) return;

  const advanceCount = t.advancePerGroup||2;
  const qualifiers = [];

  (t.groups||[]).forEach(group=>{
    const standings = calcTournamentGroupStandings(t, group.groupId, S_tournamentMatches);
    standings.slice(0,advanceCount).forEach((s,i)=>{
      qualifiers.push({...s, groupName:group.name, groupPos:i+1});
    });
  });

  if(qualifiers.length < 2){ showToast('Not enough qualifiers',true); return; }

  // Build KO bracket — standard seeding: A1 vs B2, B1 vs A2 etc.
  const n = Math.pow(2, Math.ceil(Math.log2(qualifiers.length)));
  const round = n/2;
  let matchCount = 0;

  // Pair qualifiers: 1 vs last, 2 vs second-last (standard bracket seeding)
  const bracket = [...qualifiers];
  while(bracket.length < n) bracket.push(null); // byes

  for(let i=0;i<n/2;i++){
    const pA = bracket[i];
    const pB = bracket[n-1-i];
    const matchId = `ko_r${round}_m${i}`;
    matchCount++;
    await TournamentsDB.saveMatch(tid, matchId, {
      id: matchId,
      phase: 'ko', round,
      pairAId: pA?.pairId||null,
      pairBId: pB?.pairId||null,
      pairA: pA ? {pairId:pA.pairId, name:pA.name} : null,
      pairB: pB ? {pairId:pB.pairId, name:pB.name} : null,
      score: null, winner: pA&&!pB?'A':!pA&&pB?'B':null,
      status: pA&&!pB||!pA&&pB?'confirmed':'pending',
      scheduledAt:null, court:null
    });
  }

  await TournamentsDB.update(tid, {status:'knockout', currentPhase:'knockout'});
  showToast(`Knockout bracket generated — ${matchCount} matches`);
  S_tournament = await TournamentsDB.get(tid);
  S.tournaments[tid] = S_tournament;
  S_tournamentMatches = await TournamentsDB.getMatches(tid);
  renderTournamentsPage();
}

async function completeTournament(tid){
  if(!confirm('Mark tournament as complete?')) return;
  await TournamentsDB.update(tid, {status:'complete'});
  showToast('Tournament complete');
  S_tournament = await TournamentsDB.get(tid);
  S.tournaments[tid] = S_tournament;
  renderTournamentsPage();
}

async function deleteTournament(tid, name){
  if(!confirm(`Delete "${name}"?\n\nThis removes the tournament and all matches permanently.`)) return;
  const matches = await TournamentsDB.getMatches(tid);
  for(const m of matches){
    await db.collection('tournaments').doc(tid).collection('matches').doc(m.id).delete();
  }
  await db.collection('tournaments').doc(tid).delete();
  delete S.tournaments[tid];
  S_tournament = null;
  S_tournamentMatches = [];
  showToast('Tournament deleted');
  renderTournamentsPage();
}

// ── Create tournament modal ───────────────────────────────────────────────────

function openCreateTournamentModal(){
  openModal('createTournamentModal');
}

async function createTournament(){
  const name      = document.getElementById('tn-name')?.value.trim();
  const date      = document.getElementById('tn-date')?.value;
  const endDate   = document.getElementById('tn-enddate')?.value||date;
  const venue     = document.getElementById('tn-venue')?.value.trim()||null;
  const drawSize  = parseInt(document.getElementById('tn-draw')?.value||'16');
  const sets      = parseInt(document.getElementById('tn-sets')?.value||'2');

  if(!name){ showToast('Enter tournament name',true); return; }
  if(!date){ showToast('Enter start date',true); return; }

  await TournamentsDB.create({
    name, date, endDate, venue, drawSize,
    format:{ sets, superTb:{target:10, hardCap:null, winBy:2} },
    season: ACTIVE_SEASON
  });

  closeModal('createTournamentModal');
  showToast(`${name} created — registration open`);
  S.tournaments = {};
  TournamentsDB.subscribe(()=>{
    if(document.querySelector('.page.active')?.id==='page-tournaments')
      renderTournamentsPage();
  });
  renderTournamentsPage();
}
