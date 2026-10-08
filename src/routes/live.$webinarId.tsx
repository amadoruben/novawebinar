import { createFileRoute } from "@tanstack/react-router";
import { InternalWebinarRoom } from "@/components/webinar-room-internal";
import { ROOM_VIEWPORT } from "@/components/webinar-room";

export const Route = createFileRoute("/live/$webinarId")({
  head: () => ({
    meta: [
      { title: "Sala ao vivo | Convertewebinar" },
      ROOM_VIEWPORT,
      { name: "description", content: "Sala de webinar ao vivo Convertewebinar." },
      { property: "og:title", content: "Sala ao vivo | Convertewebinar" },
      { property: "og:description", content: "Participe no webinar ao vivo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveRoom,
});

function LiveRoom() {
  const { webinarId } = Route.useParams();
  return <InternalWebinarRoom webinarId={webinarId} mode="live" />;
}
