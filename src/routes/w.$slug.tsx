import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronDown, Loader2 } from "lucide-react";
import { z } from "zod";
import { formatSessionStart } from "@/lib/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { detectDevice, lookupPlace, type GeoPlace } from "@/lib/live-presence";
import { leadSource } from "@/lib/contacts";
import { loadPixels, trackPixels } from "@/lib/pixels";
import { retry } from "@/lib/utils";
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRIES,
  phoneCountryForIso,
  type PhoneCountry,
} from "@/lib/phone-countries";
import { WebinarRoom } from "@/components/webinar-room";
import { RoomSkeleton, getCachedRoomTheme, cacheRoomTheme } from "@/components/room-skeleton";
import whatsappIcon from "@/assets/local/whatsapp-icon.webp";
import {
  getPublicRoom,
  joinPublicRoom,
  getPublicRoomMessages,
  sendPublicRoomMessage,
  trackPublicRoomCta,
  trackPublicRoomProgress,
} from "@/lib/public-room.functions";

export const Route = createFileRoute("/w/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    replay: ["1", "true"].includes(String(search["replay"])) ? true : undefined,
    // Sala de teste: qualquer pessoa com o link entra de imediato, mesmo com a
    // sessão inativa ou fora do horário. Serve para rever a sala antes de abrir.
    teste: ["1", "true"].includes(String(search["teste"])) ? true : undefined,
    // Origem do lead: fica no endereço até à inscrição.
    ...Object.fromEntries(
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "fbclid", "gclid"]
        .filter((key) => typeof search[key] === "string" && search[key])
        .map((key) => [key, String(search[key]).slice(0, 200)]),
    ) as Partial<
      Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "fbclid" | "gclid", string>
    >,
  }),
  loader: ({ context, params }) =>
    context.queryClient
      .ensureQueryData({
        queryKey: ["public-room", params.slug],
        queryFn: () => getPublicRoom({ data: { slug: params.slug } }),
      })
      // Falha passageira: a página abre na mesma e a sala volta a tentar sozinha.
      .catch(() => undefined),
  head: ({ loaderData }) => {
    const webinar = loaderData?.webinar;
    const title = webinar?.share_title || webinar?.public_title || "Sala do webinar";
    const description =
      webinar?.share_description || webinar?.description || "Entre na sala e acompanhe a sessão.";
    const image = webinar?.share_image_url || webinar?.registration_cover_url || null;
    return {
      meta: [
        { title: `${title} | Convertewebinar` },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
    };
  },
  component: PublicRoomRoute,
});

function PublicRoomRoute() {
  const { slug } = Route.useParams();
  const { replay, teste, ...source } = Route.useSearch();
  return <PublicRoom slug={slug} replay={replay} teste={teste} source={source} />;
}

type Viewer = {
  participantId: string;
  name: string;
  /** Última posição do vídeo desta pessoa (relógio de conteúdo). */
  position?: number;
  /** Ponto mais avançado já visto: evita repetir eventos ao recuar num replay. */
  maxPosition?: number;
};

function storageKey(slug: string) {
  return `novawebinar:viewer:${slug}`;
}

