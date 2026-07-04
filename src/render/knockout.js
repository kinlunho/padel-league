// src/render/knockout.js — per-division Champions KO + Phoenix Cup
// No cross-division play. No time slots — just court + match order.

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Generate KO fixtures for one pool ─────────────────────────────────────────
// Pure round-robin, deterministic IDs so re-running is safe overwrite.
function generateKOPoolFixtures(teamIds, pKey, season){
  const fixtures=[];
  for(let i=0;i<teamIds.length;i++){
    for(let j=i+1;j<teamIds.length;j++){
      const [a,b]=[teamIds[i],teamIds[j]].sort();
      fixtures.push({
        id:`ko_${pKey}_${a}_vs_${b}`,
        t1:a, t2:b,
        group: pKey,   // group field reused for display grouping
        koPhase: pKey,
        season,
        status:'unclaimed',
        scoreData:null, submittedBy:null,
        date:null, time:null, court:null,
        round:1, isKO:true
      });
    }
  }
  return fixtures;
}

// ── KO day court assignment ───────────────────────────────────────────────────
// Distributes all pool matches across N courts, round by round.
// Constraint: no team plays twice in the same round.
// Returns matches with court assigned and matchOrder (sequential per court).
function assignKOCourts(allFixtures, courtCount){
  const matches=[...allFixtures];
  const rounds=[];
  const remaining=[...matches];

  while(remaining.length){
    const round=[];
    const usedTeams=new Set();
    const stillRemaining=[];
    for(const m of remaining){
      if(!usedTeams.has(m.t1)&&!usedTeams.has(m.t2)){
        round.push(m);
        usedTeams.add(m.t1);
        usedTeams.add(m.t2);
      } else {
        stillRemaining.push(m);
      }
    }
    rounds.push(round);
    remaining.splice(0,remaining.length,...stillRemaining);
  }

  // Assign courts and order: distribute rounds across courts sequentially
  const courtQueues={};
  for(let c=1;c<=courtCount;c++) courtQueues[c]=0;

  const assigned=[];
  rounds.forEach((round,ri)=>{
    round.forEach((m,mi)=>{
      const court=(mi%courtCount)+1;
      courtQueues[court]++;
      assigned.push({...m, court, koRound:ri+1, courtOrder:courtQueues[court]});
    });
  });
  return assigned;
}

// ── Admin: generate all KO fixtures button handler ────────────────────────────
async function generateKnockoutFixtures(){
  if(!isAdminUser()){showToast('Admin only',true);return;}
  const divs=groups().filter(g=>g!=='Unassigned');
  if(!divs.length){showToast('No divisions found',true);return;}

  // Check for unplayed group stage matches and warn
  const unplayed=Object.values(S.matches).filter(m=>
    !m.isKO&&m.season===ACTIVE_SEASON&&m.status!=='confirmed'
  );
  const warnMsg=unplayed.length
    ?`⚠ ${unplayed.length} group stage match${unplayed.length!==1?'es':''} have not been played.\n\nKnockout seeding will be based on current (incomplete) standings.\n\nThis is final — teams will be locked into their brackets.\n\nProceed anyway?`
    :'Generate knockout fixtures for all divisions?\n\nTeams will be seeded from final group stage standings.';
  if(!confirm(warnMsg)) return;

  const courtCount=parseInt(prompt('How many courts are available on Knockout Day?','4')||'4');
  if(isNaN(courtCount)||courtCount<1){showToast('Invalid court count',true);return;}

  let totalGenerated=0;
  const allKOFixtures=[];

  for(const div of divs){
    const st=getStandings(div);
    const champIds=st.slice(0,4).map(t=>t.id);
    const phoenixIds=st.slice(4).map(t=>t.id);

    if(champIds.length>=2){
      const pKey=koKey(div,'champ');
      // Skip if already generated
      const existing=Object.values(S.matches).filter(m=>m.koPhase===pKey&&m.isKO);
      if(!existing.length){
        allKOFixtures.push(...generateKOPoolFixtures(champIds,pKey,ACTIVE_SEASON));
        totalGenerated++;
      }
    }
    if(phoenixIds.length>=2){
      const pKey=koKey(div,'phoenix');
      const existing=Object.values(S.matches).filter(m=>m.koPhase===pKey&&m.isKO);
      if(!existing.length){
        allKOFixtures.push(...generateKOPoolFixtures(phoenixIds,pKey,ACTIVE_SEASON));
        totalGenerated++;
      }
    }
  }

  if(!allKOFixtures.length){showToast('All knockout fixtures already generated');return;}

  // Assign courts across all fixtures globally (mixed divisions, mixed phases)
  const assigned=assignKOCourts(allKOFixtures,courtCount);

  // Write to Firestore in batches
  const BATCH_SIZE=400;
  for(let i=0;i<assigned.length;i+=BATCH_SIZE){
    const batch=db.batch();
    assigned.slice(i,i+BATCH_SIZE).forEach(m=>{
      batch.set(db.collection('matches').doc(m.id),m);
    });
    await batch.commit();
  }

  addLog(`⚡ Knockout fixtures generated: ${assigned.length} matches across ${courtCount} courts`,'var(--gold)');
  showToast(`Generated ${assigned.length} knockout matches across ${courtCount} courts`);
  renderKnockoutPage();
}

