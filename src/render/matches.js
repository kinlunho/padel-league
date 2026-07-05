// src/render/matches.js
// Matches page: unclaimed fixture cards, claimed/played match cards.

function renderMatchesPage(){
  buildGroupTabs('matches-group-tabs','curMatchesGroup','setMatchesGroup');
  if(S.curMatchesGroup) renderMatchesList(S.curMatchesGroup);
}
function setMatchesGroup(g,el){setGroup('curMatchesGroup',g,el,renderMatchesList);}
function renderMatchesList(group){
  const container=document.getElementById('matches-container');
  const allMs=Object.values(S.matches).filter(m=>m.group===group);
  const unclaimed=allMs.filter(m=>m.status==='unclaimed').sort((a,b)=>a.round-b.round);
  const claimed=allMs.filter(m=>m.status!=='unclaimed').sort((a,b)=>(a.date||'')<(b.date||'')?-1:1);

  let html='';

  // Generator button / status banner
  if(!allMs.length){
    html+=`<div class="card" style="text-align:center;padding:30px;grid-column:1/-1;">
      <div style="font-size:13px;color:var(--muted);margin-bottom:14px;">No fixtures yet for ${group}.</div>
      ${canAdminister()?`<button class="btn btn-primary" onclick="generateFixtures('${group}')">⚡ Generate Round-Robin Fixtures</button>`:`<div style="font-size:11px;color:var(--muted);">Admin access required to generate fixtures.</div>`}
    </div>`;
    container.innerHTML=html;
    return;
  }

  // Unclaimed fixtures, grouped by Round purely for readability — every unclaimed match a
  // captain is part of is claimable immediately, regardless of round number. See the comment
  // above isTeamClearedThroughRound's old location for why sequencing isn't enforced.
  if(unclaimed.length){
    const rounds=[...new Set(unclaimed.map(m=>m.round))].sort((a,b)=>a-b);
    html+=`<div style="grid-column:1/-1;">`;
    rounds.forEach(rNum=>{
      const roundMs=unclaimed.filter(m=>m.round===rNum);
      html+=`<div style="display:flex;align-items:center;gap:10px;margin:${rNum===rounds[0]?'0':'20px'} 0 10px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--brand);">Round ${rNum}</div>
        <div style="flex:1;height:1px;background:var(--border);"></div>
        <div style="font-size:10px;color:var(--muted);">${roundMs.length} match${roundMs.length!==1?'es':''}</div>
      </div>
      <div class="match-grid" style="margin-bottom:4px;">`;
      roundMs.forEach(m=>{
        html+=`<div class="match-card pending">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="chip chip-pending">UNCLAIMED</span>
            <span style="font-size:10px;color:var(--muted);">Round ${rNum}</span>
          </div>
          <div class="match-teams"><span>${tn(m.t1)}</span><span class="match-vs">vs</span><span>${tn(m.t2)}</span></div>
          ${canActOnMatch(m)?`<button class="btn btn-primary btn-sm" style="width:100%;margin-top:8px;" onclick="openClaimSlot('${m.id}')">Claim a Slot →</button>`:`<div style="font-size:11px;color:var(--muted);text-align:center;margin-top:8px;">👁 View only</div>`}
        </div>`;
      });
      html+='</div>';
    });
    html+='</div>';
  }

  // Claimed / played matches
  if(claimed.length){
    html+=claimed.map(m=>{
      const chipCls=m.status==='confirmed'?'chip-done':m.status==='pending-confirm'?'chip-confirm':m.status==='disputed'?'chip-dispute':'chip-pending';
      const chipTxt=m.status==='confirmed'?'DONE':m.status==='pending-confirm'?'AWAITING CONFIRM':m.status==='disputed'?'DISPUTED':'SCHEDULED';
      const cardCls=m.status==='confirmed'?(m.scoreData&&calcResult(m.scoreData)?.result==='draw'?'draw':'completed'):m.status==='pending-confirm'?'pending-confirm':m.status==='disputed'?'disputed':'pending';
      const sd=m.scoreData;
      let scoreHtml='<div style="text-align:center;font-size:11px;color:var(--muted);margin-bottom:8px;">Not played yet</div>';
      if(sd){
        const r=calcResult(sd);
        const resultTxt=r?r.result==='draw'?`<span style="color:var(--blue)">Draw</span>`:`<span style="color:var(--accent)">${r.result==='win1'?tn(m.t1):tn(m.t2)} wins</span>`:'';
        scoreHtml=`<div class="match-score">${sd.gamesOnly?`${sd.g1}–${sd.g2}`:''}</div>
        <div class="match-score-sub">${sd.gamesOnly?'<span style="color:var(--warn)">games (time)</span>':scoreDisplay(m)}<br>${m.status==='disputed'?'<span style="color:var(--red);">disputed submission — under review</span>':resultTxt}</div>`;
      }
      let actions='';
      if(m.status==='disputed'){
        actions=isAdminUser()
          ?`<button class="btn btn-danger btn-sm" style="width:100%;" onclick="openDisputeResolve('${m.id}')">⚖ Resolve Dispute</button>`
          :`<div style="font-size:11px;color:var(--muted);text-align:center;">Under review by admin</div>`;
      } else if(m.status==='confirmed' && isAdminUser()){
        actions=`<button class="btn btn-ghost btn-sm" style="font-size:10px;opacity:0.7;" onclick="adminEditConfirmedScore('${m.id}')">✎ Edit Score (Admin)</button>`;
      } else if(canActOnMatch(m)){
        if(m.status==='scheduled') actions=`<button class="btn btn-primary btn-sm" onclick="openScoreModal('${m.id}')">Submit Score</button><button class="btn btn-ghost btn-sm" onclick="openReschedule('${m.id}')">Reschedule</button>`;
        if(m.status==='pending-confirm'){
          if(isSubmitter(m)) actions=`<div style="font-size:11px;color:var(--warn);text-align:center;">You submitted this — waiting on ${tn(m.t1===m.submittedBy?m.t2:m.t1)} to confirm</div>`;
          else actions=`<button class="btn btn-warn btn-sm" onclick="openScoreModal('${m.id}',true)">Confirm Score</button><button class="btn btn-danger btn-sm" onclick="disputeScore('${m.id}')">Dispute</button>`;
        }
      }
      const r2=sd?calcResult(sd):null;
      const winnerName=r2&&r2.result!=='draw'?tn(r2.result==='win1'?m.t1:m.t2):null;
      const isDone=m.status==='confirmed';
      return `<div class="match-card ${cardCls}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span class="chip ${chipCls}">${chipTxt}</span>
          <span style="font-size:10px;color:var(--muted);font-family:'Space Mono',monospace;">Court ${m.court}</span>
        </div>
        ${isDone&&winnerName
          ?`<div style="margin-bottom:4px;"><div style="font-size:18px;font-weight:700;color:var(--accent);">${winnerName}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Winner</div></div>
            <div class="match-teams" style="font-size:12px;color:var(--muted);margin-bottom:2px;"><span>${tn(m.t1)}</span><span class="match-vs">vs</span><span>${tn(m.t2)}</span></div>`
          :`<div class="match-teams"><span>${tn(m.t1)}</span><span class="match-vs">vs</span><span>${tn(m.t2)}</span></div>`}
        ${scoreHtml}
        ${(()=>{
          // Show attendance on confirmed matches — who played
          const players = m.players;
          if(!players||!players.length) return '';
          // Resolve player IDs (format: teamId_pN) to names
          const names = players.map(pid=>{
            const [teamId,...rest] = pid.split('_p');
            const idx = parseInt(rest.join('_p'));
            return S.teams[teamId]?.players?.[idx]?.name||'Player';
          });
          return `<div style="font-size:10px;color:var(--muted);margin-top:4px;">
            👤 ${names.join(', ')}
            ${isAdminUser()?`<button onclick="openAttendanceOverride('${m.id}')" style="background:none;border:none;color:var(--brand);font-size:10px;cursor:pointer;margin-left:6px;">✎ edit</button>`:''}
          </div>`;
        })()}
        <div class="match-meta" style="font-size:10px;color:var(--muted);margin-top:4px;"><span>📅 ${m.date}</span><span>🕖 ${m.time}</span></div>
        ${m.rescheduleRequest?`<div style="font-size:10px;color:var(--brand);margin-top:4px;padding:4px 8px;background:rgba(67,131,250,0.08);border-radius:4px;">⏳ Reschedule pending admin approval → ${m.rescheduleRequest.proposedDate} ${m.rescheduleRequest.proposedTime}</div>`:''}
        <div class="match-actions">${actions}</div>
      </div>`;
    }).join('');
  }

  container.innerHTML=html;
}

