// src/oplr.js
// OnePadel Player Rating (OPPR) engine.
// Unified rating across all formats — league matches, Mexicano, Americano, King of the Court.
//
// Formula:
//   Rating change = K_base * format_multiplier * (actual - expected) * margin_factor
//
// K_base (volatility by match count — total across ALL formats):
//   1–20  matches → 0.40 (calibration)
//   21–49 matches → 0.20 (active)
//   50+   matches → 0.08 (locked, hard cap ±0.20)
//
// Format multipliers (applied to K_base):
//   league     → 1.0  (full weight — confirmed by both captains)
//   mexicano   → 0.7  (standings-based pairing = meaningful signal)
//   americano  → 0.4  (fixed rotation = social)
//   king       → 0.3  (short rallies, high luck factor)
//
// Starting OPPR = player's NPRP (anchors to real skill level)
// Clamped to 1.0–7.0 at all times
// Stored in /players/{uid}.oplrHistory[] (field name kept as oplr* for Firestore compatibility)

const OPPR_K       = { calibration: 0.40, active: 0.20, locked: 0.08 };
const OPPR_FORMAT  = { league: 1.0, mexicano: 0.7, americano: 0.4, king: 0.3 };
const OPPR_MAX_MOVE_LOCKED = 0.20;
const OPPR_MIN = 1.0;
const OPPR_MAX = 7.0;

// ── Core math ─────────────────────────────────────────────────────────────────

function opprKBase(matchCount){
  if(matchCount < 21) return OPPR_K.calibration;
  if(matchCount < 50) return OPPR_K.active;
  return OPPR_K.locked;
}

function opprExpected(ratingA, ratingB){
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 2.5));
}

function opprMarginFactor(winnerGames, loserGames){
  const total = winnerGames + loserGames;
  if(!total) return 1.0;
  const ratio = winnerGames / total;
  return Math.max(0.6, Math.min(1.5, 0.6 + (ratio - 0.5) * 1.8));
}

function getPlayerOPPR(playerDoc, nprp){
  const h = playerDoc?.oplrHistory || [];
  if(!h.length) return parseFloat(nprp) || 3.5;
  return h[h.length - 1].oplr;
}

function getMatchCount(playerDoc){
  return (playerDoc?.oplrHistory || []).length;
}

function teamOPPR(playerDocs, nprps){
  const ratings = playerDocs
    .map((doc, i) => getPlayerOPPR(doc, nprps[i]))
    .sort((a,b) => b - a);
  const topN = playerDocs.length <= 2 ? 2 : 3;
  const slice = ratings.slice(0, Math.min(topN, ratings.length));
  return slice.reduce((s,r) => s+r, 0) / slice.length;
}

// ── Player doc fetch ──────────────────────────────────────────────────────────

async function fetchPlayerDoc(email){
  if(!email) return null;
  const snap = await db.collection('players').where('email','==',email).limit(1).get();
  return snap.empty ? null : { uid: snap.docs[0].id, ...snap.docs[0].data() };
}

async function fetchOrSyntheticDoc(player, teamId, idx){
  if(player.claimedByEmail) return fetchPlayerDoc(player.claimedByEmail);
  const pid = `${teamId}_p${idx}`;
  const snap = await db.collection('oplrUnlinked').doc(pid).get();
  if(snap.exists) return { uid: null, _syntheticId: pid, ...snap.data() };
  return { uid: null, _syntheticId: pid, oplrHistory: [], currentOPLR: null };
}

// ── Core write ────────────────────────────────────────────────────────────────

