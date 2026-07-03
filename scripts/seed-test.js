const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../service-account.json')) });
const db   = admin.firestore();
const auth = admin.auth();
const SEASON = '2026-summer';

const TEST_CAPTAINS = [
  { email:'gold-captain1@test.hk',   displayName:'Alex Wong',   teamName:'The Smashers',    group:'Gold Division',        nprp1:'3.5', nprp2:'3.0' },
  { email:'gold-captain2@test.hk',   displayName:'Brian Lee',   teamName:'Net Ninjas',       group:'Gold Division',        nprp1:'4.0', nprp2:'3.5' },
  { email:'silver-captain1@test.hk', displayName:'David Chan',  teamName:'Silver Bullets',   group:'High Silver Division', nprp1:'3.0', nprp2:'2.5' },
  { email:'silver-captain2@test.hk', displayName:'Emma Ho',     teamName:'Drop Shot Kings',  group:'High Silver Division', nprp1:'2.5', nprp2:'2.5' },
  { email:'low-captain1@test.hk',    displayName:'Frank Yip',   teamName:'Baseline Crew',    group:'Low Silver Division',  nprp1:'2.0', nprp2:'1.5' },
];
const TEST_VIEWER = { email:'viewer1@test.hk', displayName:'Grace Lam' };
const EXTRA_TEAMS = [
  { name:'Ace Force',       group:'Gold Division',        email:'ace@test.hk',      nprp:'3.5' },
  { name:'Court Crushers',  group:'Gold Division',        email:'court@test.hk',    nprp:'3.0' },
  { name:'Rally Rebels',    group:'High Silver Division', email:'rally@test.hk',    nprp:'2.5' },
  { name:'Padel Pros',      group:'High Silver Division', email:'pros@test.hk',     nprp:'3.0' },
  { name:'New Starters',    group:'Low Silver Division',  email:'starters@test.hk', nprp:'1.5' },
  { name:'Weekend Warriors',group:'Low Silver Division',  email:'warriors@test.hk', nprp:'2.0' },
];

function phone(s){ let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))&0xffffffff; return '9'+String(Math.abs(h)%900+100)+' '+String(Math.abs(h>>4)%9000+1000); }
function code(){ const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<6;i++) s+=c[Math.floor(Math.random()*c.length)]; return s; }

async function getOrCreate(email, displayName, role){
  let uid;
  try { uid=(await auth.getUserByEmail(email)).uid; console.log(`  EXISTS: ${email}`); }
  catch(e){ uid=(await auth.createUser({email,password:'TestPass2026!',displayName})).uid; console.log(`  CREATED: ${email}`); }
  await auth.setCustomUserClaims(uid,{role});
  return uid;
}

async function run(){
  const batch = db.batch();

  // Viewer
  const vuid = await getOrCreate(TEST_VIEWER.email, TEST_VIEWER.displayName, 'viewer');
  batch.set(db.collection('users').doc(vuid),{uid:vuid,email:TEST_VIEWER.email,displayName:TEST_VIEWER.displayName,role:'viewer'},{merge:true});

  // Captains + their teams
  for(const u of TEST_CAPTAINS){
    const uid = await getOrCreate(u.email, u.displayName, 'captain');
    batch.set(db.collection('users').doc(uid),{uid,email:u.email,displayName:u.displayName,role:'captain'},{merge:true});
    const tid = u.teamName.replace(/[^a-zA-Z0-9]/g,'').toLowerCase().slice(0,20);
    batch.set(db.collection('teams').doc(tid),{
      id:tid, name:u.teamName, group:u.group, season:SEASON,
      email:u.email, captainUid:uid, captainEmail:u.email,
      players:[
        {pid:tid+'_p1',name:u.displayName,phone:phone(tid+'_p1'),nprp:u.nprp1,claimCode:code(),claimedByEmail:u.email},
        {pid:tid+'_p2',name:'Partner of '+u.teamName,phone:phone(tid+'_p2'),nprp:u.nprp2,claimCode:code(),claimedByEmail:null},
      ]
    });
    batch.set(db.collection('teamMembers').doc(`${uid}_${SEASON}`),{uid,season:SEASON,teamId:tid,teamName:u.teamName,role:'captain'});
    console.log(`    → ${u.teamName} (${u.group})`);
  }

  // Extra teams (no accounts)
  for(const t of EXTRA_TEAMS){
    const tid = t.name.replace(/[^a-zA-Z0-9]/g,'').toLowerCase().slice(0,20);
    batch.set(db.collection('teams').doc(tid),{
      id:tid, name:t.name, group:t.group, season:SEASON,
      email:t.email, captainUid:null, captainEmail:t.email,
      players:[
        {pid:tid+'_p1',name:'Captain ('+t.name+')',phone:phone(tid+'_p1'),nprp:t.nprp,claimCode:code(),claimedByEmail:null},
        {pid:tid+'_p2',name:'Player 2 ('+t.name+')',phone:phone(tid+'_p2'),nprp:t.nprp,claimCode:code(),claimedByEmail:null},
      ]
    });
    console.log(`  TEAM (no account): ${t.name} (${t.group})`);
  }

  await batch.commit();
  console.log('\n✅ All done.\n');
  console.log('11 teams across 3 divisions:');
  console.log('  Gold Division (4):        The Smashers, Net Ninjas, Ace Force, Court Crushers');
  console.log('  High Silver Division (4): Silver Bullets, Drop Shot Kings, Rally Rebels, Padel Pros');
  console.log('  Low Silver Division (3):  Baseline Crew, New Starters, Weekend Warriors');
  console.log('\nCaptain accounts — password: TestPass2026!');
  TEST_CAPTAINS.forEach(u=>console.log(`  ${u.email}  →  ${u.teamName}`));
  console.log(`\nViewer account:`);
  console.log(`  ${TEST_VIEWER.email}  (TestPass2026!)`);
  process.exit(0);
}
run().catch(e=>{console.error(e);process.exit(1);});
