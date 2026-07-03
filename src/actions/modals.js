// src/actions/modals.js
// Generic modal open/close plumbing and the Schedule Match modal setup.

// ════════ MODALS ════════
function openModal(id){
  if(id==='profileModal'){ openProfileModal(); return; }
  if(id==='scheduleModal'){ populateSchGroups(); populateDates('sch-date'); populateDates('rsch-date'); }
  if(id==='registerModal'){
    if(S.myTeamId && !isAdminUser()){
      showToast('You already have a team registered this season — contact an admin to make changes', true);
      return;
    }
    populateRegGroup();
    // Pre-fill captain email from the logged-in user's email
    const emailEl = document.getElementById('reg-email');
    if(emailEl && S.userEmail && !emailEl.value) emailEl.value = S.userEmail;
  }
  document.getElementById(id).classList.add('open');
}
function closeModal(id){document.getElementById(id).classList.remove('open');}

function populateSchGroups(){
  // Admin schedule modal: show all existing divisions only — no placeholder groups
  const gs = groups();
  const LEAGUE_DIVISIONS = ['Gold Division', 'High Silver Division', 'Low Silver Division'];
  const allGs = gs.length ? gs : LEAGUE_DIVISIONS;
  document.getElementById('sch-group').innerHTML = allGs.map(g=>`<option value="${g}">${g}</option>`).join('');
  updateSchTeams();
}

function populateRegGroup(){
  const regGroupWrap   = document.getElementById('reg-group-wrap');
  const regGroupNotice = document.getElementById('reg-group-notice');
  if(!regGroupWrap) return;
  if(isAdminUser()){
    const LEAGUE_DIVISIONS = ['Gold Division', 'High Silver Division', 'Low Silver Division'];
    const gs = groups().length ? groups() : LEAGUE_DIVISIONS;
    document.getElementById('reg-group').innerHTML = gs.map(g=>`<option value="${g}">${g}</option>`).join('');
    regGroupWrap.style.display   = '';
    if(regGroupNotice) regGroupNotice.style.display = 'none';
  } else {
    regGroupWrap.style.display   = 'none';
    if(regGroupNotice) regGroupNotice.style.display = '';
    document.getElementById('reg-group').innerHTML = '<option value="Unassigned">Unassigned</option>';
  }
}
function updateSchTeams(){
  const g=document.getElementById('sch-group').value;
  const teams=teamsByGroup(g);
  const t1el=document.getElementById('sch-t1');
  const t2el=document.getElementById('sch-t2');
  if(!teams.length){
    t1el.innerHTML='<option value="">No teams in group yet</option>';
    t2el.innerHTML='<option value="">No teams in group yet</option>';
    return;
  }
  t1el.innerHTML=teams.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
  // Home team change listener: re-filter away list so it can never contain the same team
  t1el.onchange=refreshSchAwayOptions;
  refreshSchAwayOptions();
}
function refreshSchAwayOptions(){
  const g=document.getElementById('sch-group').value;
  const homeId=document.getElementById('sch-t1').value;
  const teams=teamsByGroup(g).filter(t=>t.id!==homeId);
  const t2el=document.getElementById('sch-t2');
  const prevSelection=t2el.value;
  t2el.innerHTML=teams.length?teams.map(t=>`<option value="${t.id}">${t.name}</option>`).join(''):'<option value="">No opponent available</option>';
  // preserve prior away-team selection if it's still valid, otherwise defaults to first remaining team
  if(teams.some(t=>t.id===prevSelection)) t2el.value=prevSelection;
}
function populateDates(targetId){
  const dates=leagueDates().filter(d=>d>=new Date().toISOString().split('T')[0]);
  const el=document.getElementById(targetId);
  if(el) el.innerHTML=dates.slice(0,30).map(d=>`<option value="${d}">${new Date(d+'T00:00:00').toLocaleDateString('en-HK',{weekday:'short',month:'short',day:'numeric'})}</option>`).join('');
}

const NPRP_SELECT = `<select class="form-select nprp-select" style="flex:0.6;"><option value="">NPRP</option><option value="1.0">1.0</option><option value="1.5">1.5</option><option value="2.0">2.0</option><option value="2.5">2.5</option><option value="3.0">3.0</option><option value="3.5">3.5</option><option value="4.0">4.0</option><option value="4.5">4.5</option><option value="5.0">5.0</option><option value="5.5">5.5</option><option value="6.0">6.0</option><option value="6.5">6.5</option><option value="7.0">7.0</option></select>`;

function addPlayerField(){
  const cont=document.getElementById('reg-player-fields');
  const count=cont.querySelectorAll('.player-row').length;
  if(count>=5){showToast('Max 5 players',true);return;}
  const row=document.createElement('div');row.className='player-row';
  row.innerHTML=`<span class="player-badge">P${count+1}</span><input class="form-input" placeholder="Player ${count+1} name" style="flex:1.4;"><input class="form-input" placeholder="Phone e.g. 9123 4567" style="flex:1;">${NPRP_SELECT}`;
  cont.appendChild(row);
  if(count+1>=5) document.getElementById('add-player-btn').style.display='none';
}

