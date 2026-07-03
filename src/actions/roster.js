// src/actions/roster.js
// Roster editing (add/remove/edit players), claim-code Join as Player flow, reschedule.

// ════════ ROSTER EDITING ════════
function openRosterEdit(teamId){
  const t=S.teams[teamId];
  if(!canEditRoster(t)){showToast('Not authorized to edit this roster',true);return;}
  S.editRosterTeamId=teamId;
  document.getElementById('roster-edit-title').textContent=`Edit Roster — ${t.name}`;
  document.getElementById('roster-team-email').value=t.email;
  renderRosterPlayerRows(t.players||[]);
  openModal('rosterEditModal');
}

function renderRosterPlayerRows(players){
  const list=document.getElementById('roster-player-list');
  list.innerHTML=players.map((p,i)=>{
    const claimStatus=p.claimedByEmail
      ?`<span style="font-size:9px;color:var(--accent);">✓ linked to ${p.claimedByEmail}</span>`
      :`<span style="font-size:9px;color:var(--muted);font-family:'Space Mono',monospace;">code: ${p.claimCode}</span> <button type="button" class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:10px;" onclick="regenerateRosterCode(${i})">↻ regenerate</button>`;
    const nprpOpts=[1.0,1.5,2.0,2.5,3.0,3.5,4.0,4.5,5.0,5.5,6.0,6.5,7.0]
      .map(v=>`<option value="${v}"${parseFloat(p.nprp)===v?' selected':''}>${v}</option>`).join('');
    return `<div class="player-row" data-pid="${p.pid}" data-code="${p.claimCode||''}" data-claimed="${p.claimedByEmail||''}">
      <span class="player-badge">P${i+1}${i===0?' ★':''}</span>
      <input class="form-input roster-name-input" value="${p.name||''}" placeholder="Player name" style="flex:1.4;">
      <input class="form-input roster-phone-input" value="${p.phone||''}" placeholder="Phone" style="flex:1;">
      <select class="form-select roster-nprp-input" style="flex:0.6;"><option value="">NPRP</option>${nprpOpts}</select>
      <button type="button" class="btn btn-ghost btn-sm" style="padding:6px 10px;" onclick="removeRosterPlayerRow(this)" ${players.length<=2?'disabled title="Minimum 2 players"':''}>✕</button>
    </div>
    <div style="margin:-4px 0 10px 44px;">${claimStatus}</div>`;
  }).join('');
  const rosterLocked = isLeagueStarted() && !isAdminUser();
  const addBtn = document.getElementById('roster-add-btn');
  if (addBtn) addBtn.style.display = (players.length>=5 || rosterLocked) ? 'none' : '';
  const lockNotice = document.getElementById('roster-lock-notice');
  if (lockNotice) lockNotice.style.display = rosterLocked ? 'block' : 'none';
}

function addRosterPlayerRow(){
  if(isLeagueStarted() && !isAdminUser()){
    showToast('Roster additions are locked once the league starts. Contact an admin to add a player (e.g. injury replacement).',true);
    return;
  }
  const list=document.getElementById('roster-player-list');
  const count=list.querySelectorAll('.player-row').length;
  if(count>=5){showToast('Max 5 players',true);return;}
  const nprpOpts=[1.0,1.5,2.0,2.5,3.0,3.5,4.0,4.5,5.0,5.5,6.0,6.5,7.0]
    .map(v=>`<option value="${v}">${v}</option>`).join('');
  const row=document.createElement('div');row.className='player-row';
  row.dataset.pid=uid();row.dataset.code=genClaimCode();row.dataset.claimed='';
  row.innerHTML=`<span class="player-badge">P${count+1}</span><input class="form-input roster-name-input" placeholder="Player name" style="flex:1.4;"><input class="form-input roster-phone-input" placeholder="Phone" style="flex:1;"><select class="form-select roster-nprp-input" style="flex:0.6;"><option value="">NPRP</option>${nprpOpts}</select><button type="button" class="btn btn-ghost btn-sm" style="padding:6px 10px;" onclick="removeRosterPlayerRow(this)">✕</button>`;
  list.appendChild(row);
  const codeNote=document.createElement('div');
  codeNote.style.cssText='margin:-4px 0 10px 44px;';
  codeNote.innerHTML=`<span style="font-size:9px;color:var(--muted);font-family:'Space Mono',monospace;">code: ${row.dataset.code}</span>`;
  list.appendChild(codeNote);
  if(count+1>=5) document.getElementById('roster-add-btn').style.display='none';
}

