# Engenharia de lançamentos: base de domínio para a plataforma

Documento de referência para o Claude Code. Descreve os dados, as relações, as fórmulas e as regras que estão nos modelos do Launch Drive, e como eles se traduzem numa plataforma de webinários que vendem (semelhante à HotWebinar).

Complementa `docs/automacao/base-conhecimento-disparos.md`, que traz os 26 modelos de e-mail e WhatsApp na íntegra.

## 0. Como ler este documento

Cada afirmação tem uma origem:

- **[FONTE]**: está escrito nos arquivos do Launch Drive. Respeitar à risca.
- **[INFERIDO]**: deduzido da estrutura dos arquivos (ordem de campos, nomes, fórmulas). Provável, mas confirmar.
- **[PROPOSTA]**: decisão de produto sugerida para a plataforma. Não está nos arquivos.

Arquivos de origem:

| Arquivo | Conteúdo |
|---|---|
| 2) Nicho, Avatar e Roma | Ficha do nicho, do avatar e da promessa |
| 3) Árvore de Objeções | Método de 4 passos para enfraquecer objeções |
| 4) Oferta, Visão Geral | Entregáveis, bônus, preço, garantia e o método da garantia condicional |
| 5) Lançamento, Visão Geral | Datas do lançamento clássico (CLI, CPL 1-3, Tsunami, carrinho, Efeito W) e metas |
| 6) Pesquisa de Avatar | Formulário e onde ele é enviado |
| 7) URLs de Lançamento | Páginas, slugs e links do lançamento clássico |
| 8) Planilha de Tráfego | Planejamento de investimento (com fórmulas), cronograma, campanhas, planilhamento de leads e criativos |
| Launch Drive Semente (pasta) | Versão de lançamento com um webinário ao vivo, páginas, disparos, recuperação e métricas finais |

## 1. O domínio em uma página

Um **lançamento** é uma operação com data marcada que transforma tráfego em lista de inscritos, inscritos em audiência de conteúdo e audiência em compradores durante uma janela curta de carrinho aberto.

A cadeia de valor é sempre a mesma:

```
Avatar e ROMA → Oferta e objeções → Páginas → Tráfego → Lista de inscritos
→ Aquecimento e conteúdo (webinário ou CPLs) → Carrinho aberto → Venda
→ Recuperação → Métricas finais
```

Existem dois modelos nos arquivos:

| | Lançamento Semente | Lançamento Clássico (CPL) |
|---|---|---|
| Conteúdo | 1 webinário ao vivo no YouTube [FONTE] | 3 aulas gravadas: CPL 1, CPL 2, CPL 3 [FONTE] |
| Fases | PPL (14 dias) → PL (dia do webinário) → L (carrinho) [FONTE] | CLI → AL → Pré-lançamento → Lançamento [FONTE] |
| Abertura de carrinho | No próprio webinário [FONTE] | Depois do CPL 3 e do Efeito Tsunami [FONTE] |
| Página de venda | /replay (replay "Só o filé" + botão de compra) [FONTE] | /matriculas-abertas + vídeo de vendas [FONTE] |
| Divisão de orçamento | 65% lead · 25% distribuição · 10% remarketing [FONTE] | 80% lead · 20% remarketing (distribuição é mensal e separada) [FONTE] |
| Metas padrão | 500 leads · 100 de comparecimento · 1 venda [FONTE] | Calculadas a partir de orçamento, CPL, conversão e preço [FONTE] |

Na plataforma, o **webinário automático** substitui ou repete o webinário ao vivo do Semente, e pode hospedar as aulas do Clássico. [PROPOSTA]

## 2. Glossário

