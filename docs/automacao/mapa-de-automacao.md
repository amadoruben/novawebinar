# Mapa de automação: funil de webinar · lógica completa

Referência para o motor de automação. O documento ensina a lógica do funil em três níveis:
1. **Modelo mental:** como o funil funciona como um todo.
2. **Passo a passo:** o papel de cada etapa e como ela encaixa nas outras.
3. **Referência:** nós, ligações, segmentos e estados.

A estrutura vem do mapa de referência. Conteúdo dos envios, horários e regras de decisão são propostas.

## 1. Modelo mental

O funil é uma máquina de estados do contato. Cada nó lê o estado atual do contato, faz uma coisa e muda o estado. O tempo agenda as mensagens; os eventos (sobretudo a compra) decidem quem continua a recebê-las.

**1. Máquina de estados.** Cada contato tem um estado (visitante, inscrito, no grupo, presente, comprador, cliente…). Todo nó existe para mudar esse estado. Para entender um nó, pergunte: em que estado o contato chega e em que estado sai?

**2. Duas trilhas antes do webinar.** A trilha coletiva (grupos de WhatsApp) e a trilha individual (e-mails) correm em paralelo e convergem na página de acesso. O grupo dá alcance; o e-mail garante que ninguém fica de fora.

**3. O webinar é o sensor.** A sala não só vende: mede. Entrada, saída e presença no pitch são os dados que decidem tudo o que vem depois. Sem identificar o contato na sala, a segmentação deixa de existir.

**4. Uma bifurcação principal.** Depois do webinar o funil divide-se em dois objetivos opostos. Não comprou: converter na oferta principal. Comprou: aumentar o valor do pedido (upsell, downsell) e iniciar a relação de cliente.

**5. O tempo agenda, o evento decide.** Os envios são agendados em relação à data do webinar ou a um evento. Mas qualquer evento de compra corta de imediato as sequências de venda daquela oferta, mesmo as já agendadas.

**6. Um lugar por trilha.** Um contato está numa única sequência por trilha. Se muda de segmento, troca de sequência no passo equivalente, sem repetir nem acumular mensagens.

**7. Decidir no envio.** A condição de cada envio é verificada no instante de enviar, não quando foi agendado. O estado pode ter mudado entretanto.

### Estados do contato

| Estado | Vem de | Evento que muda |
|---|---|---|
| `visitante` | — | `page_view com utm` |
| `inscrito` | visitante | `lead.criado` |
| `no_grupo` | inscrito | `lead.entrou_grupo (ou clique no redirect)` |
| `com_intencao` | inscrito | no_grupo | `acesso.visitado` |
| `presente` | com_intencao | `webinar.entrou` |
| `viu_pitch` | presente | `oferta.exibida` |
| `comprador` | qualquer | `compra.aprovada` |
| `nao_comprador:<segmento>` | inscrito | presente | viu_pitch | `webinar.encerrado sem compra` |
| `cliente` | comprador | `obrigado.visitado` |

### Visão geral

```
Facebook ─┐
Instagram ┼─► Landing page ─► Redirect ─► Grupo 1 | 2 | 3 ─► Acesso ao webinar ─► Webinar
YouTube ──┘        │                                              ▲
                   └─► E-mails de aquecimento (5) ────────────────┘

Webinar ─► Não comprou ─┬─► Facebook (remarketing)
                        ├─► Não acessou ─────────────────► 8 e-mails
                        ├─► Acessou e saiu antes do pitch ► 8 e-mails
                        └─► Assistiu o pitch ────────────► 8 e-mails

Webinar ─► Comprou ─► Upsell ─┬─► Comprou ─────────────────────────► Obrigado ─► E-mail de upsell
                              └─► Não comprou ─┬─► Downsell ─► Comprou ─┘
                                               └─► Upsell por e-mail (4)
```

## 2. Passo a passo

### Passo 1 · Origem do tráfego

**Nós:** Facebook (`src_facebook`), Instagram (`src_instagram`), YouTube (`src_youtube`)

**Papel na lógica.** É o primeiro carimbo do contato. Não executa automação, mas tudo o que mede retorno por canal depende deste registo.

| | |
|---|---|
| Contato chega | Visitante anónimo |
| Contato sai | Visitante com origem registada |
| Depende de | — |
| Alimenta | 2. Inscrição na landing page |
| O que decide | Nada. Só regista. |

**O que acontece.** O visitante clica num anúncio ou conteúdo do Facebook, Instagram ou YouTube e chega à landing page.

**Por que.** Separar as origens mostra quanto custa cada inscrito e, mais tarde, cada comprador, por canal.

**Como o sistema executa**

1. Lê utm_source, utm_medium, utm_campaign e utm_content da URL.
2. Guarda a primeira origem (first touch) e a última (last touch) no contato.
3. Sem utm, marca a origem como "direto".

**Regra em código**

```
on page_view(landing):
  visitor.utm = parse_utm(url)
  cookie.set('utm', visitor.utm, 30d)
```

**Exemplo.** Maria vê um anúncio no Instagram e clica. A URL traz utm_source=instagram&utm_campaign=webinar-out. O sistema guarda isso num cookie por 30 dias.

**Se este passo falhar.** As compras ficam sem origem e não é possível saber que canal paga o investimento.

