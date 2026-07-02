// src/state.js
// Global state object, ID generators, and lookup helpers used everywhere else.

// ════════ STATE ════════
const S = {
  teams:{}, matches:{}, activity:[],
  curStandingsGroup:null, curMatchesGroup:null, curTeamsGroup:null,
  editMatchId:null, selectedDate:null,
  knockout:{ champ:{rr:{},final:{t1:null,t2:null,scoreData:null,winner:null,loser:null}}, phoenix:{rr:{},final:{t1:null,t2:null,scoreData:null,winner:null,loser:null}} },
};

// Registration closes 2 days before the season starts (11 Jul 2026). This isn't just a policy
// preference — fixtures are generated per-division via round-robin, and generateFixtures()
// refuses to re-run once a group has fixtures. A team added after generation gets a roster
// entry but literally zero matches: invisible in Standings, absent from the schedule. The
// cutoff must land before anyone generates fixtures for it to mean anything. Adjust the date
// below if the real cutoff differs.
const REGISTRATION_CUTOFF='2026-07-09';
function isRegistrationOpen(){
  return new Date().toISOString().split('T')[0] <= REGISTRATION_CUTOFF;
}

// ════════ HELPERS ════════
const uid=()=>Math.random().toString(36).slice(2,9);
// Short, human-typeable code a captain hands a player to link that player's own login to a
// specific roster slot without needing their email known in advance. Excludes visually
// ambiguous characters (0/O, 1/I).
function genClaimCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='';
  for(let i=0;i<6;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}
const tn=id=>S.teams[id]?S.teams[id].name:'TBD';
const groups=()=>[...new Set(Object.values(S.teams).map(t=>t.group))].sort();
const teamsByGroup=g=>Object.values(S.teams).filter(t=>t.group===g);

// League dates: weekends July 11 – Oct 4 2026
function leagueDates(){
  const dates=[]; const start=new Date('2026-07-11'); const end=new Date('2026-10-04');
  const d=new Date(start);
  while(d<=end){ const day=d.getDay(); if(day===6||day===0) dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate()+1); }
  return dates;
}
const TIMES=['19:00','20:00','21:00','22:00'];

