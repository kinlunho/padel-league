// src/actions/score-actions.js
// Score modal logic: submit, confirm (with self-confirm block), dispute, dispute resolution.

function openScoreModal(matchId,isConfirm=false){
  S.editMatchId=matchId;editingKO=null;S.resolvingDispute=false;
  S.isConfirmMode=isConfirm; // gates attendance UI — only shown on submission
  const m=S.matches[matchId];
  document.getElementById('score-modal-title').textContent=isConfirm?'Confirm Score':'Submit Score';
  document.getElementById('score-match-info').innerHTML=`<strong>${tn(m.t1)}</strong> vs <strong>${tn(m.t2)}</strong><br><span style="color:var(--muted);">${m.date} · ${m.time} · Court ${m.court}</span>`;
  ['a','b','c','g'].forEach(s=>{
    const e1=document.getElementById('sc-lbl-t1'+s);const e2=document.getElementById('sc-lbl-t2'+s);
    if(e1)e1.textContent=tn(m.t1);if(e2)e2.textContent=tn(m.t2);
  });
  if(isConfirm&&m.scoreData){
    const sd=m.scoreData;
    if(sd.gamesOnly){document.getElementById('sc-games-only').checked=true;document.getElementById('sc-g-t1').value=sd.g1;document.getElementById('sc-g-t2').value=sd.g2;}
    else{document.getElementById('sc-games-only').checked=false;document.getElementById('sc-s1-t1').value=sd.s1t1||6;document.getElementById('sc-s1-t2').value=sd.s1t2||3;document.getElementById('sc-s2-t1').value=sd.s2t1||4;document.getElementById('sc-s2-t2').value=sd.s2t2||6;if(sd.stb&&sd.stb1!==null){document.getElementById('sc-stb-t1').value=sd.stb1;document.getElementById('sc-stb-t2').value=sd.stb2;}}
  } else {
    document.getElementById('sc-games-only').checked=false;
    document.getElementById('sc-s1-t1').value=6;document.getElementById('sc-s1-t2').value=3;
    document.getElementById('sc-s2-t1').value=4;document.getElementById('sc-s2-t2').value=6;
  }
  toggleGamesMode();updateScorePreview();
  renderAttendanceSection(matchId, isConfirm);
  openModal('scoreModal');
}

// Admin-only entry point for resolving a disputed match. Reuses the same score-entry modal as
// normal submission, but pre-fills with whatever score was last submitted (so the admin sees
// what was disputed, not a blank form) and skips the pending-confirm handshake entirely on
// submit — the coach is the final arbiter per the published rules, no opponent confirmation
// is required or possible for a dispute resolution.
function openDisputeResolve(matchId){
  if(!isAdminUser()){showToast('Admin access required to resolve disputes',true);return;}
  S.editMatchId=matchId;editingKO=null;S.resolvingDispute=true;
  const m=S.matches[matchId];
  document.getElementById('score-modal-title').textContent='Resolve Dispute — Admin Override';
  document.getElementById('score-match-info').innerHTML=`<strong>${tn(m.t1)}</strong> vs <strong>${tn(m.t2)}</strong><br><span style="color:var(--red);">Disputed — last submitted score shown below. Enter the correct result and submit; no opponent confirmation needed.</span>`;
  ['a','b','c','g'].forEach(s=>{
    const e1=document.getElementById('sc-lbl-t1'+s);const e2=document.getElementById('sc-lbl-t2'+s);
    if(e1)e1.textContent=tn(m.t1);if(e2)e2.textContent=tn(m.t2);
  });
  if(m.scoreData){
    const sd=m.scoreData;
    if(sd.gamesOnly){document.getElementById('sc-games-only').checked=true;document.getElementById('sc-g-t1').value=sd.g1;document.getElementById('sc-g-t2').value=sd.g2;}
    else{document.getElementById('sc-games-only').checked=false;document.getElementById('sc-s1-t1').value=sd.s1t1||6;document.getElementById('sc-s1-t2').value=sd.s1t2||3;document.getElementById('sc-s2-t1').value=sd.s2t1||4;document.getElementById('sc-s2-t2').value=sd.s2t2||6;if(sd.stb&&sd.stb1!==null){document.getElementById('sc-stb-t1').value=sd.stb1;document.getElementById('sc-stb-t2').value=sd.stb2;}}
  } else {
    document.getElementById('sc-games-only').checked=false;
    document.getElementById('sc-s1-t1').value=6;document.getElementById('sc-s1-t2').value=3;
    document.getElementById('sc-s2-t1').value=4;document.getElementById('sc-s2-t2').value=6;
  }
  toggleGamesMode();updateScorePreview();
  openModal('scoreModal');
}

