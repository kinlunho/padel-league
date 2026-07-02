// src/render/teams.js
// Teams/roster listing page.

// ════════ TEAMS PAGE ════════
function renderTeamsPage(){
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
  container.innerHTML=teams.map(t=>{
    const editable=canEditRoster(t);
    return `
    <div class="card" style="border-left:3px solid var(--accent)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">
        <div style="font-weight:700;font-size:15px;">${t.name}</div>
        ${editable?`<button class="btn btn-ghost btn-sm" onclick="openRosterEdit('${t.id}')">✎ Edit Roster</button>`:''}
      </div>
      <div style="margin-bottom:8px;">${(t.players||[]).map((p,i)=>{
        const claimed=p.claimedByEmail;
        const claimBadge=claimed?`<span style="font-size:9px;color:var(--accent);">✓ linked</span>`:(isAdminUser()?`<span style="font-size:9px;color:var(--muted);font-family:'Space Mono',monospace;">code: ${p.claimCode||'—'}</span>`:'');
        return `<div style="font-size:12px;color:var(--muted);margin-bottom:2px;">👤 ${p.name||p}${i===0?' <span style="font-size:9px;color:var(--accent);background:rgba(74,222,128,0.1);padding:1px 5px;border-radius:8px;">cap</span>':''}${showPhones&&p.phone?` <span style="color:var(--muted);">· ${p.phone}</span>`:''} ${claimBadge}</div>`;
      }).join('')}</div>
      <div style="font-size:11px;color:var(--muted);">📧 ${t.email} &nbsp;·&nbsp; <span style="color:var(--accent);">${(t.players||[]).length}p</span>${showPhones?' &nbsp;·&nbsp; <span style="color:var(--gold);">📱 phones visible (admin)</span>':''}</div>
    </div>`;
  }).join('');
}