**Dados necessários:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`

**Casos-limite**

- O mesmo contato vem de duas origens: manter as duas, atribuir a compra à última.

### Passo 2 · Inscrição na landing page

**Nós:** Landing page (`pg_landing`)

**Papel na lógica.** É a porta de entrada. Cria a identidade do contato e dispara, ao mesmo tempo, as duas trilhas: grupo (passo 3) e e-mail (passo 5).

| | |
|---|---|
| Contato chega | Visitante com origem |
| Contato sai | Contato no estado inscrito |
| Depende de | 1. Origem do tráfego |
| Alimenta | 3. Redirect para os grupos; 5. E-mails de aquecimento |
| O que decide | Se o contato é novo ou já existe. |

**O que acontece.** O visitante preenche nome, e-mail e WhatsApp e se inscreve no webinar.

**Por que.** É o momento em que o visitante vira contato. Tudo o que vem depois depende deste registo.

**Como o sistema executa**

1. Valida e-mail e telefone.
2. Procura o contato pelo e-mail; se existir, atualiza, se não, cria.
3. Inscreve o contato neste webinar.
4. Emite lead.criado, que inicia os passos 3 e 5 ao mesmo tempo.

**Regra em código**

```
on form_submit:
  c = upsert_contact(email)
  c.utm ||= cookie.utm
  enroll(c, webinar)
  emit('lead.criado', c)
```

**Exemplo.** Maria preenche o formulário. O sistema cria o contato #123, copia a utm do cookie, inscreve-o no webinar e emite lead.criado.

**Se este passo falhar.** Nada a seguir acontece: sem lead.criado não há grupo, e-mail nem segmentação.

**Dados necessários:** `nome`, `email`, `whatsapp`, `consentimento`, `webinar_id`

**Casos-limite**

- Inscrição repetida no mesmo webinar: não duplica e não reinicia a sequência.
- Telefone inválido: inscreve na mesma, mas o contato só recebe e-mail.

### Passo 3 · Redirect para os grupos

**Nós:** Redirect (`lk_redirect`), Grupo de WhatsApp 1 (`grp_1`), Grupo de WhatsApp 2 (`grp_2`), Grupo de WhatsApp 3 (`grp_3`)

**Papel na lógica.** Transforma o interesse do momento num canal de alto alcance. Entrar no grupo é o primeiro pequeno compromisso do contato.

| | |
|---|---|
| Contato chega | Inscrito |
| Contato sai | Inscrito com grupo atribuído |
| Depende de | 2. Inscrição na landing page |
| Alimenta | 4. Automação nos grupos |
| O que decide | Qual grupo recebe o contato. |

**O que acontece.** Logo após a inscrição o navegador é redirecionado para um grupo de WhatsApp com vaga.

**Por que.** O interesse é máximo no segundo da inscrição. O redirect usa esse momento e distribui as pessoas entre vários grupos sem trocar o link.

**Como o sistema executa**

1. Escolhe o primeiro grupo ativo com membros abaixo do limite.
2. Regista o clique no contato.
3. Quando o grupo atinge o limite, passa para o seguinte.

**Regra em código**

```
g = groups.find(g => g.active && g.members < g.limit) ?? create_group()
log_click(c, g)
redirect(g.invite_url)
```

**Exemplo.** O grupo 1 tem 1.000 membros (limite). Maria é enviada para o grupo 2.

**Se este passo falhar.** O comparecimento cai. Os e-mails do passo 5 continuam como rede de segurança.

**Dados necessários:** `lista de grupos`, `limite por grupo`, `link de convite de cada grupo`

**Casos-limite**

- Todos os grupos cheios: abrir um novo grupo ou mostrar a página de acesso com aviso.
- Não é possível confirmar a entrada sem integração com o WhatsApp: tratar o clique como entrada provável.

**Envios · Grupo de WhatsApp 1** (proposta)

| # | Objetivo | Canal | Quando |
|---|---|---|---|
| 1 | Boas-vindas e regras do grupo | WhatsApp grupo | Entrada no grupo |
| 2 | Contagem regressiva | WhatsApp grupo | D-7 a D-1 |
| 3 | É hoje e Estamos ao vivo, com o link de acesso | WhatsApp grupo | D0 |

### Passo 4 · Automação nos grupos

**Nós:** Grupo de WhatsApp 1 (`grp_1`), Grupo de WhatsApp 2 (`grp_2`), Grupo de WhatsApp 3 (`grp_3`)

**Papel na lógica.** É a trilha coletiva de lembrete. O relógio é a data do webinar: a mesma mensagem sai para todos os grupos ao mesmo tempo.

| | |
|---|---|
| Contato chega | Membro de um grupo |
| Contato sai | Lembrado; clica no link de acesso no dia |
| Depende de | 3. Redirect para os grupos |
| Alimenta | 6. Página de acesso ao webinar |
| O que decide | Nada por contato. O grupo não segmenta. |

**O que acontece.** Os grupos recebem as mesmas mensagens ao mesmo tempo: boas-vindas, contagem regressiva e link de acesso no dia.

**Por que.** O WhatsApp é lido por quase todos. Os lembretes no grupo são o que mais aumenta o comparecimento.

**Como o sistema executa**

1. Agenda cada mensagem em relação à data e hora do webinar.
2. Publica em todos os grupos ativos.
3. O grupo fica fechado: só administradores enviam mensagens.

**Regra em código**

```
for msg in group_schedule:
  at(webinar.start + msg.offset):
    for g in groups.active: post(g, render(msg))
