#!/usr/bin/env node
// Marca vetorial — gera logo, monograma, simbolo e favicon sem IA e sem custo.
//
// Logo de loja e tipografia mais geometria. Isso o navegador desenha melhor que
// modelo de imagem: sai nitido, com a fonte exata, fundo transparente de verdade
// e do mesmo jeito toda vez que roda. Modelo de imagem erra letra, inventa serifa
// e nao repete o resultado.
//
// A IA entra so na etapa de ideia de simbolo, e de graca: o comando `prompt`
// escreve o texto pronto pra colar no ChatGPT ou no Gemini gratuito. O arquivo
// final continua saindo daqui.
//
// Uso:
//   node gerar.mjs conceitos --marca "Aurelle"
//   node gerar.mjs tudo --marca "Aurelle" --fonte "Cormorant Garamond" --cor "#1B2A41"
//   node gerar.mjs prompt --marca "Aurelle" --nicho "joias"

import { mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { abrirChrome } from '../_shared/chrome.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- argumentos

function lerArgs(argv) {
  const livres = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { livres.push(a); continue; }
    const igual = a.indexOf('=');
    if (igual > -1) { flags[a.slice(2, igual)] = a.slice(igual + 1); continue; }
    const chave = a.slice(2);
    const prox = argv[i + 1];
    if (prox !== undefined && !prox.startsWith('--')) { flags[chave] = prox; i++; }
    else flags[chave] = true;
  }
  return { livres, flags };
}

// -------------------------------------------------------------------- chrome

const CAMINHOS_CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function acharChrome(indicado) {
  if (indicado) {
    if (!existsSync(indicado)) throw new Error(`--chrome aponta pra um arquivo que nao existe: ${indicado}`);
    return indicado;
  }
  const achado = CAMINHOS_CHROME.find((p) => existsSync(p));
  if (achado) return achado;
  throw new Error(
    'nao achei o Google Chrome nesta maquina.\n' +
    '  Instale em https://google.com/chrome ou aponte com --chrome "/caminho/do/chrome".'
  );
}

// A fonte vira data URI antes de renderizar. Sem isso cada imagem esperava a
// rede do Google Fonts e o render levava 21 segundos; com a fonte embutida sao
// menos de 2, e funciona offline depois da primeira vez.
const CACHE_FONTES = join(AQUI, '.cache', 'fontes');
const UA_NAVEGADOR = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const fontesNaMemoria = new Map();

// Pede so o peso que vai ser usado. Baixar 300 a 700 de uma vez trazia 895 KB
// so da Inter, e cinco desses pesos nunca eram desenhados.
async function prepararFonte(fonte, peso = 400) {
  const chave = `${fonte}@${peso}`;
  if (fontesNaMemoria.has(chave)) return fontesNaMemoria.get(chave);
  const arquivo = join(CACHE_FONTES, `${fonte.replace(/[^A-Za-z0-9]+/g, '-')}-${peso}.css`);
  try {
    const css = await readFile(arquivo, 'utf8');
    fontesNaMemoria.set(chave, css);
    return css;
  } catch { /* ainda nao baixada */ }

  const familia = fonte.replace(/ /g, '+');
  const url = `https://fonts.googleapis.com/css2?family=${familia}:wght@${peso}&display=block`;
  let css;
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA_NAVEGADOR } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    css = await r.text();
  } catch (e) {
    throw new Error(
      `nao consegui baixar a fonte "${fonte}" no peso ${peso} do Google Fonts (${e.message}).\n` +
      `  Confira em https://fonts.google.com se o nome esta exato e se a fonte tem esse peso.\n` +
      `  Nem toda fonte oferece todos os pesos: Playfair Display, por exemplo, comeca no 400.`
    );
  }

  // So os recortes latinos. Cirilico, grego e vietnamita nao entram em nome de
  // marca e triplicariam o tamanho do arquivo embutido.
  const blocos = css.split('@font-face').slice(1)
    .map((b) => '@font-face' + b.slice(0, b.indexOf('}') + 1))
    .filter((b) => /U\+0000-00FF|U\+0100-02BA/.test(b));
  if (!blocos.length) throw new Error(`a fonte "${fonte}" voltou sem recorte latino. Confira o nome exato no Google Fonts.`);

  const comDados = [];
  for (const bloco of blocos) {
    const m = /url\((https:\/\/[^)]+\.woff2)\)/.exec(bloco);
    if (!m) continue;
    const bin = await fetch(m[1], { headers: { 'user-agent': UA_NAVEGADOR } });
    if (!bin.ok) continue;
    const b64 = Buffer.from(await bin.arrayBuffer()).toString('base64');
    comDados.push(bloco.replace(m[0], `url(data:font/woff2;base64,${b64}) format('woff2')`).replace(/format\('woff2'\)\s*format\('woff2'\)/, "format('woff2')"));
  }
  if (!comDados.length) throw new Error(`baixei o CSS da fonte "${fonte}" mas nenhum arquivo woff2 veio junto.`);

  const final = comDados.join('\n');
  await mkdir(CACHE_FONTES, { recursive: true });
  await writeFile(arquivo, final, 'utf8');
  fontesNaMemoria.set(chave, final);
  return final;
}