function removeRosterPlayerRow(btn){
  const rows=document.querySelectorAll('#roster-player-list .player-row');
  if(rows.length<=2){showToast('Minimum 2 players required',true);return;}
  const row=btn.closest('.player-row');
  const noteDiv=row.nextElementSibling;
  row.remove();
  if(noteDiv&&!noteDiv.classList.contains('player-row')) noteDiv.remove();
  document.getElementById('roster-add-btn').style.display='';
}

function regenerateRosterCode(index){
  const t=S.teams[S.editRosterTeamId];
  const p=t.players[index];
  if(p.claimedByEmail){showToast('Already claimed — cannot regenerate',true);return;}
  p.claimCode=genClaimCode();
  renderRosterPlayerRows(t.players);
  showToast('New code generated — save to confirm');
}

async function saveRosterEdit(){
  const teamId=S.editRosterTeamId;
  const t=S.teams[teamId];
  const email=document.getElementById('roster-team-email').value.trim();
  if(!email){showToast('Team email required',true);return;}
  const rows=[...document.querySelectorAll('#roster-player-list .player-row')];
  if(rows.length<2){showToast('Minimum 2 players required',true);return;}
  const newPlayers=rows.map(row=>{
    const name=row.querySelector('.roster-name-input').value.trim();
    const phone=row.querySelector('.roster-phone-input').value.trim();
    const nprp=row.querySelector('.roster-nprp-input')?.value||null;
    const pid=row.dataset.pid;
    const existing=(t.players||[]).find(p=>p.pid===pid);
    return {
      pid,
      name,
      phone,
      nprp: nprp||existing?.nprp||null,
      claimCode:existing?existing.claimCode:row.dataset.code,
      claimedByEmail:existing?existing.claimedByEmail:null
    };
  }).filter(p=>p.name);
  if(newPlayers.length<2){showToast('Minimum 2 players with names required',true);return;}
  try {
    await TeamsDB.update(teamId,{email,players:newPlayers});
    addLog(`Roster updated: ${t.name}`,'var(--brand)');
    closeModal('rosterEditModal');
    showToast('Roster saved!');
    // No renderTeamsList needed — TeamsDB.subscribe onSnapshot fires automatically
  } catch(err){
    showToast('Failed to save roster: ' + err.message, true);
  }
}

// ════════ JOIN AS PLAYER (claim-code linking) ════════
async function confirmJoinPlayer(){
  const code=document.getElementById('join-claim-code').value.trim().toUpperCase();
  if(!code){showToast('Enter a claim code',true);return;}
  if(!S.userEmail){showToast('Sign in first',true);return;}
  let found=null,foundTeam=null;
  Object.values(S.teams).forEach(t=>{
    (t.players||[]).forEach(p=>{
      if(p.claimCode&&p.claimCode.toUpperCase()===code) {found=p;foundTeam=t;}
    });
  });
  if(!found){showToast('Code not recognized — check with your captain',true);return;}
  if(found.claimedByEmail){showToast('This slot is already linked to another account',true);return;}
  // Write updated players array to Firestore with this slot claimed
  const updatedPlayers=(foundTeam.players||[]).map(p=>
    p.pid===found.pid ? {...p,claimedByEmail:S.userEmail} : p
  );
  try {
    await TeamsDB.update(foundTeam.id,{players:updatedPlayers});
    S.myPlayerTeamId=foundTeam.id;
    addLog(`${S.userEmail} linked to ${found.name} on ${foundTeam.name}`,'var(--accent)');
    closeModal('joinPlayerModal');
    showToast(`Linked! You're now following ${foundTeam.name}.`);
    renderHome();
  } catch(err){
    showToast('Failed to claim slot: ' + err.message, true);
  }
}
function openReschedule(id){
  S.editMatchId=id;
  const m=S.matches[id];
  document.getElementById('rsch-info').innerHTML=`<strong>${tn(m.t1)}</strong> vs <strong>${tn(m.t2)}</strong><br><span style="color:var(--muted);">Current: ${m.date} · ${m.time} · Court ${m.court}</span>`;
  populateDates('rsch-date');
  openModal('rescheduleModal');
}

