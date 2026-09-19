/**
 * Esqueleto da sala: reproduz a estrutura do que aparece a seguir (vídeo,
 * título e coluna de chat) e adopta o tema da própria sala. Como o tema só é
 * conhecido depois de carregar, guardamos o último tema usado por sala para
 * que o esqueleto nunca apareça escuro numa sala clara.
 */
export type RoomTheme = "light" | "dark";

const themeKey = (id: string) => `nw:room-theme:${id}`;

export function getCachedRoomTheme(id: string): RoomTheme {
  // Sem memória do tema, assumimos o claro: é o aspeto mais comum das salas e
  // evita o salto de escuro para claro. A partir da primeira abertura, o tema
  // real da sala fica guardado e o esqueleto passa a acertar sempre.
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem(themeKey(id)) === "dark" ? "dark" : "light";
}

export function cacheRoomTheme(id: string, theme: RoomTheme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(themeKey(id), theme);
  } catch {
    /* armazenamento indisponível: seguimos com o tema por omissão */
  }
}

export function RoomSkeleton({ theme = "dark" }: { theme?: RoomTheme }) {
  return (
    <main
      className={`${theme === "light" ? "room-light " : ""}room-ambient min-h-dvh px-4 py-6 sm:px-8`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-room-surface ring-1 ring-room-line" />
          <div className="mt-4 h-5 w-2/3 animate-pulse rounded-lg bg-room-surface" />
          <div className="mt-2 h-4 w-1/3 animate-pulse rounded-lg bg-room-surface" />
        </div>
        <div className="w-full shrink-0 lg:w-80">
          <div className="flex h-[26rem] flex-col gap-3 rounded-2xl bg-room-surface p-4 ring-1 ring-room-line">
            <div className="h-4 w-24 animate-pulse rounded bg-room-raised" />
            <div className="h-10 w-4/5 animate-pulse rounded-xl bg-room-raised" />
            <div className="h-10 w-3/5 animate-pulse rounded-xl bg-room-raised" />
            <div className="h-10 w-4/6 animate-pulse rounded-xl bg-room-raised" />
            <div className="mt-auto h-10 w-full animate-pulse rounded-xl bg-room-raised" />
          </div>
        </div>
      </div>
    </main>
  );
}
