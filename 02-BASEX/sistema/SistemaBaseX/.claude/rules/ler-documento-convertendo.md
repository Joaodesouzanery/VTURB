# Converter documento antes de ler

> Vale para toda sessão.
> Comportamento AUTOMÁTICO: não depende do usuário pedir nem de invocar a skill. Motivo: economia de token.

## Regra (automática, sem invocação)

**Sempre que um documento entra na conversa para ser lido, analisado, resumido, traduzido ou ter conteúdo extraído, o agente DEVE, por conta própria, convertê-lo com o MarkItDown para Markdown ANTES de ler, e ler o `.md` gerado no lugar do arquivo cru.**

Isso vale mesmo que o usuário NÃO chame `/markitdown` nem mencione a skill. É comportamento padrão, disparado pela simples presença de um documento.

Formatos cobertos: **PDF, Word (DOCX), Excel (XLSX/XLS), PowerPoint (PPTX), imagens (com OCR + EXIF), áudio (com transcrição), HTML, CSV, JSON, XML, ZIP, EPub, e URLs do YouTube (transcrição).**

Por quê: ler o binário cru gasta muito mais token (ou é impossível). O MarkItDown entrega Markdown limpo preservando títulos, tabelas, listas e links.

## Gatilho (quando dispara sozinho)

Dispara automaticamente quando qualquer um destes aparece:
- Um caminho de arquivo de formato suportado é mencionado ou anexado (`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.png/.jpg`, `.mp3/.wav`, `.html`, `.csv`, `.epub`, `.zip`).
- O usuário manda um documento e pede qualquer coisa sobre o conteúdo ("resume", "o que diz aqui", "extrai", "traduz", "analisa esse arquivo").
- Uma URL do YouTube que precisa de transcrição.

## Como (procedimento padrão)

```bash
# 1. Garante que está instalado (o instalador da BaseX já instala; isto cobre a máquina em que faltou)
python3 -c "import markitdown" 2>/dev/null || python3 -m pip install --user 'markitdown[all]'

# 2. Converte para Markdown (o original fica onde está); como módulo, roda mesmo fora do PATH
python3 -m markitdown "<arquivo>" -o "06. Saídas/convertidos/<nome>.md"

# 3. Lê o .md gerado (NUNCA o binário cru)
```

Depois: usar a ferramenta Read no `.md`. Se o formato não for suportado, leia pelo meio que houver e diga que leu assim.

O MarkItDown pede Python 3.10 ou mais novo. Se a instalação falhar por isso (o python3 que vem com o Mac é o 3.9), leia o PDF direto pela ferramenta de leitura e siga: é limitação da máquina, não problema do material.

## Exceções (quando NÃO converter)

- O arquivo já é texto puro: `.md`, `.txt`, código-fonte, `.log`, `.yaml`, `.json` pequeno legível. Ler direto.
- Formato não suportado pelo MarkItDown: ler pelo meio disponível.
- Imagem ou áudio: o MarkItDown usa OCR/transcrição, então marcar no resultado que o texto veio de OCR ou transcrição (pode conter erro).

## Anti-Patterns (FORBIDDEN)

- Ler PDF/DOCX/XLSX/PPTX cru com Read quando o MarkItDown converteria.
- Esperar o usuário pedir para converter, ou pedir que ele invoque `/markitdown`. É automático.
- Pedir ao usuário para colar o conteúdo de um documento que dá para converter.
- Deixar de instalar o MarkItDown quando falta (`pip install 'markitdown[all]'`).
- Gastar token processando o binário quando o Markdown limpo resolve.

## Enforcement

NON-NEGOTIABLE. Ler documento cru quando o MarkItDown cobre o formato é desperdício de token e falha de qualidade. O comportamento é automático: a presença do documento basta para disparar a conversão.
