// src/router.js
// Page routing, rules sub-nav, and the shared group-tab helper used by 4 different pages.

// ════════ MOBILE NAV ════════
function toggleMobileNav(){
  const tabs = document.getElementById('nav-tabs');
  const isOpen = tabs.classList.toggle('open');
  // Inject mobile-only items when opening
  if(isOpen){
    let mobileExtra = document.getElementById('nav-mobile-extra');
    if(!mobileExtra){
      mobileExtra = document.createElement('div');
      mobileExtra.id = 'nav-mobile-extra';
      mobileExtra.style.cssText = 'border-top:1px solid var(--border);margin-top:6px;padding-top:6px;';
      tabs.appendChild(mobileExtra);
    }
    const userEmail = document.getElementById('nav-user-email')?.textContent || '';
    const registerVisible = document.getElementById('nav-register-btn')?.style.display !== 'none';
    const profileVisible  = document.getElementById('nav-profile-btn')?.style.display !== 'none';
    mobileExtra.innerHTML = `
      ${userEmail ? `<div style="font-size:11px;color:var(--muted);padding:8px 14px;">${userEmail}</div>` : ''}
      ${profileVisible  ? `<button class="nav-tab" onclick="openModal('profileModal');closeMobileNav()">👤 My Profile</button>` : ''}
      ${registerVisible ? `<button class="nav-tab" onclick="openModal('registerModal');closeMobileNav()">+ Register Team</button>` : ''}
      <button class="nav-tab" style="color:var(--red);" onclick="handleSignOut();closeMobileNav()">Sign Out</button>`;
  }
}
function closeMobileNav(){
  document.getElementById('nav-tabs').classList.remove('open');
}
document.addEventListener('click', e => {
  const nav = document.getElementById('nav-tabs');
  const btn = document.getElementById('nav-hamburger');
  if(nav && btn && !nav.contains(e.target) && !btn.contains(e.target)){
    nav.classList.remove('open');
  }
});

// ════════ ROUTING ════════
function showPage(name,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  if(btn) btn.classList.add('active');
  renderPage(name);
}
function renderPage(name){
  if(name==='home')     renderHome();
  else if(name==='league')   renderLeaguePage();
  else if(name==='teams')    renderTeamsPage();
  else if(name==='knockout') renderKnockoutPage();
  else if(name==='admin')    renderAdminPage();
  else if(name==='profile')  renderProfilePage();
  // Legacy direct routes still work (linked from home hero buttons etc.)
  else if(name==='standings') { showPage('league',null); setLeagueTab('standings',document.querySelector('.league-tab')); }
  else if(name==='schedule')  { showPage('league',null); setLeagueTab('schedule', document.querySelector('.league-tab:nth-child(3)')); }
  else if(name==='submit')    { showPage('league',null); setLeagueTab('submit',   document.querySelector('.league-tab:last-child')); }
}

// ════════ LEAGUE PAGE ════════
function renderLeaguePage(){
  const tab = S.leagueTab || 'standings';
  // Ensure sub-tab UI matches state
  document.querySelectorAll('.league-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.league-sub').forEach(s=>s.style.display='none');
  const activeBtn = document.querySelector(`.league-tab[onclick*="${tab}"]`);
  const activePane = document.getElementById(`league-sub-${tab}`);
  if(activeBtn) activeBtn.classList.add('active');
  if(activePane) activePane.style.display='';
  // Render the active sub-page content
  if(tab==='standings') renderStandingsPage();
  else if(tab==='matches')  renderMatchesPage();
  else if(tab==='schedule') renderSchedulePage();
  else if(tab==='submit')   renderSubmitPage();
}

function setLeagueTab(tab,el){
  S.leagueTab=tab;
  document.querySelectorAll('.league-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.league-sub').forEach(s=>s.style.display='none');
  if(el) el.classList.add('active');
  const pane=document.getElementById(`league-sub-${tab}`);
  if(pane) pane.style.display='';
  if(tab==='standings') renderStandingsPage();
  else if(tab==='matches')  renderMatchesPage();
  else if(tab==='schedule') renderSchedulePage();
  else if(tab==='submit')   renderSubmitPage();
}
function switchRules(sec,el){
  document.querySelectorAll('.rules-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.rules-section').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('rules-'+sec).classList.add('active');
}

// ════════ GROUP TABS ════════
function buildGroupTabs(containerId, activeProp, onClickFn){
  const el=document.getElementById(containerId);
  if(!el) return;
  const gs=groups();
  if(!gs.length){el.innerHTML='';return;}
  if(!S[activeProp]||!gs.includes(S[activeProp])) S[activeProp]=gs[0];
  el.innerHTML=gs.map(g=>`<button class="group-tab ${S[activeProp]===g?'active':''}" onclick="${onClickFn}('${g}',this)">${g}</button>`).join('');
}
function setGroup(prop,val,el,renderFn){
  S[prop]=val;
  el.closest('.group-tabs').querySelectorAll('.group-tab').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderFn(val);
}