| Termo | Significado | Origem |
|---|---|---|
| Avatar | Perfil do cliente ideal: dados demográficos, dores, aspirações, objeções | [FONTE] |
| ROMA | A promessa central, o destino que o avatar quer alcançar. Usada como título da página de captura, primeira etapa do roteiro e critério da garantia | [FONTE] |
| CLI | Construção da Lista de Inscritos. Começa 14 dias antes do CPL 1 | [FONTE] |
| AL | Aquecimento de Lançamento. Semana anterior aos CPLs | [FONTE] |
| CPL | Conteúdo de pré-lançamento. Três aulas gravadas no YouTube, com páginas de blog aula-01, aula-02, aula-03 | [FONTE] |
| PPL / PL / L | Fases do Semente: pré-pré-lançamento, pré-lançamento (dia do webinário), lançamento (carrinho) | [FONTE] |
| Efeito Tsunami | Data e campanha de remarketing entre o fim da CLI e a abertura de carrinho | [FONTE] nome; função não descrita |
| Efeito W | Data entre a abertura e o fechamento do carrinho | [FONTE] nome; função não descrita |
| Carrinho aberto | Janela em que a oferta está à venda | [FONTE] |
| Distribuição | Investimento contínuo e mensal em conteúdo impulsionado, fora do lançamento, dividido em Raiz e Nutella | [FONTE] |
| Raiz / Nutella | Os dois tipos de conteúdo de distribuição. Cada um recebe metade do orçamento mensal. Também nomeiam públicos de vídeo | [FONTE] divisão; definição de cada tipo não descrita |
| CPL (métrica) | Custo por lead. Atenção: mesma sigla de "conteúdo de pré-lançamento". No código usar `custoPorLead` e `aulaCpl` | [FONTE] / [PROPOSTA] nomes |
| Tiro de alerta | Pesquisa do avatar enviada logo após a inscrição | [FONTE] |
| Double opt-in | Acessar a página de obrigado confirma o e-mail | [FONTE] |
| Só o filé | Versão editada do webinário com os melhores momentos | [FONTE] |
| Proteção de checkout | Pop-up que captura e-mail e telefone antes do checkout, alimenta a recuperação | [FONTE] |
| Joinzap | Ferramenta do link do grupo de WhatsApp | [FONTE] |
| Grupo prioritário | Link extra do lançamento clássico | [FONTE] nome; função não descrita |

## 3. Linha do tempo

### 3.1 Clássico (CPL) [FONTE]

Datas que o usuário preenche, nesta ordem:

```
inicioCli → cpl1 → cpl2 → cpl3 → fimCli → efeitoTsunami → aberturaCarrinho → efeitoW → fechamento
```

Cronograma em quatro semanas de segunda a domingo:

| Semana | Fase | Regra |
|---|---|---|
| 1 | CLI | Começa 14 dias antes do CPL 1 |
| 2 | AL | 1 semana antes dos CPLs |
| 3 | Pré-lançamento | Semana dos CPLs |
| 4 | Lançamento | Carrinho aberto |

**Invariante [INFERIDO]:** cada data é maior ou igual à anterior. `cpl1 - inicioCli = 14 dias`.

### 3.2 Semente [FONTE]

```
inicioCaptacao → dataWebinario (= aberturaCarrinho) → fechamentoCarrinho
```

PPL dura 14 dias antes do webinário. Os disparos se posicionam por deslocamento em relação ao webinário: D-7, D-4, D-1, D0, D+1.

### 3.3 Modelo genérico para o código [PROPOSTA]

Representar qualquer lançamento como uma lista ordenada de **marcos** (milestones) com tipo e data. Fases, disparos e campanhas apontam para um marco com um deslocamento:

```ts
type MarcoTipo =
  | 'inicio_captacao' | 'fim_captacao'
  | 'aula_cpl_1' | 'aula_cpl_2' | 'aula_cpl_3'
  | 'webinario' | 'efeito_tsunami'
  | 'abertura_carrinho' | 'efeito_w' | 'fechamento_carrinho';

interface Agendamento {
  marco: MarcoTipo;
  deslocamentoMin: number; // negativo = antes do marco
}
```

Assim "Faltam 7 dias" vira `{ marco: 'webinario', deslocamentoMin: -7*24*60 }` e "É hoje termina 30 min antes" vira `{ marco: 'webinario', deslocamentoMin: -30 }`.

## 4. Entidades e campos

Tipos em TypeScript para orientar o esquema. Os campos vêm dos arquivos; nomes e tipos são [PROPOSTA].