// ── Attendance section ───────────────────────────────────────────────────────
// Shows checkboxes for submitter's team players, pre-ticked.
// Hidden on confirmation mode — opponent confirms score only, not who played.
// Admin sees both teams' rosters for override purposes.

function renderAttendanceSection(matchId, isConfirm){
  const section = document.getElementById('sc-attendance');
  if(!section) return;

  // Skip attendance for admin resolves and KO finals
  if(S.resolvingDispute || editingKO){
    section.style.display='none';
    return;
  }

  const m = S.matches[matchId];
  if(!m){ section.style.display='none'; return; }

  const myTeamId = S.myTeamId;
  const existing = m.players || [];

  let teamsToShow, headerText, subText;

  if(isAdminUser()){
    // Admin sees both teams always
    teamsToShow = [m.t1, m.t2].filter(Boolean);
    headerText = 'Who played this match?';
    subText = 'Untick absent players from either team';
  } else if(isConfirm){
    // Confirming captain marks THEIR OWN team's players
    // (submitter already marked theirs — now we collect the other side)
    const myTeam = myTeamId && (m.t1===myTeamId||m.t2===myTeamId) ? myTeamId : null;
    teamsToShow = myTeam ? [myTeam] : [];
    headerText = 'Who played from your team?';
    subText = 'Untick players who were absent from your side';
  } else {
    // Submitting captain marks their own team
    const myTeam = myTeamId && (m.t1===myTeamId||m.t2===myTeamId) ? myTeamId : null;
    teamsToShow = myTeam ? [myTeam] : [];
    headerText = 'Who played from your team?';
    subText = 'Untick absent players — the opposing captain will confirm their side';
  }

  if(!teamsToShow.length){ section.style.display='none'; return; }

  const rows = teamsToShow.map(teamId => {
    const team = S.teams[teamId];
    if(!team) return '';
    const players = team.players || [];
    if(!players.length) return '';
    const teamLabel = teamsToShow.length > 1
      ? `<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin:8px 0 4px;">${team.name}</div>`
      : '';
    const checkboxes = players.map((p,i) => {
      const pid = `${teamId}_p${i}`;
      // Pre-tick: if no record yet = all played. If record exists, check if this pid is in it.
      const checked = existing.length===0 || existing.includes(pid);
      return `<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:3px 0;">
        <input type="checkbox" id="att-${pid}" value="${pid}" ${checked?'checked':''}
          style="width:15px;height:15px;accent-color:var(--accent);">
        ${p.name||'Player '+(i+1)}${i===0?' <span style="font-size:9px;color:var(--accent);margin-left:4px;">cap</span>':''}
        ${p.nprp?`<span style="font-size:9px;color:var(--brand);">NPRP ${p.nprp}</span>`:''}
      </label>`;
    }).join('');
    return teamLabel + checkboxes;
  }).join('');

  section.style.display='block';
  section.innerHTML=`
    <div style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px;">
      <div style="font-size:11px;font-weight:700;color:var(--text-primary);margin-bottom:6px;">
        ${headerText}
        <span style="font-size:10px;color:var(--muted);font-weight:400;margin-left:4px;">${subText}</span>
      </div>
      ${rows}
    </div>`;
}

function getAttendancePlayers(){
  const section = document.getElementById('sc-attendance');
  if(!section || section.style.display==='none') return null;
  const checked = [...section.querySelectorAll('input[type=checkbox]:checked')].map(cb=>cb.value);
  const all = [...section.querySelectorAll('input[type=checkbox]')].map(cb=>cb.value);
  // If all ticked return null (no absence recorded — saves storage)
  if(checked.length===all.length) return null;
  return checked;
}

