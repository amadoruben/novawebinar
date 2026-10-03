# Modelo de disparo: especificação para a plataforma

Esta é a especificação do motor de disparos: o que dispara uma mensagem, quem a recebe, quando ela sai, por qual canal e o que a cancela. Foi escrita para o Claude Code implementar.

Arquivos desta etapa:

| Arquivo | Uso |
|---|---|
| `docs/automacao/modelo-de-disparo.md` | Este documento: conceitos, fluxos, regras, estados |
| `docs/automacao/modelo-de-disparo.json` | Dados prontos para seed: 8 fluxos, 32 modelos com corpo normalizado, dicionário de variáveis |
| `docs/automacao/base-conhecimento-disparos.md` | Textos originais dos modelos de lançamento |
| `docs/automacao/engenharia-de-lancamentos.md` | Marcos, fórmulas, oferta, páginas, tráfego |

Marcadores: **[FONTE]** está nos arquivos · **[INFERIDO]** deduzido do texto · **[PROPOSTA]** decisão sugerida.

---

## 1. Conceitos

```
Evento ──► Fluxo ──► Passo ──► Modelo ──► Disparo
            │          │
            │          └─ agendamento (base + deslocamento) e condição de envio
            └─ condições de entrada e eventos de saída
```

| Conceito | Definição |
|---|---|
| **Evento** | Algo que aconteceu com um contato (`lead.criado`, `boleto.gerado`) ou um marco do lançamento que chegou (`marco:webinario`) |
| **Fluxo** | Sequência de passos ligada a um gatilho. Tem regra de entrada e lista de eventos que a encerram |
| **Passo** | Um modelo a enviar num momento relativo a uma base. Pode ter condição própria |
| **Modelo** | Texto com assunto (e-mail), corpo, variáveis e links. Pertence a um canal |
| **Disparo** | Instância concreta: um modelo, para um contato (ou um grupo), numa data e hora, com status |

### 1.1 Dois tipos de fluxo

| | Campanha | Transacional |
|---|---|---|
| Gatilho | Marco do calendário do lançamento | Ação do contato ou do checkout |
| Fluxos | captação, aquecimento, evento, carrinho | carrinho abandonado, pagamento recusado, boleto emitido, compra aprovada |
| Volume | Todos os inscritos de uma vez | Um contato por vez |
| Prioridade [PROPOSTA] | Normal | Alta, passa à frente da fila |
| Janela de silêncio [PROPOSTA] | Respeita | Ignora só em compra aprovada |

### 1.2 Dois destinos no WhatsApp [INFERIDO]

Este ponto muda a arquitetura:

- **Grupo:** as 12 mensagens de WhatsApp do lançamento são publicadas no grupo do evento. A boas-vindas diz "Sejam bem-vindos ao grupo"; só administradores postam [FONTE]. Uma mensagem de grupo **não pode ser segmentada**: quem já comprou também vê as chamadas de venda.
- **Individual:** as 3 mensagens transacionais (carrinho abandonado, boleto emitido, compra aprovada) vão para o número do contato. Hoje isso é feito à mão pela planilha de recuperação, com link `api.whatsapp.com/send?phone=` [FONTE].

Modelo de dados: `modelo.destino = 'individual' | 'grupo'`. Disparo de grupo tem `grupo_id` e não tem `contato_id`.

O e-mail é sempre individual, então é o canal onde as regras de exclusão funcionam por completo.

---

## 2. Eventos

### 2.1 Eventos de contato [PROPOSTA a partir da FONTE]

| Evento | Quando | Fonte no material |
|---|---|---|
| `lead.criado` | Formulário da página de inscrição enviado | Página de captura |
| `lead.email_confirmado` | Acesso à página de obrigado (double opt-in) | Página de obrigado |
| `lead.entrou_grupo` | Entrada no grupo pelo Joinzap | Página de confirmação |
| `pesquisa.respondida` | Pesquisa do avatar respondida | E-mail 1 e boas-vindas |
| `webinario.presenca` | Entrou na sala ao vivo | É hoje / Ao vivo |
| `checkout.iniciado` | Proteção de checkout capturou e-mail e telefone | Página de replay |
| `pagamento.recusado` | Cartão recusado ou cancelado pela operadora | E-mail pagamento recusado |
| `boleto.gerado` | Boleto emitido | E-mails de boleto |
| `boleto.pago` | Banco confirmou (24 a 48 h) | E-mail carrinho abandonado 1, P.S.2 |
| `boleto.vencido` | Passou o prazo de 3 dias úteis | WhatsApp boleto emitido |
| `compra.aprovada` | Pagamento confirmado (cartão, Pix ou boleto pago) | Compra aprovada |
| `compra.reembolsada` | Reembolso dentro da garantia | Garantia de 7 dias nos e-mails |

