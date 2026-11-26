// lib.mjs — peças comuns da squad Voz e Lipsync: chaves, ffmpeg, Files da loja e as contas de tempo e custo.
// Sem dependência de npm: Node 22 já traz fetch, FormData e Blob.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const ENGINE = join(dirname(fileURLToPath(import.meta.url)), '..');   // pasta _engine
export const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE_BIN || 'ffprobe';
export const WIN = process.platform === 'win32';
// o sync.so já devolveu 403 a cliente sem User-Agent de navegador
export const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

export const CARACTERES_POR_SEGUNDO = 15.5;   // fala natural de anúncio
export const TOLERANCIA = 0.15;               // ajuste de ritmo que passa despercebido
export const PRECO_QUADRO = { 'lipsync-2': 0.0020, 'sync-3': 0.0053 };   // US$ por quadro, medido na conta de uso do sync.so
export const DOLAR = Number(process.env.DOLAR_REAL || 5.5);
// medido em 10/11/2026: o plano hobbyist (US$ 5) devolve o trecho com "sync.so" gravado no canto superior direito
export const PLANO_COM_MARCA = new Set(['hobbyist']);
// caixa da marca medida pela casa em 1080x1920 e 720x1280 (x 77% a 98%, y 1% a 4%), com folga: reserva para
// quando a medição por diferença falha num plano que grava a marca
export const caixaPadraoSync = (W, H) => ({ x: Math.round(W * 0.765), y: Math.max(1, Math.round(H * 0.006)), w: Math.round(W * 0.222), h: Math.round(H * 0.044) });

// plano da conta do sync.so (GET /v2/billing, não gasta nada); null quando não dá para saber
export async function planoSync() {
  const k = chave('SYNC_API_KEY');
  if (!k) return null;
  try {
    const r = await fetch('https://api.sync.so/v2/billing', { headers: { 'x-api-key': k, 'User-Agent': UA } });
    return r.ok ? (await r.json()).plan || null : null;
  } catch { return null; }
}

export const arg = (flag, padrao = null) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : padrao; };
export const tem = flag => process.argv.includes(flag);
// flag repetida: --trocar "A=B" --trocar "C=D"
export const todos = flag => process.argv.flatMap((a, i, l) => (a === flag && l[i + 1] ? [l[i + 1]] : []));
export function sair(msg, codigo = 1) { console.error(msg); process.exit(codigo); }

export function chave(nome) {
  if (process.env[nome]) return process.env[nome].trim();
  const env = join(ENGINE, '.env');
  if (!existsSync(env)) return null;
  for (const linha of readFileSync(env, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[1] === nome) return m[2].replace(/^["']|["']$/g, '') || null;
  }
  return null;
}

export function rodar(cmd, args, opcoes = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opcoes });
}

export function ff(args, opcoes = {}) {
  const r = rodar(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], opcoes);
  if (r.error || r.status !== 0) throw new Error(`ffmpeg falhou: ${r.error ? r.error.message : (r.stderr || '').slice(-500)}`);
}

export function temFfmpeg() {
  const r = rodar(FFMPEG, ['-version']);
  return !r.error && r.status === 0;
}

// o ffmpeg mínimo de alguns instaladores vem sem libass (filtro subtitles): conferir antes de prometer legenda
let filtros = null;
export function temFiltro(nome) {
  filtros ??= rodar(FFMPEG, ['-hide_banner', '-filters']).stdout || '';
  return new RegExp(`^\\s*\\S+\\s+${nome}\\s`, 'm').test(filtros);
}

// 3.5 -> "00:00:03,500" (SRT) ou "00:00:03.500" (VTT)
export const hms = (s, sep = ',') => new Date(Math.max(0, Math.round(s * 1000))).toISOString().slice(11, 23).replace('.', sep);

export function duracao(arquivo) {
  const r = rodar(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arquivo]);
  const d = parseFloat(r.stdout);
  if (!r.error && Number.isFinite(d)) return d;
  const r2 = rodar(FFMPEG, ['-hide_banner', '-i', arquivo]);   // sem ffprobe: o ffmpeg -i diz a Duration no stderr
  const m = (r2.stderr || '').match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + parseFloat(m[3]) : 0;
}

