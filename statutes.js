(async function(){
  const LAW = 'patent';
  let LIST = [];
  let idx = -1;

  function buildTOC(){
    const el = $('#tocStat'); el.innerHTML='';
    const q = $('#searchStat').value.trim();
    LIST.filter(a => !q || (a.number + ' ' + a.title + ' ' + a.text.replace(/<[^>]+>/g,'')).includes(q))
        .forEach((a,i)=>{
          const it = document.createElement('div'); it.className='toc-item';
          it.innerHTML = `<div><strong>${a.number}</strong><div class="muted" style="font-size:12px">${a.title}</div></div>`;
          it.addEventListener('click', ()=> openAt(i));
          el.appendChild(it);
        });
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

  LIST = await fetchLawJson('patent');
  LIST.forEach(a => a.text = sanitize(a.text));
  buildTOC();
})();