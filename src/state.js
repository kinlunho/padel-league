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
function isLeagueStarted(){
  const start = S.config?.leagueStart || '2026-07-11';
  return new Date().toISOString().split('T')[0] >= start;
}

// ════════ STATE ════════
const S = {
  teams:{}, matches:{}, activity:[],
  config: null,  // populated by ConfigDB.subscribe() — null until first snapshot
  curStandingsGroup:null, curMatchesGroup:null, curTeamsGroup:null,
  editMatchId:null, selectedDate:null,
  // knockout is keyed by division slug, each has champ and phoenix sub-objects
  // e.g. knockout['golddivision'] = { champ:{final:{...}}, phoenix:{final:{...}} }
  knockout: {},
  leagueTab: 'standings',  // active sub-tab inside League page
  koTab: 'standings',      // active sub-tab inside Knockout page
  isKOEntry: false,         // true when admin is entering a KO score (blocks draws)
  isConfirmMode: false,      // true when score modal opened for confirmation (hides attendance)
  onBehalfOf: null,
  events: {},          // { uid, email } set by admin when registering team for a captain
  profileTab: 'mine',        // active sub-tab in Profile page
  _directoryPlayers: [],     // cached player list for directory search
  _profileMatches: [],       // cached matches for match history toggle
  _profileTeamId: null,
  appReady: false,          // true only after config + first teams snapshot resolve
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
// Returns ordered division names from config — single source of truth.
// Falls back to hardcoded list only if config hasn't loaded yet.
const getDivisions = () => {
  const divs = S.config?.divisions;
  if(divs && divs.length) return divs.map(d => d.name);
  return ['Gold Division','High Silver Division','Low Silver Division'];
};

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
