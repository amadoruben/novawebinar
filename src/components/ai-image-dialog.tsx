import { useRef, useState } from "react";
import { Check, ImagePlus, Loader2, RefreshCw, Wand2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { streamImage } from "@/lib/stream-image";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/friendly-error";

export type ImageKind = "cover" | "offer" | "product";

const KIND_TEXT: Record<ImageKind, { title: string; description: string; brief: string }> = {
  cover: {
    title: "Gerar capa do webinar com IA",
    description: "A imagem que aparece no ecrã de entrada e na sala de espera.",
    brief: "capa larga e apelativa para a página de entrada de um webinar",
  },
  offer: {
    title: "Gerar imagem da oferta com IA",
    description: "A imagem que acompanha o botão quando a oferta abre.",
    brief:
      "imagem de oferta com aspeto de proposta irresistível, pronta a acompanhar um botão de compra",
  },
  product: {
    title: "Gerar imagem do produto com IA",
    description: "Uma apresentação visual do produto para usar onde precisar.",
    brief: "apresentação limpa e premium do produto, ao estilo de uma montra digital",
  },
};

const STYLES = [
  { value: "moderno", label: "Moderno e limpo" },
  { value: "cinematografico", label: "Cinematográfico" },
  { value: "minimal", label: "Minimalista" },
  { value: "vibrante", label: "Vibrante e energético" },
  { value: "corporativo", label: "Corporativo e sóbrio" },
  { value: "3d", label: "3D com brilho" },
];

const FORMATS = [
  { value: "16:9", label: "Panorâmico (16:9)", ratio: "aspect-video" },
  { value: "1:1", label: "Quadrado (1:1)", ratio: "aspect-square" },
  { value: "4:5", label: "Vertical (4:5)", ratio: "aspect-[4/5]" },
];

function dataUrlToFile(dataUrl: string, name: string) {
  const [head, body] = dataUrl.split(",");
  const mime = head?.match(/data:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(body ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export function AiImageDialog({
  open,
  onOpenChange,
  kind,
  defaults,
  onApply,
  onUpload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ImageKind;
  defaults: { product?: string; title?: string; description?: string };
  /** Recebe a imagem escolhida já como ficheiro, pronta a guardar. */
  onApply: (file: File) => Promise<void>;
  /** Carregamento de uma imagem própria, a partir do computador. */
  onUpload: (file: File) => Promise<void>;
}) {
  const text = KIND_TEXT[kind];
  const [product, setProduct] = useState(defaults.product ?? "");
  const [title, setTitle] = useState(defaults.title ?? "");
  const [description, setDescription] = useState(defaults.description ?? "");
  const [style, setStyle] = useState("moderno");
  const [colors, setColors] = useState("");
  const [format, setFormat] = useState("16:9");
  const [results, setResults] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ src: string; final: boolean } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ratioClass = FORMATS.find((f) => f.value === format)?.ratio ?? "aspect-video";

  const buildPrompt = (variation: boolean) =>
    [
      `Cria uma ${text.brief}.`,
      product ? `Produto: ${product}.` : "",
      title ? `Título a destacar: "${title}".` : "",
      description ? `Contexto: ${description}` : "",
      `Estilo visual: ${STYLES.find((s) => s.value === style)?.label}.`,
      colors ? `Cores predominantes: ${colors}.` : "",
      `Formato ${format}.`,
      "Composição equilibrada, muita qualidade, sem marcas de água e sem texto ilegível.",
      variation
        ? "Cria uma variação claramente diferente das anteriores em enquadramento e composição."
        : "",
    ]
      .filter(Boolean)
      .join(" ");

  const generate = async (variation = false) => {
    setBusy(true);
    setPreview(null);
    try {
      let last = "";
      await streamImage(buildPrompt(variation), (src, isFinal) => {
        last = src;
        setPreview({ src, final: isFinal });
      });
      if (last) {
        setResults((prev) => {
          const next = [...prev, last];
          setSelected(next.length - 1);
          return next;
        });
      }
      setPreview(null);
    } catch (error) {
      setPreview(null);
      toast.error(friendlyError(error, "Não foi possível gerar a imagem."));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    const chosen = selected === null ? null : results[selected];
    if (!chosen) return;
    setApplying(true);
    try {
      await onApply(dataUrlToFile(chosen, `${kind}-${Date.now()}.png`));
      onOpenChange(false);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-4 text-primary" />
            {text.title}
          </DialogTitle>
          <DialogDescription>{text.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nome do produto</Label>
            <Input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="Ex.: Marca Milionária"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que se vê na imagem e para quem é"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Estilo</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cores</Label>
            <Input
              value={colors}
              onChange={(e) => setColors(e.target.value)}
              placeholder="Ex.: preto, dourado e vermelho"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Formato</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {preview && (
          <div className={cn("overflow-hidden rounded-xl border bg-muted/30", ratioClass)}>
            <img
              src={preview.src}
              alt="A gerar"
              className={cn(
                "size-full object-cover transition-[filter] duration-500",
                preview.final ? "blur-0" : "blur-xl",
              )}
            />
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {results.length} versão{results.length === 1 ? "" : "ões"} gerada
              {results.length === 1 ? "" : "s"}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {results.map((src, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelected(index)}
                  className={cn(
                    "overflow-hidden rounded-xl border-2 transition",
                    selected === index
                      ? "border-primary"
                      : "border-transparent hover:border-border",
                    ratioClass,
                  )}
                >
                  <img src={src} alt={`Versão ${index + 1}`} className="size-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setApplying(true);
            try {
              await onUpload(file);
              onOpenChange(false);
            } finally {
              setApplying(false);
            }
          }}
        />

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={applying}>
            <Upload />
            Carregar a minha imagem
          </Button>
          <Button variant="outline" onClick={() => generate(results.length > 0)} disabled={busy}>
            {busy ? (
              <Loader2 className="animate-spin" />
            ) : results.length > 0 ? (
              <RefreshCw />
            ) : (
              <ImagePlus />
            )}
            {results.length > 0 ? "Criar variação" : "Gerar"}
          </Button>
          <Button onClick={apply} disabled={applying || busy || selected === null}>
            {applying ? <Loader2 className="animate-spin" /> : <Check />}
            Usar esta imagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
