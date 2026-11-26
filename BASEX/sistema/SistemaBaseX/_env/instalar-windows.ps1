# ============================================================================
# BaseX - instalador do ambiente (Windows)
# Chamado pelo instalar-windows.bat. Nao rode este arquivo direto.
# ============================================================================
$ErrorActionPreference = 'Continue'
$Raiz = Split-Path -Parent $PSScriptRoot
$Faltou = $false
$Instalar = @()

function Ok    ($n,$d) { Write-Host "  ok     " -ForegroundColor Green  -NoNewline; Write-Host ("{0,-24} {1}" -f $n,$d) }
function Falta ($n,$d) { Write-Host "  falta  " -ForegroundColor Red    -NoNewline; Write-Host ("{0,-24} {1}" -f $n,$d) }
function Aviso ($n,$d) { Write-Host "  aviso  " -ForegroundColor Yellow -NoNewline; Write-Host ("{0,-24} {1}" -f $n,$d) }
function Tem   ($c) { $null -ne (Get-Command $c -ErrorAction SilentlyContinue) }

Clear-Host
Write-Host ""
Write-Host "  BaseX - instalacao do ambiente" -ForegroundColor White
Write-Host "  $Raiz" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Conferindo a sua maquina" -ForegroundColor White
Write-Host ""

# ---- Node ----
if (Tem node) {
  $nv = (node -v) -replace 'v',''
  if ([int]($nv -split '\.')[0] -ge 22) { Ok "Node" "v$nv" }
  else { Falta "Node" "v$nv e velho demais, precisa da 22 ou mais nova"; $Instalar += 'node'; $Faltou = $true }
} else { Falta "Node" "nao encontrado"; $Instalar += 'node'; $Faltou = $true }

# ---- Git ----
# O app do Claude abre sem Git e cai no PowerShell; os comandos das squads sao de bash.
$gv = $null
if (Tem git) { $gv = (git --version 2>&1 | Out-String).Trim() }
if ($gv -and $LASTEXITCODE -eq 0 -and $gv -match '^git version') { Ok "Git" ($gv -replace '^git version ','') }
else { Falta "Git" "os comandos do pacote rodam pelo bash que vem com ele"; $Instalar += 'git'; $Faltou = $true }

# ---- Python ----
$py = $null
foreach ($c in @('python','python3','py')) {
  if (Tem $c) {
    $v = (& $c -V 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -eq 0 -and $v -match '^Python 3') { $py = $c; break }
  }
}
if ($py) {
  Ok "Python" (& $py -V 2>&1)
  & $py -c "import PIL" 2>$null
  if ($LASTEXITCODE -eq 0) { Ok "Pillow" "biblioteca de imagem" }
  else { Falta "Pillow" "falta a biblioteca de imagem do Python"; $Instalar += 'pillow'; $Faltou = $true }
  # MarkItDown converte PDF, Word e planilha para o Claude ler (regra ler-documento-convertendo).
  # Pede Python 3.10 ou mais novo; o do winget e o 3.12.
  & $py -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" 2>$null
  if ($LASTEXITCODE -ne 0) { Aviso "Conversor de documento" "pede Python 3.10 ou mais novo; o Claude le PDF direto ate la" }
  else {
    & $py -c "import markitdown" 2>$null
    if ($LASTEXITCODE -eq 0) { Ok "Conversor de documento" "PDF e Word viram texto para o Claude" }
    else { Falta "Conversor de documento" "le PDF, Word e planilha para o Claude"; $Instalar += 'markitdown'; $Faltou = $true }
  }
} else { Falta "Python" "nao encontrado"; $Instalar += 'python'; $Faltou = $true }

# ---- Shopify CLI ----
if (Tem shopify) { Ok "Shopify CLI" ((shopify version 2>$null) | Select-Object -First 1) }
else { Falta "Shopify CLI" "e por onde o Claude fala com a sua loja"; $Instalar += 'shopify'; $Faltou = $true }

# ---- Chrome ----
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chrome) { Ok "Google Chrome" "desenha logo, wireframe e print" }
else { Falta "Google Chrome" "baixe em google.com/chrome"; $Faltou = $true }

