// src/render/knockout.js
// Knockout Stage — admin score entry only, read-only for everyone else.
// Format: best of 2 sets + super tiebreak. No draws possible in KO.

function divSlug(g){ return g.replace(/[^a-zA-Z0-9]/g,'').toLowerCase(); }
function koKey(div,phase){ return `${divSlug(div)}_${phase}`; }

function ensureKO(div,phase){
  const k=koKey(div,phase);
  if(!S.knockout[k]) S.knockout[k]={final:{t1:null,t2:null,scoreData:null,winner:null,loser:null}};
  return S.knockout[k];
}

function koStandings(teamIds,pKey){
  const st={};
  teamIds.forEach(id=>{st[id]={id,name:tn(id),p:0,w:0,d:0,l:0,gw:0,gl:0,pts:0};});
  Object.values(S.matches)
    .filter(m=>m.koPhase===pKey&&m.status==='confirmed'&&m.scoreData)
    .forEach(m=>{
      if(!st[m.t1]||!st[m.t2]) return;
      const r=calcResult(m.scoreData); if(!r) return;
      st[m.t1].p++;st[m.t2].p++;
      st[m.t1].gw+=r.gw1;st[m.t1].gl+=r.gw2;
      st[m.t2].gw+=r.gw2;st[m.t2].gl+=r.gw1;
      if(r.result==='win1'){st[m.t1].w++;st[m.t1].pts+=3;st[m.t2].l++;}
      else if(r.result==='win2'){st[m.t2].w++;st[m.t2].pts+=3;st[m.t1].l++;}
      else{st[m.t1].d++;st[m.t1].pts++;st[m.t2].d++;st[m.t2].pts++;}
    });
  return Object.values(st).sort((a,b)=>b.pts-a.pts||(b.gw-b.gl)-(a.gw-a.gl)||b.gw-a.gw);
}

// ── Fixture generation ────────────────────────────────────────────────────────

function generateKOPoolFixtures(teamIds,pKey,season){
  const fixtures=[];
  for(let i=0;i<teamIds.length;i++){
    for(let j=i+1;j<teamIds.length;j++){
      const [a,b]=[teamIds[i],teamIds[j]].sort();
      fixtures.push({
        id:`ko_${pKey}_${a}_vs_${b}`,
        t1:a,t2:b,group:pKey,koPhase:pKey,season,
        status:'upcoming',scoreData:null,submittedBy:null,
        court:null,koRound:null,courtOrder:null,isKO:true,players:[]
      });
    }
  }
  return fixtures;
}

function assignKOCourts(allFixtures,courtCount){
  const remaining=[...allFixtures];const rounds=[];
  while(remaining.length){
    const round=[];const used=new Set();const still=[];
    for(const m of remaining){
      if(!used.has(m.t1)&&!used.has(m.t2)){round.push(m);used.add(m.t1);used.add(m.t2);}
      else still.push(m);
    }
    rounds.push(round);remaining.splice(0,remaining.length,...still);
  }
  const queueLen={};for(let c=1;c<=courtCount;c++) queueLen[c]=0;
  const assigned=[];
  rounds.forEach((round,ri)=>{
    round.forEach((m,mi)=>{
      const court=(mi%courtCount)+1;
      queueLen[court]++;
      assigned.push({...m,court,koRound:ri+1,courtOrder:queueLen[court]});
    });
  });
  return assigned;
}

async function generateKnockoutFixtures(){
  if(!isAdminUser()){showToast('Admin only',true);return;}
  const divs=groups().filter(g=>g!=='Unassigned');
  if(!divs.length){showToast('No divisions found',true);return;}
  const unplayed=Object.values(S.matches).filter(m=>!m.isKO&&m.season===ACTIVE_SEASON&&m.status!=='confirmed');
  const warn=unplayed.length
    ?`⚠ ${unplayed.length} group stage match${unplayed.length!==1?'es':''} not yet played.\n\nSeeding based on current (incomplete) standings — this is final.\n\nProceed?`
    :'Generate knockout fixtures for all divisions?\nTeams seeded from final group stage standings.';
  if(!confirm(warn)) return;
  const courtCount=parseInt(prompt('Courts available on Knockout Day?','4')||'4');
  if(isNaN(courtCount)||courtCount<1){showToast('Invalid court count',true);return;}
  const allKOFixtures=[];
  for(const div of divs){
    const st=getStandings(div);
    const champIds=st.slice(0,4).map(t=>t.id);
    const phoenixIds=st.slice(4).map(t=>t.id);
    if(champIds.length>=2){
      const pKey=koKey(div,'champ');
      if(!Object.values(S.matches).some(m=>m.koPhase===pKey&&m.isKO))
        allKOFixtures.push(...generateKOPoolFixtures(champIds,pKey,ACTIVE_SEASON));
    }
    if(phoenixIds.length>=2){
      const pKey=koKey(div,'phoenix');
      if(!Object.values(S.matches).some(m=>m.koPhase===pKey&&m.isKO))
        allKOFixtures.push(...generateKOPoolFixtures(phoenixIds,pKey,ACTIVE_SEASON));
    }
  }
  if(!allKOFixtures.length){showToast('All knockout fixtures already generated');return;}
  const assigned=assignKOCourts(allKOFixtures,courtCount);
  for(let i=0;i<assigned.length;i+=400){
    const batch=db.batch();
    assigned.slice(i,i+400).forEach(m=>batch.set(db.collection('matches').doc(m.id),m));
    await batch.commit();
  }
  addLog(`⚡ KO fixtures: ${assigned.length} matches across ${courtCount} courts`,'var(--gold)');
  showToast(`${assigned.length} KO matches generated across ${courtCount} courts`);
  renderKnockoutPage();
}

