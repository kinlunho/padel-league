// src/render/events.js

// ── Monthly calendar strip ────────────────────────────────────────────────────
// Shared by Events and Tournaments public views.
// Usage: renderMonthStrip(containerId, items, selectedMonth, onSelectFn)
// items: [{date:'2026-07-11', ...}] — any array with a date field

function getMonthsInRange(items){
  // Build list of months from earliest to latest item date,
  // padded to cover the full season window
  const now   = new Date();
  const dates = items.map(i=>i.date).filter(Boolean).sort();
  const first = dates.length ? new Date(dates[0]+'T00:00:00')  : now;
  const last  = dates.length ? new Date(dates[dates.length-1]+'T00:00:00') : now;

  // Always show at least the current month and 3 months ahead
  const rangeEnd = new Date(Math.max(last, new Date(now.getFullYear(), now.getMonth()+3, 1)));

  const months = [];
  let d = new Date(first.getFullYear(), first.getMonth(), 1);
  while(d <= rangeEnd){
    months.push({
      key:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: d.toLocaleDateString('en-HK',{month:'short'}),
      year:  d.getFullYear(),
      month: d.getMonth()
    });
    d.setMonth(d.getMonth()+1);
  }
  return months;
}

function renderMonthStrip(items, selectedKey, onSelect){
  const months = getMonthsInRange(items);
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  return `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:16px;
    scrollbar-width:none;-webkit-overflow-scrolling:touch;" id="month-strip">
    ${months.map(m=>{
      const hasItems = items.some(i=>(i.date||'').startsWith(m.key));
      const isSelected = m.key === selectedKey;
      const isCurrent  = m.key === currentKey;
      return `<button onclick="${onSelect}('${m.key}')"
        style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:1px solid
          ${isSelected?'var(--brand)':isCurrent?'var(--muted)':'var(--border)'};
        background:${isSelected?'var(--brand)':'transparent'};
        color:${isSelected?'#fff':hasItems?'var(--text)':'var(--muted)'};
        font-size:12px;font-weight:${isSelected||hasItems?'600':'400'};
        cursor:${hasItems?'pointer':'default'};
        opacity:${hasItems?1:0.4};
        transition:all 0.15s;white-space:nowrap;">
        ${m.label}${isCurrent&&!isSelected?'<span style="display:block;width:4px;height:4px;border-radius:50%;background:var(--accent);margin:1px auto 0;"></span>':''}
      </button>`;
    }).join('')}
  </div>`;
}

function selectedMonthKey(items){
  // Default to the month of the first active/upcoming item, or current month
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const upcoming = items
    .filter(i=>i.date && i.date >= now.toISOString().split('T')[0])
    .sort((a,b)=>a.date.localeCompare(b.date));
  if(upcoming.length){
    const d = upcoming[0].date;
    return d.slice(0,7);
  }
  return currentKey;
}
// Events page — Mexicano, Americano, King of the Court

let S_eventDetail = null; // currently viewed event
let S_eventRounds = [];   // loaded rounds for current event

function renderEventsPage(){
  const container = document.getElementById('events-content');
  if(!container) return;

  if(S_eventDetail){
    renderEventDetail(container);
  } else {
    renderEventsPublicView(container);
  }
}

