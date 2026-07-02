// src/scoring.js
// Score-result calculation, set-score validation, and standings/tiebreaker math.

// ════════ SCORING ENGINE ════════
// Returns {pts1, pts2, gw1, gw2, result:'win1'|'win2'|'draw'}
function calcResult(sd){
  if(!sd) return null;
  if(sd.gamesOnly){
    const g1=sd.g1||0,g2=sd.g2||0;
    if(g1>g2) return {pts1:3,pts2:0,gw1:g1,gw2:g2,result:'win1'};
    if(g2>g1) return {pts1:0,pts2:3,gw1:g1,gw2:g2,result:'win2'};
    return {pts1:1,pts2:1,gw1:g1,gw2:g2,result:'draw'};
  }
  // Set mode — compute games
  const g1=(sd.s1t1||0)+(sd.s2t1||0);
  const g2=(sd.s1t2||0)+(sd.s2t2||0);
  // Determine set winners
  const sw1=(sd.s1t1>sd.s1t2?1:0)+(sd.s2t1>sd.s2t2?1:0);
  const sw2=(sd.s1t2>sd.s1t1?1:0)+(sd.s2t2>sd.s2t1?1:0);
  // If STB played
  let winner;
  if(sd.stb&&sd.stb1!==null){
    winner=sd.stb1>sd.stb2?'win1':'win2';
  } else {
    if(sw1>sw2) winner='win1';
    else if(sw2>sw1) winner='win2';
    else{ // shouldn't happen without STB but fallback to games
      winner=g1>g2?'win1':g2>g1?'win2':'draw';
    }
  }
  if(winner==='win1') return {pts1:3,pts2:0,gw1:g1,gw2:g2,result:'win1'};
  if(winner==='win2') return {pts1:0,pts2:3,gw1:g1,gw2:g2,result:'win2'};
  return {pts1:1,pts2:1,gw1:g1,gw2:g2,result:'draw'};
}

function scoreDisplay(m){
  if(!m.scoreData) return '';
  const sd=m.scoreData;
  if(sd.gamesOnly) return `${sd.g1}–${sd.g2} <span style="color:var(--warn);font-size:10px;">(games)</span>`;
  let s=`${sd.s1t1}–${sd.s1t2} &nbsp; ${sd.s2t1}–${sd.s2t2}`;
  if(sd.stb&&sd.stb1!==null) s+=` &nbsp; <span style="color:var(--gold);">STB ${sd.stb1}–${sd.stb2}</span>`;
  return s;
}

// ════════ STANDINGS ════════
function getStandings(group){
  const teams=teamsByGroup(group);
  const st={};
  teams.forEach(t=>{st[t.id]={id:t.id,name:t.name,p:0,w:0,d:0,l:0,gw:0,gl:0,pts:0};});

  const groupMatches=Object.values(S.matches).filter(m=>m.group===group&&m.status==='confirmed'&&m.scoreData);

  groupMatches.forEach(m=>{
    if(!st[m.t1]||!st[m.t2]) return;
    const r=calcResult(m.scoreData);
    if(!r) return;
    st[m.t1].p++; st[m.t2].p++;
    st[m.t1].gw+=r.gw1; st[m.t1].gl+=r.gw2;
    st[m.t2].gw+=r.gw2; st[m.t2].gl+=r.gw1;
    if(r.result==='win1'){st[m.t1].w++;st[m.t1].pts+=3;st[m.t2].l++;}
    else if(r.result==='win2'){st[m.t2].w++;st[m.t2].pts+=3;st[m.t1].l++;}
    else{st[m.t1].d++;st[m.t1].pts++;st[m.t2].d++;st[m.t2].pts++;}
  });

  const arr=Object.values(st);
  // Sort with full tiebreaker chain
  arr.sort((a,b)=>{
    if(b.pts!==a.pts) return b.pts-a.pts;
    // H2H pts
    const h2h=(x,y)=>{
      let p=0;
      groupMatches.filter(m=>(m.t1===x.id&&m.t2===y.id)||(m.t1===y.id&&m.t2===x.id)).forEach(m=>{
        const r=calcResult(m.scoreData);
        if(!r) return;
        if(m.t1===x.id) p+=(r.result==='win1'?3:r.result==='draw'?1:0);
        else p+=(r.result==='win2'?3:r.result==='draw'?1:0);
      });
      return p;
    };
    const h2hA=h2h(a,b), h2hB=h2h(b,a);
    if(h2hA!==h2hB) return h2hB-h2hA;
    // H2H GD
    const h2hGD=(x,y)=>{
      let gd=0;
      groupMatches.filter(m=>(m.t1===x.id&&m.t2===y.id)||(m.t1===y.id&&m.t2===x.id)).forEach(m=>{
        const r=calcResult(m.scoreData);
        if(!r) return;
        gd+=(m.t1===x.id?r.gw1-r.gw2:r.gw2-r.gw1);
      });
      return gd;
    };
    const gdA=h2hGD(a,b),gdB=h2hGD(b,a);
    if(gdA!==gdB) return gdB-gdA;
    // Overall GD
    const gdOA=(a.gw-a.gl),gdOB=(b.gw-b.gl);
    if(gdOA!==gdOB) return gdOB-gdOA;
    // Total GW
    if(a.gw!==b.gw) return b.gw-a.gw;
    return 0; // coin toss
  });
  return arr;
}

