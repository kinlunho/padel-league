// src/data/tournaments.js
// Tournament data layer
// Collection: /tournaments/{tournamentId}
// Subcollection: /tournaments/{tournamentId}/matches/{matchId}

const TournamentsDB = {

  async create(data){
    const id = `tournament_${Date.now()}`;
    await db.collection('tournaments').doc(id).set({
      id, ...data,
      status: 'registration',
      currentPhase: 'groups',
      divisions: data.divisions||[],  // [{divisionId, name, drawSize}]
      registrations: [],   // [{pairId, player1, player2, divisionId, registeredAt, status:'confirmed'|'waitlist', seed}]
      groups: [],          // [{groupId, divisionId, name, pairIds:[]}]
      standings: {},       // {pairId: {...}}
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
    return id;
  },

  async get(tournamentId){
    const snap = await db.collection('tournaments').doc(tournamentId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  },

  async update(tournamentId, fields){
    await db.collection('tournaments').doc(tournamentId).update({
      ...fields,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async listAll(){
    const snap = await db.collection('tournaments')
      .orderBy('date','desc').limit(50).get();
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  },

  // Match subcollection
  async saveMatch(tournamentId, matchId, data){
    await db.collection('tournaments').doc(tournamentId)
      .collection('matches').doc(matchId).set(data, {merge:true});
  },

  async getMatches(tournamentId){
    const snap = await db.collection('tournaments').doc(tournamentId)
      .collection('matches').orderBy('scheduledAt').get();
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  },

  async getGroupMatches(tournamentId, groupId){
    const snap = await db.collection('tournaments').doc(tournamentId)
      .collection('matches')
      .where('groupId','==',groupId)
      .where('phase','==','group').get();
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  },

  subscribe(onData){
    return db.collection('tournaments')
      .orderBy('date','desc').limit(50)
      .onSnapshot(snap=>{
        S.tournaments = {};
        snap.forEach(d=>{ S.tournaments[d.id]={id:d.id,...d.data()}; });
        onData();
      }, err=>{ console.error('TournamentsDB error:',err.message); onData(); });
  }
};

// ── Score validation ──────────────────────────────────────────────────────────
// Validates a set score: returns {valid, winner:'A'|'B'|null, needsTiebreak}
function validateSetScore(a, b){
  if(isNaN(a)||isNaN(b)||a<0||b<0) return {valid:false};
  const max=Math.max(a,b), min=Math.min(a,b);
  const diff=max-min;
  // Standard set: win by 2, minimum 6
  if(max===6 && min<=4) return {valid:true, winner:a>b?'A':'B', needsTiebreak:false};
  if(max===7 && min===5) return {valid:true, winner:a>b?'A':'B', needsTiebreak:false};
  // Tiebreak at 6-6
  if(max===7 && min===6) return {valid:true, winner:a>b?'A':'B', needsTiebreak:false};
  // Invalid
  return {valid:false, winner:null};
}

// Validates super tiebreak: first to 10, win by 2, NO hard cap
function validateSuperTb(a, b){
  if(isNaN(a)||isNaN(b)||a<0||b<0) return {valid:false};
  const max=Math.max(a,b), min=Math.min(a,b);
  const diff=max-min;
  if(max>=10 && diff>=2) return {valid:true, winner:a>b?'A':'B'};
  return {valid:false};
}

// Full match score validation
// sets format: {sets:1|2} with super tiebreak always
// Returns {valid, winner:'A'|'B'|null, message}
function validateTournamentScore(scoreData, format){
  const sets = format?.sets || 2;
  const setScores = scoreData.sets || [];

  if(setScores.length < sets){
    return {valid:false, message:`Need ${sets} set scores`};
  }

  let winsA=0, winsB=0;
  for(let i=0;i<sets;i++){
    const s = setScores[i];
    const r = validateSetScore(s.a, s.b);
    if(!r.valid) return {valid:false, message:`Set ${i+1}: invalid score ${s.a}-${s.b}`};
    if(r.winner==='A') winsA++; else winsB++;
  }

  // If sets equal (only possible in 2-set format: 1-1), need super tiebreak
  if(winsA===winsB){
    if(!scoreData.superTb) return {valid:false, message:'Tie — super tiebreak required'};
    const st = validateSuperTb(scoreData.superTb.a, scoreData.superTb.b);
    if(!st.valid) return {valid:false,
      message:`Super tiebreak: first to 10, win by 2 (no cap). Current: ${scoreData.superTb.a}-${scoreData.superTb.b}`};
    return {valid:true, winner:st.winner};
  }

  return {valid:true, winner:winsA>winsB?'A':'B'};
}

// ── Standings calculation ─────────────────────────────────────────────────────
function calcTournamentGroupStandings(tournament, groupId, matches){
  const group = tournament.groups.find(g=>g.groupId===groupId);
  if(!group) return [];

  const standings = {};
  group.pairIds.forEach(pid=>{
    const reg = tournament.registrations.find(r=>r.pairId===pid);
    standings[pid] = {
      pairId:pid,
      name: reg ? `${reg.player1.name} & ${reg.player2.name}` : pid,
      played:0, won:0, lost:0,
      setsWon:0, setsLost:0,
      gamesWon:0, gamesLost:0,
      points:0
    };
  });

  matches.filter(m=>m.status==='confirmed'&&m.phase==='group'&&m.groupId===groupId)
    .forEach(m=>{
      const sA = standings[m.pairAId];
      const sB = standings[m.pairBId];
      if(!sA||!sB) return;

      const sets = m.score?.sets||[];
      let swA=0,swB=0,gwA=0,gwB=0;
      sets.forEach(s=>{
        gwA+=s.a; gwB+=s.b;
        if(s.a>s.b) swA++; else swB++;
      });
      if(m.score?.superTb){
        // Super tiebreak counts as a set
        if(m.score.superTb.a>m.score.superTb.b) swA++; else swB++;
      }

      sA.played++; sB.played++;
      sA.setsWon+=swA; sA.setsLost+=swB;
      sB.setsWon+=swB; sB.setsLost+=swA;
      sA.gamesWon+=gwA; sA.gamesLost+=gwB;
      sB.gamesWon+=gwB; sB.gamesLost+=gwA;

      if(m.winner==='A'){
        sA.won++; sA.points+=3;
        sB.lost++;
      } else {
        sB.won++; sB.points+=3;
        sA.lost++;
      }
    });

  return Object.values(standings).sort((a,b)=>
    b.points-a.points ||
    (b.setsWon-b.setsLost)-(a.setsWon-a.setsLost) ||
    (b.gamesWon-b.gamesLost)-(a.gamesWon-a.gamesLost)
  );
}

// ── Pair ID generator ─────────────────────────────────────────────────────────
function generatePairId(p1name, p2name, date){
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8);
  return `${slug(p1name)}_${slug(p2name)}_${(date||'').replace(/-/g,'').slice(0,8)}`;
}

// ── KO format per round ──────────────────────────────────────────────────────
// If group format = 1 set: R16/QF use 1 set, SF+Final use 2 sets
// If group format = 2 sets: all KO rounds use 2 sets
function koFormatForRound(tournament, round){
  const groupSets = tournament.format?.sets || 2;
  if(groupSets === 2) return {sets:2};
  return round <= 2 ? {sets:2} : {sets:1};
}