function renderEventsPublicView(container){
  const all = Object.values(S.events||{})
    .sort((a,b)=>(a.date||'').localeCompare(b.date||''));

  if(!all.length){
    container.innerHTML=`<div style="text-align:center;padding:40px 0;">
      <div style="font-size:32px;margin-bottom:12px;">🎾</div>
      <div style="font-weight:600;font-size:14px;margin-bottom:6px;">No events yet</div>
      <div style="color:var(--muted);font-size:13px;">Events will appear here when scheduled.</div>
    </div>`;
    return;
  }

  // Use selected month or default to first active/upcoming
  if(!S._evSelectedMonth) S._evSelectedMonth = selectedMonthKey(all);
  const selMonth = S._evSelectedMonth;

  // Filter events for selected month
  const monthEvents = all.filter(e=>(e.date||'').startsWith(selMonth));

  // Find active event for featured sub-tabs (may not be in selected month)
  const active   = all.filter(e=>e.status==='active'||e.status==='open');
  const featured = monthEvents.find(e=>e.status==='active'||e.status==='open')
    || monthEvents[0]
    || active[0];

  const formatIcon  = {mexicano:'🔄',americano:'🤝',king:'👑'};
  const formatLabel = {mexicano:'Mexicano',americano:'Americano',king:'King of the Court'};
  const statusColor = {open:'var(--accent)',active:'var(--gold)',complete:'var(--muted)'};

  const activeSubTab = S._eventSubTab||'standings';

  container.innerHTML=`
    <!-- Month strip -->
    ${renderMonthStrip(all, selMonth, 'selectEventMonth')}

    <!-- Events this month -->
    ${monthEvents.length===0
      ?`<div style="color:var(--muted);font-size:13px;font-style:italic;
          padding:12px 0;margin-bottom:16px;">No events in this month.</div>`
      :monthEvents.length===1
        ?'' // single event — goes straight to featured below
        :`<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
            ${monthEvents.map(e=>{
              const isSelected = featured&&e.id===featured.id;
              return `<div onclick="selectEventInMonth('${e.id}')"
                style="display:flex;align-items:center;gap:12px;padding:10px 14px;
                border-radius:8px;cursor:pointer;transition:all 0.15s;
                border:1px solid ${isSelected?'var(--brand)':'var(--border)'};
                background:${isSelected?'rgba(99,102,241,0.08)':'var(--surface-1)'};">
                <div style="font-size:18px;">${formatIcon[e.type]||'🎾'}</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:600;">${e.name}</div>
                  <div style="font-size:11px;color:var(--muted);">
                    ${formatLabel[e.type]||e.type} · ${e.date||'TBC'}
                    · ${(e.players||[]).length} players
                  </div>
                </div>
                <span style="font-size:10px;padding:2px 8px;border-radius:10px;
                  background:${statusColor[e.status]||'var(--border)'}22;
                  color:${statusColor[e.status]||'var(--muted)'};">
                  ${e.status==='complete'?'Done':e.status}
                </span>
              </div>`;
            }).join('')}
          </div>`
    }

    <!-- Featured event header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;
      flex-wrap:wrap;gap:10px;margin-bottom:16px;">
      <div>
        <div style="font-size:20px;font-weight:700;">${featured.name}</div>
        <div style="font-size:12px;color:var(--muted);">
          ${formatIcon[featured.type]||'🎾'} ${formatLabel[featured.type]||featured.type}
          · ${featured.date||'TBC'}
          · ${(featured.players||[]).length} players
          · Round ${featured.currentRound||0}${featured.totalRounds?'/'+featured.totalRounds:''}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${featured.status==='active'?`<button class="btn btn-ghost btn-sm"
          onclick="openLeaderboard('${featured.id}')">📺 Full-screen</button>`:''}
        <button class="btn btn-ghost btn-sm" onclick="openEventDetail('${featured.id}')">
          ${isAdminUser()?'Manage →':'Details →'}</button>
      </div>
    </div>

    <!-- Sub-tabs -->
    <div class="group-tabs" style="margin-bottom:16px;" id="event-public-tabs">
      ${subTabs.map(t=>`<button class="group-tab ${activeSubTab===t.id?'active':''}"
        onclick="setEventPublicTab('${featured.id}','${t.id}',this)">${t.label}</button>`).join('')}
    </div>

    <!-- Tab content -->
    <div id="event-public-content"></div>

    <!-- Past events -->
    ${all.filter(e=>e.status==='complete'&&e.id!==featured?.id).length>0?`
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border);">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;
        letter-spacing:1px;margin-bottom:10px;">Past Events</div>
      ${all.filter(e=>e.status==='complete'&&e.id!==featured?.id).map(e=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;
          border-bottom:1px solid var(--border);cursor:pointer;"
          onclick="openEventDetail('${e.id}')">
          <div style="font-size:16px;">${formatIcon[e.type]||'🎾'}</div>
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:600;">${e.name}</div>
            <div style="font-size:10px;color:var(--muted);">${e.date||'—'} · ${formatLabel[e.type]||e.type}</div>
          </div>
          <span style="font-size:10px;color:var(--muted);">View →</span>
        </div>`).join('')}
    </div>`:''}`;

  // Render the active sub-tab
  renderEventPublicTab(featured, activeSubTab);
}

function setEventPublicTab(eventId, tab, el){
  S._eventSubTab = tab;
  document.querySelectorAll('#event-public-tabs .group-tab').forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');
  const e = S.events[eventId];
  if(e) renderEventPublicTab(e, tab);
}

