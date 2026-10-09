# Correspondência entre o mapa de automação e o motor

O `mapa-de-automacao.json` descreve o funil de referência com os seus próprios ids. O produto e o motor usam outros nomes. Esta tabela liga uns aos outros e diz o que ainda não existe. As palavras do produto estão em `GLOSSARY.md`, na raiz.

Ao criar ou renomear um gatilho, um facto ou uma automação pronta, actualize esta tabela.

## Nós do mapa

| No mapa | No produto | No motor | Estado |
|---|---|---|---|
| `src_facebook`, `src_instagram`, `src_youtube` | Origem: plataforma e sítio (Meta Ads · Facebook, Meta Ads · Instagram, Google Ads · YouTube) | Nó `origin` do canvas, com `source` e `placement`. Só representação. | Feito |
| `pg_landing` | Página de inscrição | Formulário de inscrição do webinar; página `inscricao` | Feito |
| `pg_acesso` | Sala do webinar | `/w/<slug>` (variável `{{link}}`) | Feito |
| `lk_redirect` | Grupo de WhatsApp, com o link de convite | Nós `group` do canvas; `{{link_grupo}}` é o link do primeiro grupo que o tem | Feito, sem rotação de grupos cheios |
| `grp_1`, `grp_2`, `grp_3` | Grupos de WhatsApp do fluxo (um ou vários, lado a lado no desenho). A mensagem nos grupos escolhe um ou vários: um disparo por grupo, cada um com o seu texto | Um nó `group` por grupo; cada disparo com `send.target = "group"` e `send.group` = nome do grupo no WhatsApp (o motor procura-o pelo nome). Mudar o nome do grupo no fluxo muda-o nas mensagens (`renameGroupIn`) | Feito. Até 6 disparos por mensagem (limite da base de dados); não há destino «todos os grupos» que acompanhe grupos novos |
| `ai_aquecimento` | Automações «Aquecimento» e «Lembretes» do modelo (menu «Mensagens de aquecimento») | Gatilho `webinar_registered` | Feito |
| `sala` | Momentos «Webinar ao vivo» e «Fim da sessão» | Gatilhos `webinar_session_started` e `webinar_session_ended` | Feito |
| `cond_comprou`, `cond_nao_comprou` | Condição «Comprou?» | Facto `purchased`; gatilho `purchase_approved` | Feito |
| `seq_nao_acessou` | Automação «Não acessou» | `webinar_session_ended` com `entered = false` e `purchased = false` | Feito |
| `seq_saiu_antes` | Automação «Saiu antes do pitch» | `webinar_session_ended` com `entered = true`, `reached_offer = false` e `purchased = false` | Feito |
| `seq_assistiu` | Automação «Assistiu o pitch» | `webinar_session_ended` com `entered = true`, `reached_offer = true` e `purchased = false` | Feito |
| `rmkt_facebook` | Não existe | Não existe | Por fazer: o público de quem não comprou não é enviado à Meta |
| `pg_upsell`, `pg_downsell`, `pg_obrigado` | Páginas do fluxo: upsell, downsell, obrigado (compra) | Nós `page` do canvas. Só representação. | Feito como desenho |
| `cond_upsell`, `seq_upsell` | Não existe | Não existe | Por fazer: o motor não sabe se o upsell foi comprado |
| `ai_upsell_pos` | Passo «Upsell» da automação «Pós-compra» | Gatilho `purchase_approved` | Feito, com a mensagem por escrever |

## Acontecimentos e segmentos

| No mapa | No motor |
|---|---|
| `lead.criado` | Gatilho `webinar_registered` |
| `lead.entrou_grupo` | Não existe: o motor não sabe quem entrou no grupo |
| `acesso.visitado` | Não existe |
| `webinar.entrou` | Facto `entered` |
| `webinar.saiu` antes de `oferta.exibida` | Facto `reached_offer = false` com `entered = true` |
| `oferta.exibida` com a pessoa presente | Facto `reached_offer` (chegou ao ponto da oferta). `saw_offer` é o registo da sala de que a oferta foi mostrada. |
| `oferta.clicada` | Gatilho `offer_clicked`; facto `clicked` |
| `webinar.encerrado` | Gatilho `webinar_session_ended` |
| `compra.aprovada` | Gatilho `purchase_approved`; facto `purchased` |
| `upsell.*`, `downsell.*`, `obrigado.visitado` | Não existem: o motor não distingue o upsell da oferta principal nem regista visitas a páginas |
| Segmento `nao_acessou` | `entered = false` |
| Segmento `saiu_antes_pitch` | `entered = true` e `reached_offer = false` |
| Segmento `assistiu_pitch` | `entered = true` e `reached_offer = true` |
| Precedência dos segmentos | As três condições são exclusivas: cada pessoa entra numa só automação |
| `avaliado_em: webinar.encerrado` | As três automações começam no gatilho `webinar_session_ended` |
| `reavaliacao` | Não existe. Quem vê a gravação depois continua na mesma automação: numa automação que começa no fim da sessão, o que a pessoa fez na sessão não se volta a confirmar (`conditionsAtSend`). A troca de automação no passo equivalente está por fazer. |

