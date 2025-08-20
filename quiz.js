import { $, storage, key, sanitize, fetchLawJson, getQueryParam } from './common.js';

let LAW = 'patent';
let LIST = [];
let idx = -1;
let queue = [];

function statsKey(id){ return key('quizStats', LAW, id); }
function getStats(id){ return storage.get(statsKey(id), {correct:0, wrong:0}); }
function setStats(id,s){ storage.set(statsKey(id), s); }

function toClozeHTML(html){
  html = sanitize(html);
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  // Each contiguous <b>...</b> -> one blank, reveal on click
  wrap.querySelectorAll('b').forEach(bEl => {
    const ans = bEl.textContent;
    const btn = document.createElement('button');
    btn.className = 'btn ghost';
    btn.textContent = '____';
    btn.addEventListener('click', ()=>{ btn.textContent = ans; });
    bEl.replaceWith(btn);
  });
  return wrap.innerHTML;
}

function openAt(i){
  idx = i;
  const a = LIST[i];
  $('#emptyQuiz').hidden = true;
  $('#viewerQuiz').hidden = false;
  $('#titleQuiz').textContent = `${a.number} ${a.title}`;
  $('#bodyQuiz').innerHTML = toClozeHTML(a.text);
  const st = getStats(a.id);
  $('#stats').textContent = `누적: ${st.correct}/${st.wrong}`;
  $('#markCorrect').onclick = ()=>{
    const s = getStats(a.id); s.correct++; setStats(a.id, s);
    $('#stats').textContent = `누적: ${s.correct}/${s.wrong}`;
  };
  $('#markWrong').onclick = ()=>{
    const s = getStats(a.id); s.wrong++; setStats(a.id, s);
    $('#stats').textContent = `누적: ${s.correct}/${s.wrong}`;
  };
}

function buildTOC(){
  const el = $('#tocQuiz'); el.innerHTML='';
  const q = $('#searchQuiz').value.trim();
  LIST.filter(a => !q || (a.number + ' ' + a.title + ' ' + a.text.replace(/<[^>]+>/g,'')).includes(q))
      .forEach((a,i)=>{
        const it = document.createElement('div'); it.className='toc-item';
        const st = getStats(a.id);
        it.innerHTML = `<div><strong>${a.number}</strong><div class="muted" style="font-size:12px">${a.title}</div></div>
          <div class="badge">${st.correct}/${st.wrong}</div>`;
        it.addEventListener('click', ()=> openAt(i));
        el.appendChild(it);
      });
}

$('#prevQuiz').addEventListener('click', ()=>{ if(idx>0) openAt(idx-1); else if(queue.length){ const nextId = queue.shift(); const i = LIST.findIndex(x=>x.id===nextId); if(i>=0) openAt(i);} });
$('#nextQuiz').addEventListener('click', ()=>{
  if(idx<LIST.length-1) openAt(idx+1); else if(queue.length){ const nextId = queue.shift(); const i = LIST.findIndex(x=>x.id===nextId); if(i>=0) openAt(i);} 
});

$('#startDaily').addEventListener('click', ()=>{
  const n = Math.max(1, parseInt($('#dailyN').value||'10', 10));
  const shuffled = [...LIST].sort(()=>Math.random()-0.5).map(x=>x.id);
  queue = shuffled.slice(0, n);
  // start with first in queue
  const first = queue.shift();
  const i = LIST.findIndex(x=>x.id===first);
  if(i>=0) openAt(i);
});

$('#searchQuiz').addEventListener('input', buildTOC);

async function init(){
  LIST = await fetchLawJson('patent');
  LIST.forEach(a => a.text = sanitize(a.text));
  buildTOC();
  // If id param provided, open that
  const targetId = getQueryParam('id');
  const i = targetId ? LIST.findIndex(x=>x.id===targetId) : 0;
  if (i>=0) openAt(i);
}
init();
