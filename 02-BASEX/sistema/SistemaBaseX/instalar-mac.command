#!/bin/bash
# Atalho. O instalador de verdade e _env/instalar.command; este arquivo so o chama,
# para nao existirem duas copias do mesmo script divergindo (ja aconteceu: uma exigia
# Node 18 e a outra Node 22).
exec "$(dirname "$0")/_env/instalar.command"
