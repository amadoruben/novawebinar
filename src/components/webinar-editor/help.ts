/** Os textos do (i) de cada etapa e de cada secção do editor. */
export const HELP = {
  inicio: {
    title: "Início",
    description: "Dá nome ao webinar e mostra quem apresenta.",
    items: [
      "O título é o que o público vê na página e na sala.",
      "O nome interno só a equipa vê, para distinguir sessões.",
      "O nome e o cargo de quem apresenta aparecem na sala, debaixo do vídeo.",
    ],
  },
  entrada: {
    title: "Página",
    description: "A página antes da sala. Não é uma página de vendas: serve para saber quem entra.",
    items: [
      "A pessoa vê o título com «Ao vivo», os campos e o botão. Ao carregar, entra logo na sala.",
      "Só na sala vê o chat e quantas pessoas estão a ver.",
      "Os dados alimentam as automações e a lista de contactos.",
      "Se já tem uma página, escolha «A minha página» e cole lá o formulário.",
    ],
  },
  pagina: {
    title: "Página",
    description: "O que a pessoa vê antes de entrar na sala.",
    items: [
      "O título do webinar (escolhido no Início) com «Ao vivo», os campos e o botão.",
      "Antes da hora da sessão, em vez de «Ao vivo» aparece a hora a que começa.",
      "O tema escuro ou claro escolhe-se na etapa Vídeo, em «Aparência da sala».",
    ],
  },
  contactos: {
    title: "Captar contactos",
    description: "Os dados que a pessoa deixa para entrar na sala.",
    items: [
      "Escolha os campos: nome, e-mail, WhatsApp e perguntas suas (empresa, cidade, profissão…).",
      "Pode tirar o nome ou o e-mail. Precisa sempre de um contacto: e-mail ou WhatsApp.",
      "No ícone troca o tipo, no nome muda o texto e o interruptor diz se é obrigatório. Na página, os obrigatórios levam *.",
      "Cada campo a mais faz perder entradas. Peça só o que vai usar.",
      "O WhatsApp começa com a bandeira do país de quem entra, pela localização; a pessoa pode trocar.",
    ],
  },
  video: {
    title: "Vídeo",
    description: "O vídeo dá o tempo a tudo o que acontece na sala: chat, oferta, audiência e vendas.",
    items: [
      "Carregue do computador, da Biblioteca, do Vimeo, Panda ou Bunny, ou por um link MP4 ou HLS.",
      "Ao criar os comentários, o sistema transcreve a fala e encontra o minuto do pitch.",
      "A aparência da sala pode ser escura, clara ou seguir o dispositivo de quem vê.",
    ],
  },
  chat: {
    title: "Chat",
    description: "Comentários simulados, sincronizados com o que o apresentador diz.",
    items: [
      "1. Estilo: tom, intensidade e se levam emojis.",
      "2. Regras para o chat parecer de pessoas reais.",
      "3. Gere a partir da fala, importe uma folha ou escreva à mão, no minuto exacto do vídeo.",
      "4. Veja todas as mensagens e carregue em «Ver na sala».",
      "Na sala, o coração e as reações só aparecem no separador Chat.",
    ],
  },
  tom: {
    title: "Tom e intensidade",
    description: "Como escrevem as pessoas do chat, e quantas vezes.",
    items: [
      "Natural: «Faz sentido, nunca tinha pensado no upsell assim»",
      "Vendas: «Quero entrar. Até quando dá para comprar?»",
      "Formal: «Excelente explicação sobre o ticket médio.»",
      "Intensidade: baixa, cerca de 5 por minuto; média, 9; alta, 15.",
    ],
  },
  realismo: {
    title: "Para não parecer falso",
    description: "Um chat perfeito demais afasta as pessoas. Estas regras fazem-no parecer de pessoas reais.",
    items: [
      "Nomes do país da sua audiência, sem o mesmo nome seguido.",
      "Escrevem uns segundos depois da frase, como quem está a ouvir.",
      "Algumas mensagens com escrita de telemóvel, sem erros que mudem o sentido.",
      "Há quem chegue atrasado e quem responda a outra pessoa.",
      "Mais gente a ver, mais comentários; menos gente, mais silêncio.",
      "Ninguém promete resultados nem inventa números, e nenhuma mensagem se repete.",
    ],
  },
  audiencia: {
    title: "Audiência",
    description: "Quantas pessoas a sala mostra e como esse número muda ao longo do vídeo.",
    items: [
      "Quantidade: o mínimo e o máximo, na mesma barra.",
      "Formato: escolha na lista; por baixo vê como fica ao vivo.",
      "Arraste o cursor no gráfico: o número muda e a sala mostra-o.",
    ],
  },
  oferta: {
    title: "Oferta",
    description: "O que vende, quando aparece e até quando.",
    items: [
      "Nome do produto, preço inicial e preço com desconto.",
      "A oferta abre e fecha nos minutos que escolher; a análise do vídeo sugere o minuto do pitch.",
      "Pode mostrar uma segunda oferta a seguir: quando ela abre, a primeira fecha.",
    ],
  },
  link: {
    title: "Checkout ou página de vendas?",
    description: "Na sala, quem clica já ouviu o pitch. Ir directo ao checkout tira um passo e vende mais.",
    items: [
      "Checkout: o recomendado para a maioria das ofertas.",
      "Página de vendas: para produtos caros ou que pedem mais argumentos.",
      "Abre sempre num separador novo, e a sala continua a correr.",
    ],
  },
  utm: {
    title: "Origem das vendas",
    description: "Cada clique na oferta leva até ao checkout a origem da pessoa.",
    items: [
      "Ligado, o link do botão leva o anúncio de onde a pessoa veio e o minuto do clique (UTM).",
      "Sem anúncio, a origem fica convertewebinar.",
    ],
  },
  pitch: {
    title: "Quando a oferta aparece",
    description: "O minuto em que o separador Oferta abre na sala.",
    items: [
      "Momento da análise: o sistema ouviu o vídeo e encontrou a transição para a oferta.",
      "Escolher o minuto: rode os minutos e os segundos, como no despertador.",
      "«Ver no vídeo» toca a pré-visualização uns segundos antes, para ver a oferta a abrir.",
    ],
  },
  urgencia: {
    title: "Urgência",
    description: "O que acontece depois de a oferta abrir.",
    items: [
      "O cronómetro conta 5, 10 ou 15 minutos (ou outra duração) a partir de quando a oferta abre.",
      "Quando chega a zero, o botão continua ou fecha, como escolher.",
      "O prazo da oferta: depois desse dia, o botão e o replay fecham.",
    ],
  },
  vendas: {
    title: "Vendas",
    description: "As compras que aparecem na sala.",
    items: [
      "As de demonstração só aparecem depois do pitch e nunca entram nas métricas.",
      "As reais vêm da Kambafy, no momento em que acontecem, só com o primeiro nome.",
      "Escolha se aparecem no vídeo, no chat ou nos dois.",
    ],
  },
  automacoes: {
    title: "Automações",
    description: "As mensagens antes e depois da sessão, por WhatsApp e e-mail.",
    items: [
      "Vivem no fluxo do webinar e editam-se lá.",
      "As automações base cobrem inscrição, sessão, fim e compra.",
      "Quem compra sai das sequências de venda dessa oferta.",
    ],
  },
  agente: {
    title: "Agente IA",
    description: "O agente da plataforma, a trabalhar neste webinar.",
    items: [
      "Responde no Suporte da sala, com o que autorizar.",
      "A autonomia diz o que faz sozinho e o que passa à equipa.",
      "O que não sabe passa ao Atendimento.",
    ],
  },
  autonomia: {
    title: "Autonomia",
    description: "Até onde o agente vai sem pedir.",
    items: [
      "Sugere: prepara a resposta e a equipa aprova.",
      "Executa com controlo: responde dentro das regras e passa à equipa o que é de risco.",
      "Automático: responde sozinho a tudo o que sabe.",
    ],
  },
  agenda: {
    title: "Agenda",
    description: "Quando a sessão acontece.",
    items: [
      "Uma data: uma sessão num dia e hora.",
      "Repetir: nos dias e horas que escolher, por exemplo terças e quintas às 20:00.",
      "Just in time: começa a cada 15, 30 ou 60 minutos, para quem chega; pode saltar a noite.",
      "Sempre disponível: o vídeo começa quando a pessoa entra.",
    ],
  },
} as const;

export type HelpTopic = keyof typeof HELP;
