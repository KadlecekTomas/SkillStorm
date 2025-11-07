"use client";

import type { ContentItem } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

type ContentLibraryListProps = {
  items: ContentItem[];
};

export const ContentLibraryList = ({ items }: ContentLibraryListProps) => (
  <div className="grid gap-4 md:grid-cols-2">
    {items.map((item) => (
      <motion.div key={item.id} whileHover={{ y: -4 }}>
        <Card className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{item.updatedAt ?? "Recently added"}</span>
            <Badge variant="neutral">{item.grade}</Badge>
          </div>
          <div>
            <p className="text-sm text-slate-500">{item.subject}</p>
            <p className="text-lg font-semibold text-slate-900">
              {item.title}
            </p>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Curriculum ready</span>
            <Button variant="outline" size="sm">
              Open
            </Button>
          </div>
        </Card>
      </motion.div>
    ))}
  </div>
);
