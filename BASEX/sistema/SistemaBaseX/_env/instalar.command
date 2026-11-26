#!/bin/bash
# ============================================================================
# BaseX — instalador do ambiente (macOS)
#
# Dois cliques neste arquivo. Ele confere o que a sua maquina ja tem, instala o
# que falta e diz exatamente qual e o proximo passo. Nao pede senha a nao ser
# que precise instalar alguma coisa de verdade.
# ============================================================================
# Acha a raiz do material subindo ate encontrar a pasta _engine. Assim o arquivo
# funciona tanto na raiz quanto dentro de _env, e nao quebra se alguem mover ele.
RAIZ="$(cd "$(dirname "$0")" && pwd)"
for _ in 1 2 3; do
  [ -d "$RAIZ/_engine" ] && break
  RAIZ="$(dirname "$RAIZ")"
done
if [ ! -d "$RAIZ/_engine" ]; then
  printf "\n  Nao achei o material da BaseX a partir daqui.\n"
  printf "  Este arquivo precisa ficar dentro da pasta que voce descompactou.\n\n"
  read -r -p "  Enter para sair "
  exit 1
fi
cd "$RAIZ" || exit 1

V='\033[0;32m'; A='\033[0;33m'; R='\033[0;31m'; C='\033[0;36m'; N='\033[0m'; B='\033[1m'
ok(){    printf "  ${V}ok${N}     %-24s %s\n" "$1" "$2"; }
falta(){ printf "  ${R}falta${N}  %-24s %s\n" "$1" "$2"; }
aviso(){ printf "  ${A}aviso${N}  %-24s %s\n" "$1" "$2"; }

FALTOU=0
INSTALAR=()

clear
printf "\n${B}  BaseX · instalacao do ambiente${N}\n"
printf "  ${C}%s${N}\n\n" "$RAIZ"

# ── 1. o que a maquina ja tem ───────────────────────────────────────────────
printf "${B}  Conferindo a sua maquina${N}\n\n"

if command -v node >/dev/null 2>&1; then
  NV=$(node -v | tr -d 'v'); NMAJ=${NV%%.*}
  if [ "$NMAJ" -ge 22 ]; then ok "Node" "v$NV"
  else falta "Node" "v$NV e velho demais, precisa da 22 ou mais nova"; INSTALAR+=(node); FALTOU=1; fi
else
  falta "Node" "nao encontrado"; INSTALAR+=(node); FALTOU=1
fi

if command -v python3 >/dev/null 2>&1; then
  ok "Python" "$(python3 -V 2>&1 | cut -d' ' -f2)"
  if python3 -c "import PIL" 2>/dev/null; then ok "Pillow" "biblioteca de imagem"
  else falta "Pillow" "falta a biblioteca de imagem do Python"; INSTALAR+=(pillow); FALTOU=1; fi
  # MarkItDown converte PDF, Word e planilha para o Claude ler (regra ler-documento-convertendo).
  # Pede Python 3.10 ou mais novo, e o python3 que vem com o Mac e o 3.9: ai so avisa.
  if python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" 2>/dev/null; then
    if python3 -c "import markitdown" 2>/dev/null; then ok "Conversor de documento" "PDF e Word viram texto para o Claude"
    else falta "Conversor de documento" "le PDF, Word e planilha para o Claude"; INSTALAR+=(markitdown); FALTOU=1; fi
  else
    aviso "Conversor de documento" "pede Python 3.10 ou mais novo; o Claude le PDF direto ate la"
  fi
else
  falta "Python" "nao encontrado"; INSTALAR+=(python); FALTOU=1
fi

if command -v shopify >/dev/null 2>&1; then ok "Shopify CLI" "$(shopify version 2>/dev/null | head -1)"
else falta "Shopify CLI" "e por onde o Claude fala com a sua loja"; INSTALAR+=(shopify); FALTOU=1; fi

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$CHROME" ]; then ok "Google Chrome" "desenha logo, wireframe e print"
else falta "Google Chrome" "baixe em google.com/chrome"; FALTOU=1; fi