```ts
interface Nicho { nicho: string; subnicho: string; }

type CategoriaDorAspiracao = 'pessoal' | 'profissional' | 'fisica' | 'emocional' | 'relacionamento';

interface Avatar {
  idade?: string; sexo?: string; salario?: string; profissao?: string;
  religiao?: string; orientacaoPolitica?: string; outras?: string;
  resumo: string;                 // até 4 linhas [FONTE]
  dores: { texto: string; categoria: CategoriaDorAspiracao }[];        // top 10 [FONTE]
  aspiracoes: { texto: string; categoria: CategoriaDorAspiracao }[];   // top 10 [FONTE]
  objecoes: Objecao[];            // top 10 no modelo Semente [FONTE]
}

interface Roma { texto: string; }  // a promessa

type TipoObjecao = 'universal' | 'especifica';
interface Objecao {
  tipo: TipoObjecao;
  definicao: string;          // passo 1
  empatia: string;            // passo 2
  argumentoLogico: string;    // passo 3, gatilho da razão
  evidencias?: string;        // passo 4, pessoas que superaram e chegaram à ROMA (se aplicável)
}

interface Entregavel { oQue: string; beneficio: string; dorQueResolve: string; }

type TipoBonus = 'resolve_objecao' | 'problema_futuro' | 'retorno_do_rei' | 'outro';
// 'retorno_do_rei' (ancoragem de preço) aparece só no Semente [FONTE]
interface Bonus { tipo: TipoBonus; oQue: string; beneficio: string; dorQueResolve: string; objecaoId?: string; }

interface Garantia {
  incondicional: { prazoDias: number };
  condicional?: {
    prazoDias: number;                 // recomendado 90
    condicoesComprometimento: string[]; // ex.: assistir todas as aulas
    condicaoResultado: 'nao_atingiu_roma' | 'nao_atingiu_resultado_minimo';
    resultadoMinimo?: string;
    recuperacao: string;               // recomendado: consultoria individual + plano de 90 dias
    compensacao: { valorExtra: number };   // recomendado: dinheiro de volta + R$ 500
  };
}

interface Oferta {
  nomeProduto: string; roma: string;
  entregaveis: Entregavel[];
  comoEntrega: string; quandoEntrega: string;
  bonus: Bonus[];
  ancoragem: string;                 // comparáveis
  precoAVista: number; precoParcelado?: string;
  formasPagamento: string[];
  garantia: Garantia;
}

type TipoLancamento = 'semente' | 'classico';

interface Lancamento {
  id: string; tipo: TipoLancamento;
  nomeEvento: string;               // "Nome do Evento de CPL" [FONTE]
  nicho: Nicho; avatar: Avatar; roma: Roma; oferta: Oferta;
  marcos: { tipo: MarcoTipo; data: string }[];
  planejamento: PlanejamentoInvestimento;
  dominio: string;                  // sem barra no final [FONTE]
}
```

Páginas, links, campanhas, leads e disparos estão nas seções 7 a 10.

## 5. Motor de cálculo (fórmulas exatas das planilhas)

### 5.1 Clássico: Planejamento de Investimento [FONTE]

Entradas: `orcamentoDistribuicaoMensal`, `orcamentoTotal`, `pctLead` (padrão 0,80), `pctRemarketing` (padrão 0,20), `metaCustoPorLead`, `metaConversao`, `precoProduto`, `inicioCaptacao`, `fimCaptacao`, `diasLembrete`.

```
investSemanalRaiz        = orcamentoDistribuicaoMensal / 2 / 4
investSemanalNutella     = orcamentoDistribuicaoMensal / 2 / 4

investTotalLead          = orcamentoTotal * pctLead
metaLeads                = investTotalLead / metaCustoPorLead
totalDias                = fimCaptacao - inicioCaptacao + 1
metaLeadsPorDia          = metaLeads / totalDias
metaOrcamentoDiario      = metaLeadsPorDia * metaCustoPorLead

metaVendas               = metaLeads * metaConversao
metaFaturamento          = metaVendas * precoProduto
saldo                    = metaFaturamento - orcamentoTotal

investTotalRemarketing   = orcamentoTotal * pctRemarketing
investRmktLembrete       = investTotalRemarketing * 0,25
investRmktLembreteDia    = investRmktLembrete / diasLembrete
investRmktCpls           = investTotalRemarketing * 0,50
investRmktCarrinho       = investTotalRemarketing * 0,25
```

Recomendações escritas na planilha [FONTE]:

- `pctLead` entre 75% e 85%; `pctRemarketing` entre 15% e 25%. Os dois somam 100%.
- Distribuição mensal não deve ser menor que 10% do orçamento total do próximo lançamento.
- Orçamento total não deve ser menor que 4 vezes a distribuição mensal.
- Juntas, as duas regras colocam a distribuição mensal entre 10% e 25% do orçamento do lançamento. [INFERIDO]

