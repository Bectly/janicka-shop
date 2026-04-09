export const revalidate = 300;
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "O nás | Janička",
  description:
    "Janička — second hand eshop s kvalitním oblečením pro moderní ženy. Udržitelná móda, unikátní kousky, skvělé ceny.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold text-foreground">
        O nás
      </h1>

      <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
        <p>
          Vítejte v <strong className="text-foreground">Janičce</strong> —
          vašem oblíbeném second hand obchodu s oblečením. Věříme, že krásné
          oblečení nemusí být drahé a že udržitelná móda je budoucnost.
        </p>

        <h2 className="font-heading text-xl font-semibold text-foreground">
          Proč second hand?
        </h2>
        <p>
          Každý kousek v naší nabídce je unikát. Pečlivě vybíráme pouze
          kvalitní oblečení od prémiových značek v skvělém stavu. Dáváme
          oblečení druhý život a šetříme přitom planetu — žádný fast fashion,
          žádné plýtvání.
        </p>

        <h2 className="font-heading text-xl font-semibold text-foreground">
          Co u nás najdete
        </h2>
        <ul className="list-inside list-disc space-y-1">
          <li>Šaty pro každou příležitost</li>
          <li>Topy a halenky od známých značek</li>
          <li>Kalhoty a sukně v perfektním stavu</li>
          <li>Bundy a kabáty na každé počasí</li>
          <li>Doplňky — šperky, kabelky, šátky</li>
        </ul>

        <h2 className="font-heading text-xl font-semibold text-foreground">
          Náš přístup
        </h2>
        <p>
          Každý kousek osobně kontrolujeme a fotografujeme. U každého produktu
          uvádíme značku, stav a velikost, abyste přesně věděly, co kupujete.
          Transparentnost je pro nás klíčová.
        </p>

        <p>
          Děkujeme, že nakupujete u nás a podporujete udržitelnou módu. 💚
        </p>
      </div>
    </div>
  );
}
