// State & storage helpers
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const storage = {
  get: (k, v=null) => JSON.parse(localStorage.getItem(k) ?? JSON.stringify(v)),
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};
const key = (type, law, id='') => `${type}:${law}${id?':'+id:''}`;

let LAW = 'patent';
let LAW_DATA = [];
let currentId = null;

const starsStr = n => '★'.repeat(n||0) + '☆'.repeat(Math.max(0, 5-(n||0)));

// Load law data
async function loadLaw(law){
  LAW = law;
  const res = await fetch(`./data/${law}.json`);
  LAW_DATA = await res.json();
  buildTOC();
  if (LAW_DATA.length) openArticle(LAW_DATA[0].id);
}

// Build sidebar list
function buildTOC(){
  const q = $('#searchInput').value.trim();
  const onlyBM = $('#onlyBookmarks').checked;
  const minStars = parseInt($('#minStars').value||'0',10);
  const bms = new Set(storage.get(key('bookmarks', LAW), []));
  const toc = $('#toc');
  toc.innerHTML = '';

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
      </div>
    `;
    item.addEventListener('click', ()=> openArticle(a.id));
    toc.appendChild(item);
  });
}

// Open article
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

  // Render body (already HTML with <b> & .hl-* spans allowed)
  $('#aBody').innerHTML = a.text;

  // Notes
  $('#noteInput').value = storage.get(key('note', LAW, id), '');
  $('#noteStatus').textContent = '자동 저장됨';

  // Update TOC visual quickly
  buildTOC();
}

// Event bindings
$('#lawSelect').addEventListener('change', e => loadLaw(e.target.value));
$('#searchInput').addEventListener('input', () => buildTOC());
$('#onlyBookmarks').addEventListener('change', () => buildTOC());
$('#minStars').addEventListener('change', () => buildTOC());

$('#starSelect').addEventListener('change', e => {
  const v = parseInt(e.target.value,10)||0;
  storage.set(key('stars', LAW, currentId), v);
  $('#aStars').textContent = starsStr(v);
  buildTOC();
});

$('#bmBtn').addEventListener('click', () => {
  const arr = new Set(storage.get(key('bookmarks', LAW), []));
  if(arr.has(currentId)) arr.delete(currentId); else arr.add(currentId);
  storage.set(key('bookmarks', LAW), Array.from(arr));
  $('#bmBtn').textContent = arr.has(currentId) ? '★ 북마크 해제' : '★ 북마크';
  buildTOC();
});

// Notes autosave (debounced)
let noteTimer = null;
$('#noteInput').addEventListener('input', e => {
  $('#noteStatus').textContent = '저장 중…';
  clearTimeout(noteTimer);
  noteTimer = setTimeout(()=>{
    storage.set(key('note', LAW, currentId), e.target.value);
    $('#noteStatus').textContent = '자동 저장됨';
  }, 500);
});

// Home button: (placeholder for future multi-mode)
$('#homeBtn').addEventListener('click', () => {
  window.scrollTo({top:0,behavior:'smooth'});
});

// Init
loadLaw(LAW);
