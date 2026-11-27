// submit em serie (precisa de foco) + colheita em paralelo (nao precisa)
import { readFileSync, existsSync } from 'node:fs';
import { CDP_PORT } from './cdp.mjs';
import { spawn } from 'node:child_process';
const jobs = JSON.parse(readFileSync('jobs.json','utf8')).filter(j=>!existsSync(j.out));
const WAVE = Math.min(Number(process.argv[2]||2), 2);   // teto de 2 abas: acima disso a conta toma rate limit
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const newTab=async()=>(await (await fetch('http://127.0.0.1:'+CDP_PORT+'/json/new?https://chatgpt.com/',{method:'PUT'})).json()).id;
const closeTab=async id=>{ try{ await fetch('http://127.0.0.1:'+CDP_PORT+'/json/close/'+id); }catch{} };
const run=(a)=>new Promise(res=>{ const p=spawn('node',a,{stdio:['ignore','pipe','pipe']}); let o='',e='';
  p.stdout.on('data',d=>o+=d); p.stderr.on('data',d=>e+=d); p.on('close',c=>res({code:c,out:o.trim(),err:e.trim().split('\n').pop()})); });
console.log('pendentes:', jobs.length);
for (let i=0;i<jobs.length;i+=WAVE){
  const wave = jobs.slice(i,i+WAVE);
  const live = [];
  for (const j of wave){                                  // SERIE: anexo exige foco
    const tab = await newTab(); await sleep(7000);
    const r = await run(['gpt-submit.mjs',tab,j.ref,j.prompt]);
    if (r.code===0) { live.push({tab,j}); console.log('  submit', j.out.split('/').pop()); }
    else { console.log('  submit FALHOU', j.out.split('/').pop(), r.err); await closeTab(tab); }
    await sleep(1500);
  }
  const res = await Promise.all(live.map(async ({tab,j})=>{ // PARALELO: so espera + download
    const r = await run(['gpt-collect.mjs',tab,j.out]);
    await closeTab(tab);
    console.log(r.code===0? '  '+r.out : '  colheita FALHOU '+j.out.split('/').pop()+' '+r.err);
    return r.code===0;
  }));
  console.log(`onda ${Math.floor(i/WAVE)+1}: ${res.filter(Boolean).length}/${wave.length}`);
}
console.log('--- fim');
