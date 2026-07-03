// src/render/teams.js
// Teams/roster listing page.

// ════════ TEAMS PAGE ════════
function renderTeamsPage(){
  // Show unassigned teams banner for admin
  const unassigned = Object.values(S.teams).filter(t => t.group === 'Unassigned');
  const container  = document.getElementById('teams-container');

  if(isAdminUser() && unassigned.length){
    const banner = `<div class="alert alert-warn" style="margin-bottom:16px;">
      ⚠ ${unassigned.length} team${unassigned.length!==1?'s':''} awaiting division assignment:
      ${unassigned.map(t=>`<strong>${t.name}</strong> (${t.captainEmail||'no email'})`).join(', ')}
      — assign them below or from the Teams tab.
    </div>`;
    container.innerHTML = banner;
  }

  buildGroupTabs('teams-group-tabs','curTeamsGroup','setTeamsGroup');
  if(S.curTeamsGroup) renderTeamsList(S.curTeamsGroup);
}
function setTeamsGroup(g,el){setGroup('curTeamsGroup',g,el,renderTeamsList);}
function canEditRoster(team){
  return isAdminUser() || (isCaptainUser() && S.myTeamId===team.id);
}
function renderTeamsList(group){
  const teams=teamsByGroup(group);
  const container=document.getElementById('teams-container');
  if(!teams.length){container.innerHTML='<div style="color:var(--muted);font-size:13px;">No teams in this group.</div>';return;}
  const showPhones=isAdminUser();
  const DIVISIONS = ['Gold Division','High Silver Division','Low Silver Division'];
  container.innerHTML=teams.map(t=>{
    const editable=canEditRoster(t);
    const needsDivision = isAdminUser() && t.group === 'Unassigned';
    return `
    <div class="card" style="border-left:3px solid ${needsDivision?'var(--warn)':'var(--accent)'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">
        <div>
          <div style="font-weight:700;font-size:15px;">${t.name}</div>
          ${t.captainEmail?`<div style="font-size:10px;color:var(--muted);">Registered by: ${t.captainEmail}</div>`:''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${isAdminUser()?`
            <select class="form-select" id="div-sel-${t.id}" style="font-size:11px;padding:4px 8px;width:160px;">
              ${DIVISIONS.map(d=>`<option value="${d}"${d===t.group?' selected':''}>${d}</option>`).join('')}
            </select>
            <button class="btn btn-${t.group==='Unassigned'?'primary':'ghost'} btn-sm" onclick="assignDivision('${t.id}')">${t.group==='Unassigned'?'Assign':'Move'}</button>
            <button class="btn btn-danger btn-sm" onclick="adminDeleteTeam('${t.id}','${t.name.replace(/'/g,"\\'")}')">Delete</button>`:''}
          ${editable?`<button class="btn btn-ghost btn-sm" onclick="openRosterEdit('${t.id}')">✎ Edit Roster</button>`:''}
        </div>
      </div>
      <div style="margin-bottom:8px;">${(t.players||[]).map((p,i)=>{
        const claimed=p.claimedByEmail;
        const claimBadge=claimed?`<span style="font-size:9px;color:var(--accent);">✓ linked</span>`:(isAdminUser()?`<span style="font-size:9px;color:var(--muted);font-family:'Space Mono',monospace;">code: ${p.claimCode||'—'}</span>`:'');
        return `<div style="font-size:12px;color:var(--muted);margin-bottom:2px;">👤 ${p.name||p}${i===0?' <span style="font-size:9px;color:var(--accent);background:rgba(74,222,128,0.1);padding:1px 5px;border-radius:8px;">cap</span>':''}${showPhones&&p.phone?` <span style="color:var(--muted);">· ${p.phone}</span>`:''}${(showPhones||canEditRoster(t))&&p.nprp?` <span style="font-size:9px;color:var(--brand);font-weight:600;">NPRP ${p.nprp}</span>`:''} ${claimBadge}</div>`;
      }).join('')}</div>
      <div style="font-size:11px;color:var(--muted);">📧 ${t.email} &nbsp;·&nbsp; <span style="color:var(--accent);">${(t.players||[]).length}p</span>${showPhones?' &nbsp;·&nbsp; <span style="color:var(--gold);">📱 phones visible (admin)</span>':''}${(()=>{const ratings=(t.players||[]).map(p=>parseFloat(p.nprp)).filter(n=>!isNaN(n));return ratings.length?` &nbsp;·&nbsp; <span style="color:var(--brand);">avg NPRP ${(ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1)}</span>`:'';})()} </div>
    </div>`;
  }).join('');
}

async function assignDivision(teamId){
  const division = document.getElementById(`div-sel-${teamId}`)?.value;
  if(!division){ showToast('Select a division first', true); return; }
  try {
    await TeamsDB.update(teamId, { group: division });
    showToast(`Division assigned: ${division}`);
    // Also update the teamMembers record if one exists
    const snap = await db.collection('teamMembers')
      .where('season','==',ACTIVE_SEASON)
      .where('teamId','==',teamId).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { teamName: S.teams[teamId]?.name || '' }));
    if(!snap.empty) await batch.commit();
  } catch(err){ showToast('Failed: ' + err.message, true); }
}
