"use client";

import type { Classroom } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users2 } from "lucide-react";
import { motion } from "framer-motion";

type ClassroomListProps = {
  classrooms: Classroom[];
  onCreate?: () => void;
};

export const ClassroomList = ({ classrooms, onCreate }: ClassroomListProps) => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Classrooms</h2>
        <p className="text-sm text-slate-500">
          Manage roster, attendance and group performance.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Users2 className="h-4 w-4" />
        Create class
      </Button>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {classrooms.map((classroom) => (
        <motion.div key={classroom.id} whileHover={{ y: -4 }}>
          <Card className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{classroom.subject}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {classroom.name}
                </p>
              </div>
              <Badge variant="neutral">{classroom.grade}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <div>
                <p className="text-xs uppercase tracking-wide">Students</p>
                <p className="text-lg font-semibold text-slate-900">
                  {classroom.students}
                </p>
              </div>
              <p>Updated {classroom.updatedAt}</p>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  </div>
);