function toggleGamesMode(){
  const go=document.getElementById('sc-games-only').checked;
  document.getElementById('sc-sets-mode').style.display=go?'none':'block';
  document.getElementById('sc-games-mode').style.display=go?'block':'none';
  updateScorePreview();
}

function updateScorePreview(){
  const go=document.getElementById('sc-games-only').checked;
  const el=document.getElementById('sc-result-preview');
  if(go){
    const g1=parseInt(document.getElementById('sc-g-t1').value)||0;
    const g2=parseInt(document.getElementById('sc-g-t2').value)||0;
    if(g1===g2) el.innerHTML=`<span style="color:var(--blue)">Draw — 1 pt each</span>`;
    else el.innerHTML=`<span style="color:var(--accent)">${g1>g2?(S.editMatchId?tn(S.matches[S.editMatchId]?.t1):'Team A'):(S.editMatchId?tn(S.matches[S.editMatchId]?.t2):'Team B')} wins (games ${g1}–${g2})</span>`;
    document.getElementById('sc-stb-box').style.display='none';
    return;
  }
  const s1t1=parseInt(document.getElementById('sc-s1-t1').value)||0;
  const s1t2=parseInt(document.getElementById('sc-s1-t2').value)||0;
  const s2t1=parseInt(document.getElementById('sc-s2-t1').value)||0;
  const s2t2=parseInt(document.getElementById('sc-s2-t2').value)||0;
  const sw1=(s1t1>s1t2?1:0)+(s2t1>s2t2?1:0);
  const sw2=(s1t2>s1t1?1:0)+(s2t2>s2t1?1:0);
  const needSTB=sw1===1&&sw2===1;
  document.getElementById('sc-stb-box').style.display=needSTB?'block':'none';
  if(!needSTB){
    const winner=sw1>sw2?'t1':'t2';
    const wName=S.editMatchId?tn(S.matches[S.editMatchId]?.[winner]):(winner==='t1'?'Team A':'Team B');
    el.innerHTML=`<span style="color:var(--accent)">${wName} wins (${sw1>sw2?`${sw1}–${sw2}`:sw2+'-'+sw1} sets)</span>`;
  } else {
    el.innerHTML=`<span style="color:var(--gold);">Sets level 1–1 → Super Tiebreaker needed</span>`;
  }
}

function buildScoreData(){
  const go=document.getElementById('sc-games-only').checked;
  if(go){
    const g1=parseInt(document.getElementById('sc-g-t1').value)||0;
    const g2=parseInt(document.getElementById('sc-g-t2').value)||0;
    return {gamesOnly:true,g1,g2};
  }
  const s1t1=parseInt(document.getElementById('sc-s1-t1').value)||0;
  const s1t2=parseInt(document.getElementById('sc-s1-t2').value)||0;
  const s2t1=parseInt(document.getElementById('sc-s2-t1').value)||0;
  const s2t2=parseInt(document.getElementById('sc-s2-t2').value)||0;
  const needSTB=(s1t1>s1t2?1:0)+(s2t1>s2t2?1:0)===1&&(s1t2>s1t1?1:0)+(s2t2>s2t1?1:0)===1;
  const stbShown=document.getElementById('sc-stb-box').style.display!=='none';
  let stb=false,stb1=null,stb2=null;
  if(needSTB&&stbShown){
    stb=true;
    stb1=parseInt(document.getElementById('sc-stb-t1').value)||0;
    stb2=parseInt(document.getElementById('sc-stb-t2').value)||0;
  }
  return {gamesOnly:false,s1t1,s1t2,s2t1,s2t2,stb,stb1,stb2};
}

// A completed set can only end 6-0 through 6-4 (straight), 7-5 (won at 6-6... no, one break
// past 5-5 to 6-5 then 7-5), or 7-6 (6-6 forced a tiebreak). Any other combination — 4-7, 6-7,
// 5-7, 9-3, etc. — is not a score a completed set can actually produce. This does NOT apply to
// games-only mode (time-expired matches record partial/incomplete games, not a finished set).
function isValidSetScore(a,b){
  const hi=Math.max(a,b), lo=Math.min(a,b);
  if(hi===6&&lo<=4) return true;
  if(hi===7&&(lo===5||lo===6)) return true;
  return false;
}

