import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClipboardList, LineChart, AlertCircle, Users, GraduationCap, User } from "lucide-react";

export const metadata: Metadata = {
  title: "SkillStorm – Moderní platforma pro základní školy",
  description:
    "Digitální nástroj pro tvorbu testů a analýzu výsledků žáků.",
};

const features = [
  {
    title: "Tvorba testů",
    description:
      "Vytvářejte testy, přiřazujte je třídám a sledujte průběh. Jednoduché rozhraní pro učitele.",
    icon: ClipboardList,
  },
  {
    title: "Přehled výsledků",
    description:
      "Přehledné tabulky a grafy výsledků žáků. Export do PDF pro archivaci a hodnocení.",
    icon: LineChart,
  },
  {
    title: "Analýza chyb",
    description:
      "Identifikujte problematická témata a přizpůsobte výuku potřebám třídy.",
    icon: AlertCircle,
  },
];

const audiences = [
  {
    title: "Učitel",
    description: "Tvorba testů, zadávání třídám, sledování výsledků a chyb.",
    icon: User,
  },
  {
    title: "Ředitel",
    description: "Přehled školy, statistiky, exporty a analýzy napříč třídami.",
    icon: Users,
  },
  {
    title: "Žák",
    description: "Řešení testů, zobrazení výsledků a sledování vlastního pokroku.",
    icon: GraduationCap,
  },
];

export default function PublicPage(): React.JSX.Element {
  return (
    <div className="bg-secondary">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Moderní nástroj pro řízení výuky na základní škole
          </h1>
          <p className="mt-6 text-lg text-slate-600 sm:text-xl">
            SkillStorm pomáhá učitelům tvořit testy, analyzovat výsledky a zlepšovat studijní progres žáků.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="rounded-2xl px-8 py-6 text-base">
              <Link href="/register">Vyzkoušet demo</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-2xl px-8 py-6 text-base">
              <Link href="/login">Přihlásit se</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Funkce */}
      <section className="border-t border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Funkce
          </h2>
          <div className="mx-auto mt-12 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Card
                  key={f.title}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-100 p-6 shadow-soft"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
                  <p className="text-sm text-slate-600">{f.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pro koho */}
      <section className="border-t border-slate-200 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Pro koho
          </h2>
          <div className="mx-auto mt-12 grid max-w-5xl gap-8 sm:grid-cols-3">
            {audiences.map((a) => {
              const Icon = a.icon;
              return (
                <Card
                  key={a.title}
                  className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 p-6 text-center shadow-soft"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{a.title}</h3>
                  <p className="text-sm text-slate-600">{a.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Placeholder screenshot */}
      <section className="border-t border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="flex h-64 items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400 sm:h-80">
              <span className="text-sm font-medium">Náhled aplikace</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bezpečnost a ochrana dat */}
      <section className="border-t border-slate-200 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Bezpečnost a ochrana dat
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-center text-slate-600">
            Data žáků a učitelů jsou u nás v bezpečí. Používáme šifrované připojení, data jsou uložena
            v EU a plně respektujeme GDPR. Žádná data neprodáváme ani nesdílíme s třetími stranami.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-primary py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Začít používat SkillStorm
          </h2>
          <p className="mt-4 text-lg text-white/90">
            Registrujte se zdarma a vyzkoušejte platformu pro vaši školu.
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="mt-8 rounded-2xl bg-white px-8 py-6 text-base text-primary hover:bg-slate-100"
          >
            <Link href="/register">Začít používat SkillStorm</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
