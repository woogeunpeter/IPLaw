// Common helpers (UMD-lite)
window.$ = (s, r=document) => r.querySelector(s);
window.storage = { get:(k,v=null)=>JSON.parse(localStorage.getItem(k)??JSON.stringify(v)), set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)) };
window.key = (type, law, id='') => `${type}:${law}${id?':'+id:''}`;

window.sanitize = function(html){
  if(!html) return html;
  // Visual-only sanitize (user said highlight issue can be skipped; we keep a light pass)
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
