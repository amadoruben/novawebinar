# Engagement Intelligence — o chat com IA como diretor de engajamento

Evolução do módulo "Chat e Engajamento". O gerador rápido atual mantém-se; ao lado nasce um modo **Inteligente** que analisa o webinar inteiro antes de escrever uma única mensagem. Entrega em três fases.

---

## Fase 1 — Motor de análise e geração inteligente

### Mapa do webinar
A IA lê a transcrição completa e divide o webinar em trechos com significado (abertura, conteúdo, história, explicação técnica, prova social, objeção, transição para a oferta, preço, bónus, garantia, urgência, CTA, encerramento).

Cada trecho recebe notas internas: potencial de engajamento, risco de abandono, intensidade emocional, densidade de informação, intenção de compra, probabilidade de objeção e proximidade do CTA. Estes valores alimentam o motor; ao participante nunca aparecem.

### Risco de abandono
Cada trecho fica classificado em Baixo, Moderado, Alto ou Crítico, a partir de sinais como explicações longas, silêncio, repetição, tempo sem interação, transição para o pitch e apresentação do preço. Em risco alto o motor não despeja mensagens: cria uma intervenção adequada ao momento e varia a forma para não criar padrões.

### Causa e reação (ponto crítico)
Cada mensagem passa a ter, internamente, uma intenção (pergunta ao apresentador, reação, resposta, reação social, pedido de esclarecimento, resposta emocional, reação ao CTA) e uma relação temporal (antes da fala, depois da fala, dentro da janela).

Quando o apresentador diz "vi alguém perguntar…", "estou a ler os comentários", "fulano perguntou", a IA analisa o que ele responde a seguir e, só quando há coerência forte, cria a pergunta correspondente **antes** da fala. Reações nunca aparecem antes da causa; uma auditoria final reposiciona ou remove o que estiver fora de ordem.

### Conversas em vez de mensagens soltas
O motor constrói pequenos fios de conversa entre participantes (pergunta, resposta, seguimento), curtos e ligados ao que está a acontecer, evitando som de guião.

### Personas com memória
Para cada sessão são criadas personas simuladas com estilo próprio: entusiasta, racional, iniciante, reservada, participativa — cada uma com forma de escrever, uso de emojis e ritmo distintos. Ficam sempre marcadas como simuladas; nunca como clientes ou compradores reais.

Cada persona guarda o que já disse: experiência, estágio, localização, opinião e perguntas anteriores. Antes de escrever nova mensagem, o motor verifica esse histórico para não haver contradições ao longo da sessão.

### Curva natural e densidade adaptativa
Acaba a regra "nível alto = muitas mensagens". A quantidade passa a depender do momento: pode haver quarenta segundos com quinze interações e três minutos com duas. A curva segue chegada, arranque calmo, picos nas perguntas, reações pontuais nas histórias, silêncio nas partes técnicas, curiosidade na transição, objeções no preço, força no CTA e agradecimentos no fim. O silêncio é intencional e faz parte.

### Objetivo da geração
Antes de gerar, escolhe-se o objetivo: Retenção, Engajamento, Conversão ou Equilibrado. A escolha muda a estratégia, não apenas o número de mensagens.

### Princípio central
Se não houver razão convincente para existir uma mensagem naquele momento, não é gerada. Qualidade acima de quantidade.

---

## Fase 2 — Diagnóstico e otimização

### Heatmap do webinar
Régua do minuto zero ao fim, com cores de interesse alto, atenção média e risco de abandono, e marcadores de chat, pergunta, pico, risco, oferta e CTA. Clicar num ponto abre esse trecho.

### Insights da IA (coach do apresentador)
Lista de momentos com explicação em linguagem simples: trecho longo sem mudança de ritmo, pergunta com bom potencial, história com alta retenção, oferta que começa de forma abrupta, boa oportunidade de CTA.

### Engagement Rescue
Para cada trecho de baixa retenção previsto, sugestões concretas: acrescentar pergunta ao público, inserir comentário contextual, antecipar uma promessa, inserir CTA secundário ou encurtar o trecho no próximo webinar. Não se resolve tudo com mais comentários — também se melhora o próprio webinar.

### Score do webinar
Pontuação global mais retenção prevista, engajamento, clareza, ritmo, oferta e CTA, com as principais oportunidades encontradas. Cada oportunidade abre o minuto exato, explica o problema, sugere a melhoria e permite gerar a intervenção.

---

## Fase 3 — Aprendizagem com dados reais

Como ainda não há histórico suficiente, esta fase começa pela recolha: guardar a previsão da IA e comparar depois com o comportamento real (espectadores ativos, saídas por minuto, retenção, mensagens reais, cliques no CTA, conversões, replay, dispositivo e origem).

As conclusões só aparecem quando houver dados suficientes. Nada é inventado; enquanto não houver volume, a área mostra que ainda está a recolher.

---

## Já garantido e mantido

- Mensagens reais continuam privadas: cada participante vê apenas as suas e as respostas da equipa.
- No painel de operação, cada mensagem fica identificada como Real, IA/Simulado ou Equipa.
- Notificações de venda continuam separadas entre reais (por webhook do checkout) e demonstrativas, claramente marcadas. Nunca se apresenta uma compra fictícia como real.

---

## Detalhes técnicos

- Migração nova: tabela `webinar_analysis` (mapa semântico, trechos classificados, risco, insights, score, versão e data), com RLS por organização e GRANTs; colunas de intenção, relação temporal, persona e fio de conversa em `scheduled_comments`; tabela `webinar_prediction_snapshots` para a Fase 3.
- `src/lib/ai-comments.functions.ts`: nova função `analyseWebinarStructure` (mapa + riscos + insights + score) e reescrita das funções de janela para receberem o mapa, o objetivo e o estado das personas; auditoria temporal reforçada com validação de causa → reação e deteção de leitura de chat.
- `src/lib/ai-comment-jobs.ts`: novas etapas de progresso (analisar, mapear, planear estratégia, gerar por trecho, auditar), persistência do mapa e das personas durante o trabalho, mantendo o comportamento em segundo plano e a aprovação manual.
- Modo rápido atual preservado: o diálogo passa a ter dois modos, "Rápido" (atual) e "Inteligente" (novo motor), com o seletor de objetivo apenas no segundo.
- Editor `src/routes/webinars.$webinarId.edit.tsx`: nova vista de diagnóstico dentro do passo Chat (heatmap, insights, rescue, score) e ligação ao passo Linha de tempo existente.
- Cada chamada à IA continua fatiada por janelas curtas, com nova tentativa em falha, para nunca exceder o limite da plataforma.
