/* ============================================================
   Leitor de tabela de medidas de uma PDP
   ------------------------------------------------------------
   Entra a URL de um produto, sai a tabela normalizada pronta
   pro provador. E a peca que a skill usa quando voce manda
   "aplica o provador nesse produto aqui".

   O trabalho sujo esta aqui: loja nenhuma cadastra tabela do
   mesmo jeito. Aparece como <table> na descricao, como imagem
   (ai nao da pra ler e a gente avisa), dentro de um modal que
   so monta no clique, em polegada, em medida deitada, com o
   tamanho na primeira coluna ou na primeira linha.

   Rodar:
     node ler-tabela.mjs <url> [--json] [--todas]
   ============================================================ */

import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

/* ---------- vocabulario ---------- */

const SIN = {
  busto: ['busto', 'bust', 'peito', 'chest', 'pecho', 'poitrine', 'brust', 'torax', 'pit to pit', 'pit-to-pit', 'p2p'],
  cintura: ['cintura', 'waist', 'taille', 'taille (cm)', 'vita', 'bund'],
  quadril: ['quadril', 'hip', 'hips', 'cadera', 'hanche', 'huefte', 'hufte', 'anca'],
  ombro: ['ombro', 'shoulder', 'shoulders', 'hombro', 'epaule', 'schulter'],
  comprimento: ['comprimento', 'length', 'largo', 'longueur', 'lange', 'lunghezza', 'altura da peca'],
  manga: ['manga', 'sleeve', 'sleeve length', 'manche', 'armel'],
  entrepernas: ['entrepernas', 'inseam', 'inside leg', 'entrejambe', 'schrittlange', 'gancho'],
  coxa: ['coxa', 'thigh', 'muslo', 'cuisse'],
  braco: ['braco', 'arm', 'bicep', 'biceps', 'oberarm'],
  pescoco: ['pescoco', 'neck', 'cuello', 'cou', 'hals'],
  pe: ['pe', 'foot', 'foot length', 'comprimento do pe', 'longitud del pie', 'fusslange', 'cm do pe', 'insole', 'palmilha'],
  punho: ['punho', 'wrist', 'muneca', 'poignet', 'handgelenk'],
  caixa: ['caixa', 'case', 'case size', 'diametro', 'diameter'],
  banda: ['banda', 'band', 'underbust', 'sob o busto', 'torax sob o busto'],
  altura: ['altura', 'height', 'hauteur', 'hohe'],
  largura: ['largura', 'width', 'ancho', 'largeur', 'breite'],
};

const ROTULO_TAMANHO = [
  'tamanho', 'tam', 'size', 'talla', 'taille', 'grosse', 'große', 'misura',
  'us', 'uk', 'eu', 'br', 'int', 'intl', 'letra', 'numeracao', 'numero',
];

const VALOR_TAMANHO =
  /^(pp|p|m|g|gg|ggg|xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|u|un|unico|one size|\d{1,3}(?:[.,]5)?|\d{1,2}\s*[-\/]\s*\d{1,2})$/i;

/**
 * Pe-e-polegada -> cm. Loja americana publica altura como faixa
 * (5'1"-5'5") e qualquer parser ingenuo le isso como 5.1,
 * o que joga a pessoa pro menor tamanho
 * da grade. Trata 5'7", 5' 7", 5ft7in e 5'7 (sem aspas de fechamento).
 */
