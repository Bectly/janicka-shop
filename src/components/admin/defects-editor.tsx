"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/admin/image-upload";

interface DefectsEditorProps {
  initialNote?: string | null;
  initialImages?: string[];
}

export function DefectsEditor({
  initialNote = "",
  initialImages = [],
}: DefectsEditorProps) {
  const [images, setImages] = useState<string[]>(initialImages);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="size-4 text-muted-foreground" />
        <Label htmlFor="defectsNote">Vady a nedokonalosti</Label>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Popiš volně co najdeš — zákaznice tím získává důvěru. Žádná nepříjemná překvapení.
      </p>

      <Textarea
        id="defectsNote"
        name="defectsNote"
        defaultValue={initialNote ?? ""}
        rows={3}
        maxLength={1000}
        placeholder="např. Drobná skvrna na pravém rukávu, lehce vybledlá barva u límce…"
      />

      <div className="space-y-2">
        <Label>Detailní foto vad</Label>
        <p className="text-xs text-muted-foreground">
          Samostatné detailní fotky vad — zobrazí se na produktu v oddělené galerii,
          nemíchají se s hlavními fotkami.
        </p>
        <input type="hidden" name="defectImages" value={JSON.stringify(images)} />
        <ImageUpload value={images} onChange={setImages} />
      </div>
    </div>
  );
}