export function infoVideo(arquivo) {
  const r = rodar(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', arquivo]);
  if (!r.error && r.status === 0) {
    const s = (JSON.parse(r.stdout).streams || [])[0];
    if (s) {
      const [n, d] = s.r_frame_rate.split('/').map(Number);
      return { largura: s.width, altura: s.height, fps: d ? n / d : 30 };
    }
  }
  const r2 = rodar(FFMPEG, ['-hide_banner', '-i', arquivo]);
  const m = (r2.stderr || '').match(/Video: .*?(\d{2,5})x(\d{2,5}).*?(\d+(?:\.\d+)?) fps/);
  if (!m) throw new Error(`não consegui ler o vídeo: ${arquivo}`);
  return { largura: Number(m[1]), altura: Number(m[2]), fps: parseFloat(m[3]) };
}

// "0-4.8,33.1-41.1" -> [[0, 4.8], [33.1, 41.1]], em ordem, sem sobreposição, dentro do vídeo
export function lerTrechos(texto, total = Infinity) {
  const t = String(texto || '').split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);   // vírgula separa trechos, então decimal é com ponto
    if (!m) throw new Error(`trecho inválido: "${s}" (use início-fim em segundos com ponto, como 0-4.8)`);
    return [parseFloat(m[1]), parseFloat(m[2])];
  }).sort((a, b) => a[0] - b[0]);
  if (!t.length) throw new Error('nenhum trecho informado');
  t.forEach(([a, b], i) => {
    if (b - a < 0.5) throw new Error(`trecho ${a}-${b} curto demais (mínimo 0,5 s)`);
    if (b > total + 0.05) throw new Error(`trecho ${a}-${b} passa do fim do vídeo (${total.toFixed(2)} s)`);
    if (i && a < t[i - 1][1]) throw new Error(`os trechos ${t[i - 1].join('-')} e ${a}-${b} se sobrepõem`);
  });
  return t.map(([a, b]) => [a, Math.min(b, total)]);
}

// a linha do tempo inteira, alternando original e trecho com lipsync
export function pecas(trechos, total) {
  const out = []; let t = 0;
  trechos.forEach(([a, b], i) => {
    if (a - t > 0.01) out.push({ tipo: 'original', ini: t, fim: a });
    out.push({ tipo: 'lipsync', ini: a, fim: b, n: i });
    t = b;
  });
  if (total - t > 0.01) out.push({ tipo: 'original', ini: t, fim: total });
  return out;
}

export function custoLipsync(trechos, fps, modelo) {
  const quadros = Math.round(trechos.reduce((s, [a, b]) => s + (b - a), 0) * fps);
  const usd = quadros * (PRECO_QUADRO[modelo] ?? PRECO_QUADRO['sync-3']);
  return { quadros, usd, brl: usd * DOLAR };
}

// copy que cabe no vídeo: devolve o desvio do áudio gerado e, se passar da tolerância, quantos caracteres mirar
export function avaliarRitmo(durAudio, durVideo, caracteres) {
  const desvio = durVideo ? (durAudio - durVideo) / durVideo : 0;
  return { desvio, ok: Math.abs(desvio) <= TOLERANCIA, alvo: Math.round(caracteres / (1 + desvio)), ritmo: durVideo ? durAudio / durVideo : 1 };
}