if command -v claude >/dev/null 2>&1; then ok "Claude Code" "$(claude --version 2>/dev/null | head -1)"
else aviso "Claude Code" "nao achei o comando; se voce usa o aplicativo do Claude, esta tudo certo"; fi

# ── 2. o pack esta inteiro? ─────────────────────────────────────────────────
printf "\n${B}  Conferindo o material${N}\n\n"

conta(){ ls -1 "$1" 2>/dev/null | wc -l | tr -d ' '; }
NSK=$(conta "$RAIZ/03. Skills"); NEN=$(ls -d "$RAIZ/_engine"/*/ 2>/dev/null | wc -l | tr -d ' ')
NCM=$(conta "$RAIZ/.claude/commands")

[ "$NSK" -gt 0 ] && ok "Skills" "$NSK" || { falta "Skills" "a pasta 03. Skills veio vazia"; FALTOU=1; }
[ "$NEN" -gt 0 ] && ok "Motores" "$NEN" || { falta "Motores" "a pasta _engine veio vazia"; FALTOU=1; }
[ -f "$RAIZ/.claude/agents/basex-master.md" ] && ok "Agente BX Mestre" "instalado" || {
  falta "Agente BX Mestre" "a pasta .claude nao veio junto"
  printf "\n  ${A}Isso acontece quando o material e baixado como PASTA do Drive:${N}\n"
  printf "  o Drive nao leva pastas ocultas. Baixe o arquivo .zip e descompacte.\n\n"
  FALTOU=1; }
[ "$NCM" -gt 0 ] && ok "Comandos" "$NCM" || falta "Comandos" "a pasta .claude/commands veio vazia"

# ── 3. instalar o que falta ─────────────────────────────────────────────────
if [ ${#INSTALAR[@]} -gt 0 ]; then
  printf "\n${B}  Posso instalar o que falta${N}\n\n"
  for i in "${INSTALAR[@]}"; do printf "    · %s\n" "$i"; done
  printf "\n  Instalar agora? [s/N] "
  read -r RESP
  if [ "$RESP" = "s" ] || [ "$RESP" = "S" ]; then
    if ! command -v brew >/dev/null 2>&1; then
      printf "\n  Instalando o Homebrew, o gerenciador que baixa o resto.\n"
      printf "  Ele vai pedir a sua senha do Mac.\n\n"
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || true
      for c in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$c" ] && eval "$($c shellenv)"; done
    fi
    for i in "${INSTALAR[@]}"; do
      case "$i" in
        node)    printf "\n  Instalando Node...\n";       brew install node ;;
        python)  printf "\n  Instalando Python...\n";     brew install python ;;
        pillow)  printf "\n  Instalando Pillow...\n";     python3 -m pip install --user --quiet Pillow ;;
        # o Python do Homebrew recusa --user sozinho (PEP 668); a segunda tentativa passa por cima
        markitdown) printf "\n  Instalando o conversor de documento...\n"
                 python3 -m pip install --user --quiet 'markitdown[all]' 2>/dev/null \
                   || python3 -m pip install --user --quiet --break-system-packages 'markitdown[all]' ;;
        shopify) printf "\n  Instalando Shopify CLI...\n"; npm install -g @shopify/cli ;;
      esac
    done
    printf "\n  ${V}Pronto. Feche esta janela e clique de novo neste arquivo para conferir.${N}\n\n"
    read -r -p "  Enter para sair "
    exit 0
  fi
fi

# ── 3b. motores que pedem pacote extra ──────────────────────────────────────
printf "\n${B}  Motores que pedem um pacote a mais${N}\n\n"

if command -v node >/dev/null 2>&1; then
  # xlsx e leve e cabe instalar sem perguntar
  if [ -d "$RAIZ/_engine/analisar-operacao" ] && [ ! -d "$RAIZ/_engine/analisar-operacao/node_modules" ]; then
    printf "  instalando o leitor de planilha do Analisar Operacao...\n"
    (cd "$RAIZ/_engine/analisar-operacao" && npm install --silent --no-audit --no-fund >/dev/null 2>&1) \
      && ok "Analisar Operacao" "pronto" || aviso "Analisar Operacao" "npm install falhou, rode na mao na pasta do motor"
  else
    ok "Analisar Operacao" "pronto"
  fi

  # playwright baixa um navegador inteiro, entao pergunta antes
  PW=0
  for m in aplicar-provador-virtual baixar-assets-visuais-site; do
    [ -d "$RAIZ/_engine/$m" ] && [ ! -d "$RAIZ/_engine/$m/node_modules" ] && PW=1
  done
  if [ "$PW" -eq 1 ]; then
    aviso "Provador e Assets" "faltam pacotes, e sao pesados"
    printf "\n  Dois motores usam o Playwright, que baixa um navegador proprio, uns 300 MB.\n"
    printf "  Sem ele param SO estas duas coisas: o recomendador de tamanho e o download\n"
    printf "  de imagens de um site de referencia. Todo o resto funciona sem.\n\n"
    printf "  Instalar agora? [s/N] "
    read -r RP
    if [ "$RP" = "s" ] || [ "$RP" = "S" ]; then
      for m in aplicar-provador-virtual baixar-assets-visuais-site; do
        [ -d "$RAIZ/_engine/$m" ] || continue
        printf "\n  %s...\n" "$m"
        (cd "$RAIZ/_engine/$m" && npm install --silent --no-audit --no-fund && npx playwright install chromium) || true
      done
    else
      printf "  Fica para depois. Da para instalar quando precisar, rodando este arquivo de novo.\n"
    fi
  else
    ok "Provador e Assets" "pronto"
  fi
else
  aviso "Motores extras" "sem Node ainda, instale o Node primeiro"
fi

ok "Minerar Criativos" "usa o Chrome, nao precisa de pacote"

# ── 3c. a pasta do Claude ───────────────────────────────────────────────────
# A aula conecta no Claude a pasta Ambiente Claude, ao lado desta, e nao esta.
# O _env/ambiente-claude.mjs leva para la o agente, os comandos, as regras e o
# endereco desta pasta. Roda a cada instalacao, entao acompanha um pacote novo.
printf "\n${B}  A pasta do Claude${N}\n\n"
AMB="$(dirname "$RAIZ")/Ambiente Claude"
if [ ! -d "$RAIZ/.claude" ]; then
  :  # a falta da pasta .claude ja apareceu na conferencia do material
elif ! command -v node >/dev/null 2>&1; then
  aviso "Ambiente Claude" "sem Node ainda, instale o Node primeiro"; FALTOU=1
elif node "$RAIZ/_env/ambiente-claude.mjs" >/dev/null; then
  ok "Ambiente Claude" "pronta, ao lado desta pasta"
else
  falta "Ambiente Claude" "nao consegui preparar a pasta, mande um print desta tela"; FALTOU=1
fi

# ── 4. proximo passo ────────────────────────────────────────────────────────
printf "\n"
if [ "$FALTOU" -eq 0 ]; then
  printf "${B}${V}  Esta tudo pronto.${N}\n\n"
  printf "  ${B}Os proximos passos:${N}\n\n"
  printf "  ${C}1.${N} No Obsidian, se ainda nao abriu: ${B}Open folder as vault${N} e esta pasta:\n"
  printf "     %s\n\n" "$RAIZ"
  printf "  ${C}2.${N} No aplicativo do Claude, aba ${B}Code${N}, escolha a pasta ${B}Ambiente Claude${N}:\n"
  printf "     %s\n" "$AMB"
  printf "     Nao escolha a pasta SistemaBaseX: o Claude le o sistema de la.\n"
  printf "     Se ja tinha uma conversa aberta na Ambiente Claude, comece uma nova.\n\n"
  printf "  ${C}3.${N} Na primeira conversa, peca para ele ler a pasta SistemaBaseX inteira.\n"
  printf "     O pedido pronto esta no passo 5 do 00. Comece Aqui.\n\n"
  printf "  Voce nunca precisa decorar nome de comando. O BX Mestre entende e chama a skill certa.\n\n"
else
  printf "${B}${A}  Faltou alguma coisa.${N}\n\n"
  printf "  Resolva o que esta marcado como ${R}falta${N} acima e clique de novo neste arquivo.\n"
  printf "  Se travar, mande um print desta tela no suporte.\n\n"
fi
read -r -p "  Enter para sair "
