import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { formatSessionStart } from "@/lib/schedule";
import { detectDevice, lookupPlace, type GeoPlace } from "@/lib/live-presence";
import { leadSource } from "@/lib/contacts";
import { loadPixels, trackPixels } from "@/lib/pixels";
import { retry } from "@/lib/utils";
import { DEFAULT_PHONE_COUNTRY, phoneCountryForIso, type PhoneCountry } from "@/lib/phone-countries";
import { WebinarRoom, type RoomProgressOptions } from "@/components/webinar-room";
import { RoomSkeleton, getCachedRoomTheme, cacheRoomTheme } from "@/components/room-skeleton";
import { EntryScreen, entryLiveLabel, isDirectVideo, resolveTheme } from "@/components/room/entry-screen";
import type { Appearance } from "@/components/room/room-parts";
import { parseEntryFields, validateEntry } from "@/lib/entry-fields";
import { offerDeadlinePassed, parseExtraOffers } from "@/lib/room-logic";

const APPEARANCE_KEY = "cw:room-appearance";
import {
  getPublicRoom,
  joinPublicRoom,
  getPublicRoomMessages,
  joinOfferGroup,
  sendPublicRoomMessage,
  trackPublicRoomCta,
  trackPublicRoomProgress,
  VIEWER_EXPIRED,
} from "@/lib/public-room.functions";

export const Route = createFileRoute("/w/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    replay: ["1", "true"].includes(String(search["replay"])) ? true : undefined,
    // Sala de teste: qualquer pessoa com o link entra de imediato, mesmo com a
    // sessão inativa ou fora do horário. Serve para rever a sala antes de abrir.
    teste: ["1", "true"].includes(String(search["teste"])) ? true : undefined,
    // Entrada com dados (links dos e-mails e do WhatsApp): abre já o cartão preenchido.
    nome: typeof search["nome"] === "string" ? search["nome"].slice(0, 80) : undefined,
    email: typeof search["email"] === "string" ? search["email"].slice(0, 160) : undefined,
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
  const { replay, teste, nome, email, ...source } = Route.useSearch();
  return (
    <PublicRoom
      slug={slug}
      replay={replay}
      teste={teste}
      source={source}
      prefill={nome || email ? { name: nome ?? "", email: email ?? "" } : undefined}
    />
  );
}