```

**Exemplo.** Na véspera às 19h, os três grupos recebem "É amanhã". No dia, recebem "É hoje" e "Estamos ao vivo" com o link de acesso.

**Se este passo falhar.** Menos pessoas aparecem no webinar.

**Dados necessários:** `data e hora do webinar`, `mensagens do grupo`, `link da página de acesso`

**Casos-limite**

- O grupo não segmenta: compradores também veem as mensagens seguintes.
- Um grupo criado depois (grupo 3) recebe só as mensagens futuras.

**Envios · Grupo de WhatsApp 1** (proposta)

| # | Objetivo | Canal | Quando |
|---|---|---|---|
| 1 | Boas-vindas e regras do grupo | WhatsApp grupo | Entrada no grupo |
| 2 | Contagem regressiva | WhatsApp grupo | D-7 a D-1 |
| 3 | É hoje e Estamos ao vivo, com o link de acesso | WhatsApp grupo | D0 |

### Passo 5 · E-mails de aquecimento

**Nós:** E-mails de aquecimento (`ai_aquecimento`)

**Papel na lógica.** É a trilha individual, paralela ao grupo. Garante que quem não entrou no grupo é convidado e lembrado.

| | |
|---|---|
| Contato chega | Inscrito |
| Contato sai | Inscrito que recebeu o link de acesso |
| Depende de | 2. Inscrição na landing page |
| Alimenta | 3. Redirect para os grupos; 6. Página de acesso ao webinar |
| O que decide | Que passos ainda estão no futuro e se ainda deve convidar para o grupo. |

**O que acontece.** Em paralelo aos grupos, o inscrito recebe 5 e-mails até o dia do webinar.

**Por que.** Garante que quem não entrou no grupo também é lembrado. Cada e-mail repete o convite para o grupo e o link de acesso.

**Como o sistema executa**

1. Inicia com lead.criado.
2. Calcula a data de cada envio a partir da data do webinar.
3. Não envia passos que já ficaram no passado.
4. Para no fim do webinar.

**Regra em código**

```
on lead.criado(c):
  for p in seq_aquecimento.passos:
    t = resolve(p.quando, webinar)
    if t > now: schedule(c, p, t)
```

**Exemplo.** Maria inscreve-se a D-4. Recebe a confirmação, salta o e-mail de D-7 (já passou) e recebe os de D-3 e D-1.

**Se este passo falhar.** Quem não está no grupo não fica a saber da data nem recebe o link.

**Dados necessários:** `data e hora do webinar`, `link do redirect`, `link da página de acesso`

**Casos-limite**

- Inscrição na véspera: recebe só o e-mail de confirmação e o "é amanhã" ou "é hoje".
- Descadastro: para a sequência e todas as seguintes.

**Envios · E-mails de aquecimento** (proposta)

| # | Objetivo | Canal | Quando |
|---|---|---|---|
| 1 | Confirmação da inscrição e convite para o grupo | E-mail | Logo após a inscrição |
| 2 | Convite para o grupo | E-mail | 1 dia após a inscrição |
| 3 | Contagem regressiva: faltam 7 dias | E-mail | D-7 |
| 4 | Contagem regressiva: faltam 3 dias | E-mail | D-3 |
| 5 | É amanhã: data, hora e link de acesso | E-mail | D-1 |

### Passo 6 · Página de acesso ao webinar

**Nós:** Acesso ao webinar (`pg_acesso`)

**Papel na lógica.** É onde as duas trilhas se encontram. Liga a identidade do contato à sua presença na sala.

| | |
|---|---|
| Contato chega | Inscrito com link de acesso |
| Contato sai | Contato com intenção registada, a caminho da sala identificado |
| Depende de | 4. Automação nos grupos; 5. E-mails de aquecimento |
| Alimenta | 7. Webinar |
| O que decide | Se o contato já é conhecido pelo link ou se é preciso pedir o e-mail. |

**O que acontece.** No dia, todos os links (grupo e e-mail) levam a uma página com o botão de entrada na sala.

**Por que.** Um link estável para todos os canais. A sala pode mudar sem editar mensagens, e o sistema sabe quem tentou entrar.

**Como o sistema executa**

1. O link de cada contato leva um identificador (?c=).
2. Regista acesso.visitado.
3. Encaminha para a sala com o mesmo identificador.

**Regra em código**

```
on visit(acesso):
  c = by_token(query.c) ?? ask_email()
  emit('acesso.visitado', c)
  redirect(sala_url + '?c=' + c.id)
