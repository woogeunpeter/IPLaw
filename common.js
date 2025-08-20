// Common helpers used by both pages
export const $ = (s, r=document) => r.querySelector(s);
export const storage = { get:(k,v=null)=>JSON.parse(localStorage.getItem(k)??JSON.stringify(v)), set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)) };
export const key = (type, law, id='') => `${type}:${law}${id?':'+id:''}`;

export function sanitize(html){
  if(!html) return html;
  html = html.replace(/<span[^>]*class="[^"]*hl[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  html = html.replace(/<span[^>]*style="[^"]*background[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  return html;
}
export async function fetchLawJson(law){
  const ts = Date.now();
  const res = await fetch(`./data/${law}.json?ts=${ts}`, { cache: 'no-store' });
  if(!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}
