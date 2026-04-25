import { ContentLibraryList } from "@/components/content/content-library-list";
import type { ContentItem } from "@/types";

export default function PublicLibraryPage(): React.JSX.Element {
  const demoItems: ContentItem[] = [];
  return (
    <div className="min-h-screen bg-secondary px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="text-center">
          <p className="text-sm uppercase tracking-wide text-primary">SkillStorm Library</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Curated teaching resources
          </h1>
          <p className="mt-2 text-slate-500">
            Browse featured content before signing in.
          </p>
        </div>
        <ContentLibraryList items={demoItems} />
      </div>
    </div>
  );
}
