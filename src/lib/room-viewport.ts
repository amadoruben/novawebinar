/**
 * O viewport das páginas da sala: ocupa o ecrã todo do iPhone (as zonas seguras tratam-se com
 * env(safe-area-inset-*)). O teclado trata-se pela área visível (visualViewport), igual no iPhone
 * e no Android: sem `interactive-widget=resizes-content`, que num telemóvel pequeno com o teclado
 * aberto deixava o ecrã mais largo do que alto e trocava a sala para o desenho deitado.
 */
export const ROOM_VIEWPORT = {
  name: "viewport",
  content: "width=device-width, initial-scale=1, viewport-fit=cover",
};
