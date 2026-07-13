// src/render/calendar-strip.js
// Shared monthly calendar strip — used by Events and Tournaments pages.
// ── Monthly calendar strip ────────────────────────────────────────────────────
// Shared by Events and Tournaments public views.
// Usage: renderMonthStrip(containerId, items, selectedMonth, onSelectFn)
// items: [{date:'2026-07-11', ...}] — any array with a date field

function getMonthsInRange(items){
  const now = new Date();

  // Use season config window if available, otherwise use item dates
  const cfgStart = S.config?.leagueStart;
  const cfgEnd   = S.config?.leagueEnd;

  const dates = items.map(i=>i.date).filter(Boolean).sort();

  // Start: earliest of season start, first item, or current month
  const startCandidates = [
    cfgStart ? new Date(cfgStart+'T00:00:00') : null,
    dates.length ? new Date(dates[0]+'T00:00:00') : null,
    now
  ].filter(Boolean);
  const first = new Date(Math.min(...startCandidates));

  // End: latest of season end, last item, or 12 months ahead
  const endCandidates = [
    cfgEnd ? new Date(cfgEnd+'T00:00:00') : null,
    dates.length ? new Date(dates[dates.length-1]+'T00:00:00') : null,
    new Date(now.getFullYear(), now.getMonth()+11, 1)
  ].filter(Boolean);
  const last = new Date(Math.max(...endCandidates));

  const months = [];
  let d = new Date(first.getFullYear(), first.getMonth(), 1);
  while(d <= last){
    months.push({
      key:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: d.toLocaleDateString('en-HK',{month:'short'}),
      year:  d.getFullYear(),
      month: d.getMonth()
    });
    d.setMonth(d.getMonth()+1);
  }
  return months;
}

function renderMonthStrip(items, selectedKey, onSelect){
  const months = getMonthsInRange(items);
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  return `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:16px;
    scrollbar-width:none;-webkit-overflow-scrolling:touch;" id="month-strip">
    ${months.map(m=>{
      const hasItems = items.some(i=>(i.date||'').startsWith(m.key));
      const isSelected = m.key === selectedKey;
      const isCurrent  = m.key === currentKey;
      return `<button onclick="${onSelect}('${m.key}')"
        style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:1px solid
          ${isSelected?'var(--brand)':isCurrent?'var(--muted)':'var(--border)'};
        background:${isSelected?'var(--brand)':'transparent'};
        color:${isSelected?'#fff':hasItems?'var(--text)':'var(--muted)'};
        font-size:12px;font-weight:${isSelected||hasItems?'600':'400'};
        cursor:${hasItems?'pointer':'default'};
        opacity:${hasItems?1:0.4};
        transition:all 0.15s;white-space:nowrap;">
        ${m.label}${isCurrent&&!isSelected?'<span style="display:block;width:4px;height:4px;border-radius:50%;background:var(--accent);margin:1px auto 0;"></span>':''}
      </button>`;
    }).join('')}
  </div>`;
}

function selectedMonthKey(items){
  // Default to the month of the first active/upcoming item, or current month
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const upcoming = items
    .filter(i=>i.date && i.date >= now.toISOString().split('T')[0])
    .sort((a,b)=>a.date.localeCompare(b.date));
  if(upcoming.length){
    const d = upcoming[0].date;
    return d.slice(0,7);
  }
  return currentKey;
}
// Events page — Mexicano, Americano, King of the Court

let S_eventDetail = null; // currently viewed event
let S_eventRounds = [];   // loaded rounds for current event