Exemplo numérico (valores fictícios, só para teste):

| Entrada | Valor |
|---|---|
| orcamentoTotal | 10.000 |
| pctLead / pctRemarketing | 0,80 / 0,20 |
| metaCustoPorLead | 4,00 |
| metaConversao | 1% |
| precoProduto | 997 |
| captação | 14 dias |
| diasLembrete | 7 |

| Saída | Valor |
|---|---|
| investTotalLead | 8.000 |
| metaLeads | 2.000 |
| metaLeadsPorDia | 142,86 |
| metaOrcamentoDiario | 571,43 |
| metaVendas | 20 |
| metaFaturamento | 19.940 |
| saldo | 9.940 |
| investTotalRemarketing | 2.000 |
| lembrete / por dia | 500 / 71,43 |
| CPLs | 1.000 |
| carrinho aberto | 500 |

### 5.2 Semente: Planejamento de Investimento [FONTE]

```
investLead               = orcamentoTotal * 0,65
metaMinimaLeads          = 500           (editável)
metaCustoPorLead         = investLead / metaMinimaLeads
metaComparecimento       = 100           (editável)
metaVendas               = 1             (editável)
investDistribuicao       = orcamentoTotal * 0,25
impulsionarPorSemana     = investDistribuicao / semanasAteLancamento
investRemarketing        = orcamentoTotal * 0,10
```

Diferença importante: no Semente o custo por lead é **saída** (orçamento ÷ meta de leads); no Clássico é **entrada** e a meta de leads é a saída. O código deve suportar as duas direções. [INFERIDO]

### 5.3 Planilhamento diário de leads [FONTE]

Por dia e por origem (Facebook/Instagram, Google/YouTube, total): quantidade de leads, custo por lead, valor gasto.

Painel de visão geral:

```
totalGasto, totalLeads
faltamCaptar            = metaLeads - totalLeads
cplGeral                = totalGasto / totalLeads
cplVsMeta               = cplGeral - metaCustoPorLead      (acima ou abaixo)
diasCaptados, diasRestantes
mediaLeadsDia           = totalLeads / diasCaptados
leadsDiaVsMeta          = mediaLeadsDia - metaLeadsPorDia
```

Fórmulas do painel deduzidas dos rótulos. [INFERIDO]

### 5.4 Planilhamento de criativos [FONTE]

Por criativo e por rede (Facebook/Instagram, YouTube): nome, tipo, leads, custo por lead, alcance, impressões, cliques, CPC, valor gasto.

### 5.5 Métricas finais [FONTE]

```
custoPorLead   = investLeads / nLeads
conversao      = nVendas / nLeads
roi            = faturamentoBruto / investTotalTrafego
```

Atenção: o "ROI" da planilha é uma razão (equivale a ROAS). Exibir como "ROI (fat./invest.)" ou calcular também `(faturamento - investimento) / investimento`. [PROPOSTA]

## 6. Regras de negócio da oferta

### 6.1 Garantia condicional [FONTE]

Princípio: **Preço = Oportunidade − Risco.** Sem muitas provas de alunos que chegaram à ROMA, o risco fica com o avatar; a garantia condicional transfere esse risco para o vendedor.

Sugestão padrão: **90 + 90 + 500**: 90 dias de garantia condicional, 90 dias de recuperação, R$ 500 além do dinheiro de volta.

Fluxo de uma solicitação de garantia condicional, como máquina de estados [PROPOSTA a partir da FONTE]:

```
solicitada
  → verificar_comprometimento   (cumpriu todas as condições? se não: negada)
  → verificar_resultado         (não atingiu a ROMA ou o resultado mínimo? se atingiu: negada)
  → recuperacao                 (consultoria individual + plano de 90 dias, obrigatória)
  → reavaliacao                 (atingiu o resultado? se sim: encerrada_com_sucesso)
  → compensada                  (reembolso + compensação em dinheiro)
```

A garantia incondicional é separada: prazo fixo, reembolso sem justificativa. A FAQ de exemplo da página de replay usa 30 dias. [FONTE]

### 6.2 Árvore de objeções [FONTE]

1. Identificar as objeções e classificar como universais ou específicas.
2. Para cada uma: definir, gerar empatia, apresentar argumento lógico, apresentar evidências de quem superou e chegou à ROMA (se aplicável).

Onde cada objeção é usada:

