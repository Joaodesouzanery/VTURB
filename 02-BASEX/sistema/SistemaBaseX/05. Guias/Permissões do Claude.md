---
tags: [guia, claude-code, seguranca, alunos]
criado: 2026-11-09
atualizado: 2026-11-09
status: ativo
---

# Permissões do Claude

> O que o Claude roda sem te perguntar, o que ele sempre pergunta e o que fica bloqueado. A regra vem no arquivo `.claude/settings.json`, que o instalador copia para a pasta Ambiente Claude, e só vale depois que você responde que confia nessa pasta, na primeira vez que abre o Claude nela.

## Roda sem perguntar

- As ferramentas do pacote que só leem ou salvam arquivo no seu computador: os pré-voos, a mineração e a Central, o acervo de nichos, a varredura de idioma e a conversão de imagem para WebP.
- A consulta aos temas da sua loja (listar e conferir), sem mudar nada.
- Arquivos novos ou editados só dentro de `Minhas Lojas` e `06. Saídas`.

## Sempre pergunta

- Tudo que muda a sua loja: subir tema, alterar produto, preço ou configuração, publicar produto, configurar mercados e frete.
- Instalar programa (npm, pip, brew).
- Mandar ou buscar dado na internet com `curl`, e rodar código solto.
- Editar qualquer arquivo fora de `Minhas Lojas` e `06. Saídas`, inclusive as habilidades e as ferramentas do pacote.

Quando ele perguntar, leia o comando antes de aprovar. "Sim, e não perguntar de novo" fica salvo só na sua máquina.

## Bloqueado

Apagar pasta inteira, comando com senha de administrador (`sudo`), publicar ou apagar tema, enviar código para o GitHub, ler as suas chaves de acesso do computador e do Chrome, e mudar o próprio arquivo de permissões.

## Por que assim

O Claude lê página de concorrente, anúncio e site de fornecedor. Uma página pode trazer texto escondido mandando a IA rodar um comando. O que pode mexer na sua loja ou mandar dado para fora passa sempre por você.