Os eventos de pagamento chegam por webhook da plataforma de pagamento. O e-mail de pagamento recusado cita a Pagar-me [FONTE]. O motor deve receber eventos normalizados, não o formato de cada gateway.

### 2.2 Eventos de marco

Os marcos do lançamento (`webinario`, `abertura_carrinho`, `fechamento_carrinho`…) viram eventos agendados. Ver `engenharia-de-lancamentos.md`, seção 3.

---

## 3. Agendamento

Cada passo tem `base` e `offset`.

| Base | Exemplo | Significado |
|---|---|---|
| `evento` | `+15m` | 15 minutos depois do evento que iniciou o fluxo |
| `evento:lead.entrou_grupo` | `+0m` | Quando outro evento acontecer |
| `marco:webinario` | `-7d@hora_padrao` | 7 dias antes do webinário, na hora padrão |
| `marco:webinario` | `+0m` | Na hora exata do início |
| `marco:fechamento_carrinho` | `D0@20:00` | No dia do fechamento, às 20h |
| `boleto.vencimento` | `-1du@hora_padrao` | 1 dia útil antes do vencimento |

Gramática do `offset`:

```
offset   := ('+' | '-')? numero unidade ('@' hora)? ('+' numero 'h')?
          | 'D0' '@' hora
unidade  := 'm' | 'h' | 'd' | 'du'        (du = dia útil)
hora     := 'HH:MM' | 'hora_padrao'
```

`hora_padrao` é configurável por lançamento [PROPOSTA]. Os arquivos fixam o **dia** de cada envio, não a hora. As planilhas de cronograma têm campos de data e hora, mas estão vazias [FONTE].

### 3.1 Regras de agendamento [PROPOSTA]

1. **Avaliar no envio, não no agendamento.** A condição de envio e o segmento são conferidos no instante de enviar. Quem comprou entre o agendamento e o envio não recebe.
2. **Sem envio retroativo.** Quem se inscreve depois de D-7 não recebe "Faltam 7 dias".
3. **Marco alterado reagenda.** Se a data do webinário muda, todos os disparos pendentes com base nesse marco são recalculados.
4. **Janela de silêncio** para WhatsApp individual: 22h às 8h. O que cair nela vai para as 8h. Exceção: compra aprovada.
5. **Fuso horário** do lançamento, salvo junto com os marcos.

---

## 4. Os 8 fluxos

### 4.1 Captação · campanha · gatilho `lead.criado`

| # | Modelo | Canal | Quando | Condição |
|---|---|---|---|---|
| 1 | Obrigado + pesquisa ("Preciso da sua ajuda") | E-mail | +0m [INFERIDO] | — |
| 2 | Convite para o grupo ("Tudo o que você precisa para acessar o evento") | E-mail | +1d [INFERIDO: "ontem você se inscreveu"] | Não entrou no grupo [PROPOSTA] |
| 3 | Boas-vindas + pesquisa | WhatsApp grupo | Quando entrar no grupo [FONTE] | — |

### 4.2 Aquecimento · campanha · gatilho marco `webinario`

| Modelo | E-mail | WhatsApp grupo | Quando |
|---|---|---|---|
| Faltam 7 dias | ✓ | ✓ | -7d [FONTE] |
| Faltam 4 dias (link para definir lembrete) | ✓ | ✓ | -4d [FONTE] |
| É amanhã | ✓ | ✓ | -1d [FONTE] |

### 4.3 Evento · campanha · gatilho marco `webinario`

