# Geração de chat e sincronização que continuam com a aba fechada

## Situação atual
O logótipo preto anterior já foi reposto na barra lateral e no cabeçalho móvel.

Hoje, a geração de chat com IA e a sincronização de comentários correm dentro do
navegador: é o separador aberto que faz, um a um, os pedidos ao servidor
(medir vídeo → transcrever por blocos de 10 min → mapa → janelas → auditoria).
Por isso, se a pessoa fechar a aba, o trabalho para — e ao voltar aparece
"a geração foi interrompida".

## O que vai mudar
O trabalho passa a viver no servidor. Quando toca em "Gerar com IA" ou
"Sincronizar comentários", o pedido é registado e o servidor continua sozinho,
mesmo com o computador desligado. Ao voltar ao painel, o progresso aparece no
mesmo sítio de sempre (passo Chat, sino e página inicial) e o resultado fica à
espera de aprovação, exatamente como agora.

## Como será feito

### 1. Fila de trabalhos na base de dados
Nova tabela `background_jobs`: webinar, dono, tipo (chat ou sincronização),
estado (em fila / a correr / pronto / erro), etapa atual, nota de progresso,
dados de entrada, estado intermédio (transcrição, mapa, janelas já geradas) e
resultado final. Com RLS por dono e GRANTs.

### 2. O trabalho passa a ser feito por etapas
A lógica existente em `src/lib/ai-comments.functions.ts` é reorganizada: cada
passo (medir, transcrever um bloco, mapa global, uma janela, auditoria, um lote
de sincronização) fica numa função reutilizável. As funções atuais continuam a
existir e a chamar essas mesmas rotinas, portanto nada muda para quem já as usa.

### 3. Motor que avança a fila
Um ponto de entrada interno protegido por chave (`/api/public/run-jobs`)
avança cada trabalho uma etapa de cada vez, guardando o progresso na tabela a
cada passo. Uma tarefa agendada na base de dados chama-o ao minuto, por isso a
fila avança sem browser aberto. Enquanto o separador estiver aberto, também
ajuda a empurrar as etapas, para ser tão rápido como hoje.

### 4. Painel a ler o estado do servidor
`ai-comment-jobs.ts` e `sync-jobs.ts` deixam de executar o trabalho e passam a
ler a tabela (com atualização em tempo real), mantendo a mesma interface:
cartão de progresso no topo do passo Chat, aviso no sino, aviso na página
inicial, aprovação/rejeição manual e mensagens de erro em português simples.
Trabalhos antigos guardados no browser deixam de ser mostrados como falha.

### Notas técnicas
- Cada invocação do motor faz várias etapas dentro do limite de tempo do pedido
  e devolve controlo; nunca depende de uma única chamada longa.
- Um trabalho que falhe numa etapa tenta de novo (até 3 vezes) antes de ficar
  como erro, mantendo o que já foi gerado.
- A transcrição continua a ser guardada e reutilizada por vídeo.
- Nada é publicado automaticamente: o resultado fica sempre à espera de
  aprovação.
