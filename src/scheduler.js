// src/scheduler.js
// League schedule suggestion engine.
//
// Given: fixtures (team pairs), config (courts, times, play days, blackouts)
// Produces: proposed {matchId, date, time, court} assignments
//
// Constraints:
//   1. Each team plays at most once per weekend (Sat+Sun combined)
//   2. No matches on blackout dates
//   3. Matches fit within matchStartTime–matchEndTime window
//   4. Court capacity: floor((endHour - startHour) / matchDuration) matches per court per night
//   5. Divisions share courts

function buildSchedule(fixtures, config){
  const {
    leagueStart     = '2026-07-11',
    leagueEnd       = '2026-09-27',
    matchStartTime  = '19:00',
    matchEndTime    = '23:00',
    matchDuration   = 60,        // minutes
    courts          = 2,
    playDays        = [6, 0],    // Saturday=6, Sunday=0
    blackoutDates   = []
  } = config;

  // ── Build ordered list of available match nights ──────────────────────────
  const blackoutSet = new Set(
    blackoutDates.map(bd => typeof bd==='string' ? bd : bd.date)
  );

  const startH = parseInt(matchStartTime.split(':')[0]);
  const endH   = parseInt(matchEndTime.split(':')[0]);
  const slotsPerCourt = Math.floor((endH - startH) * 60 / matchDuration);
  const slotsPerNight = courts * slotsPerCourt;

  // Generate all valid play nights between start and end
  const nights = [];
  let d = new Date(leagueStart + 'T00:00:00');
  const endDate = new Date(leagueEnd + 'T00:00:00');

  while(d <= endDate){
    if(playDays.includes(d.getDay())){
      const dateStr = d.toISOString().split('T')[0];
      if(!blackoutSet.has(dateStr)){
        nights.push({
          date:    dateStr,
          day:     d.getDay(),
          weekend: getWeekendKey(d),
          slots:   slotsPerNight
        });
      }
    }
    d.setDate(d.getDate() + 1);
  }

  // ── Group nights by weekend ───────────────────────────────────────────────
  const weekendNights = {};
  nights.forEach(n=>{
    if(!weekendNights[n.weekend]) weekendNights[n.weekend] = [];
    weekendNights[n.weekend].push(n);
  });
  const weekends = Object.values(weekendNights).sort((a,b)=>a[0].date.localeCompare(b[0].date));

  // ── Schedule fixtures ─────────────────────────────────────────────────────
  // State: which teams have played this weekend
  const scheduled  = [];
  const unscheduled = [...fixtures];

  for(const weekend of weekends){
    const teamsThisWeekend = new Set();

    for(const night of weekend){
      let slotsLeft = night.slots;
      let courtIdx  = 1;
      let slotIdx   = 0; // slot within the night (determines time)

      const toScheduleTonight = [];

      // Pick fixtures where neither team has played this weekend
      for(let i = unscheduled.length-1; i>=0 && slotsLeft>0; i--){
        const fix = unscheduled[i];
        if(!teamsThisWeekend.has(fix.t1) && !teamsThisWeekend.has(fix.t2)){
          toScheduleTonight.push({...fix, idx:i});
          teamsThisWeekend.add(fix.t1);
          teamsThisWeekend.add(fix.t2);
          slotsLeft--;
        }
      }

      // Assign times and courts
      toScheduleTonight.forEach(fix=>{
        const courtNum   = ((courtIdx-1) % courts) + 1;
        const slotOffset = Math.floor((courtIdx-1) / courts);
        const matchHour  = startH + slotOffset * (matchDuration/60);
        const timeStr    = `${String(Math.floor(matchHour)).padStart(2,'0')}:${String((matchHour%1)*60).padStart(2,'0')||'00'}`;

        scheduled.push({
          matchId:   fix.id,
          t1:        fix.t1,
          t2:        fix.t2,
          date:      night.date,
          time:      timeStr,
          court:     courtNum,
          suggested: true
        });
        unscheduled.splice(fix.idx, 1);
        courtIdx++;
      });
    }

    if(unscheduled.length === 0) break;
  }

  return {
    scheduled,
    unscheduled,        // fixtures that couldn't be fit
    totalNights:  nights.length,
    totalSlots:   nights.reduce((s,n)=>s+n.slots, 0),
    weeksUsed:    weekends.findIndex(w=>w.some(n=>
      scheduled.some(s=>s.date===n.date))) + 1
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekendKey(d){
  // Returns the Saturday date string for the weekend containing date d
  const day = d.getDay();
  const sat = new Date(d);
  if(day === 0) sat.setDate(d.getDate() - 1);       // Sunday → previous Saturday
  else if(day !== 6) sat.setDate(d.getDate() + (6 - day)); // other → next Saturday
  return sat.toISOString().split('T')[0];
}

function formatScheduleTime(timeStr){
  if(!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h > 12 ? h-12 : h===0 ? 12 : h;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function scheduleStats(config, teamCount){
  const {
    leagueStart='2026-07-11', leagueEnd='2026-09-27',
    matchStartTime='19:00', matchEndTime='23:00',
    matchDuration=60, courts=2, playDays=[6,0], blackoutDates=[]
  } = config;

  const blackoutSet = new Set(blackoutDates.map(bd=>typeof bd==='string'?bd:bd.date));
  const startH = parseInt(matchStartTime.split(':')[0]);
  const endH   = parseInt(matchEndTime.split(':')[0]);
  const slotsPerNight = courts * Math.floor((endH-startH)*60/matchDuration);

  let nights=0, d=new Date(leagueStart+'T00:00:00');
  const endDate=new Date(leagueEnd+'T00:00:00');
  while(d<=endDate){
    if(playDays.includes(d.getDay())&&!blackoutSet.has(d.toISOString().split('T')[0])) nights++;
    d.setDate(d.getDate()+1);
  }

  const totalSlots    = nights * slotsPerNight;
  const totalMatches  = (teamCount*(teamCount-1))/2;
  const feasible      = totalSlots >= totalMatches;

  return { nights, slotsPerNight, totalSlots, totalMatches, feasible,
    weeksNeeded: Math.ceil(totalMatches/slotsPerNight) };
}
