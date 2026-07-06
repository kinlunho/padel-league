const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../service-account.json')) });
const db   = admin.firestore();
const auth = admin.auth();

const ADMIN_EMAILS = new Set([
  'kinlunho@gmail.com',
  'brianklaassen1@gmail.com',
  'rayco_ramses@hotmail.com',
]);

async function clearCollection(name){
  const snap = await db.collection(name).get();
  if(snap.empty){ console.log(`  ✓ ${name}: empty`); return; }
  const chunks = [];
  for(let i=0;i<snap.docs.length;i+=400) chunks.push(snap.docs.slice(i,i+400));
  for(const chunk of chunks){ const b=db.batch(); chunk.forEach(d=>b.delete(d.ref)); await b.commit(); }
  console.log(`  ✓ ${name}: deleted ${snap.size}`);
}

async function clearEvents(){
  const snap = await db.collection('events').get();
  if(snap.empty){ console.log('  ✓ events: empty'); return; }
  for(const doc of snap.docs){
    const rounds = await doc.ref.collection('rounds').get();
    if(!rounds.empty){
      const chunks = [];
      for(let i=0;i<rounds.docs.length;i+=400) chunks.push(rounds.docs.slice(i,i+400));
      for(const chunk of chunks){ const b=db.batch(); chunk.forEach(d=>b.delete(d.ref)); await b.commit(); }
    }
  }
  const chunks = [];
  for(let i=0;i<snap.docs.length;i+=400) chunks.push(snap.docs.slice(i,i+400));
  for(const chunk of chunks){ const b=db.batch(); chunk.forEach(d=>b.delete(d.ref)); await b.commit(); }
  console.log(`  ✓ events (+rounds): deleted ${snap.size} events`);
}

async function clearPlayers(){
  const adminSnaps = await Promise.all(
    [...ADMIN_EMAILS].map(email =>
      db.collection('players').where('email','==',email).limit(1).get()
    )
  );
  const adminUids = new Set(adminSnaps.flatMap(s=>s.docs.map(d=>d.id)));
  const snap = await db.collection('players').get();
  if(snap.empty){ console.log('  ✓ players: empty'); return; }
  const toDelete = snap.docs.filter(d=>!adminUids.has(d.id));
  if(!toDelete.length){ console.log('  ✓ players: only admin profiles, nothing deleted'); return; }
  const chunks = [];
  for(let i=0;i<toDelete.length;i+=400) chunks.push(toDelete.slice(i,i+400));
  for(const chunk of chunks){ const b=db.batch(); chunk.forEach(d=>b.delete(d.ref)); await b.commit(); }
  console.log(`  ✓ players: deleted ${toDelete.length} (preserved ${adminUids.size} admin profiles)`);
}

async function run(){
  console.log('\n⚠  WIPE STARTING IN 3s — Ctrl+C to abort\n');
  await new Promise(r=>setTimeout(r,3000));
  await clearCollection('teams');
  await clearCollection('matches');
  await clearCollection('teamMembers');
  await clearCollection('knockouts');
  const ref = db.collection('config').doc('league');
  if((await ref.get()).exists) await ref.update({seasonLocked:false});
  console.log('  ✓ config: seasonLocked reset');
  await clearEvents();
  await clearCollection('oplrUnlinked');
  await clearPlayers();
  let deleted=0, token;
  do {
    const r = await auth.listUsers(1000,token);
    const uids = r.users.filter(u=>!ADMIN_EMAILS.has(u.email)).map(u=>u.uid);
    if(uids.length){ await auth.deleteUsers(uids); deleted+=uids.length; }
    token = r.pageToken;
  } while(token);
  console.log(`  ✓ Auth: deleted ${deleted} users`);
  console.log('\n✅ WIPE COMPLETE — system ready for real captain onboarding\n');
  process.exit(0);
}

run().catch(e=>{ console.error('\n✗ FAILED:',e.message); process.exit(1); });
