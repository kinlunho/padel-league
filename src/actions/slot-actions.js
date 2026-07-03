// src/actions/slot-actions.js
// Claim Slot and Quick Schedule (click-an-empty-court-slot) flows.

function openClaimSlot(matchId){
  S.editMatchId=matchId;
  const m=S.matches[matchId];
  document.getElementById('claim-match-info').innerHTML=`${tn(m.t1)} <span style="color:var(--muted);font-weight:400;">vs</span> ${tn(m.t2)}`;
  populateDates('claim-date');
  document.getElementById('claim-conflict').style.display='none';
  openModal('claimSlotModal');
}

async function confirmClaimSlot(){
  const id=S.editMatchId;
  const m=S.matches[id];
  const date=document.getElementById('claim-date').value;
  const time=document.getElementById('claim-time').value;
  const court=parseInt(document.getElementById('claim-court').value);
  const conflict=Object.values(S.matches).find(x=>x.id!==id&&x.date===date&&x.time===time&&x.court===court);
  if(conflict){
    document.getElementById('claim-conflict').style.display='block';
    document.getElementById('claim-conflict').textContent=`⚠ Court ${court} at ${time} already booked by ${tn(conflict.t1)} vs ${tn(conflict.t2)}`;
    return;
  }
  try {
    await MatchesDB.update(id,{date,time,court,status:'scheduled'});
    addLog(`Slot claimed: ${tn(m.t1)} vs ${tn(m.t2)} (${m.group}, Round ${m.round}) → ${date} ${time}`,'var(--brand)');
    closeModal('claimSlotModal');
    showToast('Slot claimed!');
  } catch(err){ showToast('Failed to claim slot: ' + err.message, true); }
}

async function confirmQuickSchedule(){
  const matchId=document.getElementById('quick-fixture-select').value;
  const {date,time,court}=S.quickScheduleTarget;
  const m=S.matches[matchId];
  const conflict=Object.values(S.matches).find(x=>x.id!==matchId&&x.date===date&&x.time===time&&x.court===court);
  if(conflict){showToast('That slot was just taken by another match',true);return;}
  try {
    await MatchesDB.update(matchId,{date,time,court,status:'scheduled'});
    addLog(`Slot claimed via quick-schedule: ${tn(m.t1)} vs ${tn(m.t2)} → ${date} ${time}`,'var(--brand)');
    closeModal('quickScheduleModal');
    showToast('Slot claimed!');
  } catch(err){ showToast('Failed to claim slot: ' + err.message, true); }
}


