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
    title: "Entrada",
    description: "O ecrã antes da sala. Não é uma página de vendas: serve para saber quem entra.",
    items: [
      "Ao chegar, a pessoa vê a aula a decorrer e o botão a piscar.",
      "Ao clicar, deixa os dados. Só depois entra na sala.",
      "Os dados alimentam as automações e a lista de contactos.",
      "Se já tem uma página, escolha «A minha página» e cole lá o formulário.",
    ],
  },
  pagina: {
    title: "Página",
    description: "O que a pessoa vê antes de entrar na sala, em três momentos.",
    items: [
      "1. Ao chegar: a aula a decorrer, desfocada por trás, «Ao vivo» a piscar e o botão. Sem título e sem número de pessoas.",
      "2. Ao clicar: abre o cartão com a etiqueta, o título, a descrição e os campos.",
      "3. Na sala: só depois de deixar os dados vê o chat e quantas pessoas estão a ver.",
      "Antes da hora da sessão, em vez de «Ao vivo» aparece a hora a que começa.",
    ],
  },
  contactos: {
    title: "Captar contactos",
    description: "Os dados que a pessoa deixa para entrar na sala.",
    items: [
      "Pede o nome completo e o e-mail, e o WhatsApp se o ligar.",
      "Em «Personalizar campos» diz se o WhatsApp é obrigatório. Na página, os obrigatórios levam *.",
      "Cada campo a mais faz perder entradas. Peça só o que vai usar.",
      "O WhatsApp começa com a bandeira e o código do país de quem entra, pela localização; a pessoa pode trocar.",
    ],
  },
  video: {
    title: "Vídeo",
    description: "O vídeo dá o tempo a tudo o que acontece na sala: chat, oferta, audiência e vendas.",
    items: [
      "Ao gerar os comentários, o sistema transcreve a fala e analisa cada momento.",
      "A análise encontra o minuto do pitch e os momentos em que se pode perder audiência.",
      "Aceita MP4 ou MOV até 5 GB, um vídeo da Biblioteca, de uma plataforma (Vimeo, Panda, Bunny) ou um link HLS.",
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
      "Formato: escolha na lista; por baixo vê como fica.",
      "Arraste o cursor no gráfico: o número muda e a sala mostra-o.",
      "O que o agente faz quando a audiência real cai está no Agente IA.",
    ],
  },
  oferta: {
    title: "Oferta",
    description: "O que vende, quando aparece e até quando.",
    items: [
      "Nome do produto, preço inicial e preço com desconto.",
      "A oferta abre no momento que a análise encontrou ou no minuto que escolher.",
      "O cronómetro começa quando a oferta abre.",
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
      "Cada clique no botão da oferta leva ao checkout o anúncio de onde a pessoa veio e onde clicou, com o minuto.",
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
      "A oferta abre no minuto escolhido.",
      "O cronómetro conta 5, 10 ou 15 minutos (ou outra duração) a partir daí.",
    ],
  },
  vendas: {
    title: "Vendas",
    description: "As compras que aparecem na sala.",
    items: [
      "As de demonstração só aparecem depois do pitch e nunca entram nas métricas.",
      "Aparecem no vídeo e ficam no chat.",
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
      "Repetir: todos os dias ou um dia por semana, à mesma hora.",
      "Just in time: começa a cada 15, 30 ou 60 minutos, para quem chega.",
      "Sempre disponível: o vídeo começa quando a pessoa entra.",
    ],
  },
} as const;

export type HelpTopic = keyof typeof HELP;