| Modelo | E-mail | WhatsApp grupo | Quando |
|---|---|---|---|
| É hoje | ✓ | ✓ | D0, hora padrão [FONTE dia] |
| Estamos ao vivo | ✓ | ✓ | +0m, no início [FONTE] |

### 4.4 Carrinho · campanha · marcos `webinario` e `fechamento_carrinho`

Entrada: inscritos sem compra aprovada e sem boleto pendente [PROPOSTA]. No grupo de WhatsApp a exclusão não funciona (ver 1.2).

| Modelo | E-mail | WhatsApp grupo | Quando |
|---|---|---|---|
| Replay disponível | ✓ | chamada 1 e chamada 2 | +1d [INFERIDO: "ontem"]; chamada 2 +6h [PROPOSTA] |
| Só o filé | ✓ | chamada 1 e chamada 2 | +2d [PROPOSTA] |
| Encerra hoje | ✓ | ✓ | Dia do fechamento [FONTE]; encerra às 23h59 [FONTE] |
| Última chamada | ✓ | ✓ | Dia do fechamento, 20h [PROPOSTA] |

Saída: `compra.aprovada`, `boleto.gerado`, fechamento do carrinho.

Todos os modelos desta fase repetem o mesmo bloco de oferta: entregáveis, bônus, garantia [FONTE]. No sistema, trate o bloco como **parcial reutilizável** do lançamento.

### 4.5 Carrinho abandonado · transacional · `checkout.iniciado` sem compra

| # | Modelo | Canal | Quando |
|---|---|---|---|
| 1 | "Eu vi aqui você iniciou a sua inscrição… mas por algum motivo não concluiu" | WhatsApp individual | +15m [PROPOSTA] |
| 2 | "Operação em aberto no seu nome": urgência, vaga liberada hoje, formas de pagamento | E-mail | +1h [PROPOSTA] |
| 3 | "Eu acho que você precisa de ajuda": suporte, reembolso em 7 dias, links por forma de pagamento | E-mail | +24h [PROPOSTA] |

Saída: `compra.aprovada`, `boleto.gerado` (passa para o fluxo de boleto), `pagamento.recusado`, fechamento do carrinho.

O e-mail 2 diz "iremos liberar a sua vaga ainda hoje" [FONTE]: só enviar com o carrinho aberto.
O P.S.2 do e-mail 2 trata quem pagou boleto e espera validação (24 a 48 h) [FONTE]. Por isso a saída por `boleto.gerado` é obrigatória.

O arquivo do WhatsApp se chama "Compra cancelada", mas o texto trata de compra iniciada e não concluída. Classificado aqui como carrinho abandonado [INFERIDO].

### 4.6 Pagamento recusado · transacional · `pagamento.recusado`

| Modelo | Canal | Quando |
|---|---|---|
| "[Urgente] Seu cadastro foi cancelado": motivos (saldo, dados, operadora), nova inscrição, formas de pagamento, reembolso em 7 dias | E-mail | +0m [FONTE: "caráter de urgência"] |

Saída: `compra.aprovada`, `boleto.gerado`.

### 4.7 Boleto emitido · transacional · `boleto.gerado`

| # | Modelo | Canal | Quando |
|---|---|---|---|
| 1 | "O seu boleto foi emitido": URL, linha digitável, próximo passo, suporte | E-mail | +0m |
| 2 | Prazo de 3 dias úteis, URL, linha digitável | WhatsApp individual | +0m |
| 3 | "Você vai perder seu cadastro": boleto perto de vencer | E-mail | -1 dia útil do vencimento [INFERIDO "perto de vencer"; -1du PROPOSTA] |

Saída: `boleto.pago`, `compra.aprovada`, `boleto.vencido`.
Vencimento = data de emissão + 3 dias úteis [FONTE: "até 3 dias úteis"].

O que fazer com `boleto.vencido` não está nos arquivos. Opção [PROPOSTA]: entrar no fluxo de carrinho abandonado a partir do passo 3, se o carrinho ainda estiver aberto.

### 4.8 Compra aprovada · transacional · `compra.aprovada`

