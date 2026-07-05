/**
 * seed-test.js
 * Creates test accounts, teams and player profile docs for end-to-end testing.
 * NPRP ratings are spread across 1-7 to test division seeding properly.
 *
 * Usage: node scripts/seed-test.js
 * Password for all test accounts: TestPass2026!
 */
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../service-account.json')) });
const db   = admin.firestore();
const auth = admin.auth();
const SEASON = '2026-summer';
const PWD    = 'TestPass2026!';

// ── Test data ─────────────────────────────────────────────────────────────────
// NPRP spread deliberately crosses division boundaries to test auto-seeding:
//   Gold (avg ≥4.0), High Silver (3.0–3.99), Low Silver (<3.0)

const CAPTAINS = [
  // Gold — avg ≥4.0
  { email:'gold-cap1@test.hk', name:'Alex Wong',   team:'The Smashers',   group:'Gold Division',
    players:[{name:'Alex Wong',   nprp:'5.0'},{name:'Brian Lee',   nprp:'4.5'},{name:'Chris Ma', nprp:'4.0'}] },
  { email:'gold-cap2@test.hk', name:'David Chan',  team:'Net Ninjas',     group:'Gold Division',
    players:[{name:'David Chan',  nprp:'4.5'},{name:'Eric Lau',   nprp:'4.0'}] },
  // High Silver — avg 3.0–3.99
  { email:'silver-cap1@test.hk', name:'Frank Yip', team:'Silver Bullets', group:'High Silver Division',
    players:[{name:'Frank Yip',   nprp:'3.5'},{name:'Grace Ho',   nprp:'3.0'},{name:'Henry Ng', nprp:'2.5'}] },
  { email:'silver-cap2@test.hk', name:'Irene Mok', team:'Drop Shot Kings',group:'High Silver Division',
    players:[{name:'Irene Mok',   nprp:'3.5'},{name:'Jack Tam',   nprp:'3.0'}] },
  // Low Silver — avg <3.0
  { email:'low-cap1@test.hk',  name:'Kelly Chan',  team:'Baseline Crew',  group:'Low Silver Division',
    players:[{name:'Kelly Chan',  nprp:'2.5'},{name:'Leo Wong',   nprp:'2.0'}] },
];

// Extra teams (no captain accounts — tests admin assign flow)
const EXTRA_TEAMS = [
  { name:'Ace Force',        group:'Gold Division',        players:[{name:'Cap Ace',  nprp:'4.5'},{name:'P2 Ace',  nprp:'4.0'}] },
  { name:'Court Crushers',   group:'Gold Division',        players:[{name:'Cap Court',nprp:'4.0'},{name:'P2 Court',nprp:'3.5'}] },
  { name:'Rally Rebels',     group:'High Silver Division', players:[{name:'Cap Rally', nprp:'3.5'},{name:'P2 Rally',nprp:'3.0'}] },
  { name:'Padel Pros',       group:'High Silver Division', players:[{name:'Cap Pros',  nprp:'3.0'},{name:'P2 Pros', nprp:'2.5'}] },
  { name:'New Starters',     group:'Low Silver Division',  players:[{name:'Cap New',   nprp:'2.0'},{name:'P2 New', nprp:'1.5'}] },
  { name:'Weekend Warriors', group:'Low Silver Division',  players:[{name:'Cap Week',  nprp:'2.5'},{name:'P2 Week',nprp:'1.5'}] },
];

const VIEWER = { email:'viewer1@test.hk', name:'Grace Lam' };

// ── Helpers ───────────────────────────────────────────────────────────────────
function slug(s){ return s.replace(/[^a-zA-Z0-9]/g,'').toLowerCase().slice(0,20); }
function phone(s){ let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))&0xffffffff; return '9'+String(Math.abs(h)%900+100)+' '+String(Math.abs(h>>4)%9000+1000); }
function claimCode(){ const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<6;i++) s+=c[Math.floor(Math.random()*c.length)]; return s; }