// ── Admin KO score entry ──────────────────────────────────────────────────────
// KO format: best of 2 sets + STB. No draws. Games-only mode disabled.

function openKOMatchScore(matchId){
  if(!isAdminUser()){showToast('Admin only',true);return;}
  const m=S.matches[matchId];
  if(!m){showToast('Match not found',true);return;}
  S.editMatchId=matchId;
  editingKO=null;
  S.resolvingDispute=true; // authoritative — writes confirmed immediately, no handshake
  S.isKOEntry=true;        // validated in validateScore — blocks draws, no games-only

  document.getElementById('score-modal-title').textContent='Enter KO Score';
  document.getElementById('score-match-info').innerHTML=
    `<strong>${tn(m.t1)}</strong> vs <strong>${tn(m.t2)}</strong>
     <div style="font-size:11px;color:var(--muted);margin-top:4px;">Court ${m.court||'?'} · Round ${m.koRound||'?'}</div>
     <div style="font-size:11px;color:var(--gold);margin-top:3px;font-weight:600;">⚡ KO — best of 2 sets + super tiebreak. No draws.</div>`;

  // Hide games-only row — KO must always produce a winner
  const goBox=document.getElementById('sc-games-only');
  if(goBox){
    goBox.checked=false;
    const goRow=goBox.closest('div');
    if(goRow) goRow.style.display='none';
  }
  // Hide time-expired note
  document.querySelectorAll('#scoreModal .alert-warn,#scoreModal [class*="alert"]').forEach(el=>{
    if(el.textContent.includes('expired')) el.style.display='none';
  });

  ['a','b','c','g'].forEach(s=>{
    const e1=document.getElementById('sc-lbl-t1'+s);
    const e2=document.getElementById('sc-lbl-t2'+s);
    if(e1) e1.textContent=tn(m.t1); if(e2) e2.textContent=tn(m.t2);
  });

  // Pre-fill if editing
  const sd=m.scoreData;
  if(sd&&!sd.gamesOnly){
    document.getElementById('sc-s1-t1').value=sd.s1t1||0;
    document.getElementById('sc-s1-t2').value=sd.s1t2||0;
    document.getElementById('sc-s2-t1').value=sd.s2t1||0;
    document.getElementById('sc-s2-t2').value=sd.s2t2||0;
    if(sd.stb&&sd.stb1!=null){
      document.getElementById('sc-stb-t1').value=sd.stb1;
      document.getElementById('sc-stb-t2').value=sd.stb2;
    }
  } else {
    // Reset to clean state
    ['sc-s1-t1','sc-s1-t2','sc-s2-t1','sc-s2-t2','sc-stb-t1','sc-stb-t2'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value=0;
    });
  }
  toggleGamesMode(); updateScorePreview(); openModal('scoreModal');
}

// Called when score modal closes — restore hidden elements for group stage use
function onKOScoreModalClose(){
  S.isKOEntry=false;
  const goBox=document.getElementById('sc-games-only');
  if(goBox){
    const goRow=goBox.closest('div');
    if(goRow) goRow.style.display='';
  }
  document.querySelectorAll('#scoreModal .alert-warn,#scoreModal [class*="alert"]').forEach(el=>{
    el.style.display='';
  });
}

// ── Court schedule ────────────────────────────────────────────────────────────

