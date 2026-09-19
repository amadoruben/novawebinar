# Vistoria completa da plataforma NovaWebinar

Objetivo: percorrer todas as funcionalidades já existentes, encontrar o que está partido, incompleto ou frágil, corrigir e comprovar com testes repetidos. Sem funcionalidades novas.

## Como vai ser feito

### 1. Inventário e verificação estática
- Listar todas as páginas do painel e das salas públicas e todas as funções de servidor.
- Verificação de tipos e compilação limpas, sem avisos pendentes.
- Revisão de erros registados no navegador e no servidor.

### 2. Verificação da base de dados e segurança
- Analisador de segurança da base de dados: tabelas sem proteção, políticas em falta, permissões em falta.
- Conferir que cada tabela usada pela aplicação tem leitura/escrita coerentes com o que o ecrã faz.
- Confirmar isolamento entre espaços de trabalho (cada conta só vê os seus dados).

### 3. Testes funcionais reais (navegador, sessão autenticada)
Percorrer cada zona, com criação, edição, gravação, recarregamento e segunda verificação:
- Entrada, registo, recuperação de palavra-passe, sessão e terminar sessão.
- Painel, biblioteca, calendário, participantes, definições.
- Criação de webinar e editor completo: identidade, vídeo, agendamento, registo, sala, oferta, temporizadores, comentários programados, vendas, agente IA, partilha, integrações.
- Guardar em cada passo e confirmar que nada volta atrás depois de recarregar (o problema típico dos interruptores).
- Sala pública: espera, ao vivo, replay, contador de espectadores, chat, comentários programados, oferta com contagem, notificações de compra no vídeo e no chat.
- Chat e Suporte ao vivo: mensagens privadas, interruptor do assistente, escalação para humano, resposta da IA entregue mesmo com o assistente ligado e em pausa.
- Métricas e analítica: funil, "Chegou ao pitch", valores por webinar.

### 4. Testes dos motores
- Transcrição palavra a palavra: tempos reais, saltar para a palavra, cópia da transcrição.
- Geração de comentários: quantidades, ritmo, validação temporal, nada publicado sem razão causal.
- Vendas com IA: intervalos escolhidos, edição depois de aprovadas, momento certo a partir do início da oferta.
- Agente IA: modos, corte temporal, fontes, geração de conhecimento/FAQ/objeções.
- Correr a bateria de testes automáticos da validação temporal.

### 5. Correções
Cada falha encontrada é corrigida e reposta em teste até passar duas vezes seguidas. Nada é dado como resolvido sem nova verificação.

### 6. Relatório final
Lista, em linguagem simples, do que estava mal, do que foi corrigido e do que ficou por corrigir (com o motivo).

## Notas técnicas
- Testes de interface conduzidos por navegador automatizado com sessão real, viewport 1280x1800 e também 393x712 (telemóvel).
- Verificação de tipos com `tsgo`, testes unitários com `vitest`, análise de base de dados com o analisador do backend.
- Sem migrações destrutivas; correções de dados só se forem necessárias para repor coerência.
- Sem funcionalidades novas: apenas correção, consistência e robustez.