// ------------------------------------------------------------------- desenhos

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function pagina({ fonte, cssFonte, corpo, fundo = 'transparent', largura, altura }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
${cssFonte || ''}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${largura}px;height:${altura}px;background:${fundo};overflow:hidden}
  body{display:flex;align-items:center;justify-content:center;
       font-family:'${fonte}',Georgia,'Times New Roman',serif;
       -webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
</style></head><body>${corpo}
<script>
// Centralizar a caixa de linha nao centraliza a letra: a fonte reserva espaco de
// perna ("g", "p") que o "A" nao usa, e a inicial fica baixa dentro do circulo.
// Aqui a tinta e medida de verdade e o glifo desce ou sobe ate o centro otico.
window.__centralizar = function () {
  document.querySelectorAll('[data-glifo]').forEach(function (el) {
    var cs = getComputedStyle(el);
    var ctx = document.createElement('canvas').getContext('2d');
    ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var m = ctx.measureText(el.textContent);
    if (!m.actualBoundingBoxAscent && !m.actualBoundingBoxDescent) return;
    var corpoFonte = parseFloat(cs.fontSize);
    var meiaEntrelinha = (corpoFonte - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2;
    var baseline = meiaEntrelinha + m.fontBoundingBoxAscent;
    var centroDaTinta = baseline - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    el.style.top = (el.parentElement.clientHeight / 2 - centroDaTinta) + 'px';
  });
};
</script>
</body></html>`;
}

function wordmark({ marca, fonte, cor, tracking, peso, caixa }) {
  const texto = caixa === 'alta' ? marca.toUpperCase() : marca;
  return `<div style="
    color:${cor};font-weight:${peso};font-size:200px;line-height:1;
    letter-spacing:${tracking}em;white-space:nowrap;
    padding-left:${tracking}em">${esc(texto)}</div>`;
}

function monograma({ marca, fonte, cor, fundoForma, forma, peso }) {
  const iniciais = marca.trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const raio = { circulo: '50%', quadrado: '0', arredondado: '18%' }[forma] || '50%';
  return `<div style="
    position:relative;width:760px;height:760px;border-radius:${raio};background:${fundoForma}">
    <span data-glifo style="position:absolute;left:0;width:100%;text-align:center;
      color:${cor};font-weight:${peso};font-size:340px;line-height:1;
      letter-spacing:.02em;padding-left:.02em">${esc(iniciais)}</span></div>`;
}

function lockup({ marca, fonte, cor, tracking, peso, caixa, descritor }) {
  const texto = caixa === 'alta' ? marca.toUpperCase() : marca;
  const sub = descritor
    ? `<div style="color:${cor};opacity:.7;font-size:34px;letter-spacing:.42em;
         text-transform:uppercase;font-weight:400;margin-top:30px;
         padding-left:.42em">${esc(descritor)}</div>` : '';
  return `<div style="text-align:center">
    <div style="color:${cor};font-weight:${peso};font-size:150px;line-height:1;
      letter-spacing:${tracking}em;white-space:nowrap;
      padding-left:${tracking}em">${esc(texto)}</div>${sub}</div>`;
}

function favicon({ marca, fonte, cor, fundoForma, forma, peso, lado }) {
  const inicial = marca.trim()[0].toUpperCase();
  const raio = { circulo: '50%', quadrado: '0', arredondado: '22%' }[forma] || '22%';
  return `<div style="
    position:relative;width:${lado}px;height:${lado}px;border-radius:${raio};background:${fundoForma}">
    <span data-glifo style="position:absolute;left:0;width:100%;text-align:center;
      color:${cor};font-weight:${peso};font-size:${Math.round(lado * 0.58)}px;
      line-height:1;letter-spacing:.01em;padding-left:.01em">${esc(inicial)}</span></div>`;
}

// ---------------------------------------------------------------------- SVG

function svgWordmark({ marca, fonte, cor, tracking, peso, caixa }) {
  const texto = caixa === 'alta' ? marca.toUpperCase() : marca;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 400" width="1600" height="400">
  <text x="800" y="200" text-anchor="middle" dominant-baseline="central"
        font-family="${esc(fonte)}, Georgia, serif" font-size="200" font-weight="${peso}"
        letter-spacing="${tracking * 200}" fill="${cor}">${esc(texto)}</text>
</svg>
<!-- Texto ainda e texto: quem abrir no Illustrator precisa ter a fonte ${esc(fonte)}
     instalada, ou converter em curvas (Type > Create Outlines). -->`;
}

function svgMonograma({ marca, fonte, cor, fundoForma, forma, peso }) {
  const iniciais = marca.trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const molde = forma === 'quadrado'
    ? `<rect width="760" height="760" fill="${fundoForma}"/>`
    : forma === 'arredondado'
      ? `<rect width="760" height="760" rx="137" fill="${fundoForma}"/>`
      : `<circle cx="380" cy="380" r="380" fill="${fundoForma}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 760" width="760" height="760">
  ${molde}
  <text x="380" y="380" text-anchor="middle" dominant-baseline="central"
        font-family="${esc(fonte)}, Georgia, serif" font-size="340" font-weight="${peso}"
        fill="${cor}">${esc(iniciais)}</text>
</svg>`;
}

// ---------------------------------------------------------------------- .ico

// ICO aceita PNG cru dentro dele desde o Vista. Entao o arquivo e so cabecalho
// mais os PNGs que o Chrome ja desenhou, sem Pillow, sem sips, sem redimensionar.
function montarIco(pngs) {
  const n = pngs.length;
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(n, 4);

  const entradas = [];
  let offset = 6 + n * 16;
  for (const { lado, dados } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(lado >= 256 ? 0 : lado, 0);
    e.writeUInt8(lado >= 256 ? 0 : lado, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(dados.length, 8);
    e.writeUInt32LE(offset, 12);
    entradas.push(e);
    offset += dados.length;
  }
  return Buffer.concat([cabecalho, ...entradas, ...pngs.map((p) => p.dados)]);
}

// ------------------------------------------------------------------ conceitos

// Seis direcoes tipograficas conhecidas. O aluno olha, escolhe uma e so entao
// gera os arquivos finais. Nenhuma delas custa credito de IA.
const DIRECOES = [
  { id: 'serifa-alta',    fonte: 'Cormorant Garamond', peso: 300, tracking: 0.28, caixa: 'alta',   nota: 'joia, perfume, moda cara' },
  { id: 'serifa-editorial', fonte: 'Playfair Display', peso: 500, tracking: 0.02, caixa: 'normal', nota: 'revista, decoracao, casa' },
  { id: 'sem-serifa-larga', fonte: 'Jost',             peso: 300, tracking: 0.42, caixa: 'alta',   nota: 'minimalista, tecnologia, relogio' },
  { id: 'sem-serifa-solida', fonte: 'Archivo',         peso: 700, tracking: -0.01, caixa: 'normal', nota: 'esporte, ferramenta, direto' },
  { id: 'geometrica-suave', fonte: 'Poppins',          peso: 500, tracking: 0.06, caixa: 'normal', nota: 'infantil, bem-estar, pet' },
  { id: 'grotesca-neutra',  fonte: 'Inter',            peso: 600, tracking: -0.02, caixa: 'normal', nota: 'utilidade, generico seguro' },
];

// ------------------------------------------------------------------- comandos

function config(flags) {
  const marca = flags.marca;
  if (!marca) throw new Error('faltou --marca "Nome da Loja"');
  return {
    marca,
    fonte: flags.fonte || 'Cormorant Garamond',
    cor: flags.cor || '#1B2A41',
    fundo: flags.fundo || '#F5F1E8',
    forma: flags.forma || 'circulo',
    peso: parseInt(flags.peso || '400', 10),
    tracking: parseFloat(flags.tracking ?? '0.18'),
    caixa: flags.caixa || 'alta',
    descritor: flags.descritor || '',
    saida: resolve(flags.saida || join(process.cwd(), 'marca')),
  };
}

async function cmdConceitos(flags) {
  const chrome = acharChrome(flags.chrome);
  const c = config(flags);
  const saida = join(c.saida, 'conceitos');
  await mkdir(saida, { recursive: true });

  console.log('  abrindo o navegador...');
  const nav = await abrirChrome(chrome);
  const feitos = [];
  try {
  for (const d of DIRECOES) {
    const destino = join(saida, `${d.id}.png`);
    const cssFonte = await prepararFonte(d.fonte, d.peso);
    const html = pagina({
      fonte: d.fonte, cssFonte, largura: 1600, altura: 400, fundo: c.fundo,
      corpo: wordmark({ marca: c.marca, fonte: d.fonte, cor: c.cor, tracking: d.tracking, peso: d.peso, caixa: d.caixa }),
    });
    await nav.foto(html, destino, 1600, 400);
    feitos.push({ ...d, arquivo: destino });
    console.log(`  ${d.id.padEnd(20)} ${d.fonte.padEnd(20)} ${d.nota}`);
  }
  } finally { await nav.fechar(); }

  const folha = feitos.map((d) =>
    `<figure style="margin:0 0 44px"><img src="${d.id}.png" style="width:100%;display:block;border:1px solid #E4DED2">
     <figcaption style="font:14px/1.5 system-ui;color:#666;padding-top:10px">
       <b style="color:#111">${d.id}</b> · ${d.fonte} · ${d.nota}<br>
       <code style="font-size:12px">--fonte "${d.fonte}" --peso ${d.peso} --tracking ${d.tracking} --caixa ${d.caixa}</code>
     </figcaption></figure>`).join('\n');
  await writeFile(join(saida, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Conceitos — ${esc(c.marca)}</title>
     <body style="background:#FAF8F4;padding:56px;max-width:1100px;margin:auto">
     <h1 style="font:600 30px system-ui;margin-bottom:8px">${esc(c.marca)}</h1>
     <p style="font:15px/1.6 system-ui;color:#555;margin-bottom:40px">
       Seis direcoes tipograficas. Escolha uma e rode <code>tudo</code> com as opcoes que estao embaixo dela.</p>
     ${folha}</body>`, 'utf8');

  console.log(`\n  ${feitos.length} conceitos em ${saida}`);
  console.log(`  Abra ${join(saida, 'index.html')} pra comparar lado a lado.`);
  return feitos;
}

