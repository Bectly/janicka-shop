import { Check, X } from "lucide-react";

const vintedProblems = [
  "Od 30. dubna používají tvoje fotky k trénování AI — bez možnosti odmítnutí",
  "AI generované fotky produktů — nevíš, jak věc doopravdy vypadá",
  "76 % hodnocení na Trustpilotu je 1 hvězdička (2,1/5)",
];

const janickaAdvantages = [
  "Tvoje fotky jsou tvoje. Vždy. Nikdy je nepoužijeme k trénování AI.",
  "Každý kousek fotografujeme my — reálné fotky, žádný filtr",
  "Garantovaný stav — zkontrolováno, než to uvidíš",
];

export function VintedComparisonSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-charcoal via-charcoal to-brand-dark/80 text-white shadow-xl">
        <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-16">
          <h2 className="font-heading text-center text-2xl font-bold sm:text-3xl">
            Na Vintedu nevíš, co kupuješ.{" "}
            <span className="text-brand-light">U&nbsp;nás ano.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-brand-light/70">
            Tvoje soukromí a důvěra nejsou vyjednávací položka.
          </p>

          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {/* Vinted column */}
            <div className="rounded-xl bg-white/[0.06] p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-light/60">
                Jinde
              </p>
              <ul className="mt-4 space-y-4">
                {vintedProblems.map((problem) => (
                  <li key={problem} className="flex gap-3 text-sm leading-relaxed text-white/75">
                    <X className="mt-0.5 size-4 shrink-0 text-brand-light/80" />
                    <span>{problem}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Janička column */}
            <div className="rounded-xl bg-white/10 p-6 ring-1 ring-white/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-sage-light">
                U nás
              </p>
              <ul className="mt-4 space-y-4">
                {janickaAdvantages.map((advantage) => (
                  <li key={advantage} className="flex gap-3 text-sm leading-relaxed text-white">
                    <Check className="mt-0.5 size-4 shrink-0 text-sage" />
                    <span>{advantage}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
