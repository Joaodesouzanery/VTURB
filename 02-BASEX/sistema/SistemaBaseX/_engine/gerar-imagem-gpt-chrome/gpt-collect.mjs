// espera a imagem ficar pronta e baixa (pode rodar em paralelo, sem foco)
// uso: node gpt-collect.mjs <targetId> <saida>
import { connect, sleep, GEN_SEL } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
const [,, targetId, out] = process.argv;
const {send, js, close} = await connect(targetId);
let src=null;
for (let i=0;i<80;i++){
  await sleep(6000);
  src = await js(`(()=>{const im=${GEN_SEL}; return im.length?im[im.length-1].src:null})()`);
  const working = await js(`/Pensando|Gerando|Criando imagem|Thinking|Generating/i.test(document.body.innerText.slice(-400))`);
  if (src && !working){ await sleep(6000); const s2=await js(`(()=>{const im=${GEN_SEL}; return im.length?im[im.length-1].src:null})()`); if(s2) src=s2; break; }
}
if(!src){ console.error('SEM_IMAGEM'); process.exit(3); }
let b64=null;
for (let t=0;t<3 && !b64;t++){
  try{ await send('Page.bringToFront'); }catch{}
  try{ b64 = await js(`(async()=>{const r=await fetch(${JSON.stringify(src)},{credentials:'include'});const b=await r.blob();const u=new Uint8Array(await b.arrayBuffer());let s='';const c=8192;for(let i=0;i<u.length;i+=c)s+=String.fromCharCode.apply(null,u.subarray(i,i+c));return btoa(s)})()`,true); }
  catch{ await sleep(4000); }
}
if(!b64){ console.error('FALHA_DOWNLOAD'); process.exit(4); }
writeFileSync(out, Buffer.from(b64,'base64'));
console.log('OK', out.split('/').pop(), Math.round(Buffer.from(b64,'base64').length/1024)+'KB');
close(); process.exit(0);
