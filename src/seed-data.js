// src/seed-data.js
// Demo/seed data: real team entrants, generated fixtures, pre-season state.

// ════════ SEED DATA ════════
function seedData(){
  // Real entrant list transcribed from the league's actual sign-up sheet. Low Silver's list
  // appeared cut off at the bottom of the source screenshot — only the visible 10 teams are
  // seeded here; more may exist below what was captured.
  const groupDefs={
    'Gold Division':['SIX-SEVEN','PADEL PALAS','SHARKS','DHURANDHAR','JAMON IBERICO','DONUT DISPENSARY','ROCK X','BAGEL SHOP','3 LIONS','SMASH MASTERS'],
    'High Silver Division':['FAMILY MART','SING YUK KEUNG','LOLLI-LOB','PETTA REDDAST','PIKAPIKA','PADELICIOUS','AK47','NO IDEA','SUNFLOWER','PADEL CARTEL','YOUTH POWER'],
    'Low Silver Division':['N.W.P','Badly in Padel',"ANDY'S FRIENDS",'TINTIN PADEL','CH2','FOUR BROS NO GRIDS','SIR','THURSDAY NIGHT BALL','LOW INTERMEDIATE','CRAZY BOYS'],
  };

  // Player names and phone numbers were not part of the source data (only team names were
  // captured) — these are clearly-synthetic placeholders so every team has a testable roster.
  function fakePhone(){ return '9'+Math.floor(100+Math.random()*900)+' '+Math.floor(1000+Math.random()*9000); }
  Object.entries(groupDefs).forEach(([g,names])=>{
    names.forEach((name,i)=>{
      const id=uid();
      const slug=name.replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
      S.teams[id]={
        id,name,
        email:slug+'@theone-padel.hk',
        group:g,
        season:ACTIVE_SEASON,
        players:[
          {pid:uid(),name:`Captain ${i*2+1}`,phone:fakePhone(),claimCode:genClaimCode(),claimedByEmail:null},
          {pid:uid(),name:`Player ${i*2+2}`,phone:fakePhone(),claimCode:genClaimCode(),claimedByEmail:null}
        ]
      };
    });
  });

  // Generate the full round-robin fixture list per division — this mirrors what "Generate
  // Round-Robin Fixtures" produces, done here upfront so the app isn't empty on first load.
  Object.keys(groupDefs).forEach(g=>{
    const teamIds=teamsByGroup(g).map(t=>t.id);
    const rounds=generateRoundRobinPairs(teamIds);
    rounds.forEach((pairs,ri)=>{
      pairs.forEach(([t1,t2])=>{
        const id=uid();
        S.matches[id]={id,group:g,t1,t2,date:null,time:null,court:null,round:ri+1,season:ACTIVE_SEASON,status:'unclaimed',scoreData:null,submittedBy:null,notes:''};
      });
    });
  });

  // The season starts 11 Jul 2026 — nothing has been played yet at this point in time, so no
  // results are seeded. A small number of Round 1 fixtures per division are claimed (given a
  // date/time/court) to demonstrate the scheduling flow without fabricating a false history.
  const dates=leagueDates();
  Object.keys(groupDefs).forEach((g,gi)=>{
    const round1=Object.values(S.matches).filter(m=>m.group===g&&m.round===1);
    round1.slice(0,3).forEach((m,i)=>{
      const court=(i%2)+1;
      const time=TIMES[(gi+i)%4];
      const conflict=Object.values(S.matches).find(x=>x.date===dates[0]&&x.time===time&&x.court===court);
      if(!conflict){
        S.matches[m.id]={...m,date:dates[0],time,court,status:'scheduled'};
      }
    });
  });
}