| # | Modelo | Canal | Quando |
|---|---|---|---|
| 1 | "Seja bem vindo ao [NOME DO CURSO]": boas-vindas, aviso de dados de acesso, suporte | E-mail | +0m |
| 2 | "Sua matrícula foi concluída com sucesso": procurar o e-mail de acesso, verificar spam | WhatsApp individual | +5m [INFERIDO: "já deve ter recebido no seu e-mail"] |

Efeitos imediatos:

- Cancelar disparos pendentes dos fluxos carrinho, carrinho abandonado, pagamento recusado e boleto emitido.
- Mudar o estado do contato para `comprou`.

Os dados de login chegam por um e-mail separado, da área de membros [FONTE: "Em breve, você vai receber todos os seus dados de acesso"]. A plataforma precisa da variável `produto.email_boas_vindas_titulo` para o WhatsApp apontar esse e-mail.

---

## 5. Estado do contato e precedência

```
            lead.criado
                 │
             inscrito ──► presente (webinario.presenca)
                 │
       checkout.iniciado
                 │
          em_checkout ──► pagamento.recusado ──► pagamento_recusado
                 │                                     │
            boleto.gerado ─► boleto_pendente ─► boleto.vencido ─► boleto_vencido
                 │                  │
                 │              boleto.pago
                 ▼                  ▼
            compra.aprovada ─────► comprou ──► compra.reembolsada ─► reembolsado
```

Precedência quando o contato está em mais de um fluxo [PROPOSTA]:

1. `compra_aprovada` encerra todos os outros fluxos de venda.
2. `boleto_emitido` encerra carrinho abandonado e pausa as chamadas de venda por e-mail.
3. `pagamento_recusado` encerra carrinho abandonado.
4. Fluxos de campanha só enviam a quem não está em fluxo transacional ativo, no mesmo canal e no mesmo dia.

---

## 6. Ciclo de vida do disparo [PROPOSTA]

```
agendado ──► em_fila ──► enviado ──► entregue ──► aberto ──► clicado
    │           │           │
    │           │           └──► falhou ──(até 3 tentativas)──► em_fila
    │           └──► suprimido   (condição falsa no momento do envio)
    └──► cancelado  (evento de saída do fluxo ou marco alterado)
```

O status `Enviado` já aparece na planilha de cronograma de e-mail da fase L [FONTE]. Os demais seguem o padrão de provedores de e-mail e WhatsApp.

### Idempotência

Chave única: `lancamento_id + modelo_id + (contato_id | grupo_id) + data_base`. O mesmo evento recebido duas vezes pelo webhook não gera dois disparos.

---

## 7. Modelos e variáveis

### 7.1 Normalização

Os textos originais usam colchetes e textos livres. No JSON eles foram convertidos para `{{chave}}`:

| Original | Chave |
|---|---|
| [FULANO], [NOME DO REMETENTE] | `remetente.nome` |
| [NOME DO NEGÓCIO] / [NOME DA EQUIPE] | `negocio.nome` / `negocio.equipe_nome` |
| [NOME DO CURSO] | `produto.nome` |
| [EVENTO XYZ], [Evento XYZ], [NOME DO EVENTO], [Nome do Evento] | `evento.nome` |
| [DATA DO EVENTO], [DATA] / [HORÁRIO], [HORA DO EVENTO] | `evento.data` / `evento.hora` |
| TEMA DO WEBINÁRIO | `evento.tema` |
| [TRANSFORMAÇÃO] e variações | `evento.transformacao` (derivada da ROMA) |
| suporte@dominio.com.br | `suporte.email` |
| 07 dias (reembolso) | `garantia.incondicional_dias` |
| Pagar-me | `checkout.gateway` |
| URL BOLETO / LINHA DIGITÁVEL / 3 dias úteis | `boleto.url` / `boleto.linha_digitavel` / `boleto.prazo_dias_uteis` |
| (inserir link), INSERIR LINK, [LINK PESQUISA] | `link.*` conforme o contexto |

Chaves de link: `link.pesquisa`, `link.grupo_whatsapp`, `link.lembrete_youtube`, `link.transmissao`, `link.pagina_replay`, `link.checkout`, `link.checkout_cartao`, `link.checkout_boleto`, `link.checkout_pix`, `link.suporte_whatsapp`.

