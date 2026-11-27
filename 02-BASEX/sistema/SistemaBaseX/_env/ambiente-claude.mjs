// Prepara a pasta "Ambiente Claude", ao lado do SistemaBaseX: e ela, e nao o
// SistemaBaseX, que a aula conecta na aba Code. Copia para la o agente, os comandos,
// as regras e as permissoes do pacote, escreve o CLAUDE.md com o endereco do sistema
// e grava esse endereco no settings.local.json da pasta. Chamado pelos instaladores
// do Mac e do Windows a cada instalacao. Imprime o caminho da pasta preparada.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dot = path.join(path.dirname(raiz), 'Ambiente Claude', '.claude');
const ler = (...p) => fs.readFileSync(path.join(...p), 'utf8');

fs.mkdirSync(dot, { recursive: true });
fs.cpSync(path.join(raiz, '.claude'), dot, {
  recursive: true,
  filter: (src) => path.basename(src) !== 'settings.local.json',
});

const cabeca = ler(raiz, '_env', 'ambiente-claude.md').replaceAll('{{SISTEMA}}', raiz).trimEnd();
fs.writeFileSync(path.join(dot, 'CLAUDE.md'), `${cabeca}\n\n${ler(raiz, 'CLAUDE.md')}`);

// O app grava ali o "sim, e nao perguntar de novo" do aluno: mesclar, nunca sobrescrever.
const local = path.join(dot, 'settings.local.json');
let cfg = {};
if (fs.existsSync(local)) {
  try { cfg = JSON.parse(fs.readFileSync(local, 'utf8')); }
  catch { fs.copyFileSync(local, `${local}.ilegivel`); }
}
const antigo = cfg.env?.BASEX_ARQUIVO;
cfg.env = { ...cfg.env, BASEX_ARQUIVO: raiz };
cfg.permissions = { ...cfg.permissions };
cfg.permissions.additionalDirectories = [
  raiz,
  ...(cfg.permissions.additionalDirectories ?? []).filter((d) => d !== raiz && d !== antigo),
];
// As regras Edit(Minhas Lojas/**) e Edit(06. Saidas/**) do pacote sao relativas a pasta
// aberta; daqui, valem pelo caminho absoluto, no formato POSIX que o Claude Code usa
// para comparar (no Windows, C:\SistemaBaseX vira /c/SistemaBaseX).
const posix = (p) => p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);
const edicao = (p) => ['Minhas Lojas', '06. Saídas'].map((pasta) => `Edit(/${posix(p)}/${pasta}/**)`);
const velhas = antigo && antigo !== raiz ? edicao(antigo) : [];
cfg.permissions.allow = [
  ...new Set([...(cfg.permissions.allow ?? []).filter((r) => !velhas.includes(r)), ...edicao(raiz)]),
];
fs.writeFileSync(local, `${JSON.stringify(cfg, null, 2)}\n`);

console.log(path.dirname(dot));