| Destino | Origem |
|---|---|
| Roteiro do webinário ("ao longo do roteiro, resolver objeções") | [FONTE] |
| Bônus que resolve objeções | [FONTE] |
| FAQ da página de venda | [FONTE] |
| Respostas do chat simulado e do agente de suporte da sala | [PROPOSTA] |
| Criativos e disparos de carrinho aberto | [PROPOSTA] |

### 6.3 Avatar e copy

- Dores e aspirações são classificadas em cinco categorias: pessoais, profissionais, físicas, emocionais, relacionamento. [FONTE]
- Criativos de captação têm variações por dor, desejo e oportunidade (VD_06, VD_07, VD_08). [FONTE]
- A pesquisa de avatar é enviada no e-mail de obrigado e na mensagem de boas-vindas do WhatsApp. [FONTE]
- Na plataforma, as respostas da pesquisa devem alimentar a ficha do avatar e ser cruzadas com o lead. [PROPOSTA]

## 7. Páginas, URLs e convenções

### 7.1 Clássico [FONTE]

Domínio limpo, sem barra no final. Slug = final da URL.

| Nome da página | Slug |
|---|---|
| [LAUNCH] - [INSCREVER] - [ORGÂNICO] | /inscrever-org |
| [LAUNCH] - [INSCREVER] - [FACEBOOK-INSTAGRAM] | /inscrever-fb-ig |
| [LAUNCH] - [INSCREVER] - [GOOGLE] | /inscrever-gg |
| [LAUNCH] - [OBRIGADO] - [ORGANICO] | /obrigado-org |
| [LAUNCH] - [OBRIGADO] - [FACEBOOK-INSTAGRAM] | /obrigado-fb |
| [LAUNCH] - [OBRIGADO] - [GOOGLE] | /obrigado-gg |
| [FUNIL] - [PRODUTO] - [PAGINA_VENDAS] | /matriculas-abertas |
| Blog de lançamento, aulas | /aula-01, /aula-02, /aula-03 |

Links extras: Joinzap, pesquisa do avatar, comunidade no Facebook, grupo prioritário, CPLs no YouTube (aula 01, 02, 03, vídeo de vendas), checkout da oferta principal.

### 7.2 Semente [FONTE]

/inscrever, /inscrever-fb-ig, /inscrever-gg, /pendente, /pendente-gg, /obrigado, /obrigado-gg, /replay.

### 7.3 Regras [FONTE]

- Uma página por origem de tráfego. A página de entrada define a origem do lead.
- Cada página tem uma única ação.
- Formulário de captura visível sem rolar a página e repetido no fim.
- Todas as páginas: pixel do Facebook, pixel do Google Ads, padrão de URL, certificado de segurança. Página de obrigado do Google: snippet de conversão.
- Página de venda: botão de compra com proteção de checkout.
- Nome de página e de público segue `[TIPO] - [DETALHE] - [JANELA ou ORIGEM]`.

```ts
type OrigemTrafego = 'organico' | 'fb_ig' | 'google';
type TipoPagina = 'inscricao' | 'confirmacao' | 'obrigado' | 'replay' | 'vendas' | 'aula';
interface Pagina { tipo: TipoPagina; origem?: OrigemTrafego; slug: string; nomeInterno: string; acaoUnica: string; }
```

## 8. Tráfego

### 8.1 Campanhas de captação, Clássico [FONTE]

| Campanha | Conjuntos | Notas |
|---|---|---|
| Compacta | 00 Públicos internos · 01 Lookalikes | |
| Envolvimento #1 | 30D · 90D · 180D | |
| Envolvimento #2 | 60D · 180D · 365D | |
| Video View | VV 95% 60D · VV 75% 180D · VV 50% 365D | |
| Geográfica | Um conjunto por estado | Conversões; sem segmentação de público, apenas o estado; segmentação na comunicação ("Se você é o [AVATAR] e mora em MG") |
| Jedi #1 | Vídeo 15s + captura · Lista completa · Visitou site · Envolvimento · Video view | Conversões (clique ou visualização em 1 dia) |
| Jedi #2 | Lookalike 1-3 · Interesse 1-3 · Grupo interesse · Brasil | Conversões |

### 8.2 Remarketing por fase [FONTE]