Rótulos de botão como `[Definir Lembrete]`, `[FINALIZAR INSCRIÇÃO]` e `[Urgente]` são texto fixo, não variáveis.

### 7.2 Inconsistências encontradas

- **Reembolso:** 7 dias nos e-mails de recuperação; 30 dias na FAQ de exemplo da página de replay. Use uma variável só, vinda da oferta.
- **Mesmo dado, nomes diferentes:** `[EVENTO XYZ]` e `[NOME DO EVENTO]`.
- **Prazo do boleto:** "X dias úteis" no Semente e "3 dias úteis" no modelo novo.
- **Mensagens de WhatsApp com CTA sem link:** "CLIQUE AQUI PARA CONFIRMAR SUA PRESENÇA." (É amanhã) e "CLIQUE AQUI PARA FALAR COM SUPORTE VIA WHATSAPP." (pagamento recusado).

### 7.3 Validação de modelo [PROPOSTA]

- Toda variável usada precisa existir no dicionário.
- Modelo de e-mail exige assunto. Modelo de WhatsApp não tem assunto: a primeira linha funciona como título.
- Todo CTA precisa de um link resolvido antes do envio. Se faltar, o disparo vai para `suprimido` com motivo.
- Prévia com dados reais do lançamento antes de ativar o fluxo.

---

## 8. Esquema de dados [PROPOSTA]

```ts
type Canal = 'email' | 'whatsapp' | 'telegram';
type Destino = 'individual' | 'grupo';
type TipoFluxo = 'campanha' | 'transacional';

interface Modelo {
  id: string;
  fluxo: string;
  canal: Canal;
  destino: Destino;
  tipo: TipoFluxo;
  momento: string;
  assunto: string | null;     // obrigatório em e-mail
  corpo: string;              // com {{variaveis}}
  variaveis: string[];
  linksEsperados: string[];
}

interface Passo {
  modeloId: string;
  agendamento: { base: string; offset: string };
  condicaoEnvio?: string;     // avaliada no envio
}

interface Fluxo {
  id: string;
  tipo: TipoFluxo;
  gatilho: string;
  entrada: string;
  passos: Passo[];
  saida: string[];            // eventos que cancelam pendentes
  efeitos?: string[];
}

interface Disparo {
  id: string;
  lancamentoId: string;
  fluxoId: string;
  modeloId: string;
  contatoId?: string;         // destino individual
  grupoId?: string;           // destino grupo
  agendadoPara: string;       // ISO, no fuso do lançamento
  status: 'agendado' | 'em_fila' | 'enviado' | 'entregue' | 'aberto' | 'clicado'
        | 'falhou' | 'suprimido' | 'cancelado';
  tentativas: number;
  motivo?: string;
  chaveIdempotencia: string;
}
```

---

## 9. Algoritmo do motor [PROPOSTA]

```
ao receber evento E para contato C:
  registrar E (idempotente)
  para cada fluxo F com E em F.saida:
      cancelar disparos pendentes de C em F
  aplicar efeitos (ex.: compra.aprovada → estado = comprou)
  para cada fluxo F com gatilho E e C atende F.entrada:
      para cada passo P em F.passos:
          t = calcular(P.agendamento, E, marcos do lançamento)
          se t >= agora: criar disparo(agendado, t)

ao chegar o marco M:
  para cada fluxo de campanha com passos baseados em M:
      criar disparos para o segmento (e-mail) ou para o grupo (WhatsApp)

worker a cada minuto:
  para cada disparo agendado com agendadoPara <= agora:
      se condição de envio ou segmento falhar agora → suprimido
      senão resolver variáveis e links → enviar → atualizar status
```

---

## 10. Lacunas

- Horário de cada envio: os arquivos fixam o dia, não a hora.
- Atraso entre os passos de carrinho abandonado.
- O que fazer depois do boleto vencido.
- Modelos de WhatsApp para pagamento recusado e e-mail para boleto vencido.
- Modelos de disparo para o lançamento clássico (CPL 1, 2, 3, Efeito Tsunami, inscrições abertas).
- Regra de exclusão no grupo de WhatsApp, que hoje não tem segmentação.
