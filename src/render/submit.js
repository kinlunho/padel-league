// src/render/submit.js
// Submit/Confirm Score hub page, including the disputes section.

// ════════ SUBMIT PAGE ════════
function renderSubmitPage(){
  const container=document.getElementById('submit-container');
  const all=Object.values(S.matches);
  const disputed=all.filter(m=>m.status==='disputed');
  const pending=all.filter(m=>m.status==='scheduled'||m.status==='pending-confirm');

  if(!pending.length&&!disputed.length){container.innerHTML='<div class="alert alert-success">✓ All scores submitted and confirmed.</div>';return;}

  let html='';

  // Disputes surface first, across all divisions in one place — this is the one page meant
  // to answer "what needs attention", so a stuck dispute belongs at the top of it, not buried
  // in whichever division's Matches tab someone happens to click into.
  if(disputed.length){
    html+=`<div class="alert alert-warn" style="border-color:rgba(248,113,113,0.3);background:rgba(248,113,113,0.08);color:var(--red);margin-bottom:16px;">⚖ ${disputed.length} disputed match${disputed.length!==1?'es':''} awaiting admin resolution.</div>`;
    disputed.forEach(m=>{
      html+=`<div class="card" style="border-left:3px solid var(--red);margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-weight:600;font-size:13px;margin-bottom:3px;">${tn(m.t1)} <span style="color:var(--muted)">vs</span> ${tn(m.t2)} <span class="chip chip-dispute" style="margin-left:6px;">DISPUTED</span></div>
            <div style="font-size:11px;color:var(--muted);">📅 ${m.date} · ${m.time} · Court ${m.court} · ${m.group}</div>
            ${m.scoreData?`<div style="font-size:11px;color:var(--red);margin-top:4px;">Last submitted: ${scoreDisplay(m)}</div>`:''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${isAdminUser()
              ?`<button class="btn btn-danger btn-sm" onclick="openDisputeResolve('${m.id}')">⚖ Resolve Dispute</button>`
              :`<span style="font-size:11px;color:var(--muted);">Under review by admin</span>`
            }
          </div>
        </div>
      </div>`;
    });
  }

  const byGroup={};
  pending.forEach(m=>{if(!byGroup[m.group])byGroup[m.group]=[];byGroup[m.group].push(m);});
  if(all.filter(m=>m.status==='pending-confirm').length) html+=`<div class="alert alert-warn" style="margin-bottom:16px;margin-top:${disputed.length?'20px':'0'};">⚠ Some scores are pending opponent confirmation.</div>`;
  Object.entries(byGroup).forEach(([g,ms])=>{
    html+=`<div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;margin-top:16px;">${g}</div>`;
    ms.forEach(m=>{
      const isPend=m.status==='pending-confirm';
      const sd=m.scoreData;
      html+=`<div class="card" style="border-left:3px solid ${isPend?'var(--warn)':'var(--muted)'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-weight:600;font-size:13px;margin-bottom:3px;">${tn(m.t1)} <span style="color:var(--muted)">vs</span> ${tn(m.t2)}</div>
            <div style="font-size:11px;color:var(--muted);">📅 ${m.date} · ${m.time} · Court ${m.court}</div>
            ${isPend&&sd?`<div style="font-size:11px;color:var(--warn);margin-top:4px;">Submitted by ${tn(m.submittedBy)}: ${scoreDisplay(m)} — awaiting confirmation</div>`:''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${!canActOnMatch(m)?`<span style="font-size:11px;color:var(--muted);">👁 View only</span>`:isPend
              ?(isSubmitter(m)?`<span style="font-size:11px;color:var(--warn);">Waiting on the other captain</span>`:`<button class="btn btn-primary btn-sm" onclick="confirmScore('${m.id}')">✓ Confirm</button><button class="btn btn-danger btn-sm" onclick="disputeScore('${m.id}')">✗ Dispute</button>`)
              :`<button class="btn btn-primary btn-sm" onclick="openScoreModal('${m.id}')">Submit Score</button><button class="btn btn-ghost btn-sm" onclick="openReschedule('${m.id}')">Reschedule</button>`
            }
          </div>
        </div>
      </div>`;
    });
  });
  container.innerHTML=html;
}

// ════════ KNOCKOUT PAGE ════════
