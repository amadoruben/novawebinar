import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { HelpTopic } from "./help";

/**
 * O ecrã em miniatura na ajuda do (i): onde aparece o que se está a configurar, realçado a azul.
 * É um desenho simples (blocos), não a sala verdadeira: serve para a pessoa se orientar.
 */

type Spot = "title" | "form" | "button" | "video" | "host" | "follow" | "chat" | "viewers" | "offer" | "countdown" | "color" | "sale" | "support" | "theme";
type Scene = { screen: "page" | "room" | "waiting" | "whatsapp" | "share"; spot?: Spot };

const SCENES: Record<HelpTopic, Scene> = {
  inicio: { screen: "page", spot: "title" },
  webinar: { screen: "page", spot: "title" },
  apresentador: { screen: "room", spot: "host" },
  partilha: { screen: "share" },
  entrada: { screen: "page", spot: "form" },
  pagina: { screen: "page", spot: "form" },
  ligarPagina: { screen: "page", spot: "form" },
  contactos: { screen: "page", spot: "form" },
  botaoVagas: { screen: "page", spot: "button" },
  coresPagina: { screen: "page", spot: "button" },
  video: { screen: "room", spot: "video" },
  formato: { screen: "room", spot: "video" },
  transcricao: { screen: "room", spot: "video" },
  aparencia: { screen: "room", spot: "theme" },
  corBotao: { screen: "room", spot: "color" },
  seguir: { screen: "room", spot: "follow" },
  seguirMomentos: { screen: "room", spot: "follow" },
  chat: { screen: "room", spot: "chat" },
  chatQuem: { screen: "room", spot: "chat" },
  paises: { screen: "room", spot: "chat" },
  tom: { screen: "room", spot: "chat" },
  realismo: { screen: "room", spot: "chat" },
  perguntas: { screen: "room", spot: "chat" },
  gerar: { screen: "room", spot: "chat" },
  comoFicou: { screen: "room", spot: "chat" },
  avisoSuporte: { screen: "room", spot: "support" },
  audiencia: { screen: "room", spot: "viewers" },
  audienciaFormato: { screen: "room", spot: "viewers" },
  audienciaCurva: { screen: "room", spot: "viewers" },
  oferta: { screen: "room", spot: "offer" },
  link: { screen: "room", spot: "color" },
  pitch: { screen: "room", spot: "offer" },
  urgencia: { screen: "room", spot: "countdown" },
  depoisVideo: { screen: "room", spot: "offer" },
  utm: { screen: "room", spot: "color" },
  vendas: { screen: "room", spot: "sale" },
  comprasReais: { screen: "room", spot: "sale" },
  vendasOnde: { screen: "room", spot: "sale" },
  vendasCor: { screen: "room", spot: "sale" },
  vendasLinha: { screen: "room", spot: "sale" },
  automacoes: { screen: "whatsapp" },
  agente: { screen: "room", spot: "support" },
  autonomia: { screen: "room", spot: "support" },
  agenteFontes: { screen: "room", spot: "support" },
  agenteEquipa: { screen: "room", spot: "support" },
  agenteNome: { screen: "room", spot: "support" },
  agenda: { screen: "waiting" },
  agendaQuando: { screen: "waiting" },
  agendaIntervalo: { screen: "waiting" },
  agendaSessao: { screen: "waiting" },
};

/** Onde fica, numa frase, ao lado da miniatura. */
const WHERE: Record<Spot | Scene["screen"], string> = {
  page: "Na página de entrada, onde a pessoa se inscreve.",
  title: "No topo da página de entrada e da sala: o título.",
  form: "Na página de entrada: os campos que a pessoa preenche.",
  button: "Na página de entrada: o botão que confirma a inscrição.",
  room: "Na sala ao vivo.",
  video: "Na sala: o vídeo, igual para todos.",
  host: "Por baixo do vídeo: a foto, o nome e a descrição de quem apresenta.",
  follow: "Ao lado do nome de quem apresenta, só nos minutos escolhidos.",
  chat: "No chat da sala: os comentários ao longo do vídeo.",
  viewers: "No canto do vídeo: quantas pessoas estão a ver.",
  offer: "No separador Oferta da sala, no minuto em que abre.",
  countdown: "No cartão da oferta: o cronómetro a contar.",
  color: "No cartão da oferta: o botão que a pessoa toca.",
  sale: "No vídeo e no chat: «Fulano comprou», na cor escolhida.",
  support: "No Suporte: as respostas da equipa e do Agente, só para a pessoa.",
  theme: "A sala inteira, no tema escolhido (claro, escuro ou automático).",
  waiting: "Na página de espera, com a contagem até à sessão.",
  whatsapp: "No WhatsApp de cada pessoa: as mensagens do fluxo.",
  share: "No WhatsApp, quando alguém partilha o link da sala.",
};

const BLUE = "#0072F5";