```

**Exemplo.** Maria clica no e-mail (link com ?c=123) e entra identificada. Pedro clica no link do grupo, que não tem identificador, e escreve o e-mail antes de entrar.

**Se este passo falhar.** A presença fica anónima e a segmentação do passo 9 não é possível.

**Dados necessários:** `URL da sala`, `identificador do contato`

**Casos-limite**

- Link aberto sem identificador (vindo do grupo): pedir o e-mail antes de entrar.

### Passo 7 · Webinar

**Nós:** Webinar (`sala`)

**Papel na lógica.** É o centro do funil. Além de vender, produz os dados que dividem todo o resto.

| | |
|---|---|
| Contato chega | Contato identificado |
| Contato sai | Contato com presença, minuto de saída, pitch visto ou não, e compra ou não |
| Depende de | 6. Página de acesso ao webinar |
| Alimenta | 8. Decisão: comprou ou não comprou; 9. Segmentar quem não comprou |
| O que decide | Nada. Só regista eventos. |

**O que acontece.** O inscrito assiste à aula. Num minuto definido começa a oferta (pitch), com botão de compra.

**Por que.** É onde acontece a venda e onde nascem os dados que decidem os passos seguintes.

**Como o sistema executa**

1. Regista webinar.entrou e webinar.saiu com o minuto.
2. Emite oferta.exibida no minuto do pitch para quem está presente.
3. Emite oferta.clicada e compra.aprovada.
4. No fim da sessão emite webinar.encerrado.

**Regra em código**

```
on join(c): presence.open(c, minute)
on leave(c): presence.close(c, minute)
at pitch_minute: for c in present: emit('oferta.exibida', c)
```

**Exemplo.** Maria entra às 20h02. O pitch começa às 20h55. Ela sai às 21h10 sem comprar: fica marcada como presente em oferta.exibida.

**Se este passo falhar.** Sem presença registada todos caem em não acessou e recebem a mensagem errada.

**Dados necessários:** `minuto do pitch`, `link de compra`, `duração`

**Casos-limite**

- O contato entra e sai várias vezes: considerar o tempo total e se esteve presente no pitch.

### Passo 8 · Decisão: comprou ou não comprou

**Nós:** Comprou (`cond_comprou`), Não comprou (`cond_nao_comprou`)

**Papel na lógica.** É a bifurcação principal. Separa a trilha de venda (converter) da trilha de cliente (aumentar o valor do pedido).

| | |
|---|---|
| Contato chega | Participante ou inscrito |
| Contato sai | Comprador ou não comprador |
| Depende de | 7. Webinar |
| Alimenta | 9. Segmentar quem não comprou; 11. Upsell após a compra |
| O que decide | Comprou ou não. A compra é tratada em tempo real; os restantes, no fim da sessão. |

**O que acontece.** O funil divide-se em dois caminhos.

**Por que.** Comprador e não comprador precisam de mensagens opostas: um recebe ofertas complementares, o outro continua a receber a oferta principal.

**Como o sistema executa**

1. Comprou: tratado no instante de compra.aprovada, sem esperar o fim.
2. Não comprou: avaliado em webinar.encerrado para todos os inscritos sem compra.

**Regra em código**

```
on compra.aprovada(c, oferta_principal):
  c.estado = 'comprador'; cancel_sales(c); goto(upsell, c)
on webinar.encerrado:
  for c in inscritos where !c.comprou: goto(segmentar, c)
```

**Exemplo.** João compra às 20h58 e vê o upsell no mesmo instante. Maria não comprou e é avaliada às 21h30, quando a sessão termina.

**Se este passo falhar.** Compradores continuam a receber chamadas de venda do que já compraram.

**Dados necessários:** `eventos de compra`, `lista de inscritos`

**Casos-limite**

- Compra depois do fim do webinar: sai do caminho "não comprou" e entra no "comprou".

### Passo 9 · Segmentar quem não comprou

**Nós:** Não comprou (`cond_nao_comprou`), Facebook (`rmkt_facebook`)

**Papel na lógica.** É a personalização. Transforma comportamento observado em mensagem certa.

| | |
|---|---|
| Contato chega | Não comprador |
| Contato sai | Não comprador com um segmento e no público de remarketing |
| Depende de | 7. Webinar; 8. Decisão: comprou ou não comprou |
| Alimenta | 10. Sequências de follow-up |
| O que decide | O segmento, pela ordem de precedência. |

**O que acontece.** Quem não comprou é colocado em um de três segmentos e entra também no público de remarketing do Facebook.

**Por que.** Não acessou, saiu cedo e viu a oferta são situações diferentes. A mensagem certa para cada uma vende mais que uma mensagem igual para todos.

**Como o sistema executa**

1. Não acessou: nunca entrou na sala.
2. Saiu antes do pitch: entrou e saiu antes de oferta.exibida.
3. Assistiu o pitch: estava presente em oferta.exibida.
4. Precedência: assistiu > saiu antes > não acessou.
5. Envia a lista ao público de remarketing.

**Regra em código**

```
seg = viu_pitch(c) ? 'assistiu_pitch'
    : entrou(c) ? 'saiu_antes_pitch'
    : 'nao_acessou'
