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
          ${e.status==='active'&&e.standings&&Object.keys(e.standings).length?(()=>{
            const top3 = Object.values(e.standings)
              .filter(s=>!s.withdrawn)
              .sort((a,b)=>b.points-a.points||b.gamesWon-a.gamesWon)
              .slice(0,3);
            return `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
              ${top3.map((s,i)=>`<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;">
                <span>${['🥇','🥈','🥉'][i]} ${s.name}</span>
                <span style="font-family:'Space Mono',monospace;color:var(--brand);font-weight:700;">${s.points}pts</span>
              </div>`).join('')}
            </div>`;
          })():''}
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
        ${e.status==='open'?`<button class="btn btn-primary btn-sm" onclick="startEvent('${e.id}')">▶ Start Event</button>`:''}
        ${e.status==='open'?`<button class="btn btn-ghost btn-sm" onclick="openEditEventModal('${e.id}')">✎ Edit</button>`:''}
        ${e.status==='active'&&allConfirmed?`<button class="btn btn-primary btn-sm" onclick="advanceRound('${e.id}')">Next Round →</button>`:''}
        ${e.status==='active'?`<button class="btn btn-ghost btn-sm" onclick="mexicanoEndEvent('${e.id}')">✓ End Event</button>`:''}
        ${e.status!=='active'?`<button class="btn btn-danger btn-sm" onclick="deleteEvent('${e.id}','${e.name.replace(/'/g,"\\'")}')">Delete</button>`:''}
      </div>`:''}
    </div>

    <!-- Leaderboard button -->
    <div style="margin-bottom:12px;">
      <button class="btn btn-ghost btn-sm" onclick="openLeaderboard('${e.id}')">📺 Full-screen Leaderboard</button>
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
                  ${(()=>{
                    const target = e.scoreFormat?.target;
                    const autoFill = target ? `oninput="autoFillScore('${m.matchId}',${target},this,'A')"` : '';
                    const autoFillB = target ? `oninput="autoFillScore('${m.matchId}',${target},this,'B')"` : '';
                    return `<div style="display:flex;flex-direction:column;gap:4px;">
                      ${target?`<div style="font-size:9px;color:var(--muted);text-align:center;">of ${target}</div>`:''}
                      <div style="display:flex;align-items:center;gap:6px;">
                        <input type="number" min="0" max="${target||999}" id="sA_${m.matchId}" placeholder="0"
                          style="width:52px;padding:6px;border-radius:4px;border:1px solid var(--border);background:var(--surface-1);color:var(--text-primary);text-align:center;font-size:16px;font-weight:700;"
                          ${autoFill}>
                        <span style="color:var(--muted);font-weight:700;">–</span>
                        <input type="number" min="0" max="${target||999}" id="sB_${m.matchId}" placeholder="0"
                          style="width:52px;padding:6px;border-radius:4px;border:1px solid var(--border);background:var(--surface-1);color:var(--text-primary);text-align:center;font-size:16px;font-weight:700;"
                          ${autoFillB}>
                        <button class="btn btn-primary btn-sm" onclick="submitMexicanoScore('${e.id}',${activeRound.roundNumber},'${m.matchId}')">✓</button>
                      </div>
                    </div>`;
                  })()}
                </div>`
              :`<div style="font-size:11px;color:var(--muted);">Pending</div>`
          }
        </div>`).join('')}
      ${activeRound.matches.filter(m=>m.isBye).map(m=>`
        <div class="card" style="opacity:0.6;border-left:3px solid var(--muted);">
          <div style="font-size:11px;font-weight:600;margin-bottom:2px;">⏸ Bye this round</div>
          <div style="font-size:12px;color:var(--muted);">${m.byeNames||m.byeName||'—'} sit out</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px;">Lowest ranked pair rotates out each round</div>
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

function autoFillScore(matchId, target, inputEl, side){
  const val = parseInt(inputEl.value);
  if(isNaN(val)||val<0) return;
  const clamped = Math.min(val, target);
  inputEl.value = clamped;
  const complement = target - clamped;
  const otherId = side==='A' ? `sB_${matchId}` : `sA_${matchId}`;
  const otherEl = document.getElementById(otherId);
  if(otherEl) otherEl.value = complement;
}

