"use client";

import type { ContentItem } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

type ContentLibraryListProps = {
  items: ContentItem[];
};

/** Subject přichází z API jako objekt relace; string drží starší mock data. */
export const subjectLabel = (subject: ContentItem["subject"]): string =>
  typeof subject === "string" ? subject : (subject?.name ?? "Obecné");

export const ContentLibraryList = ({ items }: ContentLibraryListProps): React.JSX.Element => (
  <div className="grid gap-4 md:grid-cols-2">
    {items.map((item) => (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <Card className="space-y-3 rounded-2xl border border-slate-100 p-5 shadow-soft">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="truncate">
              {item.updatedAt ?? "Recently synced"}
            </span>
            <Badge variant="neutral">
              {item.scope === "GLOBAL" ? "Global" : "Org"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-slate-500">{subjectLabel(item.subject)}</p>
            <p className="text-lg font-semibold text-slate-900 line-clamp-2">
              {item.title}
            </p>
            {item.description && (
              <p className="text-sm text-slate-500 line-clamp-2">
                {item.description}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span className="capitalize">{item.contentType.toLowerCase()}</span>
            <Button variant="outline" size="sm" className="rounded-full px-4">
              Open
            </Button>
          </div>
        </Card>
      </motion.div>
    ))}
  </div>
);
