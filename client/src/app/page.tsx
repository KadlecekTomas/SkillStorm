import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const highlights = [
  {
    title: "Adaptive classrooms",
    description: "Create hybrid cohorts, monitor attendance and share assets.",
  },
  {
    title: "Assessment engine",
    description: "Auto-graded tests with instant analytics and PDF exports.",
  },
  {
    title: "Content lab",
    description: "Reusable lesson blocks curated by the EduTo community.",
  },
];

export default function Home(): React.JSX.Element {
  return (
    <main className="min-h-screen bg-secondary px-6 py-20 sm:px-10 lg:px-16">
      <section className="mx-auto max-w-4xl text-center">
        <p className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">
          EduTo certified beta
        </p>
        <h1 className="mt-6 text-4xl font-semibold text-slate-900 sm:text-5xl">
          SkillStorm – moderní operační systém pro školy.
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Dashboard pro učitele, studenty i vedení. Řiďte výuku, testy a obsah z jednoho místa.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="rounded-2xl px-6 py-3 text-base">
            <Link href="/login">Přihlásit se</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-2xl px-6 py-3 text-base">
            <Link href="/register">Začít</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-5xl gap-4 md:grid-cols-3">
        {highlights.map((item) => (
          <Card key={item.title} className="h-full space-y-2 rounded-2xl border border-slate-100 p-6 shadow-soft">
            <p className="text-lg font-semibold text-slate-900">{item.title}</p>
            <p className="text-sm text-slate-600">{item.description}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}
