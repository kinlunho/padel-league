// src/render/schedule.js
// Court schedule page: week tabs and the two-court grid view.

// ════════ SCHEDULE PAGE ════════
function renderSchedulePage(){
  const dates=leagueDates();
  const tabsEl=document.getElementById('week-tabs');
  const weeks=[];let cur=[];
  dates.forEach(d=>{cur.push(d);if(cur.length===2){weeks.push([...cur]);cur=[];}});
  if(cur.length) weeks.push(cur);
  S.scheduleWeeks=weeks; // stored so onclick can reference by safe integer index, not inline JSON
  if(!S.selectedDate&&dates.length) S.selectedDate=dates[0];
  tabsEl.innerHTML=weeks.slice(0,14).map((w,i)=>{
    const label=w.map(d=>new Date(d+'T00:00:00').toLocaleDateString('en-HK',{month:'short',day:'numeric'})).join(' & ');
    const isActive=w.includes(S.selectedDate);
    return `<button class="group-tab ${isActive?'active':''}" style="font-size:11px;padding:5px 14px;" onclick="selectWeek(${i},this)">${label}</button>`;
  }).join('');
  renderCourtView();
}
function selectWeek(weekIndex,el){
  const dates=S.scheduleWeeks[weekIndex];
  if(!dates) return;
  S.selectedDate=dates[0];
  document.querySelectorAll('#week-tabs .group-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderCourtView();
}
function renderCourtView(){
  const dates=leagueDates();
  const idx=dates.indexOf(S.selectedDate);
  const daysToShow=[];
  if(idx!==-1) daysToShow.push(dates[idx]);
  if(dates[idx+1]) daysToShow.push(dates[idx+1]);
  const container=document.getElementById('court-schedule');
  let html='';
  daysToShow.forEach(date=>{
    const dayLabel=new Date(date+'T00:00:00').toLocaleDateString('en-HK',{weekday:'long',month:'long',day:'numeric'});
    [1,2].forEach(court=>{
      html+=`<div class="court-card"><div class="court-hdr">Court ${court} · ${dayLabel}</div>`;
      TIMES.forEach(t=>{
        const match=Object.values(S.matches).find(m=>m.date===date&&m.time===t&&parseInt(m.court)===court);
        if(match){
          const chipCls=match.status==='confirmed'?'chip-done':match.status==='pending-confirm'?'chip-confirm':match.status==='disputed'?'chip-dispute':'chip-pending';
          const chipTxt=match.status==='confirmed'?'DONE':match.status==='pending-confirm'?'CONFIRM':match.status==='disputed'?'DISPUTED':'SCHED';
          // Only scheduled/pending-confirm matches make sense to reschedule from here — a
          // confirmed match already happened, and a disputed one needs admin resolution
          // (Submit Score page), not a reschedule.
          const reschedulable=(match.status==='scheduled'||match.status==='pending-confirm')&&canActOnMatch(match);
          html+=`<div class="slot booked" ${reschedulable?`style="cursor:pointer;" onclick="openReschedule('${match.id}')" title="Click to reschedule"`:''}><div><div style="font-weight:600;font-size:11px;margin-bottom:2px;">${tn(match.t1)} <span style="color:var(--muted)">vs</span> ${tn(match.t2)}</div>
            <div style="display:flex;gap:6px;align-items:center;"><span style="font-size:9px;color:var(--muted);">${match.group}</span><span class="chip ${chipCls}" style="font-size:9px;padding:1px 6px;">${chipTxt}</span>${reschedulable?'<span style="font-size:9px;color:var(--brand);">✎ click to reschedule</span>':''}</div></div>
            <div class="slot-time">${t}</div></div>`;
        } else {
          const clickable=canWrite();
          html+=`<div class="slot empty" ${clickable?`style="cursor:pointer;" onclick="openQuickSchedule('${date}','${t}',${court})"`:''}><span>Available</span><div class="slot-time">${t}</div></div>`;
        }
      });
      html+='</div>';
    });
  });
  container.innerHTML=html||'<div style="color:var(--muted);">No dates available.</div>';
}