async function submitMexicanoScore(eventId, roundNumber, matchId){
  const scoreA = parseInt(document.getElementById(`sA_${matchId}`)?.value);
  const scoreB = parseInt(document.getElementById(`sB_${matchId}`)?.value);
  if(isNaN(scoreA)||isNaN(scoreB)){showToast('Enter both scores',true);return;}
  await mexicanoEnterScore(eventId, roundNumber, matchId, scoreA, scoreB);
  // Reload rounds
  S_eventRounds = await EventsDB.getRounds(eventId);
  S_eventDetail = S.events[eventId];
  renderEventsPage();
}

// ── Admin event controls ──────────────────────────────────────────────────────

// ── Format dispatchers ───────────────────────────────────────────────────────

async function startEvent(eventId){
  const e = S.events[eventId];
  if(!e) return;
  if(e.type === 'americano') return americanoStartEvent(eventId);
  return mexicanoStartEvent(eventId); // mexicano + king (future)
}

async function advanceRound(eventId){
  const e = S.events[eventId];
  if(!e) return;
  if(e.type === 'americano') return americanoNextRound(eventId);
  return mexicanoNextRound(eventId);
}

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

// ── Event player picker ───────────────────────────────────────────────────────
// Selected players stored as array of {uid, name, email, nprp} objects

let _evSelectedPlayers = [];

async function initEventPlayerPicker(){
  const picker = document.getElementById('ev-player-picker');
  if(!picker) return;
  picker.innerHTML = '<div style="padding:8px;color:var(--muted);font-size:12px;">Loading players...</div>';

  try {
    const players = await PlayersDB.listAll();
    // Enrich with NPRP from team roster
    const enriched = players.map(p => {
      const team = Object.values(S.teams).find(t =>
        t.season===ACTIVE_SEASON && t.players?.some(pl=>pl.claimedByEmail===p.email)
      );
      const pr = team?.players?.find(pl=>pl.claimedByEmail===p.email);
      return { ...p, nprp: parseFloat(pr?.nprp)||3.5, teamName: team?.name||'' };
    });
    picker._allPlayers = enriched;
    renderEventPlayerPicker(enriched);
  } catch(err){
    picker.innerHTML = '<div style="padding:8px;color:var(--muted);font-size:12px;">No players in directory yet.</div>';
  }
}