if (Tem claude) { Ok "Claude Code" ((claude --version 2>$null) | Select-Object -First 1) }
else { Aviso "Claude Code" "nao achei o comando; se voce usa o aplicativo do Claude, esta tudo certo" }

# ---- material ----
Write-Host ""
Write-Host "  Conferindo o material" -ForegroundColor White
Write-Host ""
function Conta($p) { if (Test-Path $p) { (Get-ChildItem $p -ErrorAction SilentlyContinue).Count } else { 0 } }

$nsk = Conta "$Raiz\03. Skills"
$nen = if (Test-Path "$Raiz\_engine") { (Get-ChildItem "$Raiz\_engine" -Directory).Count } else { 0 }
$ncm = Conta "$Raiz\.claude\commands"

if ($nsk -gt 0) { Ok "Skills" $nsk } else { Falta "Skills" "a pasta 03. Skills veio vazia"; $Faltou = $true }
if ($nen -gt 0) { Ok "Motores" $nen } else { Falta "Motores" "a pasta _engine veio vazia"; $Faltou = $true }

if (Test-Path "$Raiz\.claude\agents\basex-master.md") { Ok "Agente BX Mestre" "instalado" }
else {
  Falta "Agente BX Mestre" "a pasta .claude nao veio junto"
  Write-Host ""
  Write-Host "  Isso acontece quando o material e baixado como PASTA do Drive:" -ForegroundColor Yellow
  Write-Host "  o Drive nao leva pastas ocultas. Baixe o arquivo .zip e descompacte."
  Write-Host ""
  $Faltou = $true
}
if ($ncm -gt 0) { Ok "Comandos" $ncm } else { Falta "Comandos" "a pasta .claude\commands veio vazia" }

# ---- instalar o que falta ----
if ($Instalar.Count -gt 0) {
  Write-Host ""
  Write-Host "  Posso instalar o que falta" -ForegroundColor White
  Write-Host ""
  $Instalar | ForEach-Object { Write-Host "    - $_" }
  Write-Host ""
  $resp = Read-Host "  Instalar agora? [s/N]"
  if ($resp -eq 's' -or $resp -eq 'S') {
    if (-not (Tem winget)) {
      Write-Host ""
      Write-Host "  Esta maquina nao tem o winget, que e o instalador do Windows." -ForegroundColor Yellow
      Write-Host "  Atualize a Loja da Microsoft ou instale na mao:"
      Write-Host "    Node    https://nodejs.org"
      Write-Host "    Git     https://git-scm.com/download/win"
      Write-Host "    Python  https://python.org/downloads  (marque Add to PATH)"
      Write-Host "    Chrome  https://google.com/chrome"
    } else {
      foreach ($i in $Instalar) {
        switch ($i) {
          'node'    { Write-Host "`n  Instalando Node..."       ; winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements }
          'git'     { Write-Host "`n  Instalando Git..."        ; winget install -e --id Git.Git --accept-package-agreements --accept-source-agreements; Write-Host "  Feche e abra o app do Claude de novo para ele achar o Git." -ForegroundColor Yellow }
          'python'  { Write-Host "`n  Instalando Python..."     ; winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements }
          'pillow'  { Write-Host "`n  Instalando Pillow..."     ; & $py -m pip install --user --quiet Pillow }
          'markitdown' { Write-Host "`n  Instalando o conversor de documento..."; & $py -m pip install --user --quiet "markitdown[all]" }
          'shopify' { Write-Host "`n  Instalando Shopify CLI..."; npm install -g '@shopify/cli' }
        }
      }
      Write-Host ""
      Write-Host "  Pronto. Feche esta janela e clique de novo no instalador para conferir." -ForegroundColor Green
    }
    Write-Host ""
    Read-Host "  Enter para sair" | Out-Null
    exit 0
  }
}

