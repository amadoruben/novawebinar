# NovaWebinar Design System

## Direção

Estúdio profissional de webinars: editorial, claro e preciso. O trabalho e os dados têm prioridade sobre decoração. O vermelho da marca identifica ações prioritárias e estados ativos; não é usado como preenchimento indiscriminado.

## Tokens

- `background`: fundo neutro da aplicação.
- `card` / `popover`: superfícies elevadas claras.
- `foreground` / `muted-foreground`: texto carvão e texto secundário.
- `primary`: vermelho da marca, reservado a ação principal, seleção e foco.
- `success`, `warning`, `info`, `destructive`: estados semânticos, sempre acompanhados por texto ou ícone.
- `border` / `input` / `ring`: divisórias, campos e foco.
- `--shadow-raised`: elevação subtil; `--shadow-overlay`: menus e diálogos.

## Tipografia e espaçamento

- Interface: Inter, pesos 400/500/600. Títulos usam 600, com escala controlada.
- Espaçamento segue incrementos de 4 e 8 px.
- Texto de navegação: 14–15 px; ícones: 18–20 px.
- Não usar tracking negativo. Conteúdo e controlos devem continuar legíveis a 200% de zoom.

## Forma e elevação

- Raio padrão: 8 px. Raios maiores apenas quando a função o exige, como avatar.
- Divisórias finas organizam secções. Sombras só comunicam elevação real.
- Evitar cartões dentro de cartões, pílulas decorativas, gradientes e ícones em quadrados coloridos.

## Componentes

- Uma ação primária por contexto. Secundárias usam `outline`; ações utilitárias usam `ghost`.
- Campos têm 40 px de altura, fundo de superfície, foco com borda e halo semântico.
- Tabs são navegação linear com sublinhado ativo, não botões em pílula.
- Badges são compactos e semânticos. Cor nunca é o único indicador.
- Tabelas usam cabeçalho neutro, linhas de 56–64 px e ações agrupadas. Em mobile, dados críticos passam a blocos verticais.
- Estados vazios explicam o que falta e oferecem apenas uma ação útil.
- Skeletons reproduzem a geometria do conteúdo; o N animado fica reservado ao login/refresh inicial.

## Acessibilidade

- Foco visível em todos os controlos interativos.
- Alvos táteis com pelo menos 40 px; 44 px quando isolados em mobile.
- Mensagens de erro usam `role="alert"`; feedback não urgente usa `role="status"`.
- Ícones decorativos são ocultados de tecnologias assistivas; botões só com ícone têm nome acessível.

## Regras de produto

- Preservar os assets aprovados do logo sem redesenho ou recoloração.
- Não inventar métricas, testemunhos, participantes ou resultados.
- Não aplicar este sistema aos controlos internos dos players ou às salas ao vivo sem uma decisão específica.