async function registerTeam(){
  if(!isRegistrationOpen()&&!isAdminUser()){
    showToast(`Registration closed ${REGISTRATION_CUTOFF} — contact an admin for late additions`,true);
    return;
  }
  const name=document.getElementById('reg-name').value.trim();
  const email=document.getElementById('reg-email').value.trim();
  const group=document.getElementById('reg-group').value;
  const rows=document.getElementById('reg-player-fields').querySelectorAll('.player-row');
  const players=[...rows].map(row=>{
    const inputs=row.querySelectorAll('input');
    const nprp=row.querySelector('.nprp-select')?.value||null;
    return {pid:uid(), name:inputs[0].value.trim(), phone:inputs[1].value.trim(), nprp, claimCode:genClaimCode(), claimedByEmail:null};
  }).filter(p=>p.name);
  if(!name||!email){showToast('Name and email required',true);return;}
  if(players.length<2){showToast('Minimum 2 players required',true);return;}


  // Capture who is registering this team for admin matching and audit trail
  const currentUser = firebase.auth().currentUser;
  const captainUid   = currentUser ? currentUser.uid   : null;
  const captainEmail = currentUser ? currentUser.email : email;

  const fixturesAlreadyExist=Object.values(S.matches).some(m=>m.group===group&&m.round);
  try {
    const teamId = await TeamsDB.save({
      name, email, group, players,
      captainUid,
      captainEmail,
      createdByUid:   captainUid,
      createdByEmail: captainEmail
    });

    // Auto-create teamMembers record so the registering user is immediately linked
    // as captain of this team. Works for any signed-in user (viewer or captain) —
    // the formal 'captain' role claim is assigned by admin separately, but the
    // team link is created immediately so they can manage the team they registered.
    if(captainUid){
      await MembersDB.set(captainUid, teamId, name, 'captain');
      S.myTeamId = teamId;
      S.isCaptain = true; // treat as captain locally until admin formalises the claim
    }

    addLog(`${name} registered in ${group}`+(fixturesAlreadyExist?' (after fixtures generated — no auto matches)':''),'var(--accent)');
    closeModal('registerModal');
    if(fixturesAlreadyExist){
      showToast(`${name} added — but ${group} fixtures already exist. Schedule their matches manually.`,true);
    } else {
      showToast(`${name} registered!`);
    }
  } catch(err){
    showToast('Failed to register team: ' + err.message, true);
    return;
  }
  document.getElementById('reg-name').value='';document.getElementById('reg-email').value='';
  document.getElementById('reg-player-fields').innerHTML=`<div class="player-row"><span class="player-badge">P1 ★</span><input class="form-input" placeholder="Player 1 name — Captain" style="flex:1.4;"><input class="form-input" placeholder="Phone e.g. 9123 4567" style="flex:1;">${NPRP_SELECT}</div><div class="player-row"><span class="player-badge">P2</span><input class="form-input" placeholder="Player 2 name" style="flex:1.4;"><input class="form-input" placeholder="Phone e.g. 9123 4567" style="flex:1;">${NPRP_SELECT}</div>`;
  document.getElementById('add-player-btn').style.display='';
}

async function scheduleMatch(){
  const group=document.getElementById('sch-group').value;
  const t1=document.getElementById('sch-t1').value;
  const t2=document.getElementById('sch-t2').value;
  const date=document.getElementById('sch-date').value;
  const time=document.getElementById('sch-time').value;
  const court=parseInt(document.getElementById('sch-court').value);
  if(!t1||!t2||t1===t2){showToast('Select two different teams',true);return;}
  const conflict=Object.values(S.matches).find(m=>m.date===date&&m.time===time&&m.court===court);
  if(conflict){
    document.getElementById('sch-conflict').style.display='block';
    document.getElementById('sch-conflict').textContent=`⚠ Court ${court} at ${time} already booked by ${tn(conflict.t1)} vs ${tn(conflict.t2)}`;
    return;
  }
  document.getElementById('sch-conflict').style.display='none';
  try {
    await MatchesDB.save({group,t1,t2,date,time,court,status:'scheduled',scoreData:null,submittedBy:null,notes:''});
    addLog(`Match scheduled: ${tn(t1)} vs ${tn(t2)} (${group}) on ${date}`,'var(--blue)');
    closeModal('scheduleModal');
    showToast('Match scheduled!');
    // renderSchedulePage() not needed — MatchesDB.subscribe onSnapshot fires automatically
  } catch(err){
    showToast('Failed to schedule match: ' + err.message, true);
  }
}