async function confirmReschedule(){
  const id=S.editMatchId;
  const date=document.getElementById('rsch-date').value;
  const time=document.getElementById('rsch-time').value;
  const court=parseInt(document.getElementById('rsch-court').value);
  const reason=document.getElementById('rsch-reason').value;
  const conflict=Object.values(S.matches).find(m=>m.id!==id&&m.date===date&&m.time===time&&m.court===court);
  if(conflict){showToast('That slot is already booked!',true);return;}
  const m=S.matches[id];
  try {
    if(isAdminUser()){
      // Admin reschedule is immediate and authoritative
      await MatchesDB.update(id,{date,time,court,status:'scheduled',scoreData:null,submittedBy:null,rescheduleRequest:null});
      addLog(`Admin rescheduled: ${tn(m.t1)} vs ${tn(m.t2)} → ${date} ${time}`,'var(--gold)');
      closeModal('rescheduleModal');
      showToast('Rescheduled!');
    } else {
      // Captain reschedule — submit request for admin approval, current slot unchanged
      await MatchesDB.update(id,{
        rescheduleRequest: {
          proposedDate: date, proposedTime: time, proposedCourt: court,
          reason: reason||'', requestedBy: S.myTeamId,
          requestedAt: new Date().toISOString()
        }
      });
      addLog(`⏳ Reschedule requested: ${tn(m.t1)} vs ${tn(m.t2)} → ${date} ${time} (pending admin approval)`,'var(--warn)');
      closeModal('rescheduleModal');
      showToast('Reschedule request sent — waiting for admin approval. Current slot unchanged until approved.');
    }
  } catch(err){ showToast('Failed to reschedule: ' + err.message, true); }
}


async function adminDeleteTeam(teamId, teamName){
  const teamMatches = Object.values(S.matches).filter(m =>
    m.t1===teamId || m.t2===teamId
  );
  const confirmed = teamMatches.filter(m => m.status==='confirmed').length;
  const seasonLocked = S.config?.seasonLocked;

  let msg = `Delete "${teamName}"?\n\n`;
  if(confirmed > 0)
    msg += `⚠ ${confirmed} confirmed match${confirmed!==1?'es':''} with recorded scores will also be deleted — this affects standings.\n\n`;
  if(seasonLocked)
    msg += `⚠ Season is locked (fixtures generated). Deleting mid-season will break the round-robin schedule.\n\n`;
  msg += `The captain's account will be downgraded to Viewer. This cannot be undone.`;

  if(!confirm(msg)) return;

  // Second confirmation if season is locked or confirmed matches exist
  if((seasonLocked || confirmed > 0) && !confirm(`Are you absolutely sure? Type YES to proceed.`)) return;

  try {
    const deleteFn = firebase.app().functions('asia-east2').httpsCallable('deleteTeam');
    const result   = await deleteFn({ teamId, force: true });
    showToast(`"${teamName}" deleted (${result.data.matchesDeleted} matches removed)`);
  } catch(err){ showToast('Failed: ' + err.message, true); }
}