# ---- o comando python3 responde? ----
# As skills mandam rodar "python3 alguma-coisa.py". No Windows esse comando as vezes
# nao existe (so "python" ou "py"), e as vezes e um atalho da Loja da Microsoft que
# abre a loja em vez de rodar o Python. Melhor descobrir agora do que no meio do uso.
if ($py) {
  $p3ok = $false
  try {
    $saida = & python3 -c "print('ok')" 2>&1
    if ($LASTEXITCODE -eq 0 -and "$saida" -match 'ok') { $p3ok = $true }
  } catch { $p3ok = $false }

  if (-not $p3ok) {
    # O Python do python.org (o mesmo do winget) nao traz python3.exe, e o "python3"
    # cai no atalho da Loja. Uma copia do python.exe com esse nome resolve.
    try {
      $exe = (& $py -c "import sys; print(sys.executable)" 2>$null | Out-String).Trim()
      $p3 = Join-Path (Split-Path $exe) 'python3.exe'
      if (-not (Test-Path $p3)) { Copy-Item $exe $p3 -ErrorAction Stop }
      $saida = & python3 -c "print('ok')" 2>&1
      if ($LASTEXITCODE -eq 0 -and "$saida" -match 'ok') { $p3ok = $true }
    } catch { $p3ok = $false }
  }

  if ($p3ok) {
    Ok "Comando python3" "responde"
  } else {
    Aviso "Comando python3" "nao responde nesta maquina"
    Write-Host ""
    Write-Host "  As ferramentas chamam 'python3'. Aqui o Python responde por '$py'." -ForegroundColor Yellow
    Write-Host "  Duas saidas, escolha uma:"
    Write-Host ""
    Write-Host "    1. Desligue o atalho da Loja:  Configuracoes > Aplicativos >"
    Write-Host "       Aliases de execucao de aplicativo > desligue python.exe e python3.exe"
    Write-Host "       Depois feche e abra o terminal de novo."
    Write-Host ""
    Write-Host "    2. Ou avise o Claude, uma vez so, escrevendo para ele:"
    Write-Host "       'nesta maquina o Python roda por $py, use esse comando'"
    Write-Host ""
    $Faltou = $true
  }
}

# ---- motores que pedem um pacote a mais ----
Write-Host ""
Write-Host "  Motores que pedem um pacote a mais" -ForegroundColor White
Write-Host ""

if (Tem node) {
  # xlsx e leve e cabe instalar sem perguntar
  $ao = Join-Path $Raiz "_engine\analisar-operacao"
  if ((Test-Path $ao) -and -not (Test-Path (Join-Path $ao "node_modules"))) {
    Write-Host "  instalando o leitor de planilha do Analisar Operacao..."
    Push-Location $ao
    npm install --silent --no-audit --no-fund 2>&1 | Out-Null
    Pop-Location
    if (Test-Path (Join-Path $ao "node_modules")) { Ok "Analisar Operacao" "pronto" }
    else { Aviso "Analisar Operacao" "npm install falhou, rode na mao na pasta do motor" }
  } else {
    Ok "Analisar Operacao" "pronto"
  }

  # playwright baixa um navegador inteiro, entao pergunta antes
  $pesados = @("aplicar-provador-virtual","baixar-assets-visuais-site")
  $pw = $false
  foreach ($m in $pesados) {
    $d = Join-Path $Raiz "_engine\$m"
    if ((Test-Path $d) -and -not (Test-Path (Join-Path $d "node_modules"))) { $pw = $true }
  }
  if ($pw) {
    Aviso "Provador e Assets" "faltam pacotes, e sao pesados"
    Write-Host ""
    Write-Host "  Dois motores usam o Playwright, que baixa um navegador proprio, uns 300 MB."
    Write-Host "  Sem ele param SO estas duas coisas: o recomendador de tamanho e o download"
    Write-Host "  de imagens de um site de referencia. Todo o resto funciona sem."
    Write-Host ""
    $rp = Read-Host "  Instalar agora? [s/N]"
    if ($rp -eq "s" -or $rp -eq "S") {
      foreach ($m in $pesados) {
        $d = Join-Path $Raiz "_engine\$m"
        if (-not (Test-Path $d)) { continue }
        Write-Host ""
        Write-Host "  $m..."
        Push-Location $d
        npm install --silent --no-audit --no-fund 2>&1 | Out-Null
        npx playwright install chromium 2>&1 | Out-Null
        Pop-Location
      }
    } else {
      Write-Host "  Fica para depois. Da para instalar quando precisar, rodando este arquivo de novo."
    }
  } else {
    Ok "Provador e Assets" "pronto"
  }
} else {
  Aviso "Motores extras" "sem Node ainda, instale o Node primeiro"
}

