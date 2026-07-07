// src/render/player-picker.js
// Shared player picker component used by Events and Tournaments.
// Each picker instance is isolated by a config object so multiple
// pickers can exist on the same page without state collision.
//
// Usage:
//   const picker = createPlayerPicker({
//     searchId:   'my-search-input',
//     listId:     'my-player-list',
//     selectedId: 'my-selected-list',
//     countId:    'my-count-span',     // optional
//     minPlayers: 2,                   // optional, default 2
//     requireEven: false,              // optional
//     onSelect: (players) => {}        // optional callback
//   });
//   await picker.init();               // loads players from /players
//   picker.getSelected();              // returns [{uid,name,email,nprp}]
//   picker.setSelected([...]);         // pre-populate (edit mode)

function createPlayerPicker(config){
  const {
    searchId, listId, selectedId, countId,
    minPlayers = 2, requireEven = false,
    onSelect = null
  } = config;

  let _selected = [];
  let _allPlayers = [];

  // ── Load players from Firestore ──────────────────────────────────────────
  async function init(){
    const listEl = document.getElementById(listId);
    if(!listEl) return;
    listEl.innerHTML = '<div style="padding:8px;color:var(--muted);font-size:12px;">Loading players...</div>';

    try {
      const players = await PlayersDB.listAll();
      // Enrich with NPRP from team roster or player doc
      _allPlayers = players.map(p => {
        const team = Object.values(S.teams).find(t =>
          t.season===ACTIVE_SEASON && t.players?.some(pl=>pl.claimedByEmail===p.email)
        );
        const pr = team?.players?.find(pl=>pl.claimedByEmail===p.email);
        return {
          ...p,
          nprp: parseFloat(pr?.nprp || p.nprp || p.selfReportedNprp) || null,
          teamName: team?.name || ''
        };
      });
      _render(_allPlayers);
    } catch(err){
      if(listEl) listEl.innerHTML =
        '<div style="padding:8px;color:var(--muted);font-size:12px;">No players in directory yet.</div>';
    }
  }

  // ── Render player list ───────────────────────────────────────────────────
  function _render(players){
    const listEl = document.getElementById(listId);
    if(!listEl) return;
    const selectedUids = new Set(_selected.map(p=>p.uid));

    if(!players.length){
      listEl.innerHTML = '<div style="padding:8px;color:var(--muted);font-size:12px;">No players found.</div>';
      return;
    }

    listEl.innerHTML = players.map(p => {
      const sel = selectedUids.has(p.uid);
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;
        cursor:pointer;border-bottom:1px solid var(--border);
        background:${sel?'rgba(74,222,128,0.06)':'transparent'};"
        onclick="_pickerToggle('${p.uid}','${(p.displayName||p.email||'').replace(/'/g,"\\'")}','${(p.email||'').replace(/'/g,"\\'")}',${p.nprp||3.5},'${searchId}')">
        <div style="width:18px;height:18px;border-radius:4px;border:1px solid var(--border);
          background:${sel?'var(--accent)':'transparent'};display:flex;align-items:center;
          justify-content:center;flex-shrink:0;">
          ${sel?'<span style="color:#000;font-size:11px;font-weight:700;">✓</span>':''}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${p.displayName||p.email||'Unknown'}
          </div>
          <div style="font-size:10px;color:var(--muted);">
            ${p.teamName||'No team'}${p.nprp?` · NPRP ${p.nprp}`:''}
          </div>
        </div>
      </div>`;
    }).join('');

    // Store allPlayers on element for filter access
    listEl._allPlayers = players;
  }

  function _renderSelected(){
    const el = document.getElementById(selectedId);
    const countEl = document.getElementById(countId);
    if(!el) return;
    if(countEl) countEl.textContent = _selected.length;

    const isEnough = _selected.length >= minPlayers;
    const isEven   = !requireEven || _selected.length % 2 === 0;

    el.innerHTML = _selected.map(p=>`
      <div style="display:flex;align-items:center;gap:6px;padding:4px 8px;
        background:var(--surface-1);border-radius:6px;border:1px solid var(--border);">
        <span style="font-size:12px;">${p.name}</span>
        ${p.nprp?`<span style="font-size:10px;color:var(--brand);">NPRP ${p.nprp}</span>`:''}
        <button onclick="_pickerRemove('${p.uid}','${searchId}')"
          style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;padding:0;line-height:1;">✕</button>
      </div>`).join('');

    if(!isEnough || !isEven){
      el.innerHTML += `<div style="font-size:10px;color:var(--warn);padding:4px;">
        ${!isEnough?`Need at least ${minPlayers} player${minPlayers!==1?'s':''}. `:''}
        ${!isEven&&_selected.length>=minPlayers?'Must be even number.':''}
      </div>`;
    }

    if(onSelect) onSelect(_selected);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function toggle(uid, name, email, nprp){
    const idx = _selected.findIndex(p=>p.uid===uid);
    if(idx>=0) _selected.splice(idx,1);
    else _selected.push({uid, name, email:email||null, nprp:parseFloat(nprp)||null, withdrawn:false});
    const listEl = document.getElementById(listId);
    if(listEl?._allPlayers) _render(listEl._allPlayers);
    else _render(_allPlayers);
    _renderSelected();
  }

  function remove(uid){
    _selected = _selected.filter(p=>p.uid!==uid);
    const listEl = document.getElementById(listId);
    if(listEl?._allPlayers) _render(listEl._allPlayers);
    else _render(_allPlayers);
    _renderSelected();
  }

  function filter(query){
    const q = (query||'').toLowerCase();
    const filtered = _allPlayers.filter(p=>
      (p.displayName||'').toLowerCase().includes(q)||
      (p.email||'').toLowerCase().includes(q)||
      (p.teamName||'').toLowerCase().includes(q)
    );
    _render(filtered);
  }

  function getSelected(){ return [..._selected]; }

  function setSelected(players){
    _selected = players.map(p=>({...p}));
    const listEl = document.getElementById(listId);
    if(listEl?._allPlayers) _render(listEl._allPlayers);
    else if(_allPlayers.length) _render(_allPlayers);
    _renderSelected();
  }

  function reset(){
    _selected = [];
    _render(_allPlayers);
    _renderSelected();
  }

  // Register this picker in global registry keyed by searchId
  // so onclick handlers in rendered HTML can find it
  window._playerPickers = window._playerPickers||{};
  window._playerPickers[searchId] = {toggle, remove, filter};

  return {init, getSelected, setSelected, reset, toggle, remove, filter};
}

// ── Global onclick handlers ───────────────────────────────────────────────────
// Called from rendered HTML — routes to correct picker instance by searchId

function _pickerToggle(uid, name, email, nprp, searchId){
  window._playerPickers?.[searchId]?.toggle(uid, name, email, nprp);
}

function _pickerRemove(uid, searchId){
  window._playerPickers?.[searchId]?.remove(uid);
}

function _pickerFilter(searchId){
  const q = document.getElementById(searchId)?.value||'';
  window._playerPickers?.[searchId]?.filter(q);
}
