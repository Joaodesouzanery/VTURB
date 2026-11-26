#!/usr/bin/env node
/**
 * preflight.mjs — confere se a squad Voz e Lipsync roda nesta máquina. Não gasta crédito nenhum.
 *
 *   node _engine/voz-lipsync/preflight.mjs [--loja <sua-loja>.myshopify.com]
 *
 * Obrigatório: Node 22+ e ffmpeg. As chaves e o Shopify CLI só valem para a parte que usa cada um:
 * voz precisa da chave da ElevenLabs; lipsync precisa da chave do sync.so e do CLI com acesso aos Files.
 * Sai com 0 quando pelo menos a base está pronta, 1 quando falta Node ou ffmpeg.
 */
import { rodar, temFfmpeg, temFiltro, chave, shopify, arg, teste, WIN, planoSync, PLANO_COM_MARCA } from './lib.mjs';

const itens = [];
const add = (nome, ok, dica, obrigatorio = false) => itens.push({ nome, ok, dica, obrigatorio });

const versao = Number(process.versions.node.split('.')[0]);
add('Node 22 ou mais novo', versao >= 22, `está na ${process.versions.node}; rode o instalador do SistemaBaseX`, true);
const ffOk = temFfmpeg();
add('ffmpeg', ffOk, 'rode: node _engine/briefing-criativos/setup.mjs', true);
// a legenda nova precisa do libass; apagar a legenda antiga e a marca do sync.so, do delogo
const legendaOk = ffOk && ['subtitles', 'delogo'].every(temFiltro);
if (ffOk) add('ffmpeg com legenda e borrão (libass e delogo)', legendaOk, 'para escrever a legenda nova no vídeo: no Mac, brew install ffmpeg-full; no Windows, winget install Gyan.FFmpeg. Sem isso, a legenda nova entra no CapCut');
const el = !!chave('ELEVENLABS_API_KEY'), sy = !!chave('SYNC_API_KEY');
add('Chave da ElevenLabs', el, 'cole em _engine/.env a linha ELEVENLABS_API_KEY=sua_chave (ElevenLabs, Developers, API Keys)');
add('Chave do sync.so', sy, 'cole em _engine/.env a linha SYNC_API_KEY=sua_chave (sync.so, Settings, API Keys)');
const plano = sy ? await planoSync() : null;
if (plano) add(`Plano do sync.so: ${plano}${PLANO_COM_MARCA.has(plano) ? ` (grava a marca "sync.so" no canto; o lipsync mede e apaga sozinho)` : ''}`, true, '');
const cli = WIN ? rodar('shopify version', [], { shell: true }) : rodar('shopify', ['version']);
const temCli = !cli.error && cli.status === 0;
add('Shopify CLI', temCli, 'o lipsync sobe os trechos para os Files da sua loja pelo CLI; rode o instalador do SistemaBaseX');
const loja = arg('--loja');
let acesso = !loja;
if (loja && temCli) {
  try { acesso = !!shopify(loja, 'query { shop { name } }').shop?.name; } catch { acesso = false; }
  add(`Acesso do CLI aos Files de ${loja}`, acesso, `rode: shopify store auth --store ${loja} --scopes read_files,write_files`);
}

let contas = true;
try { teste(); } catch (e) { contas = false; console.log(e.message); }
add('Contas internas do motor (tempo, trechos e custo)', contas, 'o motor está corrompido: baixe o SistemaBaseX de novo', true);

for (const i of itens) console.log(`${i.ok ? '[ok]  ' : i.obrigatorio ? '[FALTA]' : '[falta]'} ${i.nome}${i.ok ? '' : `\n        ${i.dica}`}`);
const base = itens.filter(i => i.obrigatorio).every(i => i.ok);
console.log(`\nVoz nova e clone: ${base && el ? 'pronto' : 'não'} · Lipsync: ${base && sy && temCli && acesso ? 'pronto' : loja ? 'não' : 'confira com --loja <sua-loja>.myshopify.com'} · Legenda nova no vídeo: ${base && legendaOk ? 'pronto' : 'só no CapCut'}`);
process.exit(base ? 0 : 1);