// ── Marca d'água do sync.so ─────────────────────────────────────────────────────
// Quadros de diferença em cinza (um byte por pixel, quadro atrás de quadro) -> caixa do que muda na maioria
// deles. A marca é fixa; o ruído de compressão fica abaixo do limiar e pixel solto não forma linha nem coluna.
export function caixaDaDiferenca(buf, largura, altura, limiar = 24, fracao = 0.6) {
  const area = largura * altura, n = area ? Math.floor(buf.length / area) : 0;
  if (!n) return null;
  const minimo = Math.max(1, Math.ceil(n * fracao));
  const col = new Uint32Array(largura), lin = new Uint32Array(altura);
  for (let i = 0; i < area; i++) {
    let c = 0;
    for (let q = 0; q < n; q++) if (buf[q * area + i] > limiar) c++;
    if (c >= minimo) { col[i % largura]++; lin[(i / largura) | 0]++; }
  }
  const x0 = col.findIndex(v => v >= 2), y0 = lin.findIndex(v => v >= 2);
  if (x0 < 0 || y0 < 0) return null;
  const x1 = col.findLastIndex(v => v >= 2), y1 = lin.findLastIndex(v => v >= 2);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// O trecho que volta do sync.so só difere do enviado na boca e na marca d'água (medido em 23/09 e 01/10/2026).
// A diferença no canto superior direito dá a caixa exata da marca, sem chutar coordenada; null = sem marca.
// A caixa sai no quadro final (W x H), já normalizado como na remontagem.
export function caixaMarca(enviado, retorno, W, H) {
  const cx = Math.round(W / 2), ch = Math.round(H * 0.12), cw = W - cx;
  const prep = `fps=2,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,format=gray,crop=${cw}:${ch}:${cx}:0`;
  const r = rodar(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', enviado, '-i', retorno, '-filter_complex',
    `[0:v]${prep}[a];[1:v]${prep}[b];[a][b]blend=all_mode=difference`, '-frames:v', '12', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { encoding: 'buffer' });
  if (r.error || r.status !== 0 || !r.stdout?.length) return null;
  const c = caixaDaDiferenca(r.stdout, cw, ch);
  if (!c) return null;
  const m = 6;   // folga para o contorno da letra; o delogo precisa de pixel fora da caixa para interpolar
  const x = Math.max(cx + c.x - m, 1), y = Math.max(c.y - m, 1);
  const caixa = { x, y, w: Math.min(cx + c.x + c.w + m, W - 2) - x, h: Math.min(c.y + c.h + m, H - 2) - y };
  return caixa.w * caixa.h > W * H * 0.03 ? null : caixa;   // grande demais para ser a marca: mudou outra coisa no canto
}

// ── Legenda da voz nova ─────────────────────────────────────────────────────────
// SRT a partir do tempo de cada letra que a ElevenLabs devolve em /with-timestamps. escala = 1/ritmo quando
// a voz foi acelerada ou freada para caber no vídeo. Bloco curto (legenda sutil) que fecha em pontuação ou pausa:
// fechar só no limite de letras deixava palavra sozinha na tela por um quarto de segundo ("does / not.").
export function srtDeAlinhamento(al, escala = 1, maxLetras = 28) {
  const letras = al?.characters || [], ini = al?.character_start_times_seconds || [], fim = al?.character_end_times_seconds || [];
  const palavras = [];
  let atual = null;
  letras.forEach((c, i) => {
    if (/\s/.test(c)) { atual = null; return; }
    if (!atual) palavras.push(atual = { t: '', a: ini[i], b: fim[i] });
    atual.t += c; atual.b = fim[i];
  });
  const blocos = [];
  for (const p of palavras) {
    const b = blocos.at(-1);
    // a palavra que fecha a frase pode passar do limite em até 8 letras, para não ficar sozinha no bloco seguinte
    const cabe = b && b.t.length + 1 + p.t.length <= maxLetras + (/[.!?;:,]$/.test(p.t) ? 8 : 0);
    if (cabe && !/[.!?;:,]$/.test(b.t) && p.a - b.b < 0.6) { b.t += ` ${p.t}`; b.b = p.b; }
    else blocos.push({ ...p });
  }
  return blocos.map((b, i) => `${i + 1}\n${hms(b.a * escala)} --> ${hms(b.b * escala)}\n${b.t}\n`).join('\n');
}

// ── Trocar o nome falado na dublagem ────────────────────────────────────────────
// "MarcaAntiga=SuaMarca" -> ['MarcaAntiga', 'SuaMarca']
export function lerTrocas(lista) {
  return lista.map(s => {
    const i = s.indexOf('='), de = s.slice(0, i).trim(), por = s.slice(i + 1).trim();
    if (i < 1 || !de || !por) throw new Error(`troca inválida: "${s}" (use --trocar "NomeAntigo=NomeNovo")`);
    return [de, por];
  });
}

// palavra inteira, sem olhar maiúscula: "OldBrand's" troca, "OldBrands" não; nome de duas palavras aceita espaço a mais
const palavra = nome => new RegExp(`(?<![\\p{L}\\p{N}])${nome.normalize('NFC').trim().split(/\s+/)
  .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')}(?![\\p{L}\\p{N}])`, 'giu');
// Quando o texto novo contém o antigo ("Acme" -> "Acme Paris"), o que já foi trocado fica guardado durante a troca:
// rodar de novo não vira "Acme Paris Paris". Guardar sempre impedia o caso contrário ("absolutely gorgeous" ->
// "gorgeous", 11/11/2026). Acento composto ou decomposto conta igual (NFC). Sem troca, devolve o texto como veio.
export function trocarNomes(texto, trocas) {
  return trocas.reduce((t, [de, por]) => {
    const guardados = [], n = t.normalize('NFC');
    const marcado = palavra(de).test(por.normalize('NFC')) ? n.replace(palavra(por), m => `\u0000${guardados.push(m) - 1}\u0000`) : n;
    const trocado = marcado.replace(palavra(de), () => por);
    return trocado === marcado ? t : trocado.replace(/\u0000(\d+)\u0000/g, (_, i) => guardados[Number(i)]);
  }, texto);
}

// ── Files da loja: o sync.so só aceita vídeo e áudio por link público ────────────────
function primeiroJSON(texto) {
  const i = texto.indexOf('{');
  if (i < 0) return null;
  let nivel = 0, aspas = false, esc = false;
  for (let j = i; j < texto.length; j++) {
    const c = texto[j];
    if (aspas) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') aspas = false; continue; }
    if (c === '"') aspas = true;
    else if (c === '{') nivel++;
    else if (c === '}' && --nivel === 0) { try { return JSON.parse(texto.slice(i, j + 1)); } catch { return null; } }
  }
  return null;
}

// consulta e variáveis vão por arquivo: nada de aspas na linha de comando, o que quebra no Windows
export function shopify(loja, consulta, variaveis = {}, mutacao = false) {
  const d = mkdtempSync(join(tmpdir(), 'voz-lipsync-'));
  try {
    const q = join(d, 'q.graphql'), v = join(d, 'v.json'), o = join(d, 'o.json');
    writeFileSync(q, consulta); writeFileSync(v, JSON.stringify(variaveis));
    const args = ['store', 'execute', '--store', loja, '--query-file', q, '--variable-file', v, '--output-file', o, '--json', '--no-input'];
    if (mutacao) args.push('--allow-mutations');
    const r = WIN ? rodar(['shopify', ...args.map(a => (/\s/.test(a) ? `"${a}"` : a))].join(' '), [], { shell: true }) : rodar('shopify', args);
    if (r.error) throw new Error(`não achei o Shopify CLI (${r.error.message})`);
    const bruto = existsSync(o) ? readFileSync(o, 'utf8') : (r.stdout || '');
    const j = primeiroJSON(bruto);
    if (!j) throw new Error(`o Shopify CLI não devolveu JSON: ${(r.stderr || bruto).slice(-400)}`);
    return j.data || j;
  } finally { rmSync(d, { recursive: true, force: true }); }
}

export async function subirArquivo(loja, caminho, mime) {
  const nome = caminho.split(/[\\/]/).pop();
  const a = shopify(loja, `mutation($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } } }`,
    { input: [{ filename: nome, mimeType: mime, resource: 'FILE', httpMethod: 'POST' }] }, true);
  const sc = a.stagedUploadsCreate;
  if (!sc || sc.userErrors?.length || !sc.stagedTargets?.length) throw new Error(`stagedUploadsCreate: ${JSON.stringify(sc?.userErrors || a).slice(0, 300)}`);
  const alvo = sc.stagedTargets[0];
  const form = new FormData();
  for (const p of alvo.parameters) form.append(p.name, p.value);
  form.append('file', new Blob([readFileSync(caminho)], { type: mime }), nome);
  const r = await fetch(alvo.url, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`envio de ${nome} para os Files falhou: HTTP ${r.status}`);
  const b = shopify(loja, `mutation($files: [FileCreateInput!]!) { fileCreate(files: $files) { files { id fileStatus } userErrors { field message } } }`,
    { files: [{ originalSource: alvo.resourceUrl, contentType: 'FILE' }] }, true);
  const fc = b.fileCreate;
  if (!fc || fc.userErrors?.length || !fc.files?.length) throw new Error(`fileCreate: ${JSON.stringify(fc?.userErrors || b).slice(0, 300)}`);
  const id = fc.files[0].id;
  for (let i = 0; i < 40; i++) {
    const c = shopify(loja, `query($id: ID!) { node(id: $id) { ... on GenericFile { fileStatus url } } }`, { id });
    const n = c.node || {};
    if (n.fileStatus === 'READY' && n.url) return { id, url: n.url };
    if (n.fileStatus === 'FAILED') throw new Error(`a Shopify recusou ${nome}`);
    await new Promise(res => setTimeout(res, 3000));
  }
  throw new Error(`${nome} não ficou pronto nos Files em 2 minutos`);
}

export function apagarArquivos(loja, ids) {
  if (!ids.length) return;
  const r = shopify(loja, `mutation($ids: [ID!]!) { fileDelete(fileIds: $ids) { deletedFileIds userErrors { message } } }`, { ids }, true);
  const n = r.fileDelete?.deletedFileIds?.length || 0;
  console.log(`  Files da loja: ${n} arquivo(s) temporário(s) apagado(s)`);
}

export function teste() {
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
  eq(lerTrechos('33.1-41.1, 0-4.8', 50), [[0, 4.8], [33.1, 41.1]], 'ordem dos trechos');
  for (const ruim of ['3-2', '1-1.2', '0-60', '0-5,4-8']) { let ok = false; try { lerTrechos(ruim, 50); } catch { ok = true; } if (!ok) throw new Error(`aceitou trecho ruim: ${ruim}`); }
  eq(pecas([[1, 2], [4, 5]], 6).map(p => p.tipo), ['original', 'lipsync', 'original', 'lipsync', 'original'], 'linha do tempo');
  eq(pecas([[0, 3]], 3).map(p => p.tipo), ['lipsync'], 'trecho do vídeo inteiro');
  eq(custoLipsync([[0, 10]], 30, 'lipsync-2').quadros, 300, 'quadros');
  const r = avaliarRitmo(24, 20, 300); eq([r.ok, r.alvo], [false, 250], 'copy longa demais');   // 20% acima do vídeo
  eq(avaliarRitmo(21, 20, 300).ok, true, 'dentro da tolerância');
  eq(primeiroJSON('aviso {"a":{"b":"}"}} fim'), { a: { b: '}' } }, 'JSON no meio do texto');
  // marca d'água: bloco fixo nos 3 quadros, pixel solto fixo em (1,9) e pixel que pisca num quadro só
  const w = 20, h = 10, q = Buffer.alloc(w * h * 3);
  for (let f = 0; f < 3; f++) {
    for (let y = 2; y <= 4; y++) for (let x = 12; x <= 16; x++) q[f * w * h + y * w + x] = 200;
    q[f * w * h + 9 * w + 1] = 255;
  }
  q[5 * w + 5] = 255;
  eq(caixaDaDiferenca(q, w, h), { x: 12, y: 2, w: 5, h: 3 }, "caixa da marca d'água");
  eq(caixaDaDiferenca(Buffer.alloc(w * h * 3), w, h), null, "sem marca d'água");
  // legenda da voz nova, no tempo de cada letra
  const fala = 'Oi mundo. Tudo bem';
  const al = { characters: [...fala], character_start_times_seconds: [...fala].map((_, i) => i / 10), character_end_times_seconds: [...fala].map((_, i) => (i + 1) / 10) };
  eq(srtDeAlinhamento(al), '1\n00:00:00,000 --> 00:00:00,900\nOi mundo.\n\n2\n00:00:01,000 --> 00:00:01,800\nTudo bem\n', 'legenda da voz nova');
  eq(srtDeAlinhamento(al, 0.5).split('\n')[1], '00:00:00,000 --> 00:00:00,450', 'legenda com o ritmo ajustado');
  // troca do nome falado na dublagem
  eq(trocarNomes("My OldBrand, oldbrand's best. OldBrands stays.", lerTrocas(['OldBrand=NewBrand'])), "My NewBrand, NewBrand's best. OldBrands stays.", 'troca do nome');
  eq(trocarNomes('the old  brand bag', lerTrocas(['Old Brand=NewBrand'])), 'the NewBrand bag', 'nome de duas palavras');
  eq(trocarNomes('I love Acme Paris', lerTrocas(['Acme=Acme Paris'])), 'I love Acme Paris', 'troca repetida não duplica o nome novo');
  eq(trocarNomes('Acme and Acme Paris', lerTrocas(['Acme=Acme Paris'])), 'Acme Paris and Acme Paris', 'troca ao lado do nome novo');
  eq(trocarNomes('It is absolutely  gorgeous.', lerTrocas(['absolutely gorgeous=gorgeous'])), 'It is gorgeous.', 'texto novo dentro do antigo (tirar enfeite)');
  eq(trocarNomes('José bag', lerTrocas(['José=Novo'])), 'Novo bag', 'acento decomposto');
  const intacto = 'café sem marca'; eq(trocarNomes(intacto, lerTrocas(['X=Y'])) === intacto, true, 'sem troca, texto intacto');
  for (const ruim of ['=NewBrand', 'OldBrand=', 'OldBrand']) { let ok = false; try { lerTrocas([ruim]); } catch { ok = true; } if (!ok) throw new Error(`aceitou troca ruim: ${ruim}`); }
  console.log('autoteste ok');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && tem('--teste')) teste();
