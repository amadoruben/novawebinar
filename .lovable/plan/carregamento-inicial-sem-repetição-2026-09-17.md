# Carregamento inicial sem repetição

## Alterações
- Mostrar o “N” animado apenas no carregamento inicial completo do painel, incluindo após login ou refresh.
- Fazer a animação correr uma única vez, sempre desde o início até ao fim, sem cortes nem repetição.
- Trocar o indicador animado das páginas e listas internas por esqueletos estáticos adequados ao conteúdo.
- Manter as salas live e replay sem este indicador.

## Detalhes técnicos
- Criar uma versão não repetitiva do SVG com duração fechada e controlar uma única apresentação por carregamento do documento.
- Manter o ecrã inicial até terminar o ciclo completo; carregamentos internos seguem o estado real dos dados e usam esqueletos.
- Confirmar login, refresh e navegação interna no navegador, em desktop e mobile.