async function writeOPPR(playerDoc, nprp, actual, expected, margin, format, matchId, date, season){
  if(!playerDoc) return;
  const isLinked   = !!playerDoc.uid;
  const isSynthetic = !!playerDoc._syntheticId;
  if(!isLinked && !isSynthetic) return;

  const currentOPPR = getPlayerOPPR(playerDoc, nprp);
  const matchCount  = getMatchCount(playerDoc);
  const Kbase       = opprKBase(matchCount);
  const Kformat     = OPPR_FORMAT[format] || 1.0;
  let delta         = Kbase * Kformat * (actual - expected) * margin;

  if(matchCount >= 50){
    delta = Math.max(-OPPR_MAX_MOVE_LOCKED, Math.min(OPPR_MAX_MOVE_LOCKED, delta));
  }

  const newOPPR = Math.max(OPPR_MIN, Math.min(OPPR_MAX,
    Math.round((currentOPPR + delta) * 100) / 100
  ));

  const entry = {
    matchId, date, season, format,
    oplr: newOPPR,
    delta: Math.round(delta * 100) / 100,
    opponent: actual===1?'win':actual===0.5?'draw':'loss',
    kUsed: Math.round(Kbase * Kformat * 100) / 100,
  };

  if(isLinked){
    await db.collection('players').doc(playerDoc.uid).update({
      oplrHistory:  firebase.firestore.FieldValue.arrayUnion(entry),
      currentOPLR:  newOPPR
    });
  } else {
    await db.collection('oplrUnlinked').doc(playerDoc._syntheticId).set({
      oplrHistory:  firebase.firestore.FieldValue.arrayUnion(entry),
      currentOPLR:  newOPPR
    }, { merge: true });
  }
}

// ── League match OPPR update ──────────────────────────────────────────────────

async function updateOPPRForMatch(matchId){
  const m = S.matches[matchId];
  if(!m || m.status!=='confirmed' || !m.scoreData) return;
  if(m.oplrProcessed) return;

  const r = calcResult(m.scoreData);
  if(!r) return;

  const team1 = S.teams[m.t1];
  const team2 = S.teams[m.t2];
  if(!team1||!team2) return;

  const playedPids = m.players?.length ? new Set(m.players) : null;
  const getActive  = (team) => (team.players||[]).filter((_,i) =>
    !playedPids || playedPids.has(`${team.id}_p${i}`)
  );

  const t1Players = getActive(team1);
  const t2Players = getActive(team2);
  if(!t1Players.length||!t2Players.length) return;

  const t1Docs = await Promise.all(t1Players.map((p,i) => fetchOrSyntheticDoc(p, m.t1, i)));
  const t2Docs = await Promise.all(t2Players.map((p,i) => fetchOrSyntheticDoc(p, m.t2, i)));

  const t1OPPR = teamOPPR(t1Docs.filter(Boolean), t1Players.map(p=>p.nprp));
  const t2OPPR = teamOPPR(t2Docs.filter(Boolean), t2Players.map(p=>p.nprp));
  const exp1   = opprExpected(t1OPPR, t2OPPR);
  const act1   = r.result==='win1'?1:r.result==='draw'?0.5:0;
  const margin = opprMarginFactor(
    r.result==='win1'?r.gw1:r.gw2,
    r.result==='win1'?r.gw2:r.gw1
  );

  const date   = m.date || new Date().toISOString().split('T')[0];
  const season = m.season || ACTIVE_SEASON;

  await Promise.all([
    ...t1Docs.map((doc,i) => writeOPPR(doc, t1Players[i].nprp, act1,   exp1,   margin, 'league', matchId, date, season)),
    ...t2Docs.map((doc,i) => writeOPPR(doc, t2Players[i].nprp, 1-act1, 1-exp1, margin, 'league', matchId, date, season)),
  ]);

  await MatchesDB.update(matchId, { oplrProcessed: true });
  console.log(`OPPR updated (league): ${tn(m.t1)} vs ${tn(m.t2)}, margin ${margin.toFixed(2)}`);
}

// ── Event OPPR update (Mexicano / Americano / King) ───────────────────────────
// Called from event engine after each round result is confirmed.
// playerA/B: { uid, email, nprp, name }
// result: 'winA' | 'winB' | 'draw'
// gamesA/gamesB: games won by each player (for margin factor)

