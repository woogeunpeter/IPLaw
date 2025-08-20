// === Rescue Pack app.js ===
// Defensive utilities
const $ = (s, r=document) => r.querySelector(s);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
const storage = {
  get: (k, v=null) => JSON.parse(localStorage.getItem(k) ?? JSON.stringify(v)),
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};
const key = (type, law, id='') => `${type}:${law}${id?':'+id:''}`;
const starsStr = n => '★'.repeat(n||0) + '☆'.repeat(Math.max(0, 5-(n||0)));

// Strip any highlight spans; keep bold only
function sanitize(html){
  if(!html) return html;
  html = html.replace(/<span[^>]*class="[^"]*hl[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  html = html.replace(/<span[^>]*style="[^"]*background[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  return html;
}

// Cache-busting fetch (no SW dependency)
async function fetchLawJson(law){
  const ts = Date.now();
  const res = await fetch(`./data/${law}.json?ts=${ts}`, { cache: 'no-store' });
  if(!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

// ===== Shared State =====
let LAW = 'patent';
let LAW_DATA = [];
let currentId = null;

// ===== Statutes (view-only, bold kept) =====
async function loadLaw(law='patent'){
  LAW = law;
  try{
    LAW_DATA = await fetchLawJson(law);
    LAW_DATA.forEach(a => a.text = sanitize(a.text || ''));
  }catch(e){
    console.error(e);
    LAW_DATA = [];
  }
  buildTOC();
  if (LAW_DATA.length) openArticle(LAW_DATA[0].id);
}

function buildTOC(){
  const toc = $('#toc');
  if(!toc) return;
  const q = ($('#searchInput')||{value:''}).value?.trim() || '';
  const onlyBM = ($('#onlyBookmarks')||{checked:false}).checked;
  const minStars = parseInt(($('#minStars')||{value:'0'}).value||'0',10);
  const bms = new Set(storage.get(key('bookmarks', LAW), []));
  toc.innerHTML = '';

  LAW_DATA.filter(a => {
    const stars = storage.get(key('stars', LAW, a.id), a.stars||0);
    const plain = (a.number + ' ' + a.title + ' ' + (a.text||'').replace(/<[^>]+>/g,''));
    const match = !q || plain.includes(q);
    const starOK = stars >= minStars;
    const bmOK = !onlyBM || bms.has(a.id);
    return match && starOK && bmOK;
  }).forEach(a => {
    const item = document.createElement('div');
    item.className = 'toc-item';
    const stars = storage.get(key('stars', LAW, a.id), a.stars||0);
    const isBM = bms.has(a.id);
    const st = storage.get(key('quizStats', LAW, a.id), {correct:0, wrong:0});
    item.innerHTML = `
      <div class="toc-title">
        <strong>${a.number}</strong>
        <small>${a.title}</small>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="stars">${starsStr(stars)}</span>
        <span class="badge">${st.correct}/${st.wrong}</span>
        <span class="badge">${isBM?'★':''}</span>
      </div>`;
    item.addEventListener('click', ()=> openArticle(a.id));
    toc.appendChild(item);
  });
}

function openArticle(id){
  currentId = id;
  const a = LAW_DATA.find(x=>x.id===id);
  if(!a) return;
  if ($('.empty')) $('.empty').hidden = true;
  if ($('#viewer')) $('#viewer').hidden = false;

  const stars = storage.get(key('stars', LAW, id), a.stars||0);
  const bms = new Set(storage.get(key('bookmarks', LAW), []));
  const st = storage.get(key('quizStats', LAW, id), {correct:0, wrong:0});

  if($('#aTitle')) $('#aTitle').textContent = `${a.number} ${a.title}`;
  if($('#aId')) $('#aId').textContent = id;
  if($('#aStars')) $('#aStars').textContent = starsStr(stars);
  if($('#aQuizStats')) $('#aQuizStats').textContent = `${st.correct}/${st.wrong}`;
  if($('#starSelect')) $('#starSelect').value = String(stars);
  if($('#bmBtn')) $('#bmBtn').textContent = bms.has(id) ? '★ 북마크 해제' : '★ 북마크';
  if($('#aBody')) $('#aBody').innerHTML = sanitize(a.text || '');
  if($('#noteInput')) $('#noteInput').value = storage.get(key('note', LAW, id), '');
  if($('#noteStatus')) $('#noteStatus').textContent = '자동 저장됨';

  buildTOC();
}

// Wiring (defensive)
on($('#lawSelect'), 'change', e => loadLaw(e.target.value));
on($('#searchInput'), 'input', () => buildTOC());
on($('#onlyBookmarks'), 'change', () => buildTOC());
on($('#minStars'), 'change', () => buildTOC());
on($('#starSelect'), 'change', e => {
  const v = parseInt(e.target.value,10)||0;
  storage.set(key('stars', LAW, currentId), v);
  if($('#aStars')) $('#aStars').textContent = starsStr(v);
  buildTOC();
});
on($('#bmBtn'), 'click', () => {
  const arr = new Set(storage.get(key('bookmarks', LAW), []));
  if(arr.has(currentId)) arr.delete(currentId); else arr.add(currentId);
  storage.set(key('bookmarks', LAW), Array.from(arr));
  if($('#bmBtn')) $('#bmBtn').textContent = arr.has(currentId) ? '★ 북마크 해제' : '★ 북마크';
  buildTOC();
});
let noteTimer = null;
on($('#noteInput'), 'input', e => {
  if($('#noteStatus')) $('#noteStatus').textContent = '저장 중…';
  clearTimeout(noteTimer);
  noteTimer = setTimeout(()=>{
    storage.set(key('note', LAW, currentId), e.target.value);
    if($('#noteStatus')) $('#noteStatus').textContent = '자동 저장됨';
  }, 400);
});
on($('#toQuiz'), 'click', () => {
  // if there is a tab/canvas for cloze, try to show same-article quiz
  quizShow(currentId);
});

// ===== Cloze (bold segment -> single blank; per-blank reveal; record) =====
let QUIZ_LAW = 'patent';
let LAW_DATA_QUIZ = [];
function statsKey(id){ return key('quizStats', QUIZ_LAW, id); }
function getStats(id){ return storage.get(statsKey(id), {correct:0, wrong:0}); }
function setStats(id, s){ storage.set(statsKey(id), s); }

function toClozeHTML(html){
  html = sanitize(html || '');
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  // Replace each contiguous <b>...</b> with a single blank button
  wrap.querySelectorAll('b').forEach(bEl => {
    const ans = bEl.textContent;
    const btn = document.createElement('button');
    btn.className = 'btn ghost cloze-blank';
    btn.dataset.answer = ans;
    btn.textContent = '____';
    btn.addEventListener('click', () => { btn.textContent = ans; });
    bEl.replaceWith(btn);
  });
  return wrap.innerHTML;
}

function quizShow(id){
  const a = LAW_DATA_QUIZ.find(x=>x.id===id);
  if(!a) return;
  const html = toClozeHTML(a.text);
  if($('#quizView')) $('#quizView').innerHTML = `<h2>${a.number} ${a.title}</h2><div class="meta">${a.id}</div><div class="body">${html}</div>`;
  const st = getStats(id);
  if($('#stats')) $('#stats').textContent = `누적: ${st.correct}/${st.wrong}`;
  on($('#markCorrect'), 'click', ()=>{
    const s = getStats(id); s.correct++; setStats(id,s);
    if($('#stats')) $('#stats').textContent = `누적: ${s.correct}/${s.wrong}`;
    // also reflect into statutes badge next time it opens
  });
  on($('#markWrong'), 'click', ()=>{
    const s = getStats(id); s.wrong++; setStats(id,s);
    if($('#stats')) $('#stats').textContent = `누적: ${s.correct}/${s.wrong}`;
  });
}

async function loadLawQuiz(law='patent'){
  QUIZ_LAW = law;
  try{
    LAW_DATA_QUIZ = await fetchLawJson(law);
    LAW_DATA_QUIZ.forEach(a => a.text = sanitize(a.text || ''));
  }catch(e){
    console.error(e);
    LAW_DATA_QUIZ = [];
  }
  if(LAW_DATA_QUIZ.length) quizShow(LAW_DATA_QUIZ[0].id);
}

// Optional controls (feature-detected)
on($('#startDaily'), 'click', ()=>{
  const n = Math.max(1, parseInt(($('#dailyCount')||{value:'10'}).value||'10',10));
  const queue = [...LAW_DATA_QUIZ].sort(()=>Math.random()-0.5).slice(0, n).map(x=>x.id);
  if(queue.length) quizShow(queue[0]);
});
on($('#gotoArticleQuiz'), 'click', ()=>{
  const q = ($('#searchQuiz')||{value:''}).value.trim();
  const found = LAW_DATA_QUIZ.find(a => (a.number + ' ' + a.title + ' ' + (a.text||'').replace(/<[^>]+>/g,'')).includes(q));
  if(found) quizShow(found.id); else alert('검색 결과가 없습니다');
});
on($('#lawSelectQuiz'), 'change', e => loadLawQuiz(e.target.value));

// Init
loadLaw(LAW);
loadLawQuiz(QUIZ_LAW);