Ok "Minerar Criativos" "usa o Chrome, nao precisa de pacote"

# ---- a pasta do Claude ----
# A aula conecta no Claude a pasta Ambiente Claude, ao lado desta, e nao esta.
# O _env\ambiente-claude.mjs leva para la o agente, os comandos, as regras e o
# endereco desta pasta. Roda a cada instalacao, entao acompanha um pacote novo.
Write-Host ""
Write-Host "  A pasta do Claude" -ForegroundColor White
Write-Host ""
$Amb = Join-Path (Split-Path -Parent $Raiz) "Ambiente Claude"
if (-not (Test-Path "$Raiz\.claude")) {
  # a falta da pasta .claude ja apareceu na conferencia do material
} elseif (-not (Tem node)) {
  Aviso "Ambiente Claude" "sem Node ainda, instale o Node primeiro"; $Faltou = $true
} else {
  node "$Raiz\_env\ambiente-claude.mjs" | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok "Ambiente Claude" "pronta, ao lado desta pasta" }
  else { Falta "Ambiente Claude" "nao consegui preparar a pasta, mande um print desta tela"; $Faltou = $true }
}

# ---- proximo passo ----
Write-Host ""
if (-not $Faltou) {
  Write-Host "  Esta tudo pronto." -ForegroundColor Green
  Write-Host ""
  # O Claude aberto antes da instalacao guarda o ambiente antigo: so este terminal novo ve
  # o Python e o Shopify CLI recem-instalados (obs 0444, aula de 12/11: "python3 nao funciona").
  if (Get-Process -Name claude -ErrorAction SilentlyContinue) {
    Write-Host "  O aplicativo do Claude esta aberto. Feche por completo antes do passo 2:" -ForegroundColor Yellow
    Write-Host "  icone do Claude perto do relogio, botao direito, Sair. Depois abra de novo."
    Write-Host "  Fechar so a janela nao basta: aberto desde antes, ele nao enxerga o que"
    Write-Host "  acabou de ser instalado."
    Write-Host ""
  }
  Write-Host "  Os proximos passos:" -ForegroundColor White
  Write-Host ""
  Write-Host "  1. " -ForegroundColor Cyan -NoNewline
  Write-Host "No Obsidian, se ainda nao abriu: Open folder as vault e esta pasta:"
  Write-Host "     $Raiz"
  Write-Host ""
  Write-Host "  2. " -ForegroundColor Cyan -NoNewline
  Write-Host "No aplicativo do Claude, aba Code, escolha a pasta Ambiente Claude:"
  Write-Host "     $Amb"
  Write-Host "     Nao escolha a pasta SistemaBaseX: o Claude le o sistema de la."
  Write-Host "     Se ja tinha uma conversa aberta na Ambiente Claude, comece uma nova."
  Write-Host ""
  Write-Host "  3. " -ForegroundColor Cyan -NoNewline
  Write-Host "Na primeira conversa, peca para ele ler a pasta SistemaBaseX inteira."
  Write-Host "     O pedido pronto esta no passo 5 do 00. Comece Aqui."
  Write-Host ""
  Write-Host "  Voce nunca precisa decorar nome de comando. O BX Mestre entende e chama a skill certa."
  Write-Host ""
} else {
  Write-Host "  Faltou alguma coisa." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  Resolva o que esta marcado como falta acima e clique de novo no instalador."
  Write-Host "  Se travar, mande um print desta tela no suporte."
  Write-Host ""
}
Read-Host "  Enter para sair" | Out-Null
