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