type Viewer = {
  /** Credencial da sala emitida pelo servidor ao entrar (não é só o id da participação). */
  token: string;
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
  prefill,
}: {
  slug: string;
  replay?: boolean | undefined;
  teste?: boolean | undefined;
  /** Parâmetros de origem do endereço (utm_*, fbclid, gclid). */
  source?: Partial<Record<string, string>>;
  /** Nome e e-mail que vêm no link: o cartão abre já preenchido. */
  prefill?: { name: string; email: string } | undefined;
}) {
  const testMode = Boolean(teste);
  const roomMode: "live" | "replay" = replay ? "replay" : "live";
  const fetchRoom = useServerFn(getPublicRoom);
  const join = useServerFn(joinPublicRoom);
  const sendMessage = useServerFn(sendPublicRoomMessage);
  const trackCta = useServerFn(trackPublicRoomCta);
  const joinGroup = useServerFn(joinOfferGroup);
  const fetchMessages = useServerFn(getPublicRoomMessages);
  const trackProgress = useServerFn(trackPublicRoomProgress);

  const [viewer, setViewer] = useState<Viewer | null>(null);
  // O que a pessoa escreve, campo a campo (pelo id do campo).
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...(prefill?.name ? { name: prefill.name } : {}),
    ...(prefill?.email ? { email: prefill.email } : {}),
  }));
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<string | undefined>(undefined);

  // Aparência: a do organizador, ou a que a pessoa escolheu no ⚙ do vídeo (fica neste browser).
  const [viewerAppearance, setViewerAppearance] = useState<Appearance | null>(null);
  const [prefersDark, setPrefersDark] = useState(true);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(APPEARANCE_KEY);
      if (saved === "system" || saved === "dark" || saved === "light") setViewerAppearance(saved);
    } catch {
      /* sem armazenamento: fica a do organizador */
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setPrefersDark(media.matches);
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  const chooseAppearance = useCallback((next: Appearance) => {
    setViewerAppearance(next);
    try {
      window.localStorage.setItem(APPEARANCE_KEY, next);
    } catch {
      /* fica só nesta visita */
    }
  }, []);
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
      // Entradas antigas guardavam só o id da participação: já não servem, a pessoa entra outra vez.
      if (!parsed?.token) {
        window.localStorage.removeItem(storageKey(slug));
        return;
      }
      if (parsed.name) {
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
  const { data: privateThread, refetch: refetchThread, error: threadError } = useQuery({
    queryKey: ["public-room-messages", viewer?.token],
    enabled: Boolean(viewer?.token),
    refetchInterval: 5000,
    queryFn: () => fetchMessages({ data: { token: viewer!.token } }),
  });
  // Credencial recusada pelo servidor: volta ao formulário em vez de falhar de 5 em 5 segundos.
  useEffect(() => {
    if (threadError?.message !== VIEWER_EXPIRED) return;
    window.localStorage.removeItem(storageKey(slug));
    setViewer(null);
  }, [threadError, slug]);

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
          token: viewer.token,
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
        token: viewer.token,
        eventType,
        videoSecond: Math.max(0, Math.round(positionRef.current)),
      };
      void retry(() => trackCta({ data })).catch((error: unknown) =>
        console.error(`[oferta] ${eventType} não registado`, error),
      );
    },
    [trackCta, viewer],
  );

  // Entrar no grupo da oferta: os dados confirmados ficam na participação e contam como clique.
  const sendGroupJoin = useCallback(
    (person: { name: string; email: string; phone: string }) => {
      if (!viewer) return;
      const data = {
        token: viewer.token,
        name: person.name,
        ...(person.email ? { email: person.email } : {}),
        ...(person.phone ? { phone: person.phone } : {}),
        videoSecond: Math.max(0, Math.round(positionRef.current)),
      };
      void retry(() => joinGroup({ data })).catch((error: unknown) => console.error("[oferta] grupo não registado", error));
    },
    [joinGroup, viewer],
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
        const next = { token: result.token, name: result.name };
        window.localStorage.setItem(storageKey(slug), JSON.stringify(next));
        setViewer(next);
      } catch {
        autoJoinRef.current = false;
      }
    })();
  }, [data, shouldAutoJoin, viewer, join, roomMode, slug, testMode, audienceMeta]);

  const lastSentPeakRef = useRef(0);
  // Segundos vistos que ainda não chegaram ao servidor: se um envio falha, seguem no próximo.
  const pendingPlayedRef = useRef(0);
  const onProgress = useCallback(
    (seconds: number, peakSeconds?: number, options?: RoomProgressOptions) => {
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
            if (parsed?.token) {
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
      pendingPlayedRef.current += options?.played ?? 0;
      // O servidor soma no máximo 120 s por sinal; o resto segue no próximo.
      const played = Math.min(pendingPlayedRef.current, 120);
      // Só grava quando o pico avançou ou houve tempo visto, para não repetir pedidos iguais.
      if (peak <= lastSentPeakRef.current && played === 0) return;
      const previous = lastSentPeakRef.current;
      lastSentPeakRef.current = Math.max(previous, peak);
      pendingPlayedRef.current -= played;
      const data = {
        token: viewer.token,
        watchedSeconds: peak,
        ...(options?.entry != null ? { entrySeconds: options.entry } : {}),
        playedSeconds: played,
      };
      // Ao esconder ou fechar a página, keepalive deixa o pedido terminar sem bloquear.
      const keepalive: typeof fetch = (input, init) => fetch(input, { ...init, keepalive: true });
      void trackProgress(options?.final ? { data, fetch: keepalive } : { data }).catch(() => {
        if (lastSentPeakRef.current === peak) lastSentPeakRef.current = previous;
        pendingPlayedRef.current += played;
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

  const { webinar, comments, audience, socialProof, simulatedPurchases, captions } = data;
  const appearance: Appearance =
    viewerAppearance ?? (webinar.room_theme_system ? "system" : webinar.room_theme === "light" ? "light" : "dark");
  const theme = resolveTheme(appearance, prefersDark);
  const themeClass = theme === "light" ? "room-light" : "";
  const fields = parseEntryFields(webinar.entry_fields, {
    collectPhone: webinar.registration_collect_phone,
    requirePhone: webinar.registration_require_phone,
  });
  const offerClosedByDeadline = offerDeadlinePassed(webinar.offer_deadline, webinar.timezone, Date.now());

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

  // O prazo da oferta fecha também o replay.
  if (roomMode === "replay" && offerClosedByDeadline && !testMode)
    return (
      <main className={`room-ambient flex min-h-dvh items-center justify-center px-6 text-center ${themeClass}`}>
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-black text-room-text">O replay terminou</h1>
          <p className="text-sm text-room-subtle">Esta gravação esteve disponível até ao fim do prazo da oferta.</p>
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
    const submit = async () => {
      setError("");
      setErrorField(undefined);
      const checked = validateEntry(fields, values);
      if (!checked.ok) {
        setError(checked.message);
        setErrorField(checked.field);
        return;
      }
      // O número vai sempre com o indicativo do país escolhido (ex.: +244 923...).
      const phone = checked.phone ? `${phoneCountry.dial} ${checked.phone}` : undefined;
      setEntering(true);
      try {
        const result = await join({
          data: {
            webinarId: webinar.id,
            name: checked.name,
            ...(checked.email ? { email: checked.email } : {}),
            ...(phone ? { phone } : {}),
            ...(Object.keys(checked.answers).length ? { answers: checked.answers } : {}),
            mode: roomMode,
            teste: testMode,
            ...audienceMeta(),
          },
        });
        const next = { token: result.token, name: result.name };
        window.localStorage.setItem(storageKey(slug), JSON.stringify(next));
        if (!testMode) trackPixels("lead");
        setViewer(next);
      } catch (cause) {
        const message = cause instanceof Error && cause.message.length < 120 ? cause.message : "";
        setError(message && !/indispon/i.test(message) ? message : "Não foi possível entrar agora. Tente novamente.");
      } finally {
        setEntering(false);
      }
    };

    // A página: o título com «Ao vivo», os campos e o botão. Quem preenche entra logo na sala.
    const live = entryLiveLabel(startMs, webinar.timezone, Date.now());
    const elapsed = startMs !== null && startMs <= Date.now() ? (Date.now() - startMs) / 1000 : 0;
    return (
      <EntryScreen
        className="min-h-dvh"
        theme={theme}
        title={webinar.public_title}
        live={live.live}
        liveLabel={live.label}
        video={
          isDirectVideo(webinar.video_url, webinar.video_provider)
            ? { url: webinar.video_url!, startSeconds: elapsed }
            : null
        }
        buttonText={webinar.registration_button_text || "Entrar na sala"}
        progress={webinar.registration_progress_enabled ? webinar.registration_progress_value : null}
        fields={fields}
        values={values}
        onChange={setValues}
        country={phoneCountry}
        onCountry={setPhoneCountry}
        cardColor={webinar.entry_card_color}
        buttonColor={webinar.entry_button_color}
        onSubmit={() => void submit()}
        error={error}
        errorField={errorField}
        entering={entering}
      />
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
      theme={theme}
      appearance={appearance}
      onAppearance={chooseAppearance}
      captions={captions}
      offers={{
        extra: parseExtraOffers(webinar.extra_offers),
        closed: offerClosedByDeadline,
        closeAtZero: webinar.offer_countdown_end === "close",
        utm: webinar.offer_utm,
      }}
      sales={{ where: webinar.sales_where === "chat" || webinar.sales_where === "video" ? webinar.sales_where : "both", real: webinar.sales_show_real }}
      audienceFormat={audience.format}
      hostVerified={webinar.host_verified}
      format={webinar.room_format}
      live={webinar.live}
      onJoinGroup={sendGroupJoin}
      prefill={{
        name: values["name"] ?? "",
        email: values["email"] ?? "",
        phone: values["whatsapp"] ? `${phoneCountry.dial} ${values["whatsapp"]}` : "",
      }}
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
      checkoutOrigin={{
        source: source["utm_source"] ?? null,
        medium: source["utm_medium"] ?? null,
        campaign: source["utm_campaign"] ?? null,
      }}
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
