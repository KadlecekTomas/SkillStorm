/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlatformCatalogPage from "@/app/(platform)/app/platform/catalog/page";
import type { RequestConfig } from "@/lib/http/client";
import { queryClient } from "@/lib/query-client";
import { httpClient } from "@/lib/http/client";

vi.mock("@/utils/toast", () => ({
  showToastOnce: vi.fn(),
  showHttpErrorToastOnce: vi.fn(),
}));

vi.mock("@/lib/http/client", () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

type Subject = {
  id: string;
  code: string;
  name: string;
  topicCount: number;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
};

type Topic = {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  name: string;
  order: number | null;
  usageCount: number;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
};

type ListResponse<T> = {
  items: T[];
  meta: { page: number; limit: number; total: number; pages: number };
};

type SubjectCreateInput = { code: string; name: string };
type TopicCreateInput = { subjectId: string; name: string; order?: number };
type TopicUpdateInput = { name?: string; order?: number; isActive?: boolean };
type SubjectUpdateInput = { code?: string; name?: string; isActive?: boolean };

describe("Platform catalog page", () => {
  let subjects: Subject[];
  let topics: Topic[];

  beforeEach(() => {
    queryClient.clear();
    subjects = [
      {
        id: "subject-1",
        code: "MATH",
        name: "Mathematics",
        topicCount: 2,
        isActive: true,
        deletedAt: null,
        createdAt: "2026-04-12T10:00:00.000Z",
      },
      {
        id: "subject-2",
        code: "SCI",
        name: "Science",
        topicCount: 1,
        isActive: true,
        deletedAt: null,
        createdAt: "2026-04-12T10:00:00.000Z",
      },
    ];
    topics = [
      {
        id: "topic-1",
        subjectId: "subject-1",
        subjectName: "Mathematics",
        subjectCode: "MATH",
        name: "Fractions",
        order: 1,
        usageCount: 4,
        isActive: true,
        deletedAt: null,
        createdAt: "2026-04-12T10:00:00.000Z",
      },
      {
        id: "topic-2",
        subjectId: "subject-2",
        subjectName: "Science",
        subjectCode: "SCI",
        name: "Plants",
        order: 2,
        usageCount: 1,
        isActive: true,
        deletedAt: null,
        createdAt: "2026-04-12T10:00:00.000Z",
      },
    ];

    vi.mocked(httpClient.get).mockImplementation(
      async (
        path: string,
        config?: RequestConfig,
      ): Promise<ListResponse<Subject> | ListResponse<Topic>> => {
        if (path === "/platform/catalog/subjects") {
          const search = String(config?.query?.search ?? "").toLowerCase();
          const items = subjects.filter(
            (item) =>
              !search ||
              item.name.toLowerCase().includes(search) ||
              item.code.toLowerCase().includes(search),
          );
          return {
            items,
            meta: { page: 1, limit: 10, total: items.length, pages: 1 },
          };
        }
        if (path === "/platform/catalog/topics") {
          const search = String(config?.query?.search ?? "").toLowerCase();
          const subjectId = String(config?.query?.subjectId ?? "");
          const items = topics.filter(
            (item) =>
              (!search || item.name.toLowerCase().includes(search)) &&
              (!subjectId || item.subjectId === subjectId),
          );
          return {
            items,
            meta: { page: 1, limit: 10, total: items.length, pages: 1 },
          };
        }
        throw new Error(`Unexpected GET ${path}`);
      },
    );

    vi.mocked(httpClient.post).mockImplementation(
      async (path: string, body?: unknown): Promise<{ ok: true }> => {
        if (path === "/platform/catalog/subjects") {
          const nextBody = body as SubjectCreateInput;
          subjects = [
            ...subjects,
            {
              id: "subject-new",
              code: nextBody.code.trim().toUpperCase(),
              name: nextBody.name.trim(),
              topicCount: 0,
              isActive: true,
              deletedAt: null,
              createdAt: "2026-04-12T10:00:00.000Z",
            },
          ];
          return { ok: true };
        }
        if (path === "/platform/catalog/topics") {
          const nextBody = body as TopicCreateInput;
          const subject = subjects.find(
            (item) => item.id === nextBody.subjectId,
          )!;
          topics = [
            ...topics,
            {
              id: "topic-new",
              subjectId: nextBody.subjectId,
              subjectName: subject.name,
              subjectCode: subject.code,
              name: nextBody.name.trim(),
              order: nextBody.order ?? null,
              usageCount: 0,
              isActive: true,
              deletedAt: null,
              createdAt: "2026-04-12T10:00:00.000Z",
            },
          ];
          return { ok: true };
        }
        throw new Error(`Unexpected POST ${path}`);
      },
    );

    vi.mocked(httpClient.patch).mockImplementation(
      async (path: string, body?: unknown): Promise<{ ok: true }> => {
        if (path.startsWith("/platform/catalog/topics/")) {
          const nextBody = body as TopicUpdateInput;
          const id = path.split("/").pop()!;
          topics = topics.map((item) =>
            item.id === id
              ? {
                  ...item,
                  name: nextBody.name ?? item.name,
                  order: nextBody.order ?? item.order,
                  isActive: nextBody.isActive ?? item.isActive,
                }
              : item,
          );
          return { ok: true };
        }
        if (path.startsWith("/platform/catalog/subjects/")) {
          const nextBody = body as SubjectUpdateInput;
          const id = path.split("/").pop()!;
          subjects = subjects.map((item) =>
            item.id === id
              ? {
                  ...item,
                  code: nextBody.code ?? item.code,
                  name: nextBody.name ?? item.name,
                  isActive: nextBody.isActive ?? item.isActive,
                }
              : item,
          );
          return { ok: true };
        }
        throw new Error(`Unexpected PATCH ${path}`);
      },
    );

    vi.mocked(httpClient.delete).mockResolvedValue({ ok: true });
  });

  it("renders the page", async () => {
    render(<PlatformCatalogPage />);

    expect(await screen.findByText("Catalog Management")).toBeInTheDocument();
    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
  });

  it("creates a subject", async () => {
    render(<PlatformCatalogPage />);

    fireEvent.change(await screen.findByLabelText("Subject code"), {
      target: { value: "eng" },
    });
    fireEvent.change(screen.getByLabelText("Subject name"), {
      target: { value: "English" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create subject" }));

    await waitFor(() =>
      expect(httpClient.post).toHaveBeenCalledWith(
        "/platform/catalog/subjects",
        {
          code: "eng",
          name: "English",
        },
      ),
    );
    await waitFor(() =>
      expect(screen.getByText("English")).toBeInTheDocument(),
    );
  });

  it("filters topics", async () => {
    const user = userEvent.setup();
    render(<PlatformCatalogPage />);

    await user.click(screen.getByRole("tab", { name: "Topics" }));
    fireEvent.change(await screen.findByLabelText("Search topics"), {
      target: { value: "plant" },
    });

    await waitFor(() =>
      expect(httpClient.get).toHaveBeenCalledWith(
        "/platform/catalog/topics",
        expect.objectContaining({
          query: expect.objectContaining({ search: "plant" }),
        }),
      ),
    );
    expect(await screen.findByText("Plants")).toBeInTheDocument();
    expect(screen.queryByText("Fractions")).not.toBeInTheDocument();
  });

  it("edits a topic", async () => {
    const user = userEvent.setup();
    render(<PlatformCatalogPage />);

    await user.click(screen.getByRole("tab", { name: "Topics" }));
    await user.click(
      await screen
        .findAllByRole("button", { name: "Edit" })
        .then((buttons) => buttons[0]!),
    );
    fireEvent.change(screen.getByLabelText("Edit topic Fractions"), {
      target: { value: "Advanced Fractions" },
    });
    fireEvent.change(screen.getByLabelText("Edit order Fractions"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(httpClient.patch).toHaveBeenCalledWith(
        "/platform/catalog/topics/topic-1",
        {
          name: "Advanced Fractions",
          order: 7,
        },
      ),
    );
    await waitFor(() =>
      expect(screen.getByText("Advanced Fractions")).toBeInTheDocument(),
    );
  });

  it("toggles subject active state", async () => {
    render(<PlatformCatalogPage />);

    const toggle = await screen.findByLabelText("Toggle Mathematics");
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(httpClient.patch).toHaveBeenCalledWith(
        "/platform/catalog/subjects/subject-1",
        {
          isActive: false,
        },
      ),
    );
  });
});
