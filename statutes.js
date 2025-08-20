(async function(){
  const LAW = 'patent';
  let LIST = [];
  let idx = -1;

  function getStars(id, def=0){ return storage.get(key('stars', LAW, id), def); }
  function setStars(id, n){ storage.set(key('stars', LAW, id), n); }
  function isBookmarked(id){ const set = new Set(storage.get(key('bookmarks', LAW), [])); return set.has(id); }
  function toggleBookmark(id){
    const set = new Set(storage.get(key('bookmarks', LAW), []));
    if(set.has(id)) set.delete(id); else set.add(id);
    storage.set(key('bookmarks', LAW), Array.from(set));
  }

  function buildTOC(){
    const el = $('#tocStat'); el.innerHTML='';
    const q = $('#searchStat').value.trim();
    const onlyBM = $('#onlyBookmarks').checked;
    const minStars = parseInt($('#minStars').value||'0',10);

    LIST.filter(a => {
      const note = storage.get(key('note', LAW, a.id), '');
      const plain = (a.number + ' ' + a.title + ' ' + a.text.replace(/<[^>]+>/g,'') + ' ' + note);
      const stars = getStars(a.id, a.stars||0);
      const okQ = !q || tokenMatch(plain, q);
      const okBM = !onlyBM || isBookmarked(a.id);
      const okS = (stars >= minStars);
      return okQ && okBM && okS;
    }).forEach((a,i)=>{
      const it = document.createElement('div'); it.className='toc-item';
      const s = getStars(a.id, a.stars||0);
      const bm = isBookmarked(a.id);
      const st = storage.get(key('quizStats', LAW, a.id), {correct:0, wrong:0});
      it.innerHTML = `
        <div class="toc-title">
          <strong>${a.number}</strong>
          <small>${a.title}</small>
        </div>
        <div class="row gap">
          <span class="stars">${'★'.repeat(s)}${'☆'.repeat(5-s)}</span>
          <span class="badge">${st.correct}/${st.wrong}</span>
          <span class="badge">${bm?'★':''}</span>
        </div>`;
      it.addEventListener('click', ()=> openAt(i));
      el.appendChild(it);
    });
  }

  function renderStarsEditable(container, value, onChange){
    container.innerHTML = '';
    for(let i=1;i<=5;i++){
      const b = document.createElement('button');
      b.className = 'btn ghost';
      b.textContent = i<=value ? '★' : '☆';
      b.title = `${i}점`;
      b.addEventListener('click', ()=> onChange(i));
      container.appendChild(b);
    }
  }

  function openAt(i){
    idx = i;
    const a = LIST[i];
    $('#emptyStat').hidden = true;
    $('#viewerStat').hidden = false;
    $('#titleStat').textContent = `${a.number} ${a.title}`;
    $('#bodyStat').innerHTML = sanitize(a.text);

    // memo
    $('#noteStat').value = storage.get(key('note', LAW, a.id), '');
    $('#noteStatus').textContent = '자동 저장됨';
    autosize($('#noteStat'));

    // stars + bookmark UI
    renderStarsEditable($('#starRow'), getStars(a.id, a.stars||0), (n)=>{
      setStars(a.id, n);
      buildTOC();
      openAt(i); // rerender
    });
    $('#bmBtn').textContent = isBookmarked(a.id) ? '★ 북마크 해제' : '☆ 북마크';
    $('#bmBtn').onclick = ()=>{ toggleBookmark(a.id); buildTOC(); openAt(i); };
    $('#toQuiz').href = `./quiz.html?id=${encodeURIComponent(a.id)}`;
  }

  // nav
  $('#prevStat').addEventListener('click', ()=>{ if(idx>0) openAt(idx-1); });
  $('#nextStat').addEventListener('click', ()=>{ if(idx<LIST.length-1) openAt(idx+1); });

  // memo save
  let noteTimer=null;
  $('#noteStat').addEventListener('input', (e)=>{
    $('#noteStatus').textContent = '저장 중…';
    clearTimeout(noteTimer);
    noteTimer = setTimeout(()=>{
      const a = LIST[idx];
      storage.set(key('note', LAW, a.id), e.target.value);
      $('#noteStatus').textContent = '자동 저장됨';
    }, 350);
  });
  $('#noteClear').addEventListener('click', ()=>{
    const a = LIST[idx];
    $('#noteStat').value='';
    storage.set(key('note', LAW, a.id), '');
    $('#noteStatus').textContent = '비움';
    autosize($('#noteStat'));
    buildTOC(); // note cleared -> affects search results
  });

  LIST = await fetchLawJson('patent');
  LIST.forEach(a => a.text = sanitize(a.text));
  buildTOC();
  // open by ?id
  const pid = getParam('id');
  const i = pid ? LIST.findIndex(x=>x.id===pid) : -1;
  if(i>=0) openAt(i);
})();