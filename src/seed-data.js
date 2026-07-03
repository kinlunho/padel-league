// src/seed-data.js
// Demo/seed data: real team entrants, generated fixtures, pre-season state.
// IMPORTANT: All IDs are deterministic (derived from name/teams/round), NOT random.
// This means running seedData() + seedAll() twice is safe — it overwrites the same
// Firestore documents rather than creating duplicates. Random IDs caused the 62-team
// duplication bug; this version cannot reproduce that problem.

// ════════ SEED DATA ════════
function seedData(){
  const groupDefs={
    'Gold Division':['SIX-SEVEN','PADEL PALAS','SHARKS','DHURANDHAR','JAMON IBERICO','DONUT DISPENSARY','ROCK X','BAGEL SHOP','3 LIONS','SMASH MASTERS'],
    'High Silver Division':['FAMILY MART','SING YUK KEUNG','LOLLI-LOB','PETTA REDDAST','PIKAPIKA','PADELICIOUS','AK47','NO IDEA','SUNFLOWER','PADEL CARTEL','YOUTH POWER'],
    'Low Silver Division':['N.W.P','Badly in Padel',"ANDY'S FRIENDS",'TINTIN PADEL','CH2','FOUR BROS NO GRIDS','SIR','THURSDAY NIGHT BALL','LOW INTERMEDIATE','CRAZY BOYS'],
  };

  function fakePhone(seed){ 
    // Deterministic fake phone from seed string so re-runs produce same numbers
    let h=0; for(const c of seed) h=(h*31+c.charCodeAt(0))&0xffffffff;
    return '9'+String(Math.abs(h)%900+100)+' '+String(Math.abs(h>>4)%9000+1000);
  }

  S.teams={};
  Object.entries(groupDefs).forEach(([g,names])=>{
    names.forEach((name,i)=>{
      // Deterministic ID from slug — same team always gets same Firestore document ID
      const id=name.replace(/[^a-zA-Z0-9]/g,'').toLowerCase().slice(0,20);
      const slug=id;
      S.teams[id]={
        id,name,
        email:slug+'@theone-padel.hk',
        group:g,
        season:ACTIVE_SEASON,
        players:[
          {pid:slug+'_p1',name:`Captain ${i*2+1}`,phone:fakePhone(slug+'_p1'),claimCode:genClaimCode(),claimedByEmail:null},
          {pid:slug+'_p2',name:`Player ${i*2+2}`,phone:fakePhone(slug+'_p2'),claimCode:genClaimCode(),claimedByEmail:null}
        ]
      };
    });
  });

  S.matches={};
  Object.keys(groupDefs).forEach(g=>{
    const teamIds=teamsByGroup(g).map(t=>t.id);
    const rounds=generateRoundRobinPairs(teamIds);
    rounds.forEach((pairs,ri)=>{
      pairs.forEach(([t1,t2])=>{
        // Deterministic match ID from the two team IDs and round number
        const id=`${t1}_vs_${t2}_r${ri+1}`;
        S.matches[id]={id,group:g,t1,t2,date:null,time:null,court:null,round:ri+1,season:ACTIVE_SEASON,status:'unclaimed',scoreData:null,submittedBy:null,notes:''};
      });
    });
  });

  // Pre-schedule a handful of Round 1 fixtures for demo purposes
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
