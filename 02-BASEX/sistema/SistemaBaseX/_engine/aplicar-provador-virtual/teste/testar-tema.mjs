/* Testa o adaptador de tema contra o markup real de Dawn 15.5,
   Shrine PRO 1.3.3 e Vex TT 6.2, mais dois casos de borda.

   Cada caso roda numa pagina isolada, porque uma PDP de verdade
   so tem um form[action*="/cart/add"]. Testar todos juntos daria
   falso negativo por escopo cruzado.

   Rodar:  node testar-tema.mjs                                  */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(AQUI, 'fixtures.html'), 'utf8');
const js = readFileSync(join(AQUI, '..', 'section', 'bx-fit-theme.js'), 'utf8');

function recorta(id) {
  const abre = html.indexOf(`<div id="${id}">`);
  if (abre === -1) throw new Error(`caso ${id} nao existe no fixture`);
  let fim = abre, prof = 0;
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = abre;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('</')) prof--; else prof++;
    if (prof === 0) { fim = m.index + m[0].length; break; }
  }
  return html.slice(abre, fim);
}

/* caso, opcao, posicao, valores, alvo, esperado */
const CASOS = [
  ['caso-dawn-button',   'Tamanho', 2, ['P', 'M', 'G'],    'M',  { ok: true,  marcado: 'M'  }],
  ['caso-dawn-dropdown', 'Tamanho', 1, ['38', '40', '42'], '42', { ok: true,  marcado: '42' }],
  ['caso-shrine-pills',  'Tamanho', 1, ['34', '36', '38'], '38', { ok: true,  marcado: '38' }],
  ['caso-vex-dropdown',  'Tamanho', 2, ['36', '37', '38'], '37', { ok: true,  marcado: '37' }],
  ['caso-vex-block',     'Tamanho', 1, ['PP', 'P', 'M'],   'M',  { ok: true,  marcado: 'M'  }],
  ['caso-generico',      'Tamanho', 2, ['P', 'M', 'G'],    'G',  { ok: true,  marcado: 'G'  }],
  ['caso-esgotado',      'Tamanho', 1, ['P', 'M'],         'M',  { ok: false, marcado: null }],
];

const nav = await chromium.launch();
const pag = await nav.newPage();
let falhas = 0;

console.log('resultado  caso'.padEnd(30), 'esperado'.padEnd(12), 'diz/dom'.padEnd(12), 'via');
console.log('-'.repeat(84));

for (const [id, opcao, pos, valores, alvo, esp] of CASOS) {
  await pag.setContent(
    `<!doctype html><html><body>${recorta(id)}<script>${js}<\/script></body></html>`,
    { waitUntil: 'domcontentloaded' }
  );

  const r = await pag.evaluate(
    ([opcao, pos, valores, alvo]) => {
      const res = window.BXTheme.selecionar(opcao, pos, valores, alvo);
      // Confere lendo o DOM do GRUPO ALVO, nao o primeiro radio da pagina:
      // o caso generico tem o grupo Cor antes do grupo Tamanho, e ler o
      // primeiro checked da pagina devolvia "Preto" e acusava falha falsa.
      const gr = window.BXTheme.acharControles(opcao, pos, valores)[0];
      let confere = null;
      if (gr) {
        // O grupo pode vir como o proprio <select> ou como a lista de
        // <option> (no Dawn o data-option-name fica nos options).
        const sel =
          gr.els.find((e) => e.tagName === 'SELECT') ||
          (gr.els[0] && gr.els[0].tagName === 'OPTION'
            ? gr.els[0].parentElement
            : null);
        if (sel) {
          const o = sel.options[sel.selectedIndex];
          confere = o ? o.textContent.trim() : null;
        } else {
          const c = gr.els.find((e) => e.type === 'radio' && e.checked);
          if (c) confere = (window.BXTheme._texto(c) || c.value).trim();
        }
      }
      return Object.assign({}, res, {
        marcado: res.marcado || null,
        confere,
        diag: window.BXTheme.diagnostico(opcao, pos, valores),
      });
    },
    [opcao, pos, valores, alvo]
  );

  // Exige as duas coisas: o adaptador afirma que marcou X, e o DOM do grupo
  // alvo esta mesmo em X. Conferir so um dos dois deixaria passar falso
  // positivo (adaptador mentindo) ou falso negativo (leitura do lugar errado).
  const passou =
    esp.marcado === null
      ? r.ok === false
      : r.ok === true && r.marcado === esp.marcado && r.confere === esp.marcado;
  if (!passou) falhas++;

  console.log(
    ((passou ? 'OK    ' : 'FALHA ') + '   ' + id).padEnd(30),
    String(esp.marcado === null ? '(nao marca)' : esp.marcado).padEnd(12),
    ((r.marcado === null ? '-' : r.marcado) + ' / ' + (r.confere || '-')).padEnd(12),
    r.via || r.motivo || ''
  );
  if (!passou) console.log('           diag:', JSON.stringify(r.diag));
}

await nav.close();
console.log('-'.repeat(84));
console.log(falhas === 0 ? `TODOS OS ${CASOS.length} CASOS PASSARAM` : `${falhas} FALHA(S) de ${CASOS.length}`);
process.exit(falhas === 0 ? 0 : 1);
