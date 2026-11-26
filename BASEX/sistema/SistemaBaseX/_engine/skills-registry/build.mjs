#!/usr/bin/env node
// _engine/skills-registry/build.mjs
// Constrói _brain/skills-registry.md varrendo 03. Skills/ e extraindo o frontmatter de cada skill.
// Raiz do SistemaBaseX: variavel BASEX_ARQUIVO, ou a pasta que contem este _engine/.
// Usado por basex-master pra descobrir TODAS as skills automaticamente, sem hardcode.
//
// Uso:
//   node _engine/skills-registry/build.mjs
//   node _engine/skills-registry/build.mjs --dry-run
//
// Gates:
//   1. Skill com tipo: skill DEVE ter triggers (avisa se não tem)
//   2. Skill DEVE ter complexidade (avisa se não tem)
//   3. Detecta skills duplicadas por número (avisa)
//   4. Detecta orfãs: skills no disco que ainda não foram indexadas

import { readdir, readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// Vault = raiz onde este script vive (_engine/skills-registry/ -> sobe 2 niveis).
// Funciona em qualquer maquina (Windows/Mac), ja que o script sincroniza dentro do SistemaBaseX.
// Override opcional: variavel de ambiente BASEX_ARQUIVO.
const VAULT = process.env.BASEX_ARQUIVO || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
if (!existsSync(join(VAULT, '03. Skills'))) {
  console.error('FAIL: Arquivo nao detectado em "' + VAULT + '" (03. Skills/ ausente). Defina BASEX_ARQUIVO.');
  process.exit(1);
}
const TASKS_DIR = join(VAULT, '03. Skills');
const REGISTRY_PATH = join(VAULT, '_brain', 'skills-registry.md');

const DRY_RUN = process.argv.includes('--dry-run');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  const lines = match[1].split('\n');
  let currentKey = null;
  let currentArr = null;
  for (const line of lines) {
    const kvMatch = line.match(/^([a-z_]+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const val = kvMatch[2].trim();
      currentArr = null;
      if (val === '') {
        currentKey = key;
        fm[key] = [];
        currentArr = fm[key];
      } else if (val.startsWith('[') && val.endsWith(']')) {
        // Lista na mesma linha (triggers: ["a", "b"]). Antes virava texto e a skill saia do
        // roteamento calada: a 122 tinha 7 gatilhos e aparecia "sem triggers" (10/11/2026).
        fm[key] = [...val.slice(1, -1).matchAll(/"([^"]*)"|'([^']*)'|([^,\s][^,]*)/g)]
          .map((m) => (m[1] ?? m[2] ?? m[3]).trim()).filter(Boolean);
        currentKey = null;
      } else {
        fm[key] = val.replace(/^["']|["']$/g, '');
        currentKey = null;
      }
    } else if (currentArr !== null) {
      const itemMatch = line.match(/^\s*-\s*(.*)$/);
      if (itemMatch) {
        currentArr.push(itemMatch[1].trim().replace(/^["']|["']$/g, ''));
      } else if (line.trim() === '') {
        // skip blank
      } else {
        currentArr = null;
      }
    }
  }
  return fm;
}

function isExecutable(complexidade) {
  return ['scriptada', 'composta', 'orquestracao'].includes(complexidade);
}

async function main() {
  const files = (await readdir(TASKS_DIR))
    .filter(f => f.endsWith('.md'))
    .filter(f => !f.includes('backup'))
    .filter(f => !f.includes('(legado)'))
    .filter(f => f !== 'README.md')
    .sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)?.[1] || '999', 10);
      const numB = parseInt(b.match(/^(\d+)/)?.[1] || '999', 10);
      return numA - numB;
    });

  const skills = [];
  const warnings = [];

  for (const file of files) {
    const fullPath = join(TASKS_DIR, file);
    const content = await readFile(fullPath, 'utf8');
    const fm = parseFrontmatter(content);
    if (!fm) {
      warnings.push(`SEM FRONTMATTER: ${file}`);
      continue;
    }

    const numMatch = file.match(/^(\d+[a-z]?)\.\s*(.+)\.md$/);
    const num = numMatch?.[1] || '?';
    const titulo = numMatch?.[2] || file;

    const skill = {
      arquivo: file,
      nota: file.replace(/\.md$/, ''),
      num,
      titulo,
      tipo: fm.tipo || '?',
      area: fm.area || '?',
      complexidade: fm.complexidade || '?',
      slug: fm.slug || null,
      squad: fm.squad || null,
      triggers: Array.isArray(fm.triggers) ? fm.triggers : [],
      aliases: Array.isArray(fm.aliases) ? fm.aliases : [],
      output: fm.output || '',
      atualizado: fm.atualizado || '',
      tem_engine: false,
      tem_preflight: false,
      executavel: isExecutable(fm.complexidade),
    };

    // O campo motor no frontmatter e a fonte de verdade. Adivinhar a pasta pelo
    // slug erra sempre que o nome da skill e o do motor divergem.
    const pastaMotor = (fm.motor && fm.motor !== 'nenhum') ? fm.motor : fm.slug;
    skill.motor = (fm.motor && fm.motor !== 'nenhum') ? fm.motor : null;

    if (pastaMotor) {
      try {
        const enginePath = join(VAULT, '_engine', pastaMotor);
        const enginestat = await stat(enginePath);
        if (enginestat.isDirectory()) {
          skill.tem_engine = true;
          // O motor concorrente traz o pre-voo em Python; so procurar o .mjs avisava "sem pre-voo" em 136 a 138.
          for (const [arq, roda] of [['preflight.mjs', 'node'], ['preflight.py', 'python3']]) {
            if (existsSync(join(enginePath, arq))) { skill.tem_preflight = true; skill.preflight = `${roda} _engine/${pastaMotor}/${arq}`; break; }
          }
        }
      } catch {}
    }

    if (skill.tipo === 'skill' && skill.triggers.length === 0) {
      warnings.push(`SEM TRIGGERS: ${file}`);
    }
    if (skill.tipo === 'skill' && skill.complexidade === '?') {
      warnings.push(`SEM COMPLEXIDADE: ${file}`);
    }
    // So avisa quando a skill TEM motor e o motor nao tem pre-voo. Skill de
    // raciocinio nao roda script nenhum, entao cobrar pre-voo dela e ruido.
    if (skill.tem_engine && !skill.tem_preflight) {
      warnings.push(`MOTOR SEM PRE-VOO: ${file} (motor=${skill.motor || skill.slug})`);
    }

    skills.push(skill);
  }

  const byNum = {};
  for (const s of skills) {
    const numKey = s.num.replace(/[a-z]/g, '');
    if (!byNum[numKey]) byNum[numKey] = [];
    byNum[numKey].push(s.arquivo);
  }
  for (const [num, list] of Object.entries(byNum)) {
    if (list.length > 1) {
      warnings.push(`NÚMERO DUPLICADO ${num}: ${list.join(' + ')}`);
    }
  }

  let md = `---
tipo: registry
nome: "Skills Registry"
descricao: "Índice canônico de todas as skills em 03. Skills/. Gerado automaticamente pelo engine skills-registry. NÃO EDITE À MÃO."
gerado_em: ${new Date().toISOString()}
gerado_por: "_engine/skills-registry/build.mjs"
total_skills: ${skills.length}
---

# Skills Registry — Índice Canônico

> Este arquivo é a **fonte de verdade** que o basex-master consulta pra descobrir skills.
> Gerado automaticamente por \`_engine/skills-registry/build.mjs\`.
> **Não edite manualmente.** Pra regenerar: \`node _engine/skills-registry/build.mjs\`.

## Estatísticas

- **Total de skills:** ${skills.length}
- **Executáveis (rodam passo a passo):** ${skills.filter(s => s.executavel).length}
- **Com motor próprio:** ${skills.filter(s => s.tem_engine).length}
- **Com pré-voo:** ${skills.filter(s => s.tem_preflight).length}
- **IA-baseadas:** ${skills.filter(s => s.complexidade === 'ia').length}
- **Compostas (multi-fase):** ${skills.filter(s => s.complexidade === 'composta').length}

## Skills

| # | Titulo | Squad | Tipo | Complex | Slug/Engine | Pre-flight |
|---|---|---|---|---|---|---|
${skills.map(s => `| ${s.num} | [[${s.nota}\\|${s.titulo}]] | ${s.squad || '—'} | ${s.tipo} | ${s.complexidade} | ${s.slug || '—'} | ${s.tem_preflight ? '✓' : '—'} |`).join('\n')}

## Squads

> Nome de squad é vocabulário de reconhecimento, não comando. O aluno fala em português e o basex-master roteia pelos triggers abaixo. Quando ele diz só o nome do squad, o agente LISTA as skills e pergunta qual, nunca executa sozinho.

${(() => {
  const porSquad = {};
  for (const s of skills) {
    const k = s.squad || 'Avulsas';
    (porSquad[k] = porSquad[k] || []).push(s);
  }
  const nomes = Object.keys(porSquad).sort((a, b) => {
    if (a === 'Avulsas') return 1;
    if (b === 'Avulsas') return -1;
    return a.localeCompare(b, 'pt-BR');
  });
  return nomes.map(nome => {
    const lista = porSquad[nome];
    const triggers = lista.flatMap(s => s.triggers);
    const cabeca = nome === 'Avulsas'
      ? `### Avulsas

> Não formam um squad. São skills que se chamam direto pelo que fazem.`
      : `### ${nome}`;
    return `${cabeca}

**Skills:** ${lista.map(s => `[[${s.nota}|${s.titulo}]]`).join(' · ')}

**Reconhece por:** ${triggers.length ? triggers.map(t => `\`${t}\``).join(' · ') : '_(nenhum trigger declarado)_'}`;
  }).join('\n\n');
})()}

## Triggers (auto-routing)

> Quando frase do usuário casa com um trigger abaixo, basex-master invoca a skill correspondente sem pedir confirmação.

${skills.filter(s => s.triggers.length > 0).map(s => `
### [[${s.nota}|${s.titulo}]] (${s.complexidade})

${s.triggers.map(t => `- \`${t}\``).join('\n')}
${s.aliases.length > 0 ? '\n**Aliases:** ' + s.aliases.map(a => `\`${a}\``).join(', ') : ''}
`).join('\n')}

## Skills sem triggers (consulta manual)

${skills.filter(s => s.triggers.length === 0).map(s => `- [[${s.nota}|${s.titulo}]] (${s.tipo}/${s.complexidade})`).join('\n') || '_(nenhuma)_'}

## Avisos (regenerar quando corrigido)

${warnings.length > 0 ? warnings.map(w => `- ⚠️ ${w}`).join('\n') : '_(sem avisos)_'}

## Como o basex-master usa este registry

1. **Inicialização silenciosa:** lê este arquivo a cada conversa
2. **Auto-routing Tipo B:** compara mensagem do usuário com triggers
3. **Pre-flight:** se a skill tem motor, roda o pré-voo dele antes (\`_engine/{motor}/preflight.mjs\` ou \`preflight.py\`, o que existir)
4. **Reconciliação:** se skill no disco não tá no registry, regenera registry automaticamente

## Regeneração

Executado automaticamente em:
- Final do fluxo de criação de skill (Gate 22 — Atualizar Registry)
- Iteração de skill existente (qualquer mudança em \`03. Skills/*.md\`)
- Comando manual: \`node _engine/skills-registry/build.mjs\`

`;

  if (DRY_RUN) {
    console.log('[DRY-RUN] Registry seria gravado em:', REGISTRY_PATH);
    console.log(`[DRY-RUN] Total skills: ${skills.length}`);
    console.log(`[DRY-RUN] Avisos: ${warnings.length}`);
    warnings.forEach(w => console.log(`  ⚠️ ${w}`));
    console.log(`[DRY-RUN] Primeiras linhas do output:\n${md.split('\n').slice(0, 30).join('\n')}`);
    return;
  }

  await writeFile(REGISTRY_PATH, md, 'utf8');

  // Comando por skill. Os escritos a mao trazem o passo a passo real do motor e
  // sao melhores que qualquer gerado, entao nunca sao sobrescritos: so nasce
  // comando para skill que ainda nao tem um.
  const CMD_DIR = join(VAULT, '.claude', 'commands');
  await mkdir(CMD_DIR, { recursive: true });
  let criados = 0, mantidos = 0;
  for (const sk of skills) {
    if (sk.tipo !== 'skill' || !sk.slug) continue;
    const destino = join(CMD_DIR, `${sk.slug}.md`);
    try { await stat(destino); mantidos++; continue; } catch {}
    const linha1 = (sk.output || sk.titulo).replace(/\n/g, ' ').slice(0, 300);
    const motorTxt = sk.motor
      ? `\n\nO motor desta skill e \`_engine/${sk.motor}/\`. Leia o README dele antes de rodar qualquer comando, e use os comandos que estao la, nao os de memoria.${sk.tem_preflight ? `\n\nPre-voo obrigatorio: \`${sk.preflight}\`. Se sair com codigo diferente de zero, mostre os FAIL e pare.` : ''}`
      : '\n\nEsta skill nao tem motor: e raciocinio guiado. Siga o passo a passo do arquivo da skill.';
    const corpo = `---
description: ${linha1}
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Execute a skill "${sk.titulo}". Fonte: \`03. Skills/${sk.arquivo}\`.

Leia o arquivo da skill inteiro antes de agir. Ele traz o que precisa estar instalado, o passo a passo e onde a skill costuma errar.${motorTxt}

Fale com o dono da loja em portugues, em segunda pessoa. Se a intencao dele puder significar duas coisas, pergunte em vez de adivinhar.
`;
    await writeFile(destino, corpo, 'utf8');
    criados++;
  }
  console.log(`OK Comandos: ${criados} criados, ${mantidos} mantidos como estavam`);

  console.log(`OK Registry gerado: ${REGISTRY_PATH}`);
  console.log(`   Total skills: ${skills.length}`);
  console.log(`   Executáveis: ${skills.filter(s => s.executavel).length}`);
  console.log(`   Com motor: ${skills.filter(s => s.tem_engine).length}`);
  console.log(`   Com pre-flight: ${skills.filter(s => s.tem_preflight).length}`);
  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} aviso(s):`);
    warnings.forEach(w => console.log(`   - ${w}`));
  }

}

main().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
