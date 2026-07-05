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

  // Pair consecutive players: [0,1] vs [2,3], [4,5] vs [6,7] etc.
  const matches = [];
  const courts  = event.courts || 1;
  let courtIdx  = 1;

  for(let i=0; i+3<ordered.length; i+=4){
    const teamA = [ordered[i],   ordered[i+1]];
    const teamB = [ordered[i+2], ordered[i+3]];
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

  // Bye if odd player count (shouldn't happen with even registration, but safety net)
  if(ordered.length % 2 !== 0){
    const byePlayer = ordered[ordered.length-1];
    matches.push({
      matchId:    `r${roundNumber}_bye`,
      roundNumber,
      isBye:      true,
      byeUid:     byePlayer.uid,
      byeName:    byePlayer.name,
    });
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
        // Bye player gets walkover points
        if(standings[m.byeUid]){
          standings[m.byeUid].points += 2; // walkover = 2 points
        }
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
  await EventsDB.update(eventId, { standings: standingsMap });

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
