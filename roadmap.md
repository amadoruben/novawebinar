# Roadmap

## Feito: carregamento inicial sem repetição
- [x] “N” animado apenas após login ou refresh completo do painel
- [x] Um único ciclo integral, sem cortes nem repetição
- [x] Esqueletos nos carregamentos internos de páginas, listas, métricas e editor
- [x] Salas live e replay continuam sem o indicador animado

## Feito: Engagement Intelligence 2.0 — Human Audience Model
Aprovado com 2 ajustes do utilizador: Audience State como estimativas (calibrável na Fase 3) e diversidade de reação ao mesmo momento. Implementado:
- [x] Correção "provocada": só quando o apresentador lê/cita o chat (segmento com readsChat); senão é espontânea no seu momento natural
- [x] Momentos semânticos (from/to/topic/summary/novelty/reactionUntil) — reações nascem depois de a ideia fechar
- [x] Personas: nível de conhecimento, ritmo próprio, chegadas tardias, evolução emocional, memória do que já foi explicado
- [x] Anti-repetição por intenção (elogio/descoberta/identificação/intenção com limites por bloco de 10 min)
- [x] Imperfeição humana controlada, silêncios e perguntas sem resposta, microconversas de 2–3 mensagens
- [x] Audience State como estimativas (estimated*) + regra de diversidade em todos os briefs
- [x] Migração 0022 (moments, audience_state em webinar_analysis) + ficheiro + journal
- [x] Typecheck/build OK
- Adiado de propósito: energia do apresentador por áudio (camada opcional, fora da primeira geração)

## Depois (bloqueado até teste do utilizador)
- Testar: regenerar o chat do Viver de Leilão completo e validar a jornada (chegada → reações → chamadas → evolução → oferta → CTA)
- Fase 3: previsão → comportamento real → erro da previsão → aprendizagem (webinar_prediction_snapshots já existe; falta recolha e ecrã)
- Domínio globalstream.live: concluir ativação

## Temporal Intelligence Engine
- [x] Tabela webinar_transcript_versions (provider, modelo, precisão, estado, fingerprint, palavras/frases/momentos/eventos)
- [x] Interface TranscriptionProvider desacoplada do fornecedor
- [x] AssemblyAI como motor principal (precisão por palavra, normalizado)
- [x] Fallback por blocos de áudio (precisão block, com margem de segurança)
- [x] Deteção determinística de eventos do apresentador
- [x] Temporal Validation Engine + testes A-E
- [x] Bloqueio da geração inteligente sem tempos fiáveis
- [x] Causalidade gravada em cada comentário gerado (trigger/relação/latência/motivo)
- [x] Interface de inspeção de palavras e comentários (Temporal Debug)
- [x] Teste E2E completo com "Viver de Leilão" (relatório em docs/teste-viver-de-leilao.md e na coluna report da versão)

### Falhas a corrigir depois do teste
- [ ] Reações com gatilho demasiado distante (24 casos acima de 45 s, máx. 89,9 s): rever escolha da âncora/frase e a janela máxima de reação
- [ ] Deteção de pedidos de localização/participação com verbos além de "coloca/escreve" (o pedido das 05:55 ficou sem respostas)


## Landing pública — tipografia e movimento de referência
- [x] Inter Variable e IBM Plex Mono locais
- [x] Título rotativo acessível com quatro frases
- [x] Showcase Preparar / Interagir / Acompanhar com progresso e teclado
- [x] Pausa global, pausa fora do viewport e reduced motion
- [x] Validação visual 1440 / 768 / 390, typecheck, build e testes

## Landing pública — copy e demonstrações fiéis ao produto
- [x] Confirmar recorrência, replay, chat programado, demonstração, IA, oferta e analytics no produto real
- [x] Substituir promessas genéricas por funcionalidades concretas e transparentes
- [x] Recriar agenda, sala, chat, assistência IA e analytics com apresentação pública sanitizada
- [x] Validar typecheck, build, links e 1440 / 768 / 390 sem overflow
