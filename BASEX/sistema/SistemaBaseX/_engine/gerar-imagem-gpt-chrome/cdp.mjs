/* A porta 9222 nem sempre e o Chrome logado: outro navegador ou utilitario do
   sistema pode estar ocupando ela. CDP_PORT permite apontar para a instancia certa. */
export const CDP_PORT = process.env.CDP_PORT || '9222';

export async function connect(targetId){
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const page = list.find(p => p.id === targetId);
  if(!page) throw new Error('target nao encontrado '+targetId);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pending=new Map();
  const send=(m,p={})=>new Promise((res,rej)=>{ const i=++id; pending.set(i,{res,rej});
    ws.send(JSON.stringify({id:i,method:m,params:p}));
    setTimeout(()=>{ if(pending.has(i)){pending.delete(i); rej(new Error('timeout '+m));} },150000); });
  ws.onmessage=e=>{ const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){ const {res,rej}=pending.get(m.id); pending.delete(m.id); m.error?rej(new Error(m.error.message)):res(m.result); } };
  await new Promise(r=>ws.onopen=r);
  await send('DOM.enable'); await send('Runtime.enable'); await send('Page.enable');
  const js = async (expr, awaitP=false) => (await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:awaitP})).result.value;
  return {send, js, close:()=>ws.close()};
}
export const sleep = ms => new Promise(r=>setTimeout(r,ms));
export const GEN_SEL = `[...document.querySelectorAll('main img')].filter(i=>/estuary\\/content/.test(i.src)&&i.naturalWidth>=800&&!/\\.(png|jpg|jpeg|webp)$/i.test(i.alt||''))`;
