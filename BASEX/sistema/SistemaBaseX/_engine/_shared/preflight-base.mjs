// Base compartilhada dos pre-voos. Um lugar so para o formato do relatorio,
// para as checagens que se repetem e para o codigo de saida.
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export function criar(nome) {
  const checks = [];
  return {
    check(rotulo, ok, extra = '') { checks.push({ rotulo, ok: !!ok, extra }); return ok; },

    arquivo(rotulo, caminho) { return this.check(rotulo, existsSync(caminho), caminho); },

    comando(rotulo, bin, args = ['--version'], dica = '') {
      let ok = false;
      try { execFileSync(bin, args, { stdio: 'pipe' }); ok = true; } catch {}
      return this.check(rotulo, ok, ok ? '' : dica);
    },

    node(minimo) {
      const maior = Number(process.versions.node.split('.')[0]);
      return this.check(`Node ${minimo} ou mais novo`, maior >= minimo,
        `voce esta no ${process.versions.node}` + (maior >= minimo ? '' : ` · instale o Node ${minimo}`));
    },

    fechar(recado = 'Pode rodar.') {
      console.log(`\n=== Pre-voo: ${nome} ===\n`);
      let bloqueios = 0;
      for (const c of checks) {
        console.log(`[${c.ok ? 'OK' : 'FAIL'}]   ${c.rotulo}${c.extra ? '  (' + c.extra + ')' : ''}`);
        if (!c.ok) bloqueios++;
      }
      if (bloqueios) {
        console.error(`\n${bloqueios} bloqueio(s). Resolva antes de rodar.`);
        process.exit(1);
      }
      console.log(`\n${recado}`);
    },
  };
}

export const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
