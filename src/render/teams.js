// src/render/teams.js
// Teams/roster listing page + NPRP division seeding.

// ── NPRP Seeding helpers ──────────────────────────────────────────────────────
// 2-player teams: top 2. 3+ player teams: top 3.
// Division thresholds read from S.config.divisions (ordered highest tier first).

function teamSeedAvg(team){
  const players = team.players || [];
  const ratings = players
    .map(p => parseFloat(p.nprp))
    .filter(n => !isNaN(n) && n > 0)
    .sort((a,b) => b - a);
  if(!ratings.length) return null;
  const topN = players.length <= 2 ? 2 : 3;
  const slice = ratings.slice(0, topN);
  return slice.reduce((a,b) => a+b, 0) / slice.length;
}

function suggestedDivision(avg){
  if(avg === null) return null;
  const divs = S.config?.divisions;
  if(divs && divs.length){
    for(const d of divs){
      if(avg >= d.nprpMin) return d.name;
    }
    return divs[divs.length-1].name;
  }
  // Fallback if config not loaded
  if(avg >= 4.0) return 'Gold Division';
  if(avg >= 3.0) return 'High Silver Division';
  return 'Low Silver Division';
}

function renderNPRPSeedingPanel(){
  const teams = Object.values(S.teams).filter(t => t.season === ACTIVE_SEASON);
  if(!teams.length) return '';

  const divs = S.config?.divisions || [];
  const thresholdNote = divs.length
    ? divs.map(d => `${d.name.replace(' Division','')} ≥${d.nprpMin}`).join(' · ')
    : 'Gold ≥4.0 · High Silver ≥3.0 · Low Silver <3.0';

  const rows = teams.map(t => {
    const avg = teamSeedAvg(t);
    const suggested = suggestedDivision(avg);
    const current = t.group || 'Unassigned';
    const mismatch = suggested && current !== 'Unassigned' && current !== suggested;
    return { t, avg, suggested, current, mismatch, noRatings: avg === null };
  }).sort((a,b) => (b.avg||0) - (a.avg||0));

  const mismatches = rows.filter(r => r.mismatch).length;
  const unrated = rows.filter(r => r.noRatings).length;

  return `<div class="card" style="margin-bottom:16px;border:1px solid var(--brand);">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
      <div>
        <div style="font-weight:700;font-size:14px;color:var(--brand);">🎯 NPRP Division Seeding</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">
          Top 2 players (2-player teams) · Top 3 players (3+ players) · ${thresholdNote}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="applyNPRPSeeding(false)">⚡ Assign Unassigned</button>
        <button class="btn btn-ghost btn-sm" onclick="applyNPRPSeeding(true)">↺ Re-seed All</button>
      </div>
    </div>
    ${mismatches ? `<div style="font-size:11px;color:var(--warn);margin-bottom:8px;">⚠ ${mismatches} team${mismatches!==1?'s':''} in a division that doesn't match their NPRP average.</div>` : ''}
    ${unrated ? `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;">⚬ ${unrated} team${unrated!==1?'s':''} have no OPLR ratings — cannot be auto-seeded.</div>` : ''}
    <div style="overflow-x:auto;">
      <table style="width:100%;font-size:11px;">
        <thead>
          <tr style="color:var(--muted);text-align:left;">
            <th style="padding:4px 8px;">Team</th>
            <th style="padding:4px 8px;">Top players (NPRP)</th>
            <th style="padding:4px 8px;">Seed Avg</th>
            <th style="padding:4px 8px;">Suggested</th>
            <th style="padding:4px 8px;">Current</th>
            <th style="padding:4px 8px;"></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(({t, avg, suggested, current, mismatch, noRatings}) => {
            const players = t.players || [];
            const topN = players.length <= 2 ? 2 : 3;
            const ratedPlayers = [...players]
              .filter(p => !isNaN(parseFloat(p.nprp)) && parseFloat(p.nprp) > 0)
              .sort((a,b) => parseFloat(b.nprp) - parseFloat(a.nprp))
              .slice(0, topN);
            const playerStr = ratedPlayers.map(p => `${p.name||'?'} (${p.nprp})`).join(', ') || '—';
            const divColor = !suggested ? 'var(--muted)'
              : (S.config?.divisions||[]).findIndex(d=>d.name===suggested) === 0 ? 'var(--gold)'
              : 'var(--brand)';
            return `<tr style="border-top:1px solid var(--border);${mismatch?'background:rgba(248,113,113,0.04)':''}">
              <td style="padding:6px 8px;font-weight:600;">${t.name}</td>
              <td style="padding:6px 8px;color:var(--muted);">${playerStr}</td>
              <td style="padding:6px 8px;font-family:'Space Mono',monospace;font-weight:700;color:var(--brand);">${avg!==null?avg.toFixed(2):'—'}</td>
              <td style="padding:6px 8px;color:${divColor};font-weight:600;">${suggested||'—'}</td>
              <td style="padding:6px 8px;color:${mismatch?'var(--red)':'var(--muted)'};">${current}${mismatch?' ⚠':''}</td>
              <td style="padding:6px 8px;">
                ${suggested && suggested!==current
                  ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;white-space:nowrap;" onclick="assignDivisionDirect('${t.id}','${suggested}')">→ ${suggested.replace(' Division','')}</button>`
                  : suggested===current
                    ? `<span style="color:var(--accent);font-size:10px;">✓</span>`
                    : `<span style="color:var(--muted);font-size:10px;">no data</span>`
                }
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function assignDivisionDirect(teamId, division){
  try {
    await TeamsDB.update(teamId, { group: division });
    showToast(`→ ${division}`);
  } catch(err){ showToast('Failed: ' + err.message, true); }
}

async function applyNPRPSeeding(reseedAll=false){
  const teams = Object.values(S.teams).filter(t => t.season === ACTIVE_SEASON);
  const toUpdate = teams.filter(t => {
    const avg = teamSeedAvg(t);
    const suggested = suggestedDivision(avg);
    if(!suggested) return false;
    if(reseedAll) return suggested !== t.group;
    return t.group === 'Unassigned';
  });

  if(!toUpdate.length){
    showToast(reseedAll ? 'All rated teams already in correct division' : 'No unassigned teams with OPLR ratings');
    return;
  }

  const label = reseedAll ? 'Re-seed ALL teams' : `Auto-assign ${toUpdate.length} unassigned team${toUpdate.length!==1?'s':''}`;
  const preview = toUpdate.map(t => {
    const avg = teamSeedAvg(t);
    return `${t.name} (avg ${avg.toFixed(2)}) → ${suggestedDivision(avg)}`;
  }).join('\n');

  if(!confirm(`${label}?\n\nYou can override any assignment individually after this runs.\n\n${preview}`)) return;

  let count = 0;
  for(const t of toUpdate){
    await TeamsDB.update(t.id, { group: suggestedDivision(teamSeedAvg(t)) });
    count++;
  }
  showToast(`${count} team${count!==1?'s':''} assigned`);
}

// ── Teams page ────────────────────────────────────────────────────────────────

function renderTeamsPage(){
  if(isAdminUser()){
    const panel = document.getElementById('nprp-seeding-panel');
    if(panel) panel.innerHTML = renderNPRPSeedingPanel();
  }
  const unassigned = Object.values(S.teams).filter(t => t.group === 'Unassigned' && t.season === ACTIVE_SEASON);
  const container  = document.getElementById('teams-container');
  if(isAdminUser() && unassigned.length){
    container.innerHTML = `<div class="alert alert-warn" style="margin-bottom:16px;">
      ⚠ ${unassigned.length} team${unassigned.length!==1?'s':''} awaiting division assignment:
      ${unassigned.map(t=>`<strong>${t.name}</strong>`).join(', ')}
    </div>`;
  }
  buildGroupTabs('teams-group-tabs','curTeamsGroup','setTeamsGroup');
  if(S.curTeamsGroup) renderTeamsList(S.curTeamsGroup);
}

function setTeamsGroup(g,el){ setGroup('curTeamsGroup',g,el,renderTeamsList); }
function canEditRoster(team){ return isAdminUser() || (isCaptainUser() && S.myTeamId===team.id); }

function renderTeamsList(group){
  const teams = teamsByGroup(group);
  const container = document.getElementById('teams-container');
  if(!teams.length){ container.innerHTML='<div style="color:var(--muted);font-size:13px;">No teams in this group.</div>'; return; }
  const showPhones = isAdminUser();
  const DIVISIONS  = getDivisions();

  container.innerHTML = teams.map(t => {
    const editable = canEditRoster(t);
    const needsDivision = isAdminUser() && t.group === 'Unassigned';
    const avg = teamSeedAvg(t);
    const suggested = suggestedDivision(avg);
    const mismatch = suggested && t.group !== 'Unassigned' && t.group !== suggested;
    return `<div class="card" style="border-left:3px solid ${needsDivision?'var(--warn)':mismatch?'var(--red)':'var(--accent)'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">
        <div>
          <div style="font-weight:700;font-size:15px;">${t.name}</div>
          ${mismatch?`<div style="font-size:10px;color:var(--red);">⚠ NPRP suggests ${suggested}</div>`:''}
          ${t.captainEmail?`<div style="font-size:10px;color:var(--muted);">Registered by: ${t.captainEmail}</div>`:''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${isAdminUser()?`
            <select class="form-select" id="div-sel-${t.id}" style="font-size:11px;padding:4px 8px;width:170px;">
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
        return `<div style="font-size:12px;color:var(--muted);margin-bottom:2px;">👤 ${p.name||p}${i===0?' <span style="font-size:9px;color:var(--accent);background:rgba(74,222,128,0.1);padding:1px 5px;border-radius:8px;">cap</span>':''}${showPhones&&p.phone?` <span style="color:var(--muted);">· ${p.phone}</span>`:''}${(showPhones||canEditRoster(t))&&p.nprp?` <span style="font-size:9px;color:var(--brand);font-weight:600;">OPLR ${p.nprp}</span>`:''} ${claimBadge}</div>`;
      }).join('')}</div>
      <div style="font-size:11px;color:var(--muted);">📧 ${t.email} &nbsp;·&nbsp; <span style="color:var(--accent);">${(t.players||[]).length}p</span>${avg!==null?` &nbsp;·&nbsp; <span style="color:var(--brand);">seed avg ${avg.toFixed(2)}</span>`:''}${showPhones?' &nbsp;·&nbsp; <span style="color:var(--gold);">📱 phones visible (admin)</span>':''}</div>
    </div>`;
  }).join('');
}

async function assignDivision(teamId){
  const division = document.getElementById(`div-sel-${teamId}`)?.value;
  if(!division){ showToast('Select a division first', true); return; }
  const team = S.teams[teamId];
  const currentGroup = team?.group;
  const isMove = currentGroup && currentGroup !== 'Unassigned' && currentGroup !== division;

  if(isMove){
    const orphanedFixtures = Object.values(S.matches).filter(m =>
      m.season === ACTIVE_SEASON && m.group === currentGroup &&
      (m.teamA === teamId || m.teamB === teamId)
    );
    if(orphanedFixtures.length > 0){
      const played = orphanedFixtures.filter(m => m.status === 'confirmed' || m.status === 'pending').length;
      const warning = [
        `⚠ DIVISION MOVE WARNING`,``,
        `Moving "${team.name}" from ${currentGroup} → ${division}`,
        `will ORPHAN ${orphanedFixtures.length} fixture${orphanedFixtures.length!==1?'s':''} in ${currentGroup}`,
        played > 0 ? `(${played} already played or pending confirmation).` : `(none played yet).`,``,
        `These matches remain in Firestore tagged to ${currentGroup} but won't appear in the new division.`,``,
        `Proceed anyway?`
      ].join('\n');
      if(!confirm(warning)) return;
    }
  }
  try {
    await TeamsDB.update(teamId, { group: division });
    showToast(`Division ${isMove?'changed':'assigned'}: ${division}`);
    const snap = await db.collection('teamMembers')
      .where('season','==',ACTIVE_SEASON).where('teamId','==',teamId).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { teamName: S.teams[teamId]?.name||'' }));
    if(!snap.empty) await batch.commit();
  } catch(err){ showToast('Failed: ' + err.message, true); }
}