function renderEventPlayerPicker(players){
  const picker = document.getElementById('ev-player-picker');
  if(!picker) return;
  const selectedUids = new Set(_evSelectedPlayers.map(p=>p.uid));

  if(!players.length){
    picker.innerHTML = '<div style="padding:8px;color:var(--muted);font-size:12px;">No players found.</div>';
    return;
  }

  picker.innerHTML = players.map(p => {
    const selected = selectedUids.has(p.uid);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;
              cursor:pointer;border-bottom:1px solid var(--border);
              background:${selected?'rgba(74,222,128,0.06)':'transparent'};"
              onclick="toggleEventPlayer('${p.uid}','${(p.displayName||p.email).replace(/'/g,"\\'")}','${p.email||''}',${p.nprp||3.5})">
      <div style="width:18px;height:18px;border-radius:4px;border:1px solid var(--border);
        background:${selected?'var(--accent)':'transparent'};display:flex;align-items:center;
        justify-content:center;flex-shrink:0;">
        ${selected?'<span style="color:#000;font-size:11px;font-weight:700;">✓</span>':''}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${p.displayName||p.email}
        </div>
        <div style="font-size:10px;color:var(--muted);">${p.teamName||'No team'} · NPRP ${p.nprp||'—'}</div>
      </div>
    </div>`;
  }).join('');
}

function filterEventPlayerPicker(){
  const q = document.getElementById('ev-player-search')?.value.toLowerCase()||'';
  const picker = document.getElementById('ev-player-picker');
  const all = picker?._allPlayers||[];
  const filtered = all.filter(p =>
    (p.displayName||'').toLowerCase().includes(q) ||
    (p.email||'').toLowerCase().includes(q) ||
    (p.teamName||'').toLowerCase().includes(q)
  );
  renderEventPlayerPicker(filtered);
}

function toggleEventPlayer(uid, name, email, nprp){
  const idx = _evSelectedPlayers.findIndex(p=>p.uid===uid);
  if(idx>=0){
    _evSelectedPlayers.splice(idx,1);
  } else {
    _evSelectedPlayers.push({uid, name, email:email||null, nprp:parseFloat(nprp)||3.5, withdrawn:false});
  }
  const picker = document.getElementById('ev-player-picker');
  if(picker?._allPlayers) renderEventPlayerPicker(picker._allPlayers);
  renderSelectedEventPlayers();
}

function renderSelectedEventPlayers(){
  const el = document.getElementById('ev-selected-players');
  const count = document.getElementById('ev-selected-count');
  if(!el) return;
  if(count) count.textContent = _evSelectedPlayers.length;
  const isEven = _evSelectedPlayers.length%2===0;
  const isEnough = _evSelectedPlayers.length>=4;
  el.innerHTML = _evSelectedPlayers.map(p=>`
    <div style="display:flex;align-items:center;gap:6px;padding:4px 8px;
      background:var(--surface-1);border-radius:6px;border:1px solid var(--border);">
      <span style="font-size:12px;">${p.name}</span>
      <span style="font-size:10px;color:var(--brand);">NPRP ${p.nprp}</span>
      <button onclick="removeEventPlayer('${p.uid}')" style="background:none;border:none;
        color:var(--muted);cursor:pointer;font-size:12px;padding:0;line-height:1;">✕</button>
    </div>`).join('');
  if(!isEnough||!isEven){
    el.innerHTML += `<div style="font-size:10px;color:var(--warn);padding:4px;">
      ${!isEnough?'Need at least 4 players. ':''}${!isEven&&_evSelectedPlayers.length>=4?'Must be even number.':''}
    </div>`;
  }
}

function removeEventPlayer(uid){
  _evSelectedPlayers = _evSelectedPlayers.filter(p=>p.uid!==uid);
  const picker = document.getElementById('ev-player-picker');
  if(picker?._allPlayers) renderEventPlayerPicker(picker._allPlayers);
  renderSelectedEventPlayers();
}

function addManualEventPlayer(){
  const name = document.getElementById('ev-manual-name')?.value.trim();
  const nprp = parseFloat(document.getElementById('ev-manual-nprp')?.value)||3.5;
  if(!name){showToast('Enter player name',true);return;}
  const uid = `manual_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  _evSelectedPlayers.push({uid, name, email:null, nprp, withdrawn:false});
  document.getElementById('ev-manual-name').value='';
  document.getElementById('ev-manual-nprp').value='';
  renderSelectedEventPlayers();
}

function toggleAmericanoVariant(){
  const type = document.getElementById('ev-type')?.value;
  const wrap = document.getElementById('ev-variant-wrap');
  if(wrap) wrap.style.display = type==='americano' ? '' : 'none';
}

function openCreateEventModal(){
  _evSelectedPlayers = [];
  renderSelectedEventPlayers();
  openModal('createEventModal');
  // Load players after modal opens
  setTimeout(initEventPlayerPicker, 100);
}

async function createPadelEvent(){
  const name    = document.getElementById('ev-name')?.value.trim();
  const type    = document.getElementById('ev-type')?.value;
  const date    = document.getElementById('ev-date')?.value;
  const courts  = parseInt(document.getElementById('ev-courts')?.value||'1');
  const rounds  = parseInt(document.getElementById('ev-rounds')?.value||'6');
  const sfType  = document.getElementById('ev-score-type')?.value;
  const sfVal   = parseInt(document.getElementById('ev-score-val')?.value||'16');

  if(!name){showToast('Enter event name',true);return;}

  const players = _evSelectedPlayers.map(p=>({...p, withdrawn:false}));
  if(players.length<4){showToast('Need at least 4 players',true);return;}
  if(players.length%2!==0){showToast('Need an even number of players — add or remove one',true);return;}

  const scoreFormat = sfType==='games'
    ? {type:'games',target:sfVal}
    : sfType==='timed'
      ? {type:'timed',minutes:sfVal}
      : {type:'sets',sets:2};
  const variant = document.getElementById('ev-variant')?.value||'roundrobin';

  const eventId = await EventsDB.create({
    name, type, date, courts, totalRounds:rounds,
    players, scoreFormat, variant, season: ACTIVE_SEASON
  });

  closeModal('createEventModal');
  showToast(`${name} created — add players and start when ready`);
  S_eventDetail = await EventsDB.get(eventId);
  S.events[eventId] = S_eventDetail;
  renderEventsPage();
}

// ── Delete event ─────────────────────────────────────────────────────────────

async function deleteEvent(eventId, name){
  if(!isAdminUser()) return;
  if(!confirm(`Delete "${name}"?\n\nThis removes the event and all rounds permanently.`)) return;
  try {
    // Delete all rounds first
    const rounds = await EventsDB.getRounds(eventId);
    for(const r of rounds){
      await db.collection('events').doc(eventId).collection('rounds').doc(String(r.roundNumber)).delete();
    }
    await db.collection('events').doc(eventId).delete();
    delete S.events[eventId];
    S_eventDetail = null;
    S_eventRounds = [];
    showToast('Event deleted');
    renderEventsPage();
  } catch(err){ showToast('Failed: '+err.message, true); }
}

// ── Edit event (open only — name, date, courts, rounds, score format) ─────────

function openEditEventModal(eventId){
  const e = S.events[eventId];
  if(!e) return;
  // Reuse create modal but pre-fill
  document.getElementById('ev-name').value  = e.name||'';
  document.getElementById('ev-type').value  = e.type||'mexicano';
  document.getElementById('ev-date').value  = e.date||'';
  document.getElementById('ev-courts').value= e.courts||2;
  document.getElementById('ev-rounds').value= e.totalRounds||6;
  document.getElementById('ev-score-type').value = e.scoreFormat?.type||'games';
  document.getElementById('ev-score-val').value  = e.scoreFormat?.target||e.scoreFormat?.minutes||16;
  // Pre-fill players
  // Pre-fill selected players from existing event
  _evSelectedPlayers = (e.players||[]).map(p=>({...p}));
  setTimeout(()=>{ initEventPlayerPicker(); renderSelectedEventPlayers(); }, 100);

  const title = document.querySelector('#createEventModal .modal-title');
  if(title) title.textContent = 'Edit Event';
  const btn = document.querySelector('#createEventModal .btn-primary');
  if(btn){ btn.textContent = 'Save Changes'; btn.setAttribute('onclick',`saveEditEvent('${eventId}')`); }
  openModal('createEventModal');
}

async function saveEditEvent(eventId){
  const name    = document.getElementById('ev-name')?.value.trim();
  const type    = document.getElementById('ev-type')?.value;
  const date    = document.getElementById('ev-date')?.value;
  const courts  = parseInt(document.getElementById('ev-courts')?.value||'2');
  const rounds  = parseInt(document.getElementById('ev-rounds')?.value||'6');
  const sfType  = document.getElementById('ev-score-type')?.value;
  const sfVal   = parseInt(document.getElementById('ev-score-val')?.value||'16');
  if(!name){showToast('Enter event name',true);return;}

  const players = _evSelectedPlayers.map(p=>({...p, withdrawn:false}));
  if(players.length<4){showToast('Need at least 4 players',true);return;}
  if(players.length%2!==0){showToast('Need an even number of players — add or remove one',true);return;}

  const scoreFormat = sfType==='games'?{type:'games',target:sfVal}:sfType==='timed'?{type:'timed',minutes:sfVal}:{type:'sets',sets:2};

  await EventsDB.update(eventId,{name,type,date,courts,totalRounds:rounds,players,scoreFormat});
  S_eventDetail = await EventsDB.get(eventId);
  S.events[eventId] = S_eventDetail;

  // Restore modal to create mode
  const title = document.querySelector('#createEventModal .modal-title');
  if(title) title.textContent = 'Create Event';
  const btn = document.querySelector('#createEventModal .btn-primary');
  if(btn){ btn.textContent = 'Create Event'; btn.setAttribute('onclick','createPadelEvent()'); }
  closeModal('createEventModal');
  showToast('Event updated');
  renderEventsPage();
}

// ── Full-screen leaderboard ───────────────────────────────────────────────────
// Opens a separate overlay designed for projection on a screen or TV.
// Updates in real-time via Firestore subscription on the event doc.

let _leaderboardUnsub = null;

async function openLeaderboard(eventId){
  const overlay = document.createElement('div');
  overlay.id = 'leaderboard-overlay';
  overlay.style.cssText = `
    position:fixed;top:0;left:0;right:0;bottom:0;
    background:#0a0f1e;z-index:9999;
    display:flex;flex-direction:column;
    font-family:'Space Mono',monospace;
    overflow:hidden;`;

  document.body.appendChild(overlay);

  // Load all rounds for history + next round panel
  S_eventRounds = await EventsDB.getRounds(eventId);
  renderLeaderboard(eventId, overlay);

  // Real-time subscription — event doc updates trigger re-render + round reload
  _leaderboardUnsub = db.collection('events').doc(eventId)
    .onSnapshot(async snap=>{
      if(!snap.exists) return;
      S.events[eventId] = { id:snap.id, ...snap.data() };
      S_eventRounds = await EventsDB.getRounds(eventId);
      renderLeaderboard(eventId, overlay);
    });
}

function closeLeaderboard(){
  if(_leaderboardUnsub){ _leaderboardUnsub(); _leaderboardUnsub=null; }
  if(window._lbResizeHandler){ window.removeEventListener('resize',window._lbResizeHandler); window._lbResizeHandler=null; }
  document.getElementById('leaderboard-overlay')?.remove();
}

function renderLeaderboard(eventId, overlay){
  const e = S.events[eventId];
  if(!e){ overlay.innerHTML=''; return; }

  const formatLabel = {mexicano:'MEXICANO',americano:'AMERICANO',king:'KING OF THE COURT'};

  overlay.innerHTML = `
    <style>
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
      .lb-toggle-btn{
        padding:10px 24px;border:none;cursor:pointer;font-family:'Space Mono',monospace;
        font-size:12px;letter-spacing:1px;text-transform:uppercase;
        background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);
        border-bottom:2px solid transparent;transition:all 0.2s;flex:1;
      }
      .lb-toggle-btn.active{
        background:rgba(245,200,66,0.08);color:#F5C842;
        border-bottom-color:#F5C842;
      }
      .lb-view{display:none;flex:1;overflow-y:auto;padding:20px 24px;}
      .lb-view.active{display:block;}
    </style>

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding:16px 24px;border-bottom:2px solid rgba(245,200,66,0.25);flex-shrink:0;">
      <div>
        <div style="font-size:10px;color:rgba(245,200,66,0.6);letter-spacing:3px;margin-bottom:3px;">
          ${formatLabel[e.type]||'EVENT'} · ROUND ${e.currentRound||0}${e.totalRounds?' OF '+e.totalRounds:''}
        </div>
        <div style="font-size:22px;font-weight:700;color:#fff;">${e.name}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:7px;height:7px;border-radius:50%;background:#4ade80;animation:pulse 1.5s infinite;"></div>
          <span style="font-size:10px;color:rgba(255,255,255,0.35);letter-spacing:1px;">LIVE</span>
        </div>
        <button onclick="closeLeaderboard()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
          color:#fff;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:12px;letter-spacing:1px;">✕ CLOSE</button>
      </div>
    </div>

    <!-- Toggle tabs -->
    <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">
      <button class="lb-toggle-btn active" onclick="lbShowTab('standings',this)">🏆 Standings</button>
      <button class="lb-toggle-btn" onclick="lbShowTab('courts',this)">🎾 On Court</button>
      <button class="lb-toggle-btn" onclick="lbShowTab('history',this)">📋 Results</button>
    </div>

    <!-- Views -->
    <div id="lb-view-standings" class="lb-view active"></div>
    <div id="lb-view-courts"    class="lb-view"></div>
    <div id="lb-view-history"   class="lb-view"></div>

    <!-- Footer -->
    <div style="padding:8px 24px;border-top:1px solid rgba(255,255,255,0.05);flex-shrink:0;
      display:flex;justify-content:space-between;">
      <span style="font-size:10px;color:rgba(255,255,255,0.2);">GO PARK Sports × The One · ${e.date||''}</span>
      <span style="font-size:10px;color:rgba(255,255,255,0.2);">padel-league-hk.web.app</span>
    </div>`;

  lbRenderAll(eventId);
}

function lbShowTab(tab, btn){
  document.querySelectorAll('.lb-toggle-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.lb-view').forEach(v=>v.classList.remove('active'));
  document.getElementById(`lb-view-${tab}`)?.classList.add('active');
}

function lbRenderAll(eventId){
  const e = S.events[eventId];
  if(!e) return;

  const standings = e.standings
    ? Object.values(e.standings).filter(s=>!s.withdrawn)
        .sort((a,b)=>b.points-a.points||b.gamesWon-a.gamesWon)
    : [];

  const currentRound = S_eventRounds?.find(r=>r.roundNumber===e.currentRound);
  const nextRound    = S_eventRounds?.find(r=>r.roundNumber===(e.currentRound||0)+1);
  const medals       = ['🥇','🥈','🥉'];

  // ── Standings ──
  const sEl = document.getElementById('lb-view-standings');
  if(sEl) sEl.innerHTML = !standings.length
    ? `<div style="text-align:center;color:rgba(255,255,255,0.3);font-size:16px;margin-top:60px;">No results yet</div>`
    : `<div style="display:grid;gap:8px;max-width:600px;margin:0 auto;">
        <div style="display:grid;grid-template-columns:44px 1fr 70px 56px 56px;gap:8px;
          padding:0 16px 8px;font-size:10px;color:rgba(255,255,255,0.25);letter-spacing:2px;">
          <div></div><div>PLAYER</div>
          <div style="text-align:center;">PTS</div>
          <div style="text-align:center;">GW</div>
          <div style="text-align:center;">GL</div>
        </div>
        ${standings.map((s,i)=>{
          const isTop = i<3;
          const bg = i===0?'rgba(245,200,66,0.10)':i===1?'rgba(192,192,192,0.06)':i===2?'rgba(205,127,50,0.06)':'rgba(255,255,255,0.03)';
          const bc = i===0?'rgba(245,200,66,0.3)':i===1?'rgba(200,200,200,0.15)':i===2?'rgba(205,127,50,0.15)':'rgba(255,255,255,0.06)';
          const rc = i===0?'#F5C842':i===1?'#C0C0C0':i===2?'#CD7F32':'rgba(255,255,255,0.3)';
          return `<div style="display:grid;grid-template-columns:44px 1fr 70px 56px 56px;gap:8px;
            align-items:center;padding:14px 16px;background:${bg};border:1px solid ${bc};border-radius:10px;">
            <div style="font-size:${isTop?'22px':'15px'};color:${rc};font-weight:700;text-align:center;">
              ${medals[i]||i+1}
            </div>
            <div>
              <div style="color:#fff;font-size:${isTop?'16px':'13px'};font-weight:${isTop?'700':'400'};">${s.name}</div>
              ${s.nprp?`<div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:1px;">NPRP ${s.nprp}</div>`:''}
            </div>
            <div style="text-align:center;font-size:${isTop?'22px':'16px'};font-weight:700;color:${rc};">${s.points}</div>
            <div style="text-align:center;color:#4ade80;font-size:14px;">${s.gamesWon}</div>
            <div style="text-align:center;color:#f87171;font-size:14px;">${s.gamesLost}</div>
          </div>`;
        }).join('')}
      </div>`;

  // ── Courts (current + next) ──
  const cEl = document.getElementById('lb-view-courts');
  if(cEl){
    const renderCourts = (round, label) => {
      if(!round) return `<div style="color:rgba(255,255,255,0.3);font-size:13px;margin-bottom:8px;">${label}</div>`;
      const active = (round.matches||[]).filter(m=>!m.isBye);
      const bye    = (round.matches||[]).filter(m=>m.isBye);
      return active.map(m=>`
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);
          border-radius:12px;padding:20px 24px;margin-bottom:12px;max-width:600px;margin-left:auto;margin-right:auto;">
          <div style="font-size:10px;color:rgba(245,200,66,0.6);letter-spacing:2px;margin-bottom:12px;">
            COURT ${m.court||'?'}${m.status==='confirmed'?' · ✓ DONE':''}
          </div>
          <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;">
            <div>
              ${m.teamANames.split(' & ').map(n=>`<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:2px;">${n}</div>`).join('')}
            </div>
            <div style="font-size:${m.status==='confirmed'?'28px':'18px'};font-weight:700;
              color:${m.status==='confirmed'?'#4ade80':'rgba(255,255,255,0.2)'};text-align:center;white-space:nowrap;">
              ${m.status==='confirmed'?`${m.scoreA} – ${m.scoreB}`:'VS'}
            </div>
            <div style="text-align:right;">
              ${m.teamBNames.split(' & ').map(n=>`<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:2px;">${n}</div>`).join('')}
            </div>
          </div>
        </div>`).join('')
      + bye.map(m=>`
        <div style="background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.08);
          border-radius:12px;padding:16px 24px;margin-bottom:12px;max-width:600px;margin-left:auto;margin-right:auto;">
          <div style="font-size:10px;color:rgba(255,255,255,0.25);letter-spacing:2px;margin-bottom:6px;">SITTING OUT THIS ROUND</div>
          <div style="font-size:16px;color:rgba(255,255,255,0.5);font-weight:600;">${m.byeNames||''}</div>
        </div>`).join('');
    };

    cEl.innerHTML = `
      <div style="font-size:10px;color:rgba(255,255,255,0.25);letter-spacing:2px;margin-bottom:16px;">
        ROUND ${e.currentRound} — NOW PLAYING
      </div>
      ${renderCourts(currentRound,'No active round')}
      ${nextRound?`
        <div style="font-size:10px;color:rgba(255,255,255,0.25);letter-spacing:2px;margin:24px 0 16px;">
          ROUND ${(e.currentRound||0)+1} — UP NEXT
        </div>
        ${renderCourts(nextRound,'')}
      `:'<div style="color:rgba(255,255,255,0.2);font-size:12px;margin-top:16px;">Next round will appear after current round is complete</div>'}`;
  }

  // ── History ──
  const hEl = document.getElementById('lb-view-history');
  if(hEl){
    // Group by round — ordered round 1 first (chronological)
    const rounds = (S_eventRounds||[])
      .filter(r=>(r.matches||[]).some(m=>!m.isBye&&m.status==='confirmed'))
      .sort((a,b)=>a.roundNumber-b.roundNumber);

    if(!rounds.length){
      hEl.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:13px;margin-top:20px;">No completed matches yet</div>';
    } else {
      hEl.innerHTML = `<div style="max-width:640px;margin:0 auto;">
        ${rounds.map(r=>{
          const matches = (r.matches||[]).filter(m=>!m.isBye&&m.status==='confirmed');
          const roundComplete = (r.matches||[]).filter(m=>!m.isBye).every(m=>m.status==='confirmed');
          return `
            <!-- Round header — always expanded -->
            <div style="display:flex;align-items:center;gap:10px;padding:12px 0 8px;
              border-bottom:1px solid rgba(245,200,66,0.2);margin-bottom:4px;">
              <div style="font-size:10px;font-weight:700;color:rgba(245,200,66,0.8);
                letter-spacing:2px;text-transform:uppercase;">Round ${r.roundNumber}</div>
              ${roundComplete
                ? '<div style="font-size:9px;color:#4ade80;letter-spacing:1px;">✓ COMPLETE</div>'
                : '<div style="font-size:9px;color:rgba(255,255,255,0.3);letter-spacing:1px;">IN PROGRESS</div>'}
            </div>
            <!-- Matches in this round -->
            ${matches.map(m=>{
              const aWon = m.scoreA > m.scoreB;
              const draw = m.scoreA === m.scoreB;
              return `<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;
                align-items:center;padding:10px 8px;margin-bottom:4px;
                background:rgba(255,255,255,0.03);border-radius:8px;">
                <!-- Team A -->
                <div>
                  ${m.teamANames.split(' & ').map(n=>`
                    <div style="font-size:12px;font-weight:${aWon?'700':'400'};
                      color:${aWon?'#fff':draw?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.35)'};
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${aWon?'🏆 ':''}${n}
                    </div>`).join('')}
                </div>
                <!-- Score -->
                <div style="text-align:center;">
                  <div style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;
                    color:#F5C842;white-space:nowrap;">${m.scoreA}–${m.scoreB}</div>
                  <div style="font-size:9px;color:rgba(255,255,255,0.2);margin-top:2px;">
                    Court ${m.court||'?'}
                  </div>
                </div>
                <!-- Team B -->
                <div style="text-align:right;">
                  ${m.teamBNames.split(' & ').map(n=>`
                    <div style="font-size:12px;font-weight:${!aWon&&!draw?'700':'400'};
                      color:${!aWon&&!draw?'#fff':draw?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.35)'};
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${n}${!aWon&&!draw?' 🏆':''}
                    </div>`).join('')}
                </div>
              </div>`;
            }).join('')}
            <div style="height:12px;"></div>`;
        }).join('')}
      </div>`;
    }
  }
}


function setKOTab(tab,el){
  S.koTab=tab;
  document.querySelectorAll('.ko-tab').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderKnockoutPage();
}
