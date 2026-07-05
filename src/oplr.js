// src/oplr.js
// OnePadel League Rating (OPLR) engine.
//
// Formula design:
//   - Team rating = avg of players' current NPRP (2 players: both; 3+: top 3)
//   - Starting OPLR = player's current NPRP (anchors to real skill level)
//   - Expected outcome based on team rating difference
//   - Rating change = K * (actual - expected) * margin_factor
//   - K (volatility) scales with match count:
//       1–20 matches  → K=0.40 (calibration, high swing)
//       21–49 matches → K=0.20 (active, settling)
//       50+ matches   → K=0.08 (locked, max ±0.2 per match enforced)
//   - Margin factor: games won/lost amplifies or dampens the change
//       Dominance (e.g. 6-0 6-0) → factor up to 1.5
//       Close (e.g. 7-6 7-6)     → factor down to 0.6
//   - OPLR clamped to 1.0–7.0 range at all times
//   - All calculations stored in /players/{uid}.oplrHistory[]

// ── Constants ─────────────────────────────────────────────────────────────────

const OPLR_K = { calibration: 0.40, active: 0.20, locked: 0.08 };
const OPLR_MAX_MOVE_LOCKED = 0.20; // hard cap at 50+ matches
const OPLR_MIN = 1.0;
const OPLR_MAX = 7.0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function oplrK(matchCount){
  if(matchCount < 21)  return OPLR_K.calibration;
  if(matchCount < 50)  return OPLR_K.active;
  return OPLR_K.locked;
}

// Expected score for team A (0–1 scale, like ELO)
// Uses rating difference: every 1.0 rating point ≈ 75% win probability
function oplrExpected(ratingA, ratingB){
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 2.5));
}

// Margin factor based on game dominance
// totalGames = gw1 + gw2, winnerGames = winner's games
// Ratio 1.0 = winner got all games (6-0 6-0) → factor 1.5
// Ratio 0.5 = even split (6-4 4-6 stb) → factor ~0.9
// Ratio ~0.52 = very close → factor 0.6 minimum
function oplrMarginFactor(winnerGames, loserGames){
  const total = winnerGames + loserGames;
  if(total === 0) return 1.0;
  const ratio = winnerGames / total;
  // Linear scale: ratio 1.0 → 1.5, ratio 0.5 → 0.6
  const factor = 0.6 + (ratio - 0.5) * 1.8;
  return Math.max(0.6, Math.min(1.5, factor));
}

// Get a player's current OPLR from their profile doc
// Falls back to their NPRP as starting value if no OPLR history
function getPlayerOPLR(playerDoc, nprp){
  const history = playerDoc?.oplrHistory || [];
  if(history.length === 0) return parseFloat(nprp) || 3.5;
  return history[history.length - 1].oplr;
}

// Get match count for a player from their oplrHistory
function getMatchCount(playerDoc){
  return (playerDoc?.oplrHistory || []).length;
}

// Team OPLR = average of players' OPLR
// 2 players → both; 3+ → top 3 by OPLR
function teamOPLR(playerDocs, nprps){
  const ratings = playerDocs.map((doc, i) =>
    getPlayerOPLR(doc, nprps[i])
  ).sort((a,b) => b - a);
  const topN = playerDocs.length <= 2 ? 2 : 3;
  const slice = ratings.slice(0, Math.min(topN, ratings.length));
  return slice.reduce((s,r) => s+r, 0) / slice.length;
}

// ── Main: calculate and write OPLR updates after a confirmed match ─────────────