async function renderEventPublicTab(e, tab){
  const container = document.getElementById('event-public-content');
  if(!container) return;

  if(tab==='standings'){
    const standings = e.standings
      ? Object.values(e.standings).filter(s=>!s.withdrawn)
          .sort((a,b)=>b.points-a.points||b.gamesWon-a.gamesWon)
      : [];
    const medals = ['🥇','🥈','🥉'];
    container.innerHTML = !standings.length
      ? '<div style="color:var(--muted);font-size:12px;font-style:italic;">No results yet — event in progress.</div>'
      : `<div class="card" style="padding:0;overflow:hidden;">
          <table style="width:100%;">
            <thead><tr style="font-size:10px;color:var(--muted);">
              <th style="padding:8px 12px;text-align:left;">#</th>
              <th style="padding:8px 12px;text-align:left;">Player</th>
              <th style="padding:8px 12px;text-align:center;">Pts</th>
              <th style="padding:8px 12px;text-align:center;">GW</th>
              <th style="padding:8px 12px;text-align:center;">GL</th>
            </tr></thead>
            <tbody>
              ${standings.map((s,i)=>`
                <tr style="border-top:1px solid var(--border);${i<3?'background:rgba(74,222,128,0.03)':''}">
                  <td style="padding:8px 12px;font-family:'Space Mono',monospace;font-weight:700;
                    color:${i===0?'var(--gold)':i===1?'#C0C0C0':i===2?'#CD7F32':'var(--muted)'};">
                    ${medals[i]||i+1}</td>
                  <td style="padding:8px 12px;font-weight:600;">${s.name}</td>
                  <td style="padding:8px 12px;text-align:center;font-family:'Space Mono',monospace;
                    font-weight:700;color:var(--brand);">${s.points}</td>
                  <td style="padding:8px 12px;text-align:center;color:var(--accent);">${s.gamesWon}</td>
                  <td style="padding:8px 12px;text-align:center;color:var(--red);">${s.gamesLost}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;

  } else if(tab==='courts'){
    // Load rounds if needed
    if(!S_eventRounds.length && e.type!=='king'){
      S_eventRounds = await EventsDB.getRounds(e.id);
    }
    const isKing = e.type==='king';
    if(isKing){
      const courts = (e.courts||[]).sort((a,b)=>a.level-b.level);
      container.innerHTML = courts.map(c=>`
        <div class="card" style="border-left:3px solid ${c.courtType==='king'?'var(--gold)':'var(--brand)'};">
          <div style="font-size:10px;font-weight:700;color:${c.courtType==='king'?'var(--gold)':'var(--brand)'};margin-bottom:8px;">
            ${c.courtType==='king'?'👑 KING COURT':`⚔ CHALLENGER ${c.level}`}
            <span style="color:${c.status==='playing'?'var(--accent)':'var(--muted)'};">
              · ${c.status==='playing'?'LIVE':'WAITING'}
            </span>
          </div>
          ${c.status==='playing'
            ?`<div style="font-weight:600;">${c.currentPairA?.name||'—'}</div>
              <div style="font-size:11px;color:var(--muted);margin:3px 0;">vs</div>
              <div style="font-weight:600;">${c.currentPairB?.name||'—'}</div>`
            :c.pendingChallenger
              ?`<div style="color:var(--gold);font-size:13px;">⏳ ${c.pendingChallenger.name} — challenger ready</div>`
              :'<div style="color:var(--muted);font-size:12px;font-style:italic;">Waiting for next pair...</div>'}
        </div>`).join('');
    } else {
      const currentRound = S_eventRounds.find(r=>r.roundNumber===e.currentRound);
      if(!currentRound){container.innerHTML='<div style="color:var(--muted);font-size:12px;">No active round.</div>';return;}
      const active = (currentRound.matches||[]).filter(m=>!m.isBye);
      const bye    = (currentRound.matches||[]).filter(m=>m.isBye);
      container.innerHTML=`<div style="font-size:11px;color:var(--muted);margin-bottom:12px;">Round ${e.currentRound}</div>`
        + active.map(m=>`
          <div class="card" style="margin-bottom:10px;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:6px;">Court ${m.court||'?'}</div>
            <div style="font-weight:600;">${m.teamANames}</div>
            <div style="font-size:11px;color:var(--muted);margin:3px 0;">vs</div>
            <div style="font-weight:600;">${m.teamBNames}</div>
            ${m.status==='confirmed'?`<div style="font-family:'Space Mono',monospace;font-weight:700;color:var(--accent);margin-top:6px;">${m.scoreA}–${m.scoreB}</div>`:''}
          </div>`).join('')
        + bye.map(m=>`<div style="padding:8px;border:1px dashed var(--border);border-radius:6px;margin-bottom:8px;">
            <span style="color:var(--muted);font-size:12px;">⏸ ${m.byeNames||''} — sitting out</span>
          </div>`).join('');
    }

  } else if(tab==='results'){
    if(!S_eventRounds.length && e.type!=='king') S_eventRounds = await EventsDB.getRounds(e.id);
    const isKing = e.type==='king';
    if(isKing){
      const games=[...(e.games||[])].reverse();
      container.innerHTML=!games.length?'<div style="color:var(--muted);font-size:12px;">No games yet.</div>'
        :games.map(g=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:12px;">${g.courtType==='king'?'👑':'⚔'}</span>
          <span style="flex:1;font-size:12px;color:${g.winner==='A'?'var(--text-primary)':'var(--muted)'};">${g.teamA}</span>
          <span style="font-family:'Space Mono',monospace;font-weight:700;color:var(--gold);">${g.scoreA}–${g.scoreB}</span>
          <span style="flex:1;text-align:right;font-size:12px;color:${g.winner==='B'?'var(--text-primary)':'var(--muted)'};">${g.teamB}</span>
        </div>`).join('');
    } else {
      const rounds=(S_eventRounds||[]).filter(r=>(r.matches||[]).some(m=>!m.isBye&&m.status==='confirmed'))
        .sort((a,b)=>a.roundNumber-b.roundNumber);
      container.innerHTML=!rounds.length?'<div style="color:var(--muted);font-size:12px;">No completed matches yet.</div>'
        :rounds.map(r=>{
          const matches=(r.matches||[]).filter(m=>!m.isBye&&m.status==='confirmed');
          return `<div style="margin-bottom:16px;">
            <div style="font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;
              margin-bottom:8px;">Round ${r.roundNumber}</div>
            ${matches.map(m=>{const aWon=m.scoreA>m.scoreB;
              return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
                <span style="flex:1;font-size:12px;color:${aWon?'var(--text-primary)':'var(--muted)'};">${m.teamANames}</span>
                <span style="font-family:'Space Mono',monospace;font-weight:700;color:var(--gold);">${m.scoreA}–${m.scoreB}</span>
                <span style="flex:1;text-align:right;font-size:12px;color:${!aWon?'var(--text-primary)':'var(--muted)'};">${m.teamBNames}</span>
              </div>`;}).join('')}
          </div>`;}).join('');
    }
  }
}

// ── Events list ───────────────────────────────────────────────────────────────

// Safe scoreFormat reader — handles both flat {type,target} and nested {scoreFormat:{...},hardCap} structures
function sfTarget(e){ return e.scoreFormat?.target || e.scoreFormat?.scoreFormat?.target || 16; }
function sfType(e){ return e.scoreFormat?.type || e.scoreFormat?.scoreFormat?.type || 'games'; }
function sfHardCap(e){ return e.scoreFormat?.hardCap || 20; }
function sfLabel(e){
  const t = sfType(e); const v = sfTarget(e);
  return t==='games'?`First to ${v}`:`${v} min`;
}

function renderEventsList(container){
  const events = Object.values(S.events||{})
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const createBtn = ''; // Create moved to Admin → Event Management

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

  const formatIcon  = {mexicano:'🔄',americano:'🤝',king:'👑'};
  const formatLabel = {mexicano:'Mexicano',americano:'Americano',king:'King of the Court'};
  const statusColor = {open:'var(--accent)',active:'var(--gold)',complete:'var(--muted)'};

  const active    = events.filter(e=>e.status!=='complete');
  const completed = events.filter(e=>e.status==='complete');

  const renderCard = (e) => {
    const isComplete = e.status==='complete';
    const top3 = (e.standings&&Object.keys(e.standings).length)
      ? Object.values(e.standings).filter(s=>!s.withdrawn)
          .sort((a,b)=>b.points-a.points||b.gamesWon-a.gamesWon).slice(0,3)
      : [];
    const gameCount = e.type==='king' ? (e.games||[]).length : null;
    return `<div class="card" style="cursor:pointer;border-left:3px solid ${statusColor[e.status]||'var(--border)'};
      ${isComplete?'opacity:0.85':''}" onclick="openEventDetail('${e.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div style="font-size:20px;">${formatIcon[e.type]||'🎾'}</div>
        <span style="font-size:10px;background:${statusColor[e.status]}22;color:${statusColor[e.status]};
          padding:2px 8px;border-radius:10px;font-weight:600;">
          ${e.status==='complete'?'✓ DONE':e.status.toUpperCase()}
        </span>
      </div>
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${e.name}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">${formatLabel[e.type]||e.type}</div>
      <div style="font-size:11px;color:var(--muted);">
        📅 ${e.date||'TBC'} · 👥 ${(e.players||[]).length} players · 🎾 ${e.courts||1} court${e.courts!==1?'s':''}
      </div>
      ${gameCount!==null?`<div style="font-size:11px;color:var(--muted);margin-top:2px;">${gameCount} games played</div>`
        :`<div style="font-size:11px;color:var(--brand);margin-top:4px;">
          Round ${e.currentRound||0}${e.totalRounds?` / ${e.totalRounds}`:''}
        </div>`}
      ${top3.length?`<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
        ${top3.map((s,i)=>`<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;">
          <span>${['🥇','🥈','🥉'][i]} ${s.name}</span>
          <span style="font-family:'Space Mono',monospace;color:${isComplete?'var(--muted)':'var(--brand)'};font-weight:700;">${s.points}pts</span>
        </div>`).join('')}
      </div>`:''}
    </div>`;
  };

  container.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:13px;color:var(--muted);">${active.length} active · ${completed.length} completed</div>
      ${createBtn}
    </div>
    ${active.length?`<div class="grid-2">${active.map(renderCard).join('')}</div>`:''}
    ${completed.length?`
      <div style="margin-top:${active.length?'24px':'0'};">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;
          letter-spacing:1px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--border);">
          ✓ Completed Events
        </div>
        <div class="grid-2">${completed.map(renderCard).join('')}</div>
      </div>`:''}`;
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
            ?`<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <div style="font-family:'Space Mono',monospace;font-size:14px;font-weight:700;color:var(--accent);">${m.scoreA} – ${m.scoreB}</div>
                ${isAdminUser()?`<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 8px;"
                  onclick="openEventScoreEdit('${e.id}',${activeRound.roundNumber},'${m.matchId}',${m.scoreA},${m.scoreB},${e.scoreFormat?.target||0})">✎ Edit</button>`:''}
              </div>`
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

    <!-- King of the Court live view -->
    ${e.type==='king'&&e.status==='active'?renderKingCourtUI(e):''}

    <!-- Past rounds (admin) — collapsed, with edit buttons -->
    ${isAdminUser()&&S_eventRounds.length>1?`
    <div style="margin-top:16px;">
      <details>
        <summary style="cursor:pointer;font-weight:700;font-size:13px;margin-bottom:8px;
          list-style:none;display:flex;align-items:center;gap:8px;">
          <span style="color:var(--brand);">▸</span>
          Past Rounds (admin edit)
          <span style="font-size:10px;color:var(--muted);font-weight:400;">— tap to expand</span>
        </summary>
        ${S_eventRounds
          .filter(r=>r.roundNumber<e.currentRound)
          .sort((a,b)=>b.roundNumber-a.roundNumber)
          .map(r=>`
          <div style="margin-bottom:16px;">
            <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;
              letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border);">
              Round ${r.roundNumber}
            </div>
            ${(r.matches||[]).filter(m=>!m.isBye).map(m=>`
              <div class="card" style="margin-bottom:8px;border-left:3px solid ${m.status==='confirmed'?'var(--accent)':'var(--muted)'};">
                <div style="font-size:10px;color:var(--muted);margin-bottom:6px;">Court ${m.court||'?'}</div>
                <div style="font-weight:600;font-size:13px;">${m.teamANames}</div>
                <div style="font-size:11px;color:var(--muted);margin:2px 0;">vs</div>
                <div style="font-weight:600;font-size:13px;margin-bottom:8px;">${m.teamBNames}</div>
                ${m.status==='confirmed'
                  ?`<div style="display:flex;align-items:center;gap:10px;">
                      <span style="font-family:'Space Mono',monospace;font-size:14px;font-weight:700;
                        color:var(--accent);">${m.scoreA} – ${m.scoreB}</span>
                      <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 8px;"
                        onclick="openEventScoreEdit('${e.id}',${r.roundNumber},'${m.matchId}',${m.scoreA},${m.scoreB},${e.scoreFormat?.target||0})">
                        ✎ Edit
                      </button>
                    </div>`
                  :`<span style="font-size:11px;color:var(--muted);">Not yet scored</span>`
                }
              </div>`).join('')}
            ${(r.matches||[]).filter(m=>m.isBye).map(m=>`
              <div style="font-size:11px;color:var(--muted);padding:4px 0;">
                ⏸ ${m.byeNames||''} sat out
              </div>`).join('')}
          </div>`).join('')}
      </details>
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

// ── King of the Court UI ─────────────────────────────────────────────────────

function renderKingCourtUI(e){
  const courts   = (e.courts||[]).sort((a,b)=>a.level-b.level);
  const queue    = e.queue||[];
  const games    = e.games||[];
  const target   = e.scoreFormat?.target||16;
  const hardCap  = e.scoreFormat?.hardCap||20;

  const courtCards = courts.map(court => {
    const isKing = court.courtType==='king';
    const color  = isKing ? 'var(--gold)' : 'var(--brand)';
    const label  = isKing ? '👑 KING COURT' : `⚔ CHALLENGER ${court.level}`;
    const liveTag = court.status==='playing'
      ? `<span style="font-size:10px;color:var(--accent);">● LIVE</span>`
      : court.pendingChallenger
        ? `<span style="font-size:10px;color:var(--gold);">⏳ CHALLENGER READY</span>`
        : `<span style="font-size:10px;color:var(--muted);">○ WAITING</span>`;

    let body = '';
    if(court.status==='playing'){
      body = `<div style="font-weight:600;font-size:13px;">${court.currentPairA?.name||'—'}</div>
        <div style="font-size:11px;color:var(--muted);margin:4px 0;">vs</div>
        <div style="font-weight:600;font-size:13px;margin-bottom:10px;">${court.currentPairB?.name||'—'}</div>`;
      if(isAdminUser()){
        body += `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <input type="number" min="0" max="${hardCap}" id="ksA_${court.courtId}" placeholder="0"
            style="width:52px;padding:6px;border-radius:4px;border:1px solid var(--border);
            background:var(--surface-1);color:var(--text-primary);text-align:center;font-size:16px;font-weight:700;">
          <span style="color:var(--muted);font-weight:700;">–</span>
          <input type="number" min="0" max="${hardCap}" id="ksB_${court.courtId}" placeholder="0"
            style="width:52px;padding:6px;border-radius:4px;border:1px solid var(--border);
            background:var(--surface-1);color:var(--text-primary);text-align:center;font-size:16px;font-weight:700;">
          <button class="btn btn-primary btn-sm"
            onclick="submitKingScore('${e.id}','${court.courtId}')">✓</button>
          <span style="font-size:9px;color:var(--muted);">to ${target}, cap ${hardCap}</span>
        </div>`;
      }
    } else if(court.pendingChallenger){
      body = `<div style="font-size:12px;color:var(--gold);font-weight:600;margin-bottom:4px;">
        ⏳ ${court.pendingChallenger.name}
      </div>
      <div style="font-size:11px;color:var(--muted);">Challenger ready — waiting for King Court to finish</div>`;
    } else {
      body = `<div style="font-size:12px;color:var(--muted);font-style:italic;">Waiting for next pair...</div>`;
    }

    return `<div class="card" style="border-left:3px solid ${color};">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-size:11px;font-weight:700;color:${color};">${label}</div>
        ${liveTag}
      </div>
      ${body}
    </div>`;
  }).join('');

  const queueHTML = !queue.length
    ? '<div style="color:var(--muted);font-size:12px;font-style:italic;">Queue is empty</div>'
    : queue.map((pair,i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:11px;color:var(--muted);width:20px;text-align:center;">${i+1}</div>
        <div style="flex:1;font-size:12px;font-weight:600;">${pair.name}</div>
        ${i===0 ? '<span style="font-size:10px;color:var(--accent);">Next up</span>' : ''}
        ${isAdminUser() ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;"
          onclick="kingRemoveFromQueue('${e.id}',${i})">✕</button>` : ''}
      </div>`).join('');

  const recentGames = [...games].reverse().slice(0,5).map(g => {
    const aWon = g.winner==='A';
    return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
      <div style="font-size:10px;color:${g.courtType==='king'?'var(--gold)':'var(--brand)'};width:16px;">
        ${g.courtType==='king'?'👑':'⚔'}
      </div>
      <div style="flex:1;font-size:12px;color:${aWon?'var(--text-primary)':'var(--muted)'};">${g.teamA}</div>
      <div style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:var(--gold);">
        ${g.scoreA}–${g.scoreB}
      </div>
      <div style="flex:1;text-align:right;font-size:12px;color:${!aWon?'var(--text-primary)':'var(--muted)'};">${g.teamB}</div>
    </div>`;
  }).join('');

  return `<div style="margin-bottom:16px;">
    <div style="font-weight:700;font-size:13px;margin-bottom:10px;">👑 Courts</div>
    <div class="grid-2" style="margin-bottom:16px;">${courtCards}</div>
    <div style="font-weight:700;font-size:13px;margin-bottom:8px;">
      📋 Queue (${queue.length} pairs waiting)
    </div>
    ${queueHTML}
    ${games.length ? `<div style="margin-top:16px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px;">Recent Games</div>
      ${recentGames}
    </div>` : ''}
  </div>`;
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

function openEventScoreEdit(eventId, roundNumber, matchId, currentA, currentB, target){
  // Inline edit — replace the confirmed score display with editable inputs
  // Find the match card and inject edit UI
  const btn = event?.target;
  const card = btn?.closest('.card');
  if(!card) return;

  const scoreDiv = card.querySelector('[style*="Space Mono"]')?.parentElement;
  if(!scoreDiv) return;

  const autoA = target ? `oninput="autoFillScore('edit_${matchId}',${target},this,'A')"` : '';
  const autoB = target ? `oninput="autoFillScore('edit_${matchId}',${target},this,'B')"` : '';

  scoreDiv.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${target?`<div style="font-size:9px;color:var(--muted);">of ${target}</div>`:''}
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <input type="number" min="0" max="${target||999}" id="sA_edit_${matchId}"
          value="${currentA}"
          style="width:52px;padding:6px;border-radius:4px;border:1px solid var(--brand);
          background:var(--surface-1);color:var(--text-primary);text-align:center;font-size:16px;font-weight:700;"
          ${autoA}>
        <span style="color:var(--muted);font-weight:700;">–</span>
        <input type="number" min="0" max="${target||999}" id="sB_edit_${matchId}"
          value="${currentB}"
          style="width:52px;padding:6px;border-radius:4px;border:1px solid var(--brand);
          background:var(--surface-1);color:var(--text-primary);text-align:center;font-size:16px;font-weight:700;"
          ${autoB}>
        <button class="btn btn-primary btn-sm"
          onclick="saveEventScoreEdit('${eventId}',${roundNumber},'${matchId}')">Save</button>
        <button class="btn btn-ghost btn-sm"
          onclick="renderEventsPage()">Cancel</button>
      </div>
    </div>`;

  // Focus first input
  document.getElementById(`sA_edit_${matchId}`)?.focus();
}

async function saveEventScoreEdit(eventId, roundNumber, matchId){
  const scoreA = parseInt(document.getElementById(`sA_edit_${matchId}`)?.value);
  const scoreB = parseInt(document.getElementById(`sB_edit_${matchId}`)?.value);
  if(isNaN(scoreA)||isNaN(scoreB)){ showToast('Enter both scores',true); return; }
  if(scoreA<0||scoreB<0){ showToast('Scores cannot be negative',true); return; }

  try {
    await mexicanoEnterScore(eventId, roundNumber, matchId, scoreA, scoreB);
    addLog(`Event score corrected by admin: match ${matchId} → ${scoreA}–${scoreB}`,'var(--gold)');
    S_eventRounds = await EventsDB.getRounds(eventId);
    S_eventDetail = S.events[eventId];
    showToast('Score updated');
    renderEventsPage();
  } catch(err){ showToast('Failed: '+err.message, true); }
}

async function submitKingScore(eventId, courtId){
  const scoreA = parseInt(document.getElementById('ksA_'+courtId)?.value);
  const scoreB = parseInt(document.getElementById('ksB_'+courtId)?.value);
  if(isNaN(scoreA)||isNaN(scoreB)){ showToast('Enter both scores',true); return; }
  await kingEnterScore(eventId, courtId, scoreA, scoreB);
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
  if(e.type === 'king')      return kingStartEvent(eventId);
  return mexicanoStartEvent(eventId);
}

async function advanceRound(eventId){
  const e = S.events[eventId];
  if(!e) return;
  if(e.type === 'americano') return americanoNextRound(eventId);
  if(e.type === 'king')      return;
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

// ── Event player picker — delegates to shared player-picker.js ───────────────

let _evSelectedPlayers = []; // kept for backward compatibility with createPadelEvent/saveEditEvent
let _evPicker = null;        // shared picker instance

function initEventPlayerPicker(){
  _evPicker = createPlayerPicker({
    searchId:    'ev-player-search',
    listId:      'ev-player-picker',
    selectedId:  'ev-selected-players',
    countId:     'ev-selected-count',
    minPlayers:  4,
    requireEven: true,
    onSelect: (players) => { _evSelectedPlayers = players; }
  });
  return _evPicker.init();
}

function filterEventPlayerPicker(){
  _pickerFilter('ev-player-search');
}

function removeEventPlayer(uid){
  _evPicker?.remove(uid);
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
  const kingWrap = document.getElementById('ev-king-wrap');
  if(kingWrap) kingWrap.style.display = type==='king' ? '' : 'none';
  // Show pairing section for King
  updateKingPairingVisibility();
}

function updateKingPairingVisibility(){
  const type = document.getElementById('ev-type')?.value;
  const pairMode = document.getElementById('ev-pair-mode')?.value;
  const pairingWrap = document.getElementById('ev-king-pairing-wrap');
  if(pairingWrap){
    pairingWrap.style.display = (type==='king' && pairMode==='fixed') ? '' : 'none';
  }
}

// ── King of the Court pair definition ────────────────────────────────────────
// Tap-to-pair UI: tap player on left to select, tap another to form pair.
// Works reliably on mobile — no drag needed.

let _kingPairs = [];      // [{uid1,name1,uid2,name2,pairName}]
let _kingSelected = null; // uid of first selected player

function openKingPairingUI(){
  // Show pairing UI after player selection
  const modal = document.getElementById('createEventModal');
  const pairingDiv = document.getElementById('ev-king-pairing-wrap');
  if(!pairingDiv) return;

  const players = _evSelectedPlayers;
  if(!players.length){ showToast('Select players first',true); return; }

  _kingPairs = [];
  _kingSelected = null;
  renderKingPairingUI();
  pairingDiv.style.display = '';
}

function renderKingPairingUI(){
  const container = document.getElementById('ev-king-pairing-players');
  if(!container) return;

  const paired = new Set(_kingPairs.flatMap(p=>[p.uid1,p.uid2]));
  const unpaired = _evSelectedPlayers.filter(p=>!paired.has(p.uid));

  container.innerHTML = `
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">
      Tap two players to pair them. ${_kingSelected?'<strong style="color:var(--accent);">Now tap a second player to complete the pair.</strong>':'Tap first player to start.'}
    </div>
    <!-- Unpaired players -->
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
      ${unpaired.map(p=>`
        <div onclick="kingSelectPlayer('${p.uid}')"
          style="padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;
          border:2px solid ${_kingSelected===p.uid?'var(--accent)':'var(--border)'};
          background:${_kingSelected===p.uid?'rgba(74,222,128,0.1)':'var(--surface-1)'};
          color:${_kingSelected===p.uid?'var(--accent)':'var(--text-primary)'};">
          ${p.name} <span style="font-size:10px;color:var(--muted);">NPRP ${p.nprp}</span>
        </div>`).join('')}
    </div>
    <!-- Formed pairs -->
    ${_kingPairs.length?`
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Pairs</div>
      ${_kingPairs.map((pair,i)=>`
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">
          <div style="flex:1;font-size:12px;font-weight:600;">
            ${pair.name1} & ${pair.name2}
          </div>
          <button onclick="kingRemovePair(${i})" style="background:none;border:none;
            color:var(--muted);cursor:pointer;font-size:12px;">✕</button>
        </div>`).join('')}
    `:''}
    ${unpaired.length===0&&_kingPairs.length>0?
      '<div style="font-size:11px;color:var(--accent);margin-top:8px;">✓ All players paired</div>':''}`;
}

function kingSelectPlayer(uid){
  if(!_kingSelected){
    _kingSelected = uid;
  } else if(_kingSelected === uid){
    _kingSelected = null; // deselect
  } else {
    // Form the pair
    const p1 = _evSelectedPlayers.find(p=>p.uid===_kingSelected);
    const p2 = _evSelectedPlayers.find(p=>p.uid===uid);
    if(p1&&p2){
      _kingPairs.push({
        uid1:p1.uid, name1:p1.name, nprp1:p1.nprp,
        uid2:p2.uid, name2:p2.name, nprp2:p2.nprp,
        pairName:`${p1.name} & ${p2.name}`
      });
    }
    _kingSelected = null;
  }
  renderKingPairingUI();
}

function kingRemovePair(idx){
  _kingPairs.splice(idx,1);
  _kingSelected = null;
  renderKingPairingUI();
}

function openCreateEventModal(){
  _evSelectedPlayers = [];
  openModal('createEventModal');
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

  // Declare King-specific vars early to avoid temporal dead zone
  const queueVariant = document.getElementById('ev-queue-variant')?.value||'winners-stay';
  const pairMode     = document.getElementById('ev-pair-mode')?.value||'fixed';
  const winCap       = parseInt(document.getElementById('ev-win-cap')?.value||'3');
  const hardCap      = parseInt(document.getElementById('ev-hard-cap')?.value||'20');

  // For King fixed pairs — validate all players are paired
  const isKingFixed = type==='king' && pairMode==='fixed';
  if(isKingFixed){
    const pairedCount = _kingPairs.length * 2;
    if(pairedCount < players.length){
      showToast(`Pair all players first — ${players.length-pairedCount} unpaired`,true); return;
    }
  }
  // Build pairs array for King
  const pairs = isKingFixed ? _kingPairs.map((p,i)=>({
    pairId:`pair_${i}`,
    uid1:p.uid1, uid2:p.uid2,
    name:`${p.name1} & ${p.name2}`,
    nprp1:p.nprp1, nprp2:p.nprp2
  })) : [];

  const scoreFormat = sfType==='games'
    ? {type:'games',target:sfVal}
    : sfType==='timed'
      ? {type:'timed',minutes:sfVal}
      : {type:'sets',sets:2};
  const variant = document.getElementById('ev-variant')?.value||'roundrobin';

  const eventId = await EventsDB.create({
    name, type, date, courts, totalRounds:rounds,
    players, scoreFormat: Object.assign({}, scoreFormat, {hardCap}), variant, season: ACTIVE_SEASON,
    queueVariant, pairMode, winCap, pairs
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

  // Declare King-specific vars early to avoid temporal dead zone
  const queueVariant = document.getElementById('ev-queue-variant')?.value||'winners-stay';
  const pairMode     = document.getElementById('ev-pair-mode')?.value||'fixed';
  const winCap       = parseInt(document.getElementById('ev-win-cap')?.value||'3');
  const hardCap      = parseInt(document.getElementById('ev-hard-cap')?.value||'20');

  // For King fixed pairs — validate all players are paired
  const isKingFixed = type==='king' && pairMode==='fixed';
  if(isKingFixed){
    const pairedCount = _kingPairs.length * 2;
    if(pairedCount < players.length){
      showToast(`Pair all players first — ${players.length-pairedCount} unpaired`,true); return;
    }
  }
  // Build pairs array for King
  const pairs = isKingFixed ? _kingPairs.map((p,i)=>({
    pairId:`pair_${i}`,
    uid1:p.uid1, uid2:p.uid2,
    name:`${p.name1} & ${p.name2}`,
    nprp1:p.nprp1, nprp2:p.nprp2
  })) : [];

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
          ${formatLabel[e.type]||'EVENT'} · ${e.type==='king'
            ? `${(e.games||[]).length} GAMES PLAYED`
            : `ROUND ${e.currentRound||0}${e.totalRounds?' OF '+e.totalRounds:''}`}
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

  // King of the Court uses pair standings; others use individual standings
  const isKing = e.type === 'king';
  const standingsData = e.standings ? Object.values(e.standings) : [];
  const standings = standingsData
    .filter(s=>!s.withdrawn)
    .sort((a,b)=>b.points-a.points||b.gamesWon-a.gamesWon);

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
    // King of the Court: read from e.courts directly (no rounds)
    if(isKing){
      const kingCourts = (e.courts||[]).sort((a,b)=>a.level-b.level);
      const queue = e.queue||[];
      cEl.innerHTML = kingCourts.map(court=>{
        const isKingCourt = court.courtType==='king';
        const color = isKingCourt?'#F5C842':'#6366f1';
        const label = isKingCourt?'👑 KING COURT':`⚔ CHALLENGER ${court.level}`;
        const statusLabel = court.status==='playing'
          ? '<span style="color:#4ade80;font-size:10px;">● LIVE</span>'
          : court.pendingChallenger
            ? '<span style="color:#F5C842;font-size:10px;">⏳ CHALLENGER READY</span>'
            : '<span style="color:rgba(255,255,255,0.3);font-size:10px;">○ WAITING</span>';

        let body = '';
        if(court.status==='playing'){
          const pA = court.currentPairA?.name||'—';
          const pB = court.currentPairB?.name||'—';
          body = `<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;margin-top:12px;">
            <div>${pA.split(' & ').map(n=>`<div style="font-size:18px;font-weight:700;color:#fff;">${n}</div>`).join('')}</div>
            <div style="font-size:18px;font-weight:700;color:rgba(255,255,255,0.2);text-align:center;">VS</div>
            <div style="text-align:right;">${pB.split(' & ').map(n=>`<div style="font-size:18px;font-weight:700;color:#fff;">${n}</div>`).join('')}</div>
          </div>`;
        } else if(court.pendingChallenger){
          body = `<div style="margin-top:10px;">
            <div style="font-size:14px;color:#F5C842;font-weight:700;">${court.pendingChallenger.name}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.4);">Waiting to challenge King Court</div>
          </div>`;
        } else {
          body = `<div style="font-size:13px;color:rgba(255,255,255,0.3);margin-top:10px;font-style:italic;">Waiting for next pair...</div>`;
        }

        return `<div style="background:rgba(255,255,255,0.04);border:1px solid ${color}44;border-radius:12px;
          padding:20px 24px;margin-bottom:12px;max-width:600px;margin-left:auto;margin-right:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:10px;font-weight:700;color:${color};letter-spacing:2px;">${label}</div>
            ${statusLabel}
          </div>
          ${body}
        </div>`;
      }).join('')
      + (queue.length ? `<div style="max-width:600px;margin:16px auto 0;">
        <div style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:2px;margin-bottom:8px;">QUEUE</div>
        ${queue.map((p,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;
          border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:11px;color:rgba(255,255,255,0.3);width:20px;">${i+1}</div>
          <div style="font-size:13px;color:${i===0?'#4ade80':'rgba(255,255,255,0.6)'};">${p.name}</div>
          ${i===0?'<span style="font-size:10px;color:#4ade80;">Next up</span>':''}
        </div>`).join('')}
      </div>` : '');
      // Skip round-based rendering
      return;
    }

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
    // King of the Court: read from e.games[] directly
    if(isKing){
      const games = [...(e.games||[])].reverse();
      hEl.innerHTML = !games.length
        ? `<div style="color:rgba(255,255,255,0.3);font-size:13px;margin-top:20px;">No completed games yet</div>`
        : `<div style="max-width:640px;margin:0 auto;">
            ${games.map((g,i)=>{
              const aWon = g.winner==='A';
              const icon = g.courtType==='king'?'👑':'⚔';
              return `<div style="display:grid;grid-template-columns:28px 1fr auto 1fr;gap:10px;
                align-items:center;padding:10px 4px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="font-size:12px;">${icon}</div>
                <div style="font-size:12px;color:${aWon?'#fff':'rgba(255,255,255,0.35)'};">${g.teamA}</div>
                <div style="font-family:'Space Mono',monospace;font-size:14px;font-weight:700;
                  color:#F5C842;text-align:center;white-space:nowrap;">${g.scoreA}–${g.scoreB}</div>
                <div style="font-size:12px;text-align:right;color:${!aWon?'#fff':'rgba(255,255,255,0.35)'};">${g.teamB}</div>
              </div>`;
            }).join('')}
          </div>`;
      return;
    }

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

// ── Event month navigation ────────────────────────────────────────────────────

function selectEventMonth(monthKey){
  S._evSelectedMonth = monthKey;
  S._eventSubTab = 'standings'; // reset sub-tab on month change
  const container = document.getElementById('events-content');
  if(container) renderEventsPublicView(container);
}

function selectEventInMonth(eventId){
  // Switch featured event within the month
  const e = S.events[eventId];
  if(!e) return;
  S._evSelectedMonth = (e.date||'').slice(0,7)||S._evSelectedMonth;
  S._eventSubTab = 'standings';
  // Re-render with this event as featured
  const container = document.getElementById('events-content');
  if(!container) return;
  const all = Object.values(S.events||{}).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const monthEvents = all.filter(ev=>(ev.date||'').startsWith(S._evSelectedMonth));
  const featured = e;
  renderEventsPublicView(container);
}