c.segmento = seg
audience.add('remarketing', c)
```

**Exemplo.** Maria estava presente no pitch: assistiu_pitch. Ana entrou às 20h05 e saiu às 20h30: saiu_antes_pitch. Rui nunca entrou: nao_acessou.

**Se este passo falhar.** Todos recebem a mesma sequência, e quem não viu nada recebe objeções de uma oferta que não conhece.

**Dados necessários:** `presença por contato`, `minuto do pitch`

**Casos-limite**

- Assistiu à gravação depois: reavaliar e subir de segmento.

### Passo 10 · Sequências de follow-up

**Nós:** Não acessou (`seq_nao_acessou`), Acessou e saiu antes do pitch (`seq_saiu_antes`), Assistiu o pitch (`seq_assistiu`)

**Papel na lógica.** É a última oportunidade de venda da oferta principal. Cada sequência remove a barreira específica do seu segmento.

| | |
|---|---|
| Contato chega | Não comprador com segmento |
| Contato sai | Comprador (volta ao passo 8 pelo ramo comprou) ou fim do prazo |
| Depende de | 9. Segmentar quem não comprou |
| Alimenta | 8. Decisão: comprou ou não comprou |
| O que decide | Antes de cada envio: se continua, se comprou, se mudou de segmento. |

**O que acontece.** Cada segmento recebe 8 e-mails até o fim da oferta.

**Por que.** Cada sequência resolve o que falta para aquela pessoa: assistir, ver a oferta ou superar uma objeção.

**Como o sistema executa**

1. Não acessou: primeiro a gravação, depois a oferta.
2. Saiu antes: apresentar a oferta que não viu.
3. Assistiu: um e-mail por objeção, bônus e garantia.
4. As três terminam com "encerra hoje" e "última chamada".
5. Saem na hora em que acontece compra.aprovada.

**Regra em código**

```
before_send(c, passo):
  if c.comprou or c.descadastrado: cancel(); return
  if c.segmento != seq.segmento: switch(c, equivalente(passo))
```

**Exemplo.** Maria recebe o e-mail da objeção 1 e da objeção 2. Compra no 3.º dia. A sequência é cancelada e ela segue para a trilha de cliente.

**Se este passo falhar.** Perde-se a venda de quem precisava de mais tempo.

**Dados necessários:** `prazo da oferta`, `link de compra`, `objeções principais`

**Casos-limite**

- Mudança de segmento: continuar na nova sequência a partir do passo equivalente, sem repetir.

**Envios · Não acessou** (proposta)

| # | Objetivo | Canal | Quando |
|---|---|---|---|
| 1 | Gravação disponível | E-mail | +1h |
| 2 | Gravação: o que você perdeu | E-mail | +1d |
| 3 | Principais pontos da aula | E-mail | +1d 20h |
| 4 | Apresentação da oferta | E-mail | +2d |
| 5 | Prova: resultados de alunos | E-mail | +2d 20h |
| 6 | Garantia | E-mail | +3d |
| 7 | Encerra hoje | E-mail | dia do fechamento |
| 8 | Última chamada | E-mail | dia do fechamento, 20h |

**Envios · Acessou e saiu antes do pitch** (proposta)

| # | Objetivo | Canal | Quando |
|---|---|---|---|
| 1 | Você saiu antes da melhor parte | E-mail | +1h |
| 2 | Gravação a partir do pitch | E-mail | +1d |
| 3 | Apresentação da oferta | E-mail | +1d 20h |
| 4 | Bônus | E-mail | +2d |
| 5 | Prova: resultados de alunos | E-mail | +2d 20h |
| 6 | Garantia | E-mail | +3d |
| 7 | Encerra hoje | E-mail | dia do fechamento |
| 8 | Última chamada | E-mail | dia do fechamento, 20h |

**Envios · Assistiu o pitch** (proposta)

| # | Objetivo | Canal | Quando |
|---|---|---|---|
| 1 | Resumo da oferta e link de compra | E-mail | +1h |
| 2 | Objeção 1 | E-mail | +1d |
| 3 | Objeção 2 | E-mail | +1d 20h |
| 4 | Objeção 3 | E-mail | +2d |
| 5 | Bônus | E-mail | +2d 20h |
| 6 | Garantia | E-mail | +3d |
| 7 | Encerra hoje | E-mail | dia do fechamento |
| 8 | Última chamada | E-mail | dia do fechamento, 20h |

### Passo 11 · Upsell após a compra

**Nós:** Comprou (`cond_comprou`), Upsell (`pg_upsell`), Comprou o upsell? (`cond_upsell`)

**Papel na lógica.** Abre a trilha de cliente. O objetivo deixa de ser converter e passa a ser aumentar o valor do pedido.

| | |
|---|---|
| Contato chega | Comprador |
| Contato sai | Comprador que aceitou ou recusou o upsell |
| Depende de | 8. Decisão: comprou ou não comprou |
| Alimenta | 12. Recusou o upsell: downsell e e-mails; 13. Obrigado e próxima oferta |
| O que decide | Nada; mostra a oferta e regista a resposta. |

**O que acontece.** Quem comprou vê logo uma oferta complementar, com compra em 1 clique.

**Por que.** Logo após comprar, a pessoa está mais disposta a comprar de novo e não precisa voltar a digitar o cartão.

**Como o sistema executa**

1. Mostra a página de upsell depois do pagamento aprovado.
2. Emite upsell.aceito ou upsell.recusado.

**Regra em código**

```
on compra.aprovada(c):
  show(upsell, one_click = c.payment_token)
