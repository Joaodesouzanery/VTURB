#!/usr/bin/env node
/**
 * Le um criativo de referencia e devolve JSON estruturado (headline, precos, tipo de oferta,
 * marca visivel, composicao). Existe para tirar a classificacao do olho humano: em 26/08/2026
 * classificar por miniatura gerou 4 retrabalhos (riscado errado, riscado perdido, peca sem preco,
 * marca de terceiro mantida).
 *
 * uso: node ler-referencia.mjs <imagem> [imagem2 ...]     -> imprime JSON array
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { lerChave } from './gen-image-api.mjs';

const MODELO = 'gemini-3.1-flash-lite';   // visao barata; leitura custa fracao de centavo
const MIME = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp' };

const SCHEMA = `{
  "headline": "texto principal exatamente como aparece, ou null",
  "subtexto": "linha de apoio, ou null",
  "preco_riscado": "valor riscado/compare-at como aparece (ex: €139), ou null",
  "preco_atual": "valor em destaque como aparece, ou null",
  "tipo_oferta": "unidade | bundle | sem_preco",
  "bundle_descricao": "ex: 2 pairs for X / buy 2 save X, ou null",
  "marca_visivel": ["toda marca, wordmark, escudo ou bandeira visivel, inclusive gravada no produto"],
  "itens": "quantos produtos aparecem e a cor de cada um",
  "idioma": "idioma do texto",
  "tipo_peca": "oferta_com_texto | lifestyle_sem_texto | packshot_catalogo"
}`;

export async function lerReferencia(arquivo) {
  const key = lerChave();
  if (!key) throw new Error('SEM_CHAVE');
  const ext = arquivo.split('.').pop().toLowerCase();
  const body = {
    contents: [{ role:'user', parts: [
      { text: `Analise este criativo de anuncio e responda SOMENTE com um JSON valido neste formato:\n${SCHEMA}\n` +
              `Leia os precos exatamente como estao escritos, sem converter. Se houver preco riscado e preco em ` +
              `destaque, preencha os dois campos separadamente. Liste toda marca visivel, inclusive pequena ou ` +
              `gravada no produto.` },
      { inlineData: { mimeType: MIME[ext] || 'image/png', data: readFileSync(arquivo).toString('base64') } },
    ]}],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  };
  let r, ultimo;
  for (let t = 0; t < 4; t++) {          // 503/429 sao picos de demanda: backoff resolve
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
      method:'POST', headers:{'content-type':'application/json','x-goog-api-key':key}, body: JSON.stringify(body),
    });
    if (r.ok) break;
    ultimo = `API_${r.status}: ${(await r.text()).slice(0,160)}`;
    if (![429, 500, 503].includes(r.status)) throw new Error(ultimo);
    await new Promise(res => setTimeout(res, 1500 * (t + 1)));
  }
  if (!r.ok) throw new Error(ultimo);
  const j = await r.json();
  const txt = j?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') || '';
  return { arquivo: arquivo.split('/').pop(), ...JSON.parse(txt) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fs = process.argv.slice(2);
  if (!fs.length) { console.error('uso: node ler-referencia.mjs <imagem> [...]'); process.exit(1); }
  const out = [];
  for (const f of fs) {
    try { out.push(await lerReferencia(f)); }
    catch(e) { out.push({ arquivo: f.split('/').pop(), erro: e.message.slice(0,120) }); }
  }
  console.log(JSON.stringify(out, null, 1));
}
