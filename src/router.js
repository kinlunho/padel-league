// src/router.js
// Page routing, rules sub-nav, and the shared group-tab helper used by 4 different pages.

// ════════ MOBILE NAV ════════
function toggleMobileNav(){
  document.getElementById('nav-tabs').classList.toggle('open');
}
function closeMobileNav(){
  document.getElementById('nav-tabs').classList.remove('open');
}
// Close mobile nav when tapping outside
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
  if(name==='home') renderHome();
  else if(name==='standings') renderStandingsPage();
  else if(name==='matches') renderMatchesPage();
  else if(name==='schedule') renderSchedulePage();
  else if(name==='teams') renderTeamsPage();
  else if(name==='submit') renderSubmitPage();
  else if(name==='knockout') renderKnockoutPage();
  else if(name==='admin') renderAdminPage();
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

