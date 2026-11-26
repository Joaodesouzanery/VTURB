/* Testes do nucleo de calculo.
   Cobre os casos de borda que a critica de completude levantou:
   grade fora de ordem, grade nao monotonica, tamanho unico,
   nenhum tamanho adequado, medida estimada, classe de tecido.

   Rodar: node testar-nucleo.mjs                                   */

import D from '../section/bx-fit-dados.js';
globalThis.BXDados = D;
const { default: C } = await import('../section/bx-fit-core.js');

let ok = 0, falhas = [];
function t(nome, cond, obtido) {
  if (cond) { ok++; console.log('  OK    ' + nome); }
  else { falhas.push(nome); console.log('  FALHA ' + nome + '   obtido: ' + JSON.stringify(obtido)); }
}

/* tabela de peca, medida de busto por tamanho, em cm de circunferencia */
function tab(pares, tipo = 'peca') {
  return C.normalizarTabela({
    tipo, unidade: 'cm', medicao: 'circunferencia',
    tamanhos: pares.map(([tamanho, busto]) => ({ tamanho, busto })),
  });
}

console.log('\n== ordenacao da grade ==');
{
  // ordem digitada errada de proposito: M, PP, G, P
  const tb = tab([['M', 104], ['PP', 92], ['G', 108], ['P', 98]]);
  const g = C.ordenarGrade(tb.tamanhos, 'busto');
  t('ordena pela medida, nao pela ordem digitada',
    g.tamanhos.map(x => x.tamanho).join(',') === 'PP,P,M,G',
    g.tamanhos.map(x => x.tamanho));
  t('grade crescente e monotonica', g.monotonica === true, g);
}
{
  const tb = tab([['P', 98], ['M', 98], ['G', 108]]);   // P e M com a mesma medida
  const g = C.ordenarGrade(tb.tamanhos, 'busto');
  t('detecta grade que nao cresce', g.monotonica === false, g);
}

console.log('\n== vizinho de tamanho ==');
{
  const tb = tab([['M', 104], ['PP', 92], ['G', 108], ['P', 98]]);
  const r = C.recomendar({ busto: 90 }, tb, { id: 'generico' }, { caimento: 'regular' });
  // Com caimento regular (folga alvo 10 a 12,5 cm) um busto de 90 pede
  // peca de ~100 a 102,5: o M (104) cai melhor que o P (98). O que se
  // testa aqui e que os vizinhos saem da grade ORDENADA (PP,P,M,G),
  // e nao da ordem digitada (M,PP,G,P).
  t('acima e abaixo vem da grade ordenada, nao da ordem digitada',
    r.ok && r.tamanho === 'M' && r.abaixo === 'P' && r.acima === 'G',
    { tam: r.tamanho, abaixo: r.abaixo, acima: r.acima });
}
{
  const tb = tab([['P', 98], ['M', 98], ['G', 108]]);
  const r = C.recomendar({ busto: 90 }, tb, { id: 'generico' }, {});
  t('grade nao monotonica desliga a sugestao de vizinho',
    r.ok && r.abaixo === null && r.acima === null && !!r.grade.aviso,
    { abaixo: r.abaixo, acima: r.acima, aviso: r.grade.aviso });
}

console.log('\n== tamanho unico ==');
{
  const tb = tab([['Único', 100]]);
  const r = C.recomendar({ busto: 88 }, tb, { id: 'generico' }, {});
  t('tamanho unico devolve resposta binaria, nao ranking',
    r.ok && r.tamanhoUnico === true && typeof r.serve === 'boolean',
    r);
}

console.log('\n== nenhum tamanho serve ==');
{
  // tecido plano declarado, corpo bem maior que a maior peca
  const tb = tab([['P', 88], ['M', 92], ['G', 96]]);
  const r = C.recomendar({ busto: 120 }, tb, { id: 'generico' }, { tecido: 'plano' });
  t('em tecido plano, corpo maior que a grade nao vira recomendacao',
    r.ok === false && r.motivo === 'sem tamanho adequado',
    { ok: r.ok, motivo: r.motivo });
  t('e diz em centimetros o que faltou',
    Array.isArray(r.detalhe) && r.detalhe.length > 0,
    r.detalhe);
}
{
  // mesma situacao, mas sem declarar tecido: nao aplica piso
  const tb = tab([['P', 88], ['M', 92], ['G', 96]]);
  const r = C.recomendar({ busto: 120 }, tb, { id: 'generico' }, {});
  t('sem classe de tecido declarada o piso NAO dispara',
    r.ok === true, { ok: r.ok, motivo: r.motivo });
}
{
  // malha declarada: a folga negativa e legitima
  const tb = tab([['P', 88], ['M', 92], ['G', 96]]);
  const r = C.recomendar({ busto: 100 }, tb, { id: 'generico' }, { tecido: 'compressao' });
  t('compressao aceita peca menor que o corpo', r.ok === true, { ok: r.ok, tam: r.tamanho });
}

