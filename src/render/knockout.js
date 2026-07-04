// src/render/knockout.js
// Per-division Champions Knockout + Phoenix Cup.
// Each division runs two completely independent competitions:
//   Champions KO — top 4 from group stage round-robin → top 2 play Final
//   Phoenix Cup  — 5th place and below → top 2 play Final (empty if < 5 teams)
// No cross-division matches. No promotion/relegation.

// ── Helpers ───────────────────────────────────────────────────────────────────

function divSlug(g){ return g.replace(/[^a-zA-Z0-9]/g,'').toLowerCase(); }

function koKey(div, phase){ return `${divSlug(div)}_${phase}`; }

// Ensure S.knockout has a slot for this division+phase
function ensureKO(div, phase){
  const k = koKey(div, phase);
  if(!S.knockout[k]){
    S.knockout[k] = { final:{ t1:null, t2:null, scoreData:null, winner:null, loser:null } };
  }
  return S.knockout[k];
}

// Round-robin standings within a KO pool (uses koPhase field on matches)
function koStandings(teamIds, phase){
  const st = {};
  teamIds.forEach(id => { st[id] = {id, name:tn(id), p:0, w:0, d:0, l:0, gw:0, gl:0, pts:0}; });
  Object.values(S.matches)
    .filter(m => m.koPhase === phase && m.status === 'confirmed' && m.scoreData)
    .forEach(m => {
      if(!st[m.t1] || !st[m.t2]) return;
      const r = calcResult(m.scoreData);
      if(!r) return;
      st[m.t1].p++; st[m.t2].p++;
      st[m.t1].gw += r.gw1; st[m.t1].gl += r.gw2;
      st[m.t2].gw += r.gw2; st[m.t2].gl += r.gw1;
      if(r.result==='win1'){ st[m.t1].w++; st[m.t1].pts+=3; st[m.t2].l++; }
      else if(r.result==='win2'){ st[m.t2].w++; st[m.t2].pts+=3; st[m.t1].l++; }
      else { st[m.t1].d++; st[m.t1].pts++; st[m.t2].d++; st[m.t2].pts++; }
    });
  return Object.values(st).sort((a,b) =>
    b.pts - a.pts || (b.gw-b.gl) - (a.gw-a.gl) || b.gw - a.gw
  );
}

// ── Bracket renderer ──────────────────────────────────────────────────────────

function renderKOBracket(div, phase, teamIds, title, color){
  const slug  = divSlug(div);
  const pKey  = koKey(div, phase);       // e.g. "golddivision_champ"
  const ko    = ensureKO(div, phase);
  const fin   = ko.final;

  if(!teamIds.length){
    return `<div style="color:var(--muted);font-size:12px;padding:8px 0 16px;">
      No teams in ${title} — all teams qualify for Champions Knockout.
    </div>`;
  }

  const st   = koStandings(teamIds, pKey);
  const top2 = st.slice(0,2);

  // Auto-promote top 2 to final once they have played
  if(top2.length===2 && top2[0].p > 0 && !fin.t1){
    fin.t1 = top2[0].id;
    fin.t2 = top2[1].id;
  }

  // Standings table
  const tableRows = st.map((r,i) => `
    <tr ${i<2 ? `style="background:rgba(74,222,128,0.03)"` : ''}>
      <td><span style="font-family:'Space Mono',monospace;font-weight:700;${i<2?'color:var(--accent)':'color:var(--muted)'}">${i+1}</span></td>
      <td><strong>${r.name}</strong>${i<2 ? ` <span style="font-size:9px;color:var(--accent);">→ Final</span>` : ''}</td>
      <td>${r.p}</td><td style="color:var(--accent)">${r.w}</td>
      <td style="color:var(--blue)">${r.d}</td><td style="color:var(--red)">${r.l}</td>
      <td style="color:${(r.gw-r.gl)>=0?'var(--accent)':'var(--red)'};">${r.gw-r.gl>=0?'+':''}${r.gw-r.gl}</td>
      <td style="font-family:'Space Mono',monospace;font-weight:700;color:${color}">${r.pts}</td>
    </tr>`).join('');

  // Final card
  const canSubmitFinal = isAdminUser() ||
    (isCaptainUser() && fin.t1 && fin.t2 &&
      (fin.t1 === S.myTeamId || fin.t2 === S.myTeamId));

  const finalHtml = `
    <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 8px;">🏁 Final</div>
    <div class="bm ${fin.winner?'done':''}">
      <div class="bm-label">${title} Final</div>
      <div class="bm-team ${fin.winner===fin.t1?'winner':fin.winner&&fin.winner!==fin.t1?'loser':''} ${!fin.t1?'tbd':''}">
        ${fin.t1 ? tn(fin.t1) : 'Awaiting round-robin'}
        ${fin.winner===fin.t1 ? '<span class="bm-score">🏆</span>' : ''}
      </div>
      <div class="bm-team ${fin.winner===fin.t2?'winner':fin.winner&&fin.winner!==fin.t2?'loser':''} ${!fin.t2?'tbd':''}">
        ${fin.t2 ? tn(fin.t2) : 'Awaiting round-robin'}
        ${fin.winner===fin.t2 ? '<span class="bm-score">🏆</span>' : ''}
      </div>
      ${fin.scoreData ? `<div style="font-size:11px;color:var(--muted);margin-top:6px;font-family:'Space Mono',monospace;">${scoreDisplay({scoreData:fin.scoreData})}</div>` : ''}
      ${fin.t1 && fin.t2 && !fin.winner
        ? canSubmitFinal
          ? `<div class="bm-actions"><button class="btn btn-primary btn-sm" onclick="openKOFinalScore('${pKey}')">Submit Final Result</button></div>`
          : `<div class="bm-actions" style="font-size:11px;color:var(--muted);text-align:center;">👁 View only</div>`
        : ''}
    </div>`;

  return `
    <div style="margin-bottom:28px;">
      <div style="font-size:13px;font-weight:700;color:${color};margin-bottom:10px;display:flex;align-items:center;gap:8px;">
        ${title}
        <span style="font-size:10px;color:var(--muted);font-weight:400;">${teamIds.length} team${teamIds.length!==1?'s':''}</span>
      </div>
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:8px;">
        <table>
          <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      ${finalHtml}
    </div>`;
}

