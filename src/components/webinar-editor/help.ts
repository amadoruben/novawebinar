/**
 * Uma ajuda do (i), em três partes: cabeça (o que faz, uma frase), tronco (a ilustração, em
 * help-scene.tsx) e membros (como usar e um exemplo). Pouco texto: o ecrã já diz o resto.
 */
export type Help = {
  title: string;
  /** O que faz, numa frase. */
  what: string;
  /** Como usar, por ordem: 1 a 4 passos curtos, com o verbo no imperativo. */
  steps: readonly string[];
  /** Um exemplo concreto (um webinar em Angola ou Portugal, com números e nomes), uma ou duas frases. */
  example: string;
  /** Opcional: um cuidado que evita um erro. */
  tip?: string;
};

const SAME_LINK = "Depois de partilhar o link, não mude o endereço: os links antigos deixam de abrir.";

/** Os textos do (i) de cada etapa e de cada secção do editor. */
export const HELP = {
  /* ---------- Início ---------- */

  inicio: {
    title: "Webinar e quem apresenta",
    what: "Dá nome ao webinar, cria o link da sala e mostra quem apresenta.",
    steps: [
      "Escreva o «Título» que o público vê.",
      "Copie o «Endereço da sala»: é o link a partilhar.",
      "Em «Quem apresenta», ponha a foto, o nome e uma linha sobre a pessoa.",
      "Em «Cartão do link», escolha como o link aparece no WhatsApp.",
    ],
    example: "«Como vender no Instagram sem anúncios», em …/w/vender-no-instagram, apresentado por Edna Kiala.",
    tip: SAME_LINK,
  },
  webinar: {
    title: "Webinar",
    what: "O título público, um nome só para a equipa e o endereço da sala.",
    steps: [
      "Escreva o «Título», curto e com a promessa da aula.",
      "Dê um «Nome interno» para o distinguir dos outros.",
      "Ajuste o «Endereço da sala» e copie-o.",
    ],
    example: "Título «Contabilidade simples para freelancers», nome interno «Contabilidade · outubro», endereço …/w/contabilidade-freelancers.",
    tip: SAME_LINK,
  },
  apresentador: {
    title: "Quem apresenta",
    what: "A foto, o nome e uma linha sobre quem fala, junto ao vídeo.",
    steps: ["Carregue uma «Foto» do rosto, de frente.", "Escreva o «Nome» e a «Descrição curta».", "Ligue o «Selo de verificado», se quiser."],
    example: "Edna Kiala, «Estrategista de vendas no Instagram», com o selo.",
    tip: "O selo só aparece na sala: veja-o na pré-visualização.",
  },
  partilha: {
    title: "Partilha e ligações",
    what: "Como o link aparece no WhatsApp, e o WebHook que avisa o seu sistema de cada entrada.",
    steps: [
      "Em «Cartão do link», escreva o título e a frase e escolha a imagem.",
      "Em «WebHook», cole o endereço do seu sistema e ligue «Enviar».",
      "Confirme a bola verde: está ligado.",
    ],
    example: "Cartão «Aula grátis: vender no Instagram», com «Ao vivo hoje às 20:00». Cada inscrição chega ao CRM pelo WebHook.",
    tip: "O WhatsApp guarda o cartão algum tempo: acerte-o antes de partilhar.",
  },

  /* ---------- Página de entrada ---------- */

  entrada: {
    title: "Página de entrada",
    what: "A página antes da sala: recolhe o contacto de quem entra.",
    steps: ["Escolha a página do Convertewebinar ou a sua.", "Deixe só os campos que vai usar.", "Escreva o texto do botão e escolha as cores."],
    example: "Nome e WhatsApp, botão «Quero assistir à aula» e barra de vagas a 87%.",
    tip: "Cada campo a mais faz perder inscrições.",
  },
  ligarPagina: {
    title: "Ligar a sua página",
    what: "Liga uma página de inscrição que já tem noutro sítio aos contactos e às automações.",
    steps: [
      "Carregue em «Criar o formulário».",
      "Copie o código e cole-o num bloco de HTML da sua página.",
      "Faça uma inscrição de teste e veja-a nos contactos.",
    ],
    example: "Página no WordPress com o código a meio e o botão «Entrar na aula» a levar à sala.",
    tip: "Num bloco de texto normal, o formulário não aparece.",
  },
  contactos: {
    title: "Captar contactos",
    what: "Os dados que a pessoa deixa para entrar; sem e-mail nem WhatsApp, não há a quem escrever.",
    steps: [
      "Toque no ícone ou no nome de um campo para o mudar.",
      "Ligue «Obrigatório» no que for indispensável.",
      "Use «Adicionar campo» para uma pergunta nova (até 8).",
      "Tire com o X o que não vai usar.",
    ],
    example: "Em Angola: «Nome completo» e «WhatsApp» obrigatórios, sem e-mail.",
    tip: "Precisa sempre de um contacto: e-mail ou WhatsApp.",
  },
  botaoVagas: {
    title: "Botão e vagas",
    what: "O texto do botão e uma barra de vagas opcional, por cima do título.",
    steps: ["Escreva no botão o que a pessoa ganha.", "Ligue a «Barra de vagas» e escreva a percentagem."],
    example: "«Quero assistir à aula» e «87% das vagas preenchidas».",
    tip: "Com 100%, parece que já não há lugar.",
  },
  coresPagina: {
    title: "Cores da página",
    what: "A cor do cartão e do botão; o texto ajusta-se sozinho.",
    steps: ["Escolha a cor do «Cartão».", "Escolha a cor do «Botão», de preferência a da marca.", "Para outra cor, abra a roda ou escreva o código."],
    example: "Cartão #0B1322 e botão #2563EB: o texto do botão fica branco.",
    tip: "No tema claro, o cartão escuro passa a branco.",
  },

  /* ---------- Vídeo ---------- */

  video: {
    title: "Vídeo",
    what: "O vídeo dá o tempo a tudo na sala: chat, audiência, oferta e vendas.",
    steps: ["Carregue em «Carregar vídeo» e escolha de onde vem.", "Espere que a barra chegue aos 100%.", "Escolha o «Formato da sala» e a aparência."],
    example: "Aula de 23 minutos em MP4 (1,8 GB), arrastada do computador; fica também na Biblioteca.",
    tip: "O YouTube não serve: mostra os controlos e as sugestões dele por cima da aula.",
  },
  formato: {
    title: "Formato da sala",
    what: "Como a sala se arruma à volta do vídeo: Webinar, com o chat ao lado, ou Live, com o chat por cima, como no Instagram.",
    steps: [
      "Escolha «Webinar» para uma aula com slides ou ecrã partilhado.",
      "Escolha «Live» para um vídeo gravado com o telemóvel.",
      "Veja como fica no computador, no tablet e no telemóvel, por cima da pré-visualização.",
    ],
    example: "Aula gravada com o telemóvel ao alto: Live. No telemóvel, o vídeo enche o ecrã.",
    tip: "A forma do vídeo vem do ficheiro; a sala ajusta-se sozinha a cada aparelho.",
  },
  transcricao: {
    title: "Transcrição",
    what: "O que o apresentador diz, minuto a minuto: dá os comentários, as perguntas e o minuto do pitch.",
    steps: [
      "Gere os comentários com IA no Chat: a transcrição faz-se aí.",
      "Toque numa frase para a sala ir a esse minuto.",
      "Abra «Ver a transcrição completa» para ler tudo.",
    ],
    example: "Aos 17:52 a Edna diz «vou mostrar-vos a mentoria»: é o minuto sugerido para a oferta.",
  },
  botaoEntrar: {
    title: "Botão de entrar",
    what: "Aparece ao centro do vídeo até a pessoa tocar para começar a ver.",
    steps: ["«Só o botão»: um botão a pulsar.", "«Botão com informação»: o botão com «Aula ao vivo»."],
    example: "No telemóvel, a Kátia toca em «Assistir agora»: o vídeo começa, já com som.",
  },
  aparencia: {
    title: "Aparência",
    what: "Se a sala e a página de entrada aparecem claras ou escuras.",
    steps: ["«Automático» segue o aparelho de quem vê.", "«Claro» ou «Escuro» fixa o mesmo tema para todos."],
    example: "Aula às 21:00: com «Automático», quem tem o telemóvel em modo escuro vê a sala escura.",
    tip: "Cada pessoa pode trocar o tema no ⚙ do vídeo.",
  },
  corBotao: {
    title: "Cor do botão",
    what: "A cor do botão e do cartão da oferta na sala.",
    steps: ["Escolha uma cor sugerida.", "Para a cor da marca, abra a roda ou escreva o código."],
    example: "Marca verde #16A34A: «Quero minha vaga» fica verde, com o texto branco.",
    tip: "«Ao vivo» é sempre vermelho e o + Seguir laranja: escolha uma cor que se distinga.",
  },
  seguir: {
    title: "Botão Seguir",
    what: "Os links das suas redes, para quem toca em + Seguir ou no nome de quem apresenta.",
    steps: [
      "Cole o link do perfil do Instagram.",
      "Use «Adicionar rede» para o YouTube, o TikTok ou o Facebook.",
      "Escolha em «Quando aparece o + Seguir» os minutos.",
    ],
    example: "instagram.com/ednakiala: no telemóvel abre na app; no computador, numa janela ao lado.",
    tip: "Sem nenhum link, o + Seguir não aparece.",
  },
  seguirMomentos: {
    title: "Quando aparece o + Seguir",
    what: "Os minutos em que o + Seguir aparece e sai; durante a oferta, nunca aparece.",
    steps: [
      "Leve o vídeo ao minuto certo e carregue em «Adicionar momento».",
      "Acerte «Aparece aos» e «Sai aos».",
      "Ligue «Quem já segue deixa de ver» para não repetir.",
    ],
    example: "Aos 04:10 a Edna diz «sigam-me no Instagram»: momento 04:10 → 04:40.",
    tip: "Dois momentos não se podem sobrepor.",
  },

  /* ---------- Chat ---------- */

  chat: {
    title: "Comentários simulados",
    what: "Comentários de pessoas simuladas, ao ritmo do que o apresentador diz.",
    steps: [
      "Escolha os países e o volume em «Quem está no chat».",
      "Escolha o tom e as regras.",
      "Gere os comentários: com IA, de uma folha ou à mão.",
      "Reveja-os em «Como ficou».",
    ],
    example: "Aula de 23 minutos para Angola e Portugal, tom «Vendas»: uns 8 comentários por minuto.",
    tip: "Gerar com IA substitui os gerados antes; os escritos à mão ficam.",
  },
  chatQuem: {
    title: "Quem está no chat",
    what: "De onde são as pessoas do chat e quantas escrevem.",
    steps: ["Em «Países», escolha um ou mais.", "Confira os nomes de exemplo.", "Escolha o «Volume do chat» ou escreva quantos por minuto (até 60)."],
    example: "Angola e Portugal com «Normal»: uns 12 comentários por minuto, de nomes como Kátia Domingos e Tiago.",
    tip: "O volume segue a Audiência: quando o número desce, o chat acalma.",
  },
  paises: {
    title: "Países do chat",
    what: "Os países de quem escreve: cada um muda o português e os nomes.",
    steps: ["Carregue em «Escolher países» e marque os do seu público.", "Tire um país com o X."],
    example: "Angola e Moçambique: «Boa noite, a ver de Luanda» e «Boa noite, malta de Maputo aqui».",
    tip: "Países que não são os do seu público tornam o chat falso.",
  },
  tom: {
    title: "Como escrevem",
    what: "O tom das mensagens e, à parte, se levam emojis.",
    steps: ["Escolha «Natural», «Vendas» ou «Formal».", "Leia as mensagens de exemplo.", "Ligue ou desligue «Com emojis»."],
    example: "Em «Vendas»: «Quero entrar. Até quando dá para comprar?»",
  },
  realismo: {
    title: "Para parecer real",
    what: "Regras para o chat parecer de pessoas reais, com alunos que já compraram.",
    steps: [
      "Ligue as regras que quer.",
      "Ligue «Alunos que já compraram» e escreva o nome do curso.",
      "Escolha quantos e quando: na aula ou na oferta.",
    ],
    example: "3 alunos da «Mentoria Vendas no Instagram», na oferta: «Já fiz e recomendo muito».",
    tip: "Ninguém promete resultados e nenhuma mensagem se repete.",
  },
  perguntas: {
    title: "Perguntas do apresentador",
    what: "Quando o apresentador pergunta algo, algumas pessoas do chat respondem.",
    steps: ["Ligue «O chat responde».", "Escolha quantas pessoas respondem.", "Toque numa pergunta para ver esse minuto."],
    example: "Aos 02:15, «De que cidade estão a ver?»: quatro respondem, «Luanda!», «Do Porto»…",
    tip: "As perguntas vêm da transcrição, feita ao gerar com IA.",
  },
  gerar: {
    title: "Gerar comentários",
    what: "Três maneiras de criar os comentários: com IA, de uma folha ou à mão.",
    steps: [
      "Com IA: confira o resumo e carregue em «Gerar comentários com IA».",
      "De uma folha: arraste um CSV com minuto, nome e mensagem.",
      "À mão: escolha o minuto, escreva e carregue em «Adicionar».",
    ],
    example: "Gera com IA e junta à mão, aos 18:05, «Acabei de entrar na mentoria!».",
    tip: "Com IA, usa créditos de IA.",
  },
  comoFicou: {
    title: "Comentários gerados",
    what: "Todos os comentários, minuto a minuto, para rever e corrigir.",
    steps: [
      "Toque num comentário: a sala vai a esse minuto e ele abre.",
      "Mude o minuto, o nome ou o texto e guarde.",
      "Escreva a «Mensagem fixada no chat».",
    ],
    example: "«Quanto custa em kwanzas?» aos 18:20 é cedo demais: passa para 21:05, depois do preço.",
  },
  avisoSuporte: {
    title: "Aviso do Suporte",
    what: "Se a pessoa não abrir a resposta do Suporte em 20 segundos, o chat avisa-a; só ela vê.",
    steps: ["Ligue «Avisar no chat quando o Suporte responde».", "Garanta quem responda: o Agente IA ou a equipa no Atendimento."],
    example: "A Celma pergunta por Multicaixa; 20 s depois da resposta, vê «@Você, já respondemos à sua dúvida».",
  },

  /* ---------- Audiência ---------- */

  audiencia: {
    title: "Audiência",
    what: "Quantas pessoas a sala diz que estão a ver, ao longo do vídeo.",
    steps: ["Indique com quantas começa e até quantas chega.", "Escolha o «Formato» da curva.", "Arraste no gráfico para ver cada minuto."],
    example: "Começa com 120 e chega a 480 aos 18:00, quando a oferta abre.",
    tip: "Use números credíveis para o seu público (máximo 50 000).",
  },
  audienciaFormato: {
    title: "Formato da audiência",
    what: "Como o número muda ao longo do vídeo, ou se mostra só quem está mesmo a ver.",
    steps: ["Escolha um formato simulado; «Acompanha a fala» é o recomendado.", "Ou escolha «Real + simulada», «Só a real» ou «Não mostrar»."],
    example: "«Dinâmica»: sobe no início, mantém-se a meio e desce no fim.",
    tip: "Com «Só a real» ou «Não mostrar», o gráfico desaparece.",
  },
  audienciaCurva: {
    title: "Como fica ao vivo",
    what: "O número de pessoas em cada minuto, com as ofertas, o + Seguir e as compras por baixo.",
    steps: ["Arraste no gráfico: a sala vai a esse minuto.", "Use ← e → para andar 5 segundos.", "Cada ponto verde é uma compra."],
    example: "Sobe até 480, a linha «Oferta 18:00» marca o pitch e há 10 compras depois dela.",
  },

  /* ---------- Oferta ---------- */

  oferta: {
    title: "Oferta",
    what: "O que vende na sala, para onde leva o botão e quando aparece.",
    steps: [
      "Ligue «Mostrar a oferta na sala».",
      "Escreva o nome e, se quiser, os preços.",
      "Escolha para onde leva o botão e cole o link.",
      "Escolha «Abre aos» e «Fecha aos».",
    ],
    example: "Mentoria de 100 000 Kz por 25 000 Kz, checkout da Kambafy, abre aos 18:00.",
    tip: "Pode juntar até 3 ofertas relâmpago: quando uma abre, a anterior fecha.",
  },
  urgencia: {
    title: "Cronómetro e prazo",
    what: "Dá pressa: um cronómetro na sala e um último dia que fecha também o replay.",
    steps: [
      "Escolha quantos minutos conta o cronómetro.",
      "Escolha se, no zero, o botão continua ou fecha.",
      "Escolha, se quiser, o «Último dia da oferta».",
    ],
    example: "10 minutos com «O botão continua»: aos 18:10 o cronómetro some e ainda dá para comprar.",
    tip: "Use «O botão fecha» só se o disser no pitch.",
  },
  depoisVideo: {
    title: "Quando a aula acaba",
    what: "Quanto tempo a sala fica aberta para comprar depois do vídeo.",
    steps: ["Escolha «Fecha já», 15 min, 30 min, 1 h ou 2 h.", "Veja como fica em «Ver a sala depois do vídeo»."],
    example: "Aula das 20:00 com 23 minutos e 30 min depois: a sala fecha às 20:53.",
  },
  utm: {
    title: "Origem das vendas",
    what: "Leva ao checkout de onde veio cada pessoa, para saber que anúncio vendeu.",
    steps: ["Ligue «Levar a origem ao checkout».", "Use nos anúncios o link da sala com utm_source e utm_campaign."],
    example: "…/w/aula?utm_source=instagram: o checkout recebe utm_source=instagram e o minuto do clique.",
    tip: "Sem anúncio, a origem fica «convertewebinar».",
  },

  /* ---------- Vendas ---------- */

  vendas: {
    title: "Vendas na sala",
    what: "Avisos de compra na sala, como «Helena comprou a Mentoria».",
    steps: ["Ligue as compras de demonstração e escolha quantas.", "Ligue as compras reais da Kambafy, se quiser.", "Escolha onde aparecem e a cor."],
    example: "10 compras de demonstração entre os 18:19 e os 22:43, depois do pitch.",
    tip: "As de demonstração nunca entram nas métricas.",
  },
  comprasReais: {
    title: "Compras reais",
    what: "As compras da Kambafy aparecem na sala no momento em que acontecem.",
    steps: ["Ligue a Kambafy em Integrações.", "Ligue «Mostrar as compras da Kambafy»."],
    example: "A Nádia paga às 19:30; segundos depois, a sala mostra «Nádia comprou…».",
    tip: "Só aparece o primeiro nome.",
  },
  vendasOnde: {
    title: "Onde aparecem",
    what: "Onde aparece o aviso de compra: no vídeo, no chat ou nos dois.",
    steps: ["Escolha «No vídeo», «No chat» ou «Nos dois»."],
    example: "«Nos dois»: um aviso por cima do vídeo e uma linha no chat.",
  },
  vendasCor: {
    title: "Cor do aviso",
    what: "A cor do aviso de compra, no vídeo e no chat.",
    steps: ["Escolha uma das 7 cores.", "Confirme que se distingue do botão da oferta."],
    example: "Botão laranja e aviso verde: não se confundem.",
  },
  vendasLinha: {
    title: "Na linha do vídeo",
    what: "As compras ao longo do vídeo: cada ponto é uma compra.",
    steps: ["Arraste no gráfico para ir a esse minuto.", "Toque num ponto para ver a compra a aparecer."],
    example: "Aos 20:00, o gráfico mostra «6 de 10 compras».",
  },

  /* ---------- Automações ---------- */

  automacoes: {
    title: "Automações",
    what: "As mensagens por WhatsApp e e-mail antes, durante e depois da sessão; editam-se no desenho do fluxo.",
    steps: [
      "Carregue em «Criar as automações base»; nascem desligadas.",
      "Veja cada automação por momento e se está ligada.",
      "Carregue em «Abrir o fluxo» para as escrever e ligar.",
    ],
    example: "Confirmação por WhatsApp na inscrição; no fim, cada segmento de quem não comprou recebe a sua mensagem.",
    tip: "Quem compra sai das automações de venda dessa oferta.",
  },

  /* ---------- Agente IA ---------- */

  agente: {
    title: "Agente IA",
    what: "Responde no Suporte da sala; o que não sabe ou não pode fazer passa à equipa.",
    steps: [
      "Âmbito: só este webinar ou todos os webinars da conta.",
      "Conhecimento: o que sabe e o simulador.",
      "Autonomia: até onde vai sem a equipa.",
      "Ligar: o nome no chat e o interruptor.",
    ],
    example: "«Equipa Edna» responde às dúvidas e envia o link da oferta; um pedido de desconto passa ao Atendimento.",
    tip: "Desligado, o Suporte vai directo para o Atendimento.",
  },
  autonomia: {
    title: "Autonomia",
    what: "Até onde o agente vai sem pedir à equipa.",
    steps: [
      "«Sugere»: escreve a resposta e a equipa aprova.",
      "«Controlo»: responde quando tem a certeza; na dúvida passa à equipa.",
      "«Automático»: responde a tudo o que sabe, sem revisão.",
    ],
    example: "Com «Controlo», envia o link da oferta sozinho, mas nunca dá desconto.",
    tip: "Comece por «Sugere» e suba quando confiar nas respostas.",
  },
  agenteFontes: {
    title: "Conhecimento",
    what: "De onde vêm as respostas: o webinar, a agenda, a oferta, a transcrição e o que escrever.",
    steps: [
      "O webinar, a agenda, a página de inscrição e a oferta vêm do editor (a oferta só depois de abrir).",
      "Ligue a «Transcrição do vídeo».",
      "Escreva as «Perguntas frequentes» e o «Produto e negócio».",
    ],
    example: "Às 17:50 ainda não diz o preço; às 18:05 responde «25 000 Kz» com o link.",
    tip: "Não escreva o preço noutro sítio: vale o da etapa Oferta.",
  },
  agenteEquipa: {
    title: "Passa à equipa quando",
    what: "Quando o agente pára e passa a conversa à equipa, no Atendimento.",
    steps: ["Ligue os casos: não sabe, pedem uma pessoa, é sobre pagamento.", "Responda a essas conversas no Atendimento."],
    example: "«Paguei e não recebi o acesso» vai para o Atendimento.",
    tip: "Tenha alguém no Atendimento durante a sessão.",
  },
  agenteNome: {
    title: "Ligar",
    what: "O nome com que o agente assina no Suporte e o interruptor.",
    steps: ["Escreva o nome; guarda-se sozinho.", "Ligue quando o simulador responder bem."],
    example: "«Equipa Vendas no Instagram».",
    tip: "Vazio, fica «Assistente».",
  },

  /* ---------- Agenda ---------- */

  agenda: {
    title: "Agenda",
    what: "Quando a sessão acontece; quem se inscreve não escolhe data, fica na próxima sessão.",
    steps: [
      "«Uma data»: uma sessão num dia e hora. Para um lançamento.",
      "«Repetir»: nos dias e horas que escolher. Para vender todas as semanas.",
      "«Just in time»: a cada 15, 30 ou 60 min. Para anúncios o dia todo.",
      "«Sempre disponível»: começa quando a pessoa entra. Para uma aula sem hora.",
    ],
    example: "Repetir às terças e quintas às 20:00: quem se inscreve na segunda vê «Começa a 13/10, 20:00» e fica nessa sessão.",
    tip: "Confirme o fuso: 20:00 em Luanda são 19:00 em Lisboa no inverno.",
  },
  agendaQuando: {
    title: "Quando",
    what: "O dia, a hora e o fuso da sessão.",
    steps: ["«Uma data»: escolha a data e a hora.", "«Repetir»: escolha os dias e as horas (até 6).", "Escolha o fuso da cidade onde marca a hora."],
    example: "Segundas e quartas às 13:00 e às 21:00, fuso de Lisboa: quatro sessões por semana.",
    tip: "Sem dias escolhidos, repete todos os dias.",
  },
  agendaIntervalo: {
    title: "Intervalo",
    what: "Com «Just in time», começa uma sessão a cada 15, 30 ou 60 minutos.",
    steps: ["Escolha o intervalo.", "Ligue «Sem sessões de noite» (das 22:00 às 07:00).", "Escolha o fuso do seu público."],
    example: "A cada 15 min: quem se inscreve às 14:07 entra às 14:15.",
  },
  agendaSessao: {
    title: "Sessão",
    what: "A espera antes da hora, o vídeo a acompanhar o relógio e o replay depois.",
    steps: [
      "«Sala de espera»: contagem até à hora.",
      "«Vídeo sincronizado»: quem chega às 20:05 vê a partir do minuto 5.",
      "«Replay»: quem faltou vê o mesmo vídeo depois.",
    ],
    example: "A Yola entra às 19:50 e vê a contagem; o Nelson entra às 20:05 e apanha o minuto 5.",
    tip: "Com «Sempre disponível», só há o replay.",
  },
} satisfies Record<string, Help>;

export type HelpTopic = keyof typeof HELP;
