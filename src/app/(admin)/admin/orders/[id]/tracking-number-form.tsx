"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, Check } from "lucide-react";
import { updateTrackingNumber } from "../actions";

export function TrackingNumberForm({
  orderId,
  currentTrackingNumber,
}: {
  orderId: string;
  currentTrackingNumber: string | null;
}) {
  const [value, setValue] = useState(currentTrackingNumber ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(false);
    startTransition(async () => {
      await updateTrackingNumber(orderId, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Truck className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Sledovací číslo
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="např. DR123456789CZ"
          className="text-sm"
        />
        <Button
          size="sm"
          variant={saved ? "outline" : "default"}
          onClick={handleSave}
          disabled={isPending}
        >
          {saved ? (
            <>
              <Check className="size-3.5" />
              Uloženo
            </>
          ) : isPending ? (
            "Ukládám..."
          ) : (
            "Uložit"
          )}
        </Button>
      </div>
      {currentTrackingNumber && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Zákazník vidí toto sledovací číslo na stránce objednávky.
        </p>
      )}
    </div>
  );
}
