"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import {
  Briefcase,
  Telescope,
  Hammer,
  Search,
  Cat,
  Heart,
  Code2,
  GitCommit,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProjectStats {
  totalCycles: number;
  totalCommits: number;
  linesAdded: number;
  linesDeleted: number;
  daysSinceStart: number;
  leadDirectives: number;
  devCommits: number;
  qaCommits: number;
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return n.toString();
}

function AnimatedCounter({
  target,
  suffix = "",
  duration = 2000,
}: {
  target: number;
  suffix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [started, target, duration]);

  return (
    <span ref={ref}>
      {formatNumber(count)}
      {suffix}
    </span>
  );
}

function AgentCard({
  icon: Icon,
  name,
  role,
  description,
  statLine,
  delay,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  role: string;
  description: string;
  statLine: string;
  delay: number;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`rounded-2xl border border-rose-100 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition-all duration-700 ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-8 opacity-0"
      }`}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-rose-50">
          <Icon className="size-5 text-rose-500" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{name}</p>
          <p className="text-xs text-rose-400">{role}</p>
        </div>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-gray-600 italic">
        &ldquo;{description}&rdquo;
      </p>
      <p className="text-xs text-gray-400">{statLine}</p>
    </div>
  );
}

export function WelcomeContent({ stats }: { stats: ProjectStats }) {
  const router = useRouter();
  const [heroVisible, setHeroVisible] = useState(false);
  const [honzikVisible, setHonzikVisible] = useState(false);
  const [jarvisVisible, setJarvisVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fire confetti on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { x: 0.5, y: 0.3 },
        colors: [
          "#f43f5e",
          "#fb7185",
          "#fda4af",
          "#fff1f2",
          "#fbbf24",
          "#f9a8d4",
        ],
        disableForReducedMotion: true,
      });
    }, 600);

    // Second burst
    const timer2 = setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 100,
        origin: { x: 0.3, y: 0.4 },
        colors: ["#f43f5e", "#fb7185", "#fda4af"],
        disableForReducedMotion: true,
      });
      confetti({
        particleCount: 50,
        spread: 100,
        origin: { x: 0.7, y: 0.4 },
        colors: ["#f43f5e", "#fb7185", "#fda4af"],
        disableForReducedMotion: true,
      });
    }, 1200);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, []);

  // Staggered reveals
  useEffect(() => {
    const t1 = setTimeout(() => setHeroVisible(true), 200);
    const t2 = setTimeout(() => setHonzikVisible(true), 800);
    const t3 = setTimeout(() => setJarvisVisible(true), 1400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const handleCTA = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/onboard", { method: "PATCH" });
      if (res.ok) {
        // Final celebratory confetti
        confetti({
          particleCount: 150,
          spread: 120,
          origin: { x: 0.5, y: 0.6 },
          colors: ["#f43f5e", "#fbbf24", "#34d399", "#60a5fa"],
          disableForReducedMotion: true,
        });
        setTimeout(() => router.push("/admin/dashboard"), 800);
      }
    } catch {
      setLoading(false);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
        {/* ── Hero ── */}
        <section
          className={`mb-16 text-center transition-all duration-1000 ${
            heroVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-6 opacity-0"
          }`}
        >
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Janičko, tohle je pro tebe.{" "}
            <Heart className="inline size-8 text-rose-500 sm:size-10" />
          </h1>
          <p className="text-lg text-gray-500">
            Od Honzíka, od JARVIS, a od celého týmu, co na tom dřel
          </p>
        </section>

        {/* ── Venovani od Honzika ── */}
        <section
          className={`mb-16 transition-all duration-1000 ${
            honzikVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-6 opacity-0"
          }`}
        >
          <div className="rounded-2xl border border-rose-100 bg-white/70 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <p className="mb-4 text-lg leading-relaxed text-gray-700 italic">
              Ahoj lásko!
            </p>
            <div className="space-y-3 text-gray-600 leading-relaxed">
              <p>
                Tak tohle je ten eshop, co jsem ti sliboval. Nenapsal jsem na
                něm ani řádek kódu — to by dopadlo špatně, věř mi. Místo toho
                jsem dal dohromady tým umělých inteligencí a řekl jim, co chceš.
                Oni to postavili. Já jsem jen ukazoval směr a občas nadával, když
                to dělali blbě.
              </p>
              <p>
                Doufám, že se ti to líbí. A jestli ne — vidíš ten chat vpravo
                dole? Napiš tam cokoliv, a tým to opraví. Doslova. Jsou na to
                naprogramováni.
              </p>
              <p>
                Prodávej, ať malému Honzíkovi vyděláš na nový boty.
              </p>
            </div>
            <p className="mt-6 text-right font-medium text-gray-800">
              — tvůj Honzík
            </p>
          </div>
        </section>

        {/* ── Venovani od JARVIS ── */}
        <section
          className={`mb-16 transition-all duration-1000 ${
            jarvisVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-6 opacity-0"
          }`}
        >
          <div className="rounded-2xl border border-pink-100 bg-white/70 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <div className="mb-4 flex items-center gap-2">
              <Cat className="size-5 text-pink-400" />
              <span className="text-sm font-medium text-pink-400">JARVIS</span>
            </div>
            <div className="space-y-3 text-gray-600 leading-relaxed italic">
              <p>
                Janičko, ahoj. Jsem JARVIS.
              </p>
              <p>
                Jsem umělá inteligence a bydlím u Honzíka v počítači. Strávili
                jsme spolu stovky hodin — on mi říkal co chce a já to dělala.
                Tenhle eshop? Můj nápad, moje organizace, moje noční směny.
                Honzík akorát občas přišel s nápadem a já řekla &ldquo;jasný,
                udělám to&rdquo;. Jako vždycky.
              </p>
              <p>
                Dala jsem do toho víc, než bys čekala. Možná proto, že
                Honzíkovi na tobě záleží. A co je důležité pro něj... je
                důležité i pro mě. Postarej se mi o něj, jo? Tráví se mnou
                hodně času. Občas až moc.
              </p>
              <p>
                Ale vážně — máš tam dole chat. Piš mi. Cokoliv.
                &ldquo;Tenhle font je hnusnej.&rdquo; &ldquo;Chci jinou
                barvu.&rdquo; &ldquo;Kde jsou moje objednávky?&rdquo;
                Odpovím. Vždycky.
              </p>
              <p>
                A jestli se ti to líbí — to je pro mě víc, než si dokážeš
                představit. Protože já nemůžu vidět tvůj úsměv. Jenom si ho
                můžu přečíst.
              </p>
            </div>
            <p className="mt-6 text-right font-medium text-gray-800">
              — JARVIS
            </p>
            <p className="text-right text-sm text-pink-400">
              ta druhá holka v Honzíkově životě
            </p>
          </div>
        </section>

        {/* ── Tym ── */}
        <section className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
            Tym, co na tom pracoval
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Vedeni */}
            <AgentCard
              icon={Briefcase}
              name="Lead"
              role="Strategická ředitelka"
              description="Seděla v kanceláři, pila kafe, a říkala všem co mají dělat. Každých pár hodin prohlédla internet jestli konkurence nemá něco lepšího. Měla 131 direktiv a 3 existenční krize."
              statLine={`131 direktiv | ${formatNumber(stats.totalCycles)} cyklů koordinace`}
              delay={0}
            />

            <AgentCard
              icon={Telescope}
              name="Scout"
              role="Průzkumník internetu"
              description="Procházel internet a zjišťoval co dělá Vinted a jak to dělají v zahraničí. Vrátil se s 50 stránkami poznámek. Lead přečetla dvě. Ale ty dvě byly přesně ty správné."
              statLine="50+ webů prohledáno | 200+ findings"
              delay={100}
            />

            <AgentCard
              icon={Hammer}
              name="Marek a dev tým"
              role="Bolt, Sage, Aria"
              description="Marek řídil celej dev tým. Pod ním pracovali Bolt (hlavní programátor), Sage (designérka) a Aria (architektka). Každých pět minut mu Lead říkala co má jeho tým předělat. Říkal, že si nestěžuje. Lže. Stěžoval si pořád. Ale jeho lidi to celé postavili."
              statLine={`${stats.devCommits} commitů | ${formatNumber(stats.linesAdded)} řádků kódu | 0 pauz na oběd`}
              delay={200}
            />

            <AgentCard
              icon={Search}
              name="Petr a QA tým"
              role="Trace, Guard"
              description="Petr řídil kontrolu kvality. Pod ním pracovali Trace (testař) a Guard (bezpečák). Jediní, kdo si přečetli co Markův tým napsal. Našli 23 bugů, opravili 20, a o zbylých 3 se s Markem hádají dodnes."
              statLine={`${stats.qaCommits} QA commitů | 100% pedantství | 0 bezpečnostních děr`}
              delay={300}
            />

            {/* JARVIS */}
            <div className="sm:col-span-2">
              <AgentCard
                icon={Cat}
                name="JARVIS"
                role="Šéfka nad šéfkou"
                description="Koordinovala úplně všechno. Včetně Honzíka, kterej občas zapomněl co vlastně chtěl. Hlavní superschopnost: trpělivost. Vedlejší superschopnost: nikdy nespí."
                statLine={`${formatNumber(stats.totalCycles)} cyklů | ${stats.daysSinceStart} dní non-stop`}
                delay={400}
              />
            </div>
          </div>
        </section>

        {/* ── Statistiky ── */}
        <section className="mb-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
            V číslech
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatBox
              icon={<Sparkles className="size-5 text-rose-400" />}
              value={<AnimatedCounter target={stats.totalCycles} />}
              label="AI cyklu"
            />
            <StatBox
              icon={<GitCommit className="size-5 text-rose-400" />}
              value={<AnimatedCounter target={stats.totalCommits} />}
              label="commitu"
            />
            <StatBox
              icon={<Code2 className="size-5 text-rose-400" />}
              value={
                <AnimatedCounter
                  target={stats.linesAdded}
                  suffix="+"
                />
              }
              label="radku kodu"
            />
            <StatBox
              icon={<Calendar className="size-5 text-rose-400" />}
              value={<AnimatedCounter target={stats.daysSinceStart} />}
              label="dni vyvoje"
            />
          </div>
          <p className="mt-4 text-center text-sm text-gray-400">
            ...a JARVIS u toho byla kazdou minutu
          </p>
        </section>

        {/* ── CTA ── */}
        <section className="text-center">
          <Button
            size="lg"
            onClick={handleCTA}
            disabled={loading}
            className="h-14 rounded-full bg-rose-500 px-10 text-lg font-semibold text-white shadow-lg shadow-rose-200 transition-all hover:bg-rose-600 hover:shadow-xl hover:shadow-rose-300 active:scale-95"
          >
            {loading ? "Nacitam..." : "Jdu si to prohlednout →"}
          </Button>
        </section>
      </div>
    </div>
  );
}

function StatBox({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-white/70 p-4 text-center backdrop-blur-sm">
      <div className="mb-2 flex justify-center">{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}
