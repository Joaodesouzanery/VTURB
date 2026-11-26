#!/usr/bin/env node
// Porta de entrada da geracao de imagem: usa a API Gemini quando ha chave, cai no ChatGPT do navegador quando nao ha.
// uso: node gerar.mjs --out saida.png --prompt "..." [--ref base.png] [--model lite|flash|pro] [--forcar-chrome]
import { CDP_PORT } from './cdp.mjs';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { lerChave, gerar } from './gen-image-api.mjs';

const argv = process.argv;
const val = f => { const i = argv.indexOf(f); return i > -1 ? argv[i + 1] : null; };
const tem = f => argv.includes(f);
const out = val('--out'), prompt = val('--prompt'), ref = val('--ref');
const model = val('--model') || 'flash';

const USO = `
Gera uma imagem. Usa a API Gemini quando ha chave; sem chave, usa o ChatGPT do seu navegador.

  node gerar.mjs --out saida.png --prompt "descricao da cena"

  --out          arquivo de saida (obrigatorio)
  --prompt       o que gerar (obrigatorio)
  --ref          imagem de referencia para anexar (opcional)
  --ratio        1:1 | 9:16 | 16:9 ... (opcional)
  --size         1K | 2K | 4K (padrao 2K)
  --model        lite | flash | pro (padrao flash)
  --forcar-chrome  ignora a chave de API e vai pelo navegador
  --dry-run      mostra o que faria, sem abrir aba nem gastar credito
`.trim();

// Validar ANTES de tocar no navegador. Sem isto, uma flag errada abre aba,
// tenta anexar um arquivo chamado "null" seis vezes e enche o ChatGPT de erro.
if (tem('--help') || tem('-h') || argv.length <= 2) { console.log(USO); process.exit(0); }
const faltando = [];
if (!prompt) faltando.push('--prompt');
if (!out)    faltando.push('--out');
if (faltando.length) {
  console.error('faltou ' + faltando.join(' e ') + '. Nada foi aberto no navegador.\n');
  console.error(USO);
  process.exit(1);
}
if (ref && !existsSync(ref)) {
  console.error('--ref aponta para um arquivo que nao existe: ' + ref);
  process.exit(1);
}

if (!tem('--forcar-chrome') && lerChave()) {
  const r = await gerar({ prompt, refs: ref ? [ref] : [], out, model, size: val('--size') || '2K', ratio: val('--ratio'), dry: tem('--dry-run') });
  if (!r.dry) console.log('OK via API', r.out, Math.round(r.bytes / 1024) + 'KB', r.model);
  process.exit(0);
}

// Caminho padrao no pack do aluno: ChatGPT dirigido pelo proprio navegador dele.
// Teto de 2 abas: com 3 a conta cai em limite de uso por mais de uma hora.
console.error('usando o ChatGPT do seu navegador (sem custo alem da conta que voce ja tem)');
if (tem('--dry-run')) {   // dry-run nunca abre aba nem gasta credito
  console.log(JSON.stringify({ via: 'chrome-brain', aba: 'nova em chatgpt.com', ref, out, prompt }, null, 1));
  process.exit(0);
}
const novaAba = async () => (await (await fetch('http://127.0.0.1:'+CDP_PORT+'/json/new?https://chatgpt.com/', { method: 'PUT' })).json()).id;
const roda = a => new Promise(res => { const p = spawn('node', a, { cwd: import.meta.dirname, stdio: 'inherit' }); p.on('close', res); });
const tab = await novaAba();
await new Promise(r => setTimeout(r, 7000));
if (await roda(['gpt-submit.mjs', tab, ref || '', prompt])) process.exit(2);
const c = await roda(['gpt-collect.mjs', tab, out]);
await fetch('http://127.0.0.1:'+CDP_PORT+'/json/close/' + tab).catch(() => {});
process.exit(c);
