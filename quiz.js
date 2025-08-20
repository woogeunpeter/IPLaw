(async function(){
  const LAW = 'patent';
  let LIST = [];
  let idx = -1;

  // Daily queue state
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

  // Replace <b>..</b> with buttons IN THE LIVE DOM so listeners work
  function transformClozeInPlace(container){
    // find all <b> in live DOM
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
    // inject sanitized HTML first
    const container = $('#bodyQuiz');
    container.innerHTML = sanitize(a.text);
    // then transform bolds to buttons with event listeners
    transformClozeInPlace(container);

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
          it.innerHTML = `<div><strong>${a.number}</strong><div class="muted" style="font-size:12px">${a.title}</div></div>`;
          it.addEventListener('click', ()=> {
            dailyActive = false; // manual pick exits daily mode
            $('#dailyInfo').textContent = '';
            openByIndex(i);
          });
          el.appendChild(it);
        });
  }

  // Prev/Next behavior depends on dailyActive
  $('#prevQuiz').addEventListener('click', ()=>{
    if(dailyActive){
      if(qpos>0){ qpos--; openByIndex(queue[qpos]); }
    }else{
      if(idx>0) openByIndex(idx-1);
    }
  });
  $('#nextQuiz').addEventListener('click', ()=>{
    if(dailyActive){
      if(qpos < queue.length-1){ qpos++; openByIndex(queue[qpos]); }
    }else{
      if(idx<LIST.length-1) openByIndex(idx+1);
    }
  });

  // Start daily
  $('#startDaily').addEventListener('click', ()=>{
    const n = Math.max(1, parseInt($('#dailyCount').value||'10',10));
    const ids = LIST.map((_,i)=>i);
    const shuffled = shuffle(ids);
    queue = shuffled.slice(0, Math.min(n, shuffled.length));
    qpos = 0;
    dailyActive = true;
    $('#dailyInfo').textContent = `데일리 진행: ${queue.length}개 (1/${queue.length})`;
    openByIndex(queue[qpos]);
  });

  // Update daily progress text whenever opening via daily
  const origOpenByIndex = openByIndex;
  openByIndex = function(i){
    origOpenByIndex(i);
    if(dailyActive){
      const position = qpos >=0 ? (qpos+1) : (queue.indexOf(i)+1);
      $('#dailyInfo').textContent = `데일리 진행: ${queue.length}개 (${position}/${queue.length})`;
    }
  }

  // Init
  LIST = await fetchLawJson('patent');
  LIST.forEach(a => a.text = sanitize(a.text));
  buildTOC();

  // Start with a random item initially (as you observed)
  const startIndex = Math.floor(Math.random()*LIST.length);
  openByIndex(startIndex);
})();