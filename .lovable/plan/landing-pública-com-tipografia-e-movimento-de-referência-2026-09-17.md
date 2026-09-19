# Landing pública com tipografia e movimento de referência

## Objetivo
Aproximar a landing pública da hierarquia tipográfica e do movimento verificados na referência, preservando o logo, a configuração do vídeo e todo o produto autenticado.

## Implementação
- Instalar e carregar localmente Inter Variable e IBM Plex Mono através de pacotes open-source, com suporte a PT-PT e sem depender dos assets da referência.
- Aplicar apenas à landing as métricas tipográficas indicadas: eixos variáveis, alternates, tamanhos, pesos, entrelinhas e tracking de título, navegação, corpo, botões e eyebrow.
- Substituir o título por um único H1 acessível com “A plataforma para” e uma área visual mascarada que alterna quatro frases sem provocar alterações de layout.
- Transformar a pré-visualização vazia do vídeo num showcase com separadores Preparar, Interagir e Acompanhar, progresso, seleção por clique/teclado e transições suaves; manter o player real intacto quando existir URL.
- Adicionar entradas de secção ao entrar no viewport, hover discreto nos visuais e transições curtas nos botões.
- Incluir “Pausar animações”, suspender ciclos fora do viewport ou com a aba oculta e durante hover/focus, com limpeza integral de timers e observers.
- Em `prefers-reduced-motion`, apresentar conteúdo estático, sem autoplay, transforms ou scroll suave.

## Validação
- Confirmar carregamento efetivo das fontes locais e os estilos computados do título.
- Verificar título rotativo, showcase, progresso, pausa, teclado, menu e CTAs.
- Testar 1440, 768 e 390 px sem overflow ou layout shift, incluindo reduced motion.
- Executar typecheck, build e testes existentes.
- Não publicar.
