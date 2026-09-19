# NovaWebinar — aplicação SaaS autenticada

## Objetivo
Construir diretamente a experiência autenticada da NovaWebinar, sem landing page, com identidade premium clara, sidebar escura e destaques em vermelho. Os assets enviados serão usados como marca e banner; os dados demonstrativos ficarão claramente separados da futura informação real.

## Estrutura da aplicação
- Criar autenticação com email/password, perfis de utilizador e recuperação de palavra-passe. Deixar Google preparado, sem o tornar obrigatório nesta construção.
- Organizar todas as áreas sob uma estrutura autenticada partilhada, com sidebar fixa, topbar, pesquisa, notificações, ajuda e perfil.
- Criar destinos reais para Dashboard, Webinars, Calendário, Biblioteca, Chat e Interações, Participantes, Analytics e Configurações.
- Adaptar a navegação para desktop e telemóvel, incluindo menu recolhível.

## Experiências principais
- **Dashboard:** métricas, banner oficial, filtros, lista de webinars, próximo webinar, calendário e atalhos.
- **Webinars:** listagem completa, estados, ações funcionais e editor individual.
- **Criar webinar:** fluxo em seis etapas com validação e navegação persistente entre etapas.
- **Editor:** informações, origem do vídeo, agendamento/replay, comentários programados, audiência real/simulada separada, CTA e aparência. O vídeo aceita upload e fontes externas, inicialmente preparado para Bunny Stream, Panda Video, Vimeo e URL/HLS. Replay reutiliza exatamente o mesmo vídeo; não existe gravação ou criação de novo ficheiro.
- **Atendimento ao vivo:** caixa de entrada de conversas privadas, filtros e resposta por participante.
- **Sala pública:** vídeo e chat, estados AO VIVO/REPLAY, sincronização visual da sessão e CTA programado; no replay, controlos livres. Comentários programados são globais; mensagens escritas por participantes reais são privadas e visíveis apenas ao próprio participante e à equipa autorizada.
- **Analytics:** métricas reais separadas das simuladas, retenção, origem, dispositivo e Live vs Replay.
- **Biblioteca, Calendário, Participantes e Configurações:** interfaces funcionais com pesquisa, filtros, seleção e estados vazios/loading.

## Dados e segurança
- Criar estrutura multi-workspace com tabelas separadas para perfis, organizações, membros, webinars, sessões, vídeos, comentários programados, participantes, conversas e mensagens privadas, eventos de CTA, sessões de audiência, analytics e configuração de audiência.
- Aplicar isolamento por workspace e permissões no servidor; participantes nunca veem mensagens privadas de outros participantes.
- Preparar atualizações em tempo real para conversas privadas, respostas, presença e estado da sessão, sem bloquear vídeo ou analytics.
- Incluir dados demonstrativos na aplicação sem os misturar com métricas reais armazenadas.

## Identidade e componentes
- Aplicar a paleta grafite, branco, vermelho vivo/profundo e gradiente vermelho–laranja de forma controlada.
- Usar os logótipos e banners fornecidos como assets oficiais.
- Criar componentes reutilizáveis para navegação, métricas, estados, tabelas, filtros, formulários, stepper, gráficos e painéis laterais.
- Incorporar loading/skeleton, empty states, hover, feedback e microinterações discretas.

## Verificação
- Validar todos os destinos e ações principais no browser.
- Confirmar legibilidade e ausência de sobreposição em desktop e telemóvel.
- Confirmar autenticação, isolamento de dados, mensagens privadas e separação entre audiência real e simulada.
- Confirmar compilação e metadados próprios para cada página pública ou autenticada relevante.
