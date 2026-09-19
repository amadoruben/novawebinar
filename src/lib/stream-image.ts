/**
 * Lê a geração de imagem em streaming e entrega cada fotograma ao editor.
 * O último fotograma vem marcado como final para tirar o desfoque.
 */
export async function streamImage(
  prompt: string,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<void> {
  const response = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok || !response.body) {
    throw new Error(await response.text().catch(() => "Não foi possível gerar a imagem."));
  }

  let sawAny = false;
  let sawFinal = false;
  let failure = "";
  let buffer = "";

  const handleEvent = (block: string) => {
    let name = "";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) name = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    const raw = dataLines.join("\n");
    if (!raw || raw === "[DONE]") return;

    let payload: {
      type?: string;
      b64_json?: string;
      error?: { message?: string };
    };
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    if (name === "error" || payload.type === "error") {
      sawAny = true;
      failure = payload.error?.message ?? "A geração da imagem falhou.";
      return;
    }
    if (!payload.b64_json) return;

    sawAny = true;
    const isFinal = name.endsWith(".completed") || payload.type?.endsWith(".completed") === true;
    if (isFinal) sawFinal = true;
    onFrame(`data:image/png;base64,${payload.b64_json}`, isFinal);
  };

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let index = buffer.indexOf("\n\n");
      while (index !== -1) {
        handleEvent(buffer.slice(0, index));
        buffer = buffer.slice(index + 2);
        index = buffer.indexOf("\n\n");
      }
    }
    if (buffer.trim()) handleEvent(buffer);
  } finally {
    void reader.cancel().catch(() => {});
  }

  if (failure) throw new Error(failure);

  if (!sawAny) {
    // Sem qualquer acontecimento: repete uma única vez sem streaming.
    const replay = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, stream: false }),
    });
    if (!replay.ok)
      throw new Error(await replay.text().catch(() => "Não foi possível gerar a imagem."));
    const json = (await replay.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("A IA não devolveu nenhuma imagem.");
    onFrame(`data:image/png;base64,${b64}`, true);
    return;
  }

  if (!sawFinal) throw new Error("A geração da imagem foi interrompida.");
}
