# Vistoria completa com prioridade na transmissão

Objetivo: eliminar as falhas da sala ao vivo (vídeo que trava ao sair e voltar) e depois rever o resto do sistema. Sem funcionalidades novas.

## 1. Sala ao vivo: o problema do vídeo que trava

&nbsp;

&nbsp;

O que foi confirmado no código:

- O vídeo só é colocado no ponto certo uma única vez, quando carrega. Depois disso nunca mais é reposicionado.
- O relógio da sessão segue a hora marcada, mas o vídeo não. Quando o separador fica em segundo plano, o navegador trava a reprodução; ao voltar, o chat e a oferta estão à frente e o vídeo ficou para trás.
- A imagem é desenhada num painel de pintura que para quando a página está escondida; ao regressar pode ficar a última imagem congelada.
- Falhas de rede na reprodução em streaming só têm um caminho: mostrar erro. Não há qualquer tentativa de recuperação.
- Quando a reprodução fica em espera por falta de dados, nada acontece: o ecrã fica parado sem aviso.

Correções previstas:

- Reposicionar o vídeo sempre que a pessoa volta à página, apanhando o momento real da sessão (com margem: só corrige se o desvio passar alguns segundos).
- Verificação contínua e discreta do desvio entre a hora da sessão e o vídeo, com correção suave.
- Retomar a pintura da imagem e a reprodução imediatamente ao regressar, sem imagem congelada.
- Recuperação automática de falhas de rede e de imagem na reprodução em streaming, com tentativas antes de desistir; só depois disso é que aparece mensagem de erro.
- Tratar os estados de espera e de paragem: continuar a sessão, retomar sozinho e nunca deixar o ecrã parado sem razão.
- Rever também a saída e o regresso no telemóvel (bloquear ecrã, trocar de aplicação, rodar o ecrã).

## 2. Resto da sala

- Entrada a meio da sessão, replay, fim da transmissão e oferta a continuar depois do fim.
- Chat programado sincronizado com o tempo, sem repetições nem mensagens fora de ordem ao reentrar.
- Contador de espectadores, notificações de compra no vídeo e no chat, contagem da oferta.
- Som: autorização no toque inicial, voltar do silêncio, controlo de volume.
- Suporte privado e assistente, incluindo conversas em pausa.

## 3. Painel e restantes áreas

- Entrada, registo, recuperação de palavra-passe e sessão.
- Painel, biblioteca, calendário, participantes, definições, análise.
- Editor de webinars: gravar em cada separador e confirmar que nada volta atrás depois de recarregar.
- Vendas com IA, agente IA, transcrição e geração de comentários.

## 4. Base de dados e segurança

- Analisador de segurança: tabelas sem proteção, políticas e permissões em falta.
- Isolamento entre contas: cada espaço de trabalho só vê os seus dados.

## 5. Provas

Cada falha corrigida é testada em navegador real, com sessão autenticada, e repetida duas vezes: sair da sala, voltar, deixar em segundo plano vários minutos e regressar. No fim, relatório simples do que estava mal, do que foi corrigido e do que ficou por corrigir.

## Notas técnicas

- `src/components/video-player.tsx`: repor a lógica de posicionamento (permitir novo salto), tratar `waiting`/`stalled`/`visibilitychange`, e ligar `hls.recoverMediaError()` / `startLoad()` antes de marcar falha.
- `src/components/webinar-room.tsx`: expor o alvo temporal contínuo (não só `startAtSeconds` inicial) e reconciliar com `elapsed` da sessão agendada, com tolerância de alguns segundos.
- Verificação com `bunx tsgo --noEmit`, `bunx vitest run`, registo de compilação e Playwright em 1280x1800 e 390x844.
- Sem migrações destrutivas; sem alterações ao desenho da sala além do necessário para corrigir.