| Bloco | Campanhas | Objetivo | Agenda |
|---|---|---|---|
| Lembrete | Faltam 7, 6, 5, 4, 3, 2, 1 dias | Alcance, impressões | Cada conjunto de 00h00 a 23h59 do seu dia |
| CPLs | CPL 1 no ar · CPL 2 no ar · CPL 3 no ar | Tráfego | Início e término por campanha |
| Carrinho aberto | Efeito Tsunami · Inscrições abertas primeiras horas · Primeiro dia · Últimas horas do primeiro dia · Geral · Encerra amanhã · Encerra hoje · Últimas horas | Tráfego | Início e término por campanha |

Todas as campanhas de remarketing de CPL e carrinho usam três conjuntos: 00 Inscritos, 01 Página de captura + vídeo, 02 Envolvimento 30D. [FONTE]

No Semente: Lembrete (Faltam X dias), Lembrete (É hoje, das 00h00 até 30 min antes do webinário), Replay e Encerra hoje. [FONTE]

### 8.3 Públicos [FONTE]

- Facebook: envolvimento FB e IG, visitou site, página de inscrição, página de obrigado, video view Raiz e Nutella (95%, 75%, 50%, 25%, 15s).
- Google: visualizou vídeo, inscritos no canal, visitou canal, curtiu, compartilhou, viu anúncio, adicionou à playlist, visitou site, inscrição, obrigado.
- Janelas: 7, 14, 30, 60, 90, 180, 365 dias.

```ts
interface Publico { rede: 'facebook' | 'google'; tipo: string; detalhe?: string; janelaDias: 7|14|30|60|90|180|365; nome: string; }
// nome gerado: `[${tipo}] - [${detalhe}] - [${janelaDias}D]`
```

### 8.4 Alinhamento entre tráfego e disparos [INFERIDO]

Os mesmos marcos acionam anúncios e mensagens. "Faltam 7 dias" existe como e-mail, WhatsApp, vídeo de remarketing, imagem de remarketing e conjunto de anúncio. A plataforma deve tratar o marco como fonte única e gerar as peças de cada canal a partir dele.

## 9. Disparos

O catálogo completo está em `docs/automacao/base-conhecimento-disparos.md`. Resumo da lógica:

| Gatilho | Segmento | Fase |
|---|---|---|
| Inscrição | Inscrito | PPL / CLI |
| Contagem regressiva | Todos os inscritos | PPL e PL / AL |
| Conteúdo no ar | Inscritos | PL / Pré-lançamento |
| Carrinho aberto | Quem não comprou | L / Lançamento |
| Compra cancelada | Iniciou e não concluiu | Recuperação |
| Boleto emitido | Boleto pendente | Recuperação |
| Compra aprovada | Comprador | Pós-venda (sem modelo) |

Para o Clássico não há modelos de disparo nos arquivos. Os momentos esperados, a partir das campanhas de remarketing, são: CPL 1, 2 e 3 no ar, Efeito Tsunami, inscrições abertas (primeiras horas, primeiro dia, últimas horas do primeiro dia, geral), encerra amanhã, encerra hoje, últimas horas. [INFERIDO]

## 10. Tradução para a plataforma [PROPOSTA]

### 10.1 Módulos

| Módulo | O que guarda | De onde vem |
|---|---|---|
| Estratégia | Nicho, avatar, ROMA, objeções, oferta, garantia | Seções 4 e 6 |
| Planejador | Marcos, metas, divisão de orçamento, calculadora | Seções 3 e 5 |
| Páginas | Captura por origem, confirmação, obrigado, venda, aulas | Seção 7 |
| Sala de webinário | Transmissão automática, chat sincronizado, oferta agendada, notificações de compra, replay | Produto de referência |
| Automação | Gatilhos, segmentos, modelos, disparos | Seção 9 e base de disparos |
| Checkout e integrações | Eventos de compra vindos da plataforma de pagamento | Recuperação |
| Tráfego | Planejamento, nomenclatura de públicos e campanhas, planilhamento diário | Seção 8 |
| Relatórios | Planilhamento de leads, criativos, métricas finais | Seção 5 |

### 10.2 Catálogo de eventos

