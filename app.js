// IPLaw app.js (patched)
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

// --- Fetch helper that cache-busts JSON data ---
async function fetchLawJson(law){
  const ts = Date.now();
  const res = await fetch(`./data/${law}.json?ts=${ts}`, { cache: 'no-store' });
  if(!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

// ====== Existing app logic (minimal, keep your UI) ======
const $ = (s, r=document) => r.querySelector(s);
const starsStr = n => '★'.repeat(n||0) + '☆'.repeat(Math.max(0, 5-(n||0)));
const storage = {
  get: (k, v=null) => JSON.parse(localStorage.getItem(k) ?? JSON.stringify(v)),
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};
const key = (type, law, id='') => `${type}:${law}${id?':'+id:''}`;

let LAW = 'patent';
let LAW_DATA = [];
let currentId = null;

async function loadLaw(law){
  LAW = law;
  try{
    LAW_DATA = await fetchLawJson(law);
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
  toc && (toc.innerHTML = '');

  LAW_DATA.filter(a => {
    const stars = storage.get(key('stars', LAW, a.id), a.stars||0);
    const text = `${a.number} ${a.title} ${a.text}`;
    const match = !q || text.includes(q);
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
    toc && toc.appendChild(item);
  });
}

function openArticle(id){
  currentId = id;
  const a = LAW_DATA.find(x => x.id === id);
  if(!a) return;
  const empty = document.querySelector('.empty');
  const viewer = document.getElementById('viewer');
  if (empty) empty.hidden = true;
  if (viewer) viewer.hidden = false;

  const stars = storage.get(key('stars', LAW, id), a.stars||0);
  const bms = new Set(storage.get(key('bookmarks', LAW), []));

  const t = document.getElementById('aTitle');
  const i = document.getElementById('aId');
  const s = document.getElementById('aStars');
  const sel = document.getElementById('starSelect');
  const bmBtn = document.getElementById('bmBtn');
  const body = document.getElementById('aBody');
  const note = document.getElementById('noteInput');

  t && (t.textContent = `${a.number} ${a.title}`);
  i && (i.textContent = id);
  s && (s.textContent = starsStr(stars));
  sel && (sel.value = String(stars));
  bmBtn && (bmBtn.textContent = bms.has(id) ? '★ 북마크 해제' : '★ 북마크');

  // Render body with bold kept, highlight removed
  if (body){
    body.innerHTML = a.text;
    // unwrap any .hl spans (remove highlight visually)
    body.querySelectorAll('span.hl').forEach(span => {
      const text = document.createTextNode(span.textContent);
      span.replaceWith(text);
    });
  }

  if (note){
    note.value = storage.get(key('note', LAW, id), '');
    const ns = document.getElementById('noteStatus');
    ns && (ns.textContent = '자동 저장됨');
  }
  buildTOC();
}

// event bindings (guarded for pages that may not have these controls)
document.getElementById('lawSelect')?.addEventListener('change', e => loadLaw(e.target.value));
document.getElementById('searchInput')?.addEventListener('input', () => buildTOC());
document.getElementById('onlyBookmarks')?.addEventListener('change', () => buildTOC());
document.getElementById('minStars')?.addEventListener('change', () => buildTOC());

document.getElementById('starSelect')?.addEventListener('change', e => {
  const v = parseInt(e.target.value,10)||0;
  storage.set(key('stars', LAW, currentId), v);
  document.getElementById('aStars') && (document.getElementById('aStars').textContent = starsStr(v));
  buildTOC();
});

document.getElementById('bmBtn')?.addEventListener('click', () => {
  const k = key('bookmarks', LAW);
  const arr = new Set(storage.get(k, []));
  if(arr.has(currentId)) arr.delete(currentId); else arr.add(currentId);
  storage.set(k, Array.from(arr));
  document.getElementById('bmBtn') && (document.getElementById('bmBtn').textContent = arr.has(currentId) ? '★ 북마크 해제' : '★ 북마크');
  buildTOC();
});

let noteTimer = null;
document.getElementById('noteInput')?.addEventListener('input', e => {
  const ns = document.getElementById('noteStatus');
  ns && (ns.textContent = '저장 중…');
  clearTimeout(noteTimer);
  noteTimer = setTimeout(()=>{
    storage.set(key('note', LAW, currentId), e.target.value);
    ns && (ns.textContent = '자동 저장됨');
  }, 500);
});

// init
loadLaw(LAW);
