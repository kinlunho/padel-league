// src/render/knockout.js
// Champions Knockout / Phoenix Cup bracket rendering and final-score entry.

function renderKnockoutPage(){
  const gs=groups();
  // Build champion/phoenix pools from current standings
  let champTeams=[], phoenixTeams=[];
  gs.forEach(g=>{
    const st=getStandings(g);
    champTeams=[...champTeams,...st.slice(0,4).map(t=>t.id)];
    phoenixTeams=[...phoenixTeams,...st.slice(4).map(t=>t.id)];
  });

  const anyPlayed=Object.values(S.matches).some(m=>m.status==='confirmed');
  const container=document.getElementById('knockout-container');
  const statusEl=document.getElementById('knockout-status');

  if(!anyPlayed||champTeams.length===0){
    statusEl.style.display='block';
    statusEl.textContent='Group stage in progress — knockout brackets will populate once standings are confirmed.';
    container.innerHTML='';
    return;
  }
  statusEl.style.display='none';

  function rrStandings(teamIds, rrMatches){
    const st={};
    teamIds.forEach(id=>{st[id]={id,name:tn(id),p:0,w:0,d:0,l:0,gw:0,gl:0,pts:0};});
    rrMatches.filter(m=>m.status==='confirmed'&&m.scoreData).forEach(m=>{
      if(!st[m.t1]||!st[m.t2]) return;
      const r=calcResult(m.scoreData);
      if(!r) return;
      st[m.t1].p++;st[m.t2].p++;
      st[m.t1].gw+=r.gw1;st[m.t1].gl+=r.gw2;
      st[m.t2].gw+=r.gw2;st[m.t2].gl+=r.gw1;
      if(r.result==='win1'){st[m.t1].w++;st[m.t1].pts+=3;st[m.t2].l++;}
      else if(r.result==='win2'){st[m.t2].w++;st[m.t2].pts+=3;st[m.t1].l++;}
      else{st[m.t1].d++;st[m.t1].pts++;st[m.t2].d++;st[m.t2].pts++;}
    });
    return Object.values(st).sort((a,b)=>b.pts-a.pts||(b.gw-b.gl)-(a.gw-a.gl)||b.gw-a.gw);
  }

  function renderKOBracket(title,color,teamIds,phase,rrKey){
    if(!teamIds.length) return `<div style="color:var(--muted);font-size:13px;margin-bottom:20px;">No teams qualified yet.</div>`;
    const rrMs=Object.values(S.matches).filter(m=>m.koPhase===phase);
    const st=rrStandings(teamIds,rrMs);
    const top2=st.slice(0,2);
    const fin=S.knockout[rrKey].final;

    // Auto-set final teams from top 2 if both have played enough
    if(top2.length===2&&top2[0].p>0&&!fin.t1){
      S.knockout[rrKey].final.t1=top2[0].id;
      S.knockout[rrKey].final.t2=top2[1].id;
    }

    let html=`<div class="bracket-section">
      <div class="bracket-hdr" style="color:${color};">${title}
        <span style="font-size:10px;color:var(--muted);font-weight:400;">${teamIds.length} teams</span>
      </div>
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:14px;">
        <table><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${st.map((r,i)=>`<tr ${i<2?`style="background:rgba(74,222,128,0.03)"`:''}><td><span style="font-family:'Space Mono',monospace;font-weight:700;${i<2?'color:var(--accent)':''}">${i+1}</span></td><td><strong>${r.name}</strong>${i<2?` <span style="font-size:9px;color:var(--accent);">→ Final</span>`:''}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gw-r.gl>=0?'+':''}${r.gw-r.gl}</td><td style="font-weight:700;color:${color}">${r.pts}</td></tr>`).join('')}</tbody>
        </table>
      </div>`;

    // Final
    html+=`<div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">🏁 Final</div>
      <div class="bm ${fin.winner?'done':''}">
        <div class="bm-label">${title.replace(/[🏆🦅]/g,'').trim()} Final</div>
        <div class="bm-team ${fin.winner===fin.t1?'winner':fin.winner&&fin.winner!==fin.t1?'loser':''} ${!fin.t1?'tbd':''}">${fin.t1?tn(fin.t1):'Awaiting round-robin'}${fin.winner===fin.t1?`<span class="bm-score">🏆</span>`:''}</div>
        <div class="bm-team ${fin.winner===fin.t2?'winner':fin.winner&&fin.winner!==fin.t2?'loser':''} ${!fin.t2?'tbd':''}">${fin.t2?tn(fin.t2):'Awaiting round-robin'}${fin.winner===fin.t2?`<span class="bm-score">🏆</span>`:''}</div>
        ${fin.scoreData?`<div style="font-size:11px;color:var(--muted);margin-top:6px;font-family:'Space Mono',monospace;">${scoreDisplay({scoreData:fin.scoreData})}</div>`:''}
        ${fin.t1&&fin.t2&&!fin.winner?((isAdminUser()||(isCaptainUser()&&(fin.t1===S.myTeamId||fin.t2===S.myTeamId)))?`<div class="bm-actions"><button class="btn btn-primary btn-sm" onclick="openKOFinalScore('${rrKey}')">Submit Final Result</button></div>`:`<div class="bm-actions" style="font-size:11px;color:var(--muted);text-align:center;">👁 View only</div>`):''}
      </div>
    </div>`;
    return html;
  }

  container.innerHTML=
    renderKOBracket('🏆 Champions Knockout','var(--gold)',champTeams,'champ','champ')+
    '<div style="margin:8px 0;border-top:1px solid var(--border);"></div>'+
    renderKOBracket('🦅 Phoenix Cup','var(--warn)',phoenixTeams,'phoenix','phoenix');
}

let editingKO=null;
function openKOFinalScore(key){
  editingKO=key;
  const fin=S.knockout[key].final;
  document.getElementById('score-modal-title').textContent=`${key==='champ'?'Champions Final':'Phoenix Cup Final'}`;
  document.getElementById('score-match-info').innerHTML=`<strong>${tn(fin.t1)}</strong> vs <strong>${tn(fin.t2)}</strong>`;
  ['a','b','c','g'].forEach(s=>{
    const e1=document.getElementById('sc-lbl-t1'+s);const e2=document.getElementById('sc-lbl-t2'+s);
    if(e1)e1.textContent=tn(fin.t1);if(e2)e2.textContent=tn(fin.t2);
  });
  S.editMatchId=null;
  document.getElementById('sc-games-only').checked=false;
  toggleGamesMode();
  updateScorePreview();
  openModal('scoreModal');
}

