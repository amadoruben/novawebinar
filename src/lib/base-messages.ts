/**
 * Os modelos de mensagem do utilizador (docs/automacao/modelo-de-disparo.json, versão 1),
 * com as variáveis do motor. Gerado por scratchpad/gera-base-messages.mjs: não editar à mão; editar o JSON e gerar outra vez.
 * O que o motor ainda não preenche fica entre parênteses rectos, para a pessoa completar na mensagem.
 */
export type BaseMessage = { channel: "email" | "whatsapp"; subject?: string; body: string };

export const BASE_MESSAGES: Record<string, BaseMessage> = {
  "ppl_email_inscricao_pesquisa": {
    "channel": "email",
    "subject": "Preciso da sua ajuda",
    "body": "Olá, e ai, tudo bem?\nAqui é o [seu nome], e eu estou passando para te dar os parabéns por ter realizado a sua inscrição para o {{webinar}}.\nTenho certeza que nesse evento você vai aprender a [o que a pessoa vai aprender]. Você vai ficar surpreso com muita coisa.\nNesse exato momento, eu e a minha equipe estamos cuidando de todos os preparativos para realizar o {{webinar}}.\nEstamos nos esforçando ao máximo para produzir o melhor conteúdo pra você e é exatamente por isso que eu preciso da sua ajuda.\nPara ser mais exato, preciso que você me ajude  com duas  coisas muito importantes.\nA primeira coisa é:  eu gostaria muito de saber   quais são as principais dificuldades e necessidades que você tem enfrentando neste momento [o que a pessoa vai aprender].\nA sua resposta vai me ajudar a garantir que esse evento supere as suas expectativas.\nLogo abaixo, tem um link com uma pesquisa pra você responder.\n Com base nas suas respostas, pode ser que eu consiga  adaptar ou até mesmo produzir um conteúdo específico pra você.  Então reserve um tempinho na sua agenda  e responda essa pesquisa com o máximo de atenção possível, ok ?\n[CONFIRMAR INSCRIÇÃO - PESQUISA [link da pesquisa]]\nE o meu segundo pedido é o seguinte.\nDa última vez que eu fiz um evento assim, muitas pessoas ficaram chateadas porque não receberam meus e-mails e, por conta disso, não tiveram acesso a todos os conteúdos que eu enviei..\n Dessa vez, eu quero ter a certeza que minhas mensagens vão chegar  até você. Mas pra isso, eu preciso  que você responda à pesquisa que eu coloquei ali em cima e depois responda este  e-mail aqui falando assim:\n\"Eu recebi o e-mail e já respondi a pesquisa\".\nAssim, eu vou saber que está tudo ok com seu acesso e posso ficar tranquilo por ter a certeza de que você não vai perder nenhum conteúdo.\nEntão, é isso aí, não ignora esse e-mail, tá? Espero de verdade poder contar com a sua ajuda.\nA gente se fala novamente em breve.\nGrande abraço,\n[seu nome]"
  },
  "ppl_email_grupo_whatsapp": {
    "channel": "email",
    "subject": "Tudo o que você precisa para acessar o evento",
    "body": "Olá, tudo bem?\nAqui é [seu nome], eu vi que ontem você se inscreveu para participar do {{webinar}} e que a sua inscrição já foi confirmada!\nPensando em tornar sua experiência  ainda melhor, nós criamos um grupo exclusivo no Whatsapp para quem se inscreveu no evento.\nNesse grupo, você vai receber todos os links de acesso e conteúdos extras do {{webinar}}.\nLá no grupo de WhatsApp, a entrega dos conteúdos é imediata. Assim, você  não corre o  risco de alguma  mensagem não chegar ou cair no SPAM, como pode acontecer com o e-mail, às vezes.\nAh, e pode ficar despreocupado porque o grupo é altamente moderado e apenas administradores podem enviar mensagens.\nEu te garanto que por lá você vai receber apenas mensagens oficiais do evento, tá?\nEntão pra não perder absolutamente nada desse evento, eu recomendo que você participe agora mesmo do grupo de whatsapp, é só clicar no link abaixo:\nPARTICIPAR DO WHATSAPP {{link_grupo}}\nAbraço,\n[seu nome]"
  },
  "ppl_email_faltam_7": {
    "channel": "email",
    "subject": "{{webinar}} Faltam 7 dias",
    "body": "Opa, tudo bem? Aqui é [seu nome].\nEstou te mandando esse e-mail para avisar que faltam apenas 7 dias para começar o {{webinar}}.\nComo vai ser um evento com muito conteúdo de valor, sugiro que você organize sua agenda para conseguir aproveitar ao máximo cada minuto dele.  Sinceramente, eu acredito que esse evento pode  ser um divisor de águas na sua maneira de [o que a pessoa vai aprender]\nE para que você possa se preparar com antecedência para participar ao vivo, já vou deixar aqui a programação do evento:\n{{data}} [tema da aula]\nTodos os avisos, link de acessos  e materiais extras serão enviados por e-mail e WhatsApp. Se você ainda não está no nosso grupo exclusivo do Whatsapp, recomendo que  entre  o quanto antes.\nLá no grupo de WhatsApp, a entrega dos conteúdos é imediata. Assim, você não corre o risco de alguma mensagem não chegar ou cair no SPAM, como pode acontecer com o e-mail, às vezes.\nPara entrar no grupo do evento,  basta clicar no link abaixo:\nPARTICIPAR DO GRUPO DE WHATSAPP {{link_grupo}}\nSe você já faz parte do grupo, parabéns. Agora,  é só aguardar que em breve você receberá todas as informações sobre o acesso no {{webinar}}.\nA gente se fala em breve.\n Abraços."
  },
  "ppl_email_faltam_4": {
    "channel": "email",
    "subject": "{{webinar}} O acesso está liberado",
    "body": "Olá, tudo bem?\nAqui é [seu nome], estou passando  para te lembrar que faltam apenas 4 dias para começar o {{webinar}}.\nEu e minha equipe  estamos nos preparativos finais para o evento e nesse momento já estamos liberando o link de acesso. Com isso,  você já pode confirmar sua presença no nosso evento.\nPara confirmar sua presença é só acessar o link abaixo e clicar em [Definir Lembrete]. Depois disso, sua  presença já estará confirmada.\nAcesse o link abaixo agora e confirme agora mesmo a sua presença:\n{{link}}"
  },
  "ppl_email_amanha": {
    "channel": "email",
    "subject": "{{webinar}} É amanhã",
    "body": "Opa, beleza?\n\nPassando aqui para te avisar que falta apenas 1 dia para começar a {{webinar}}, então se organiza para participar ao vivo no dia {{data}} às {{hora}}.\n\nNo exato momento em que você está lendo esse e-mail, nós liberamos o link para acessar a transmissão e você já pode confirmar sua presença.\n\nPara confirmar sua presença é só clicar no link abaixo e clicar em ([Definir Lembrete]). Feito isso,  sua presença será  confirmada automaticamente.\n\n{{link}}\n\nÉ isso e vejo você em breve no {{webinar}}.\n\nAbraços."
  },
  "pl_email_hoje": {
    "channel": "email",
    "subject": "{{webinar}} É hoje, os seus dados de acesso estão aqui",
    "body": "Olá,\nEstou passando aqui para te lembrar que HOJE, às {{hora}}, começa o {{webinar}}, onde você vai aprender [o que a pessoa vai aprender].\nPara participar ao vivo é só clicar link abaixo no horário da transmissão:\nCLIQUE AQUI PARA ACESSAR {{link}}\nTema da aula: [tema da aula].\nColoca na sua agenda e não se esqueça. Participando ao vivo você também vai ter a chance de ter suas dúvidas respondidas durante o evento.\nConto com a sua presença.\nVejo você em breve.\nAbraços."
  },
  "pl_email_ao_vivo": {
    "channel": "email",
    "subject": "{{webinar}} Estamos ao vivo, venha participar",
    "body": "Começou! Estamos ao vivo.\n\nPara participar ao vivo é só clicar no link abaixo:\n\nCLIQUE AQUI PARA ACESSAR {{link}}\n\nTema da aula: [tema da aula].\n\nParticipando ao vivo você também vai ter a chance de ter suas dúvidas em tempo real, durante o evento.\n\nConto com a sua presença.\n\nVenha participar agora!\n\nAbraços."
  },
  "ppl_wpp_boas_vindas": {
    "channel": "whatsapp",
    "body": "⚠️ Sejam bem- vindos ao grupo do {{webinar}}, que vai acontecer do dia {{data}} ao dia {{data}}. ⚠️\nNesse grupo, você vai receber todos os links de acesso, material bônus e informações sobre as premiações.\nAs mensagens são moderadas e apenas administradores enviam mensagens, por esse motivo deixe as notificações sempre ativadas.\nAtenção! Nossa equipe não entrará em contato com ninguém no privado, tome cuidado com mensagens de outros membros do grupo.\nEstamos preparando todo o conteúdo do evento e, neste  momento, precisamos da ajuda de vocês. Queremos saber quais são as principais dificuldades de cada um de vocês e o que  vocês mais gostariam de aprender nesse evento.\nPara responder a pesquisa, basta acessar o link abaixo: .\nSerá muito importante para o desenvolvimento do conteúdo da {{webinar}}.\n[link da pesquisa]\nAbraços!"
  },
  "ppl_wpp_faltam_7": {
    "channel": "whatsapp",
    "body": "⏰ FALTAM 7 DIAS PARA COMEÇAR O {{webinar}} ⏰\nSugiro que você organize sua agenda para conseguir aproveitar ao máximo todo o evento. Vai ser um evento com muito conteúdo e, sinceramente, acredito que possa ser um divisor de águas na sua maneira de [o que a pessoa vai aprender]\nO {{webinar}} vai acontecer no dia {{data}}, às {{hora}}. Anota na sua agenda e participe ao vivo."
  },
  "ppl_wpp_faltam_4": {
    "channel": "whatsapp",
    "body": "🔥 Atenção 🔥\nFaltam 4 dias para o {{webinar}}.\nEu e minha equipe já estamos nos preparativos finais para o evento e, nesse momento, já estamos liberando o link de acesso. Com isso,  você já pode confirmar sua presença no evento.\nPara confirmar sua presença é só acessar o link abaixo e clicar em [Definir Lembrete]. Depois disso,  sua presença já estará confirmada.\nAcesse o link abaixo agora mesmo e confirme sua presença:\n{{link}}"
  },
  "ppl_wpp_amanha": {
    "channel": "whatsapp",
    "body": "📣📣 Está chegando o dia!\nPassando aqui para te avisar que falta 1 dia para começar a {{webinar}}, então se organiza para participar ao vivo no dia {{data}}, às {{hora}}.\nNo exato momento em que você está lendo essa mensagem, nós liberamos o link para acessar a transmissão e você já pode confirmar sua presença.\nPara confirmar sua presença é só clicar no link abaixo e clicar em [Definir Lembrete]. Depois disso, sua presença será  confirmada automaticamente.\nCLIQUE AQUI PARA CONFIRMAR SUA PRESENÇA.\nVejo você em breve no {{webinar}}.\nAbraços."
  },
  "pl_wpp_hoje": {
    "channel": "whatsapp",
    "body": "🔥🔥É hoje! Os seus dados de acesso estão aqui 🔥🔥\nOlá, estou passando aqui para te lembrar que HOJE, às {{hora}}, começa o {{webinar}}, onde você vai aprender [o que a pessoa vai aprender].\nPara participar ao vivo é só clicar link abaixo no horário da transmissão:\nTema da aula: [tema da aula].\nColoca na sua agenda e não se esqueça. Participando ao vivo você também vai ter a chance de ter suas dúvidas respondidas durante o evento, em tempo real.\nPara participar da aula ao vivo HOJE, às {{hora}}, é só clicar no link abaixo:\nCLIQUE AQUI PARA ACESSAR {{link}}"
  },
  "pl_wpp_ao_vivo": {
    "channel": "whatsapp",
    "body": "⚠️⚠️Estamos ao vivo, venha participar⚠️⚠️\nComeçou! Estamos ao vivo.\nTema da aula: [tema da aula].\nParticipando ao vivo, você também vai ter a chance de ter suas dúvidas respondidas durante o evento, em tempo real. .\nConto com a sua presença.\nVenha participar agora!\nPara participar ao vivo é só clicar link abaixo:\nCLIQUE AQUI PARA ACESSAR {{link}}"
  },
  "l_email_replay": {
    "channel": "email",
    "subject": "{{webinar}} Replay disponível",
    "body": "Olá,  tudo bem?\nEstou te mandando essa mensagem para avisar que o replay do {{webinar}} já está disponível.\nSe você não pôde comparecer ao vivo ontem ou quer rever a aula, já é possível acessar todo o conteúdo  clicando no link abaixo:\nCLIQUE AQUI PARA ACESSAR O REPLAY {{link_replay}}\nNo link acima, você também tem chance de dar um passo além e participar do {{produto}}, 100% online, em que  você vai ter acesso completo a:\nEntregáveis\nBônus\nGarantia\nAtenção!\nA gravação da aula vai ficar disponível por pouco tempo. Então se você realmente quer aprender a [o que a pessoa vai aprender], aproveite e assista enquanto ainda há tempo.\nAbraços."
  },
  "l_email_so_o_file": {
    "channel": "email",
    "subject": "{{webinar}} Só o filé, melhores momentos",
    "body": "Olá,  tudo bem?\nEu e minha equipe decidimos fazer uma coisa que sem dúvidas vai te ajudar muito. Nós fizemos uma re-edição do {{webinar}}.\nComo assim?\nNós extraímos os pontos mais importantes que você precisa para aprender a [o que a pessoa vai aprender] e compilamos em uma “aula resumida”.\nDessa jeito, você vai conseguir aprender todos os pontos que foram ensinados no evento de forma mais rápida e prática.\nPara acessar a edição com os melhores momentos é só clicar no link abaixo:\nACESSAR A AULA DE MELHORES MOMENTOS {{link_replay}}\nNo link acima, você também tem chance de dar um passo além e participar do {{produto}}, 100% online, em que  você vai ter acesso completo a:\nEntregáveis\nBônus\nGarantia\nAtenção!\nA gravação da aula vai ficar disponível por pouco tempo.e você realmente quer aprender a [o que a pessoa vai aprender], aproveite e assista enquanto ainda há tempo.\nAbraços."
  },
  "l_email_encerra_hoje": {
    "channel": "email",
    "subject": "{{webinar}} O seu acesso vai ser cancelado",
    "body": "O seu acesso vai ser cancelado!\nHoje, às 23h59, a gravação do {{webinar}} vai sair do ar e também encerraremos as inscrições do {{produto}}.\nEntão se você quer aprender a [o que a pessoa vai aprender] a hora é agora.\nACESSAR A AULA {{link_replay}}\nNo link acima, você também tem chance de dar um passo além e participar do {{produto}}, 100% online, em que  você vai ter acesso completo a:\nEntregáveis\nBônus\nGarantia\nATENÇÃO!\nA gravação da aula e as inscrições realmente vão encerrar HOJE, às 23h59, e não abriremos exceções, aproveite enquanto ainda há tempo.\nQualquer dúvida basta retornar este e-mail que eu e minha equipe estamos à disposição!\nAbraços."
  },
  "l_email_ultima_chamada": {
    "channel": "email",
    "subject": "{{webinar}} Última chamada.",
    "body": "Atenção, essa é a última chamada.\nHoje, às 23h59, a gravação do {{webinar}} vai sair do ar e também encerraremos as inscrições do {{produto}}.\nFAZER INSCRIÇÃO {{link_replay}}\nNo link acima, você também tem chance de dar um passo além e participar do {{produto}}, 100% online, em que  você vai ter acesso completo a:\nEntregáveis\nBônus\nGarantia\nATENÇÃO! Essa é a última chance para se inscrever no {{produto}}.\nQualquer dúvida basta retornar este e-mail que eu e minha equipe estamos à disposição!\nAbraços."
  },
  "l_wpp_replay_1": {
    "channel": "whatsapp",
    "body": "📢📢 Atenção - Replay Disponível 📢📢\nPassando aqui para avisar que o replay do {{webinar}} já está disponível.\nAtenção! A gravação da aula vai ficar disponível por pouco tempo. Se você realmente quer aprender a [o que a pessoa vai aprender], aproveite e assista enquanto ainda há tempo.\nSe você não pôde comparecer ao vivo ontem ou quer rever a aula, basta  acessar o conteúdo clicando no link abaixo:\nNo link abaixo, além de ter acesso ao replay, você também tem chance de dar um passo além e participar do {{produto}}, 100% online, em que  você vai ter acesso completo a:\nEntregáveis\nBônus\nGarantia\nCLIQUE NO LINK ABAIXO PARA ACESSAR O REPLAY OU PARTICIPAR DO {{produto}}:\n{{link_replay}}"
  },
  "l_wpp_replay_2": {
    "channel": "whatsapp",
    "body": "📢📢Segunda chamada - A gravação já está disponível 📢📢\n\nSe você ainda não assistiu ou deseja rever a aula, a gravação do {{webinar}} já está disponível.\n\nAtenção! A gravação da aula vai ficar disponível por pouco tempo. Se você realmente quer aprender a [o que a pessoa vai aprender], aproveite e assista enquanto ainda há tempo.\n\nSe você não pôde comparecer ao vivo ontem ou quer rever a aula, basta acessar o conteúdo clicando no link abaixo:\n\nNo link abaixo, além de ter acesso ao replay, você também tem chance de dar um passo além e participar do {{produto}}, 100% online, em que  você vai ter acesso completo a:\n\nEntregáveis\nBônus\nGarantia\n\nCLIQUE NO LINK ABAIXO PARA ACESSAR O REPLAY OU PARTICIPAR DO {{produto}}:\n\n{{link_replay}}"
  },
  "l_wpp_so_o_file_1": {
    "channel": "whatsapp",
    "body": "🔥🔥 Só o filé, melhores momentos🔥🔥\nEu e minha equipe decidimos fazer uma coisa que sem dúvidas vai te ajudar muito. Nós fizemos uma re-edição do {{webinar}}.\nComo assim?\nNós extraímos os pontos mais importantes que você precisa para aprender a [o que a pessoa vai aprender] e compilamos em uma “aula resumida”. Desse jeito, você vai conseguir aprender todos os pontos que foram ensinados no evento de forma mais rápida e prática.\nNo link abaixo, além de ter acesso aos melhores momentos, você também tem chance de dar um passo além e participar do {{produto}}, 100% online, em que  você vai ter acesso completo a:\nEntregáveis\nBônus\nGarantia\nCLIQUE NO LINK ABAIXO PARA ACESSAR OS MELHORES MOMENTOS OU PARTICIPAR DO {{produto}}:\n{{link_replay}}"
  },
  "l_wpp_so_o_file_2": {
    "channel": "whatsapp",
    "body": "🚨🚨 Acesso aos melhores momentos está liberado🚨🚨\nEu e minha equipe decidimos fazer uma coisa que sem dúvidas vai te ajudar muito. Nós fizemos uma re-edição do {{webinar}}.\nComo assim?\nNós extraímos os pontos mais importantes que você precisa para aprender a [o que a pessoa vai aprender] e compilamos em uma “aula resumida”. Desse jeito, você vai conseguir aprender todos os pontos que foram ensinados no evento de forma mais rápida e prática.\nNo link abaixo, além de ter acesso aos melhores momentos, você também tem chance de dar um passo além e participar do {{produto}}, 100% online, em que  você vai ter acesso completo a:\nEntregáveis\nBônus\nGarantia\nCLIQUE NO LINK ABAIXO PARA ACESSAR OS MELHORES MOMENTOS OU PARTICIPAR DO {{produto}}:\n{{link_replay}}"
  },
  "l_wpp_encerra_hoje": {
    "channel": "whatsapp",
    "body": "⚠️⚠️ Os acessos serão cancelados ⚠️⚠️\nHoje, às 23h59, a gravação do {{webinar}} vai sair do ar e também encerraremos as inscrições do {{produto}}.\nEntão se você quer aprender a [o que a pessoa vai aprender] a hora é agora.\nNo link abaixo, além de ter acesso aos melhores momentos, você também tem chance de dar um passo além e participar do {{produto}}, 100% online, em que você vai ter acesso completo a:\nEntregáveis\nBônus\nGarantia\nCLIQUE NO LINK ABAIXO PARA ACESSAR OS MELHORES MOMENTOS OU PARTICIPAR DO {{produto}}:\n{{link_replay}}"
  },
  "l_wpp_ultima_chamada": {
    "channel": "whatsapp",
    "body": "⚠️⚠️ Última Chamada ⚠️⚠️\nAtenção, essa é a última chamada.\nHoje, às 23h59, a gravação do {{webinar}} vai sair do ar e também encerraremos as inscrições do {{produto}}.\nEntão se você quer aprender a [o que a pessoa vai aprender], essa é sua última chance.\nNo link abaixo, além de ter acesso aos melhores momentos, você também tem chance de dar um passo além e participar do {{produto}}, 100% online, em que  você vai ter acesso completo a:\nEntregáveis\nBônus\nGarantia\nCLIQUE NO LINK ABAIXO PARA ACESSAR OS MELHORES MOMENTOS OU PARTICIPAR DO {{produto}}:\n{{link_replay}}"
  },
  "rec_wpp_carrinho_abandonado": {
    "channel": "whatsapp",
    "body": "Olá, tudo bem?\nAqui é [seu nome], da equipe [nome do negócio].\nEu vi aqui você iniciou a sua inscrição para o {{produto}}, mas por algum motivo não concluiu.\nSe você teve algum problema com internet ou precisou se ausentar e deixou para terminar depois, você pode concluir sua matrícula clicando no link abaixo (é só repetir o processo de matricula).\nAgora, se você tem  alguma dúvida ou precisa de ajuda, é só me responder essa mensagem que estou à disposição.\nSegue o link para concluir a sua inscrição:\n{{link_oferta}}"
  },
  "rec_email_carrinho_abandonado_1": {
    "channel": "email",
    "subject": "Operação em aberto no seu nome",
    "body": "Estou te encaminhando essa mensagem porque  você ficou com uma operação em aberto para o cadastro do {{produto}}.\nPrecisamos que você se manifeste o mais rápido possível, através do link abaixo:\n[FINALIZAR INSCRIÇÃO] {{link_oferta}}\nPedimos que dê uma resposta o quanto antes. Do contrário, iremos liberar a sua vaga ainda hoje para outra pessoa.\n\nAbraços,\nP.S. Caso você esteja precisando de alguma forma diferenciada de pagamento, você pode:\n1 - Pagar com cartão de crédito À VISTA.\n2 - Pagar com cartão de crédito EM ATÉ 12X.\n3 - Pagar com Boleto Bancário.\n4 - Pagar com Pix.\nAcesse agora mesmo, clicando no botão acima, para conhecer TODAS as formas de pagamento disponíveis.\nP.S.2 Caso tenha realizado o pagamento por boleto bancário, pedimos um prazo de 24 a 48 horas para validação do comprovante. Se você ainda está dentro desse prazo, desconsidere essa mensagem. Caso já tenha se passado mais de 48 horas e ainda não recebeu os seus dados de acesso, por favor, nos informe respondendo este email."
  },
  "rec_email_carrinho_abandonado_2": {
    "channel": "email",
    "subject": "Eu acho que você precisa de ajuda",
    "body": "Eu percebi que você tentou adquirir o {{produto}}, mas parece que houve algum problema.\nSe eu puder te ajudar de alguma forma, fique à vontade para me enviar um e-mail para: [email de suporte]\nOu se você preferir, pode entrar em contato com nossa equipe de suporte no Whatsapp:\nCLIQUE AQUI PARA ENTRAR EM CONTATO COM SUPORTE VIA WHATSAPP [WhatsApp de suporte]\nSe ainda estiver em dúvida se esse curso é para você, fique tranquilo(a): você tem [dias de garantia] dias para solicitar o REEMBOLSO.\nGostaria de lembrar também que no nosso site utilizamos uma das mais confiáveis plataformas de pagamento online do mercado, para que você possa comprar com toda tranquilidade.\nTodas as formas de pagamento:\n1 - Cartão de Crédito:\nNosso site é 100% seguro e você pode efetuar o pagamento através de cartão de crédito sem nenhum risco. E nesta opção você ainda pode parcelar a sua inscrição.\nCLIQUE AQUI {{link_oferta}} para pagar com CARTÃO DE CRÉDITO!\nAssim que finalizar sua inscrição, nós enviaremos os dados de acesso para o seu e-mail.\n2 - Pagamento via boleto bancário:\nEsta opção é ótima se você tiver interesse em efetuar seu pagamento à vista. Basta gerar um boleto e fazer  o pagamento pelo aplicativo ou site do seu banco, numa agência bancária ou casa lotérica.\nCLIQUE AQUI {{link_oferta}} para pagar através do BOLETO.\n3 - Pagar com Pix:\nÉ uma das formas de pagamento mais rápidas disponíveis. Basta colocar a nossa chave do PIX e fazer o pagamento.\n\nCLIQUE AQUI {{link_oferta}} para pagar com Pix.\n\nEssa é uma compra com RISCO ZERO para você. Não existe possibilidade de dar errado. Além disso, você tem [dias de garantia] dias para certificar de que gostou do curso. Caso isso não aconteça, você solicita o REEMBOLSO e eu devolvo o seu investimento sem perguntas.\nAbraços,\n[seu nome]"
  },
  "rec_email_pagamento_recusado_1": {
    "channel": "email",
    "subject": "[Urgente] Seu cadastro foi cancelado",
    "body": "Olá, tudo bem?\nEstou te  enviando esse e-mail em caráter de urgência, pois a sua inscrição para o {{produto}} foi cancelada.\nAcesse o link abaixo e faça uma nova inscrição para participar do {{produto}}.\nCLIQUE AQUI PARA REALIZAR UMA NOVA INSCRIÇÃO {{link_oferta}}\nRecomendo que você faça isso o quanto antes, pois  falta pouco tempo  para encerrarmos as inscrições.\nNão deixe para depois.\nSua compra pode ter sido cancelada por alguns motivos:\n1 - Saldo Insuficiente no cartão.\n2 - Dados Incorretos (algum erro de digitação na hora da compra)\n3 - Cancelamento pela operadora. (isso pode acontecer em transações online)\nSe eu puder te ajudar de alguma forma, fique à vontade para me enviar um e-mail para: [email de suporte]\nOu se você preferir pode entrar em contato com minha equipe através do WhatsApp.\nCLIQUE AQUI PARA FALAR COM SUPORTE VIA WHATSAPP.\nSe ainda estiver em dúvida se esse curso é para você ou não, fique tranquilo(a): você tem [dias de garantia] dias para solicitar o REEMBOLSO.\nGostaria de lembrar também que no nosso site utilizamos uma das mais confiáveis plataformas de pagamento online do mercado ([plataforma de pagamento]) para que você possa comprar com toda tranquilidade.\nTodas as formas de pagamento:\n1 - Cartão de Crédito:\nNosso site é 100% seguro e você pode efetuar o pagamento através de cartão de crédito sem nenhum risco. E nesta opção você ainda pode parcelar em até 12 vezes.\n\nAssim que finalizar sua inscrição, nós enviaremos os dados de acesso para o seu e-mail.\n2 - Pagamento via boleto bancário:\nEsta opção é ótima se você tiver interesse em efetuar seu pagamento à vista. Basta gerar um boleto e efetuar o pagamento pelo aplicativo ou site do seu banco, numa agência bancária ou casa lotérica.\n3 - Pagamento com PIX:\nSe você tem interesse em realizar o pagamento à vista de forma rápida com praticidade, nós já estamos disponibilizando o pagamento utilizando PIX, basta selecionar essa opção em nosso site e realizar a operação, o seu acesso será liberado imediatamente.\nEssa é uma compra com RISCO ZERO para você. Não existe possibilidade de dar errado. Além disso, você tem [dias de garantia] dias para certificar de que gostou do curso. Caso isso não aconteça, você solicita o REEMBOLSO e eu devolvo o seu investimento sem perguntas.\nAbraços, [seu nome]"
  },
  "rec_wpp_boleto_emitido": {
    "channel": "whatsapp",
    "body": "Parabéns por ter realizado a sua inscrição para {{produto}}!\nEstou passando aqui para te avisar que você tem até [prazo em dias úteis] dias úteis para realizar o pagamento do boleto.\nAssim que o pagamento for confirmado, o acesso ao curso será liberado. Você  receberá todos os dados de acesso no seu e-mail.\nCaso você queira imprimir seu boleto, é só acessar o link:\n[link do boleto]\nSe preferir, você também pode usar a linha digitável para pagar online:\n[linha digitável]\nSe precisar de alguma ajuda estou à disposição :)"
  },
  "rec_email_boleto_emitido_1": {
    "channel": "email",
    "subject": "O seu boleto foi emitido - {{produto}}",
    "body": "Olá, tudo bem?\nObrigado por gerar o boleto para adquirir o  {{produto}}.\nIMPORTANTE: você ainda tem um próximo passo para liberar o seu acesso ao curso.\nVocê ainda precisa efetuar o pagamento do boleto através do seu banco (na agência ou internet banking) ou casa lotérica.\nImprima seu boleto: [link do boleto]\nLinha digitável: [linha digitável]\nDepois disso, você precisa prestar bastante atenção às informações que vamos enviar para o seu e-mail.\nAssim que  o sistema registrar o seu pagamento, vamos te enviar um e-mail com o link para você acessar o curso.\nEventualmente, esse email de acesso pode cair na sua caixa de spam, por isso, lembre sempre de verificar lá.\nPara nós é muito importante que neste momento você não tenha dificuldade alguma.Não queremos  que você fique perdido na hora de realizar seu primeiro acesso.\nCaso você tenha  algum tipo de dificuldade, pode entrar em contato através do email [email de suporte], pois estamos prontos para atender à sua solicitação.\nOu se preferir CLIQUE AQUI PARA COM NOSSA EQUIPE NO WHATSAPP [WhatsApp de suporte]\nE por fim, não se esqueça de concluir essa operação que está em aberto para desbloquear todos os benefícios e bônus que estamos disponibilizando\nAbraços,\n[seu nome]"
  },
  "rec_email_boleto_emitido_2": {
    "channel": "email",
    "subject": "Você vai perder seu cadastro",
    "body": "Olá, tudo bem por aí?\nEstou passando apenas para lembrar que o seu boleto do {{produto}} já está perto de vencer. Caso esteja enfrentando alguma dificuldade para efetuar o pagamento, não deixe de me enviar uma mensagem, ok?\nCaso você precise reimprimir o seu boleto, pode fazê-lo por aqui: [link do boleto]\nSe você preferir a linha digitável para  pagar online, está aqui: [linha digitável]\nNão deixe passar essa oportunidade, não teremos uma nova turma tão cedo!\nAssim que identificarmos o pagamento do boleto, enviaremos um e-mail com registro da compra e o acesso imediato ao curso, assim como todos os seus bônus.\nAbraços!\n[seu nome]\nPS: Caso já tenha efetuado o pagamento do boleto, pode desconsiderar esta mensagem. Assim que recebermos a confirmação do banco, enviaremos um e-mail com os detalhes."
  },
  "pos_wpp_compra_aprovada": {
    "channel": "whatsapp",
    "body": "Olá, seja bem-vindo ao {{produto}}. Sua matrícula foi concluída com sucesso!\nVocê já deve ter recebido no seu e-mail todas as informações de acesso ao curso.\nVerifique a  sua caixa de entrada e encontre o e-mail com o título [título do email de boas-vindas], enviado por [seu nome].\nCaso não encontre o e-mail, lembre-se de verificar na sua caixa de spam ou promoções, pode ser que o e-mail tenha ido pra lá.\nQualquer dúvida ou dificuldade, é só enviar um e-mail para [email de suporte], que nossa equipe vai te ajudar o mais rápido possível.\nParabéns por ter dado esse passo importante e seja muito bem-vindo!\nAtt.,\n[nome da equipa]"
  },
  "pos_email_compra_aprovada_1": {
    "channel": "email",
    "subject": "Seja bem vindo ao {{produto}}",
    "body": "Parabéns por ter feito a sua inscrição para o {{produto}}.\nEstou te mandando esse e-mail para lhe dar boas-vindas e também para dizer que eu espero de verdade que esse curso supere todas as suas expectativas.\nEm breve, você vai receber todos os seus dados de  acesso ao curso. Lembre-se de checar sua caixa de SPAM.\nÉ bem  comum que esse e-mail demore um pouco para chegar, mas caso você não receba ou não o encontre,  entre em contato com nossa equipe via Whatsapp ou por e-mail, estaremos prontos para te ajudar.\nCLIQUE AQUI PARA ENTRAR EM CONTATO VIA WHATSAPP [WhatsApp de suporte]\nOu envie um e-mail para: [email de suporte]\nSeja muito bem-vindo ao {{produto}}.\nAbraços,\n[seu nome]"
  }
};
