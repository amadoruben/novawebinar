/** Uma ajuda do (i): para que serve, como usar por ordem, um exemplo e, se fizer falta, dicas. */
export type Help = {
  title: string;
  /** Para que serve, em uma ou duas frases. */
  what: string;
  /** Como usar, pela ordem em que se faz (3 a 5 passos, cada um uma frase com o verbo no imperativo). */
  steps: readonly string[];
  /** Um exemplo concreto e realista (um webinar de vendas em Angola ou Portugal, com números e nomes). */
  example: string;
  /** Opcional: 1 a 3 cuidados ou dicas que evitam erros. */
  tips?: readonly string[];
};

/** Os textos do (i) de cada etapa e de cada secção do editor. */
export const HELP = {
  /* ---------- Início ---------- */

  inicio: {
    title: "Webinar e quem apresenta",
    what: "Dá nome ao webinar, escolhe o endereço da sala e mostra quem fala. É o que o público lê na página de entrada, na sala e no link partilhado.",
    steps: [
      "Escreva o «Título»: é o que o público vê na página e na sala.",
      "Confirme o «Endereço da sala» e copie-o com o botão ao lado.",
      "Em «Quem apresenta», carregue a «Foto» e escreva o «Nome» e a «Descrição curta».",
      "Abra «Cartão do link» para escolher como o link aparece no WhatsApp.",
    ],
    example:
      "Título «Como vender no Instagram sem anúncios», nome interno «IG · turma de outubro», endereço …/w/vender-no-instagram. Apresenta Edna Kiala, «Estrategista de vendas no Instagram», com a foto dela.",
    tips: ["Depois de partilhar o link, não mude o endereço: os links antigos deixam de abrir a sala."],
  },
  webinar: {
    title: "Webinar",
    what: "O título que o público vê, um nome só para a sua equipa e o endereço da sala, que é o link que vai partilhar.",
    steps: [
      "Escreva o «Título», curto e com a promessa da aula.",
      "Dê um «Nome interno» para distinguir este webinar dos outros; só a sua equipa o vê.",
      "Ajuste o «Endereço da sala» em letras minúsculas, com hífenes em vez de espaços.",
      "Carregue no botão de copiar para levar o link para os anúncios e as mensagens.",
    ],
    example:
      "Título «Contabilidade simples para freelancers», nome interno «Contabilidade · Lisboa · outubro», endereço …/w/contabilidade-freelancers. O link copiado vai para a bio do Instagram e para o anúncio.",
    tips: [
      "Se deixar o endereço vazio, fica feito a partir do título.",
      "Depois de partilhar o link, não mude o endereço: os links antigos deixam de abrir a sala.",
    ],
  },
  apresentador: {
    title: "Quem apresenta",
    what: "A foto, o nome e uma frase sobre quem fala. Aparecem na sala, junto ao vídeo, e dão confiança a quem chega.",
    steps: [
      "Carregue em «Foto» e escolha uma imagem do rosto, de frente.",
      "Escreva o «Nome»: uma pessoa ou a sua empresa.",
      "Escreva a «Descrição curta»: o que a pessoa faz, numa linha.",
      "Ligue o «Selo de verificado» se quiser o selo ao lado do nome.",
    ],
    example:
      "Foto da Edna Kiala, nome «Edna Kiala», descrição «Estrategista de vendas no Instagram» e selo ligado. Na sala, o nome dela aparece com o selo ao lado, no Webinar e no Live.",
    tips: [
      "O selo não aparece no cartão do editor: só na sala, com o desenho de cada formato. Veja-o na pré-visualização.",
    ],
  },
  partilha: {
    title: "Partilha e ligações",
    what: "Como o link da sala aparece quando alguém o partilha no WhatsApp, e o WebHook, que avisa o seu sistema de cada entrada e de cada clique na oferta.",
    steps: [
      "Abra «Cartão do link» e escreva o «Título do cartão»; vazio, usa o título do webinar.",
      "Escreva a «Frase por baixo» e carregue uma «Imagem», se quiser.",
      "Abra «WebHook», cole o «Endereço» do seu sistema e ligue «Enviar».",
      "Confirme a bola verde ao lado de cada linha: quer dizer que está ligado.",
    ],
    example:
      "Cartão com o título «Aula grátis: vender no Instagram», a frase «Ao vivo hoje às 20:00» e a foto da Edna. WebHook para https://crm.minhaloja.ao/webhook: cada inscrição e cada clique no botão da oferta chega ao CRM, em JSON.",
    tips: [
      "O WebHook só envia com um endereço válido e com «Enviar» ligado.",
      "O WhatsApp guarda o cartão durante algum tempo: acerte-o antes de começar a partilhar o link.",
    ],
  },

  /* ---------- Página de entrada ---------- */

  entrada: {
    title: "Página de entrada",
    what: "A página antes da sala. Não é uma página de vendas: serve para saber quem entra e para alimentar os contactos e as automações.",
    steps: [
      "Escolha «Página do Convertewebinar» ou «A minha página».",
      "Deixe em «Captar contactos» só os campos que vai usar.",
      "Escreva o «Texto do botão» e, se quiser, ligue a «Barra de vagas».",
      "Escolha as «Cores» do cartão e do botão e veja o resultado na pré-visualização.",
    ],
    example:
      "Webinar «Como vender no Instagram»: página do Convertewebinar com Nome e WhatsApp, botão «Quero assistir à aula» e barra de vagas a 87%. Quem preenche entra na sala e passa a receber as mensagens pelo WhatsApp.",
    tips: [
      "Cada campo a mais faz perder entradas.",
      "Se já tem uma página feita, escolha «A minha página» e cole lá o formulário.",
    ],
  },
  pagina: {
    title: "Página",
    what: "O que a pessoa vê antes de entrar na sala: o título com «Ao vivo», os campos e o botão. O chat e o número de pessoas a ver só aparecem na sala.",
    steps: [
      "Confirme o título: vem do Início.",
      "Veja o selo: antes da hora mostra «Começa às 20:00»; à hora, passa a «Ao vivo».",
      "Confira a ordem dos campos e os obrigatórios, marcados com *.",
      "Escolha o tema claro ou escuro na etapa Vídeo, em «Aparência».",
    ],
    example:
      "Sessão marcada para as 20:00 em Luanda. Às 18:30, a página mostra «Começa às 20:00»; às 20:00 passa a «Ao vivo». A Kátia escreve o nome e o WhatsApp, carrega no botão e entra na sala.",
    tips: ["No tema claro, o cartão escuro da página passa a branco."],
  },
  ligarPagina: {
    title: "Ligar a sua página",
    what: "Para quem já tem uma página de inscrição feita noutro sítio. Quem se inscreve lá entra nos contactos e nas automações, como quem entra pela página do Convertewebinar.",
    steps: [
      "Copie o «Link da sala» e ponha-o no botão da sua página.",
      "Carregue em «Criar o formulário», se o código ainda não existir.",
      "Copie o «Código para colar na sua página» e cole-o no editor da sua página.",
      "Faça uma inscrição de teste e confirme que aparece nos contactos.",
    ],
    example:
      "A Edna tem a página de inscrição no WordPress. Cola o código a meio da página e põe o link da sala no botão «Entrar na aula». Quem se inscreve no WordPress entra na automação de inscrição do fluxo, como os outros.",
    tips: ["Cole o código num bloco de HTML ou de código: num bloco de texto normal, o formulário não aparece."],
  },
  contactos: {
    title: "Captar contactos",
    what: "Os dados que a pessoa deixa para entrar na sala. São a base dos contactos e das automações: sem e-mail nem WhatsApp, não há a quem enviar mensagens.",
    steps: [
      "Clique no ícone de cada campo para o trocar e no nome para o reescrever.",
      "Ligue «Obrigatório» nos campos sem os quais a pessoa não entra.",
      "Carregue em «Adicionar campo» para uma pergunta nova (até 8 campos).",
      "Tire com o X o que não vai usar; «Repor» volta a pôr o nome, o e-mail ou o WhatsApp.",
    ],
    example:
      "Webinar em Angola, onde quase tudo se resolve pelo WhatsApp: «Nome completo» e «WhatsApp» obrigatórios, sem e-mail. Um campo novo, «Qual é o seu negócio?», opcional, com um ícone à escolha.",
    tips: [
      "Precisa sempre de um contacto: e-mail ou WhatsApp.",
      "Cada campo a mais faz perder entradas. Peça só o que vai usar.",
      "O WhatsApp leva a bandeira e o indicativo do país; a pessoa pode trocá-los.",
    ],
  },
  botaoVagas: {
    title: "Botão e vagas",
    what: "O texto do botão que leva à sala e uma barra opcional, «92% das vagas preenchidas», por cima do título, para dar pressa.",
    steps: [
      "Escreva o «Texto do botão» com o que a pessoa ganha ao carregar.",
      "Ligue a «Barra de vagas» com o interruptor.",
      "Escreva a percentagem, de 0 a 100.",
      "Veja na pré-visualização a barra por cima do título.",
    ],
    example: "Botão «Quero assistir à aula» e barra de vagas a 87%. A página mostra «87% das vagas preenchidas», na cor do botão.",
    tips: ["Use um número credível: com 100%, parece que já não há lugar."],
  },
  coresPagina: {
    title: "Cores da página",
    what: "A cor do cartão onde ficam os campos e a cor do botão. O texto ajusta-se sozinho para se ler bem.",
    steps: [
      "Escolha a cor do «Cartão» numa das sugestões.",
      "Escolha a cor do «Botão»; de preferência, a da sua marca.",
      "Abra a roda de cores ou escreva o código, por exemplo #E8440C, para uma cor que não está nas sugestões.",
      "Confirme na pré-visualização que o botão se destaca do cartão.",
    ],
    example: "Marca de Lisboa em azul: cartão #0B1322, azul-noite, e botão #2563EB. O texto do botão fica branco sozinho.",
    tips: ["No tema claro, o cartão escuro passa a branco: veja a página nos dois temas."],
  },

  /* ---------- Vídeo ---------- */

  video: {
    title: "Vídeo",
    what: "O vídeo dá o tempo a tudo o que acontece na sala: chat, audiência, oferta e vendas. Aqui carrega o vídeo, escolhe o formato da sala e personaliza-a.",
    steps: [
      "Carregue em «Carregar vídeo» e escolha a origem: «Do computador» (MP4 ou MOV, até 5 GB), «Da Biblioteca», «De uma plataforma» (Vimeo, Panda Video, Bunny) ou «Por link».",
      "Acompanhe o envio na barra com a percentagem; pode pausar, retomar ou cancelar.",
      "Escolha o «Formato da sala»: Webinar ou Live.",
      "Personalize a «Aparência», a «Cor do botão» e o «Botão Seguir».",
      "Veja a «Transcrição» depois de gerar os comentários no Chat.",
    ],
    example:
      "A Edna gravou uma aula de 23 minutos em MP4 (1,8 GB). Arrasta o ficheiro para «Do computador», a barra chega aos 100% e o vídeo fica escolhido e guardado na Biblioteca. Escolhe o formato Live, porque gravou com o telemóvel ao alto.",
    tips: [
      "O YouTube não serve: mostra os controlos e as sugestões dele por cima da aula.",
      "Se a ligação cair, o envio continua.",
    ],
  },
  formato: {
    title: "Formato da sala",
    what: "Como a sala se arruma à volta do vídeo. Webinar: vídeo deitado e o chat ao lado. Live: vídeo com o chat por cima, como no Instagram, em ecrã inteiro e com fundo preto.",
    steps: [
      "Escolha «Webinar» para uma aula gravada deitada, com slides ou ecrã partilhado.",
      "Escolha «Live» para um vídeo gravado com o telemóvel, com o chat por cima da imagem.",
      "Confirme no Live a opção «No computador»: «Horizontal (16:9)» ou «Vertical (9:16)». Vem lida do ficheiro do vídeo, mas pode trocá-la.",
      "Veja o resultado na pré-visualização, no telemóvel e no computador.",
    ],
    example:
      "Aula de 23 minutos gravada com o telemóvel ao alto: formato Live, e o sistema escolhe «Vertical (9:16)». No telemóvel o vídeo enche o ecrã; no computador fica ao alto, ao centro, com fundo preto.",
    tips: [
      "Com o Vimeo, o Panda ou o Bunny nem sempre dá para ler a orientação: confirme-a à mão.",
      "A aparência, a cor do botão e o + Seguir são iguais nos dois formatos.",
    ],
  },
  transcricao: {
    title: "Transcrição",
    what: "O texto do que o apresentador diz, minuto a minuto. Serve para criar os comentários, encontrar as perguntas e o minuto do pitch e sugerir os momentos do + Seguir.",
    steps: [
      "Gere os comentários com IA no Chat: a transcrição é feita nesse momento.",
      "Leia aqui as frases à volta do minuto em que o vídeo está.",
      "Carregue em «Ver a transcrição completa» para abrir todas as frases ao lado.",
      "Clique numa frase para a sala ir a esse minuto.",
    ],
    example:
      "Aula de 23 minutos com 214 frases. Aos 17:52 a Edna diz «Agora vou mostrar-vos como entrar na mentoria»: é o minuto que a análise sugere para abrir a oferta.",
    tips: ["Sem transcrição, não há perguntas do apresentador nem sugestões para o + Seguir."],
  },
  aparencia: {
    title: "Aparência",
    what: "Se a sala e a página de entrada aparecem claras ou escuras.",
    steps: [
      "Escolha «Automático» para seguir o telemóvel ou o computador de quem vê.",
      "Escolha «Claro» ou «Escuro» para fixar o mesmo tema para todos.",
      "Veja a sala e a página de entrada na pré-visualização.",
    ],
    example:
      "Webinar às 21:00 em Luanda, quando muitos telemóveis já estão em modo escuro: com «Automático», a sala aparece escura a esses e clara a quem tem o telemóvel em modo claro.",
    tips: ["Cada pessoa pode trocar o tema no ⚙ do vídeo."],
  },
  corBotao: {
    title: "Cor do botão",
    what: "A cor do botão e do cartão da oferta na sala. O texto do botão ajusta-se sozinho para se ler.",
    steps: [
      "Escolha uma das cores sugeridas em «Botão e oferta».",
      "Abra a roda de cores para uma cor que não está nas sugestões.",
      "Escreva o código da cor, por exemplo #16A34A, para acertar na cor da marca.",
      "Veja na pré-visualização o botão e o cartão da oferta.",
    ],
    example:
      "Mentoria com a marca em verde: código #16A34A. O botão «Quero minha vaga» fica verde com o texto branco; o selo «Ao vivo» continua vermelho.",
    tips: [
      "«Ao vivo» fica sempre vermelho e o + Seguir sempre no laranja da marca: escolha uma cor que não se confunda com eles.",
    ],
  },
  seguir: {
    title: "Botão Seguir",
    what: "Os links das suas redes. Quem toca em + Seguir, na foto ou no nome do apresentador vê estas redes e pode segui-lo.",
    steps: [
      "Cole o link do perfil do Instagram na primeira linha.",
      "Carregue em «Adicionar rede» para juntar o YouTube, o TikTok ou o Facebook.",
      "Tire uma rede com o X ao lado.",
      "Marque em «Quando aparece o + Seguir» os minutos em que o botão aparece.",
    ],
    example:
      "Instagram https://www.instagram.com/ednakiala e YouTube https://www.youtube.com/@ednakiala. No telemóvel, cada rede abre na app; no computador, numa janela pequena ao lado da sala.",
    tips: ["Cole o link completo do perfil, como no exemplo da caixa.", "Sem nenhum link, o + Seguir não aparece."],
  },
  seguirMomentos: {
    title: "Quando aparece o + Seguir",
    what: "Os minutos em que o botão + Seguir aparece na sala. Sem momentos, não aparece sozinho; durante a oferta, nunca aparece, para não tirar a atenção da compra.",
    steps: [
      "Leve o vídeo ao minuto em que o apresentador pede para seguir e carregue em «Adicionar momento».",
      "Carregue, em alternativa, num dos minutos de «Na transcrição, pede para seguir em:»: são os momentos em que ele diz «sigam» ou «inscrevam-se».",
      "Acerte o minuto exacto na roda, em «Aos».",
      "Escolha quanto tempo fica à vista: 15 s, 30 s ou 60 s.",
    ],
    example:
      "Aos 04:10 a Edna diz «sigam-me no Instagram para mais dicas». A transcrição sugere 04:10 e ela junta-o com 30 s: o + Seguir aparece das 04:10 às 04:40 e não volta durante a oferta, que abre aos 18:00.",
    tips: [
      "Ponha pelo menos um link em «Botão Seguir», senão o botão não aparece.",
      "Dois momentos não se podem sobrepor.",
    ],
  },

  /* ---------- Chat ---------- */

  chat: {
    title: "Comentários simulados",
    what: "Comentários de pessoas simuladas, sincronizados com o que o apresentador diz. Fazem a sala parecer cheia e respondem às perguntas dele.",
    steps: [
      "Escolha em «Quem está no chat» os países e o volume.",
      "Ajuste em «Como escrevem» e em «Para parecer real» o tom e as regras.",
      "Ligue em «Perguntas do apresentador» as respostas do chat.",
      "Crie os comentários em «Gerar comentários»: com IA, de uma folha ou à mão.",
      "Reveja-os em «Como ficou» e clique num para o ver na sala.",
    ],
    example:
      "Webinar de 23 minutos para Angola e Portugal, com cerca de 300 pessoas na sala: tom «Vendas» com emojis, as 5 regras ligadas e 3 alunos da «Mentoria Vendas no Instagram» na oferta. O chat corre a uns 8 comentários por minuto.",
    tips: ["Gerar com IA usa créditos de IA e substitui os comentários gerados antes; os escritos à mão ficam."],
  },
  chatQuem: {
    title: "Quem está no chat",
    what: "De onde são as pessoas do chat e quantas escrevem. Cada uma escreve no português do seu país, com nome e apelido de lá.",
    steps: [
      "Escolha os «Países»: Angola, Moçambique, Brasil e Portugal, sozinhos ou misturados.",
      "Confira em «Nomes» exemplos de quem vai escrever.",
      "Escolha o «Volume do chat»: «Menos», «Normal» ou «Mais».",
      "Carregue em «Seguinte» para passar a «Como escrevem».",
    ],
    example:
      "Webinar para Angola e Portugal, com 600 pessoas na sala: «Normal» dá cerca de 12 comentários por minuto, escritos por nomes como Edson Mateus, Kátia Domingos, Inês e Tiago.",
    tips: [
      "O volume segue a Audiência: quando o número de pessoas desce, o chat acalma.",
      "Se a sala não mostra o número de pessoas, o ritmo é o de uma sala com 100.",
    ],
  },
  tom: {
    title: "Como escrevem",
    what: "O tom das mensagens e se levam emojis. Por baixo do tom, vê três mensagens de exemplo, com nomes dos países escolhidos.",
    steps: [
      "Escolha o «Tom»: «Natural», «Vendas» ou «Formal».",
      "Leia as três mensagens de exemplo no tom escolhido.",
      "Ligue «Com emojis» para um chat mais animado.",
      "Carregue em «Seguinte» para passar a «Para parecer real».",
    ],
    example:
      "No tom «Natural»: «Faz sentido, nunca tinha pensado nisso assim». No tom «Vendas»: «Quero entrar. Até quando dá para comprar?». Numa aula de contabilidade em Lisboa, «Natural» sem emojis soa mais verdadeiro.",
    tips: ["No tom «Formal» não há emojis."],
  },
  realismo: {
    title: "Para parecer real",
    what: "Um chat perfeito demais afasta as pessoas. Estas regras fazem-no parecer de pessoas reais, e alguns alunos contam que já compraram.",
    steps: [
      "Ligue as regras que quer: «Escrevem com atraso», «Há quem chegue atrasado», «Conversam entre si», «Escrita de telemóvel» e «Acompanham a audiência».",
      "Ligue «Alunos que já compraram» para algumas pessoas dizerem que já são alunas.",
      "Escreva em «Alunos de quê?» o nome do curso.",
      "Escolha «Quantos» (de 1 a 8) e «Quando»: «Na oferta» ou «Na aula».",
    ],
    example:
      "As 5 regras ligadas e 3 alunos da «Mentoria Vendas no Instagram», na oferta. Nos primeiros minutos alguém escreve «Já começou? A ver de Luanda»; depois de a oferta abrir, a Kátia Domingos escreve, com a etiqueta «Aluno do curso»: «Já fiz a Mentoria Vendas no Instagram e recomendo muito».",
    tips: ["Ninguém promete resultados nem inventa números, e nenhuma mensagem se repete."],
  },
  perguntas: {
    title: "Perguntas do apresentador",
    what: "Quando o apresentador pergunta algo ao público, algumas pessoas do chat respondem, como numa live a sério. As perguntas são encontradas na transcrição do vídeo.",
    steps: [
      "Ligue «O chat responde».",
      "Escolha «Quantas pessoas respondem a cada pergunta»: «2 a 3», «3 a 5» ou «5 a 8».",
      "Confira a lista das perguntas encontradas, com o minuto de cada uma.",
      "Clique numa pergunta para ver a sala a tocar nesse minuto.",
    ],
    example:
      "Aos 02:15 a Edna pergunta «De que cidade estão a ver?». Com «3 a 5», quatro pessoas respondem uns segundos depois, por exemplo «Luanda!» e «Do Porto».",
    tips: ["As perguntas só aparecem depois da transcrição, que é feita ao gerar os comentários com IA."],
  },
  gerar: {
    title: "Gerar comentários",
    what: "Três maneiras de criar os comentários do chat: com IA a partir da fala do vídeo, de uma folha que já tem, ou um a um à mão.",
    steps: [
      "Escolha «Com IA», «De uma folha» ou «À mão».",
      "Com IA, confira o resumo, carregue em «Gerar comentários com IA» e, no fim, em «Rever os comentários gerados».",
      "Com uma folha, arraste-a para a caixa: CSV ou copiada do Excel, com três colunas, minuto, nome e mensagem.",
      "À mão, escolha o minuto na roda, escreva o comentário e carregue em «Adicionar».",
    ],
    example:
      "Aula de 23 minutos: com IA, o sistema lê a fala, encontra as perguntas e os momentos fortes, escreve no português de cada país e aplica as regras. Depois, a Edna junta à mão, aos 18:05, «Acabei de entrar na mentoria!», para reforçar a oferta.",
    tips: [
      "Com IA usa créditos de IA. Os gerados substituem os gerados antes; os escritos à mão e os da folha ficam.",
      "Na folha, uma linha sem nome recebe um nome dos países escolhidos; linhas sem minuto ou sem mensagem ficam de fora.",
    ],
  },
  comoFicou: {
    title: "Como ficou",
    what: "A lista de todos os comentários, minuto a minuto, e a mensagem fixada no topo do chat.",
    steps: [
      "Clique num comentário: a sala vai para esse minuto e mostra-o.",
      "Passe o rato por cima de um comentário e carregue no caixote do lixo para o apagar.",
      "Carregue em «Ver o chat a correr na sala» para o ver ao ritmo do vídeo.",
      "Escreva a «Mensagem fixada no chat», que fica no topo do chat.",
    ],
    example:
      "248 comentários de 64 pessoas. Aos 18:20 aparece «Quanto custa em kwanzas?», que a Edna prefere tirar: apaga-o e fixa no chat «Bem-vindos! Escrevam de que cidade estão a ver».",
  },
  avisoSuporte: {
    title: "Aviso do Suporte",
    what: "Quando o Suporte responde a uma pessoa e ela não abre a resposta em 20 segundos, o chat mostra-lhe «@Você, já respondemos à sua dúvida». Só ela vê. Funciona nos dois formatos, Webinar e Live.",
    steps: [
      "Ligue «Avisar no chat quando o Suporte responde».",
      "Ligue o Agente IA ou tenha alguém da equipa no Atendimento, para haver quem responda no Suporte.",
      "Faça um teste: escreva no Suporte da sala e espere pela resposta sem a abrir.",
    ],
    example:
      "A Celma pergunta no Suporte «Dá para pagar por Multicaixa Express?». A resposta chega, mas ela está a ver o vídeo. 20 segundos depois, aparece-lhe no chat «@Você, já respondemos à sua dúvida» e ela abre a resposta.",
    tips: ["Mais ninguém vê o aviso: o chat continua igual para os outros."],
  },

  /* ---------- Audiência ---------- */

  audiencia: {
    title: "Audiência",
    what: "Quantas pessoas a sala diz que estão a ver e como esse número muda ao longo do vídeo. O número também dá o ritmo ao chat.",
    steps: [
      "Escolha «Escrever» ou «Definir nas rodas».",
      "Indique com quantas pessoas a sala «Começa com» e até quantas «Chega até».",
      "Escolha na lista o «Formato» da curva.",
      "Arraste o cursor em «Como fica ao vivo» para ver o número em cada minuto.",
    ],
    example:
      "Webinar «Como vender no Instagram», 23 minutos: começa com 120 pessoas e chega até 480, no formato «Cresce até à oferta». O número sobe até às 480 pessoas aos 18:00, quando a oferta abre, e depois desce devagar.",
    tips: [
      "Use números que façam sentido para o seu público: 5 000 pessoas numa aula de nicho não convencem.",
      "O máximo fica sempre acima do mínimo; o limite é 50 000.",
    ],
  },
  audienciaFormato: {
    title: "Formato da audiência",
    what: "Como o número de pessoas muda ao longo do vídeo, ou se a sala mostra só quem está mesmo a ver.",
    steps: [
      "Abra a lista e leia, por baixo, o que faz o formato escolhido.",
      "Escolha um formato simulado: «Acompanha a fala» (recomendado), «Dinâmica» ou «Cresce até à oferta».",
      "Escolha «Real + simulada» para somar o número simulado a quem está mesmo a ver.",
      "Escolha «Só a real» ou «Não mostrar» se não quer número simulado.",
      "Confira a curva em «Como fica ao vivo».",
    ],
    example:
      "Aula de contabilidade em Lisboa, 40 minutos, com «Dinâmica»: o número sobe nos primeiros minutos, mantém-se a meio e desce no fim, como numa live real.",
    tips: ["Com «Só a real» ou «Não mostrar», as rodas e o gráfico desaparecem."],
  },
  audienciaCurva: {
    title: "Como fica ao vivo",
    what: "O gráfico de quantas pessoas a sala mostra em cada minuto, com o que acontece por baixo: as ofertas, o + Seguir e as compras.",
    steps: [
      "Arraste no gráfico: o vídeo vai para esse minuto e a sala mostra o número.",
      "Use as setas ← e → do teclado para andar 5 segundos de cada vez.",
      "Leia as faixas por baixo: em cima as ofertas (laranja a principal, âmbar as relâmpago), em baixo o + Seguir, a azul.",
      "Veja os pontos verdes na curva: cada um é uma compra.",
      "Confira na legenda quantas ofertas, momentos do + Seguir e compras há.",
    ],
    example:
      "Aula de 23 minutos: a curva sobe até 480 pessoas, a linha tracejada «Oferta 18:00» marca o pitch, uma faixa âmbar mostra a oferta relâmpago das 21:00 às 23:00, o + Seguir aparece às 04:10 e há 10 pontos verdes de compras depois das 18:00.",
    tips: ["O gráfico só aparece com um formato simulado: «Acompanha a fala», «Dinâmica», «Cresce até à oferta» ou «Real + simulada»."],
  },

  /* ---------- Oferta ---------- */

  oferta: {
    title: "Oferta",
    what: "O que vende na sala, para onde leva o botão e em que minutos aparece. Pode ter a oferta principal e até 3 ofertas a seguir.",
    steps: [
      "Ligue «Mostrar a oferta na sala».",
      "Abra a «Oferta principal» e escreva o «Nome do produto», o «Preço inicial» e o «Preço com desconto».",
      "Escolha em «O botão leva a» o «Checkout», a «Página» ou o «Grupo», e cole o link.",
      "Marque em «Quando aparece» o minuto em que abre e o minuto em que fecha; «Validar» usa o minuto que a análise encontrou.",
      "Carregue em «Adicionar outra oferta» para uma oferta seguinte; quando ela abre, a anterior fecha.",
    ],
    example:
      "«Mentoria Vendas no Instagram», de 100 000 Kz por 25 000 Kz (desconto de 75%). O botão «Quero minha vaga» leva ao checkout da Kambafy e abre aos 18:00, quando a Edna começa o pitch. A Oferta 2, um bónus relâmpago, abre aos 21:00 e fecha a primeira.",
    tips: [
      "O preço é texto livre: escreva a moeda, por exemplo «25 000 Kz» ou «97 €».",
      "Sem o nome do produto e sem o link, a oferta principal fica por acabar.",
    ],
  },
  link: {
    title: "Checkout, página ou grupo?",
    what: "Para onde leva o botão da oferta. Na sala, quem clica já ouviu o pitch: ir directo ao checkout tira um passo e vende mais.",
    steps: [
      "Escolha «Checkout» para a maioria das ofertas e cole o link de pagamento.",
      "Escolha «Página» para produtos caros ou que pedem mais argumentos.",
      "Escolha «Grupo» para levar a um grupo do WhatsApp ou do Telegram.",
      "Escreva o «Texto do botão» de acordo com o destino.",
    ],
    example:
      "Curso de 15 000 Kz: checkout da Kambafy, botão «Quero minha vaga». Mentoria de 450 000 Kz: página de vendas com depoimentos. Lançamento por grupo: link https://chat.whatsapp.com/…, botão «Entrar no grupo»; a pessoa confirma o nome, o e-mail e o WhatsApp e entra no grupo, onde está o link com o desconto.",
    tips: [
      "O link do grupo começa por https://chat.whatsapp.com/ ou https://t.me/.",
      "No grupo, fica registado quem entrou, para depois separar quem comprou de quem não comprou.",
    ],
  },
  pitch: {
    title: "Quando a oferta aparece",
    what: "O minuto em que o separador Oferta abre na sala e o minuto em que fecha. Deve coincidir com o momento em que o apresentador começa a vender.",
    steps: [
      "Carregue em «Validar» se a análise do vídeo encontrou o pitch: usa esse minuto.",
      "Carregue em «Abre aos» e rode os minutos e os segundos para escolher outro.",
      "Escolha em «Fecha» um minuto, ou «No fim do vídeo».",
      "Arraste as pegas na barra para mudar a abertura e o fecho.",
      "Carregue em «Ver na sala» para ver a oferta a abrir.",
    ],
    example:
      "A análise encontrou o pitch aos 17:52. A Edna carrega em «Validar», deixa a oferta aberta até ao fim do vídeo e vê na sala o separador Oferta a abrir aos 17:52, com 5 minutos de aula ainda por dar.",
    tips: ["Abrir a oferta antes do pitch confunde: a pessoa vê o preço antes de perceber o valor."],
  },
  urgencia: {
    title: "Cronómetro e prazo",
    what: "Dá pressa a quem está a decidir: um cronómetro na oferta, que conta a partir de quando ela abre, e, se quiser, um último dia para comprar.",
    steps: [
      "Escolha o «Cronómetro na oferta»: «Sem», 5, 10, 15 ou 30 min.",
      "Escolha «Quando o cronómetro chega a zero»: «O botão continua» a vender ou «O botão fecha».",
      "Escolha, se quiser, o «Último dia da oferta».",
      "Tire o prazo com o X ao lado da data.",
    ],
    example:
      "A oferta abre aos 18:00 com um cronómetro de 10 minutos e «O botão fecha»: aos 18:10 o botão passa a «Oferta encerrada». Com o último dia a 15 de outubro, o botão do replay fica aberto até esse dia e depois fecha.",
    tips: [
      "Com «O botão fecha», quem decide depois do cronómetro já não compra na sala.",
      "Cada oferta seguinte tem o seu «Prazo desta oferta», dentro do cartão dela.",
    ],
  },
  depoisVideo: {
    title: "Quando a aula acaba",
    what: "Quanto tempo a sala fica aberta para comprar depois de o vídeo acabar. Nesse tempo continuam a oferta, o cronómetro e o Suporte.",
    steps: [
      "Escolha o tempo: «Fecha logo», 15 min, 30 min, 1 h ou 2 h.",
      "Leia por baixo o que acontece nesse tempo.",
      "Carregue em «Ver a sala depois do vídeo» para ver como fica.",
    ],
    example:
      "Sessão às 20:00, aula de 23 minutos e 30 min depois do vídeo: a aula acaba às 20:23, mas a sala fica aberta até às 20:53. O Agente IA e a equipa respondem no Atendimento a quem ainda tem dúvidas.",
    tips: ["Vale para a última oferta: é ela que fica aberta."],
  },
  utm: {
    title: "Origem das vendas",
    what: "Leva ao checkout a origem de cada pessoa: o anúncio de onde veio e o minuto em que clicou. Assim sabe que anúncio vendeu.",
    steps: [
      "Ligue «Levar a origem ao checkout».",
      "Ponha nos anúncios o link da sala com utm_source e utm_campaign, para a origem ficar registada à entrada.",
      "Veja no checkout ou nas suas métricas de onde veio cada venda.",
    ],
    example:
      "A Edna anuncia no Instagram com …/w/vender-no-instagram?utm_source=instagram&utm_campaign=aula-outubro. A Yola entra por esse anúncio e clica na oferta aos 18:42. O checkout recebe utm_source=instagram, utm_campaign=aula-outubro e utm_content=sala-18m42s.",
    tips: [
      "Sem anúncio, a origem fica «convertewebinar».",
      "Se o link do checkout já tiver UTM, esses valores ficam como estão.",
    ],
  },

  /* ---------- Vendas ---------- */

  vendas: {
    title: "Vendas na sala",
    what: "Os avisos de compra que aparecem na sala, como «Helena comprou a Mentoria». Podem ser de demonstração, para dar prova social, ou as compras reais da Kambafy.",
    steps: [
      "Ligue «Mostrar compras de demonstração» e escolha «Quantas compras» (de 1 a 50, ou 3, 6, 10 ou 20).",
      "Ligue em «Compras reais» as compras da Kambafy.",
      "Escolha «Onde aparecem»: no vídeo, no chat ou nos dois.",
      "Escolha a «Cor do aviso».",
      "Clique num ponto em «Na linha do vídeo» para ver a compra a aparecer.",
    ],
    example:
      "Oferta aos 18:00 num vídeo de 23 minutos, com 10 compras de demonstração: espalham-se entre os 18:19 e os 22:43, mais ou menos uma a cada 30 segundos. As compras reais da Kambafy aparecem no momento em que acontecem, só com o primeiro nome.",
    tips: [
      "As de demonstração só aparecem depois do pitch e nunca entram nas métricas.",
      "Sem o minuto do pitch marcado na Oferta, as compras contam desde o início do vídeo.",
    ],
  },
  comprasReais: {
    title: "Compras reais",
    what: "As compras feitas na Kambafy aparecem na sala no momento em que acontecem, só com o primeiro nome de quem comprou.",
    steps: [
      "Ligue a Kambafy em Integrações.",
      "Ligue «Mostrar as compras da Kambafy».",
      "Escolha em «Onde aparecem» se o aviso sai no vídeo, no chat ou nos dois.",
    ],
    example:
      "Aos 19:30, a Nádia Ngola paga a mentoria na Kambafy. Segundos depois, quem está na sala vê «Nádia comprou Mentoria Vendas no Instagram».",
    tips: ["O apelido nunca aparece: só o primeiro nome."],
  },
  vendasOnde: {
    title: "Onde aparecem",
    what: "Onde a sala mostra o aviso de compra: por cima do vídeo, como uma linha no chat, ou nos dois.",
    steps: [
      "Escolha «No vídeo» para um aviso por cima da imagem.",
      "Escolha «No chat» para uma linha no meio dos comentários.",
      "Escolha «Nos dois» para os dois avisos ao mesmo tempo.",
      "Veja o resultado no exemplo de «Cor do aviso».",
    ],
    example:
      "Com «Nos dois», quando o Bruno compra, aparece por cima do vídeo «Bruno comprou Contabilidade simples · agora mesmo» e, no chat, uma linha com o carrinho e o mesmo texto.",
    tips: ["Vale para as compras de demonstração e para as reais."],
  },
  vendasCor: {
    title: "Cor do aviso",
    what: "A cor do aviso de compra, no vídeo e no chat.",
    steps: [
      "Escolha uma das 7 cores: Verde, Azul, Roxo, Laranja, Âmbar, Rosa ou Grafite.",
      "Veja no exemplo escuro como fica o aviso no vídeo e a linha no chat.",
      "Confirme na pré-visualização da sala que o aviso se distingue do botão da oferta.",
    ],
    example: "Botão da oferta em laranja e aviso de compra em verde: quem vê distingue logo a compra de outra pessoa do botão para comprar.",
    tips: ["Evite a cor do botão da oferta: o aviso confunde-se com o botão."],
  },
  vendasLinha: {
    title: "Na linha do vídeo",
    what: "As compras ao longo do vídeo, como no gráfico da Audiência: a linha sobe a cada compra e cada ponto é uma compra.",
    steps: [
      "Arraste no gráfico para a sala ir a esse minuto.",
      "Clique num ponto: a sala toca uns segundos antes e vê a compra a aparecer.",
      "Leia em cima quantas compras já aconteceram até ao minuto em que está.",
      "Confira a linha tracejada da oferta: as compras começam depois dela.",
    ],
    example:
      "10 compras de demonstração: aos 20:00, o gráfico mostra «6 de 10 compras». Um clique no ponto das 20:15 toca a sala uns segundos antes e mostra o aviso «Inês comprou…» a aparecer.",
    tips: ["O gráfico só aparece quando há compras para mostrar."],
  },

  /* ---------- Automações ---------- */

  automacoes: {
    title: "Automações",
    what: "As mensagens por WhatsApp e e-mail antes, durante e depois da sessão. Vivem no fluxo do webinar e só se editam no desenho do fluxo; aqui vê o resumo.",
    steps: [
      "Carregue em «Criar as automações base» se o webinar ainda não tem fluxo; nascem desligadas.",
      "Veja as automações por momento: «Inscrição», «Ao vivo», «Fim da sessão» e «Checkout e compra».",
      "Confira em cada uma quantas mensagens tem, os canais e se está «Ligada» ou «Desligada».",
      "Carregue em «Abrir o fluxo», ou numa automação, para a escrever e ligar no desenho do fluxo.",
    ],
    example:
      "Webinar das 20:00: na inscrição, uma mensagem de confirmação por WhatsApp. No fim da sessão, quem não comprou fica num segmento («Não acessou», «Saiu antes do pitch» ou «Assistiu o pitch») e recebe a mensagem desse segmento. Quem compra sai das automações de venda dessa oferta.",
    tips: [
      "Não há automações fora do fluxo: para mudar uma mensagem, abra o fluxo.",
      "Nos grupos de WhatsApp a mensagem vai para todos: só o e-mail e o WhatsApp individual seguem o segmento de cada pessoa.",
      "A condição de cada disparo é vista no momento em que sai: se a pessoa comprou entretanto, já não recebe a mensagem de venda.",
    ],
  },

  /* ---------- Agente IA ---------- */

  agente: {
    title: "Agente IA",
    what: "O agente da plataforma a responder no Suporte da sala deste webinar. É o mesmo agente do Atendimento; o que não sabe ou não pode fazer passa à equipa.",
    steps: [
      "Ligue «Ligar o agente neste webinar».",
      "Escolha em «O que faz» a «Autonomia» e as fontes de «Responde com».",
      "Abra «Regras» e escolha quando «Passa à equipa» e o «Nome no chat».",
      "Carregue em «Conhecimento, perguntas e simulador» para lhe ensinar a oferta e testar respostas.",
    ],
    example:
      "Webinar da mentoria com 400 pessoas: o agente, com o nome «Equipa Edna», responde no Suporte às dúvidas sobre a aula e envia o link da oferta. Quando alguém pede um desconto, passa a conversa ao Atendimento.",
    tips: [
      "Desligado, as mensagens do Suporte vão directo para o Atendimento.",
      "Negociar ou dar desconto nunca é feito sozinho.",
    ],
  },
  autonomia: {
    title: "Autonomia",
    what: "Até onde o agente vai sem pedir à equipa.",
    steps: [
      "Escolha «Sugere» para o agente preparar a resposta e a equipa a aprovar.",
      "Escolha «Controlo» para responder dentro das regras e passar à equipa o que é de risco.",
      "Escolha «Automático» para responder sozinho a tudo o que sabe, dentro das regras.",
      "Confira na lista o que faz em cada caso: «Sozinho», «Sugere», «Passa à equipa» ou «Nunca sozinho».",
    ],
    example:
      "Com «Controlo»: «Responder dúvidas do conteúdo» e «Enviar o link da oferta» ficam «Sozinho»; «Negociar ou dar desconto» fica «Nunca sozinho», com cadeado.",
    tips: ["Comece por «Sugere» nos primeiros webinars e suba quando confiar nas respostas."],
  },
  agenteFontes: {
    title: "Responde com",
    what: "De onde o agente tira as respostas: a transcrição do vídeo, as perguntas frequentes e a informação da oferta e do produto.",
    steps: [
      "Ligue «Transcrição do vídeo» para responder com o que o apresentador disse.",
      "Carregue em «Perguntas frequentes» para escrever as perguntas e as respostas mais comuns.",
      "Carregue em «Oferta e produto» e preencha o preço, as formas de pagamento, a garantia e o que está incluído.",
      "Teste as respostas no simulador, em «Conhecimento, perguntas e simulador».",
    ],
    example:
      "Pergunta no Suporte: «A mentoria tem garantia?». Com a garantia preenchida em «Oferta e produto» («7 dias, devolução total»), o agente responde logo, com as palavras da Edna.",
    tips: ["Se a resposta não estiver em nenhuma fonte, ligue em «Regras» a opção «Não sabe responder», para a pergunta passar à equipa."],
  },
  agenteEquipa: {
    title: "Passa à equipa quando",
    what: "Os casos em que o agente deixa de responder e passa a conversa à equipa, no Atendimento.",
    steps: [
      "Ligue «Não sabe responder» para as perguntas que não estão no que ele sabe.",
      "Ligue «Pedem uma pessoa» para quem quer falar com alguém da equipa.",
      "Ligue «É sobre pagamento» para a equipa tratar dos pagamentos.",
      "Responda a essas conversas no Atendimento.",
    ],
    example:
      "O Hélder escreve no Suporte «Paguei por transferência e ainda não recebi o acesso». Com «É sobre pagamento» ligado, a conversa vai para o Atendimento e a equipa responde lá.",
    tips: ["Se ninguém da equipa estiver a ver o Atendimento durante a sessão, essas pessoas ficam sem resposta."],
  },
  agenteNome: {
    title: "Nome no chat",
    what: "O nome com que o agente aparece no Suporte da sala.",
    steps: [
      "Escreva o nome, por exemplo «Equipa» ou «Suporte Edna Kiala».",
      "Pare de escrever: o nome guarda-se sozinho.",
      "Veja na pré-visualização como aparece no chat.",
    ],
    example: "Nome «Equipa Vendas no Instagram»: quem pergunta no Suporte vê as respostas assinadas assim.",
    tips: ["Se o deixar vazio, fica «Assistente»."],
  },

  /* ---------- Agenda ---------- */

  agenda: {
    title: "Agenda",
    what: "Quando a sessão acontece: numa data, a repetir, a cada poucos minutos ou sempre que alguém entra.",
    steps: [
      "Escolha em «O que está a programar»: «Uma data», «Repetir», «Just in time» ou «Sempre disponível».",
      "Preencha «Quando» ou o «Intervalo», com o fuso horário.",
      "Confira a «Próxima sessão» no cartão escuro.",
      "Escolha em «Sessão» a sala de espera, o vídeo sincronizado e o replay.",
    ],
    example:
      "Lançamento em Luanda: «Repetir» às terças e quintas às 20:00, com o fuso «Angola · Luanda». O cartão «Próxima sessão» mostra a próxima terça ou quinta às 20:00.",
    tips: ["Confirme o fuso: 20:00 em Luanda são 20:00 em Lisboa no verão, mas 19:00 no inverno."],
  },
  agendaQuando: {
    title: "Quando",
    what: "O dia e a hora da sessão. Com «Uma data», há uma sessão; com «Repetir», há sessões nos dias e nas horas que escolher.",
    steps: [
      "Escolha a «Data» e a «Hora», se programou «Uma data».",
      "Escolha os «Dias» e as «Horas», se programou «Repetir»; «+ Hora» junta outra, até 6.",
      "Escolha o «Fuso horário» da cidade onde marca a hora.",
      "Confira por baixo a «Próxima sessão».",
    ],
    example:
      "Workshop em Lisboa às segundas e quartas, às 13:00 e às 21:00, com o fuso «Portugal · Lisboa»: são quatro sessões por semana com o mesmo vídeo.",
    tips: [
      "Com «Repetir» e sem dias escolhidos, repete todos os dias.",
      "Uma data que já passou fica marcada como terminada: escolha uma nova.",
    ],
  },
  agendaIntervalo: {
    title: "Intervalo",
    what: "Com «Just in time», há uma sessão a começar a cada 15, 30 ou 60 minutos, para quem chega não esperar muito.",
    steps: [
      "Escolha o intervalo: «15 min», «30 min» ou «1 hora».",
      "Ligue «Sem sessões de noite» para não haver sessões entre as 22:00 e as 07:00.",
      "Escolha o «Fuso horário» do seu público.",
    ],
    example:
      "Anúncio a correr todo o dia em Angola, com intervalo de 15 min: quem se inscreve às 14:07 entra na sessão das 14:15. Com «Sem sessões de noite», quem se inscreve às 23:30 fica para a sessão das 07:00.",
    tips: ["As 22:00 e as 07:00 contam no fuso escolhido."],
  },
  agendaSessao: {
    title: "Sessão",
    what: "O que acontece à volta da hora marcada: a sala de espera antes, o vídeo a acompanhar o relógio e o replay depois.",
    steps: [
      "Ligue «Sala de espera» para mostrar uma contagem decrescente antes da hora.",
      "Ligue «Vídeo sincronizado» para quem chega atrasado ver a partir do minuto em que a sessão vai.",
      "Ligue «Replay depois da sessão» para quem não viu ao vivo ver o mesmo vídeo.",
    ],
    example:
      "Sessão às 20:00: às 19:50 a Yola entra e vê a contagem decrescente. O Nelson entra às 20:05 e vê a partir do minuto 5, como numa live. Quem faltou vê o replay, com o botão da oferta aberto até ao último dia da oferta.",
    tips: ["Com «Sempre disponível», só há o «Replay depois da sessão»: o vídeo começa quando a pessoa entra."],
  },
} satisfies Record<string, Help>;

export type HelpTopic = keyof typeof HELP;
