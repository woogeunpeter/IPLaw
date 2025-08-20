// Tabs
const tabs = document.querySelectorAll('.tab');
const screens = {
  statutes: document.getElementById('screen-statutes'),
  cloze: document.getElementById('screen-cloze'),
};
tabs.forEach(btn => btn.addEventListener('click', () => {
  tabs.forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const goto = btn.dataset.goto;
  Object.values(screens).forEach(s=>s.hidden=true);
  screens[goto].hidden=false;
  localStorage.setItem('lastTab', goto);
}));
const last = localStorage.getItem('lastTab') || 'statutes';
document.querySelector(`.tab[data-goto="${last}"]`).click();

// --- Auto refresh wiring ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').then((reg) => {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          sw.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

// --- Helpers ---
const $ = (s, r=document) => r.querySelector(s);
const storage = {
  get: (k, v=null) => JSON.parse(localStorage.getItem(k) ?? JSON.stringify(v)),
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};
const key = (type, law, id='') => `${type}:${law}${id?':'+id:''}`;
const starsStr = n => '★'.repeat(n||0) + '☆'.repeat(Math.max(0, 5-(n||0)));

function sanitize(html){
  if(!html) return html;
  // Strip any highlight spans (class contains 'hl' OR inline background style)
  html = html.replace(/<span[^>]*class="[^"]*hl[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  html = html.replace(/<span[^>]*style="[^"]*background[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  return html;
}

// Cache-busting data fetch
async function fetchLawJson(law){
  const ts = Date.now();
  const res = await fetch(`./data/${law}.json?ts=${ts}`, { cache: 'no-store' });
  if(!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

// ====== Statutes Mode ======
let LAW = 'patent';
let LAW_DATA = [];
let currentId = null;

async function loadLaw(law){
  LAW = law;
  try{
    LAW_DATA = await fetchLawJson(law);
    // sanitize texts
    LAW_DATA.forEach(a => a.text = sanitize(a.text));
  }catch(err){
    alert('데이터 불러오기 오류: ' + err.message);
    LAW_DATA = [];
  }
  buildTOC();
  if (LAW_DATA.length) openArticle(LAW_DATA[0].id);
}

function buildTOC(){
  const toc = document.getElementById('toc');
  const q = (document.getElementById('searchInput')||{value:''}).value?.trim() || '';
  const onlyBM = (document.getElementById('onlyBookmarks')||{checked:false}).checked;
  const minStars = parseInt((document.getElementById('minStars')||{value:'0'}).value||'0',10);
  const bms = new Set(storage.get(key('bookmarks', LAW), []));
  toc.innerHTML = '';

  LAW_DATA.filter(a => {
    const stars = storage.get(key('stars', LAW, a.id), a.stars||0);
    const plain = (a.number + ' ' + a.title + ' ' + a.text.replace(/<[^>]+>/g,''));
    const match = !q || plain.includes(q);
    const starOK = stars >= minStars;
    const bmOK = !onlyBM || bms.has(a.id);
    return match && starOK && bmOK;
  }).forEach(a => {
    const item = document.createElement('div');
    item.className = 'toc-item';
    const stars = storage.get(key('stars', LAW, a.id), a.stars||0);
    const isBM = bms.has(a.id);
    item.innerHTML = `
      <div class="toc-title">
        <strong>${a.number}</strong>
        <small>${a.title}</small>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="stars">${starsStr(stars)}</span>
        <span class="badge">${isBM?'★':''}</span>
      </div>`;
    item.addEventListener('click', ()=> openArticle(a.id));
    toc.appendChild(item);
  });
}

function openArticle(id){
  currentId = id;
  const a = LAW_DATA.find(x => x.id === id);
  if(!a) return;
  $('.empty').hidden = true;
  $('#viewer').hidden = false;

  const stars = storage.get(key('stars', LAW, id), a.stars||0);
  const bms = new Set(storage.get(key('bookmarks', LAW), []));

  $('#aTitle').textContent = `${a.number} ${a.title}`;
  $('#aId').textContent = id;
  $('#aStars').textContent = starsStr(stars);
  $('#starSelect').value = String(stars);
  $('#bmBtn').textContent = bms.has(id) ? '★ 북마크 해제' : '★ 북마크';

  // Render body (bold only, highlight already sanitized)
  $('#aBody').innerHTML = sanitize(a.text);

  // Notes
  $('#noteInput').value = storage.get(key('note', LAW, id), '');
  $('#noteStatus').textContent = '자동 저장됨';
  buildTOC();
}

document.getElementById('lawSelect').addEventListener('change', e => loadLaw(e.target.value));
document.getElementById('searchInput').addEventListener('input', () => buildTOC());
document.getElementById('onlyBookmarks').addEventListener('change', () => buildTOC());
document.getElementById('minStars').addEventListener('change', () => buildTOC());

document.getElementById('starSelect').addEventListener('change', e => {
  const v = parseInt(e.target.value,10)||0;
  storage.set(key('stars', LAW, currentId), v);
  $('#aStars').textContent = starsStr(v);
  buildTOC();
});
document.getElementById('bmBtn').addEventListener('click', () => {
  const arr = new Set(storage.get(key('bookmarks', LAW), []));
  if(arr.has(currentId)) arr.delete(currentId); else arr.add(currentId);
  storage.set(key('bookmarks', LAW), Array.from(arr));
  $('#bmBtn').textContent = arr.has(currentId) ? '★ 북마크 해제' : '★ 북마크';
  buildTOC();
});
let noteTimer = null;
document.getElementById('noteInput').addEventListener('input', e => {
  $('#noteStatus').textContent = '저장 중…';
  clearTimeout(noteTimer);
  noteTimer = setTimeout(()=>{
    storage.set(key('note', LAW, currentId), e.target.value);
    $('#noteStatus').textContent = '자동 저장됨';
  }, 500);
});
document.getElementById('toQuiz').addEventListener('click', () => {
  document.querySelector('.tab[data-goto="cloze"]').click();
  quizShow(currentId);
});

// ====== Cloze Quiz Mode ======
let QUIZ_LAW = 'patent';
let LAW_DATA_QUIZ = [];
let quizQueue = [];
let quizIndex = 0;

function toClozeHTML(html){
  // 1) sanitize highlights
  html = sanitize(html);
  // 2) replace <b>…</b> with buttons
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  wrap.querySelectorAll('b').forEach(bEl => {
    const ans = bEl.textContent;
    const btn = document.createElement('button');
    btn.className = 'btn ghost';
    btn.dataset.answer = ans;
    btn.textContent = '____';
    btn.addEventListener('click', ()=>{ btn.textContent = ans; });
    bEl.replaceWith(btn);
  });
  return wrap.innerHTML;
}

function getStatsKey(id){ return key('stats', QUIZ_LAW, id); }
function getStats(id){ return JSON.parse(localStorage.getItem(getStatsKey(id)) || '{"correct":0,"wrong":0}'); }
function setStats(id, s){ localStorage.setItem(getStatsKey(id), JSON.stringify(s)); }

async function loadLawQuiz(law){
  QUIZ_LAW = law;
  LAW_DATA_QUIZ = await fetchLawJson(law);
  LAW_DATA_QUIZ.forEach(a => a.text = sanitize(a.text));
  if (LAW_DATA_QUIZ.length) quizShow(LAW_DATA_QUIZ[0].id);
}

function quizShow(id){
  const a = LAW_DATA_QUIZ.find(x=>x.id===id);
  if(!a) return;
  const html = toClozeHTML(a.text);
  document.getElementById('quizView').innerHTML =
    `<h2>${a.number} ${a.title}</h2><div class="meta">${a.id}</div><div class="body">${html}</div>`;
  const st = getStats(id);
  document.getElementById('stats').textContent = `누적: ${st.correct}✓ / ${st.wrong}✗`;
  document.getElementById('markCorrect').dataset.id = id;
  document.getElementById('markWrong').dataset.id = id;
  document.getElementById('revealBtn').onclick = ()=>{
    document.querySelectorAll('#quizView button.btn.ghost').forEach(btn=> btn.textContent = btn.dataset.answer);
  };
}

document.getElementById('lawSelectQuiz').addEventListener('change', e => loadLawQuiz(e.target.value));
document.getElementById('markCorrect').addEventListener('click', e=>{
  const id = e.currentTarget.dataset.id;
  const st = getStats(id); st.correct += 1; setStats(id, st);
  document.getElementById('stats').textContent = `누적: ${st.correct}✓ / ${st.wrong}✗`;
});
document.getElementById('markWrong').addEventListener('click', e=>{
  const id = e.currentTarget.dataset.id;
  const st = getStats(id); st.wrong += 1; setStats(id, st);
  document.getElementById('stats').textContent = `누적: ${st.correct}✓ / ${st.wrong}✗`;
});
document.getElementById('startDaily').addEventListener('click', ()=>{
  const n = Math.max(1, parseInt(document.getElementById('dailyCount').value||'10',10));
  quizQueue = [...LAW_DATA_QUIZ].sort(()=>Math.random()-0.5).slice(0, n).map(x=>x.id);
  quizIndex = 0;
  quizShow(quizQueue[quizIndex]);
});
document.getElementById('gotoArticleQuiz').addEventListener('click', ()=>{
  const q = document.getElementById('searchQuiz').value.trim();
  const found = LAW_DATA_QUIZ.find(a => (a.number + ' ' + a.title + ' ' + a.text.replace(/<[^>]+>/g,'')).includes(q));
  if(found) quizShow(found.id); else alert('검색 결과가 없습니다');
});

// Init
loadLaw(LAW);
loadLawQuiz(QUIZ_LAW);
