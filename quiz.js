(async function(){
  const LAW = 'patent';
  let LIST = [];
  let idx = -1;

  // Daily queue
  let dailyActive = false;
  let queue = [];
  let qpos = -1;

  function shuffle(arr){
    const a = [...arr];
    for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  function getResult(id){ return storage.get(key('result', LAW, id), null); } // 'O'|'X'|null
  function setResult(id, v){ storage.set(key('result', LAW, id), v); }

  function isBookmarked(id){ const set = new Set(storage.get(key('bookmarks', LAW), [])); return set.has(id); }
  function getStars(id, def=0){ return storage.get(key('stars', LAW, id), def); }

  function transformClozeInPlace(container){
    const bolds = Array.from(container.querySelectorAll('b'));
    bolds.forEach(bEl => {
      const ans = bEl.textContent;
      const btn = document.createElement('button');
      btn.className = 'btn ghost';
      btn.textContent = '____';
      btn.addEventListener('click', ()=>{ btn.textContent = ans; });
      bEl.replaceWith(btn);
    });
  }

  function openByIndex(i){
    idx = i;
    const a = LIST[i];
    $('#emptyQuiz').hidden = true;
    $('#viewerQuiz').hidden = false;
    $('#titleQuiz').textContent = `${a.number} ${a.title}`;

    const container = $('#bodyQuiz');
    container.innerHTML = sanitize(a.text);
    transformClozeInPlace(container);

    const stv = getStars(a.id, a.stars||0);
    $('#quizStarBadge').textContent = stv ? `★x${stv}` : '';
    $('#quizBmBadge').textContent = isBookmarked(a.id) ? '북마크' : '';

    const r = getResult(a.id);
    $('#stats').textContent = r ? `표시됨: ${r}` : '표시 없음';
    $('#markOQuiz').onclick = ()=>{ setResult(a.id, 'O'); $('#stats').textContent='표시됨: O'; buildTOC(); };
    $('#markXQuiz').onclick = ()=>{ setResult(a.id, 'X'); $('#stats').textContent='표시됨: X'; buildTOC(); };
    $('#markClearQuiz').onclick = ()=>{ setResult(a.id, null); $('#stats').textContent='표시 없음'; buildTOC(); };
  }

  function buildTOC(){
    const el = $('#tocQuiz'); el.innerHTML='';
    const q = $('#searchQuiz').value.trim();
    LIST.filter(a => {
      const note = storage.get(key('note', LAW, a.id), ''); // include memo
      const plain = (a.number + ' ' + a.title + ' ' + a.text.replace(/<[^>]+>/g,'') + ' ' + note);
      return !q || tokenMatch(plain, q);
    }).forEach((a,i)=>{
      const r = getResult(a.id);
      const it = document.createElement('div'); it.className='toc-item';
      it.innerHTML = `<div class="toc-title"><strong>${a.number}</strong><small>${a.title}</small></div>
        <div class="row gap"><span class="badge result ${r||''}">${r||''}</span></div>`;
      it.addEventListener('click', ()=> { dailyActive=false; $('#dailyInfo').textContent=''; openByIndex(i); });
      el.appendChild(it);
    });
  }

  // Prev/Next depending on mode
  $('#prevQuiz').addEventListener('click', ()=>{
    if(dailyActive){ if(qpos>0){ qpos--; openByIndex(queue[qpos]); updateDailyInfo(); } }
    else { if(idx>0) openByIndex(idx-1); }
  });
  $('#nextQuiz').addEventListener('click', ()=>{
    if(dailyActive){ if(qpos<queue.length-1){ qpos++; openByIndex(queue[qpos]); updateDailyInfo(); } }
    else { if(idx<LIST.length-1) openByIndex(idx+1); }
  });

  function updateDailyInfo(){
    if(dailyActive) $('#dailyInfo').textContent = `데일리 진행: ${queue.length}개 (${qpos+1}/${queue.length})`;
    else $('#dailyInfo').textContent='';
  }

  // Weighted sampling without replacement
  function dailySelect(count){
    // weights: unseen(null)=3, X=2, O=1
    const weights = LIST.map(a => {
      const r = getResult(a.id);
      return r === null ? 3 : (r === 'X' ? 2 : 1);
    });
    const avail = LIST.map((_,i)=>i);
    const selected = [];
    let total = weights.reduce((s,x)=>s+x,0);
    for(let k=0; k<Math.min(count, avail.length); k++){
      // pick index by weights
      let r = Math.random() * total;
      let pick = 0;
      for(let i=0;i<avail.length;i++){
        const w = weights[avail[i]];
        if(r < w){ pick = i; break; }
        r -= w;
      }
      const chosenIndex = avail[pick];
      selected.push(chosenIndex);
      total -= weights[chosenIndex];
      avail.splice(pick,1);
    }
    return selected;
  }

  // Start daily
  $('#startDaily').addEventListener('click', ()=>{
    const n = Math.max(1, parseInt($('#dailyCount').value||'10',10));
    queue = dailySelect(n);
    qpos = 0;
    dailyActive = true;
    openByIndex(queue[qpos]);
    updateDailyInfo();
  });

  // Init
  LIST = await fetchLawJson('patent');
  LIST.forEach(a => a.text = sanitize(a.text));
  // search listeners
  $('#searchQuiz').addEventListener('input', buildTOC);
  buildTOC();

  // Open by ?id if provided, else random
  const pid = getParam('id');
  const i = pid ? LIST.findIndex(x=>x.id===pid) : -1;
  if(i>=0) openByIndex(i);
  else openByIndex(Math.floor(Math.random()*LIST.length));
})();