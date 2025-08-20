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

  function statsKey(id){ return key('quizStats', LAW, id); }
  function getStats(id){ return storage.get(statsKey(id), {correct:0, wrong:0}); }
  function setStats(id,s){ storage.set(statsKey(id), s); }

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
    LIST.filter(a => {
      const note = storage.get(key('note', LAW, a.id), ''); // include memo in search
      const plain = (a.number + ' ' + a.title + ' ' + a.text.replace(/<[^>]+>/g,'') + ' ' + note);
      return !q || tokenMatch(plain, q);
    }).forEach((a,i)=>{
      const it = document.createElement('div'); it.className='toc-item';
      it.innerHTML = `<div class="toc-title"><strong>${a.number}</strong><small>${a.title}</small></div>`;
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

  // Start daily
  $('#startDaily').addEventListener('click', ()=>{
    const n = Math.max(1, parseInt($('#dailyCount').value||'10',10));
    const ids = LIST.map((_,i)=>i);
    queue = shuffle(ids).slice(0, Math.min(n, ids.length));
    qpos = 0;
    dailyActive = true;
    openByIndex(queue[qpos]);
    updateDailyInfo();
  });

  // Init
  LIST = await fetchLawJson('patent');
  LIST.forEach(a => a.text = sanitize(a.text));
  buildTOC();

  // Open by ?id if provided, else random
  const pid = getParam('id');
  const i = pid ? LIST.findIndex(x=>x.id===pid) : -1;
  if(i>=0) openByIndex(i);
  else openByIndex(Math.floor(Math.random()*LIST.length));
})();