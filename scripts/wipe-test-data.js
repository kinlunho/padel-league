const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../service-account.json')) });
const db = admin.firestore();
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

async function run(){
  console.log('Wiping in 3s... Ctrl+C to abort');
  await new Promise(r=>setTimeout(r,3000));
  await clearCollection('teams');
  await clearCollection('matches');
  await clearCollection('teamMembers');
  await clearCollection('knockouts');
  const ref = db.collection('config').doc('league');
  if((await ref.get()).exists) await ref.update({seasonLocked:false});
  console.log('  ✓ config: seasonLocked reset');
  let deleted=0, token;
  do {
    const r = await auth.listUsers(1000,token);
    const uids = r.users.filter(u=>!ADMIN_EMAILS.has(u.email)).map(u=>u.uid);
    if(uids.length){ await auth.deleteUsers(uids); deleted+=uids.length; }
    token = r.pageToken;
  } while(token);
  console.log(`  ✓ Auth: deleted ${deleted} users`);
  console.log('\nWIPE COMPLETE');
  process.exit(0);
}
run().catch(e=>{ console.error('FAILED:',e.message); process.exit(1); });
