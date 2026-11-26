/* Pre-flight da skill Aplicar Provador Virtual.
   Roda ANTES de qualquer ação em loja. Falhou, não aplica.

   node preflight.mjs [--url <url-do-produto>]                       */

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const S = join(AQUI, 'section');
let falhas = 0;

function checa(nome, fn) {
  try {
    const r = fn();
    console.log(`  ok    ${nome}${r ? '  ' + r : ''}`);
  } catch (e) {
    falhas++;
    console.log(`  FALHA ${nome}: ${e.message}`);
  }
}

// Aviso nao bloqueia: e coisa que so faz falta num passo especifico,
// e nao no de validar que a engine esta inteira.
function pula(nome, porque) {
  console.log(`  pulado ${nome}: ${porque}`);
}

function avisa(nome, fn, porque) {
  try {
    const r = fn();
    console.log(`  ok    ${nome}${r ? '  ' + r : ''}`);
  } catch {
    console.log(`  aviso ${nome}: ausente. ${porque}`);
  }
}

console.log('pre-flight: aplicar-provador-virtual\n');

checa('modulos da section presentes', () => {
  const req = [
    'bx-fit-dados.js', 'bx-fit-core.js', 'bx-fit-silhueta.js',
    'bx-fit-theme.js', 'bx-fit-ui.js', 'bx-fit-boot.js',
    'bx-fit.css', '_template.liquid',
  ];
  const falta = req.filter((f) => !existsSync(join(S, f)));
  if (falta.length) throw new Error('faltando ' + falta.join(', '));
  return `${req.length} arquivos`;
});

checa('nenhum modulo contem sintaxe Liquid', () => {
  const sujos = ['bx-fit-dados.js', 'bx-fit-core.js', 'bx-fit-silhueta.js',
    'bx-fit-theme.js', 'bx-fit-ui.js', 'bx-fit-boot.js', 'bx-fit.css']
    .filter((f) => /\{\{|\{%/.test(readFileSync(join(S, f), 'utf8')));
  if (sujos.length) throw new Error(sujos.join(', ') + ' tem {{ ou {%, o que quebraria a section');
  return '';
});

const temPlaywright = (() => {
  try {
    createRequire(import.meta.url).resolve('playwright');
    return true;
  } catch {
    return false;
  }
})();

checa('playwright instalado', () => {
  if (!temPlaywright) throw new Error('rode "npm install" nesta pasta (e o que baixa o navegador)');
  return '';
});

avisa('shopify CLI no PATH', () => {
  const v = execFileSync('shopify', ['version'], { encoding: 'utf8' }).trim();
  return v.split('\n')[0];
}, 'so faz falta na hora de subir a section pra loja; ler tabela e montar funcionam sem ele');

checa('nucleo de calculo passa nos testes', () => {
  execFileSync('node', [join(AQUI, 'teste', 'testar-nucleo.mjs')], { stdio: 'pipe' });
  return '21 casos';
});

if (!temPlaywright) {
  pula('adaptador de tema passa nos testes', 'depende do playwright');
} else {
  checa('adaptador de tema passa nos testes', () => {
    execFileSync('node', [join(AQUI, 'teste', 'testar-tema.mjs')], { stdio: 'pipe' });
    return 'Dawn, Shrine PRO, Vex TT';
  });
}

checa('section monta sem erro', () => {
  const out = execFileSync('node', [join(AQUI, 'montar.mjs')], { encoding: 'utf8' });
  const m = out.match(/([\d.]+) KB/);
  return m ? m[1] + ' KB' : '';
});

const iUrl = process.argv.indexOf('--url');
if (iUrl !== -1 && process.argv[iUrl + 1] && !temPlaywright) {
  console.log('\nnao da pra ler a tabela sem o playwright: rode "npm install" nesta pasta.');
} else if (iUrl !== -1 && process.argv[iUrl + 1]) {
  console.log('\nleitura da tabela do produto informado:');
  try {
    const out = execFileSync(
      'node', [join(AQUI, 'ler-tabela.mjs'), process.argv[iUrl + 1], '--json'],
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
    );
    const r = JSON.parse(out);
    if (!r.melhor) {
      falhas++;
      console.log('  FALHA nenhuma tabela de medidas legivel nesta PDP' +
        (r.soImagem ? ' (a loja publica a tabela como IMAGEM)' : ''));
    } else {
      const t = r.melhor;
      console.log(`  ok    tabela lida: ${t.tamanhos.length} tamanhos, medidas ${t.medidas.join(', ')}`);
      console.log(`        tipo=${t.tipo} unidade=${t.unidade} medicao=${t.medicao}`);
      for (const a of r.alertas || []) console.log(`  ATENCAO ${a.leitura}`);
      if (t.tipo === 'peca' && t.medicao === 'circunferencia') {
        console.log('        confirme com o lojista se a medida e a volta inteira ou a peca deitada');
      }
    }
  } catch (e) {
    falhas++;
    console.log('  FALHA nao consegui ler a PDP: ' + e.message.slice(0, 120));
  }
}

console.log('\n' + (falhas ? `${falhas} bloqueio(s): NAO aplicar em loja` : 'pre-flight limpo'));
process.exit(falhas ? 1 : 0);