/** O realce: aro azul e um ponto a pulsar, para se ver logo onde está. */
function Spotlight({ on, className, children }: { on: boolean; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("relative", on && "z-[1] rounded-[5px] shadow-[0_0_0_2px_#0072F5,0_0_0_5px_rgba(0,114,245,.25)]", className)}>
      {children}
      {on ? <i className="absolute -right-1 -top-1 size-2 animate-pulse rounded-full ring-2 ring-white" style={{ background: BLUE }} /> : null}
    </div>
  );
}

const bar = (w: string, c = "bg-white/20", h = "h-1.5") => <i className={cn("block rounded-full", h, c)} style={{ width: w }} />;

function MiniRoom({ spot }: { spot?: Spot | undefined }) {
  const offerTab = spot === "offer" || spot === "countdown" || spot === "color";
  const supportTab = spot === "support";
  return (
    <div className={cn("flex h-full flex-col", spot === "theme" ? "bg-white" : "bg-[#141414]")}>
      <Spotlight on={spot === "video"} className="m-0">
        <div className="relative aspect-video bg-[linear-gradient(160deg,#3a3f48,#1b1d21)]">
          <span className="absolute left-1.5 top-1.5 flex items-center gap-1">
            <i className="block h-2 w-5 rounded-[2px] bg-[#E5243B]" />
            <Spotlight on={spot === "viewers"}>
              <i className="block h-2 w-5 rounded-[2px] bg-black/50" />
            </Spotlight>
          </span>
          <i className="absolute left-1/2 top-1/2 size-0 -translate-x-1/2 -translate-y-1/2 border-y-[5px] border-l-[8px] border-y-transparent border-l-white/80" />
          {spot === "sale" ? (
            <Spotlight on className="absolute bottom-1.5 left-1.5">
              <span className="flex items-center gap-1 rounded-md bg-[#1D8A5E] px-1 py-0.5">
                <i className="block size-2 rounded-full bg-white/40" />
                {bar("26px", "bg-white/80", "h-1")}
              </span>
            </Spotlight>
          ) : null}
        </div>
      </Spotlight>
      <div className="grid gap-1 px-2 py-1.5">
        {bar("70%", spot === "theme" ? "bg-[#D4D4D4]" : "bg-white/50", "h-2")}
        <Spotlight on={spot === "host"} className="flex items-center gap-1">
          <i className={cn("block size-3.5 rounded-full", spot === "theme" ? "bg-[#E5E5E5]" : "bg-white/25")} />
          {bar("34px", spot === "theme" ? "bg-[#D4D4D4]" : "bg-white/35")}
          {spot === "follow" ? (
            <Spotlight on className="ml-0.5">
              <span className="block rounded-full bg-[#E8440C] px-1.5 py-[3px] text-[6px] font-bold leading-none text-white">+ Seguir</span>
            </Spotlight>
          ) : null}
        </Spotlight>
      </div>
      <div className={cn("mx-2 flex gap-1.5 border-b pb-1", spot === "theme" ? "border-[#E5E5E5]" : "border-white/10")}>
        {["Chat", "Suporte", "Oferta"].map((t, i) => {
          const on = (i === 0 && !offerTab && !supportTab) || (i === 1 && supportTab) || (i === 2 && offerTab);
          return (
            <span key={t} className={cn("text-[6.5px] font-semibold", on ? "text-[#E8440C]" : spot === "theme" ? "text-[#999]" : "text-white/40")}>
              {t}
            </span>
          );
        })}
      </div>
      <div className="grid flex-1 content-end gap-1 p-2">
        {offerTab ? (
          <Spotlight on={spot === "offer"} className="grid gap-1 rounded-md bg-white/10 p-1.5">
            {bar("60%", "bg-white/60", "h-1.5")}
            {bar("40%", "bg-white/30", "h-1")}
            <Spotlight on={spot === "countdown"} className="justify-self-start">
              <span className="block rounded bg-[#E8440C]/20 px-1 py-0.5 font-mono text-[6.5px] font-bold text-[#F28E63]">09:59</span>
            </Spotlight>
            <Spotlight on={spot === "color"}>
              <span className="block rounded-md bg-[#E8440C] py-1 text-center text-[6.5px] font-bold text-white">Quero minha vaga</span>
            </Spotlight>
          </Spotlight>
        ) : supportTab ? (
          <Spotlight on className="grid gap-1 p-0.5">
            <span className="justify-self-end rounded-md bg-white/15 px-1.5 py-1">{bar("30px", "bg-white/60", "h-1")}</span>
            <span className="justify-self-start rounded-md bg-[#0072F5]/70 px-1.5 py-1">{bar("44px", "bg-white/80", "h-1")}</span>
          </Spotlight>
        ) : (
          <Spotlight on={spot === "chat"} className="grid gap-1 p-0.5">
            {["55%", "75%", "45%", "65%"].map((w, i) => (
              <span key={w} className="flex items-center gap-1">
                <i className={cn("block size-2 shrink-0 rounded-full", spot === "theme" ? "bg-[#E5E5E5]" : "bg-white/20")} />
                {i === 3 && spot === "sale" ? (
                  <Spotlight on>{bar("50px", "bg-[#1D8A5E]", "h-1.5")}</Spotlight>
                ) : (
                  bar(w, spot === "theme" ? "bg-[#E5E5E5]" : "bg-white/20", "h-1")
                )}
              </span>
            ))}
          </Spotlight>
        )}
        <span className={cn("mt-0.5 block h-3 rounded-full", spot === "theme" ? "bg-[#F2F2F2] ring-1 ring-[#E5E5E5]" : "bg-white/10")} />
      </div>
    </div>
  );
}

