# Teste end-to-end — "Viver de Leilão"

Versão de transcrição: `afb4b57d-c32c-47b2-974e-d59572804edd`
Geração de chat: trabalho `c44c497c-b34c-4103-ba14-017e1161a4df` (modo inteligente, 25 participantes, objetivo equilibrado)
Data: 16/09/2026

## 1. Base temporal

| Campo | Valor |
| --- | --- |
| provider / modelo | assemblyai / universal-2 |
| timestamp_precision | **word** |
| media_time_offset_ms | 0 (MP4 direto, start_time 0.000000) |
| duração | 4698 s |
| palavras | 13 012 |
| frases | 788 |
| eventos do apresentador | 169 (142 RHETORICAL_QUESTION, 17 REQUEST_TO_TYPE, 5 PRICE_REVEAL, 2 REQUEST_CONFIRMATION, 2 DIRECT_QUESTION, 1 CTA) |
| momentos semânticos (análise global) | 14 |

## 2. Totais da geração

| Métrica | Valor |
| --- | --- |
| Comentários gerados | 334 |
| Aprovados sem alteração | 199 |
| Reposicionados pelo validador | 26 (21 resposta-antecipada, 5 reação-antecipada) |
| Eliminados | 109 (65 resposta-tardia, 41 reação-tardia, 3 pretexto-inválido) |
| Regenerados | 0 (o pipeline atual reposiciona ou elimina; não regenera) |
| Finais na timeline | 225 |
| Latências negativas | 0 |
| Comentários sem causa (exceto espontâneos) | 0 |

Relações: 151 REACTION_TO_PRESENTER, 55 ANSWER_TO_PRESENTER, 18 SPONTANEOUS, 1 CAUSE_OF_PRESENTER_SPEECH.
Janelas falhadas: 0.

## 3. Amostra auditada (com verificação palavra a palavra)

### 04:19 — pedido de localização + pergunta sobre carros de leilão
Frase s45 = 259.518 → 267.418 ("Coloca aí de onde você está falando, coloca aí se vocês já trabalham com carro de leilões…").
Fim confirmado à palavra: `segmento` 266.218→266.978, `ou` 266.978→267.198, `não.` 267.198→267.418.

| Comentário | Em | Relação | Latência | Resultado |
| --- | --- | --- | --- | --- |
| "Seixal" | 269.000 | ANSWER | 1.582 s | PASS (reposicionado de antes do fim) |
| "Braga!" | 271.000 | ANSWER | 3.582 s | PASS (reposicionado) |
| "Vila Nova de Gaia 📍" | 273.000 | ANSWER | 5.582 s | PASS |
| "Sintra, ainda a tentar entender como funciona" | 278.000 | ANSWER | 10.582 s | PASS |
| "Porto" | 285.000 | ANSWER | 17.582 s | PASS |
| "Alverca, nunca mexi com leilões" | 293.000 | ANSWER | 25.582 s | PASS |

Nenhuma resposta antes de 267.418. Distribuição natural (6 respostas em 26 s, decrescente).

### 05:17–05:39 — quem é aluno, tempo de mercado e faturação
Evento e60 = 329.675 → 338.735 (REQUEST_TO_TYPE).

| Comentário | Em | Latência | Resultado |
| --- | --- | --- | --- |
| "Ainda não sou aluno, quero começar do zero" | 343.000 | 4.265 s | PASS |
| "Sou novato, estou a analisar a viabilidade fiscal" | 348.000 | 9.265 s | PASS |
| "Não sou aluno ainda, vim para aprender tudo hoje!" | 353.000 | 14.265 s | PASS |

### 05:55 — novo pedido de localização
Frase s65 = 354.835 → 360.615 ("comenta aí de onde você está falando"). **FAIL parcial: 0 respostas geradas.**
Causa: não foi classificado como evento (o detetor só reconhece "coloca/escreve" no início do pedido, não "comenta aí de onde"), por isso o gerador não reservou respostas para este pedido.

### 06:10 — quem já trabalha com carros de leilão
Evento e67 = 370.037 → 373.597.

| Comentário | Em | Latência | Resultado |
| --- | --- | --- | --- |
| "Não, nunca participei em nenhum leilão" | 377.000 | 3.403 s | PASS |
| "Eu já trabalho com revenda, mas em stands tradicionais" | 378.000 | 4.403 s | PASS (reposicionado) |
| "Não trabalho, trabalho em armazém mas quero sair logo que der" | 384.000 | 10.403 s | PASS |
| "Zero experiência com leilões por aqui" | 391.000 | 17.403 s | PASS |

### 09:18–09:35 — "Quantos já me conheciam?"
Evento e97 = 561.108 → 570.188. Fim confirmado à palavra: `trabalho?` 569.588→570.188.

| Comentário | Em | Latência | Resultado |
| --- | --- | --- | --- |
| "Cheguei por anúncio no Facebook" | 573.000 | 2.812 s | PASS |
| "Vim através de um anúncio no Instagram!" | 574.000 | 3.812 s | PASS (reposicionado) |
| "Já acompanhava o vosso trabalho pelo YouTube há uns meses" | 575.000 | 4.812 s | PASS (reposicionado) |
| "Primeira vez que vos oiço, vi um anúncio" | 579.000 | 8.812 s | PASS |
| "Vi um anúncio esta semana e decidi assistir" | 586.000 | 15.812 s | PASS |
| "Já vos conhecia das redes sociais 👍" | 592.000 | 21.812 s | PASS |

Cobre exatamente as quatro opções pedidas (primeira vez, anúncio, já conhecia, já acompanhava).

## 4. Falhas encontradas

1. **Reações demasiado afastadas do gatilho (24 casos acima de 45 s, máximo 89.862 s).**
   Exemplo: "Passar por obras quando se chega cá é duro demais…" em 523.000, gatilho s75 = 456.653→458.213, latência 64.787 s → FAIL de contexto.
   Exemplo: "Menos de 60€ por mês… não há desculpa nenhuma para não entrar." em 4458.000, gatilho s730, latência 89.862 s → FAIL de contexto.
   Diagnóstico: não é a transcrição. A IA devolve uma âncora aproximada e o resolvedor liga-a à frase mais próxima; como a janela máxima de reação é 90 s, o validador aceita. O erro está na escolha do gatilho (âncora/frase) e no limite de reação, não nos tempos por palavra.

2. **Respostas acima de 20 s após o pedido: 4 casos.** Aceitáveis, mas no limite do natural.

3. **Deteção de eventos enviesada para RHETORICAL_QUESTION (142 de 169) e zero REQUEST_LOCATION.**
   Pedidos reais de localização ("Coloca aí de onde você está falando", "comenta aí de onde você está falando") não viram evento; um deles salvou-se por cair na frase, o outro (05:55) ficou sem respostas.

4. **Nenhum comentário antecipado sobreviveu.** Nenhuma latência negativa, nenhuma resposta antes do fim da pergunta, nenhum espontâneo com informação futura (o validador eliminou 3 pretextos inválidos e todos os casos de conhecimento futuro).

## 5. Conclusão

A cadeia palavra → frase → momento → evento → causa → latência → comentário está a funcionar com os tempos reais do AssemblyAI: cada comentário final tem trecho, relação, latência e motivo, e é possível abrir qualquer mensagem e ver o trecho exato que a provocou.

Fica por corrigir (fora desta fase): a escolha do gatilho para reações distantes e a deteção de pedidos de localização/participação com verbos além de "coloca/escreve".