export function PublicRoom({
  slug,
  replay,
  teste,
  source = {},
}: {
  slug: string;
  replay?: boolean | undefined;
  teste?: boolean | undefined;
  /** Parâmetros de origem do endereço (utm_*, fbclid, gclid). */
  source?: Partial<Record<string, string>>;
}) {
  const testMode = Boolean(teste);
  const roomMode: "live" | "replay" = replay ? "replay" : "live";
  const fetchRoom = useServerFn(getPublicRoom);
  const join = useServerFn(joinPublicRoom);
  const sendMessage = useServerFn(sendPublicRoomMessage);
  const trackCta = useServerFn(trackPublicRoomCta);
  const fetchMessages = useServerFn(getPublicRoomMessages);
  const trackProgress = useServerFn(trackPublicRoomProgress);

  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(true);

  // O indicativo vem pré-selecionado pela localização por endereço de rede
  // (Portugal → +351); a pessoa pode sempre trocar de país na lista.
  const placeRef = useRef<GeoPlace | null>(null);
  useEffect(() => {
    let active = true;
    void lookupPlace().then((place) => {
      if (!active) return;
      placeRef.current = place;
      const match = phoneCountryForIso(place.countryCode);
      if (match) setPhoneCountry(match);
    });
    return () => {
      active = false;
    };
  }, []);

  // Dispositivo e origem por endereço de rede: servem as estatísticas do painel.
  const audienceMeta = useCallback(
    () => ({
      device: detectDevice(),
      city: placeRef.current?.city ?? undefined,
      country: placeRef.current?.country ?? undefined,
      countryCode: placeRef.current?.countryCode ?? undefined,
      ...leadSource({
        ...source,
        referrer: document.referrer,
        ownHost: window.location.hostname,
      }),
    }),
    [source],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-room", slug],
    queryFn: () => fetchRoom({ data: { slug } }),
    // Enquanto ninguém entrou na sala, revemos a sessão de minuto a minuto:
    // assim que a sessão do dia termina, a sala de espera volta a abrir
    // com a contagem para a próxima sessão. Uma leitura falhada nunca tira a
    // sala a quem a tem aberta: fica a que já estava e tenta-se outra vez.
    refetchInterval: (query) =>
      query.state.status === "error" ? 5000 : viewer ? false : 60_000,
  });

  // Pixels de anúncios da organização; a sala de teste nunca os dispara.
  const pixels = data?.pixels;
  useEffect(() => {
    if (pixels && !testMode) loadPixels(pixels);
  }, [pixels, testMode]);

  // Guardamos o tema da sala para o esqueleto seguir o mesmo aspeto. O tema
  // memorizado só é lido depois da hidratação: lê-lo durante a renderização
  // faria o servidor e o navegador desenharem ecrãs diferentes.
  const roomTheme = data?.webinar.room_theme === "light" ? "light" : "dark";
  const [skeletonTheme, setSkeletonTheme] = useState<"light" | "dark">("light");
  // A sala depende do relógio, do armazenamento local e da localização de quem
  // assiste: só a desenhamos depois de o navegador assumir a página, para que
  // o primeiro desenho seja sempre igual ao que veio do servidor.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    setSkeletonTheme(getCachedRoomTheme(slug));
  }, [slug]);
  useEffect(() => {
    if (data) cacheRoomTheme(slug, roomTheme);
  }, [data, roomTheme, slug]);

  // A sessão seguinte ainda não começou: a sala de espera reabre sozinha.
  const nextStartMs = data?.webinar.session_start
    ? new Date(data.webinar.session_start).getTime()
    : null;
  useEffect(() => {
    if (nextStartMs !== null && nextStartMs > Date.now()) setWaiting(true);
  }, [nextStartMs]);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey(slug));
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Viewer;
      if (parsed?.participantId && parsed?.name) {
        setViewer(parsed);
        // Com a sincronização desligada, o vídeo retoma a posição guardada.
        if (typeof parsed.position === "number" && parsed.position > 0) {
          setResumeSeconds(parsed.position);
        }
        if (typeof parsed.maxPosition === "number" && parsed.maxPosition > 0) {
          setResumePeakSeconds(parsed.maxPosition);
        }
      }
    } catch {
      window.localStorage.removeItem(storageKey(slug));
    }
  }, [slug]);

  // As respostas da equipa de suporte chegam por sondagem, de 5 em 5 segundos.
  const { data: privateThread, refetch: refetchThread } = useQuery({
    queryKey: ["public-room-messages", viewer?.participantId],
    enabled: Boolean(viewer?.participantId),
    refetchInterval: 5000,
    queryFn: () => fetchMessages({ data: { participantId: viewer!.participantId } }),
  });

  // Instante real desta pessoa no vídeo: o assistente nunca pode revelar
  // conteúdo que ela ainda não viu, mesmo num replay.
  const positionRef = useRef(0);
  // Última posição guardada desta pessoa no vídeo (usada sem sincronização).
  const [resumeSeconds, setResumeSeconds] = useState<number | null>(null);
  // Ponto mais avançado já visto: os eventos já entregues não voltam a repetir-se.
  const [resumePeakSeconds, setResumePeakSeconds] = useState<number | null>(null);
  const savedPositionRef = useRef(0);
  const peakPositionRef = useRef(0);

  const onSend = useCallback(
    async (body: string) => {
      if (!viewer) return;
      await sendMessage({
        data: {
          participantId: viewer.participantId,
          body,
          sessionSeconds: Math.max(0, Math.round(positionRef.current)),
        },
      });
      void refetchThread();
    },
    [sendMessage, viewer, refetchThread],
  );

  // Ver e clicar na oferta são os sinais comerciais da sala: uma falha passageira repete-se.
  // ponytail: sem chave de idempotência, um pedido que chegou mas cuja resposta se perdeu fica
  // repetido; com a fila de envio no browser entra um id gerado aqui.
  const sendCta = useCallback(
    (eventType: "view" | "click") => {
      if (!viewer) return;
      const data = {
        participantId: viewer.participantId,
        eventType,
        videoSecond: Math.max(0, Math.round(positionRef.current)),
      };
      void retry(() => trackCta({ data })).catch((error: unknown) =>
        console.error(`[oferta] ${eventType} não registado`, error),
      );
    },
    [trackCta, viewer],
  );

  // Acesso facilitado: entram logo na sala, sem formulário. A sala de teste
  // comporta-se exatamente como a real, por isso segue a configuração pública.
  const easyAccess = Boolean(data?.webinar.easy_access);
  const shouldAutoJoin = easyAccess;
  const autoJoinRef = useRef(false);
  useEffect(() => {
    if (!data || !shouldAutoJoin || viewer || autoJoinRef.current) return;
    if (data.webinar.status === "draft" && !testMode) return;
    autoJoinRef.current = true;
    void (async () => {
      try {
        const result = await join({
          data: {
            webinarId: data.webinar.id,
            name: "Convidado",
            email: `convidado-${Date.now()}@sala.local`,
            mode: roomMode,
            teste: testMode,
            ...audienceMeta(),
          },
        });
        const next = { participantId: result.participantId, name: result.name };
        window.localStorage.setItem(storageKey(slug), JSON.stringify(next));
        setViewer(next);
      } catch {
        autoJoinRef.current = false;
      }
    })();
  }, [data, shouldAutoJoin, viewer, join, roomMode, slug, testMode, audienceMeta]);

  const lastSentPeakRef = useRef(0);
  const onProgress = useCallback(
    (seconds: number, peakSeconds?: number, options?: { final?: boolean }) => {
      positionRef.current = seconds;
      const peak = Math.max(peakSeconds ?? seconds, peakPositionRef.current);
      peakPositionRef.current = peak;
      // Guarda a posição a cada 5 segundos para o vídeo retomar onde parou.
      if (Math.abs(seconds - savedPositionRef.current) >= 5) {
        savedPositionRef.current = seconds;
        setResumeSeconds(seconds);
        try {
          const stored = window.localStorage.getItem(storageKey(slug));
          if (stored) {
            const parsed = JSON.parse(stored) as Viewer;
            if (parsed?.participantId) {
              window.localStorage.setItem(
                storageKey(slug),
                JSON.stringify({ ...parsed, position: seconds, maxPosition: peak }),
              );
            }
          }
        } catch {
          // Sem posição guardada, o vídeo simplesmente recomeça do início.
        }
      }
      if (!viewer) return;
      // Só grava quando o pico avançou, para não repetir pedidos iguais.
      if (peak <= lastSentPeakRef.current) return;
      const previous = lastSentPeakRef.current;
      lastSentPeakRef.current = peak;
      const data = { participantId: viewer.participantId, watchedSeconds: peak };
      // Ao esconder ou fechar a página, keepalive deixa o pedido terminar sem bloquear.
      const keepalive: typeof fetch = (input, init) => fetch(input, { ...init, keepalive: true });
      void trackProgress(options?.final ? { data, fetch: keepalive } : { data }).catch(() => {
        if (lastSentPeakRef.current === peak) lastSentPeakRef.current = previous;
      });
    },
    [trackProgress, viewer, slug],
  );

  if (!hydrated || isLoading) return <RoomSkeleton theme={skeletonTheme} />;

  if (!data)
    return (
      <main className="room-ambient flex min-h-dvh items-center justify-center px-6 text-center text-sm text-room-subtle">
        {isError
          ? "Não foi possível carregar a sessão. Estamos a tentar de novo…"
          : "Não encontrámos nenhuma sessão com este endereço."}
      </main>
    );

  const { webinar, comments, audience, socialProof, simulatedPurchases } = data;
  const themeClass = webinar.room_theme === "light" ? "room-light" : "";

  const startMs = webinar.session_start ? new Date(webinar.session_start).getTime() : null;
  // Com o temporizador de arranque ligado, a sala abre antes da hora: as pessoas
  // entram, o chat funciona e o lugar do vídeo mostra a contagem animada.
  const preliveSeconds = webinar.prelive_enabled ? Math.max(0, webinar.prelive_seconds ?? 0) : 0;
  const roomOpensMs = startMs === null ? null : startMs - preliveSeconds * 1000;
  const inWaitingRoom =
    roomMode === "live" &&
    !testMode &&
    webinar.waiting_room_enabled &&
    webinar.waiting_open !== false &&
    roomOpensMs !== null &&
    roomOpensMs > Date.now() &&
    waiting;

  // A sessão do dia terminou e a próxima é noutro dia: mostramos o fim da
  // transmissão. A sala de espera só volta a abrir no dia da sessão seguinte.
  // A sala de teste nunca mostra este ecrã — entra sempre.
  const sessionClosed =
    roomMode === "live" &&
    !testMode &&
    Boolean(webinar.session_ended) &&
    webinar.waiting_open === false &&
    startMs !== null &&
    startMs > Date.now();

  if (inWaitingRoom)
    return (
      <WaitingScreen
        title={webinar.public_title}
        startMs={roomOpensMs ?? startMs}
        timezone={webinar.timezone}
        themeClass={themeClass}
        onZero={() => setWaiting(false)}
      />
    );

  if (sessionClosed)
    return (
      <main
        className={`room-ambient flex min-h-dvh items-center justify-center px-6 text-center ${themeClass}`}
      >
        <div className="max-w-md space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-room-subtle">
            Transmissão terminou
          </p>
          <h1 className="text-2xl font-black text-room-text sm:text-3xl">{webinar.public_title}</h1>
          <p className="text-sm leading-relaxed text-room-subtle">
            A sessão de hoje chegou ao fim. A sala de espera volta a abrir no dia da próxima sessão:{" "}
            <span className="font-semibold text-room-text">
              {formatSessionStart(startMs, webinar.timezone)}
            </span>
            . Guarde este endereço — é sempre o mesmo.
          </p>
        </div>
      </main>
    );

  if (webinar.status === "draft" && !testMode)
    return (
      <main
        className={`room-ambient flex min-h-dvh items-center justify-center px-6 text-center ${themeClass}`}
      >
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-black text-room-text">Sessão indisponível</h1>
          <p className="text-sm text-room-subtle">
            Esta sala está inativa de momento. Quando o anfitrião a ativar, pode entrar pelo mesmo
            endereço.
          </p>
        </div>
      </main>
    );

  if (!viewer && shouldAutoJoin)
    return (
      <main
        className={`room-ambient flex min-h-dvh items-center justify-center text-sm text-room-subtle ${themeClass}`}
      >
        A entrar na sala...
      </main>
    );

  if (!viewer) {
    const submit = async (event: React.FormEvent) => {
      event.preventDefault();
      setError("");
      const schema = z.object({
        name: z.string().trim().min(2, "Diga-nos o seu nome."),
        email: z.string().trim().email("Indique um e-mail válido."),
        phone: webinar.registration_require_phone
          ? z.string().trim().min(6, "Indique um contacto.")
          : z.string().trim().optional(),
      });
      const parsed = schema.safeParse(form);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Reveja os dados.");
        return;
      }
      // O número vai sempre com o indicativo do país escolhido (ex.: +351 912...).
      const phoneNumber = form.phone.trim();
      const fullPhone = phoneNumber ? `${phoneCountry.dial} ${phoneNumber}` : undefined;
      setEntering(true);
      try {
        const result = await join({
          data: {
            webinarId: webinar.id,
            name: parsed.data.name,
            email: parsed.data.email,
            phone: webinar.registration_collect_phone ? fullPhone : undefined,
            mode: roomMode,
            teste: testMode,
            ...audienceMeta(),
          },
        });
        const next = { participantId: result.participantId, name: result.name };
        window.localStorage.setItem(storageKey(slug), JSON.stringify(next));
        if (!testMode) trackPixels("lead");
        setViewer(next);
      } catch {
        setError("Não foi possível entrar agora. Tente novamente.");
      } finally {
        setEntering(false);
      }
    };

    return (
      <main
        className={`room-ambient flex min-h-dvh items-center justify-center px-5 py-6 sm:px-8 ${themeClass}`}
      >
        <div className="w-full max-w-md text-room-text">
          {webinar.registration_cover_url ? (
            <div className="mb-5 overflow-hidden rounded-xl">
              <img
                src={webinar.registration_cover_url}
                alt={webinar.public_title}
                className="h-36 w-full object-cover sm:h-44"
              />
            </div>
          ) : null}

          <form onSubmit={submit} className="space-y-4">
            {webinar.registration_badge_text ? (
              <div className="flex justify-center">
                <span className="inline-flex rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
                  {webinar.registration_badge_text}
                </span>
              </div>
            ) : null}

            {webinar.registration_progress_enabled ? (
              <div className="relative h-7 w-full overflow-hidden rounded-full bg-room-raised">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, webinar.registration_progress_value))}%`,
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center px-3 text-xs font-semibold text-white drop-shadow-sm">
                  {Math.min(100, Math.max(0, webinar.registration_progress_value))}% das vagas
                  preenchidas
                </span>
              </div>
            ) : null}

            <div>
              <h1 className="text-xl font-semibold leading-snug sm:text-2xl">
                {roomMode === "live"
                  ? `[🔴 AO VIVO] ${webinar.registration_headline || webinar.public_title}`
                  : webinar.registration_headline || webinar.public_title}
              </h1>
              {webinar.registration_subtitle ? (
                <p className="mt-1.5 text-sm leading-relaxed text-room-subtle">
                  {webinar.registration_subtitle}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium">
                  Nome <span className="text-primary">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Como quer ser tratado"
                  className="h-11 rounded-lg border-room-line bg-room-surface px-3.5 text-sm text-room-text placeholder:text-room-subtle"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium">
                  E-mail <span className="text-primary">*</span>
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="onde enviamos o acesso"
                  className="h-11 rounded-lg border-room-line bg-room-surface px-3.5 text-sm text-room-text placeholder:text-room-subtle"
                />
              </div>
              {webinar.registration_collect_phone && (
                <div className="grid gap-1.5">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <img src={whatsappIcon} alt="" className="size-4" />
                    WhatsApp{" "}
                    {webinar.registration_require_phone ? (
                      <span className="text-primary">*</span>
                    ) : (
                      "(opcional)"
                    )}
                  </Label>

                  <div className="flex gap-2">
                    <Popover open={countryPickerOpen} onOpenChange={setCountryPickerOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Escolher o indicativo do país"
                          className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-room-line bg-room-surface px-3 text-sm text-room-text"
                        >
                          <span className="text-lg leading-none">{phoneCountry.flag}</span>
                          <span className="font-semibold tabular-nums">{phoneCountry.dial}</span>
                          <ChevronDown className="size-4 text-room-subtle" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="max-h-72 w-64 overflow-y-auto p-1"
                      >
                        {PHONE_COUNTRIES.map((country) => (
                          <button
                            key={`${country.code}-${country.dial}`}
                            type="button"
                            onClick={() => {
                              setPhoneCountry(country);
                              setCountryPickerOpen(false);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                          >
                            <span className="text-base leading-none">{country.flag}</span>
                            <span className="flex-1 truncate">{country.name}</span>
                            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                              {country.dial}
                            </span>
                            {country.code === phoneCountry.code && country.dial === phoneCountry.dial ? (
                              <Check className="size-3.5 text-primary" />
                            ) : null}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                    <Input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value.replace(/[^\d\s()-]/g, "") })
                      }
                      inputMode="tel"
                      placeholder="900 000 000"
                      className="h-11 min-w-0 rounded-lg border-room-line bg-room-surface px-3.5 text-sm text-room-text placeholder:text-room-subtle"
                    />
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-center text-sm font-medium text-primary">{error}</p>}

            <Button
              type="submit"
              disabled={entering}
              className="h-12 w-full rounded-lg bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-500"
            >
              {entering && <Loader2 className="animate-spin" />}
              {webinar.registration_button_text || "Entrar na sala"}
              {!entering && <ArrowRight className="size-5" />}
            </Button>

            {webinar.registration_scarcity_note ? (
              <p className="text-center text-xs text-room-subtle">
                {webinar.registration_scarcity_note}
              </p>
            ) : null}
          </form>
        </div>
      </main>
    );
  }

  // Sala de teste: entra sempre, a qualquer hora — sem sala de espera, sem
  // contagem de prelive e sem depender da hora marcada. O vídeo arranca de
  // imediato (retoma onde parou, se já tiver visto) e todo o conteúdo segue o
  // relógio do vídeo, como num replay ao vivo.
  const roomStartsAt = testMode ? null : webinar.session_start;
  const syncWithStart = testMode ? false : webinar.sync_video_with_start;
  const effectivePreliveSeconds = testMode ? 0 : preliveSeconds;




  return (
    <WebinarRoom
      theme={webinar.room_theme === "light" ? "light" : "dark"}
      mode={roomMode}
      startsAt={roomStartsAt}
      viewerName={viewer.name}
      organizationId={webinar.organization_id}
      comments={comments}
      audienceMode={audience.mode}
      curve={audience.curve}
      socialProof={socialProof}
      purchases={simulatedPurchases}
      syncWithStart={syncWithStart}
      resumeSeconds={syncWithStart ? null : resumeSeconds}
      resumePeakSeconds={resumePeakSeconds}
      preliveSeconds={effectivePreliveSeconds}
      preliveSound={webinar.prelive_sound !== false}
      preliveMessage={webinar.prelive_message || "A transmissão começa já a seguir"}
      preliveTemplate={(webinar as { prelive_template?: string | null }).prelive_template ?? null}
      preliveAppearance={(webinar as { prelive_appearance?: unknown }).prelive_appearance}
      onSend={onSend}
      supportMessages={privateThread?.messages ?? []}
      onProgress={onProgress}
      onCtaView={() => sendCta("view")}
      onCtaClick={() => {
        if (!testMode) trackPixels("checkout");
        sendCta("click");
      }}
      webinar={{
        id: webinar.id,
        public_title: webinar.public_title,
        description: webinar.description,
        host_name: webinar.host_name,
        host_role: webinar.host_role,
        host_avatar_url: webinar.host_avatar_url,
        chat_pin_title: webinar.chat_pin_title,
        chat_pin_message: webinar.chat_pin_message,
        offer_pin_title: webinar.offer_pin_title,
        offer_pin_message: webinar.offer_pin_message,
        cta_text: webinar.cta_text,
        cta_url: webinar.cta_url,
        cta_color: webinar.cta_color,
        cta_price_original: webinar.cta_price_original,
        cta_price_now: webinar.cta_price_now,
        cta_image_url: webinar.cta_image_url,
        cta_countdown_seconds: webinar.cta_countdown_seconds,
        cta_start_seconds: webinar.cta_start_seconds,
        cta_end_seconds: webinar.cta_end_seconds,
        video_url: webinar.video_url,
        video_provider: webinar.video_provider,
        duration_seconds: webinar.duration_seconds,
      }}
    />
  );
}

function WaitingScreen({
  title,
  startMs,
  timezone,
  themeClass,
  onZero,
}: {
  title: string;
  startMs: number;
  timezone?: string | null;
  themeClass?: string;
  onZero: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = Math.max(0, Math.floor((startMs - now) / 1000));

  useEffect(() => {
    if (remaining === 0) onZero();
  }, [remaining, onZero]);

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const units = [
    ...(days > 0 ? [{ value: days, label: days === 1 ? "dia" : "dias" }] : []),
    { value: hours, label: hours === 1 ? "hora" : "horas" },
    { value: minutes, label: "min" },
    { value: seconds, label: "seg" },
  ];

  const startLabel = formatSessionStart(startMs, timezone);

  return (
    <main
      className={`room-ambient flex min-h-dvh items-center justify-center px-4 py-10 ${themeClass ?? ""}`}
    >
      <div className="w-full max-w-lg text-center text-room-text">
        <span className="inline-flex items-center rounded-full bg-room-surface px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-room-subtle ring-1 ring-room-line">
          Sala de espera
        </span>

        <h1 className="mt-4 text-2xl font-black leading-tight">{title}</h1>
        <p className="mt-2 text-xs text-room-subtle">Começa {startLabel}</p>

        <div className="mt-6 flex items-stretch justify-center gap-2">
          {units.map((unit) => (
            <div
              key={unit.label}
              className="min-w-16 rounded-xl bg-room-surface px-3 py-3 ring-1 ring-room-line"
            >
              <p className="text-2xl font-black tabular-nums">
                {String(unit.value).padStart(2, "0")}
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-room-subtle">
                {unit.label}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-room-subtle">
          Fique por aqui — a entrada abre automaticamente quando chegar a hora.
        </p>
      </div>
    </main>
  );
}