function renderKOSchedule(){
  const koMatches=Object.values(S.matches).filter(m=>m.isKO&&m.season===ACTIVE_SEASON);
  if(!koMatches.length){
    return `<div style="color:var(--muted);font-size:13px;font-style:italic;padding:20px 0;">
      ${isAdminUser()
        ?'No knockout fixtures generated yet. Use "Generate KO Fixtures" above.'
        :'Knockout fixtures will be published here before Knockout Day.'}
    </div>`;
  }
  const courts={};
  koMatches.forEach(m=>{const c=m.court||'?';if(!courts[c])courts[c]=[];courts[c].push(m);});
  return Object.keys(courts).sort((a,b)=>parseInt(a)-parseInt(b)).map(court=>{
    const ms=courts[court].sort((a,b)=>(a.courtOrder||0)-(b.courtOrder||0));
    return `<div class="court-card" style="margin-bottom:16px;">
      <div class="court-hdr">Court ${court}</div>
      ${ms.map((m,i)=>{
        const done=m.status==='confirmed';
        const phaseLabel=m.koPhase&&m.koPhase.includes('_champ')?'🏆':'🦅';
        const r=done&&m.scoreData?calcResult(m.scoreData):null;
        const winnerName=r&&r.result!=='draw'?tn(r.result==='win1'?m.t1:m.t2):null;
        return `<div class="slot ${done?'booked':'empty'}" style="padding:12px 14px;cursor:default;">
          <div style="width:100%;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <div>
                <div style="font-size:10px;color:var(--muted);margin-bottom:3px;">
                  Match ${i+1} ${phaseLabel} · Round ${m.koRound||'?'}
                </div>
                <div style="font-weight:600;font-size:13px;">
                  ${tn(m.t1)} <span style="color:var(--muted);font-weight:400;">vs</span> ${tn(m.t2)}
                </div>
                ${done&&m.scoreData
                  ?`<div style="margin-top:5px;">
                      <span style="font-size:12px;font-family:'Space Mono',monospace;color:var(--accent);">${scoreDisplay(m)}</span>
                      ${winnerName?`<span style="font-size:11px;color:var(--accent);margin-left:8px;font-weight:700;">→ ${winnerName} wins</span>`:''}
                    </div>`
                  :`<div style="font-size:11px;color:var(--muted);margin-top:4px;">Upcoming</div>`
                }
              </div>
              ${isAdminUser()
                ?`<button class="btn btn-${done?'ghost':'primary'} btn-sm" style="flex-shrink:0;"
                     onclick="openKOMatchScore('${m.id}')">
                     ${done?'✎ Edit':'Enter Score'}
                   </button>`
                :''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

// ── Bracket view ──────────────────────────────────────────────────────────────

function renderKOBracket(div,phase,teamIds,title,color){
  const pKey=koKey(div,phase);
  const ko=ensureKO(div,phase);
  const fin=ko.final;
  if(!teamIds.length){
    return `<div style="color:var(--muted);font-size:12px;padding:4px 0 12px;font-style:italic;">
      ${title} — no teams (all qualify for Champions Knockout)
    </div>`;
  }
  const st=koStandings(teamIds,pKey);
  const top2=st.slice(0,2);
  if(top2.length===2&&top2[0].p>0&&!fin.t1){fin.t1=top2[0].id;fin.t2=top2[1].id;}
  const hasFixtures=Object.values(S.matches).some(m=>m.koPhase===pKey&&m.isKO);
  const rows=st.map((r,i)=>`
    <tr ${i<2?`style="background:rgba(74,222,128,0.03)"`:''}> 
      <td><span style="font-family:'Space Mono',monospace;font-weight:700;${i<2?'color:var(--accent)':'color:var(--muted)'}">${i+1}</span></td>
      <td><strong>${r.name}</strong>${i<2?` <span style="font-size:9px;color:var(--accent);">→ Final</span>`:''}</td>
      <td>${r.p}</td><td style="color:var(--accent)">${r.w}</td>
      <td style="color:var(--blue)">${r.d}</td><td style="color:var(--red)">${r.l}</td>
      <td style="color:${(r.gw-r.gl)>=0?'var(--accent)':'var(--red)'};">${r.gw-r.gl>=0?'+':''}${r.gw-r.gl}</td>
      <td style="font-family:'Space Mono',monospace;font-weight:700;color:${color}">${r.pts}</td>
    </tr>`).join('');
  return `<div style="margin-bottom:24px;">
    <div style="font-size:13px;font-weight:700;color:${color};margin-bottom:10px;display:flex;align-items:center;gap:8px;">
      ${title} <span style="font-size:10px;color:var(--muted);font-weight:400;">${teamIds.length} team${teamIds.length!==1?'s':''}</span>
      ${!hasFixtures?`<span style="font-size:10px;color:var(--warn);font-weight:400;">· fixtures pending</span>`:''}
    </div>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:8px;">
      <table>
        <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 8px;">🏁 Final</div>
    <div class="bm ${fin.winner?'done':''}">
      <div class="bm-label">${title.replace(/[🏆🦅]/g,'').trim()} Final</div>
      <div class="bm-team ${fin.winner===fin.t1?'winner':fin.winner&&fin.winner!==fin.t1?'loser':''} ${!fin.t1?'tbd':''}">
        ${fin.t1?tn(fin.t1):'Awaiting round-robin'}${fin.winner===fin.t1?' <span class="bm-score">🏆</span>':''}
      </div>
      <div class="bm-team ${fin.winner===fin.t2?'winner':fin.winner&&fin.winner!==fin.t2?'loser':''} ${!fin.t2?'tbd':''}">
        ${fin.t2?tn(fin.t2):'Awaiting round-robin'}${fin.winner===fin.t2?' <span class="bm-score">🏆</span>':''}
      </div>
      ${fin.scoreData?`<div style="font-size:11px;color:var(--muted);margin-top:6px;font-family:'Space Mono',monospace;">${scoreDisplay({scoreData:fin.scoreData})}</div>`:''}
      ${fin.t1&&fin.t2&&!fin.winner
        ?isAdminUser()
          ?`<div class="bm-actions"><button class="btn btn-primary btn-sm" onclick="openKOFinalScore('${pKey}')">Enter Final Result</button></div>`
          :`<div class="bm-actions" style="font-size:11px;color:var(--muted);text-align:center;">Final result will be entered by admin</div>`
        :''}
    </div>
  </div>`;
}

// ── Main render ───────────────────────────────────────────────────────────────

function renderKnockoutPage(){
  const container=document.getElementById('knockout-container');
  const statusEl=document.getElementById('knockout-status');
  const divs=groups().filter(g=>g!=='Unassigned');
  const adminBar=document.getElementById('ko-admin-bar');
  if(adminBar) adminBar.style.display=isAdminUser()?'':'none';
  const activeTab=S.koTab||'standings';
  if(activeTab==='schedule'){
    statusEl.style.display='none';
    container.innerHTML=renderKOSchedule();
    return;
  }
  const anyGroupConfirmed=Object.values(S.matches).some(m=>!m.isKO&&m.status==='confirmed');
  if(!anyGroupConfirmed||!divs.length){
    statusEl.style.display='block';
    statusEl.textContent='Group stage in progress — knockout brackets will appear once matches are confirmed.';
    container.innerHTML=''; return;
  }
  statusEl.style.display='none';
  container.innerHTML=divs.map(div=>{
    const st=getStandings(div);
    const champIds=st.slice(0,4).map(t=>t.id);
    const phoenixIds=st.slice(4).map(t=>t.id);
    return `<div style="margin-bottom:36px;">
      <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:16px;
                  padding-bottom:8px;border-bottom:1px solid var(--border);">${div}</div>
      ${renderKOBracket(div,'champ',champIds,'🏆 Champions Knockout','var(--gold)')}
      ${phoenixIds.length
        ?renderKOBracket(div,'phoenix',phoenixIds,'🦅 Phoenix Cup','var(--warn)')
        :`<div style="color:var(--muted);font-size:12px;font-style:italic;">🦅 Phoenix Cup — no teams qualified</div>`}
    </div>`;
  }).join('');
}

function setKOTab(tab,el){
  S.koTab=tab;
  document.querySelectorAll('.ko-tab').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderKnockoutPage();
}

// ── Final score (admin only) ──────────────────────────────────────────────────

let editingKO=null;
function openKOFinalScore(pKey){
  if(!isAdminUser()){showToast('Admin only',true);return;}
  editingKO=pKey;
  S.isKOEntry=true;
  const ko=S.knockout[pKey];if(!ko){showToast('Bracket not found',true);return;}
  const fin=ko.final;
  const label=pKey.includes('_champ')?'Champions Final':'Phoenix Cup Final';
  document.getElementById('score-modal-title').textContent=label;
  document.getElementById('score-match-info').innerHTML=
    `<strong>${tn(fin.t1)}</strong> vs <strong>${tn(fin.t2)}</strong>
     <div style="font-size:11px;color:var(--gold);margin-top:4px;font-weight:600;">⚡ KO Final — best of 2 sets + super tiebreak. No draws.</div>`;
  const goBox=document.getElementById('sc-games-only');
  if(goBox){goBox.checked=false;const r=goBox.closest('div');if(r)r.style.display='none';}
  ['a','b','c','g'].forEach(s=>{
    const e1=document.getElementById('sc-lbl-t1'+s);const e2=document.getElementById('sc-lbl-t2'+s);
    if(e1)e1.textContent=tn(fin.t1);if(e2)e2.textContent=tn(fin.t2);
  });
  S.editMatchId=null;
  document.getElementById('sc-games-only').checked=false;
  toggleGamesMode();updateScorePreview();openModal('scoreModal');
}
