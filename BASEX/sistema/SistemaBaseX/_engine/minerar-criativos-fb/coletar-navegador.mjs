#!/usr/bin/env node
// Coleta anuncios da Biblioteca de Anuncios da Meta pelo NAVEGADOR, de graca.
//
// Por que existe: os outros scripts desta pasta passam pelo Apify, que e servico
// pago. Este aqui le a mesma biblioteca publica com o Chrome que voce ja tem, sem
// token, sem conta e sem custo.
//
// Uso:
//   node coletar-navegador.mjs --pagina 123456789
//   node coletar-navegador.mjs --pagina 123456789 --pais DE --saida ./minha-pasta
//   node coletar-navegador.mjs --pagina 123456789 --so-contar
//
// Cuidado deliberado: ele espera entre paginas e limita quantos anuncios baixa por
// rodada. Ler a biblioteca publica devagar e o comportamento de quem estuda; varrer
// centenas de paginas em minutos e o que faz a Meta bloquear.

import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { abrirChrome } from '../_shared/chrome.mjs';

const CAMINHOS_CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const TETO_POR_RODADA = 40;   // anuncios baixados por execucao
const ESPERA_ENTRE_ROLAGENS = 1400;

function lerArgs(argv) {
  const livres = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { livres.push(a); continue; }
    const ig = a.indexOf('=');
    if (ig > -1) { flags[a.slice(2, ig)] = a.slice(ig + 1); continue; }
    const k = a.slice(2), prox = argv[i + 1];
    if (prox !== undefined && !prox.startsWith('--')) { flags[k] = prox; i++; } else flags[k] = true;
  }
  return { livres, flags };
}

function acharChrome(indicado) {
  if (indicado) {
    if (!existsSync(indicado)) throw new Error(`--chrome aponta pra arquivo que nao existe: ${indicado}`);
    return indicado;
  }
  const achado = CAMINHOS_CHROME.find((p) => existsSync(p));
  if (achado) return achado;
  throw new Error('nao achei o Google Chrome. Instale em google.com/chrome ou use --chrome "/caminho".');
}

// O total confiavel e o "~N resultados" que a propria pagina escreve. Contar os
// cartoes renderizados subconta feio: uma pagina com 300 anuncios mostra 3 de cara.
const LER_TOTAL = `(() => {
  const t = document.body.innerText || '';
  const m = t.match(/~?\\s*([\\d.,]+)\\s*(resultados|results|r[ée]sultats|Ergebnisse|risultati)/i);
  if (!m) return null;
  return parseInt(m[1].replace(/[.,]/g, ''), 10);
})()`;

// TreeWalker em vez de varrer div: a biblioteca aninha dezenas de nivel e o seletor
// por classe quebra a cada deploy da Meta. O texto e a imagem sao estaveis.
const LER_ANUNCIOS = `(() => {
  const vistos = new Set();
  const saida = [];
  const imgs = Array.from(document.querySelectorAll('img'));
  for (const img of imgs) {
    const src = img.currentSrc || img.src || '';
    if (!/^https?:/.test(src)) continue;
    if (img.naturalWidth < 200 || img.naturalHeight < 200) continue;
    if (vistos.has(src)) continue;
    vistos.add(src);
    let cartao = img;
    for (let i = 0; i < 12 && cartao.parentElement; i++) {
      cartao = cartao.parentElement;
      if (cartao.innerText && cartao.innerText.length > 60) break;
    }
    const texto = (cartao.innerText || '').split('\\n').map(s => s.trim()).filter(Boolean);
    const idLinha = texto.find(l => /identifica|library id|ID da biblioteca/i.test(l)) || '';
    saida.push({
      imagem: src,
      largura: img.naturalWidth,
      altura: img.naturalHeight,
      id: (idLinha.match(/(\\d{8,})/) || [])[1] || null,
      texto: texto.slice(0, 14),
    });
  }
  return saida;
})()`;

async function baixar(url, destino) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const bin = Buffer.from(await r.arrayBuffer());
  await writeFile(destino, bin);
  return createHash('sha1').update(bin).digest('hex');
}

