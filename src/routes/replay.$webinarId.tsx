import { createFileRoute } from "@tanstack/react-router";
import { InternalWebinarRoom } from "@/components/webinar-room-internal";

export const Route = createFileRoute("/replay/$webinarId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Replay | NovaWebinar" },
      { name: "description", content: "Reveja o webinar com o mesmo vídeo da transmissão." },
      { property: "og:title", content: "Replay | NovaWebinar" },
      { property: "og:description", content: "Reveja o webinar quando quiser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReplayRoom,
});

function ReplayRoom() {
  const { webinarId } = Route.useParams();
  return <InternalWebinarRoom webinarId={webinarId} mode="replay" />;
}