on answer: emit(aceitou ? 'upsell.aceito' : 'upsell.recusado', c)
```

**Exemplo.** João vê o upsell em 1 clique logo após pagar e recusa.

**Se este passo falhar.** O ticket médio fica no valor da oferta principal.

**Dados necessários:** `oferta de upsell`, `pagamento em 1 clique`

**Casos-limite**

- Pagamento por boleto: mostrar o upsell só depois de pago, ou por e-mail.

### Passo 12 · Recusou o upsell: downsell e e-mails

**Nós:** Downsell (`pg_downsell`), Upsell por e-mail (`seq_upsell`)

**Papel na lógica.** É a recuperação do valor perdido no upsell. Duas tentativas em paralelo: uma imediata (downsell) e outra ao longo dos dias (e-mails).

| | |
|---|---|
| Contato chega | Comprador que recusou o upsell |
| Contato sai | Cliente com downsell ou upsell, ou cliente só com a oferta principal |
| Depende de | 11. Upsell após a compra |
| Alimenta | 13. Obrigado e próxima oferta |
| O que decide | Cancelar a sequência quando houver qualquer aceite. |

**O que acontece.** Quem recusa vê o downsell e entra numa sequência de 4 e-mails sobre o upsell.

**Por que.** O downsell recupera parte do valor no momento. Os e-mails dão uma segunda chance para quem recusou por impulso.

**Como o sistema executa**

1. Mostra o downsell na mesma sessão.
2. Inicia a sequência de upsell por e-mail.
3. Comprar o downsell ou o upsell cancela a sequência.

**Regra em código**

```
on upsell.recusado(c): show(downsell); start(seq_upsell, c)
on upsell.aceito(c) or downsell.aceito(c): cancel(seq_upsell, c)
```

**Exemplo.** João recusa também o downsell. Recebe os e-mails de upsell e compra no 2.º. A sequência para.

**Se este passo falhar.** O cliente que hesitou não recebe uma segunda oportunidade.

**Dados necessários:** `oferta de downsell`, `oferta de upsell`

**Casos-limite**

- Recusou o downsell também: segue para o obrigado e mantém a sequência de upsell.

**Envios · Upsell por e-mail** (proposta)

| # | Objetivo | Canal | Quando |
|---|---|---|---|
| 1 | Lembrete da oferta complementar | E-mail | +1h |
| 2 | Benefício principal | E-mail | +1d |
| 3 | Prova | E-mail | +2d |
| 4 | Último aviso | E-mail | +3d |

### Passo 13 · Obrigado e próxima oferta

**Nós:** Obrigado (`pg_obrigado`), Upsell (`ai_upsell_pos`)

**Papel na lógica.** Fecha a venda e inicia a relação. Aqui o contato passa a ser cliente.

| | |
|---|---|
| Contato chega | Comprador |
| Contato sai | Cliente com a próxima oferta agendada |
| Depende de | 11. Upsell após a compra; 12. Recusou o upsell: downsell e e-mails |
| Alimenta | — |
| O que decide | Quando enviar a próxima oferta. |

**O que acontece.** O comprador chega ao obrigado, recebe as orientações de acesso e, dias depois, um e-mail com a próxima oferta.

**Por que.** Confirmar a compra reduz pedidos de reembolso. O cliente satisfeito é o público mais barato para a próxima venda.

**Como o sistema executa**

1. Regista obrigado.visitado.
2. Agenda o e-mail da próxima oferta.

**Regra em código**

```
on obrigado.visitado(c):
  c.estado = 'cliente'
  schedule(c, proxima_oferta, now + N dias)
```

**Exemplo.** João chega ao obrigado, recebe as instruções de acesso e, dias depois, o e-mail da próxima oferta.

**Se este passo falhar.** Mais pedidos de suporte e de reembolso, e nenhuma venda seguinte.

**Dados necessários:** `instruções de acesso`, `próxima oferta`

**Casos-limite**

- Reembolso: cancelar o e-mail da próxima oferta.

**Envios · Upsell** (proposta)

| # | Objetivo | Canal | Quando |
|---|---|---|---|
| 1 | Próxima oferta | E-mail | alguns dias após a compra |

### Passo 14 · Regras que valem para todo o funil

**Papel na lógica.** É a camada que protege todos os passos. O motor aplica estas regras antes de cada envio.

| | |
|---|---|
| Contato chega | Qualquer envio agendado |
| Contato sai | Envio feito, suprimido ou cancelado |
| Depende de | — |
| Alimenta | — |
| O que decide | Se o envio ainda faz sentido no instante de sair. |

**O que acontece.** Regras gerais que o motor aplica em todos os passos.

**Por que.** Evitam mensagens erradas, duplicadas ou fora de hora.

**Como o sistema executa**

1. Compra encerra todas as sequências de venda daquela oferta.
2. Descadastro encerra todos os e-mails.
3. Cada envio é verificado no momento de sair: se a condição mudou, não envia.
4. Um evento recebido duas vezes não gera dois envios.
5. Envios por WhatsApp individual respeitam um horário de silêncio.

**Regra em código**

```
send(d):
  c = load(d.contato)
  if !condicao(d, c): return suppress(d)
  if already_sent(d.chave): return
  deliver(d)