// ── KO court schedule view ────────────────────────────────────────────────────
function renderKOSchedule(){
  const koMatches=Object.values(S.matches).filter(m=>m.isKO&&m.season===ACTIVE_SEASON);
  if(!koMatches.length){
    return `<div style="color:var(--muted);font-size:13px;font-style:italic;">
      No knockout fixtures generated yet.
      ${isAdminUser()?'Use the "Generate Knockout Fixtures" button above.':'The admin will generate knockout fixtures closer to Knockout Day.'}
    </div>`;
  }

  // Group by court
  const courts={};
  koMatches.forEach(m=>{
    const c=m.court||'?';
    if(!courts[c]) courts[c]=[];
    courts[c].push(m);
  });

  return Object.keys(courts).sort((a,b)=>parseInt(a)-parseInt(b)).map(court=>{
    const ms=courts[court].sort((a,b)=>(a.courtOrder||0)-(b.courtOrder||0));
    return `<div class="court-card" style="margin-bottom:16px;">
      <div class="court-hdr">Court ${court}</div>
      ${ms.map((m,i)=>{
        const chipCls=m.status==='confirmed'?'chip-done':m.status==='pending-confirm'?'chip-confirm':m.status==='disputed'?'chip-dispute':'chip-pending';
        const chipTxt=m.status==='confirmed'?'DONE':m.status==='pending-confirm'?'CONFIRM':m.status==='disputed'?'DISPUTED':'UPCOMING';
        const phase=m.koPhase||'';
        const phaseLabel=phase.includes('_champ')?'🏆 CK':'🦅 PC';
        const divLabel=Object.keys(S.teams).length?
          (S.teams[m.t1]?.group||'').replace(' Division',''):phase.split('_')[0];
        return `<div class="slot booked" style="cursor:${canActOnMatch(m)?'pointer':'default'};"
            ${canActOnMatch(m)?`onclick="openReschedule('${m.id}')" title="Click to reschedule"`:''}> 
          <div>
            <div style="font-weight:600;font-size:11px;margin-bottom:2px;">
              Match ${i+1} &nbsp;<span style="font-size:9px;color:var(--muted);">Round ${m.koRound||'?'}</span>
            </div>
            <div style="font-size:12px;">${tn(m.t1)} <span style="color:var(--muted)">vs</span> ${tn(m.t2)}</div>
            <div style="display:flex;gap:6px;align-items:center;margin-top:3px;">
              <span class="chip ${chipCls}" style="font-size:9px;padding:1px 6px;">${chipTxt}</span>
              <span style="font-size:9px;color:var(--muted);">${phaseLabel}</span>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

// ── Bracket renderer ──────────────────────────────────────────────────────────
function renderKOBracket(div,phase,teamIds,title,color){
  const pKey=koKey(div,phase);
  const ko=ensureKO(div,phase);
  const fin=ko.final;

  if(!teamIds.length){
    return `<div style="color:var(--muted);font-size:12px;padding:4px 0 12px;font-style:italic;">
      ${title} — no teams (fewer than 5 in division, all qualify for Champions Knockout)
    </div>`;
  }

  const st=koStandings(teamIds,pKey);
  const top2=st.slice(0,2);
  if(top2.length===2&&top2[0].p>0&&!fin.t1){
    fin.t1=top2[0].id; fin.t2=top2[1].id;
  }

  const hasFixtures=Object.values(S.matches).some(m=>m.koPhase===pKey&&m.isKO);

  const tableRows=st.map((r,i)=>`
    <tr ${i<2?`style="background:rgba(74,222,128,0.03)"`:''}> 
      <td><span style="font-family:'Space Mono',monospace;font-weight:700;${i<2?'color:var(--accent)':'color:var(--muted)'}">${i+1}</span></td>
      <td><strong>${r.name}</strong>${i<2?` <span style="font-size:9px;color:var(--accent);">→ Final</span>`:''}</td>
      <td>${r.p}</td><td style="color:var(--accent)">${r.w}</td>
      <td style="color:var(--blue)">${r.d}</td><td style="color:var(--red)">${r.l}</td>
      <td style="color:${(r.gw-r.gl)>=0?'var(--accent)':'var(--red)'};">${r.gw-r.gl>=0?'+':''}${r.gw-r.gl}</td>
      <td style="font-family:'Space Mono',monospace;font-weight:700;color:${color}">${r.pts}</td>
    </tr>`).join('');

  const canSubmitFinal=isAdminUser()||(isCaptainUser()&&fin.t1&&fin.t2&&(fin.t1===S.myTeamId||fin.t2===S.myTeamId));

  return `<div style="margin-bottom:24px;">
    <div style="font-size:13px;font-weight:700;color:${color};margin-bottom:10px;display:flex;align-items:center;gap:8px;">
      ${title}
      <span style="font-size:10px;color:var(--muted);font-weight:400;">${teamIds.length} team${teamIds.length!==1?'s':''}</span>
      ${!hasFixtures?`<span style="font-size:10px;color:var(--warn);font-weight:400;">· fixtures not yet generated</span>`:''}
    </div>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:8px;">
      <table>
        <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 8px;">🏁 Final</div>
    <div class="bm ${fin.winner?'done':''}">
      <div class="bm-label">${title.replace(/[🏆🦅]/g,'').trim()} Final</div>
      <div class="bm-team ${fin.winner===fin.t1?'winner':fin.winner&&fin.winner!==fin.t1?'loser':''} ${!fin.t1?'tbd':''}">
        ${fin.t1?tn(fin.t1):'Awaiting round-robin'}
        ${fin.winner===fin.t1?'<span class="bm-score">🏆</span>':''}
      </div>
      <div class="bm-team ${fin.winner===fin.t2?'winner':fin.winner&&fin.winner!==fin.t2?'loser':''} ${!fin.t2?'tbd':''}">
        ${fin.t2?tn(fin.t2):'Awaiting round-robin'}
        ${fin.winner===fin.t2?'<span class="bm-score">🏆</span>':''}
      </div>
      ${fin.scoreData?`<div style="font-size:11px;color:var(--muted);margin-top:6px;font-family:'Space Mono',monospace;">${scoreDisplay({scoreData:fin.scoreData})}</div>`:''}
      ${fin.t1&&fin.t2&&!fin.winner
        ?canSubmitFinal
          ?`<div class="bm-actions"><button class="btn btn-primary btn-sm" onclick="openKOFinalScore('${pKey}')">Submit Final Result</button></div>`
          :`<div class="bm-actions" style="font-size:11px;color:var(--muted);text-align:center;">👁 View only</div>`
        :''}
    </div>
  </div>`;
}

// ── Main page render ──────────────────────────────────────────────────────────
function renderKnockoutPage(){
  const container=document.getElementById('knockout-container');
  const statusEl=document.getElementById('knockout-status');
  const divs=groups().filter(g=>g!=='Unassigned');

  // Show generate button for admin always when on this page
  const adminBar=document.getElementById('ko-admin-bar');
  if(adminBar) adminBar.style.display=isAdminUser()?'':'none';

  const anyKOMatches=Object.values(S.matches).some(m=>m.isKO&&m.season===ACTIVE_SEASON);
  const anyGroupConfirmed=Object.values(S.matches).some(m=>!m.isKO&&m.status==='confirmed');

  // Active sub-tab
  const activeTab=S.koTab||'standings';

  if(activeTab==='schedule'){
    statusEl.style.display='none';
    container.innerHTML=renderKOSchedule();
    return;
  }

  // Standings / brackets tab
  if(!anyGroupConfirmed&&divs.length){
    statusEl.style.display='block';
    statusEl.textContent='Group stage in progress — knockout brackets will appear once matches are confirmed.';
    container.innerHTML='';
    return;
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
        ? renderKOBracket(div,'phoenix',phoenixIds,'🦅 Phoenix Cup','var(--warn)')
        : `<div style="color:var(--muted);font-size:12px;padding:4px 0;font-style:italic;">
             🦅 Phoenix Cup — no teams (all qualify for Champions Knockout)
           </div>`}
    </div>`;
  }).join('');
}

// ── Sub-tab switcher ──────────────────────────────────────────────────────────
function setKOTab(tab,el){
  S.koTab=tab;
  document.querySelectorAll('.ko-tab').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderKnockoutPage();
}

// ── Final score modal ─────────────────────────────────────────────────────────
let editingKO=null;
function openKOFinalScore(pKey){
  editingKO=pKey;
  const ko=S.knockout[pKey];
  if(!ko){showToast('Bracket not found',true);return;}
  const fin=ko.final;
  const label=pKey.includes('_champ')?'Champions Final':'Phoenix Cup Final';
  document.getElementById('score-modal-title').textContent=label;
  document.getElementById('score-match-info').innerHTML=
    `<strong>${tn(fin.t1)}</strong> vs <strong>${tn(fin.t2)}</strong>`;
  ['a','b','c','g'].forEach(s=>{
    const e1=document.getElementById('sc-lbl-t1'+s);
    const e2=document.getElementById('sc-lbl-t2'+s);
    if(e1) e1.textContent=tn(fin.t1);
    if(e2) e2.textContent=tn(fin.t2);
  });
  S.editMatchId=null;
  document.getElementById('sc-games-only').checked=false;
  toggleGamesMode(); updateScorePreview(); openModal('scoreModal');
}
