// anexa a referencia e dispara o prompt (exige foco; rodar em serie)
// uso: node gpt-submit.mjs <targetId> <ref> "<prompt>"
import { connect, sleep } from './cdp.mjs';
import { existsSync } from 'node:fs';
const [,, targetId, refFile, prompt] = process.argv;

// Sem referencia e caso valido: banner e capa nascem do zero, sem imagem base.
// O que nao pode e entrar no laco de anexo com um caminho que nao existe:
// ele tenta seis vezes, e cada tentativa vira um erro vermelho na tela do ChatGPT.
const semRef = !refFile || refFile === 'null' || refFile === 'undefined';
if (!semRef && !existsSync(refFile)) {
  console.error('ARQUIVO_NAO_EXISTE: ' + refFile);
  process.exit(3);
}
const {send, js, close} = await connect(targetId);
for (let i=0;i<40;i++){ if(await js(`!!document.querySelector('#prompt-textarea, div[contenteditable="true"]')`)) break; await sleep(1500); }
try{ await send('Page.bringToFront'); }catch{}
await sleep(1200);
const antes = await js(`[...document.querySelectorAll('main img')].length`);
let anexou=semRef;   // sem referencia nao ha o que anexar, segue direto para o prompt
for (let idx=0; idx<6 && !anexou; idx++){
  try{ await send('Page.bringToFront'); }catch{}
  const k = idx % 3;
  await send('DOM.getDocument',{depth:-1});
  const ev = await send('Runtime.evaluate',{expression:`[...document.querySelectorAll('input[type=file]')].filter(i=>(i.accept||'').includes('image'))[${k}]`});
  if(!ev.result?.objectId) { await sleep(1500); continue; }
  const {nodeId} = await send('DOM.requestNode',{objectId:ev.result.objectId});
  try{ await send('DOM.setFileInputFiles',{nodeId,files:[refFile]}); }catch{ continue; }
  await js(`(()=>{[...document.querySelectorAll('input[type=file]')].filter(i=>i.files&&i.files.length).forEach(i=>{i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))});return 1})()`);
  await sleep(3000);
  if (await js(`[...document.querySelectorAll('main img')].length`) > antes) anexou=true;
}
if(!anexou){ console.error('FALHA_ANEXO'); process.exit(2); }
for (let i=0;i<25;i++){ if(!(await js(`!!document.querySelector('[data-testid="send-button"][disabled]')`))) break; await sleep(1500); }
await js(`(()=>{const e=document.querySelector('#prompt-textarea, div[contenteditable="true"]'); e.focus(); document.execCommand('insertText',false,${JSON.stringify(prompt)}); return 1})()`);
await sleep(900);
const sent = await js(`(()=>{const b=document.querySelector('[data-testid="send-button"]')||[...document.querySelectorAll('button')].find(x=>/Enviar prompt|Send prompt/i.test(x.getAttribute('aria-label')||'')); if(b){b.click(); return 1} return 0})()`);
console.log(sent? 'SUBMIT_OK':'SUBMIT_FALHA');
close(); process.exit(sent?0:3);