async function main() {
  const { flags } = lerArgs(process.argv.slice(2));

  if (flags.help || !flags.pagina) {
    console.log(`
Coleta anuncios da Biblioteca de Anuncios da Meta pelo navegador, sem custo.

  --pagina <id>     id da pagina do anunciante (obrigatorio)
  --pais <XX>       pais da biblioteca (padrao ALL)
  --saida <pasta>   onde gravar (padrao ./saidas/<id>)
  --teto <n>        maximo de anuncios baixados (padrao ${TETO_POR_RODADA})
  --so-contar       so le quantos anuncios estao no ar e sai
  --chrome <path>   caminho do Chrome, se nao for achado sozinho

Como achar o id da pagina: abra a Biblioteca de Anuncios, procure o anunciante e
olhe o endereco. O numero depois de view_all_page_id= e o id.
`.trim());
    return;
  }

  const pagina = String(flags.pagina).replace(/\D/g, '');
  if (!pagina) throw new Error('--pagina precisa ser o numero do id da pagina.');
  const pais = (flags.pais || 'ALL').toUpperCase();
  const teto = flags.teto ? parseInt(flags.teto, 10) : TETO_POR_RODADA;
  const saida = resolve(flags.saida || join(process.cwd(), 'saidas', pagina));

  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all`
            + `&country=${encodeURIComponent(pais)}&view_all_page_id=${pagina}&sort_data[direction]=desc`
            + `&sort_data[mode]=relevancy_monthly_grouped&media_type=all`;

  const chrome = acharChrome(flags.chrome);
  console.log('  abrindo o navegador...');
  const nav = await abrirChrome(chrome);

  try {
    // Uma foto so serve para navegar ate a pagina e deixar ela carregada.
    const tmp = join(saida, '_carregando.png');
    await mkdir(saida, { recursive: true });
    await nav.foto(`<meta http-equiv="refresh" content="0;url=${url}">`, tmp, 1400, 1000, { esperaMs: 6000 });

    const total = await nav.avaliar(LER_TOTAL);
    if (total === null) {
      console.log('  a pagina nao mostrou o total de resultados.');
      console.log('  Isso costuma ser um destes tres: id da pagina errado, anunciante sem');
      console.log('  anuncio ativo naquele pais, ou a Meta pedindo aceite de cookie.');
    } else {
      console.log(`  anuncios no ar: ${total.toLocaleString('pt-BR')}`);
    }

    if (flags['so-contar']) {
      await writeFile(join(saida, 'contagem.json'),
        JSON.stringify({ pagina, pais, total, lido_em: new Date().toISOString() }, null, 2));
      console.log(`  gravado em ${join(saida, 'contagem.json')}`);
      return;
    }

    // Rola devagar ate juntar o teto de anuncios ou a pagina parar de crescer.
    const juntos = new Map();
    let paradas = 0;
    for (let volta = 0; volta < 14 && juntos.size < teto && paradas < 3; volta++) {
      const lote = await nav.avaliar(LER_ANUNCIOS) || [];
      const antes = juntos.size;
      for (const a of lote) if (!juntos.has(a.imagem)) juntos.set(a.imagem, a);
      if (juntos.size === antes) paradas++; else paradas = 0;
      console.log(`  rolagem ${volta + 1}: ${juntos.size} anuncios`);
      await nav.avaliar(`(async()=>{ window.scrollBy(0, window.innerHeight*2);
        await new Promise(r=>setTimeout(r,${ESPERA_ENTRE_ROLAGENS})); return 1; })()`);
    }

    const lista = Array.from(juntos.values()).slice(0, teto);
    if (!lista.length) {
      console.log('  nenhum anuncio com imagem foi encontrado nesta pagina.');
      return;
    }

    // A mesma peca aparece na biblioteca sob varias URLs. Deduplicar pela URL nao
    // resolve: sao enderecos diferentes servindo o mesmo arquivo. So o conteudo diz.
    await mkdir(join(saida, 'imagens'), { recursive: true });
    const porConteudo = new Map();
    let baixadas = 0, repetidas = 0;
    for (const a of lista) {
      const provisorio = join(saida, 'imagens', `.tmp-${baixadas + repetidas}.jpg`);
      try {
        const hash = await baixar(a.imagem, provisorio);
        if (porConteudo.has(hash)) {
          await unlink(provisorio);
          a.arquivo = porConteudo.get(hash);
          a.repetida = true;
          repetidas++;
          continue;
        }
        baixadas++;
        const nome = `anuncio-${String(baixadas).padStart(3, '0')}.jpg`;
        const { rename } = await import('node:fs/promises');
        await rename(provisorio, join(saida, 'imagens', nome));
        porConteudo.set(hash, `imagens/${nome}`);
        a.arquivo = `imagens/${nome}`;
      } catch (e) {
        a.arquivo = null;
        a.erro = e.message;
      }
    }

    await writeFile(join(saida, 'anuncios.json'), JSON.stringify({
      pagina, pais, total_no_ar: total, baixados: baixadas, repetidas,
      lido_em: new Date().toISOString(), anuncios: lista,
    }, null, 2));

    console.log(`\n  ${baixadas} pecas distintas em ${join(saida, 'imagens')}`);
    if (repetidas) console.log(`  ${repetidas} eram a mesma arte em endereco diferente, e nao viraram arquivo novo`);
    console.log(`  ficha em ${join(saida, 'anuncios.json')}`);
    if (total && total > lista.length) {
      console.log(`\n  Esta pagina tem ${total.toLocaleString('pt-BR')} anuncios no ar e voce baixou ${lista.length}.`);
      console.log(`  Para pegar mais, rode de novo com --teto maior. Devagar, sem varrer tudo de uma vez.`);
    }
  } finally {
    await nav.fechar();
  }
}

main().catch((e) => {
  console.error(`[erro] ${e.message}`);
  process.exitCode = 1;
});
