# Automação de webinar: referência obrigatória

Antes de criar ou alterar qualquer parte do motor de automação (eventos, sequências, segmentos, disparos, grupos, upsell), leia estes arquivos em `docs/automacao/`:

1. `mapa-de-automacao.md`: lógica completa do funil. Contém o modelo mental, os 14 passos e a referência de nós, ligações e segmentos. Comece por aqui.
2. `mapa-de-automacao.json`: o mesmo grafo em dados. Use-o como seed e como fonte única do funil padrão.
3. `modelo-de-disparo.md` e `modelo-de-disparo.json`: motor de disparos. Contém fluxos, agendamento, estados do disparo, idempotência e os modelos de mensagem.
4. `engenharia-de-lancamentos.md`: entidades (oferta, avatar, objeções), fórmulas de planeamento e páginas.

## Regras

- Respeitar os marcadores: [FONTE] é regra de negócio; [PROPOSTA] pode ser ajustada, mas confirme antes de mudar.
- Compra aprovada cancela as sequências de venda daquela oferta.
- A condição de cada envio é avaliada no momento do envio, não no agendamento.
- Grupos de WhatsApp não segmentam; e-mail e WhatsApp individual sim.
- Um contato está numa única sequência por trilha.
- Nomes de eventos, segmentos e nós seguem exatamente os ids do `mapa-de-automacao.json`.
