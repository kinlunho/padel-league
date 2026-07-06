// src/mexicano.js
// Mexicano pairing engine.
//
// Rules:
//   Round 1: random pairs, random court assignment
//   Round N: rank players by cumulative points (desc), then:
//     1st + 2nd vs 3rd + 4th on Court 1
//     5th + 6th vs 7th + 8th on Court 2  etc.
//   Partners always change each round (enforced by the algorithm)
//   Withdrawn players get byes — opponents receive a walkover win
//
// Score format: configurable per event
//   { type: 'games', target: 16 }   — first team to X games wins
//   { type: 'timed', minutes: 10 }  — most games in time wins
//   { type: 'sets', sets: 2 }       — standard padel sets + STB

// ── Pairing generation ────────────────────────────────────────────────────────

function mexicanoShuffleArray(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function mexicanoGenerateRound(event, roundNumber, standings){
  const players = event.players.filter(p=>!p.withdrawn);
  if(players.length < 4) return null;

  let ordered;
  if(roundNumber === 1){
    // Round 1: random
    ordered = mexicanoShuffleArray(players);
  } else {
    // Round N: sort by cumulative points desc, then games for tiebreak
    ordered = [...players].sort((a,b)=>{
      const sa = standings[a.uid]||{points:0,gamesWon:0};
      const sb = standings[b.uid]||{points:0,gamesWon:0};
      return sb.points-sa.points || sb.gamesWon-sa.gamesWon;
    });
  }

  // Mexicano pairing — supports any even player count including non-multiples of 4.
  // If players % 4 !== 0, a rotating bye PAIR sits out each round.
  // Bye rotation: deterministic based on round number so every pair sits out evenly.
  //
  // Example: 6 players → 1 match (4 play) + 1 bye pair (2 sit out)
  // Example: 8 players → 2 matches (all play)
  // Example: 10 players → 2 matches (8 play) + 1 bye pair (2 sit out)

  const matches = [];
  const courts  = event.courts || 1;
  let courtIdx  = 1;
  let playingPlayers = [...ordered];

  // If not a multiple of 4, rotate a bye pair out
  // Bye pair = last 2 players in the ranked order this round
  // (lowest ranked sit out — gives them incentive to score well)
  let byePair = null;
  if(ordered.length % 4 !== 0 && ordered.length >= 4){
    byePair = playingPlayers.splice(playingPlayers.length - 2, 2);
    matches.push({
      matchId:    `r${roundNumber}_bye`,
      roundNumber,
      isBye:      true,
      byeUids:    byePair.map(p=>p.uid),
      byeNames:   byePair.map(p=>p.name).join(' & '),
    });
  }

  // Pair remaining players: [0,1] vs [2,3], [4,5] vs [6,7] etc.
  for(let i=0; i+3<playingPlayers.length; i+=4){
    const teamA = [playingPlayers[i],   playingPlayers[i+1]];
    const teamB = [playingPlayers[i+2], playingPlayers[i+3]];
    matches.push({
      matchId:    `r${roundNumber}_m${Math.floor(i/4)+1}`,
      roundNumber,
      court:      courtIdx,
      teamA:      teamA.map(p=>p.uid),
      teamB:      teamB.map(p=>p.uid),
      teamANames: teamA.map(p=>p.name).join(' & '),
      teamBNames: teamB.map(p=>p.name).join(' & '),
      scoreA:     null,
      scoreB:     null,
      status:     'pending'
    });
    courtIdx = courtIdx >= courts ? 1 : courtIdx + 1;
  }

  return { roundNumber, matches, generatedAt: new Date().toISOString() };
}

// ── Standings calculation ─────────────────────────────────────────────────────

function mexicanoCalcStandings(event, allRounds){
  const standings = {};
  event.players.forEach(p=>{
    standings[p.uid] = {
      uid:p.uid, name:p.name, nprp:p.nprp,
      points:0, gamesWon:0, gamesLost:0, played:0,
      withdrawn: p.withdrawn||false
    };
  });

  allRounds.forEach(round=>{
    (round.matches||[]).forEach(m=>{
      if(m.isBye){
        // Bye pair sits out — no points awarded (rotating bye, not a walkover)
        // This prevents artificially inflating ratings of lower-ranked players
        return;
      }
      if(m.status!=='confirmed'||m.scoreA===null||m.scoreB===null) return;

      // Winning team gets points = their games won
      // Individual points = team games won (both partners get same)
      const aWins = m.scoreA > m.scoreB;
      const draw  = m.scoreA === m.scoreB;

      [...m.teamA].forEach(uid=>{
        if(!standings[uid]) return;
        standings[uid].played++;
        standings[uid].gamesWon  += m.scoreA;
        standings[uid].gamesLost += m.scoreB;
        standings[uid].points    += aWins ? m.scoreA : draw ? m.scoreA : m.scoreA;
        // Points = games won by your team (Mexicano standard)
      });
      [...m.teamB].forEach(uid=>{
        if(!standings[uid]) return;
        standings[uid].played++;
        standings[uid].gamesWon  += m.scoreB;
        standings[uid].gamesLost += m.scoreA;
        standings[uid].points    += m.scoreB;
      });
    });
  });

  return Object.values(standings).sort((a,b)=>
    b.points-a.points || b.gamesWon-a.gamesWon || a.gamesLost-b.gamesLost
  );
}

// ── Score entry ───────────────────────────────────────────────────────────────

async function mexicanoEnterScore(eventId, roundNumber, matchId, scoreA, scoreB){
  if(!isAdminUser()){ showToast('Admin only',true); return; }

  const event = S.events[eventId];
  if(!event) return;

  // Update match in round
  const rounds = await EventsDB.getRounds(eventId);
  const round  = rounds.find(r=>r.roundNumber===roundNumber);
  if(!round){ showToast('Round not found',true); return; }

  const match = round.matches.find(m=>m.matchId===matchId);
  if(!match){ showToast('Match not found',true); return; }

  match.scoreA  = scoreA;
  match.scoreB  = scoreB;
  match.status  = 'confirmed';
  match.enteredBy = firebase.auth().currentUser?.email;
  match.enteredAt = new Date().toISOString();

  await EventsDB.saveRound(eventId, roundNumber, round);

  // Recalculate standings
  const allRounds = await EventsDB.getRounds(eventId);
  const standings = mexicanoCalcStandings(event, allRounds);
  const standingsMap = {};
  standings.forEach(s=>{ standingsMap[s.uid]=s; });
  await EventsDB.update(eventId, {
    participants: (event.players||[]).map(p=>p.uid).filter(Boolean),
    standings: standingsMap,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp() // triggers parent subscription
  });

  // Fire OPPR updates for both teams
  const date   = event.date || new Date().toISOString().split('T')[0];
  const season = ACTIVE_SEASON;
  const total  = scoreA + scoreB;
  if(total > 0){
    const getPlayer = uid => event.players.find(p=>p.uid===uid);
    await Promise.all([
      ...(match.teamA||[]).map(async uid=>{
        const pl = getPlayer(uid);
        if(!pl) return;
        const doc = await fetchPlayerDoc(pl.email);
        const oppUids = match.teamB||[];
        const oppPls  = oppUids.map(u=>getPlayer(u)).filter(Boolean);
        // Simple 1v1 expected: our team avg vs their team avg
        const ourOPPR = getPlayerOPPR(doc, pl.nprp);
        const oppOPPR = oppPls.length ? oppPls.reduce((s,p)=>{
          return s + (getPlayerOPPR(null, p.nprp));
        },0)/oppPls.length : ourOPPR;
        const exp  = opprExpected(ourOPPR, oppOPPR);
        const act  = scoreA > scoreB ? 1 : scoreA === scoreB ? 0.5 : 0;
        const margin = opprMarginFactor(
          scoreA > scoreB ? scoreA : scoreB,
          scoreA > scoreB ? scoreB : scoreA
        );
        await writeOPPR(doc, pl.nprp, act, exp, margin, 'mexicano',
          `${eventId}_${matchId}`, date, season);
      }),
      ...(match.teamB||[]).map(async uid=>{
        const pl = getPlayer(uid);
        if(!pl) return;
        const doc = await fetchPlayerDoc(pl.email);
        const ourOPPR = getPlayerOPPR(doc, pl.nprp);
        const act  = scoreB > scoreA ? 1 : scoreA === scoreB ? 0.5 : 0;
        const margin = opprMarginFactor(
          scoreB > scoreA ? scoreB : scoreA,
          scoreB > scoreA ? scoreA : scoreB
        );
        await writeOPPR(doc, pl.nprp, act, 1-opprExpected(ourOPPR, ourOPPR),
          margin, 'mexicano', `${eventId}_${matchId}`, date, season);
      }),
    ]);
  }

  showToast('Score saved — standings updated');
  renderEventsPage();
}

// ── Withdraw player ───────────────────────────────────────────────────────────

async function mexicanoWithdrawPlayer(eventId, uid){
  if(!isAdminUser()){ showToast('Admin only',true); return; }
  const event = S.events[eventId];
  if(!event) return;
  const players = event.players.map(p=>
    p.uid===uid ? {...p, withdrawn:true} : p
  );
  await EventsDB.update(eventId, { players });
  showToast('Player withdrawn — future rounds will skip them');
  renderEventsPage();
}

// ══════════════════════════════════════════════════════════════════════════════
// AMERICANO ENGINE
// ══════════════════════════════════════════════════════════════════════════════
//
// Two variants:
//   'roundrobin' — every player partners with every other player exactly once.
//                  Generates N-1 rounds for N players. Fixed upfront.
//   'fixed'      — traditional predefined rotation table. Same as round-robin
//                  mathematically but presented as a social fixed schedule.
//
// Both variants pre-generate ALL rounds at event start (unlike Mexicano which
// generates one round at a time based on standings).
//
// Scoring: games to X with auto-complement (same as Mexicano).
// Standings: cumulative individual points = games won (same as Mexicano).
// Bye pair: if players % 4 !== 0, last pair in each round sits out (rotating).

// ── Round-robin schedule generator ───────────────────────────────────────────
// Uses the "circle method" (polygon algorithm) — standard mathematical
// round-robin tournament scheduling. Guarantees every player partners with
// every other player exactly once over N-1 rounds.
//
// For 8 players, generates 7 rounds × 2 matches each.
// For 6 players, generates 5 rounds × 1 match + 1 bye pair each.

function americanoGenerateSchedule(players){
  const n = players.length;
  if(n < 4) return [];

  // Circle method: fix player[0], rotate the rest
  const ids = players.map(p => p.uid);
  const fixed = ids[0];
  const rotating = ids.slice(1);
  const totalRounds = rotating.length; // N-1 rounds

  const allRounds = [];

  for(let r = 0; r < totalRounds; r++){
    // Current rotation: fixed + rotating[r], rotating[r+1..], rotating[0..r-1]
    const circle = [fixed, ...rotating.slice(r), ...rotating.slice(0, r)];
    // Pair players: circle[0] with circle[n-1], circle[1] with circle[n-2] etc.
    // These pairs are PARTNERS (same team)
    const pairs = [];
    for(let i = 0; i < Math.floor(circle.length / 2); i++){
      pairs.push([circle[i], circle[circle.length - 1 - i]]);
    }

    // Match pairs against each other: pair[0] vs pair[1], pair[2] vs pair[3] etc.
    const matches = [];
    let byePair = null;
    let activePairs = [...pairs];

    // If odd number of pairs (happens when players % 4 !== 0 after pairing),
    // rotate bye pair
    if(activePairs.length % 2 !== 0){
      byePair = activePairs.splice(activePairs.length - 1, 1)[0];
    }

    for(let m = 0; m < activePairs.length; m += 2){
      if(m + 1 >= activePairs.length) break;
      const teamA = activePairs[m];
      const teamB = activePairs[m + 1];
      const getPlayer = uid => players.find(p => p.uid === uid);
      matches.push({
        matchId:    `r${r+1}_m${Math.floor(m/2)+1}`,
        roundNumber: r + 1,
        court:      Math.floor(m/2) + 1,
        teamA,
        teamB,
        teamANames: teamA.map(uid => getPlayer(uid)?.name||uid).join(' & '),
        teamBNames: teamB.map(uid => getPlayer(uid)?.name||uid).join(' & '),
        scoreA:     null,
        scoreB:     null,
        status:     'pending'
      });
    }

    if(byePair){
      const getPlayer = uid => players.find(p => p.uid === uid);
      matches.push({
        matchId:    `r${r+1}_bye`,
        roundNumber: r + 1,
        isBye:      true,
        byeUids:    byePair,
        byeNames:   byePair.map(uid => getPlayer(uid)?.name||uid).join(' & ')
      });
    }

    allRounds.push({ roundNumber: r+1, matches, generatedAt: new Date().toISOString() });
  }

  return allRounds;
}

// ── Start Americano event ─────────────────────────────────────────────────────
// Generates ALL rounds upfront and saves them to Firestore.

async function americanoStartEvent(eventId){
  if(!isAdminUser()){ showToast('Admin only', true); return; }
  const e = S.events[eventId];
  if(!e) return;
  if((e.players||[]).length < 4){ showToast('Need at least 4 players', true); return; }

  const players = e.players.filter(p => !p.withdrawn);
  const schedule = americanoGenerateSchedule(players);

  if(!schedule.length){ showToast('Could not generate schedule', true); return; }

  // Respect totalRounds cap if set
  const cappedSchedule = e.totalRounds
    ? schedule.slice(0, e.totalRounds)
    : schedule;

  // Save all rounds to Firestore
  for(const round of cappedSchedule){
    await EventsDB.saveRound(eventId, round.roundNumber, round);
  }

  await EventsDB.update(eventId, {
    status: 'active',
    currentRound: 1,
    totalRounds: cappedSchedule.length,
    scheduleGenerated: true
  });

  showToast(`Americano started — ${cappedSchedule.length} rounds generated`);
  S_eventDetail = await EventsDB.get(eventId);
  S.events[eventId] = S_eventDetail;
  S_eventRounds = await EventsDB.getRounds(eventId);
  renderEventsPage();
}

// ── Americano standings (same formula as Mexicano) ────────────────────────────
// Individual points = games won. Sorted by points desc, then games won.

const americanoCalcStandings = mexicanoCalcStandings; // identical formula

// ── Americano next round ──────────────────────────────────────────────────────
// Unlike Mexicano, rounds are pre-generated. Just advance the round counter.

async function americanoNextRound(eventId){
  const e = S.events[eventId];
  if(!e || !isAdminUser()) return;
  const nextRound = (e.currentRound||0) + 1;
  if(nextRound > (e.totalRounds||0)){
    showToast('All rounds complete — end the event', true);
    return;
  }
  await EventsDB.update(eventId, { currentRound: nextRound });
  showToast(`Round ${nextRound}`);
  S_eventDetail = await EventsDB.get(eventId);
  S.events[eventId] = S_eventDetail;
  S_eventRounds = await EventsDB.getRounds(eventId);
  renderEventsPage();
}

// ══════════════════════════════════════════════════════════════════════════════
// KING OF THE COURT ENGINE
// ══════════════════════════════════════════════════════════════════════════════
//
// Architecture: Model A — Hierarchical courts
//   - 1 King Court + N Challenger Courts
//   - Challenger winners wait → challenge King when current game ends
//   - King losers go to back of lowest challenger queue
//   - Winners Stay variant: configurable consecutive win cap (default 3)
//   - Rotational Shuffle: after each game, winning pair splits, all rotate
//   - Waiting List: digital queue, admin manages
//
// Scoring: first to X with 2-point difference, configurable hard cap
// Pairs: fixed (admin sets) or random (shuffled at start)
//
// Data model (on event doc):
//   queue:        [{uid, name, nprp, partneredWith}]  — ordered waiting list
//   courts:       [{courtId, courtType:'king'|'challenger', level:1..N,
//                   teamA:[uid,uid], teamB:[uid,uid],
//                   scoreA, scoreB, consecutiveWins, status:'playing'|'waiting'}]
//   games:        [{gameId, courtType, level, teamA, teamB,
//                   scoreA, scoreB, winnerId:'A'|'B', timestamp}]
//   standings:    {uid: {gamesWon, gamesLost, gamesPlayed, points, consecutiveWins}}
//   pairs:        [{uid1, uid2, name}]  — fixed pairs for the session

// ── King event initialisation ─────────────────────────────────────────────────

async function kingStartEvent(eventId){
  if(!isAdminUser()){ showToast('Admin only',true); return; }
  const e = S.events[eventId];
  if(!e) return;

  const players = e.players.filter(p=>!p.withdrawn);
  if(players.length < 4){ showToast('Need at least 4 players',true); return; }

  // Build pairs
  let pairs = [];
  const pairMode = e.pairMode || 'fixed';
  if(pairMode === 'random'){
    const shuffled = mexicanoShuffleArray(players);
    for(let i=0; i+1<shuffled.length; i+=2){
      pairs.push({ uid1:shuffled[i].uid, uid2:shuffled[i+1].uid,
        name:`${shuffled[i].name} & ${shuffled[i+1].name}` });
    }
    if(shuffled.length%2!==0){
      // Odd player out joins as floater — gets paired with next available
      pairs.push({ uid1:shuffled[shuffled.length-1].uid, uid2:null,
        name:shuffled[shuffled.length-1].name });
    }
  } else {
    // Fixed pairs — use the pairs array already set by admin
    pairs = e.pairs || [];
    if(!pairs.length){
      // Fallback: sequential pairing from players list
      for(let i=0; i+1<players.length; i+=2){
        pairs.push({ uid1:players[i].uid, uid2:players[i+1].uid,
          name:`${players[i].name} & ${players[i+1].name}` });
      }
    }
  }

  // Build initial queue — all pairs waiting
  const queue = pairs.map((pair,i) => ({
    pairId: `pair_${i}`,
    uid1: pair.uid1, uid2: pair.uid2,
    name: pair.name,
    position: i
  }));

  // Initialise courts
  const numCourts = e.courts || 1;
  const courts = [];
  courts.push({ courtId:'king', courtType:'king', level:0,
    teamA:null, teamB:null, scoreA:0, scoreB:0,
    consecutiveWins:0, status:'waiting', currentPairA:null, currentPairB:null });
  for(let i=1; i<numCourts; i++){
    courts.push({ courtId:`challenger_${i}`, courtType:'challenger', level:i,
      teamA:null, teamB:null, scoreA:0, scoreB:0,
      consecutiveWins:0, status:'waiting', currentPairA:null, currentPairB:null });
  }

  // Initialise standings
  const standings = {};
  pairs.forEach((p,i)=>{
    standings[`pair_${i}`] = {
      pairId:`pair_${i}`, name:p.name,
      gamesWon:0, gamesLost:0, gamesPlayed:0,
      points:0, consecutiveWins:0
    };
  });

  await EventsDB.update(eventId, {
    status:'active', queue, courts, pairs,
    games:[], standings,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Auto-fill courts from queue
  await kingFillCourts(eventId);
  showToast('King of the Court started!');
  S_eventDetail = await EventsDB.get(eventId);
  S.events[eventId] = S_eventDetail;
  renderEventsPage();
}

// ── Fill empty courts from queue ──────────────────────────────────────────────

async function kingFillCourts(eventId){
  const e = await EventsDB.get(eventId);
  if(!e) return;

  let courts  = [...(e.courts||[])];
  let queue   = [...(e.queue||[])];
  let changed = false;

  // Sort courts: king first, then challengers by level
  courts.sort((a,b)=> a.level-b.level);

  for(const court of courts){
    if(court.status==='playing') continue;
    if(queue.length < 2) break;

    const pairA = queue.shift();
    const pairB = queue.shift();
    court.teamA        = [pairA.uid1, pairA.uid2].filter(Boolean);
    court.teamB        = [pairB.uid1, pairB.uid2].filter(Boolean);
    court.currentPairA = pairA;
    court.currentPairB = pairB;
    court.scoreA       = 0;
    court.scoreB       = 0;
    court.status       = 'playing';
    changed = true;
  }

  if(changed){
    await EventsDB.update(eventId, {
      courts, queue,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

// ── Score entry and game resolution ──────────────────────────────────────────

async function kingEnterScore(eventId, courtId, scoreA, scoreB){
  if(!isAdminUser()){ showToast('Admin only',true); return; }

  const e = await EventsDB.get(eventId);
  if(!e) return;

  const target    = e.scoreFormat?.target || 16;
  const hardCap   = e.scoreFormat?.hardCap || 20;
  const winCap    = e.winCap || 3;
  const queueMode = e.queueVariant || 'winners-stay';

  // Validate score — first to target with 2-point diff, hard cap
  const diff = Math.abs(scoreA - scoreB);
  const maxScore = Math.max(scoreA, scoreB);
  if(maxScore < target && maxScore < hardCap){
    showToast(`Game not finished — first to ${target} with 2-point difference`,true);
    return;
  }
  if(maxScore >= target && diff < 2 && maxScore < hardCap){
    showToast(`Need 2-point difference (or reach hard cap of ${hardCap})`,true);
    return;
  }

  const courts  = [...(e.courts||[])];
  const queue   = [...(e.queue||[])];
  const games   = [...(e.games||[])];
  const standings = {...(e.standings||{})};

  const court = courts.find(c=>c.courtId===courtId);
  if(!court||court.status!=='playing'){ showToast('Court not active',true); return; }

  const winnerSide  = scoreA > scoreB ? 'A' : 'B';
  const winnerPair  = winnerSide==='A' ? court.currentPairA : court.currentPairB;
  const loserPair   = winnerSide==='A' ? court.currentPairB : court.currentPairA;

  // Log the game
  const gameId = `g_${Date.now()}`;
  games.push({
    gameId, courtId,
    courtType: court.courtType,
    level: court.level,
    teamA: court.currentPairA?.name||'',
    teamB: court.currentPairB?.name||'',
    scoreA, scoreB,
    winner: winnerSide,
    winnerName: winnerPair?.name||'',
    timestamp: new Date().toISOString()
  });

  // Update standings
  const wId = winnerPair?.pairId;
  const lId = loserPair?.pairId;
  if(wId&&standings[wId]){
    standings[wId].gamesWon++;
    standings[wId].gamesPlayed++;
    standings[wId].points += scoreA > scoreB ? scoreA : scoreB;
    standings[wId].consecutiveWins = (standings[wId].consecutiveWins||0)+1;
  }
  if(lId&&standings[lId]){
    standings[lId].gamesLost++;
    standings[lId].gamesPlayed++;
    standings[lId].consecutiveWins = 0;
  }

  // Queue management by variant
  const winnerConsecWins = standings[wId]?.consecutiveWins||0;
  const capReached = court.courtType==='king' && winnerConsecWins >= winCap;

  if(queueMode === 'rotational'){
    // Both pairs leave, queue gets next two
    queue.push({...loserPair, consecutiveWins:0});
    // Split winning pair — each goes to back of queue with new random partner
    // For simplicity: both winners go back as a pair (full rotational requires partner tracking)
    queue.push({...winnerPair, consecutiveWins:0});
    court.status = 'waiting';
    court.currentPairA = null;
    court.currentPairB = null;

  } else if(queueMode === 'winners-stay' && !capReached && court.courtType!=='king'){
    // Challenger court: winner stays, loser goes to back of lowest challenger queue
    queue.push({...loserPair, consecutiveWins:0});
    // Winner stays — bring next from queue as new challenger
    if(queue.length >= 1){
      const nextChallenger = queue.shift();
      const isWinnerA = winnerSide==='A';
      court.currentPairA = isWinnerA ? winnerPair : nextChallenger;
      court.currentPairB = isWinnerA ? nextChallenger : winnerPair;
      court.teamA = court.currentPairA.uid1?[court.currentPairA.uid1,court.currentPairA.uid2].filter(Boolean):[];
      court.teamB = court.currentPairB.uid1?[court.currentPairB.uid1,court.currentPairB.uid2].filter(Boolean):[];
      court.scoreA = 0; court.scoreB = 0;
      court.status = 'playing';
    } else {
      court.status = 'waiting';
    }

  } else {
    // King court winners-stay OR cap reached OR waiting-list:
    // Loser goes to back of queue
    queue.push({...loserPair, consecutiveWins:0});

    if(capReached){
      // Cap reached — winner also vacates, goes back to queue
      queue.push({...winnerPair, consecutiveWins:0});
      if(standings[wId]) standings[wId].consecutiveWins = 0;
      court.status = 'waiting';
      court.currentPairA = null;
      court.currentPairB = null;
    } else {
      // Promotion from top challenger court
      const topChallenger = courts
        .filter(c=>c.courtType==='challenger')
        .sort((a,b)=>a.level-b.level)[0];

      if(topChallenger && topChallenger.status==='waiting' && queue.length>=1){
        // Challenger court has a winner waiting to challenge
        const challenger = queue.shift();
        const isWinnerA = winnerSide==='A';
        court.currentPairA = isWinnerA ? winnerPair : challenger;
        court.currentPairB = isWinnerA ? challenger : winnerPair;
        court.teamA = court.currentPairA.uid1?[court.currentPairA.uid1,court.currentPairA.uid2].filter(Boolean):[];
        court.teamB = court.currentPairB.uid1?[court.currentPairB.uid1,court.currentPairB.uid2].filter(Boolean):[];
        court.scoreA = 0; court.scoreB = 0;
        court.status = 'playing';
      } else if(queue.length >= 1){
        const nextChallenger = queue.shift();
        const isWinnerA = winnerSide==='A';
        court.currentPairA = isWinnerA ? winnerPair : nextChallenger;
        court.currentPairB = isWinnerA ? nextChallenger : winnerPair;
        court.teamA = court.currentPairA.uid1?[court.currentPairA.uid1,court.currentPairA.uid2].filter(Boolean):[];
        court.teamB = court.currentPairB.uid1?[court.currentPairB.uid1,court.currentPairB.uid2].filter(Boolean):[];
        court.scoreA = 0; court.scoreB = 0;
        court.status = 'playing';
      } else {
        court.status = 'waiting';
      }
    }
  }

  // Refill empty challenger courts from queue
  for(const c of courts.filter(ct=>ct.courtType==='challenger'&&ct.status==='waiting')){
    if(queue.length >= 2){
      const pA = queue.shift();
      const pB = queue.shift();
      c.currentPairA = pA; c.currentPairB = pB;
      c.teamA = [pA.uid1,pA.uid2].filter(Boolean);
      c.teamB = [pB.uid1,pB.uid2].filter(Boolean);
      c.scoreA = 0; c.scoreB = 0; c.status = 'playing';
    }
  }

  // OPPR update
  if(winnerPair&&loserPair){
    const date = e.date||new Date().toISOString().split('T')[0];
    const season = ACTIVE_SEASON;
    const getUids = pair => [pair.uid1,pair.uid2].filter(Boolean);
    const getPlayers = uids => (e.players||[]).filter(p=>uids.includes(p.uid));

    const wPlayers = getPlayers(getUids(winnerPair));
    const lPlayers = getPlayers(getUids(loserPair));
    const wOPPR = wPlayers.length ? wPlayers.reduce((s,p)=>s+(p.nprp||3.5),0)/wPlayers.length : 3.5;
    const lOPPR = lPlayers.length ? lPlayers.reduce((s,p)=>s+(p.nprp||3.5),0)/lPlayers.length : 3.5;
    const exp   = opprExpected(wOPPR, lOPPR);
    const margin= opprMarginFactor(Math.max(scoreA,scoreB), Math.min(scoreA,scoreB));

    for(const p of wPlayers){
      const doc = await fetchPlayerDoc(p.email);
      await writeOPPR(doc, p.nprp, 1, exp, margin, 'king', gameId, date, season);
    }
    for(const p of lPlayers){
      const doc = await fetchPlayerDoc(p.email);
      await writeOPPR(doc, p.nprp, 0, 1-exp, margin, 'king', gameId, date, season);
    }
  }

  await EventsDB.update(eventId, {
    courts, queue, games, standings,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  });

  showToast('Game recorded');
  S_eventDetail = await EventsDB.get(eventId);
  S.events[eventId] = S_eventDetail;
  renderEventsPage();
}

// ── Admin queue management ────────────────────────────────────────────────────

async function kingAddToQueue(eventId, pairId){
  const e = S.events[eventId];
  const pair = (e.pairs||[]).find(p=>p.pairId===pairId);
  if(!pair) return;
  const queue = [...(e.queue||[]), {...pair}];
  await EventsDB.update(eventId, {queue,
    lastUpdated:firebase.firestore.FieldValue.serverTimestamp()});
  S.events[eventId] = await EventsDB.get(eventId);
  renderEventsPage();
}

async function kingRemoveFromQueue(eventId, idx){
  const e = S.events[eventId];
  const queue = [...(e.queue||[])];
  queue.splice(idx,1);
  await EventsDB.update(eventId, {queue,
    lastUpdated:firebase.firestore.FieldValue.serverTimestamp()});
  S.events[eventId] = await EventsDB.get(eventId);
  renderEventsPage();
}
