#!/usr/bin/env node
// Gera/edita imagem pela API Gemini (Nano Banana). Caminho preferencial quando ha chave.
// uso: node gen-image-api.mjs --out saida.png --prompt "..." [--ref base.png] [--ref logo.png]
//                             [--model gemini-3.1-flash-image] [--size 1K|2K|4K] [--ratio 1:1] [--dry-run]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const MODELOS = {
  lite:  'gemini-3.1-flash-lite-image',   // mais barato, texto fraco
  flash: 'gemini-3.1-flash-image',        // padrao: foto lifestyle, 4K
  pro:   'gemini-3-pro-image',            // arte com texto/preco na peca
};

function args(argv) {
  const o = { refs: [], model: MODELOS.flash, size: '2K', ratio: null, dry: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === '--ref') { o.refs.push(v); i++; }
    else if (a === '--out') { o.out = v; i++; }
    else if (a === '--prompt') { o.prompt = v; i++; }
    else if (a === '--model') { o.model = MODELOS[v] || v; i++; }
    else if (a === '--size') { o.size = v; i++; }
    else if (a === '--ratio') { o.ratio = v; i++; }
    else if (a === '--dry-run') o.dry = true;
  }
  return o;
}

/* A chave e opcional: sem ela o fluxo cai no navegador (ver gerar.mjs).
   Ordem de busca: variavel de ambiente GEMINI_API_KEY, depois o arquivo apontado por
   GEMINI_ENV_FILE (se voce guarda seu .env em outro lugar), depois ~/.env */
export function lerChave() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const extra = process.env.GEMINI_ENV_FILE ? [process.env.GEMINI_ENV_FILE] : [];
  for (const f of [...extra, `${homedir()}/.env`]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/^\s*GEMINI_API_KEY\s*=\s*["']?([^"'\s]+)/m);
    if (m) return m[1];
  }
  return null;
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

export async function gerar({ prompt, refs = [], out, model = MODELOS.flash, size = '2K', ratio = null, dry = false }) {
  const key = lerChave();
  if (!key) throw new Error('SEM_CHAVE');
  model = MODELOS[model] || model;              // aceita apelido (lite|flash|pro) ou id completo                 // quem chama cai no plano B (ChatGPT do navegador)
  const input = [{ type: 'text', text: prompt }];
  for (const r of refs) {
    const ext = r.split('.').pop().toLowerCase();
    input.push({ type: 'image', mime_type: MIME[ext] || 'image/png', data: readFileSync(r).toString('base64') });
  }
  // a API aceita apenas image/jpeg no response_format (testado 26/08/2026)
  const body = { model, input, response_format: { type: 'image', mime_type: 'image/jpeg', image_size: size } };
  if (ratio) body.response_format.aspect_ratio = ratio;

  if (dry) {   // dry-run obrigatorio antes de queimar credito (padrao de skill executavel)
    const preview = { ...body, input: input.map(i => i.type === 'image' ? { ...i, data: `<${i.data.length} chars base64>` } : i) };
    console.log(JSON.stringify(preview, null, 1));
    return { dry: true };
  }

  let r, ultimo;
  for (let tentativa = 0; tentativa < 4; tentativa++) {   // 429/500/503 sao picos de demanda
    r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
    if (r.ok) break;
    ultimo = `API_${r.status}: ${(await r.text()).slice(0, 300)}`;
    if (![429, 500, 503].includes(r.status)) throw new Error(ultimo);
    await new Promise(res => setTimeout(res, 2000 * (tentativa + 1)));
  }
  if (!r.ok) throw new Error(ultimo);
  const j = await r.json();
  // a imagem volta no ultimo step (type model_output), em content[].data
  let b64 = j?.output_image?.data || j?.interaction?.output_image?.data;
  if (!b64) {
    for (const st of (j.steps || [])) {
      for (const c of (st.content || [])) {
        if (c?.data && /image/.test(c.mime_type || '')) { b64 = c.data; break; }
      }
      if (b64) break;
    }
  }
  if (!b64) throw new Error('SEM_IMAGEM_NA_RESPOSTA: ' + JSON.stringify(j).slice(0, 300));
  const buf = Buffer.from(b64, 'base64');
  if (out) { out = out.replace(/\.png$/i, '.jpg'); writeFileSync(out, buf); }   // volta sempre jpeg
  return { out, bytes: buf.length, model };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const o = args(process.argv);
  if (!o.prompt) { console.error('faltou --prompt'); process.exit(1); }
  try {
    const r = await gerar(o);
    if (!r.dry) console.log('OK', r.out, Math.round(r.bytes / 1024) + 'KB', r.model);
  } catch (e) {
    console.error(e.message);
    process.exit(e.message === 'SEM_CHAVE' ? 10 : 1);   // 10 = sinaliza fallback pro ChatGPT do navegador
  }
}
