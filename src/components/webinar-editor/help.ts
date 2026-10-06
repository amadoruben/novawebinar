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
      "«Adicionar campo» cria um campo novo: escreva o nome que quiser e escolha o ícone.",
      "Pode tirar o nome ou o e-mail. Precisa sempre de um contacto: e-mail ou WhatsApp.",
      "O interruptor diz se o campo é obrigatório. Na página, os obrigatórios levam *.",
      "Cada campo a mais faz perder entradas. Peça só o que vai usar.",
      "O WhatsApp começa com a bandeira do país de quem entra, pela localização; a pessoa pode trocar.",
    ],
  },
  video: {
    title: "Vídeo",
    description: "O vídeo dá o tempo a tudo o que acontece na sala: chat, oferta, audiência e vendas.",
    items: [
      "Carregue do computador, da Biblioteca (com a imagem de cada vídeo), do Vimeo, Panda Video ou Bunny Stream, ou por um link MP4 ou HLS. O YouTube não serve.",
      "Ao gerar os comentários, o sistema transcreve a fala e encontra o minuto do pitch. A transcrição completa abre ao lado.",
      "A aparência da sala pode ser escura, clara ou seguir o sistema de quem vê, como no YouTube.",
    ],
  },
  chat: {
    title: "Chat",
    description: "Comentários simulados, sincronizados com o que o apresentador diz.",
    items: [
      "Quem está no chat: os países (Angola, Moçambique, Brasil e Portugal, sozinhos ou misturados). Cada pessoa escreve no português do seu país, com nome e apelido de lá.",
      "O volume segue a Audiência: mais pessoas na sala, mais comentários por minuto.",
      "Como escrevem: o tom e os emojis. Para parecer real: as regras, com um exemplo de cada, e os alunos de um curso concreto.",
      "Perguntas do apresentador: o chat responde às perguntas que ele faz ao público.",
      "Gere com IA, importe uma folha ou escreva à mão. Em «Como ficou», clique num comentário para o ver na sala.",
    ],
  },
  tom: {
    title: "Tom e intensidade",
    description: "Como escrevem as pessoas do chat, e quantas vezes.",
    items: [
      "Natural: «Faz sentido, nunca tinha pensado no upsell assim»",
      "Vendas: «Quero entrar. Até quando dá para comprar?»",
      "Formal: «Excelente explicação sobre o ticket médio.»",
      "O volume segue a audiência: com 50 pessoas, cerca de 4 por minuto; com 600, 12; com 5000, 30.",
    ],
  },
  realismo: {
    title: "Para não parecer falso",
    description: "Um chat perfeito demais afasta as pessoas. Estas regras fazem-no parecer de pessoas reais.",
    items: [
      "Nome e apelido do país de cada pessoa, sem o mesmo nome seguido.",
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
      "Quantidade: um botão abre duas rodas, como no relógio do iPhone: com quantas a sala começa e até quantas chega.",
      "Formato: escolha na lista; por baixo vê como fica ao vivo.",
      "Arraste o cursor no gráfico: o número muda e a sala mostra-o.",
    ],
  },
  oferta: {
    title: "Oferta",
    description: "O que vende, quando aparece e até quando.",
    items: [
      "A oferta principal e, se quiser, outras a seguir: quando a seguinte abre, a anterior fecha.",
      "Cada oferta leva ao checkout, a uma página de vendas ou a um grupo do WhatsApp. No grupo, a pessoa confirma os dados antes de entrar e fica registada.",
      "Abre e fecha nos minutos que escolher (rodas como no iPhone, ou arrastando na linha). A análise do vídeo sugere o minuto do pitch: carregue em «Validar».",
      "Depois do vídeo, a sala pode ficar aberta para compras, com o Suporte a responder.",
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
      "Momento da análise: o sistema ouviu o vídeo e encontrou a transição para a oferta. «Validar» usa esse minuto.",
      "Escolher o minuto: clique no minuto e rode os minutos e os segundos, como no relógio do iPhone.",
      "«Ver na sala» toca a pré-visualização uns segundos antes, para ver a oferta a abrir.",
    ],
  },
  urgencia: {
    title: "Urgência",
    description: "O que acontece depois de a oferta abrir.",
    items: [
      "O cronómetro conta 5, 10, 15 ou 30 minutos a partir de quando a oferta abre.",
      "Se escolher, o botão fecha quando o cronómetro chega a zero.",
      "O prazo da oferta: depois desse dia, o botão e o replay fecham.",
    ],
  },
  vendas: {
    title: "Vendas",
    description: "As compras que aparecem na sala.",
    items: [
      "As de demonstração: escolha quantas. Só aparecem depois do pitch e nunca entram nas métricas.",
      "As reais vêm da Kambafy, no momento em que acontecem, só com o primeiro nome.",
      "Escolha onde aparecem (vídeo, chat ou os dois) e a cor do aviso.",
      "No gráfico, cada ponto é uma compra: clique para ver a sala nesse momento.",
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
