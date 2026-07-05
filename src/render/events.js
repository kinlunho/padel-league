// src/render/events.js
// Events page — Mexicano, Americano, King of the Court

let S_eventDetail = null; // currently viewed event
let S_eventRounds = [];   // loaded rounds for current event

function renderEventsPage(){
  const container = document.getElementById('events-content');
  if(!container) return;

  if(S_eventDetail){
    renderEventDetail(container);
  } else {
    renderEventsList(container);
  }
}

// ── Events list ───────────────────────────────────────────────────────────────

function renderEventsList(container){
  const events = Object.values(S.events||{})
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const createBtn = isAdminUser()
    ? `<button class="btn btn-primary btn-sm" onclick="openCreateEventModal()">+ Create Event</button>`
    : '';

  if(!events.length){
    container.innerHTML=`
      <div style="text-align:center;padding:40px 0;">
        <div style="font-size:32px;margin-bottom:12px;">🎾</div>
        <div style="font-weight:600;font-size:14px;margin-bottom:6px;">No events yet</div>
        <div style="color:var(--muted);font-size:13px;margin-bottom:16px;">
          ${isAdminUser()?'Create the first event below.':'Events will appear here when scheduled by the admin.'}
        </div>
        ${createBtn}
      </div>`;
    return;
  }

  const formatIcon = {mexicano:'🔄',americano:'🤝',king:'👑'};
  const formatLabel = {mexicano:'Mexicano',americano:'Americano',king:'King of the Court'};
  const statusColor = {open:'var(--accent)',active:'var(--gold)',complete:'var(--muted)'};

  container.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:13px;color:var(--muted);">${events.length} event${events.length!==1?'s':''}</div>
      ${createBtn}
    </div>
    <div class="grid-2">
      ${events.map(e=>`
        <div class="card" style="cursor:pointer;border-left:3px solid ${statusColor[e.status]||'var(--border)'};"
          onclick="openEventDetail('${e.id}')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div style="font-size:20px;">${formatIcon[e.type]||'🎾'}</div>
            <span class="chip" style="font-size:10px;background:${statusColor[e.status]}22;color:${statusColor[e.status]};">
              ${e.status.toUpperCase()}
            </span>
          </div>
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${e.name}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">${formatLabel[e.type]||e.type}</div>
          <div style="font-size:11px;color:var(--muted);">
            📅 ${e.date||'TBC'} · 👥 ${(e.players||[]).length} players · 🎾 ${e.courts||1} court${e.courts!==1?'s':''}
          </div>
          ${e.scoreFormat?`<div style="font-size:10px;color:var(--muted);margin-top:2px;">
            Score: ${e.scoreFormat.type==='games'?`First to ${e.scoreFormat.target} games`:
              e.scoreFormat.type==='timed'?`${e.scoreFormat.minutes} min`:'Sets'}
          </div>`:''}
          <div style="font-size:11px;color:var(--brand);margin-top:6px;">
            Round ${e.currentRound||0}${e.totalRounds?` / ${e.totalRounds}`:''}
          </div>
        </div>`
      ).join('')}
    </div>`;
}

// ── Event detail ──────────────────────────────────────────────────────────────

async function openEventDetail(eventId){
  S_eventDetail = S.events[eventId];
  if(!S_eventDetail) return;
  S_eventRounds = await EventsDB.getRounds(eventId);
  renderEventsPage();
}

function closeEventDetail(){
  S_eventDetail = null;
  S_eventRounds = [];
  renderEventsPage();
}

function renderEventDetail(container){
  const e = S_eventDetail;
  if(!e){ renderEventsList(container); return; }

  const formatLabel = {mexicano:'Mexicano',americano:'Americano',king:'King of the Court'};
  const standings = mexicanoCalcStandings(e, S_eventRounds);
  const activeRound = S_eventRounds.find(r=>r.roundNumber===e.currentRound);
  const allConfirmed = activeRound && (activeRound.matches||[])
    .filter(m=>!m.isBye).every(m=>m.status==='confirmed');

  container.innerHTML=`
    <button class="btn btn-ghost btn-sm" style="margin-bottom:16px;" onclick="closeEventDetail()">← All Events</button>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
      <div>
        <div style="font-size:20px;font-weight:700;">${e.name}</div>
        <div style="font-size:12px;color:var(--muted);">${formatLabel[e.type]||e.type} · ${e.date||'TBC'} · ${(e.players||[]).length} players · ${e.courts||1} court${e.courts!==1?'s':''}</div>
      </div>
      ${isAdminUser()?`<div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${e.status==='open'?`<button class="btn btn-primary btn-sm" onclick="mexicanoStartEvent('${e.id}')">▶ Start Event</button>`:''}
        ${e.status==='active'&&allConfirmed?`<button class="btn btn-primary btn-sm" onclick="mexicanoNextRound('${e.id}')">Next Round →</button>`:''}
        ${e.status==='active'?`<button class="btn btn-ghost btn-sm" onclick="mexicanoEndEvent('${e.id}')">✓ End Event</button>`:''}
      </div>`:''}
    </div>

    <!-- Standings -->
    <div class="card" style="margin-bottom:16px;padding:0;overflow:hidden;">
      <div style="padding:12px 16px;font-weight:700;font-size:13px;border-bottom:1px solid var(--border);">
        🏆 Standings — Round ${e.currentRound||0}
      </div>
      <table style="width:100%;">
        <thead><tr style="font-size:11px;color:var(--muted);">
          <th style="padding:8px 12px;text-align:left;">#</th>
          <th style="padding:8px 12px;text-align:left;">Player</th>
          <th style="padding:8px 12px;text-align:center;">Pts</th>
          <th style="padding:8px 12px;text-align:center;">GW</th>
          <th style="padding:8px 12px;text-align:center;">GL</th>
          <th style="padding:8px 12px;text-align:center;">P</th>
        </tr></thead>
        <tbody>
          ${standings.map((s,i)=>`
            <tr style="border-top:1px solid var(--border);${s.withdrawn?'opacity:0.4;text-decoration:line-through;':i<2?'background:rgba(74,222,128,0.03)':''}">
              <td style="padding:8px 12px;font-family:'Space Mono',monospace;font-weight:700;color:${i===0?'var(--gold)':i===1?'var(--muted)':'var(--muted)'};">${i+1}</td>
              <td style="padding:8px 12px;font-weight:600;">${s.name}${s.withdrawn?' (withdrawn)':''}</td>
              <td style="padding:8px 12px;text-align:center;font-family:'Space Mono',monospace;font-weight:700;color:var(--brand);">${s.points}</td>
              <td style="padding:8px 12px;text-align:center;color:var(--accent);">${s.gamesWon}</td>
              <td style="padding:8px 12px;text-align:center;color:var(--red);">${s.gamesLost}</td>
              <td style="padding:8px 12px;text-align:center;color:var(--muted);">${s.played}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- Current round matches -->
    ${activeRound&&activeRound.matches?`
    <div style="font-weight:700;font-size:13px;margin-bottom:10px;">
      Round ${activeRound.roundNumber} Matches
    </div>
    <div class="match-grid">
      ${activeRound.matches.filter(m=>!m.isBye).map(m=>`
        <div class="card" style="border-left:3px solid ${m.status==='confirmed'?'var(--accent)':'var(--muted)'};">
          <div style="font-size:10px;color:var(--muted);margin-bottom:6px;">Court ${m.court||'?'}</div>
          <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${m.teamANames}</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">vs</div>
          <div style="font-weight:600;font-size:13px;margin-bottom:8px;">${m.teamBNames}</div>
          ${m.status==='confirmed'
            ?`<div style="font-family:'Space Mono',monospace;font-size:14px;font-weight:700;color:var(--accent);">${m.scoreA} – ${m.scoreB}</div>`
            :isAdminUser()
              ?`<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                  <input type="number" min="0" id="sA_${m.matchId}" placeholder="0" style="width:50px;padding:4px;border-radius:4px;border:1px solid var(--border);background:var(--surface-1);color:var(--text-primary);text-align:center;font-size:14px;">
                  <span style="color:var(--muted);">–</span>
                  <input type="number" min="0" id="sB_${m.matchId}" placeholder="0" style="width:50px;padding:4px;border-radius:4px;border:1px solid var(--border);background:var(--surface-1);color:var(--text-primary);text-align:center;font-size:14px;">
                  <button class="btn btn-primary btn-sm" onclick="submitMexicanoScore('${e.id}',${activeRound.roundNumber},'${m.matchId}')">✓</button>
                </div>`
              :`<div style="font-size:11px;color:var(--muted);">Pending</div>`
          }
        </div>`).join('')}
      ${activeRound.matches.filter(m=>m.isBye).map(m=>`
        <div class="card" style="opacity:0.6;">
          <div style="font-size:11px;color:var(--muted);">BYE — ${m.byeName} sits out this round</div>
        </div>`).join('')}
    </div>`:''}

    <!-- Players list (admin) -->
    ${isAdminUser()?`
    <div style="margin-top:16px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px;">Players</div>
      ${(e.players||[]).map(p=>`
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
          <div style="flex:1;font-size:12px;${p.withdrawn?'text-decoration:line-through;opacity:0.5':''}">${p.name} <span style="color:var(--muted);">NPRP ${p.nprp||'—'}</span></div>
          ${!p.withdrawn&&e.status==='active'?`<button class="btn btn-ghost btn-sm" style="font-size:10px;" onclick="mexicanoWithdrawPlayer('${e.id}','${p.uid}')">Withdraw</button>`:''}
        </div>`).join('')}
    </div>`:''}`;
}

// ── Score submit helper ───────────────────────────────────────────────────────

async function submitMexicanoScore(eventId, roundNumber, matchId){
  const scoreA = parseInt(document.getElementById(`sA_${matchId}`)?.value);
  const scoreB = parseInt(document.getElementById(`sB_${matchId}`)?.value);
  if(isNaN(scoreA)||isNaN(scoreB)){showToast('Enter both scores',true);return;}
  if(scoreA===scoreB){showToast('Mexicano must have a winner — no draws',true);return;}
  await mexicanoEnterScore(eventId, roundNumber, matchId, scoreA, scoreB);
  // Reload rounds
  S_eventRounds = await EventsDB.getRounds(eventId);
  S_eventDetail = S.events[eventId];
  renderEventsPage();
}

// ── Admin event controls ──────────────────────────────────────────────────────

async function mexicanoStartEvent(eventId){
  const e = S.events[eventId];
  if(!e||!isAdminUser()) return;
  if((e.players||[]).length<4){showToast('Need at least 4 players',true);return;}
  const round = mexicanoGenerateRound(e, 1, {});
  if(!round){showToast('Could not generate round',true);return;}
  await EventsDB.saveRound(eventId, 1, round);
  await EventsDB.update(eventId, {status:'active', currentRound:1});
  showToast('Event started — Round 1 generated');
  S_eventDetail = await EventsDB.get(eventId);
  S.events[eventId] = S_eventDetail;
  S_eventRounds = await EventsDB.getRounds(eventId);
  renderEventsPage();
}

async function mexicanoNextRound(eventId){
  const e = S.events[eventId];
  if(!e||!isAdminUser()) return;
  const nextRound = (e.currentRound||0)+1;
  if(e.totalRounds && nextRound > e.totalRounds){
    showToast('All rounds complete — end the event',true);return;
  }
  const standingsMap = e.standings||{};
  const round = mexicanoGenerateRound(e, nextRound, standingsMap);
  if(!round){showToast('Could not generate round',true);return;}
  await EventsDB.saveRound(eventId, nextRound, round);
  await EventsDB.update(eventId, {currentRound:nextRound});
  showToast(`Round ${nextRound} generated`);
  S_eventDetail = await EventsDB.get(eventId);
  S.events[eventId] = S_eventDetail;
  S_eventRounds = await EventsDB.getRounds(eventId);
  renderEventsPage();
}

async function mexicanoEndEvent(eventId){
  if(!confirm('End this event? Final standings will be locked.')) return;
  await EventsDB.update(eventId, {status:'complete'});
  showToast('Event complete');
  S_eventDetail = await EventsDB.get(eventId);
  S.events[eventId] = S_eventDetail;
  renderEventsPage();
}

// ── Create event modal ────────────────────────────────────────────────────────

function openCreateEventModal(){
  openModal('createEventModal');
}

async function createEvent(){
  const name    = document.getElementById('ev-name')?.value.trim();
  const type    = document.getElementById('ev-type')?.value;
  const date    = document.getElementById('ev-date')?.value;
  const courts  = parseInt(document.getElementById('ev-courts')?.value||'1');
  const rounds  = parseInt(document.getElementById('ev-rounds')?.value||'6');
  const sfType  = document.getElementById('ev-score-type')?.value;
  const sfVal   = parseInt(document.getElementById('ev-score-val')?.value||'16');

  if(!name){showToast('Enter event name',true);return;}

  // Parse players from textarea (name,email,nprp per line)
  const rawPlayers = document.getElementById('ev-players')?.value||'';
  const players = rawPlayers.split('\n').map(l=>l.trim()).filter(Boolean).map((line,i)=>{
    const parts = line.split(',').map(s=>s.trim());
    return {
      uid:   `ev_p${Date.now()}_${i}`,
      name:  parts[0]||`Player ${i+1}`,
      email: parts[1]||null,
      nprp:  parseFloat(parts[2])||3.5,
      withdrawn: false
    };
  });

  if(players.length<4){showToast('Need at least 4 players (one per line)',true);return;}
  if(players.length%2!==0){showToast('Need an even number of players',true);return;}

  const scoreFormat = sfType==='games'
    ? {type:'games',target:sfVal}
    : sfType==='timed'
      ? {type:'timed',minutes:sfVal}
      : {type:'sets',sets:2};

  const eventId = await EventsDB.create({
    name, type, date, courts, totalRounds:rounds,
    players, scoreFormat, season: ACTIVE_SEASON
  });

  closeModal('createEventModal');
  showToast(`${name} created — add players and start when ready`);
  S_eventDetail = await EventsDB.get(eventId);
  S.events[eventId] = S_eventDetail;
  renderEventsPage();
}

function setKOTab(tab,el){
  S.koTab=tab;
  document.querySelectorAll('.ko-tab').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderKnockoutPage();
}