async function updateOPPRForEventMatch({ eventId, roundId, format, date, season,
  playerA, playerB, result, gamesA, gamesB }){

  const docA = await fetchPlayerDoc(playerA.email);
  const docB = await fetchPlayerDoc(playerB.email);

  const opprA = getPlayerOPPR(docA, playerA.nprp);
  const opprB = getPlayerOPPR(docB, playerB.nprp);
  const expA  = opprExpected(opprA, opprB);
  const actA  = result==='winA'?1:result==='draw'?0.5:0;
  const margin= opprMarginFactor(
    result==='winA'?gamesA:gamesB,
    result==='winA'?gamesB:gamesA
  );

  const matchId = `${eventId}_${roundId}`;
  await Promise.all([
    writeOPPR(docA, playerA.nprp, actA,   expA,   margin, format, matchId, date, season),
    writeOPPR(docB, playerB.nprp, 1-actA, 1-expA, margin, format, matchId, date, season),
  ]);
}

// ── Trigger (called from score-actions.js) ────────────────────────────────────

async function triggerOPLRUpdate(matchId){
  try { await updateOPPRForMatch(matchId); }
  catch(err){ console.error('OPPR update failed:', matchId, err.message); }
}

// ── Display helpers ───────────────────────────────────────────────────────────

function formatOPPRDelta(delta){
  if(!delta&&delta!==0) return '';
  const sign  = delta>=0?'+':'';
  const color = delta>0?'var(--accent)':delta<0?'var(--red)':'var(--muted)';
  return `<span style="color:${color};font-size:10px;font-weight:600;">${sign}${delta.toFixed(2)}</span>`;
}

const FORMAT_LABELS = {
  league:'🏆 League', mexicano:'🔄 Mexicano', americano:'🤝 Americano', king:'👑 King of the Court'
};

function renderOPPRChart(history){
  if(!history||history.length<2) return null;
  const W=320,H=100,PAD=24;
  const vals   = history.map(h=>h.oplr);
  const minV   = Math.max(OPPR_MIN, Math.min(...vals)-0.3);
  const maxV   = Math.min(OPPR_MAX, Math.max(...vals)+0.3);
  const xStep  = (W-PAD*2)/(history.length-1);
  const yScale = v=>H-PAD-((v-minV)/(maxV-minV||1))*(H-PAD*2);

  const points = history.map((h,i)=>`${PAD+i*xStep},${yScale(h.oplr)}`).join(' ');
  // No per-dot labels — too cluttered at 20+ matches
  // Show only first, last, and min/max as reference points
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const minIdx = vals.indexOf(minVal);
  const maxIdx = vals.indexOf(maxVal);
  const labelIdxs = new Set([0, history.length-1, minIdx, maxIdx]);

  const dots = history.map((h,i)=>{
    const x=PAD+i*xStep, y=yScale(h.oplr);
    const c=h.delta>0?'#4ade80':h.delta<0?'#f87171':'#888';
    const r = labelIdxs.has(i) ? 5 : 3;
    const label = labelIdxs.has(i)
      ? `<text x="${x}" y="${y-8}" text-anchor="middle" font-size="9" fill="${c}">${h.oplr.toFixed(2)}</text>`
      : '';
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>${label}`;
  }).join('');

  const recent = history.slice(-5).map(h=>{
    const label = h.format&&h.format!=='league'?` <span style="font-size:8px;color:var(--muted);">(${h.format})</span>`:'';
    return `<span style="font-size:10px;color:${h.delta>0?'var(--accent)':h.delta<0?'var(--red)':'var(--muted)'};">
      ${h.opponent==='win'?'W':h.opponent==='loss'?'L':'D'} ${formatOPPRDelta(h.delta)}${label}
    </span>`;
  }).join('<span style="color:var(--muted);margin:0 3px;">·</span>');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;overflow:visible;">
    <polyline points="${points}" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round"/>
    ${dots}
  </svg>
  <div style="margin-top:6px;font-size:11px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
    <span style="color:var(--muted);font-size:10px;">Last 5:</span> ${recent}
  </div>
  <div style="font-size:10px;color:var(--muted);margin-top:4px;">${history.length} match${history.length!==1?'es':''} · L=League M=Mexicano A=Americano K=King · scale ${OPPR_MIN}–${OPPR_MAX}</div>`;
}

// Legacy aliases (keep for any references that used old OPLR names)
const updateOPLRForMatch  = updateOPPRForMatch;
const triggerOPLRUpdate_  = triggerOPLRUpdate;
const renderOPLRChart     = renderOPPRChart;
const formatOPLRDelta     = formatOPPRDelta;