async function cmdTudo(flags) {
  const chrome = acharChrome(flags.chrome);
  const c = config(flags);
  const dirs = {
    logo: join(c.saida, 'logo'),
    monograma: join(c.saida, 'monograma'),
    favicon: join(c.saida, 'favicon'),
    svg: join(c.saida, 'svg'),
  };
  for (const d of Object.values(dirs)) await mkdir(d, { recursive: true });

  const cssFonte = await prepararFonte(c.fonte, c.peso);
  const base = { marca: c.marca, fonte: c.fonte, tracking: c.tracking, peso: c.peso, caixa: c.caixa };
  const gerados = [];

  console.log('  abrindo o navegador...');
  const nav = await abrirChrome(chrome);
  try {

  const pecas = [
    ['logo/wordmark-cor.png',      1600, 400, 'transparent', () => wordmark({ ...base, cor: c.cor })],
    ['logo/wordmark-preto.png',    1600, 400, 'transparent', () => wordmark({ ...base, cor: '#000000' })],
    ['logo/wordmark-branco.png',   1600, 400, 'transparent', () => wordmark({ ...base, cor: '#FFFFFF' })],
    ['logo/wordmark-no-fundo.png', 1600, 400, c.fundo,       () => wordmark({ ...base, cor: c.cor })],
    ['logo/lockup.png',            1200, 800, 'transparent', () => lockup({ ...base, cor: c.cor, descritor: c.descritor })],
    ['logo/lockup-no-fundo.png',   1200, 800, c.fundo,       () => lockup({ ...base, cor: c.cor, descritor: c.descritor })],
    ['monograma/monograma-cor.png',    800, 800, 'transparent', () => monograma({ ...base, cor: c.fundo, fundoForma: c.cor, forma: c.forma })],
    ['monograma/monograma-invertido.png', 800, 800, 'transparent', () => monograma({ ...base, cor: c.cor, fundoForma: c.fundo, forma: c.forma })],
    ['monograma/monograma-vazado.png', 800, 800, 'transparent', () => monograma({ ...base, cor: c.cor, fundoForma: 'transparent', forma: c.forma })],
  ];

  for (const [rel, w, h, fundo, montar] of pecas) {
    const destino = join(c.saida, rel);
    await nav.foto(pagina({ fonte: c.fonte, cssFonte, largura: w, altura: h, fundo, corpo: montar() }), destino, w, h);
    gerados.push(rel);
    console.log(`  ${rel}`);
  }

  // Cada tamanho de favicon e desenhado no tamanho final. Reduzir um PNG grande
  // borra a letra em 16px, que e justo onde ela precisa ficar legivel.
  const LADOS = [512, 256, 192, 180, 64, 48, 32, 16];
  const pngs = [];
  for (const lado of LADOS) {
    const rel = `favicon/favicon-${lado}.png`;
    const destino = join(c.saida, rel);
    const bin = await nav.foto(pagina({
      fonte: c.fonte, cssFonte, largura: lado, altura: lado, fundo: 'transparent',
      corpo: favicon({ ...base, cor: c.fundo, fundoForma: c.cor, forma: c.forma, lado }),
    }), destino, lado, lado);
    pngs.push({ lado, dados: bin });
    gerados.push(rel);
    console.log(`  ${rel}`);
  }

  const ico = montarIco(pngs.filter((p) => [16, 32, 48, 64, 256].includes(p.lado)));
  await writeFile(join(dirs.favicon, 'favicon.ico'), ico);
  gerados.push('favicon/favicon.ico');
  console.log('  favicon/favicon.ico');

  await writeFile(join(dirs.svg, 'wordmark.svg'), svgWordmark({ ...base, cor: c.cor }), 'utf8');
  await writeFile(join(dirs.svg, 'monograma.svg'), svgMonograma({ ...base, cor: c.fundo, fundoForma: c.cor, forma: c.forma }), 'utf8');
  gerados.push('svg/wordmark.svg', 'svg/monograma.svg');
  console.log('  svg/wordmark.svg\n  svg/monograma.svg');
  } finally { await nav.fechar(); }

  await writeFile(join(c.saida, 'LEIA-ME.md'), leiaMe(c, gerados), 'utf8');
  console.log(`\n  ${gerados.length} arquivos em ${c.saida}`);
  console.log(`  Leia ${join(c.saida, 'LEIA-ME.md')} pra saber onde usar cada um.`);
  return gerados;
}