function pesPolegadasParaCm(txt) {
  const m = String(txt).match(/(\d+)\s*(?:'|ft|pes?|feet)\s*(\d+(?:[.,]\d+)?)?\s*(?:"|''|in|pol)?/i);
  if (!m) return null;
  const pes = parseFloat(m[1]);
  const pol = m[2] ? parseFloat(String(m[2]).replace(',', '.')) : 0;
  if (!isFinite(pes) || pes < 3 || pes > 8) return null; // altura humana plausivel
  return (pes * 12 + pol) * 2.54;
}

function temPesPolegadas(txt) {
  return /\d\s*(?:'|ft\b|feet\b)\s*\d/i.test(String(txt));
}

function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** casa um cabecalho com uma medida conhecida */
function medidaDe(cabecalho) {
  const c = norm(cabecalho).replace(/\(.*?\)/g, '').trim();
  if (!c) return null;
  for (const [chave, lista] of Object.entries(SIN)) {
    for (const alt of lista) {
      if (c === alt || c.startsWith(alt + ' ') || c.includes(alt)) return chave;
    }
  }
  return null;
}

function ehColunaDeTamanho(cabecalho, valores) {
  const c = norm(cabecalho).replace(/\(.*?\)/g, '').trim();
  if (ROTULO_TAMANHO.some((r) => c === r || c.startsWith(r + ' ') || c.endsWith(' ' + r))) return true;
  if (!valores.length) return false;
  const batem = valores.filter((v) => VALOR_TAMANHO.test(norm(v))).length;
  return batem / valores.length >= 0.7;
}

/* ---------- deteccao de unidade e tipo ---------- */

function detectarUnidade(textoTabela, valores) {
  const t = norm(textoTabela);
  const temPol = /\b(in|inch|inches|pol|polegada)\b|"/.test(t);
  const temCm = /\bcm\b|centimetro/.test(t);
  if (temCm && !temPol) return { unidade: 'cm', como: 'texto diz cm' };
  if (temPol && !temCm) return { unidade: 'in', como: 'texto diz polegada' };
  if (temCm && temPol) return { unidade: 'ambas', como: 'tabela tem cm e polegada' };
  // Sem rotulo: usa a ordem de grandeza. Circunferencia de busto humano
  // fica entre ~70 e ~140 cm, e entre ~28 e ~55 polegadas. Nao ha
  // sobreposicao pratica, entao a mediana decide.
  const nums = valores.map(Number).filter((n) => isFinite(n) && n > 0);
  if (!nums.length) return { unidade: 'cm', como: 'sem pista, assumiu cm' };
  nums.sort((a, b) => a - b);
  const mediana = nums[Math.floor(nums.length / 2)];
  return mediana > 60
    ? { unidade: 'cm', como: `sem rotulo, mediana ${mediana} sugere cm` }
    : { unidade: 'in', como: `sem rotulo, mediana ${mediana} sugere polegada` };
}

function detectarMedicao(textoTabela) {
  const t = norm(textoTabela);
  if (/deitad|flat|plana|pit to pit|pit-to-pit|\bp2p\b|meia circunf/.test(t)) {
    return { medicao: 'deitada', como: 'texto indica medida plana' };
  }
  return { medicao: 'circunferencia', como: 'assumiu circunferencia' };
}

function detectarTipo(textoTabela, medidas, amostra) {
  const t = norm(textoTabela);
  if (/medidas? do corpo|body measurements|your measurements|encontre seu tamanho|how to measure yourself|meca-se|mecas voce/.test(t)) {
    return { tipo: 'corpo', como: 'texto fala em medida do corpo' };
  }
  if (/medidas? da peca|garment measurements|product measurements|medidas do produto|flat measurement/.test(t)) {
    return { tipo: 'peca', como: 'texto fala em medida da peca' };
  }
  // Sinal estrutural forte: peca nenhuma tem a ALTURA de quem veste como
  // coluna. Se a tabela lista altura da pessoa, ela descreve o corpo.
  // Foi assim que uma tabela com busto/cintura/altura em pes apareceu
  // classificada errada como medida de peca no primeiro teste real.
  if ((medidas || []).includes('altura') && (temPesPolegadas(amostra || '') || /altura|height/.test(t))) {
    return { tipo: 'corpo', como: 'tem coluna de altura da pessoa' };
  }
  return { tipo: 'peca', como: 'assumiu medida da peca (padrao do mercado)' };
}

/* ---------- parser de uma <table> ---------- */

/**
 * Separa cabecalho de dados. Muita tabela de fornecedor usa DUAS linhas de
 * cabecalho: a de cima com o nome da medida ("INNER LENGTH", com colspan) e
 * a de baixo com a unidade de cada coluna ("CM", "INCHES"). Tratar a segunda
 * como dado cria uma linha fantasma cujo tamanho e a palavra "CM".
 */
function separarCabecalho(linhas) {
  const ehDado = (l) =>
    l.filter((c) => /\d/.test(c)).length >= Math.max(1, Math.ceil(l.length / 2));

  let corte = 1;
  if (linhas.length > 2 && !ehDado(linhas[1])) corte = 2;

  const cab = linhas.slice(0, corte);
  const largura = Math.max(...linhas.map((l) => l.length));
  const cabecalhos = [];
  for (let i = 0; i < largura; i++) {
    const partes = cab.map((l) => (l[i] || '').trim()).filter(Boolean);
    // remove repeticao gerada pelo colspan ("INNER LENGTH INNER LENGTH")
    cabecalhos.push([...new Set(partes)].join(' ').trim());
  }
  return { cabecalhos, linhas: linhas.slice(corte), nLinhasCabecalho: corte };
}

/** grade declarada no cabecalho da coluna de tamanho: EU, US, UK, BR */
function sistemaDe(cab) {
  const c = norm(cab);
  if (/\beu\b|europ/.test(c)) return 'EU';
  if (/\bus\b|\busa\b/.test(c)) return 'US';
  if (/\buk\b/.test(c)) return 'UK';
  if (/\bbr\b|brasil/.test(c)) return 'BR';
  return null;
}

/** unidade declarada no proprio cabecalho da coluna */
function unidadeDaColuna(cab) {
  const c = norm(cab);
  if (/\bcm\b|centimetro/.test(c)) return 'cm';
  if (/\binch|\bin\b|polegada|\bpol\b/.test(c)) return 'in';
  if (/\bmm\b/.test(c)) return 'mm';
  return null;
}


function parseTabela(bruta) {
  const { cabecalhos, linhas } = separarCabecalho(bruta.linhas);
  if (!linhas.length) return null;

  // Quando a mesma medida aparece em cm E em polegada, fica so a de cm.
  // Deixar as duas faz a segunda sobrescrever a primeira e a peca vira
  // 24 cm de comprimento quando na verdade sao 24 polegadas.
  const unidadePorColuna = cabecalhos.map(unidadeDaColuna);

  // Caso A: tamanhos nas LINHAS (cabecalho = medidas). O mais comum.
  const colTam = cabecalhos.findIndex((h, i) =>
    ehColunaDeTamanho(h, linhas.map((l) => l[i]))
  );

  if (colTam !== -1) {
    let cols = cabecalhos
      .map((h, i) => ({ i, med: medidaDe(h), un: unidadePorColuna[i] }))
      .filter((c) => c.med && c.i !== colTam);
    const temCmPara = new Set(cols.filter((c) => c.un === 'cm').map((c) => c.med));
    cols = cols.filter((c) => !(c.un === 'in' && temCmPara.has(c.med)));
    if (!cols.length) return null;

    const valores = [];
    const tamanhos = linhas
      .map((l) => {
        const t = String(l[colTam] ?? '').trim();
        if (!t) return null;
        const obj = { tamanho: t };
        for (const c of cols) {
          const v = String(l[c.i] ?? '').trim();
          if (v) { obj[c.med] = v; valores.push(v.replace(',', '.').match(/[\d.]+/)?.[0]); }
        }
        return Object.keys(obj).length > 1 ? obj : null;
      })
      .filter(Boolean);

    return tamanhos.length
      ? {
          tamanhos,
          valores,
          cabecalhos,
          orientacao: 'tamanho nas linhas',
          sistema: sistemaDe(cabecalhos[colTam]),
          unidadeColunas: [...new Set(cols.map((c) => c.un).filter(Boolean))],
        }
      : null;
  }

  // Caso B: tamanhos nas COLUNAS (primeira coluna = nome da medida).
  const nomes = linhas.map((l) => String(l[0] ?? ''));
  const meds = nomes.map(medidaDe);
  if (!meds.some(Boolean)) return null;

  const rotulos = cabecalhos.slice(1);
  if (!rotulos.length) return null;

  const valores = [];
  const tamanhos = rotulos
    .map((r, ci) => {
      const t = String(r ?? '').trim();
      if (!t) return null;
      const obj = { tamanho: t };
      meds.forEach((m, li) => {
        if (!m) return;
        const v = String(linhas[li][ci + 1] ?? '').trim();
        if (v) { obj[m] = v; valores.push(v.replace(',', '.').match(/[\d.]+/)?.[0]); }
      });
      return Object.keys(obj).length > 1 ? obj : null;
    })
    .filter(Boolean);

  return tamanhos.length
    ? { tamanhos, valores, cabecalhos, orientacao: 'tamanho nas colunas', sistema: null, unidadeColunas: [] }
    : null;
}

/* ---------- extracao da pagina ---------- */

async function extrair(url) {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
    locale: 'pt-BR',
  });
  const pag = await ctx.newPage();
  const aviso = [];

  await pag.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pag.waitForTimeout(2500);

  // Muitas lojas so montam a tabela quando o modal abre. Clica em tudo
  // que cheira a tabela de medidas antes de ler o DOM.
  const gatilhos = await pag.evaluate(() => {
    const re = /tabela de medidas|guia de tamanhos|size (chart|guide)|guia de tallas|size table|medidas/i;
    const els = Array.from(document.querySelectorAll('button, a, summary, [role="button"], .sizing-chart__button'));
    return els.filter((e) => re.test(e.textContent || '')).length;
  });
  if (gatilhos) {
    await pag.evaluate(() => {
      const re = /tabela de medidas|guia de tamanhos|size (chart|guide)|guia de tallas|size table|medidas/i;
      Array.from(document.querySelectorAll('button, a, summary, [role="button"], .sizing-chart__button'))
        .filter((e) => re.test(e.textContent || ''))
        .slice(0, 4)
        .forEach((e) => { try { e.click(); } catch (_) {} });
    });
    await pag.waitForTimeout(1500);
  }

  const bruto = await pag.evaluate(() => {
    const out = [];
    document.querySelectorAll('table').forEach((t) => {
      // Monta a grade honrando colSpan E rowSpan. Sem isso a tabela real
      // de uma loja de calcado quebra: o cabecalho e "EU | INNER LENGTH"
      // com INNER LENGTH em colspan 2 e EU em rowspan 2, e a sub-linha
      // "CM | INCHES" so tem 2 celulas contra 3 colunas de dados. Ignorar
      // o rowspan desloca tudo e a coluna em centimetro vira polegada.
      const grade = [];
      const ocupado = {};
      Array.from(t.rows).forEach((r, li) => {
        if (!grade[li]) grade[li] = [];
        let ci = 0;
        Array.from(r.cells).forEach((c) => {
          while (ocupado[li + ':' + ci]) ci++;
          const txt = c.textContent.replace(/\s+/g, ' ').trim();
          const cs = Math.max(1, c.colSpan || 1);
          const rs = Math.max(1, c.rowSpan || 1);
          for (let dr = 0; dr < rs; dr++) {
            for (let dc = 0; dc < cs; dc++) {
              if (!grade[li + dr]) grade[li + dr] = [];
              grade[li + dr][ci + dc] = txt;
              ocupado[li + dr + ':' + (ci + dc)] = true;
            }
          }
          ci += cs;
        });
      });
      const largura = Math.max(...grade.map((l) => l.length));
      const linhas = grade.map((l) => {
        const out = [];
        for (let i = 0; i < largura; i++) out.push(l[i] == null ? '' : l[i]);
        return out;
      });
      if (linhas.length < 2) return;
      out.push({
        linhas,
        temTh: !!t.querySelector('th'),
        texto: (t.closest('div,section,details,dialog') || t).textContent
          .replace(/\s+/g, ' ')
          .slice(0, 1200),
      });
    });
    return {
      tabelas: out,
      titulo: document.title,
      // imagem de tabela de medidas: nao da pra ler, mas da pra avisar
      imagens: Array.from(document.querySelectorAll('img'))
        .filter((i) => /size|medida|tamanho|talla|chart|guide/i.test((i.alt || '') + ' ' + (i.src || '')))
        .map((i) => i.src)
        .slice(0, 5),
    };
  });

  await nav.close();
  return { ...bruto, aviso };
}


/**
 * Confere a grade da loja contra o padrao internacional e avisa quando
 * diverge. Ponto de Paris (EU): 1 ponto = 6,67 mm, e o numero corresponde
 * ao comprimento da FORMA, nao do pe (pe = EU x 0,667 - 1,33 cm).
 *
 * Serve para pegar tabela de fornecedor que veio errada. Numa loja real
 * testada, a coluna "INNER LENGTH" dava 24,2 cm para o EU 39, quando o
 * padrao para EU 39 e ~25,7 cm de palmilha. Ou o calcado veste dois
 * numeros menor, ou a coluna nao e palmilha. Nos dois casos o lojista
 * precisa saber ANTES de ligar o provador, senao a loja recomenda errado
 * com toda a confianca do mundo.
 */
function conferirGrade(tabela) {
  if (!tabela || tabela.sistema !== 'EU') return null;
  const medida = tabela.medidas.find((m) => m === 'comprimento' || m === 'pe');
  if (!medida) return null;

  const desvios = [];
  for (const linha of tabela.tamanhos) {
    const eu = parseFloat(String(linha.tamanho).replace(',', '.'));
    if (!isFinite(eu) || eu < 15 || eu > 55) continue;
    const txt = String(linha[medida] ?? '');
    const nums = txt.replace(',', '.').match(/\d+(?:\.\d+)?/g);
    if (!nums) continue;
    let cm = nums.map(Number).reduce((a, b) => a + b, 0) / nums.length;
    if (tabela.unidade === 'in') cm *= 2.54;
    if (tabela.unidade === 'mm') cm /= 10;
    if (cm < 15 || cm > 40) continue;
    // palmilha padrao ~ comprimento da forma = EU x 0,667
    const padrao = eu * 0.667;
    desvios.push({ eu, loja: cm, padrao, diffNumeros: (cm - padrao) / 0.667 });
  }
  if (desvios.length < 3) return null;

  desvios.sort((a, b) => a.diffNumeros - b.diffNumeros);
  const mediana = desvios[Math.floor(desvios.length / 2)].diffNumeros;
  if (Math.abs(mediana) < 1.2) return null;

  return {
    tipo: 'grade fora do padrao',
    numerosDeDesvio: Math.round(mediana * 10) / 10,
    leitura:
      mediana < 0
        ? `a grade da loja e cerca de ${Math.abs(Math.round(mediana * 10) / 10)} numeros MENOR que o padrao europeu: o calcado veste pequeno, ou a coluna nao e a palmilha`
        : `a grade da loja e cerca de ${Math.round(mediana * 10) / 10} numeros MAIOR que o padrao europeu: confira se a coluna e mesmo a palmilha`,
    amostra: desvios.slice(0, 3).map((d) => ({
      eu: d.eu,
      loja: Math.round(d.loja * 10) / 10,
      padrao: Math.round(d.padrao * 10) / 10,
    })),
  };
}

/* ---------- principal ---------- */

export async function lerTabela(url) {
  const { tabelas, titulo, imagens } = await extrair(url);
  const achadas = [];

  for (const t of tabelas) {
    const p = parseTabela(t);
    if (!p) continue;
    const meds = [...new Set(p.tamanhos.flatMap((x) => Object.keys(x).filter((k) => k !== 'tamanho')))];
    const amostra = p.tamanhos.map((x) => Object.values(x).join(' ')).join(' ');
    const un = p.unidadeColunas && p.unidadeColunas.length === 1
      ? { unidade: p.unidadeColunas[0], como: 'unidade declarada no cabecalho da coluna' }
      : detectarUnidade(t.texto + ' ' + (p.cabecalhos || []).join(' '), p.valores);
    const md = detectarMedicao(t.texto + ' ' + (p.cabecalhos || []).join(' '));
    const tp = detectarTipo(t.texto, meds, amostra);
    achadas.push({
      tipo: tp.tipo,
      unidade: un.unidade,
      medicao: md.medicao,
      tamanhos: p.tamanhos,
      medidas: meds,
      sistema: p.sistema,
      _diag: { orientacao: p.orientacao, unidade: un.como, medicao: md.como, tipo: tp.como },
    });
  }

  // a melhor tabela e a que cobre mais medidas em mais tamanhos
  achadas.sort(
    (a, b) => b.medidas.length * b.tamanhos.length - a.medidas.length * a.tamanhos.length
  );

  // "2 / XS" e "10 / Xl" sao o mesmo tamanho escrito em dois sistemas.
  // Guardar os dois rotulos deixa o casamento com a variante da loja
  // funcionar tanto se a loja usa numero quanto se usa letra.
  for (const t of achadas) {
    for (const linha of t.tamanhos) {
      const partes = String(linha.tamanho)
        .split(/\s*[\/|]\s*/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (partes.length > 1) linha.rotulos = partes;
    }
  }

  const alertas = achadas.map(conferirGrade).filter(Boolean);

  return {
    url,
    titulo,
    alertas,
    encontradas: achadas.length,
    melhor: achadas[0] || null,
    todas: achadas,
    imagensSuspeitas: imagens,
    // Sinaliza o caso em que a loja so tem a tabela como IMAGEM. Nao da pra
    // ler, e fingir que deu seria pior: o provador ficaria sem lastro.
    soImagem: achadas.length === 0 && imagens.length > 0,
  };
}

/* ---------- CLI ---------- */

// pathToFileURL e obrigatorio: se o caminho da pasta tiver espaco,
// import.meta.url vem com %20 e a comparacao crua nunca casa.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.argv[2];
  if (!url) {
    console.error('uso: node ler-tabela.mjs <url-do-produto> [--json] [--todas]');
    process.exit(2);
  }
  const r = await lerTabela(url);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log(`\n${r.titulo}\n${'='.repeat(Math.min(70, r.titulo.length))}`);
    console.log(`tabelas lidas: ${r.encontradas}`);
    for (const a of r.alertas || []) {
      console.log(`\n  ALERTA (${a.tipo}): ${a.leitura}`);
      console.log('  amostra:', JSON.stringify(a.amostra));
    }
    if (r.soImagem) {
      console.log('\nA tabela desta loja e IMAGEM. Nao da pra extrair numero dela.');
      console.log('Candidatas:', r.imagensSuspeitas.join('\n           '));
    }
    const alvos = process.argv.includes('--todas') ? r.todas : r.melhor ? [r.melhor] : [];
    for (const t of alvos) {
      console.log(`\n  tipo: ${t.tipo} | unidade: ${t.unidade} | medicao: ${t.medicao}`);
      console.log(`  diag: ${JSON.stringify(t._diag)}`);
      console.log(`  medidas: ${t.medidas.join(', ')}`);
      console.table(t.tamanhos);
    }
  }
  process.exit(r.melhor ? 0 : 1);
}
