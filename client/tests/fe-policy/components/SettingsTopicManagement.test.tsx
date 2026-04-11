/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SettingsPage from "@/app/(school)/app/settings/page";
import { PermissionKey } from "@/types";

type TopicFixture = {
  id: string;
  subjectLevelId: string;
  catalogTopicId: string;
  name: string | null;
  order: number | null;
  phase: string | null;
  catalogTopic: { id: string; name: string } | null;
};

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    org: { id: "org-1", name: "Demo School" },
    hasOrganization: true,
  }),
}));

const permissionsState: { can: (key: PermissionKey) => boolean } = {
  can: (key: PermissionKey) => key === PermissionKey.MANAGE_TEACHERS,
};

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => permissionsState,
}));

let subjectTopics: TopicFixture[] = [
  {
    id: "topic-level-1",
    subjectLevelId: "level-5",
    catalogTopicId: "catalog-topic-1",
    name: "Úvod do zlomků",
    order: 1,
    phase: "INTRO",
    catalogTopic: { id: "catalog-topic-1", name: "Zlomky" },
  },
];

const fetchWithAuthMock = vi.fn(async (method: string, path: string, config?: { body?: unknown }) => {
  if (method === "GET" && path === "/org-subjects?includeDisabled=true") {
    return [
      {
        id: "org-subject-1",
        organizationId: "org-1",
        isEnabled: true,
        isCustom: false,
        subject: {
          id: "subject-1",
          name: "Matematika",
          gradeFrom: 1,
          gradeTo: 9,
        },
      },
    ];
  }
  if (method === "GET" && path === "/subjects?limit=200&includeInactive=true&includeLevels=true") {
    return [
      {
        id: "subject-1",
        name: "Matematika",
        catalogSubjectId: "catalog-subject-1",
        catalogSubject: { id: "catalog-subject-1", code: "MATH", name: "Matematika" },
        deletedAt: null,
        levels: [
          {
            id: "level-5",
            subjectId: "subject-1",
            grade: "GRADE_5",
            isEnabled: true,
            order: null,
            label: null,
          },
        ],
      },
    ];
  }
  if (method === "GET" && path === "/subjects/subject-1/topics") {
    return subjectTopics;
  }
  if (method === "GET" && path === "/topics/catalog/subjects/catalog-subject-1/topics") {
    return [
      { id: "catalog-topic-1", name: "Zlomky" },
      { id: "catalog-topic-2", name: "Desetinná čísla" },
    ];
  }
  if (method === "POST" && path === "/topics") {
    const body = (config?.body ?? {}) as { subjectLevelId: string; catalogTopicId: string; name?: string; order?: number };
    subjectTopics = [
      ...subjectTopics,
      {
        id: "topic-level-2",
        subjectLevelId: body.subjectLevelId,
        catalogTopicId: body.catalogTopicId,
        name: body.name ?? null,
        order: body.order ?? null,
        phase: "INTRO",
        catalogTopic: { id: body.catalogTopicId, name: body.catalogTopicId === "catalog-topic-2" ? "Desetinná čísla" : "Zlomky" },
      },
    ];
    return { id: "topic-level-2" };
  }
  return {};
});

vi.mock("@/lib/http/client", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetchWithAuthMock>) => fetchWithAuthMock(...args),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("SettingsPage topic management", () => {
  beforeEach(() => {
    permissionsState.can = (key: PermissionKey) => key === PermissionKey.MANAGE_TEACHERS;
    subjectTopics = [
      {
        id: "topic-level-1",
        subjectLevelId: "level-5",
        catalogTopicId: "catalog-topic-1",
        name: "Úvod do zlomků",
        order: 1,
        phase: "INTRO",
        catalogTopic: { id: "catalog-topic-1", name: "Zlomky" },
      },
    ];
    fetchWithAuthMock.mockClear();
  });

  it("renders topic management for enabled catalog subjects", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText(/témata předmětů/i)).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Úvod do zlomků")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Úvod do zlomků")).toBeInTheDocument();
  });

  it("creates a topic level for the selected subject grade", async () => {
    render(<SettingsPage />);

    await screen.findByText(/témata předmětů/i);
    await waitFor(() =>
      expect(screen.getByLabelText("Katalogové téma")).toHaveValue("catalog-topic-1"),
    );
    fireEvent.change(screen.getByLabelText("Katalogové téma"), {
      target: { value: "catalog-topic-2" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Katalogové téma")).toHaveValue("catalog-topic-2"),
    );
    fireEvent.change(screen.getByLabelText("Vlastní název tématu"), {
      target: { value: "Desetinná čísla - úvod" },
    });
    fireEvent.change(screen.getByLabelText("Pořadí tématu"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /přidat téma/i }));

    await waitFor(() =>
      expect(fetchWithAuthMock).toHaveBeenCalledWith("POST", "/topics", {
        body: {
          subjectLevelId: "level-5",
          catalogTopicId: "catalog-topic-2",
          name: "Desetinná čísla - úvod",
          order: 2,
        },
      }),
    );
    expect(await screen.findByDisplayValue("Desetinná čísla - úvod")).toBeInTheDocument();
  });
});
