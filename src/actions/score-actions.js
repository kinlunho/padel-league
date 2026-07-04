// src/actions/score-actions.js
// Score modal logic: submit, confirm (with self-confirm block), dispute, dispute resolution.

function openScoreModal(matchId,isConfirm=false){
  S.editMatchId=matchId;editingKO=null;S.resolvingDispute=false;
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
  if(sd.gamesOnly) return true;
  if(!isValidSetScore(sd.s1t1,sd.s1t2)){showToast(`Set 1 score (${sd.s1t1}–${sd.s1t2}) isn't a valid set result. Sets end 6–0 to 6–4, 7–5, or 7–6.`,true);return false;}
  if(!isValidSetScore(sd.s2t1,sd.s2t2)){showToast(`Set 2 score (${sd.s2t1}–${sd.s2t2}) isn't a valid set result. Sets end 6–0 to 6–4, 7–5, or 7–6.`,true);return false;}
  const sw1=(sd.s1t1>sd.s1t2?1:0)+(sd.s2t1>sd.s2t2?1:0);
  const sw2=(sd.s1t2>sd.s1t1?1:0)+(sd.s2t2>sd.s2t1?1:0);
  if(sw1===1&&sw2===1){
    if(!sd.stb){showToast('Sets level 1–1: enter Super Tiebreaker or tick "time expired"',true);return false;}
    if(sd.stb1===sd.stb2){showToast('STB must have a winner',true);return false;}
    if(Math.max(sd.stb1,sd.stb2)<10){showToast('STB: first to 10 points',true);return false;}
    if(Math.abs(sd.stb1-sd.stb2)<2){showToast('STB: must win by 2',true);return false;}
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
    await MatchesDB.update(S.editMatchId,{scoreData:sd,status:'confirmed',submittedBy:'admin',notes});
    addLog(`Score entered by admin: ${tn(m.t1)} vs ${tn(m.t2)} — ${resultStr}`,'var(--gold)');
    closeModal('scoreModal');
    showToast('Score entered and confirmed (admin entry)');
    return;
  }

  const realSubmitter=wasConfirm?m.submittedBy:(isCaptainUser()?S.myTeamId:m.t1);
  await MatchesDB.update(S.editMatchId,{scoreData:sd,status:wasConfirm?'confirmed':'pending-confirm',submittedBy:realSubmitter,notes});
  const r=calcResult(sd);
  const resultStr=r?r.result==='draw'?'Draw':r.result==='win1'?`${tn(m.t1)} wins`:`${tn(m.t2)} wins`:'';
  addLog(`Score ${wasConfirm?'confirmed':'submitted'}: ${tn(m.t1)} vs ${tn(m.t2)} — ${resultStr}`,wasConfirm?'var(--accent)':'var(--warn)');
  closeModal('scoreModal');
  showToast(wasConfirm?'Score confirmed!':'Score submitted — awaiting opponent confirmation');
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