// ── Main page render ──────────────────────────────────────────────────────────

function renderKnockoutPage(){
  const container = document.getElementById('knockout-container');
  const statusEl  = document.getElementById('knockout-status');
  const divs = groups().filter(g => g !== 'Unassigned');

  const anyConfirmed = Object.values(S.matches).some(m => m.status === 'confirmed');
  if(!anyConfirmed || divs.length === 0){
    statusEl.style.display = 'block';
    statusEl.textContent = 'Group stage in progress — knockout brackets will appear once matches are confirmed.';
    container.innerHTML = '';
    return;
  }
  statusEl.style.display = 'none';

  // Build per-division sections
  container.innerHTML = divs.map(div => {
    const st       = getStandings(div);
    const champIds = st.slice(0,4).map(t => t.id);
    const phoenixIds = st.slice(4).map(t => t.id);

    const champHtml  = renderKOBracket(div, 'champ',  champIds,  '🏆 Champions Knockout', 'var(--gold)');
    const phoenixHtml = phoenixIds.length
      ? renderKOBracket(div, 'phoenix', phoenixIds, '🦅 Phoenix Cup', 'var(--warn)')
      : `<div style="color:var(--muted);font-size:12px;padding:4px 0 12px;font-style:italic;">
           Phoenix Cup — no teams (all teams qualified for Champions Knockout)
         </div>`;

    return `
      <div style="margin-bottom:36px;">
        <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:16px;
                    padding-bottom:8px;border-bottom:1px solid var(--border);">
          ${div}
        </div>
        ${champHtml}
        <div style="margin:4px 0 16px;padding:0 0 0 0;">
          ${phoenixHtml}
        </div>
      </div>`;
  }).join('');
}

// ── Final score modal ─────────────────────────────────────────────────────────

let editingKO = null;

function openKOFinalScore(pKey){
  editingKO = pKey;
  const ko  = S.knockout[pKey];
  if(!ko){ showToast('Bracket not found', true); return; }
  const fin = ko.final;
  const label = pKey.includes('_champ') ? 'Champions Final' : 'Phoenix Cup Final';
  document.getElementById('score-modal-title').textContent = label;
  document.getElementById('score-match-info').innerHTML =
    `<strong>${tn(fin.t1)}</strong> vs <strong>${tn(fin.t2)}</strong>`;
  ['a','b','c','g'].forEach(s => {
    const e1 = document.getElementById('sc-lbl-t1'+s);
    const e2 = document.getElementById('sc-lbl-t2'+s);
    if(e1) e1.textContent = tn(fin.t1);
    if(e2) e2.textContent = tn(fin.t2);
  });
  S.editMatchId = null;
  document.getElementById('sc-games-only').checked = false;
  toggleGamesMode();
  updateScorePreview();
  openModal('scoreModal');
}
