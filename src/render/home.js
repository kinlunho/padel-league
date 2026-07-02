// src/render/home.js
// Home page: stats, My Team card, group leaders, activity feed.

// ════════ HOME ════════
function renderHome(){
  const teams=Object.values(S.teams);
  const matches=Object.values(S.matches);
  document.getElementById('stat-teams').textContent=teams.length;
  document.getElementById('stat-played').textContent=matches.filter(m=>m.status==='confirmed').length;
  document.getElementById('stat-pending').textContent=matches.filter(m=>m.status==='pending'||m.status==='pending-confirm').length;
  document.getElementById('stat-groups').textContent=groups().length;

  // "My Team" personalization — shown for a captain (myTeamId) or a claimed player
  // (myPlayerTeamId). This is the whole point of the claim mechanism: a linked player sees
  // their team's standing and next match without having to ask their captain for updates.
  const myTeamSection=document.getElementById('my-team-section');
  const relevantTeamId=S.myTeamId||S.myPlayerTeamId;
  if(relevantTeamId&&S.teams[relevantTeamId]){
    const t=S.teams[relevantTeamId];
    const st=getStandings(t.group);
    const myRank=st.findIndex(r=>r.id===t.id);
    const myStats=myRank>=0?st[myRank]:null;
    const nextMatch=Object.values(S.matches).find(m=>(m.t1===t.id||m.t2===t.id)&&(m.status==='scheduled'||m.status==='pending-confirm'));
    const viewerRole=S.myTeamId?'Captain':'Linked Player';
    myTeamSection.style.display='block';
    myTeamSection.innerHTML=`<div class="card" style="border:1px solid var(--brand);background:rgba(67,131,250,0.05);margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
        <div style="font-size:11px;color:var(--brand);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">⭐ My Team &nbsp;·&nbsp; ${viewerRole}</div>
        <div style="font-size:11px;color:var(--muted);">${t.group}</div>
      </div>
      <div style="font-weight:700;font-size:18px;margin-bottom:8px;">${t.name}</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;">
        ${myStats?`<div><div style="font-family:'Space Mono',monospace;font-size:20px;font-weight:700;color:var(--brand);">#${myRank+1}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Standing</div></div>
        <div><div style="font-family:'Space Mono',monospace;font-size:20px;font-weight:700;color:var(--accent);">${myStats.pts}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Points</div></div>
        <div><div style="font-family:'Space Mono',monospace;font-size:20px;font-weight:700;">${myStats.w}-${myStats.d}-${myStats.l}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">W-D-L</div></div>`:`<div style="font-size:12px;color:var(--muted);">No matches played yet this season.</div>`}
      </div>
      ${nextMatch?`<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:12px;">Next: <strong>${tn(nextMatch.t1)}</strong> vs <strong>${tn(nextMatch.t2)}</strong>${nextMatch.date?` · 📅 ${nextMatch.date} · ${nextMatch.time}`:' · not yet scheduled'}</div>`:''}
    </div>`;
  } else {
    myTeamSection.style.display='none';
  }

  const gl=document.getElementById('home-group-leaders');
  const gs=groups();
  gl.innerHTML=gs.slice(0,6).map(g=>{
    const st=getStandings(g);
    const leader=st.length&&st[0].p>0?st[0].name:(teamsByGroup(g).length?teamsByGroup(g)[0].name:'—');
    return `<div class="card" style="border-top:2px solid var(--brand)">
      <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${g}</div>
      <div style="font-weight:700;font-size:15px;margin-bottom:2px;">${leader}</div>
      <div style="font-size:11px;color:var(--muted);">Group Leader</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;">${teamsByGroup(g).length} teams</div>
    </div>`;
  }).join('');

  const feed=document.getElementById('activity-feed');
  const recent=[...S.activity].reverse().slice(0,8);
  feed.innerHTML=recent.length?recent.map(a=>`<div class="activity-item"><div class="activity-dot" style="background:${a.color}"></div><div>${a.msg} <span style="color:var(--muted);font-size:10px;">${a.time}</span></div></div>`).join(''):'<div style="color:var(--muted);font-size:12px;">No activity yet.</div>';
}

