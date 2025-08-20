// Common helpers
window.$ = (s, r=document) => r.querySelector(s);
window.$$ = (s, r=document) => Array.from(r.querySelectorAll(s));
window.storage = { get:(k,v=null)=>JSON.parse(localStorage.getItem(k)??JSON.stringify(v)), set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)) };
window.key = (type, law, id='') => `${type}:${law}${id?':'+id:''}`;
window.starsStr = n => '★'.repeat(n||0) + '☆'.repeat(Math.max(0, 5-(n||0)));

window.normalize = function(s){
  return (s||'').toString().toLowerCase().normalize('NFKD').replace(/\s+/g,' ').trim();
}
window.tokenMatch = function(text, query){
  const T = normalize(text);
  const tokens = normalize(query).split(' ').filter(Boolean);
  return tokens.every(t => T.includes(t));
}

window.sanitize = function(html){
  if(!html) return html;
  html = html.replace(/<span[^>]*class="[^"]*hl[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  html = html.replace(/<span[^>]*style="[^"]*background[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  return html;
}
window.fetchLawJson = async function(law){
  const ts = Date.now();
  const res = await fetch(`./data/${law}.json?ts=${ts}`, { cache: 'no-store' });
  if(!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}
window.getParam = function(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}
window.autosize = function(ta){
  const fit = () => { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight+2)+'px'; };
  fit(); ta.addEventListener('input', fit); window.addEventListener('resize', fit);
}
