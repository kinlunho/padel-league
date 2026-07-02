// src/utils.js
// Activity log and toast notification helpers.

function addLog(msg,color='var(--accent)'){
  const t=new Date();
  S.activity.push({msg,color,time:t.toLocaleTimeString('en-HK',{hour:'2-digit',minute:'2-digit'})});
}

function showToast(msg,isErr=false){
  const t=document.getElementById('toast');
  t.textContent=msg;t.style.display='block';
  t.style.borderColor=isErr?'var(--red)':'var(--accent)';
  t.style.color=isErr?'var(--red)':'var(--accent)';
  setTimeout(()=>t.style.display='none',3000);
}

document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));

