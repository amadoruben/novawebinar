# Estúdio de automação do webinar

Evolução do módulo de Chat e Engajamento já existente, mais imagens com IA, prova social e uma linha de tempo única.

## 1. Chat com IA mais completo
- Manter o gerador atual e acrescentar às definições: frequência dos comentários e avatar de cada pessoa.
- Cada comentário passa a ter nome, avatar (inicial colorida ou imagem) e mensagem, todos editáveis à mão.
- Continuam disponíveis: gerar tudo, regerar tudo, gerar só um trecho, gerar mais neste trecho, regerar um comentário, apagar, acrescentar manualmente.
- A chegada inicial (primeiros segundos, antes de o apresentador falar) e as respostas em cascata a perguntas mantêm-se como regra de escrita da IA.
- Nada é publicado sozinho: tudo fica no editor para revisão antes de guardar.

## 2. Editor de chat melhorado
- Lista de comentários em cartões com hora, avatar, nome e mensagem.
- Pré-visualização ao lado a mostrar o chat tal como o participante o vê, avançando no tempo.
- As mensagens reais dos participantes continuam privadas para o próprio e para a equipa; o Suporte continua num canal à parte.

## 3. Imagens com IA
- Botões no editor: gerar capa do webinar, gerar imagem da oferta, gerar imagem do produto.
- Janela com nome do produto, título, descrição, estilo, cores e formato; gera várias versões para escolher.
- Ações: regerar, criar variações, substituir, carregar imagem própria, aplicar diretamente ao webinar.
- A imagem da oferta aparece junto ao botão quando a oferta abre (já suportado).

## 4. Nova etapa "Vendas e Prova Social"
Entre Chat e Audiência.
- Notificações de compra durante a sessão ("João comprou Marca Milionária").
- Configurável: nome do produto, início (com a oferta ou X tempo depois), fim, intervalo mínimo e máximo, posição no ecrã, duração, animação e som opcional.
- Compras reais entram por webhook; compras de demonstração são criadas no editor e ficam marcadas como "Simulação".

## 5. Real vs simulado
- Duas tabelas separadas: compras reais e compras simuladas.
- Os relatórios contam apenas as reais; as simuladas nunca entram nas estatísticas.

## 6. Linha de tempo única
- Nova vista no editor com uma régua do minuto zero ao fim do vídeo, mostrando: comentários de IA, comentários manuais, abertura e fecho da oferta, início das notificações de compra e marcos da audiência.
- Permite clicar num momento para saltar para ele e ver o que acontece.

## Detalhes técnicos
- Migração: colunas de avatar em `scheduled_comments`; tabela `social_proof_settings` (por webinar); tabelas `real_purchase_events` e `simulated_purchase_events` com RLS e GRANTs; rota pública `src/routes/api/public/purchase-webhook.ts` com verificação de assinatura por segredo do webinar.
- Geração de imagens: rota `src/routes/api/generate-image.ts` em streaming com `google/gemini-3-pro-image`; resultado guardado no bucket `webinar-covers` e ligado ao campo correspondente.
- Chat IA: alargar `src/lib/ai-comments.functions.ts` (frequência, avatares) mantendo a análise/transcrição atual.
- Editor: nova etapa e nova vista de linha de tempo em `src/routes/webinars.$webinarId.edit.tsx`, com componentes novos para a régua e para a prova social.
- Sala pública: `webinar-room.tsx` mostra as notificações de compra com posição, duração e animação definidas.
