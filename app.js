// ===== Navigation (Home → Statutes/Cloze with back) =====
const screens = {
  home: document.getElementById('screen-home'),
  statutes: document.getElementById('screen-statutes'),
  cloze: document.getElementById('screen-cloze'),
};
const backBtn = document.getElementById('backBtn');
function show(screen){
  Object.values(screens).forEach(s=>s.hidden=true);
  screens[screen].hidden=false;
  backBtn.hidden = (screen === 'home');
  localStorage.setItem('lastScreen', screen);
}
document.getElementById('goStatutes').addEventListener('click', ()=> show('statutes'));
document.getElementById('goCloze').addEventListener('click', ()=> show('cloze'));
backBtn.addEventListener('click', ()=> show('home'));
show(localStorage.getItem('lastScreen') || 'home');

// ===== Helpers =====
const $ = (s, r=document) => r.querySelector(s);
const storage = {
  get: (k, v=null) => JSON.parse(localStorage.getItem(k) ?? JSON.stringify(v)),
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};
const key = (type, law, id='') => `${type}:${law}${id?':'+id:''}`;
const starsStr = n => '★'.repeat(n||0) + '☆'.repeat(Math.max(0, 5-(n||0)));

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

// ===== Statutes Mode =====
let LAW = 'patent';
let LAW_DATA = [];
let currentId = null;

async function loadLaw(law){
  LAW = law;
  try{
    LAW_DATA = await fetchLawJson(law);
    LAW_DATA.forEach(a => a.text = sanitize(a.text));
  }catch(err){
    alert('데이터 불러오기 오류: ' + err.message);
    LAW_DATA = [];
  }
  buildTOC();
  if (LAW_DATA.length) openArticle(LAW_DATA[0].id);
}

function getQuizStats(law,id){
  return storage.get(key('quizStats', law, id), {correct:0, wrong:0});
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
    const st = getQuizStats(LAW, a.id);
    item.innerHTML = `
      <div class="toc-title">
        <strong>${a.number}</strong>
        <small>${a.title}</small>
      </div>
      <div class="starbadges">
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
  const a = LAW_DATA.find(x => x.id === id);
  if(!a) return;
  $('.empty').hidden = true;
  $('#viewer').hidden = false;

  const stars = storage.get(key('stars', LAW, id), a.stars||0);
  const bms = new Set(storage.get(key('bookmarks', LAW), []));
  const qst = getQuizStats(LAW, id);

  $('#aTitle').textContent = `${a.number} ${a.title}`;
  $('#aId').textContent = id;
  $('#aStars').textContent = starsStr(stars);
  $('#aQuizStats').textContent = `${qst.correct}/${qst.wrong}`;
  $('#starSelect').value = String(stars);
  $('#bmBtn').textContent = bms.has(id) ? '★ 북마크 해제' : '★ 북마크';

  $('#aBody').innerHTML = sanitize(a.text);

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
  show('cloze');
  quizShow(currentId);
});

// ===== Cloze Quiz Mode (bold segments -> single blank; per-blank reveal) =====
let QUIZ_LAW = 'patent';
let LAW_DATA_QUIZ = [];

function statsKey(id){ return key('quizStats', QUIZ_LAW, id); }
function getStats(id){ return storage.get(statsKey(id), {correct:0, wrong:0}); }
function setStats(id, s){ storage.set(statsKey(id), s); }

function toClozeHTML(html){
  html = sanitize(html);
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  wrap.querySelectorAll('b').forEach(bEl => {
    const ans = bEl.textContent; // whole bold segment
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
  document.getElementById('quizView').innerHTML =
    `<h2>${a.number} ${a.title}</h2><div class="meta">${a.id}</div><div class="body">${html}</div>`;
  const st = getStats(id);
  document.getElementById('stats').textContent = `누적: ${st.correct}/${st.wrong}`;
  document.getElementById('markCorrect').onclick = ()=>{
    const s = getStats(id); s.correct++; setStats(id, s);
    document.getElementById('stats').textContent = `누적: ${s.correct}/${s.wrong}`;
  };
  document.getElementById('markWrong').onclick = ()=>{
    const s = getStats(id); s.wrong++; setStats(id, s);
    document.getElementById('stats').textContent = `누적: ${s.correct}/${s.wrong}`;
  };
}

async function loadLawQuiz(law='patent'){
  QUIZ_LAW = law;
  LAW_DATA_QUIZ = await fetchLawJson(law);
  LAW_DATA_QUIZ.forEach(a => a.text = sanitize(a.text));
  if (LAW_DATA_QUIZ.length) quizShow(LAW_DATA_QUIZ[0].id);
}

document.getElementById('startDaily').addEventListener('click', ()=>{
  const n = Math.max(1, parseInt(document.getElementById('dailyCount').value||'10',10));
  const queue = [...LAW_DATA_QUIZ].sort(()=>Math.random()-0.5).slice(0, n).map(x=>x.id);
  if (queue.length){ quizShow(queue[0]); }
});
document.getElementById('gotoArticleQuiz').addEventListener('click', ()=>{
  const q = document.getElementById('searchQuiz').value.trim();
  const found = LAW_DATA_QUIZ.find(a => (a.number + ' ' + a.title + ' ' + a.text.replace(/<[^>]+>/g,'')).includes(q));
  if(found) quizShow(found.id); else alert('검색 결과가 없습니다');
});
document.getElementById('lawSelectQuiz').addEventListener('change', e => loadLawQuiz(e.target.value));

// Init
loadLaw(LAW);
loadLawQuiz(QUIZ_LAW);