function leiaMe(c, gerados) {
  return `# Marca ${c.marca}

Fonte **${c.fonte}** · cor principal \`${c.cor}\` · fundo \`${c.fundo}\` · forma do selo: ${c.forma}

## Onde usar cada arquivo

| Arquivo | Onde entra |
|---|---|
| \`logo/wordmark-cor.png\` | cabecalho da loja, e-mail, assinatura |
| \`logo/wordmark-preto.png\` | fundo claro qualquer, nota fiscal, documento |
| \`logo/wordmark-branco.png\` | fundo escuro, foto, rodape preto |
| \`logo/wordmark-no-fundo.png\` | quando precisa de um retangulo fechado (marketplace, parceiro) |
| \`logo/lockup.png\` | perfil de rede social, cartao, embalagem |
| \`monograma/monograma-cor.png\` | foto de perfil do Instagram, avatar, etiqueta |
| \`monograma/monograma-vazado.png\` | marca d'agua sobre foto |
| \`favicon/favicon.ico\` | raiz do site, para o navegador antigo |
| \`favicon/favicon-32.png\` | aba do navegador |
| \`favicon/favicon-180.png\` | icone do iPhone quando salvam a loja na tela inicial |
| \`favicon/favicon-512.png\` | Shopify pede esse tamanho no upload de favicon |
| \`svg/wordmark.svg\` | quando precisa ampliar sem perder nitidez (banner, adesivo, sacola) |

## No Shopify

Admin → Online Store → Themes → Customize → Theme settings → Logo: suba
\`logo/wordmark-cor.png\`. Em Favicon, suba \`favicon/favicon-512.png\`.

## No HTML, se voce mexer no tema

\`\`\`html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/favicon-180.png">
\`\`\`

## O que nao fazer

- Nao estique o logo. Segure a proporcao sempre.
- Nao troque a cor por uma parecida. As duas cores acima sao as unicas.
- Nao ponha o wordmark colorido em cima de foto. Nesse caso use a versao branca.
- Nao gere o favicon reduzindo o logo grande num editor. Cada tamanho aqui foi
  desenhado no tamanho final, e por isso a letra continua legivel em 16 pixels.

## Refazer

\`\`\`bash
node gerar.mjs tudo --marca "${c.marca}" --fonte "${c.fonte}" \\
  --cor "${c.cor}" --fundo "${c.fundo}" --forma ${c.forma} \\
  --peso ${c.peso} --tracking ${c.tracking} --caixa ${c.caixa}
\`\`\`

${gerados.length} arquivos gerados.
`;
}

