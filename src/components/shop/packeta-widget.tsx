"use client";

import { useCallback, useEffect, useState } from "react";
import Script from "next/script";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

/** Packeta pickup point returned by widget callback */
export interface PacketaPoint {
  id: string;
  name: string;
  street: string;
  city: string;
  zip: string;
  formatedValue: string;
}

interface PacketaWidgetProps {
  onPointSelected: (point: PacketaPoint | null) => void;
  selectedPoint: PacketaPoint | null;
}

declare global {
  interface Window {
    Packeta?: {
      Widget: {
        pick: (
          apiKey: string,
          callback: (point: PacketaPoint | null) => void,
          options: Record<string, unknown>
        ) => void;
      };
    };
  }
}

const PACKETA_API_KEY = process.env.NEXT_PUBLIC_PACKETA_API_KEY ?? "";

export function PacketaWidget({
  onPointSelected,
  selectedPoint,
}: PacketaWidgetProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [widgetError, setWidgetError] = useState(false);

  // Check if script is already loaded (e.g. from cache)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync browser state on mount, no async alternative
    if (window.Packeta) setScriptLoaded(true);
  }, []);

  const openWidget = useCallback(() => {
    if (!window.Packeta) {
      setWidgetError(true);
      return;
    }

    try {
      window.Packeta.Widget.pick(
        PACKETA_API_KEY,
        (point) => {
          onPointSelected(point ?? null);
        },
        {
          language: "cs",
          view: "modal",
          vendors: [{ country: "cz" }],
        }
      );
    } catch (e) {
      logger.error("[PacketaWidget] Widget pick failed:", e);
      setWidgetError(true);
    }
  }, [onPointSelected]);

  return (
    <div>
      <Script
        src="https://widget.packeta.com/v6/www/js/library.js"
        strategy="lazyOnload"
        onLoad={() => setScriptLoaded(true)}
        onError={() => setWidgetError(true)}
      />

      {widgetError && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Nepodařilo se načíst mapu výdejních míst. Zkuste to znovu nebo zvolte
          jiný způsob dopravy.
        </div>
      )}

      {selectedPoint ? (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {selectedPoint.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedPoint.street}, {selectedPoint.zip} {selectedPoint.city}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onPointSelected(null)}
            className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Zrušit výběr"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full gap-2"
          onClick={openWidget}
          disabled={!scriptLoaded}
        >
          <MapPin className="size-4" />
          {scriptLoaded ? "Vybrat výdejní místo" : "Načítání mapy..."}
        </Button>
      )}
    </div>
  );
}
