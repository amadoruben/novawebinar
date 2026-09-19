# Reconstrução do design system NovaWebinar

## Objetivo
Dar ao produto uma identidade editorial, madura e consistente, preservando integralmente funcionalidades, dados, permissões, autenticação, integrações, rotas, logo aprovado e comportamento das salas ao vivo.

## Implementação

### 1. Fundação visual e componentes partilhados
- Consolidar tokens semânticos de cor, tipografia, espaçamento, raios, elevação, estados e foco no tema global.
- Uniformizar botões, campos, selects, badges, tabs, tabelas, dialogs, dropdowns, skeletons e estados vazios.
- Criar padrões partilhados para títulos de página, feedback de ações e superfícies, reduzindo cartões, pílulas, sombras e cores decorativas desnecessárias.
- Registar tokens, regras de composição, acessibilidade e exemplos num documento de design system no repositório.

### 2. Estrutura autenticada
- Refinar sidebar e cabeçalho: separação clara do logo, navegação 14–15 px, ícones consistentes, ativo discreto e controlo de recolher sobre a divisória.
- Melhorar pesquisa, ações de cabeçalho, foco por teclado e comportamento expandido/recolhido.
- Preservar o N animado apenas no login/refresh, com um único ciclo e abertura imediata; usar skeletons nas navegações internas.

### 3. Páginas prioritárias do produto
- Reconstruir dashboard como resumo operacional, removendo o grande banner promocional e dando prioridade a números reais, agenda e webinars.
- Harmonizar listagem e criação de webinars, com ações claras, densidade útil e alternativa legível às tabelas em mobile.
- Aplicar o mesmo sistema a calendário, biblioteca, participantes, analytics, definições e suporte, sem alterar regras ou dados.
- Corrigir o overflow do calendário mobile, os formulários apertados em tablet e a navegação móvel das áreas de suporte.

### 4. Autenticação e robustez
- Unificar visualmente login, registo e recuperação, mantendo apenas o símbolo N no topo do login.
- Impedir que páginas protegidas iniciem pedidos antes de a sessão estar confirmada, mantendo autenticação obrigatória e sem bypasses.
- Corrigir a renderização não determinística do calendário para eliminar divergências entre servidor e navegador.
- Manter mensagens de erro legíveis e estados de carregamento coerentes.

### 5. Página pública
- Corrigir a quebra do título principal com composição responsiva e escala controlada.
- Substituir secções baseadas apenas em grandes mockups por apresentação HTML responsiva das funcionalidades já existentes, identificando claramente dados demonstrativos.
- Alinhar CTAs, navegação e rodapé com o novo sistema, sem inventar métricas, testemunhos, utilizadores ou funcionalidades.

## Detalhes técnicos
- Alterações concentradas no tema global, primitivos de interface, shell, autenticação e páginas existentes; sem migrações nem alterações à lógica dos players/live.
- As cores específicas hoje espalhadas serão convertidas em papéis semânticos de sucesso, aviso, erro, informação e marca.
- Tabelas críticas terão apresentação adaptada a mobile, preservando as mesmas ações e dados.
- O calendário usará identificadores de data determinísticos, independentes do locale do servidor.

## Validação
- Executar o typecheck, build e testes existentes relevantes.
- Verificar visualmente 1440, 768 e 390 px: landing, login, sidebar expandida/recolhida, dashboard, webinars, calendário e suporte.
- Confirmar contraste, foco visível, navegação por teclado, estados vazios, loading, overflow e ausência de erros de consola.
- Testar `/dashboard` sem sessão e confirmar redirecionamento direto para login sem aviso de erro.
- Não publicar.

## Limites
- Nenhuma alteração de base de dados, integrações, permissões, métricas ou conteúdo factual.
- Nenhuma mudança nos players, salas ao vivo ou replay.
- Se alguma verificação autenticada deixar de estar disponível durante os testes, a limitação será reportada sem criar contas ou dados reais.
