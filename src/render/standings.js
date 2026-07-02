// src/render/standings.js
// Standings table rendering.

// ════════ STANDINGS PAGE ════════
function renderStandingsPage(){
  buildGroupTabs('standings-group-tabs','curStandingsGroup','setStandingsGroup');
  if(S.curStandingsGroup) renderStandingsTable(S.curStandingsGroup);
}
function setStandingsGroup(g,el){setGroup('curStandingsGroup',g,el,renderStandingsTable);}
function renderStandingsTable(group){
  const rows=getStandings(group);
  const body=document.getElementById('standings-body');
  if(!rows.length){body.innerHTML='<tr><td colspan="10" style="color:var(--muted);text-align:center;padding:20px;">No teams in this group yet.</td></tr>';return;}
  const champCutoff=4; // top 4 qualify
  body.innerHTML=rows.map((r,i)=>{
    const rankCls=i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':i===3?'rank-4':'';
    const rowCls=i<champCutoff?'qual-row':'phoenix-row';
    const badge=i<champCutoff?`<span class="chip-champ" style="font-size:9px;padding:1px 7px;border-radius:10px;background:rgba(245,200,66,0.1);color:var(--gold);font-weight:700;margin-left:6px;">CK</span>`
      :`<span style="font-size:9px;padding:1px 7px;border-radius:10px;background:rgba(251,146,60,0.1);color:var(--warn);font-weight:700;margin-left:6px;">PC</span>`;
    return `<tr class="${rowCls}">
      <td><span class="${rankCls}" style="font-family:'Space Mono',monospace;">${i+1}</span></td>
      <td><strong>${r.name}</strong>${badge}</td>
      <td>${r.p}</td><td style="color:var(--accent)">${r.w}</td><td style="color:var(--blue)">${r.d}</td><td style="color:var(--red)">${r.l}</td>
      <td>${r.gw}</td><td>${r.gl}</td>
      <td style="color:${(r.gw-r.gl)>=0?'var(--accent)':'var(--red)'}">${r.gw-r.gl>=0?'+':''}${r.gw-r.gl}</td>
      <td style="font-family:'Space Mono',monospace;font-weight:700;color:var(--accent)">${r.pts}</td>
    </tr>`;
  }).join('');
}