function cmdPrompt(flags) {
  const marca = flags.marca;
  if (!marca) throw new Error('faltou --marca "Nome da Loja"');
  const nicho = flags.nicho || 'a loja';
  return `
Cole o texto abaixo no ChatGPT ou no Gemini (versao gratuita serve) para ver ideias
de simbolo. Use o resultado so como referencia de forma: o arquivo final da marca
sai do proprio gerar.mjs, com a fonte certa e fundo transparente de verdade.

--------------------------------------------------------------------------------
Desenhe uma folha de referencia com 4 simbolos de marca, dispostos em grade 2x2,
para uma loja chamada "${marca}", do segmento de ${nicho}.

Regras:
- Cada simbolo e uma marca abstrata simples, feita de forma geometrica, sem texto,
  sem letra e sem numero dentro.
- Preto sobre fundo branco liso, sem sombra, sem gradiente, sem brilho, sem 3D.
- Traco de espessura constante, do tipo que continua legivel em 16 pixels.
- Nada de mascote, nada de ilustracao detalhada, nada de fundo decorado.
- As 4 ideias devem ser diferentes entre si na forma, nao variacoes da mesma.
- Deixe respiro em volta de cada simbolo.
--------------------------------------------------------------------------------

Depois de escolher a forma que voce gostou, vale uma segunda colagem pedindo:

  "Redesenhe apenas o simbolo do quadrante superior direito, sozinho, centralizado,
   preto sobre branco, sem texto, com margem larga em volta."

Com o simbolo escolhido em maos, mande refazer o traco em vetor limpo ou desenhe
por cima. O logo escrito, o monograma e o favicon continuam saindo daqui:

  node gerar.mjs tudo --marca "${marca}"
`.trim();
}