```

**Exemplo.** Maria tinha a "Última chamada" agendada para as 20h. Comprou às 19h50. Às 20h o motor verifica, vê que comprou e não envia.

**Se este passo falhar.** Mensagens erradas, duplicadas ou fora de hora, e perda de confiança.

## 3. Referência

### Nós

| Nó | Tipo | Por que existe | Métricas |
|---|---|---|---|
| Facebook (`src_facebook`) | Origem | Cada origem tem custo e qualidade de lead diferentes. Separar por utm permite saber de onde vêm os compradores, não só os inscritos. | visitas, custo por lead, taxa de compra por origem |
| Instagram (`src_instagram`) | Origem | Mesmo motivo do Facebook: medir custo por lead e taxa de compra por origem. | visitas, custo por lead, taxa de compra por origem |
| YouTube (`src_youtube`) | Origem | Lead de YouTube costuma chegar com mais contexto (já assistiu vídeo). Medir à parte mostra se vale mais investimento. | visitas, custo por lead, taxa de compra por origem |
| Landing page (`pg_landing`) | Página | Uma página com uma única ação converte mais. É o ponto onde o visitante vira contato e onde toda a automação começa. | visitas, inscrições, taxa de conversão da página |
| E-mails de aquecimento (`ai_aquecimento`) | Automação individual | Nem todo inscrito entra no grupo. O e-mail garante que todos recebem o convite para o grupo e o link de acesso, e mantém o evento na memória até a data. | taxa de abertura, cliques no convite do grupo, cliques no link de acesso |
| Redirect (`lk_redirect`) | Redirect | Um único link para vários grupos. O WhatsApp limita o tamanho do grupo, e o redirect evita trocar links nas páginas e nos e-mails quando um grupo enche. | cliques, entradas por grupo |
| Grupo de WhatsApp 1 (`grp_1`) | Automação em grupos | O WhatsApp tem leitura muito maior que o e-mail. Os lembretes no grupo são o principal motor de comparecimento. | membros, saídas do grupo |
| Grupo de WhatsApp 2 (`grp_2`) | Automação em grupos | Capacidade extra: mesma automação do grupo 1. | membros, saídas do grupo |
| Grupo de WhatsApp 3 (`grp_3`) | Automação em grupos | Capacidade extra: mesma automação do grupo 1. | membros, saídas do grupo |
| Acesso ao webinar (`pg_acesso`) | Página | Um link estável para todos os canais. Permite trocar a sala sem editar mensagens, identificar quem clicou e medir a intenção de assistir. | visitas, cliques em entrar |
| Webinar (`sala`) | Sala de webinar | É onde a venda acontece e onde nascem os dados que decidem tudo o que vem depois: quem entrou, até quando ficou e se viu a oferta. | comparecimento (entrou ÷ inscritos), retenção até o pitch, cliques na oferta, vendas na sala |
| Não comprou (`cond_nao_comprou`) | Condição | Quem não comprou não é um grupo só. Quem não apareceu, quem saiu cedo e quem viu a oferta precisam de mensagens diferentes. | tamanho de cada segmento |
| Comprou (`cond_comprou`) | Condição | A compra muda o papel do contato: deixa de receber venda da oferta principal e passa a receber ofertas complementares. |  |
| Facebook (`rmkt_facebook`) | Anúncio | Anúncio alcança quem não abre e-mail. Reforça a mesma mensagem das sequências enquanto a oferta estiver aberta. | alcance, cliques, vendas atribuídas |
| Não acessou (`seq_nao_acessou`) | Automação individual | Essa pessoa ainda não viu nada. Vender antes de mostrar o conteúdo não funciona; primeiro ela precisa assistir à gravação. | assistiram à gravação, vendas |
| Acessou e saiu antes do pitch (`seq_saiu_antes`) | Automação individual | Ela confiou no conteúdo, mas não chegou à oferta. O que falta é apresentar a oferta, não repetir a aula. | viram a oferta, vendas |
| Assistiu o pitch (`seq_assistiu`) | Automação individual | Ela conhece a oferta e decidiu não comprar por enquanto. O que impede a compra são objeções; cada e-mail responde uma. | cliques por objeção, vendas |
| Upsell (`pg_upsell`) | Página | O momento de maior propensão de compra é logo após comprar. Uma oferta complementar em 1 clique aproveita esse momento. | taxa de aceite |
| Comprou o upsell? (`cond_upsell`) | Condição | Separa quem aceitou de quem recusou para não oferecer de novo o que já foi comprado. |  |
| Downsell (`pg_downsell`) | Página | Quem recusou o upsell pode aceitar uma versão menor. Recupera parte do valor sem pressionar. | taxa de aceite |
| Upsell por e-mail (`seq_upsell`) | Automação individual | Algumas pessoas recusam no impulso e decidem depois. A sequência dá uma segunda chance sem repetir a página. | vendas do upsell por e-mail |
| Obrigado (`pg_obrigado`) | Página | Confirma a compra, reduz ansiedade e orienta o primeiro acesso. É o fim do funil de venda e o início da entrega. | visitas |
| Upsell (`ai_upsell_pos`) | Automação individual | O cliente satisfeito é o público mais barato para a próxima venda. | vendas da próxima oferta |

### Ligações

| De | Para | Tipo | Rótulo | Explicação |
|---|---|---|---|---|
| Facebook | Landing page | navegacao |  |  |
| Instagram | Landing page | navegacao |  |  |
| YouTube | Landing page | navegacao |  |  |
| Landing page | Redirect | navegacao | após inscrição | Logo após a inscrição o navegador é redirecionado para o grupo. É o momento de maior interesse; pedir a entrada no grupo depois perde muita gente. |
| Landing page | E-mails de aquecimento | evento | lead.criado | O mesmo envio do formulário inicia a sequência de e-mails. As duas trilhas correm em paralelo. |
| Redirect | Grupo de WhatsApp 1 | ramo | grupo 1 |  |
| Redirect | Grupo de WhatsApp 2 | ramo | grupo 2 |  |
| Redirect | Grupo de WhatsApp 3 | ramo | grupo 3 |  |
| E-mails de aquecimento | Grupo de WhatsApp 1 | navegacao | convite | Todo e-mail de aquecimento traz o link do redirect para quem ainda não entrou no grupo. |
| E-mails de aquecimento | Acesso ao webinar | navegacao | link de acesso | No dia, o e-mail leva à página de acesso. |
| Grupo de WhatsApp 1 | Acesso ao webinar | navegacao |  |  |
| Grupo de WhatsApp 2 | Acesso ao webinar | navegacao | link de acesso |  |
| Grupo de WhatsApp 3 | Acesso ao webinar | navegacao |  |  |
| Acesso ao webinar | Webinar | navegacao | entrar | O botão leva à sala com o identificador do contato, para registrar presença. |
| Webinar | Não comprou | evento | webinar.encerrado | No fim da sessão o sistema avalia todos os inscritos que não compraram. |
| Webinar | Comprou | evento | compra.aprovada | A compra é tratada no momento em que acontece, sem esperar o fim do webinar. |
| Não comprou | Facebook | evento | público | Quem não comprou entra no público de remarketing. |
| Não comprou | Não acessou | ramo | não acessou |  |
| Não comprou | Acessou e saiu antes do pitch | ramo | saiu antes do pitch |  |
| Não comprou | Assistiu o pitch | ramo | assistiu o pitch |  |
| Comprou | Upsell | ramo | comprou | Após o pagamento aprovado, o comprador vê o upsell antes do obrigado. |
| Upsell | Comprou o upsell? | evento |  |  |
| Comprou o upsell? | Obrigado | ramo | comprou |  |
| Comprou o upsell? | Downsell | ramo | não comprou | Recusou o upsell: vê o downsell na mesma sessão. |
| Comprou o upsell? | Upsell por e-mail | ramo | não comprou | Recusou o upsell: também entra na sequência de e-mails do upsell. |
| Downsell | Obrigado | ramo | comprou | Comprou o downsell: segue para o obrigado e sai da sequência de upsell. |
| Obrigado | Upsell | evento | visitou | A visita ao obrigado agenda o e-mail da próxima oferta. |
| Não acessou | Comprou | retorno | compra |  |
| Acessou e saiu antes do pitch | Comprou | retorno | compra |  |
| Assistiu o pitch | Comprou | retorno | compra |  |
| Facebook | Comprou | retorno | compra |  |
| Upsell por e-mail | Obrigado | retorno | comprou |  |

### Tipos de nó

| Tipo | Descrição |
|---|---|
| `origem` | Fonte de tráfego. Define utm_source do lead. |
| `pagina` | Página do funil com uma ação única. Emite visita e conversão. |
| `link_whatsapp` | Link rotativo que distribui contatos entre grupos de WhatsApp. |
| `automacao_individual` | Sequência enviada a um contato por vez. Respeita segmento e eventos de saída. |
| `automacao_grupo` | Mensagens publicadas no grupo inteiro. Não segmenta. |
| `condicao` | Ponto de decisão. Cada contato segue um único ramo. |
| `sala_webinario` | Transmissão ao vivo ou automática. Fonte dos eventos de presença, oferta e compra. |
| `anuncio` | Público de remarketing alimentado pelo funil. |

### Tipos de ligação

| Tipo | Descrição |
|---|---|
| `navegacao` | O contato vai de um lugar a outro por clique ou redirecionamento. |
| `evento` | O sistema reage a um evento e aciona o próximo nó. |
| `ramo` | Saída de uma condição. O rótulo é o valor do ramo. |
| `retorno` | Link que leva de volta à compra. Oculta no mapa; aparece como selo no nó. |

### Segmentos

| Segmento | Regra |
|---|---|
| `nao_acessou` | inscrito AND NOT webinar.entrou durante a sessão |
| `saiu_antes_pitch` | webinar.entrou AND webinar.saiu antes de oferta.exibida AND NOT compra.aprovada |
| `assistiu_pitch` | presente em oferta.exibida AND NOT compra.aprovada |

- **Avaliado em:** `webinar.encerrado`.
- **Precedência:** comprou > assistiu_pitch > saiu_antes_pitch > nao_acessou.
- **Reavaliação:** Se o contato assistir à gravação, sobe de segmento e troca de sequência no passo equivalente.

## 4. A definir

- Conteúdo final de cada envio.
- Minuto do pitch em cada webinar.
- Prazo da oferta (data de "Encerra hoje").
- Limite de membros por grupo.
- Horário de silêncio do WhatsApp individual.
- Upsell para quem compra fora da sessão (pelos e-mails de follow-up): página de upsell no checkout ou só por e-mail.