function validateScore(sd){
  // KO entry: games-only mode not allowed — must always produce a winner
  if(S.isKOEntry && sd.gamesOnly){
    showToast('Knockout matches cannot use games-only mode — enter full set scores.',true);
    return false;
  }
  if(sd.gamesOnly){
    // Group stage: draws allowed via games-only
    if(S.isKOEntry){showToast('KO matches must have a winner',true);return false;}
    return true;
  }
  if(!isValidSetScore(sd.s1t1,sd.s1t2)){showToast(`Set 1 score (${sd.s1t1}–${sd.s1t2}) isn't a valid set result. Sets end 6–0 to 6–4, 7–5, or 7–6.`,true);return false;}
  if(!isValidSetScore(sd.s2t1,sd.s2t2)){showToast(`Set 2 score (${sd.s2t1}–${sd.s2t2}) isn't a valid set result. Sets end 6–0 to 6–4, 7–5, or 7–6.`,true);return false;}
  const sw1=(sd.s1t1>sd.s1t2?1:0)+(sd.s2t1>sd.s2t2?1:0);
  const sw2=(sd.s1t2>sd.s1t1?1:0)+(sd.s2t2>sd.s2t1?1:0);
  if(sw1===1&&sw2===1){
    if(!sd.stb){
      // KO: STB is mandatory when sets are level — cannot skip
      const msg=S.isKOEntry
        ?'Sets level 1–1: Super Tiebreaker is required for knockout matches.'
        :'Sets level 1–1: enter Super Tiebreaker or tick "time expired"';
      showToast(msg,true);return false;
    }
    if(sd.stb1===sd.stb2){showToast('STB must have a winner',true);return false;}
    if(Math.max(sd.stb1,sd.stb2)<10){showToast('STB: first to 10 points',true);return false;}
    if(Math.abs(sd.stb1-sd.stb2)<2){showToast('STB: must win by 2',true);return false;}
  }
  // KO: a 2-0 set win is fine. A 0-2 loss is fine. No other outcome possible — draws blocked.
  if(S.isKOEntry&&sw1===sw2&&sw1!==1){
    showToast('Knockout match must have a winner — check the set scores.',true);
    return false;
  }
  return true;
}