## Regras do mapa e onde vivem

| Regra | No motor |
|---|---|
| Compra aprovada cancela as sequências de venda | As três automações de quem não comprou exigem `purchased = false` à entrada; o motor confirma as condições de entrada antes de cada mensagem |
| A condição de cada envio é avaliada no momento do envio | `conditionsHold` e `guardsHold` correm antes de cada mensagem. Excepção: depois de a sessão terminar, o que a pessoa fez nela já não se volta a confirmar (`conditionsAtSend`), para a gravação não a tirar da automação. |
| Um contato está numa única sequência por trilha | Garantido para quem não comprou, pelas condições exclusivas. Nas outras automações cada uma tem o seu gatilho. |

## O modelo (automações prontas)

O fluxo nasce vazio: nenhuma automação é criada sozinha, nem ao criar o fluxo nem no editor do webinar. As automações do modelo (`baseWorkflow()`) entram com o botão «Usar modelo» (escolhem-se quais) ou uma a uma pelo menu das peças, arrumadas em `MODEL_GROUPS`:

| Bloco no menu | Automações |
|---|---|
| Mensagens de aquecimento | «Aquecimento», «Lembretes», «Sessão começou» |
| Mensagens de recuperação | «Não acessou», «Saiu antes do pitch», «Assistiu o pitch», «Clicou e não comprou», «Checkout abandonado», «Pagamento falhou» |
| Depois da compra | «Pós-compra», «Reembolso» |

Entram desligadas. As mensagens para o grupo saem para cada grupo do fluxo (`modelAutomations`); quando não cabem os 6 disparos de uma mensagem, os dos grupos passam para mensagens só deles, logo a seguir e sem espera («Estamos ao vivo · grupos»). Sem grupos, o modelo põe o «Grupo do lançamento» no fluxo. Uma automação do modelo que já está no fluxo (pelo nome) aparece como «Já no fluxo» no menu e vem desmarcada em «Usar modelo».

Os fluxos criados antes de o fluxo nascer vazio trazem o modelo inteiro. «Começar vazio» (no topo das peças) arquiva de uma vez as automações do modelo desligadas, sem execuções e por mexer (`isModelAsIs`: nome, gatilho, condições e passos iguais aos do modelo, sem contar os nomes dos grupos); o aviso traz «Desfazer».

Existem no produto e não têm nó no mapa: «Sessão começou», «Clicou e não comprou», «Checkout abandonado», «Pagamento falhou» e «Reembolso».

## Gatilhos por parte do lançamento

No menu, na escolha do «Quando», no desenho e no passo Automações do editor, os gatilhos arrumam-se nas três partes do lançamento (`TRIGGER_GROUPS`; GLOSSARY: «Parte do lançamento»). «Momento» continua a ser um dos cinco pontos da espinha. Os nomes dos gatilhos não mudaram.

| Parte do lançamento | Gatilhos do motor |
|---|---|
| Novas pessoas | `webinar_registered` |
| No dia do evento | `webinar_session_started`, `webinar_attended`, `offer_viewed`, `offer_clicked` |
| Depois do evento | `webinar_session_ended`, `checkout_started`, `checkout_abandoned`, `payment_failed`, `purchase_approved`, `purchase_refunded` |

## Tempos das três automações de quem não comprou

Seguem a proposta do passo 10 do mapa: 1 hora depois do fim, dia 1 às 09:00 e às 20:00, dia 2 às 09:00 e às 20:00, dia 3 às 09:00. O fecho é no dia 4, às 09:00 e às 20:00 [PROPOSTA]: o mapa diz «dia do fechamento» sem o fixar.
