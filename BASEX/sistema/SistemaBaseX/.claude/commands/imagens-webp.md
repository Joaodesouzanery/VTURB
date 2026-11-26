---
description: Converte imagens (PNG, JPG, TIFF, HEIC, BMP, GIF) para WebP com Pillow, em arquivo único ou pasta inteira, e imprime a tabela de redução. Imagem que ficar maior em WebP é mantida no original e nunca apagada.
argument-hint: <pasta-ou-arquivo> [--quality=80] [--replace] [--recursive]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Execute a skill "Converter Imagens para WebP". Fonte: `03. Skills/15. Converter Imagens para WebP.md`.

Pré-voo obrigatório, antes de qualquer conversão:

```bash
node "_engine/imagens-webp/preflight.mjs" "<pasta-ou-arquivo>"
```

Se sair com código diferente de zero, mostrar os FAIL e parar. O mais comum é o Pillow não estar instalado: `pip3 install --user Pillow`.

Depois:

```bash
python3 "_engine/imagens-webp/convert.py" "<caminho>" --quality=80
```

NON-NEGOTIABLE: `--replace` apaga os originais, então SEMPRE rodar `--dry-run` antes e mostrar ao dono o que seria apagado. A engine já protege o caso da imagem que fica maior em WebP (descarta o webp, mantém o original, escreve `mantido` na tabela), mas isso não substitui o dry-run. Nunca converter em cima da pasta de assets de um tema sem cópia.