async function submitScore(){
  const sd=buildScoreData();
  if(!validateScore(sd)) return;
  const notes=document.getElementById('sc-notes').value;

  // KO Final — editingKO is now a full pKey e.g. "golddivision_champ"
  if(editingKO){
    if(!S.knockout[editingKO]) S.knockout[editingKO]={final:{t1:null,t2:null,scoreData:null,winner:null,loser:null}};
    const fin=S.knockout[editingKO].final;
    const r=calcResult(sd);
    fin.scoreData=sd;
    fin.winner=r.result==='win1'?fin.t1:r.result==='win2'?fin.t2:null;
    fin.loser=fin.winner===fin.t1?fin.t2:fin.t1;
    const isChamp=editingKO.endsWith('_champ');
    addLog(`${isChamp?'🏆 Champions':'🦅 Phoenix Cup'} Final: ${tn(fin.winner)} wins!`,'var(--gold)');
    closeModal('scoreModal');showToast('Final result recorded! 🏆');renderKnockoutPage();return;
  }

  // Admin resolving a dispute
  if(S.resolvingDispute){
    const m=S.matches[S.editMatchId];
    const r=calcResult(sd);
    const resultStr=r?r.result==='draw'?'Draw':r.result==='win1'?`${tn(m.t1)} wins`:`${tn(m.t2)} wins`:'';
    await MatchesDB.update(S.editMatchId,{scoreData:sd,status:'confirmed',notes});
    addLog(`⚖ Dispute resolved by admin: ${tn(m.t1)} vs ${tn(m.t2)} — ${resultStr}`,'var(--gold)');
    S.resolvingDispute=false;
    closeModal('scoreModal');
    showToast('Dispute resolved — score confirmed');
    return;
  }

  const m=S.matches[S.editMatchId];
  const wasConfirm=m.status==='pending-confirm';

  // Admin fresh entry — authoritative, no handshake
  if(isAdminUser()&&!wasConfirm){
    const r=calcResult(sd);
    const resultStr=r?r.result==='draw'?'Draw':r.result==='win1'?`${tn(m.t1)} wins`:`${tn(m.t2)} wins`:'';
    const adminAttendance = getAttendancePlayers();
    const adminFields = {scoreData:sd,status:'confirmed',submittedBy:'admin',notes};
    if(adminAttendance!==null&&adminAttendance!==undefined) adminFields.players=adminAttendance;
    await MatchesDB.update(S.editMatchId, adminFields);
    addLog(`Score entered by admin: ${tn(m.t1)} vs ${tn(m.t2)} — ${resultStr}`,'var(--gold)');
    closeModal('scoreModal');
    showToast('Score entered and confirmed (admin entry)');
    return;
  }

  const realSubmitter=wasConfirm?m.submittedBy:(isCaptainUser()?S.myTeamId:m.t1);
  const newAttendance = getAttendancePlayers(); // null = all played, array = specific players

  let finalPlayers;
  if(wasConfirm){
    // Merge: keep submitter's team players already recorded, add confirmer's team players
    const existing = m.players || [];
    if(newAttendance === null){
      // Confirmer says all their players played — keep existing + add all confirmer's team
      const myTeamId = S.myTeamId;
      const confirmTeamId = myTeamId && (m.t1===myTeamId||m.t2===myTeamId) ? myTeamId : null;
      if(confirmTeamId && existing.length > 0){
        const confirmTeamPlayers = (S.teams[confirmTeamId]?.players||[]).map((_,i)=>`${confirmTeamId}_p${i}`);
        finalPlayers = [...new Set([...existing, ...confirmTeamPlayers])];
      } else {
        finalPlayers = existing.length ? existing : null; // null = all played
      }
    } else {
      // Confirmer marked specific players — merge with existing
      finalPlayers = [...new Set([...existing, ...newAttendance])];
    }
  } else {
    finalPlayers = newAttendance; // submitter's side only at this point
  }

  const updateFields = {
    scoreData:sd,
    status:wasConfirm?'confirmed':'pending-confirm',
    submittedBy:realSubmitter,
    notes
  };
  if(finalPlayers !== null && finalPlayers !== undefined) updateFields.players = finalPlayers;
  await MatchesDB.update(S.editMatchId, updateFields);
  const r=calcResult(sd);
  const resultStr=r?r.result==='draw'?'Draw':r.result==='win1'?`${tn(m.t1)} wins`:`${tn(m.t2)} wins`:'';
  addLog(`Score ${wasConfirm?'confirmed':'submitted'}: ${tn(m.t1)} vs ${tn(m.t2)} — ${resultStr}`,wasConfirm?'var(--accent)':'var(--warn)');
  closeModal('scoreModal');
  showToast(wasConfirm?'Score confirmed!':'Score submitted — awaiting opponent confirmation');
}