console.log('\n== confianca ==');
{
  const tb = C.normalizarTabela({
    tipo: 'peca', unidade: 'cm', medicao: 'circunferencia',
    tamanhos: [
      { tamanho: 'P', busto: 96, cintura: 80, quadril: 100 },
      { tamanho: 'M', busto: 102, cintura: 86, quadril: 106 },
      { tamanho: 'G', busto: 108, cintura: 92, quadril: 112 },
    ],
  });
  const medido = C.recomendar({ busto: 92, cintura: 78, quadril: 96 }, tb, { id: 'generico' }, {});
  const estimado = C.recomendar(
    { busto: 92, cintura: 78, quadril: 96, _estimadas: ['busto', 'quadril'] },
    tb, { id: 'generico' }, {}
  );
  t('medida informada pode chegar a confianca alta', medido.confianca === 'alta', medido.confianca);
  t('medida estimada nunca chega a alta', estimado.confianca !== 'alta', estimado.confianca);
}

console.log('\n== conversoes ==');
{
  t('medida deitada dobra', (() => {
    const x = C.normalizarTabela({ tipo: 'peca', unidade: 'cm', medicao: 'deitada', tamanhos: [{ tamanho: 'M', busto: 52 }] });
    return x.tamanhos[0].medidas.busto.min === 104;
  })(), null);
  t('comprimento NAO dobra quando deitado', (() => {
    const x = C.normalizarTabela({ tipo: 'peca', unidade: 'cm', medicao: 'deitada', tamanhos: [{ tamanho: 'M', comprimento: 70 }] });
    return x.tamanhos[0].medidas.comprimento.min === 70;
  })(), null);
  t('polegada vira cm', (() => {
    const x = C.normalizarTabela({ tipo: 'peca', unidade: 'in', medicao: 'circunferencia', tamanhos: [{ tamanho: 'M', busto: 40 }] });
    return Math.abs(x.tamanhos[0].medidas.busto.min - 101.6) < 0.01;
  })(), null);
}

console.log('\n== estimativa de corpo ==');
{
  // Bozeman 2012, mulher: confere contra a propria equacao
  const c = { altura: 165, peso: 65, idade: 30, sexo: 'f' };
  const imcBruto = D.imc(65, 165);
  const imc = imcBruto + D.viesAutoRelato(imcBruto);
  const esperado = 28.81919 + 2.218007 * imc;      // <35 anos: sem termo de idade
  const obtido = D.estimativa.f.cintura(c);
  t('Bozeman mulher reproduz a equacao', Math.abs(obtido - esperado) < 0.001, { obtido, esperado });

  const chance = D.chanceFaixa(D.erroEstimativa.cintura);
  t('chance de cair na faixa certa fica perto de 28,8%',
    Math.abs(chance - 0.288) < 0.02, (chance * 100).toFixed(1) + '%');
}

console.log('\n== formato do corpo (FFIT) ==');
{
  t('pera', D.classificarFormato(88, 74, 104) === 'pera', D.classificarFormato(88, 74, 104));
  t('triangulo invertido', D.classificarFormato(104, 80, 90) === 'trianguloInverso', D.classificarFormato(104, 80, 90));
  t('retangulo', D.classificarFormato(92, 84, 94) === 'retangulo', D.classificarFormato(92, 84, 94));
  t('oval', D.classificarFormato(100, 108, 104) === 'oval', D.classificarFormato(100, 108, 104));
}

console.log('\n' + '-'.repeat(60));
console.log(falhas.length === 0 ? `TODOS OS ${ok} TESTES PASSARAM` : `${falhas.length} FALHA(S) de ${ok + falhas.length}`);
process.exit(falhas.length ? 1 : 0);
