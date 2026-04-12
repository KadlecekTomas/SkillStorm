"use client";

import { useState } from "react";
import { BookCopy, Search } from "lucide-react";
import { SubjectForm } from "@/components/platform/catalog/subject-form";
import { SubjectTable } from "@/components/platform/catalog/subject-table";
import { TopicForm } from "@/components/platform/catalog/topic-form";
import { TopicTable } from "@/components/platform/catalog/topic-table";
import { useCatalogSubjects } from "@/hooks/use-catalog-subjects";
import { useCatalogTopics } from "@/hooks/use-catalog-topics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { showHttpErrorToastOnce, showToastOnce } from "@/utils/toast";

const PAGE_LIMIT = 10;

export function CatalogPage(): React.JSX.Element {
  const [tab, setTab] = useState("subjects");

  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectPage, setSubjectPage] = useState(1);
  const [subjectIncludeInactive, setSubjectIncludeInactive] = useState(false);
  const [subjectSortBy, setSubjectSortBy] = useState<
    "name" | "code" | "createdAt"
  >("name");
  const [subjectSortDir, setSubjectSortDir] = useState<"asc" | "desc">("asc");
  const [subjectSavingId, setSubjectSavingId] = useState<string | null>(null);
  const [subjectCreating, setSubjectCreating] = useState(false);

  const [topicSearch, setTopicSearch] = useState("");
  const [topicPage, setTopicPage] = useState(1);
  const [topicIncludeInactive, setTopicIncludeInactive] = useState(false);
  const [topicSubjectId, setTopicSubjectId] = useState<string>("");
  const [topicSavingId, setTopicSavingId] = useState<string | null>(null);
  const [topicCreating, setTopicCreating] = useState(false);

  const subjects = useCatalogSubjects({
    search: subjectSearch,
    page: subjectPage,
    limit: PAGE_LIMIT,
    includeInactive: subjectIncludeInactive,
    sortBy: subjectSortBy,
    sortDir: subjectSortDir,
  });
  const topics = useCatalogTopics({
    search: topicSearch,
    page: topicPage,
    limit: PAGE_LIMIT,
    includeInactive: topicIncludeInactive,
    ...(topicSubjectId ? { subjectId: topicSubjectId } : {}),
  });

  const handleCreateSubject = async (input: { code: string; name: string }) => {
    setSubjectCreating(true);
    try {
      await subjects.createSubject(input);
      showToastOnce("Catalog subject created.", { type: "success" });
    } catch (error) {
      showHttpErrorToastOnce(error);
    } finally {
      setSubjectCreating(false);
    }
  };

  const handleUpdateSubject = async (
    id: string,
    input: { code?: string; name?: string; isActive?: boolean },
  ) => {
    setSubjectSavingId(id);
    try {
      await subjects.updateSubject(id, input);
      showToastOnce("Catalog subject updated.", { type: "success" });
    } catch (error) {
      showHttpErrorToastOnce(error);
    } finally {
      setSubjectSavingId(null);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    setSubjectSavingId(id);
    try {
      await subjects.deleteSubject(id);
      showToastOnce("Catalog subject removed.", { type: "success" });
    } catch (error) {
      showHttpErrorToastOnce(error);
    } finally {
      setSubjectSavingId(null);
    }
  };

  const handleCreateTopic = async (input: {
    subjectId: string;
    name: string;
    order?: number;
  }) => {
    setTopicCreating(true);
    try {
      await topics.createTopic(input);
      showToastOnce("Catalog topic created.", { type: "success" });
    } catch (error) {
      showHttpErrorToastOnce(error);
    } finally {
      setTopicCreating(false);
    }
  };

  const handleUpdateTopic = async (
    id: string,
    input: { name?: string; order?: number; isActive?: boolean },
  ) => {
    setTopicSavingId(id);
    try {
      await topics.updateTopic(id, input);
      showToastOnce("Catalog topic updated.", { type: "success" });
    } catch (error) {
      showHttpErrorToastOnce(error);
    } finally {
      setTopicSavingId(null);
    }
  };

  const handleDeleteTopic = async (id: string) => {
    setTopicSavingId(id);
    try {
      await topics.deleteTopic(id);
      showToastOnce("Catalog topic removed.", { type: "success" });
    } catch (error) {
      showHttpErrorToastOnce(error);
    } finally {
      setTopicSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <BookCopy className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Catalog Management
          </h1>
          <p className="text-sm text-slate-500">
            Manage global catalog subjects and topics for every school.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="topics">Topics</TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Catalog Subjects</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto] md:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  aria-label="Search subjects"
                  className="pl-9"
                  placeholder="Search by name or code"
                  value={subjectSearch}
                  onChange={(event) => {
                    setSubjectSearch(event.target.value);
                    setSubjectPage(1);
                  }}
                />
              </div>
              <Select
                value={subjectSortBy}
                onValueChange={(value) =>
                  setSubjectSortBy(value as "name" | "code" | "createdAt")
                }
              >
                <SelectTrigger aria-label="Sort subjects by">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort by name</SelectItem>
                  <SelectItem value="code">Sort by code</SelectItem>
                  <SelectItem value="createdAt">
                    Sort by created date
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={subjectSortDir}
                onValueChange={(value) =>
                  setSubjectSortDir(value as "asc" | "desc")
                }
              >
                <SelectTrigger aria-label="Sort subjects direction">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center justify-end gap-3 text-sm text-slate-600">
                <span>Include inactive</span>
                <Switch
                  checked={subjectIncludeInactive}
                  onCheckedChange={setSubjectIncludeInactive}
                />
              </label>
            </CardContent>
          </Card>

          <SubjectForm
            loading={subjectCreating}
            onSubmit={handleCreateSubject}
          />
          <SubjectTable
            items={subjects.items}
            meta={subjects.meta}
            loading={subjects.isLoading}
            savingId={subjectSavingId}
            onPageChange={setSubjectPage}
            onSave={handleUpdateSubject}
            onDelete={handleDeleteSubject}
          />
        </TabsContent>

        <TabsContent value="topics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Catalog Topics</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  aria-label="Search topics"
                  className="pl-9"
                  placeholder="Search topics"
                  value={topicSearch}
                  onChange={(event) => {
                    setTopicSearch(event.target.value);
                    setTopicPage(1);
                  }}
                />
              </div>
              <Select
                value={topicSubjectId || "all"}
                onValueChange={(value) => {
                  setTopicSubjectId(value === "all" ? "" : value);
                  setTopicPage(1);
                }}
              >
                <SelectTrigger aria-label="Filter topics by subject">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {subjects.items.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.code} · {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center justify-end gap-3 text-sm text-slate-600">
                <span>Include inactive</span>
                <Switch
                  checked={topicIncludeInactive}
                  onCheckedChange={setTopicIncludeInactive}
                />
              </label>
            </CardContent>
          </Card>

          <TopicForm
            loading={topicCreating}
            subjects={subjects.items.filter((item) => item.isActive)}
            {...(topicSubjectId ? { selectedSubjectId: topicSubjectId } : {})}
            onSubmit={handleCreateTopic}
          />
          <TopicTable
            items={topics.items}
            meta={topics.meta}
            loading={topics.isLoading}
            savingId={topicSavingId}
            onPageChange={setTopicPage}
            onSave={handleUpdateTopic}
            onDelete={handleDeleteTopic}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