```
lead.criado                { origem, paginaSlug }
lead.email_confirmado      // acesso à página de obrigado (double opt-in)
lead.entrou_grupo          // Joinzap
pesquisa.respondida
aula.iniciada | aula.concluida   { aula, percentual }
webinario.presenca         { aoVivo: boolean, minutosAssistidos }
oferta.exibida | oferta.clicada
checkout.iniciado          // proteção de checkout captura e-mail e telefone
compra.cancelada | compra.abandonada
boleto.gerado | boleto.vencido
compra.aprovada | compra.reembolsada
garantia.solicitada        { tipo: 'incondicional' | 'condicional' }
```

### 10.3 Estado do contato

```
inscrito → confirmado → presente → (comprou | boleto_pendente | compra_cancelada | nao_comprou)
```

Regras de exclusão: quem comprou sai das chamadas de venda; quem tem boleto pendente pausa as chamadas de venda até pagar ou o boleto vencer.

## 11. Invariantes para validação

1. Datas dos marcos em ordem crescente. [INFERIDO]
2. No Clássico, `cpl1 = inicioCli + 14 dias`. [FONTE]
3. `pctLead + pctRemarketing = 1`. [INFERIDO]
4. Divisão do remarketing do Clássico: lembrete 25%, CPLs 50%, carrinho 25%, total 100%. [FONTE]
5. Distribuição mensal ≥ 10% do orçamento total e orçamento total ≥ 4 × distribuição mensal. Avisar, não bloquear. [FONTE] recomendação
6. Toda divisão por zero (meta de CPL, dias, leads) devolve vazio, não erro. As planilhas mostram #DIV/0!. [PROPOSTA]
7. Uma página de inscrição e de obrigado por origem de tráfego. [FONTE]
8. Cada página tem uma única ação. [FONTE]
9. Domínio salvo sem barra no final. [FONTE]
10. Garantia condicional exige prazo, comprometimento, resultado, recuperação e compensação preenchidos. [FONTE]

## 12. Lacunas e perguntas abertas

- Efeito Tsunami, Efeito W e grupo prioritário: o que fazem não está escrito.
- Raiz e Nutella: os arquivos dividem o orçamento, mas não definem cada tipo de conteúdo.
- Não há modelos de disparo para o lançamento clássico nem para compra aprovada.
- Meta % de conversão e preço do produto não têm valor padrão no Clássico.
- Bônus "retorno do rei" existe só no Semente; no Clássico os bônus são opcionais.
- O lançamento clássico não tem página de confirmação (/pendente); o Semente tem.
- As planilhas de cronograma de disparos estão vazias: horários exatos não estão definidos.

## 13. Exemplo de lançamento preenchido (fictício, para testes)

```json
{
  "id": "lan_001",
  "tipo": "classico",
  "nomeEvento": "Semana Exemplo",
  "dominio": "https://exemplo.com.br",
  "marcos": [
    { "tipo": "inicio_captacao", "data": "2026-11-02" },
    { "tipo": "aula_cpl_1", "data": "2026-11-16" },
    { "tipo": "aula_cpl_2", "data": "2026-11-18" },
    { "tipo": "aula_cpl_3", "data": "2026-11-20" },
    { "tipo": "fim_captacao", "data": "2026-11-15" },
    { "tipo": "efeito_tsunami", "data": "2026-11-22" },
    { "tipo": "abertura_carrinho", "data": "2026-11-23" },
    { "tipo": "efeito_w", "data": "2026-11-26" },
    { "tipo": "fechamento_carrinho", "data": "2026-11-29" }
  ],
  "planejamento": {
    "orcamentoDistribuicaoMensal": 1500,
    "orcamentoTotal": 10000,
    "pctLead": 0.8,
    "pctRemarketing": 0.2,
    "metaCustoPorLead": 4,
    "metaConversao": 0.01,
    "precoProduto": 997,
    "diasLembrete": 7
  },
  "oferta": {
    "nomeProduto": "Curso Exemplo",
    "precoAVista": 997,
    "precoParcelado": "12x",
    "garantia": {
      "incondicional": { "prazoDias": 30 },
      "condicional": {
        "prazoDias": 90,
        "condicoesComprometimento": ["Assistir todas as aulas", "Participar dos encontros"],
        "condicaoResultado": "nao_atingiu_roma",
        "recuperacao": "Consultoria individual e plano de ação de 90 dias",
        "compensacao": { "valorExtra": 500 }
      }
    }
  }
}
```

Os valores deste exemplo são inventados. Ordem dos marcos no exemplo: o fim da captação antes do CPL 1 é uma escolha do exemplo; os arquivos não fixam essa relação.
