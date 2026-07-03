// src/state.js
// Global state object, ID generators, and lookup helpers used everywhere else.

// ════════ SEASON ════════
// These are reassigned by ConfigDB.subscribe() when the Firestore config doc loads.
// Do NOT read these before ConfigDB has initialized — use S.config instead.
let ACTIVE_SEASON       = '2026-summer';
let REGISTRATION_CUTOFF = '2026-07-09';

function isRegistrationOpen(){
  return new Date().toISOString().split('T')[0] <= REGISTRATION_CUTOFF;
}

// ════════ STATE ════════
const S = {
  teams:{}, matches:{}, activity:[],
  config: null,  // populated by ConfigDB.subscribe() — null until first snapshot
  curStandingsGroup:null, curMatchesGroup:null, curTeamsGroup:null,
  editMatchId:null, selectedDate:null,
  knockout:{ champ:{rr:{},final:{t1:null,t2:null,scoreData:null,winner:null,loser:null}}, phoenix:{rr:{},final:{t1:null,t2:null,scoreData:null,winner:null,loser:null}} },
};

// ════════ HELPERS ════════
const uid=()=>Math.random().toString(36).slice(2,9);
function genClaimCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='';
  for(let i=0;i<6;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}
const tn=id=>S.teams[id]?S.teams[id].name:'TBD';
const groups=()=>{
  const all=[...new Set(Object.values(S.teams).map(t=>t.group))].sort();
  // Always show Unassigned last so it doesn't pollute the main division tabs
  const withoutUnassigned = all.filter(g=>g!=='Unassigned');
  const hasUnassigned = all.includes('Unassigned');
  return hasUnassigned ? [...withoutUnassigned,'Unassigned'] : withoutUnassigned;
};
const teamsByGroup=g=>Object.values(S.teams).filter(t=>t.group===g&&t.season===ACTIVE_SEASON);

// League dates: weekends July 11 – Oct 4 2026
function leagueDates(){
  const dates=[]; const start=new Date('2026-07-11'); const end=new Date('2026-10-04');
  const d=new Date(start);
  while(d<=end){ const day=d.getDay(); if(day===6||day===0) dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate()+1); }
  return dates;
}
const TIMES=['19:00','20:00','21:00','22:00'];
