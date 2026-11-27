# Engine qa-funcional-compra (skill 71)

Pre-flight + endereços de teste por país pro smoke-test de compra (matriz 10 países × 7 checks).
A navegação é conduzida via Chrome Brain pela skill 71; aqui ficam validação de ambiente e os dados de teste.

```bash
node preflight.mjs --loja https://minhaloja.com --paises IT,DE,ES,FR,GB,PT,NL,BE,AT,CH
```

Dev store: pedido completo via Bogus Gateway. Loja live: ir até a tela de pagamento SEM concluir.