// ── Admin attendance override ────────────────────────────────────────────────
// Opens a compact modal letting admin tick/untick who played on a confirmed match.
async function openAttendanceOverride(matchId){
  if(!isAdminUser()){showToast('Admin only',true);return;}
  const m = S.matches[matchId];
  if(!m){showToast('Match not found',true);return;}

  const existing = m.players||[];
  const teams = [m.t1,m.t2].filter(Boolean);

  const rows = teams.map(teamId=>{
    const team = S.teams[teamId];
    if(!team) return '';
    const players = team.players||[];
    return `<div style="margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">${team.name}</div>
      ${players.map((p,i)=>{
        const pid=`${teamId}_p${i}`;
        const checked=existing.length===0||existing.includes(pid);
        return `<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:2px 0;">
          <input type="checkbox" id="att-ov-${pid}" value="${pid}" ${checked?'checked':''}
            style="width:15px;height:15px;accent-color:var(--accent);">
          ${p.name||'Player '+(i+1)}${i===0?' <span style="font-size:9px;color:var(--accent);">cap</span>':''}
        </label>`;
      }).join('')}
    </div>`;
  }).join('');

  // Use a simple confirm-style dialog via a temporary overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '9999';
  overlay.innerHTML = `<div class="modal">
    <div class="modal-title">Edit Attendance — Admin</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">${tn(m.t1)} vs ${tn(m.t2)}</div>
    ${rows}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
      <button class="btn btn-primary" onclick="saveAttendanceOverride('${matchId}',this)">Save</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

async function saveAttendanceOverride(matchId, btn){
  const overlay = btn.closest('.modal-overlay');
  const checked = [...overlay.querySelectorAll('input[type=checkbox]:checked')].map(cb=>cb.value);
  const all = [...overlay.querySelectorAll('input[type=checkbox]')].map(cb=>cb.value);
  const players = checked.length===all.length ? [] : checked; // empty = all played
  try {
    await MatchesDB.update(matchId, { players });
    addLog(`Attendance updated by admin for match ${matchId}`,'var(--muted)');
    showToast('Attendance updated');
    overlay.remove();
  } catch(err){ showToast('Failed: '+err.message,true); }
}

// Admin edit of an already-confirmed score. Reuses dispute-resolve path (authoritative,
// no opponent confirmation needed). Records audit entry in activity log.
function adminEditConfirmedScore(matchId){
  if(!isAdminUser()){ showToast('Admin access required', true); return; }
  if(!confirm('Edit this confirmed score?\n\nThis will update standings immediately. The change will be recorded in the activity log.')) return;
  S.editMatchId = matchId; editingKO = null; S.resolvingDispute = true;
  const m = S.matches[matchId];
  document.getElementById('score-modal-title').textContent = 'Edit Score — Admin Override';
  document.getElementById('score-match-info').innerHTML =
    `<strong>${tn(m.t1)}</strong> vs <strong>${tn(m.t2)}</strong><br>
     <span style="color:var(--warn);">Admin edit of confirmed score — change will be logged for audit trail.</span>`;
  ['a','b','c','g'].forEach(s=>{
    const e1=document.getElementById('sc-lbl-t1'+s); const e2=document.getElementById('sc-lbl-t2'+s);
    if(e1) e1.textContent=tn(m.t1); if(e2) e2.textContent=tn(m.t2);
  });
  if(m.scoreData){
    const sd=m.scoreData;
    if(sd.gamesOnly){ document.getElementById('sc-games-only').checked=true; document.getElementById('sc-g-t1').value=sd.g1; document.getElementById('sc-g-t2').value=sd.g2; }
    else{ document.getElementById('sc-games-only').checked=false; document.getElementById('sc-s1-t1').value=sd.s1t1||6; document.getElementById('sc-s1-t2').value=sd.s1t2||3; document.getElementById('sc-s2-t1').value=sd.s2t1||4; document.getElementById('sc-s2-t2').value=sd.s2t2||6;
      if(sd.stb&&sd.stb1!==null){ document.getElementById('sc-stb-t1').value=sd.stb1; document.getElementById('sc-stb-t2').value=sd.stb2; } }
  }
  toggleGamesMode(); updateScorePreview(); openModal('scoreModal');
}

async function confirmScore(id){
  const m=S.matches[id];
  if(!isAdminUser()&&S.myTeamId&&S.myTeamId===m.submittedBy){
    showToast("You submitted this score — waiting on the other captain to confirm it, not you",true);
    return;
  }
  await MatchesDB.update(id,{status:'confirmed'});
  addLog(`Score confirmed: ${tn(m.t1)} vs ${tn(m.t2)}`,'var(--accent)');
  showToast('Score confirmed!');
}

async function disputeScore(id){
  const m=S.matches[id];
  await MatchesDB.update(id,{status:'disputed'});
  addLog(`Score disputed: ${tn(m.t1)} vs ${tn(m.t2)} — refer to coach`,'var(--red)');
  showToast('Disputed — coach will resolve',true);
}