function MiniPage({ spot }: { spot?: Spot | undefined }) {
  return (
    <div className="grid h-full content-center gap-2 bg-[#F5F5F5] p-2.5">
      <Spotlight on={spot === "title"} className="grid gap-1 p-0.5">
        {bar("85%", "bg-[#171717]", "h-2")}
        {bar("60%", "bg-[#171717]", "h-2")}
      </Spotlight>
      <div className="grid gap-1.5 rounded-lg bg-white p-2 shadow-[0_1px_3px_rgba(0,0,0,.1)]">
        <Spotlight on={spot === "form"} className="grid gap-1.5 p-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-3 rounded-[4px] ring-1 ring-[#E5E5E5]" />
          ))}
        </Spotlight>
        <Spotlight on={spot === "button"}>
          <span className="block rounded-[5px] bg-[#E8440C] py-1 text-center text-[6.5px] font-bold text-white">Garantir a minha vaga</span>
        </Spotlight>
      </div>
    </div>
  );
}

function MiniWaiting() {
  return (
    <Spotlight on className="grid h-full content-center justify-items-center gap-2 rounded-none bg-[#141414] p-2">
      <span className="text-[6.5px] font-bold uppercase tracking-[0.14em] text-[#F28E63]">Começa em</span>
      <span className="flex gap-1">
        {["01", "02", "34", "56"].map((n) => (
          <span key={n} className="grid h-5 w-4 place-items-center rounded bg-white/10 font-mono text-[7px] font-bold text-white">
            {n}
          </span>
        ))}
      </span>
      {bar("70%", "bg-white/30", "h-1")}
    </Spotlight>
  );
}

function MiniWhatsApp({ share }: { share?: boolean | undefined }) {
  return (
    <div className="flex h-full flex-col bg-[#EFEAE2]">
      <div className="flex items-center gap-1 bg-[#008069] px-2 py-1.5">
        <i className="block size-3 rounded-full bg-white/40" />
        {bar("40px", "bg-white/80", "h-1.5")}
      </div>
      <div className="grid flex-1 content-start gap-1.5 p-2">
        {share ? (
          <Spotlight on className="justify-self-end overflow-hidden rounded-md bg-[#D9FDD3] p-1">
            <span className="block aspect-[1.9] w-[86px] rounded-[3px] bg-[linear-gradient(160deg,#3a3f48,#1b1d21)]" />
            <span className="mt-1 grid gap-0.5">
              {bar("80%", "bg-[#171717]/70", "h-1")}
              {bar("50%", "bg-[#171717]/30", "h-1")}
            </span>
          </Spotlight>
        ) : (
          <Spotlight on className="grid gap-1.5 p-0.5">
            {["70px", "84px"].map((w) => (
              <span key={w} className="grid gap-0.5 justify-self-start rounded-md bg-white px-1.5 py-1 shadow-[0_1px_1px_rgba(0,0,0,.08)]">
                {bar(w, "bg-[#171717]/60", "h-1")}
                {bar("40px", "bg-[#171717]/30", "h-1")}
              </span>
            ))}
          </Spotlight>
        )}
      </div>
    </div>
  );
}

/** A miniatura de um tema da ajuda, num telemóvel pequeno, e a frase de onde aparece. */
export function helpScene(topic: HelpTopic) {
  const scene = SCENES[topic];
  const screen =
    scene.screen === "room" ? (
      <MiniRoom spot={scene.spot} />
    ) : scene.screen === "page" ? (
      <MiniPage spot={scene.spot} />
    ) : scene.screen === "waiting" ? (
      <MiniWaiting />
    ) : (
      <MiniWhatsApp share={scene.screen === "share"} />
    );
  return {
    phone: (
      <div className="w-[118px] shrink-0 rounded-[18px] bg-[#0A0A0B] p-[5px] shadow-[0_10px_24px_-12px_rgba(0,0,0,.45)]">
        <div className="h-[212px] overflow-hidden rounded-[14px]">{screen}</div>
      </div>
    ),
    where: WHERE[scene.spot ?? scene.screen],
  };
}
