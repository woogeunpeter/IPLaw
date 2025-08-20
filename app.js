// Navigation: home <-> statutes / quiz
const screens = {
  home: document.getElementById('screen-home'),
  statutes: document.getElementById('screen-statutes'),
  quiz: document.getElementById('screen-quiz'),
};
const backBtn = document.getElementById('backBtn');
function show(screen){
  Object.values(screens).forEach(s=>s.hidden=true);
  screens[screen].hidden=false;
  backBtn.hidden = (screen === 'home');
  localStorage.setItem('lastScreen', screen);
}
document.getElementById('goStatutes').addEventListener('click', ()=> show('statutes'));
document.getElementById('goQuiz').addEventListener('click', ()=> show('quiz'));
backBtn.addEventListener('click', ()=> show('home'));
show(localStorage.getItem('lastScreen') || 'home');

// Helpers
const $ = (s, r=document) => r.querySelector(s);
const storage = { get:(k,v=null)=>JSON.parse(localStorage.getItem(k)??JSON.stringify(v)), set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)) };
const key = (type, law, id='') => `${type}:${law}${id?':'+id:''}`;

function sanitize(html){
  if(!html) return html;
  html = html.replace(/<span[^>]*class="[^"]*hl[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  html = html.replace(/<span[^>]*style="[^"]*background[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  return html;
}

async function fetchLawJson(law){
  const ts = Date.now();
  const res = await fetch(`./data/${law}.json?ts=${ts}`, { cache: 'no-store' });
  if(!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

// ===== Shared state
let LAW = 'patent';
let LIST = []; // array of {id, number, title, text}
let idxStat = -1;
let idxQuiz = -1;

// Build left lists
function buildTOCStat(){
  const el = document.getElementById('tocStat'); el.innerHTML='';
  const q = document.getElementById('searchStat').value.trim();
  LIST.filter(a => !q || (a.number + ' ' + a.title + ' ' + a.text.replace(/<[^>]+>/g,'')).includes(q))
      .forEach((a,i)=>{
        const it = document.createElement('div'); it.className='toc-item';
        it.innerHTML = `<div><strong>${a.number}</strong><div class="muted" style="font-size:12px">${a.title}</div></div>`;
        it.addEventListener('click', ()=> openStat(i));
        el.appendChild(it);
      });
}

function buildTOCQuiz(){
  const el = document.getElementById('tocQuiz'); el.innerHTML='';
  const q = document.getElementById('searchQuiz').value.trim();
  LIST.filter(a => !q || (a.number + ' ' + a.title + ' ' + a.text.replace(/<[^>]+>/g,'')).includes(q))
      .forEach((a,i)=>{
        const it = document.createElement('div'); it.className='toc-item';
        it.innerHTML = `<div><strong>${a.number}</strong><div class="muted" style="font-size:12px">${a.title}</div></div>`;
        it.addEventListener('click', ()=> openQuiz(i));
        el.appendChild(it);
      });
}

// ===== Statutes (ONLY statutes)
function openStat(i){
  idxStat = i;
  const a = LIST[i];
  document.getElementById('emptyStat').hidden = true;
  document.getElementById('viewerStat').hidden = false;
  document.getElementById('titleStat').textContent = `${a.number} ${a.title}`;
  document.getElementById('bodyStat').innerHTML = sanitize(a.text);
  // load memo
  document.getElementById('noteStat').value = storage.get(key('note', LAW, a.id), '');
  document.getElementById('noteStatus').textContent = '자동 저장됨';
}

document.getElementById('prevStat').addEventListener('click', ()=>{
  if(idxStat<=0) return;
  openStat(idxStat-1);
});
document.getElementById('nextStat').addEventListener('click', ()=>{
  if(idxStat<LIST.length-1) openStat(idxStat+1);
});

let noteTimer=null;
document.getElementById('noteStat').addEventListener('input', (e)=>{
  document.getElementById('noteStatus').textContent = '저장 중…';
  clearTimeout(noteTimer);
  noteTimer = setTimeout(()=>{
    const a = LIST[idxStat];
    storage.set(key('note', LAW, a.id), e.target.value);
    document.getElementById('noteStatus').textContent = '자동 저장됨';
  }, 400);
});

// ===== Quiz (ONLY blanks)
// stats
function statsKey(id){ return key('quizStats', LAW, id); }
function getStats(id){ return storage.get(statsKey(id), {correct:0, wrong:0}); }
function setStats(id,s){ storage.set(statsKey(id), s); }

function toClozeHTML(html){
  html = sanitize(html);
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  wrap.querySelectorAll('b').forEach(bEl => {
    const ans = bEl.textContent; // contiguous bold segment as one blank
    const btn = document.createElement('button');
    btn.className = 'btn ghost';
    btn.textContent = '____';
    btn.addEventListener('click', ()=>{ btn.textContent = ans; });
    bEl.replaceWith(btn);
  });
  return wrap.innerHTML;
}

function renderQuiz(i){
  idxQuiz = i;
  const a = LIST[i];
  document.getElementById('emptyQuiz').hidden = true;
  document.getElementById('viewerQuiz').hidden = false;
  document.getElementById('titleQuiz').textContent = `${a.number} ${a.title}`;
  document.getElementById('bodyQuiz').innerHTML = toClozeHTML(a.text);
  const st = getStats(a.id);
  document.getElementById('stats').textContent = `누적: ${st.correct}/${st.wrong}`;
  document.getElementById('markCorrect').onclick = ()=>{
    const s = getStats(a.id); s.correct++; setStats(a.id,s);
    document.getElementById('stats').textContent = `누적: ${s.correct}/${s.wrong}`;
  };
  document.getElementById('markWrong').onclick = ()=>{
    const s = getStats(a.id); s.wrong++; setStats(a.id,s);
    document.getElementById('stats').textContent = `누적: ${s.correct}/${s.wrong}`;
  };
}

function openQuiz(i){ renderQuiz(i); }

document.getElementById('prevQuiz').addEventListener('click', ()=>{
  if(idxQuiz<=0) return;
  renderQuiz(idxQuiz-1);
});
document.getElementById('nextQuiz').addEventListener('click', ()=>{
  if(idxQuiz<LIST.length-1) renderQuiz(idxQuiz+1);
});

// ===== Load data and init lists
async function init(){
  LIST = await fetchLawJson('patent');
  LIST.forEach(a => a.text = sanitize(a.text));
  buildTOCStat();
  buildTOCQuiz();
}
document.getElementById('searchStat').addEventListener('input', buildTOCStat);
document.getElementById('searchQuiz').addEventListener('input', buildTOCQuiz);
init();
