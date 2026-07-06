// src/data/events.js
// Event data layer — Mexicano, Americano, King of the Court
// Collection: /events/{eventId}
// Subcollection: /events/{eventId}/rounds/{roundId}

const EventsDB = {

  async create(data){
    const id = `event_${Date.now()}`;
    await db.collection('events').doc(id).set({
      id, ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'open',      // open | active | complete
      currentRound: 0,
      standings: {},       // {uid: {points, gamesWon, gamesLost, played, withdrawn}}
      participants: (data.players||[]).map(p=>p.uid).filter(Boolean),
    });
    return id;
  },

  async get(eventId){
    const snap = await db.collection('events').doc(eventId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  },

  async update(eventId, fields){
    await db.collection('events').doc(eventId).update(fields);
  },

  async listActive(){
    const snap = await db.collection('events')
      .where('status','in',['open','active'])
      .orderBy('date','desc')
      .limit(20).get();
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  },

  async listAll(){
    const snap = await db.collection('events')
      .orderBy('date','desc')
      .limit(50).get();
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  },

  async listByParticipant(uid){
    const snap = await db.collection('events')
      .where('participants','array-contains',uid)
      .orderBy('date','desc')
      .limit(50).get();
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  },

  async saveRound(eventId, roundId, data){
    await db.collection('events').doc(eventId)
      .collection('rounds').doc(String(roundId)).set(data, {merge:true});
  },

  async getRounds(eventId){
    const snap = await db.collection('events').doc(eventId)
      .collection('rounds').orderBy('roundNumber').get();
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  },

  subscribe(onData){
    return db.collection('events')
      .orderBy('date','desc')
      .onSnapshot(snap=>{
        S.events = {};
        snap.forEach(d=>{ S.events[d.id]={id:d.id,...d.data()}; });
        onData();
      }, err=>{ console.error('EventsDB error:',err.message); onData(); });
  }
};
