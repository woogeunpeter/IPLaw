import { $, storage, key, starsStr, sanitize, fetchLawJson, getQueryParam } from './common.js';

let LAW = 'patent';
let LIST = [];
let idx = -1;

function getStats(id){ return storage.get(key('quizStats', LAW, id), {correct:0, wrong:0}); }
function getStars(id, def=0){ return storage.get(key('stars', LAW, id), def); }
function isBookmarked(id){ return new Set(storage.get(key('bookmarks', LAW), [])).has(id); }

function buildTOC(){
  const el = $('#tocStat'); el.innerHTML='';
  const q = $('#searchStat').value.trim();
  const onlyBM = $('#onlyBookmarks').checked;
  const minStars = parseInt($('#minStars').value||'0', 10);
  const bmSet = new Set(storage.get(key('bookmarks', LAW), []));

  LIST.filter(a => {
    const stars = getStars(a.id, a.stars||0);
    const plain = (a.number + ' ' + a.title + ' ' + a.text.replace(/<[^>]+>/g,''));
    const match = !q || plain.includes(q);
    const bmOK = !onlyBM || bmSet.has(a.id);
    const starOK = (stars >= minStars);
    return match && bmOK && starOK;
  }).forEach((a,i)=>{
    const it = document.createElement('div'); it.className='toc-item';
    const s = getStars(a.id, a.stars||0);
    const st = getStats(a.id);
    const bm = bmSet.has(a.id)?'★':'';
    it.innerHTML = `<div><strong>${a.number}</strong><div class="muted" style="font-size:12px">${a.title}</div></div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="stars">${starsStr(s)}</span>
        <span class="badge">${st.correct}/${st.wrong}</span>
        <span class="badge">${bm}</span>
      </div>`;
    it.addEventListener('click', ()=> openAt(i));
    el.appendChild(it);
  });
}

function openAt(i){
  idx = i;
  const a = LIST[i];
  $('#emptyStat').hidden = true;
  $('#viewerStat').hidden = false;

  const stars = getStars(a.id, a.stars||0);
  const bmSet = new Set(storage.get(key('bookmarks', LAW), []));
  const st = getStats(a.id);

  $('#titleStat').textContent = `${a.number} ${a.title}`;
  $('#idStat').textContent = a.id;
  $('#starsStat').textContent = starsStr(stars);
  $('#quizBadge').textContent = `${st.correct}/${st.wrong}`;
  $('#bmBadge').textContent = bmSet.has(a.id) ? '★' : ' ';
  $('#starSelect').value = String(stars);

  $('#bodyStat').innerHTML = sanitize(a.text);
  $('#noteStat').value = storage.get(key('note', LAW, a.id), '');
  $('#noteStatus').textContent = '자동 저장됨';

  // set quiz link with id param
  $('#toQuiz').href = `./quiz.html?id=${encodeURIComponent(a.id)}`;
}

$('#prevStat').addEventListener('click', ()=>{ if(idx>0) openAt(idx-1); });
$('#nextStat').addEventListener('click', ()=>{ if(idx<LIST.length-1) openAt(idx+1); });

let noteTimer=null;
$('#noteStat').addEventListener('input', (e)=>{
  $('#noteStatus').textContent = '저장 중…';
  clearTimeout(noteTimer);
  noteTimer = setTimeout(()=>{
    const a = LIST[idx];
    storage.set(key('note', LAW, a.id), e.target.value);
    $('#noteStatus').textContent = '자동 저장됨';
  }, 400);
});

$('#starSelect').addEventListener('change', (e)=>{
  const v = parseInt(e.target.value,10)||0;
  const a = LIST[idx];
  storage.set(key('stars', LAW, a.id), v);
  $('#starsStat').textContent = starsStr(v);
  buildTOC();
});
$('#onlyBookmarks').addEventListener('change', buildTOC);
$('#minStars').addEventListener('change', buildTOC);

$('#bmBtn').addEventListener('click', ()=>{
  const a = LIST[idx];
  const set = new Set(storage.get(key('bookmarks', LAW), []));
  if(set.has(a.id)) set.delete(a.id); else set.add(a.id);
  storage.set(key('bookmarks', LAW), Array.from(set));
  $('#bmBadge').textContent = set.has(a.id)?'★':' ';
  buildTOC();
});

$('#searchStat').addEventListener('input', buildTOC);

async function init(){
  LIST = await fetchLawJson('patent');
  LIST.forEach(a => a.text = sanitize(a.text));
  buildTOC();
  // If query param id provided, open that; else first
  const targetId = getQueryParam('id');
  const i = targetId ? LIST.findIndex(x=>x.id===targetId) : 0;
  if (i>=0) openAt(i);
}
init();