async function getOrCreate(email, name, role){
  let uid;
  try { uid=(await auth.getUserByEmail(email)).uid; console.log(`  EXISTS  ${email}`); }
  catch(e){ uid=(await auth.createUser({email,password:PWD,displayName:name})).uid; console.log(`  CREATED ${email}`); }
  await auth.setCustomUserClaims(uid,{role});
  return uid;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run(){
  console.log('\n── Creating accounts ────────────────────────────────────────');
  const vuid = await getOrCreate(VIEWER.email, VIEWER.name, 'viewer');

  const captainUids = {};
  for(const c of CAPTAINS){
    captainUids[c.email] = await getOrCreate(c.email, c.name, 'captain');
  }

  console.log('\n── Writing Firestore docs ───────────────────────────────────');
  const batch1 = db.batch();

  // Viewer user doc + player profile
  batch1.set(db.collection('users').doc(vuid),
    {uid:vuid,email:VIEWER.email,displayName:VIEWER.name,role:'viewer'},{merge:true});
  batch1.set(db.collection('players').doc(vuid),
    {uid:vuid,email:VIEWER.email,displayName:VIEWER.name,hand:null,position:null,photoURL:null,nprpHistory:[],createdAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});

  // Captain teams + player profiles
  for(const c of CAPTAINS){
    const uid = captainUids[c.email];
    const tid = slug(c.team);

    // Build player array with claim codes
    const players = c.players.map((p,i) => ({
      pid: `${tid}_p${i}`,
      name: p.name,
      phone: phone(`${tid}_p${i}`),
      nprp: p.nprp,
      claimCode: claimCode(),
      claimedByEmail: i===0 ? c.email : null
    }));

    batch1.set(db.collection('teams').doc(tid),{
      id:tid, name:c.team, group:c.group, season:SEASON,
      email:c.email, captainUid:uid, captainEmail:c.email,
      players, createdAt:admin.firestore.FieldValue.serverTimestamp()
    });
    batch1.set(db.collection('teamMembers').doc(`${uid}_${SEASON}`),
      {uid,season:SEASON,teamId:tid,teamName:c.team,role:'captain'});
    batch1.set(db.collection('users').doc(uid),
      {uid,email:c.email,displayName:c.name,role:'captain'},{merge:true});

    // Player profile doc for captain
    batch1.set(db.collection('players').doc(uid),{
      uid, email:c.email, displayName:c.name,
      hand: ['right','right','left','right','right'][CAPTAINS.indexOf(c)],
      position: ['right','left','right','left','right'][CAPTAINS.indexOf(c)],
      photoURL: null,
      nprpHistory: [], // populated at fixture generation
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    },{merge:true});

    console.log(`  ${c.team.padEnd(20)} ${c.group.padEnd(25)} avg NPRP: ${(c.players.slice(0,Math.min(3,c.players.length)).reduce((s,p)=>s+parseFloat(p.nprp),0)/Math.min(3,c.players.length)).toFixed(2)}`);
  }

  // Extra teams
  for(const t of EXTRA_TEAMS){
    const tid = slug(t.name);
    const players = t.players.map((p,i)=>({
      pid:`${tid}_p${i}`,name:p.name,phone:phone(`${tid}_p${i}`),
      nprp:p.nprp,claimCode:claimCode(),claimedByEmail:null
    }));
    batch1.set(db.collection('teams').doc(tid),{
      id:tid,name:t.name,group:t.group,season:SEASON,
      email:`${tid}@test.hk`,captainUid:null,captainEmail:null,
      players,createdAt:admin.firestore.FieldValue.serverTimestamp()
    });
    const avg=(t.players.slice(0,Math.min(3,t.players.length)).reduce((s,p)=>s+parseFloat(p.nprp),0)/Math.min(3,t.players.length)).toFixed(2);
    console.log(`  ${t.name.padEnd(20)} ${t.group.padEnd(25)} avg NPRP: ${avg}`);
  }

  await batch1.commit();

  console.log('\n── Summary ──────────────────────────────────────────────────');
  console.log('11 teams across 3 divisions:');
  console.log('  Gold (4):        The Smashers, Net Ninjas, Ace Force, Court Crushers');
  console.log('  High Silver (4): Silver Bullets, Drop Shot Kings, Rally Rebels, Padel Pros');
  console.log('  Low Silver (3):  Baseline Crew, New Starters, Weekend Warriors');
  console.log('\nTest accounts — password:', PWD);
  CAPTAINS.forEach(c=>console.log(`  ${c.email.padEnd(28)} → ${c.team}`));
  console.log(`  ${VIEWER.email.padEnd(28)} → viewer only`);
  console.log('\nNPRP seeding test:');
  console.log('  All teams are pre-assigned to divisions.');
  console.log('  To test NPRP auto-seeding: Admin → Teams → set all to Unassigned,');
  console.log('  then click "Auto-assign Unassigned" and verify divisions match NPRP averages.');
  console.log('\n✅ Seed complete\n');
  process.exit(0);
}

run().catch(e=>{ console.error('\n✗ FAILED:', e.message); process.exit(1); });
