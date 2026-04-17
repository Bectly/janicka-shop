import Image from "next/image";
import { AlertCircle, Sparkles, ZoomIn } from "lucide-react";

const NEW_CONDITIONS = new Set(["new_with_tags", "new_without_tags"]);

interface ProductDefectsProps {
  note: string | null;
  images: string[];
  condition?: string;
}

export function ProductDefects({ note, images, condition }: ProductDefectsProps) {
  const trimmedNote = note?.trim() ?? "";
  const hasContent = trimmedNote.length > 0 || images.length > 0;
  const isNew = condition ? NEW_CONDITIONS.has(condition) : false;

  if (!hasContent) {
    return (
      <div className="my-10 rounded-2xl border border-sage-light bg-sage-light/30 p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-dark/10">
            <Sparkles className="size-5 text-sage-dark" />
          </div>
          <div>
            <p className="font-heading text-base font-semibold text-foreground">
              {isNew ? "Nové zboží — bez vad" : "Bez viditelných vad"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isNew
                ? "Nepoužitý kousek v původním stavu."
                : "Kousek je v perfektním stavu — nic jsme neobjevili."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Vady a nedokonalosti produktu"
      className="my-10 rounded-2xl border border-border bg-background p-6"
    >
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
          <h2 className="font-heading text-base font-semibold text-foreground">
            Vady a nedokonalosti
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Každý second-hand kousek má svůj příběh. Tady je všechno otevřeně —
          ať víš přesně, co kupuješ.
        </p>
      </div>

      {trimmedNote && (
        <p className="mb-5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {trimmedNote}
        </p>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {images.map((url, i) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
              aria-label={`Zvětšit detail vady ${i + 1}`}
            >
              <Image
                src={url}
                alt={`Detail vady ${i + 1}`}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/25">
                <ZoomIn className="size-5 text-white opacity-0 drop-shadow transition-opacity duration-300 group-hover:opacity-100" />
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