async function updateOPLRForMatch(matchId){
  const m = S.matches[matchId];
  if(!m || m.status !== 'confirmed' || !m.scoreData) return;
  if(m.oplrProcessed) return; // idempotent — don't double-process

  const r = calcResult(m.scoreData);
  if(!r) return;

  // Get teams and their players
  const team1 = S.teams[m.t1];
  const team2 = S.teams[m.t2];
  if(!team1 || !team2) return;

  // Only process players who actually played (attendance tracking)
  // If players[] is empty/null, assume all rostered players played
  const playedPids = m.players && m.players.length ? new Set(m.players) : null;

  const getActivePlayers = (team) => {
    return (team.players || []).filter((p, i) => {
      if(!playedPids) return true; // all played
      return playedPids.has(`${team.id}_p${i}`);
    });
  };

  const t1Players = getActivePlayers(team1);
  const t2Players = getActivePlayers(team2);

  if(!t1Players.length || !t2Players.length) return;

  // Fetch player docs for all participants
  const fetchPlayerDoc = async (email) => {
    if(!email) return null;
    const snap = await db.collection('players').where('email','==',email).limit(1).get();
    return snap.empty ? null : { uid: snap.docs[0].id, ...snap.docs[0].data() };
  };

  const t1Docs = await Promise.all(t1Players.map(p => fetchPlayerDoc(p.claimedByEmail)));
  const t2Docs = await Promise.all(t2Players.map(p => fetchPlayerDoc(p.claimedByEmail)));

  // Calculate team OPLRs
  const t1OPLR = teamOPLR(
    t1Docs.filter(Boolean),
    t1Players.map(p => p.nprp)
  );
  const t2OPLR = teamOPLR(
    t2Docs.filter(Boolean),
    t2Players.map(p => p.nprp)
  );

  // Expected outcomes
  const exp1 = oplrExpected(t1OPLR, t2OPLR);
  const exp2 = 1 - exp1;

  // Actual outcomes (1=win, 0.5=draw, 0=loss)
  const act1 = r.result==='win1' ? 1 : r.result==='draw' ? 0.5 : 0;
  const act2 = 1 - act1;

  // Margin factor
  const winnerGames = r.result==='win1' ? r.gw1 : r.gw2;
  const loserGames  = r.result==='win1' ? r.gw2 : r.gw1;
  const margin = oplrMarginFactor(winnerGames, loserGames);

  const date = m.date || new Date().toISOString().split('T')[0];
  const season = m.season || ACTIVE_SEASON;

  // Calculate and write OPLR updates for each player
  const writeOPLR = async (playerDoc, nprp, actual, expected) => {
    if(!playerDoc?.uid) return; // unlinked player — skip

    const currentOPLR = getPlayerOPLR(playerDoc, nprp);
    const matchCount  = getMatchCount(playerDoc);
    const K = oplrK(matchCount);

    let delta = K * (actual - expected) * margin;

    // Hard cap for locked players (50+ matches)
    if(matchCount >= 50){
      delta = Math.max(-OPLR_MAX_MOVE_LOCKED, Math.min(OPLR_MAX_MOVE_LOCKED, delta));
    }

    const newOPLR = Math.max(OPLR_MIN, Math.min(OPLR_MAX,
      Math.round((currentOPLR + delta) * 100) / 100
    ));

    const entry = {
      matchId,
      date,
      season,
      oplr: newOPLR,
      delta: Math.round(delta * 100) / 100,
      opponent: actual === 1 ? 'win' : actual === 0.5 ? 'draw' : 'loss',
      teamOPLR: Math.round((actual===1?t1OPLR:t2OPLR)*100)/100,
      oppOPLR:  Math.round((actual===1?t2OPLR:t1OPLR)*100)/100,
    };

    await db.collection('players').doc(playerDoc.uid).update({
      oplrHistory: firebase.firestore.FieldValue.arrayUnion(entry),
      currentOPLR: newOPLR
    });
  };

  // Process team 1 players
  await Promise.all(t1Docs.map((doc, i) =>
    writeOPLR(doc, t1Players[i].nprp, act1, exp1)
  ));

  // Process team 2 players
  await Promise.all(t2Docs.map((doc, i) =>
    writeOPLR(doc, t2Players[i].nprp, act2, exp2)
  ));

  // Mark match as OPLR-processed to prevent double-processing
  await MatchesDB.update(matchId, { oplrProcessed: true });

  console.log(`OPLR updated for match ${matchId}: T1 ${t1OPLR.toFixed(2)} vs T2 ${t2OPLR.toFixed(2)}, margin ${margin.toFixed(2)}`);
}

// ── Trigger: called from score-actions.js after a match is confirmed ──────────

async function triggerOPLRUpdate(matchId){
  try {
    await updateOPLRForMatch(matchId);
  } catch(err){
    console.error('OPLR update failed for match', matchId, err.message);
    // Non-fatal — match is still confirmed, OPLR just doesn't update
  }
}

// ── Display helpers ───────────────────────────────────────────────────────────

function formatOPLRDelta(delta){
  if(!delta && delta !== 0) return '';
  const sign = delta >= 0 ? '+' : '';
  const color = delta > 0 ? 'var(--accent)' : delta < 0 ? 'var(--red)' : 'var(--muted)';
  return `<span style="color:${color};font-size:10px;font-weight:600;">${sign}${delta.toFixed(2)}</span>`;
}

function renderOPLRChart(history){
  if(!history || history.length < 2) return null;
  const W=320, H=100, PAD=24;
  const vals = history.map(h => h.oplr);
  const minV = Math.max(OPLR_MIN, Math.min(...vals) - 0.3);
  const maxV = Math.min(OPLR_MAX, Math.max(...vals) + 0.3);
  const xStep = (W - PAD*2) / (history.length - 1);
  const yScale = v => H - PAD - ((v - minV) / (maxV - minV || 1)) * (H - PAD*2);

  const points = history.map((h,i) => `${PAD + i*xStep},${yScale(h.oplr)}`).join(' ');
  const dots = history.map((h,i) => {
    const x = PAD + i*xStep;
    const y = yScale(h.oplr);
    const color = h.delta > 0 ? '#4ade80' : h.delta < 0 ? '#f87171' : '#888';
    return `<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>
      <text x="${x}" y="${y-8}" text-anchor="middle" font-size="9" fill="${color}">${h.oplr.toFixed(2)}</text>`;
  }).join('');

  // Last 5 results for context
  const recent = history.slice(-5).map(h =>
    `<span style="font-size:10px;color:${h.delta>0?'var(--accent)':h.delta<0?'var(--red)':'var(--muted)'};">
      ${h.opponent==='win'?'W':h.opponent==='loss'?'L':'D'} ${formatOPLRDelta(h.delta)}
    </span>`
  ).join('<span style="color:var(--muted);margin:0 3px;">·</span>');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;overflow:visible;">
    <polyline points="${points}" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round"/>
    ${dots}
  </svg>
  <div style="margin-top:6px;font-size:11px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
    <span style="color:var(--muted);font-size:10px;">Last 5:</span> ${recent}
  </div>
  <div style="font-size:10px;color:var(--muted);margin-top:4px;">${history.length} match${history.length!==1?'es':''} · OPLR scale ${OPLR_MIN}–${OPLR_MAX}</div>`;
}