// ----------------------------------------------------------------------- main

const AJUDA = `
Marca vetorial — logo, monograma e favicon sem IA e sem custo

  conceitos    seis direcoes tipograficas pra escolher    --marca
  tudo         gera a marca inteira na direcao escolhida  --marca [--fonte --cor ...]
  prompt       texto pronto pro ChatGPT ou Gemini sugerir simbolo   --marca --nicho

Opcoes de "tudo":
  --marca      nome da loja                          (obrigatorio)
  --fonte      fonte do Google Fonts                 (padrao Cormorant Garamond)
  --cor        cor principal em hex                  (padrao #1B2A41)
  --fundo      cor de apoio em hex                   (padrao #F5F1E8)
  --forma      circulo | arredondado | quadrado      (padrao circulo)
  --peso       300 a 700                             (padrao 400)
  --tracking   espaco entre letras, em em            (padrao 0.18)
  --caixa      alta | normal                         (padrao alta)
  --descritor  linha pequena embaixo do nome         (opcional)
  --saida      pasta de destino                      (padrao ./marca)
  --chrome     caminho do Chrome, se nao for achado sozinho
`.trim();

async function main() {
  const { livres, flags } = lerArgs(process.argv.slice(2));
  const cmd = livres[0];
  if (!cmd || flags.help || cmd === 'ajuda') { console.log(AJUDA); return; }
  if (cmd === 'conceitos') { await cmdConceitos(flags); return; }
  if (cmd === 'tudo') { await cmdTudo(flags); return; }
  if (cmd === 'prompt') { console.log(cmdPrompt(flags)); return; }
  console.error(`comando "${cmd}" nao existe.\n`);
  console.error(AJUDA);
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(`[erro] ${e.message}`);
  process.exitCode = 1;
});
