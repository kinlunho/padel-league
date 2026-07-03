// src/roundrobin.js
// Round-robin fixture generation (circle method) and the Generate Fixtures action.

// ════════ FIXTURE GENERATOR ════════
// Standard circle-method round-robin. Returns array of rounds; each round is an array of [teamA, teamB] pairs.
// Odd team counts get a bye each round (one team sits out), handled by padding with null.
function generateRoundRobinPairs(teamIds){
  let ids=[...teamIds];
  if(ids.length%2!==0) ids.push(null); // bye slot
  const n=ids.length;
  const fixed=ids[0];
  let rotating=ids.slice(1);
  const rounds=[];
  for(let r=0;r<n-1;r++){
    const roundTeams=[fixed,...rotating];
    const pairs=[];
    for(let i=0;i<n/2;i++){
      const t1=roundTeams[i], t2=roundTeams[n-1-i];
      if(t1!==null&&t2!==null) pairs.push([t1,t2]);
    }
    rounds.push(pairs);
    rotating.unshift(rotating.pop());
  }
  return rounds;
}

async function generateFixtures(group){
  const existing=Object.values(S.matches).filter(m=>m.group===group&&m.round);
  if(existing.length){showToast('Fixtures already generated for this group',true);return;}
  const teams=teamsByGroup(group);
  if(teams.length<3){showToast('Need at least 3 teams to generate fixtures',true);return;}
  const rounds=generateRoundRobinPairs(teams.map(t=>t.id));
  const allMatches={};
  rounds.forEach((pairs,ri)=>{
    pairs.forEach(([t1,t2])=>{
      const [a,b]=[t1,t2].sort();
      const id=`${a}_vs_${b}_r${ri+1}`;
      allMatches[id]={id,group,t1,t2,date:null,time:null,court:null,round:ri+1,season:ACTIVE_SEASON,status:'unclaimed',scoreData:null,submittedBy:null,notes:''};
    });
  });
  try {
    await MatchesDB.seedAll(allMatches);
    addLog(`Fixtures generated for ${group}: ${Object.keys(allMatches).length} matches across ${rounds.length} rounds`,'var(--brand)');
    showToast(`${Object.keys(allMatches).length} fixtures generated across ${rounds.length} rounds`);
  } catch(err){
    showToast('Failed to generate fixtures: ' + err.message, true);
  }
}

// Round-gating was removed entirely (previously: isTeamClearedThroughRound/isMatchOpen).
// Two versions of it existed and both were wrong for the same underlying reason: "round" is
// an artifact of how the circle-method algorithm GENERATES a complete non-repeating pairing
// set — it guarantees every team plays every other exactly once, nothing more. It was never a
// competition rule about play order, and the published league rules say nothing about
// sequencing either (only round-robin, weekend-only, captain-agreed, first-come-first-served).
// Group-wide gating blocked an entire division on its slowest pair. Per-team gating was
// narrower but still blocked a captain from playing their round-5 opponent this Saturday just
// because their round-2 opponent hasn't been scheduled yet, even with both teams free and a
// court open. Neither restriction prevents anything real: the fixture list already guarantees
// no duplicate opponents and no double-booking (both enforced elsewhere), so there is nothing
// left for round-order to protect against. A team's unclaimed fixtures are simply all open,
// all the time, in whatever order captains can actually coordinate them.


