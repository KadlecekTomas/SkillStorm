/* eslint-disable */
/**
 * Generated from server/openapi.json.
 * Do not edit manually. Regenerate with: npm run generate:api
 *
 * Note:
 * The current OpenAPI spec contains request DTO schemas, but most responses are not typed.
 * Those endpoints are therefore generated with Promise<unknown> response types.
 */

import { request } from "@/lib/http/client";

const encodePathSegment = (value: string | number | boolean): string =>
  encodeURIComponent(String(value));

const buildRequestConfig = <TBody>(
  config: {
    query?: Record<string, unknown> | undefined;
    body?: TBody | undefined;
    signal?: AbortSignal | undefined;
    headers?: Record<string, string> | undefined;
  },
): {
  query?: Record<string, string | number | boolean | undefined>;
  body?: TBody;
  signal?: AbortSignal;
  headers?: Record<string, string>;
} => {
  const next: {
    query?: Record<string, string | number | boolean | undefined>;
    body?: TBody;
    signal?: AbortSignal;
    headers?: Record<string, string>;
  } = {};

  if (config.query !== undefined) {
    const normalizedQuery: Record<string, string | number | boolean | undefined> = {};
    for (const [key, value] of Object.entries(config.query)) {
      if (value === undefined) {
        normalizedQuery[key] = undefined;
        continue;
      }
      if (Array.isArray(value)) {
        normalizedQuery[key] = value.join(",");
        continue;
      }
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        normalizedQuery[key] = value;
        continue;
      }
      normalizedQuery[key] = JSON.stringify(value);
    }
    next.query = normalizedQuery;
  }
  if (config.body !== undefined) next.body = config.body;
  if (config.signal !== undefined) next.signal = config.signal;
  if (config.headers !== undefined) next.headers = config.headers;

  return next;
};

export type RegisterDto = {
  /**
   * Jméno uživatele
   */
  name: string;
  /**
   * E-mail (volitelné – může být null)
   */
  email?: string;
  /**
   * Uživatelské jméno (volitelné; když nepřijde, vygeneruje se)
   */
  username?: string;
  /**
   * Heslo
   */
  password: string;
  /**
   * Systémová role
   */
  systemRole?: "SUPERADMIN";
};

export type LoginDto = {
  /**
   * Username nebo e-mail
   */
  login: string;
  /**
   * Heslo
   */
  password: string;
};

export type RefreshTokenDto = {
  /**
   * The refresh token issued during login
   */
  refreshToken: string;
};

export type CreateTeacherDto = {
  membershipId: string;
  organizationId: string;
};

export type UpdateTeacherDto = {
  membershipId?: string;
  organizationId?: string;
};

export type AssignSubjectsDto = {
  subjectIds: Array<string>;
  /**
   * Pokud true: nahradí existující přiřazení (tj. odstraní ostatní). Pokud false/nezadáno: pouze přidá chybějící.
   */
  replaceAll?: boolean;
};

export type CreateUserDto = {
  email: string;
  username?: string;
  name: string;
  password: string;
  /**
   * Povoleno nastavovat pouze SUPERADMINovi
   */
  systemRole?: "SUPERADMIN";
  preferredLang?: string;
};

export type UpdateUserDto = {
  email?: string;
  username?: string;
  name?: string;
  password?: string;
  /**
   * Povoleno měnit pouze SUPERADMINovi
   */
  systemRole?: "SUPERADMIN";
  preferredLang?: string;
};

export type CreateOrganizationDto = {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  /**
   * Typ organizace (SCHOOL, PRIVATE, COMMUNITY)
   */
  type?: "SCHOOL" | "PRIVATE" | "COMMUNITY";
};

export type UpdateOrganizationDto = {
  /**
   * Nový název organizace
   */
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  /**
   * Změna typu organizace (SCHOOL, PRIVATE, COMMUNITY)
   */
  type?: "SCHOOL" | "PRIVATE" | "COMMUNITY";
};

export type CreateMembershipDto = {
  userId: string;
  organizationId: string;
  role: "STUDENT" | "TEACHER" | "DIRECTOR";
};

export type UpdateMembershipDto = {
  role: "STUDENT" | "TEACHER" | "DIRECTOR";
};

export type CreateClassSectionDto = {
  /**
   * ID školního roku (AcademicYear)
   */
  yearId: string;
  /**
   * Ročník třídy (např. PRIMARY_1, PRIMARY_2...)
   */
  grade: string;
  /**
   * Označení sekce (A, B, C...)
   */
  section: string;
  /**
   * Celé označení třídy
   */
  label: string;
  /**
   * Studijní obor (volitelné)
   */
  studyField?: string;
  /**
   * Učitel třídní (volitelné)
   */
  teacherId?: string;
};

export type UpdateClassroomDto = {
  /**
   * ID školního roku (AcademicYear)
   */
  yearId?: string;
  /**
   * Ročník třídy (např. PRIMARY_1, PRIMARY_2...)
   */
  grade?: string;
  /**
   * Označení sekce (A, B, C...)
   */
  section?: string;
  /**
   * Celé označení třídy
   */
  label?: string;
  /**
   * Studijní obor (volitelné)
   */
  studyField?: string;
  /**
   * Učitel třídní (volitelné)
   */
  teacherId?: string;
};

export type CreateSubjectDto = {
  name: string;
  organizationId: string;
  catalogSubjectId?: string;
};

export type UpdateSubjectDto = {
  name?: string;
  catalogSubjectId?: string;
};

export type CreateStudentDto = {
  membershipId: string;
  orgId: string;
  studentNumber?: string;
  externalId?: string;
};

export type UpdateStudentDto = {
  studentNumber?: string;
  externalId?: string;
};

export type CreateTopicDto = {
  name: string;
  /**
   * ID SubjectLevel (předmět × ročník)
   */
  subjectLevelId: string;
  /**
   * ID CatalogTopic (globální katalog)
   */
  catalogTopicId: string;
  phase?: "INTRO" | "DEEPEN" | "RECAP" | "EXTENSION";
  difficulty?: "BASIC" | "INTERMEDIATE" | "ADVANCED";
  order?: number;
};

export type UpdateTopicDto = {
  name?: string;
  /**
   * ID SubjectLevel (předmět × ročník)
   */
  subjectLevelId?: string;
  /**
   * ID CatalogTopic (globální katalog)
   */
  catalogTopicId?: string;
  phase?: "INTRO" | "DEEPEN" | "RECAP" | "EXTENSION";
  difficulty?: "BASIC" | "INTERMEDIATE" | "ADVANCED";
  order?: number;
};

export type AssignMaterialsDto = {
  materialIds: Array<string>;
  /**
   * true = nahradí existující přiřazení
   */
  replaceAll?: boolean;
};

export type AssignTestsDto = {
  testIds: Array<string>;
  /**
   * true = nahradí existující přiřazení
   */
  replaceAll?: boolean;
};

export type SetHomeroomDto = {
  /**
   * Učitel, který bude třídní. Pokud undefined/null → třídnictví se zruší.
   */
  teacherId?: string | null;
};

export type MaterializeSubjectDto = {
  organizationId: string;
  nameOverride?: string;
  createLevelsForGrades?: Array<"GRADE_1" | "GRADE_2" | "GRADE_3" | "GRADE_4" | "GRADE_5" | "GRADE_6" | "GRADE_7" | "GRADE_8" | "GRADE_9" | "HIGH_SCHOOL_YEAR_1" | "HIGH_SCHOOL_YEAR_2" | "HIGH_SCHOOL_YEAR_3" | "HIGH_SCHOOL_YEAR_4">;
};

export type MaterializeTopicDto = {
  subjectLevelId: string;
  phase?: "INTRO" | "DEEPEN" | "RECAP" | "EXTENSION";
  difficulty?: "BASIC" | "INTERMEDIATE" | "ADVANCED";
  order?: number;
};

export type MaterializeTopicsBulkDto = {
  catalogSubjectId: string;
  subjectLevelId: string;
  catalogTopicIds: Array<string>;
  defaultPhase?: "INTRO" | "DEEPEN" | "RECAP" | "EXTENSION";
  defaultDifficulty?: "BASIC" | "INTERMEDIATE" | "ADVANCED";
  appendAfter?: number;
};

export type CreateCatalogSubjectDto = {
  code: string;
  name: string;
};

export type UpdateCatalogSubjectDto = {
  code?: string;
  name?: string;
};

export type CreateCatalogTopicDto = {
  subjectId: string;
  name: string;
};

export type UpdateCatalogTopicDto = {
  subjectId?: string;
  name?: string;
};

export type CreateLearningMaterialDto = {
  title: string;
  description?: string;
  contentType: "MATERIAL" | "PRACTICE" | "TEST" | "VIDEO" | "LINK";
  educationLevel: "PRIMARY_1" | "PRIMARY_2" | "SECONDARY_MATURITA" | "SECONDARY_VOCATIONAL";
  schoolGrade?: "GRADE_1" | "GRADE_2" | "GRADE_3" | "GRADE_4" | "GRADE_5" | "GRADE_6" | "GRADE_7" | "GRADE_8" | "GRADE_9" | "HIGH_SCHOOL_YEAR_1" | "HIGH_SCHOOL_YEAR_2" | "HIGH_SCHOOL_YEAR_3" | "HIGH_SCHOOL_YEAR_4";
  /**
   * Subject ID (volitelné)
   */
  subjectId?: string;
  /**
   * TopicLevel ID (volitelné)
   */
  topicLevelId?: string;
  scope?: "GLOBAL" | "ORGANIZATION" | "SHARED";
  /**
   * Organization ID – povinné, pokud scope=ORGANIZATION
   */
  organizationId?: string;
  accessLevel?: "FREE" | "SCHOOL_ONLY" | "PAID";
  price?: number;
  isDownloadable?: boolean;
};

export type UpdateLearningMaterialDto = {
  title?: string;
  description?: string;
  contentType?: "MATERIAL" | "PRACTICE" | "TEST" | "VIDEO" | "LINK";
  educationLevel?: "PRIMARY_1" | "PRIMARY_2" | "SECONDARY_MATURITA" | "SECONDARY_VOCATIONAL";
  schoolGrade?: "GRADE_1" | "GRADE_2" | "GRADE_3" | "GRADE_4" | "GRADE_5" | "GRADE_6" | "GRADE_7" | "GRADE_8" | "GRADE_9" | "HIGH_SCHOOL_YEAR_1" | "HIGH_SCHOOL_YEAR_2" | "HIGH_SCHOOL_YEAR_3" | "HIGH_SCHOOL_YEAR_4";
  /**
   * Subject ID (volitelné)
   */
  subjectId?: string;
  /**
   * TopicLevel ID (volitelné)
   */
  topicLevelId?: string;
  scope?: "GLOBAL" | "ORGANIZATION" | "SHARED";
  /**
   * Organization ID – povinné, pokud scope=ORGANIZATION
   */
  organizationId?: string;
  accessLevel?: "FREE" | "SCHOOL_ONLY" | "PAID";
  price?: number;
  isDownloadable?: boolean;
};

export type CreateTestDto = {
  title: string;
  description?: string;
  /**
   * Cílová organizace
   */
  organizationId: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

export type UpdateTestDto = {
  title?: string;
  description?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

export type ReorderQuestionsDto = Record<string, unknown>;

export type CreateQuestionDto = {
  text: string;
  type: "FILL_IN_THE_BLANK" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  order?: number;
};

export type UpdateQuestionDto = {
  text?: string;
  type?: "FILL_IN_THE_BLANK" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  order?: number;
};

export type CreateOptionDto = {
  text: string;
};

export type UpdateOptionDto = {
  text?: string;
};

export type CreateAnswerDto = {
  text: string;
};

export type UpdateAnswerDto = {
  text?: string;
};

export type AuthControllerRegisterRequest = {
  body: RegisterDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Register a new user
 */
export async function authControllerRegister(params: AuthControllerRegisterRequest): Promise<unknown> {
  return request<unknown, RegisterDto>("POST", "/auth/register", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type AuthControllerLoginRequest = {
  body: LoginDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Login user
 */
export async function authControllerLogin(params: AuthControllerLoginRequest): Promise<unknown> {
  return request<unknown, LoginDto>("POST", "/auth/login", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type AuthControllerRefreshRequest = {
  body: RefreshTokenDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Refresh access token
 */
export async function authControllerRefresh(params: AuthControllerRefreshRequest): Promise<unknown> {
  return request<unknown, RefreshTokenDto>("POST", "/auth/refresh", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type AuthControllerLogoutRequest = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function authControllerLogout(params?: AuthControllerLogoutRequest): Promise<unknown> {
  return request<unknown, unknown>("POST", "/auth/logout", buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type AuthControllerMeRequest = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Get current user profile
 */
export async function authControllerMe(params?: AuthControllerMeRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/auth/me", buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TeachersControllerFindAllRequest = {
  query?: {
    /**
     * ID organizace, ve které listujeme učitele
     */
    organizationId?: string;
    page?: number;
    limit?: number;
    /**
     * Fulltext (jméno, email, uživatelské jméno)
     */
    search?: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * List teachers (org‑scoped for director)
 */
export async function teachersControllerFindAll(params?: TeachersControllerFindAllRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/teachers", buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TeachersControllerCreateRequest = {
  body: CreateTeacherDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Create teacher (director or superadmin)
 */
export async function teachersControllerCreate(params: TeachersControllerCreateRequest): Promise<unknown> {
  return request<unknown, CreateTeacherDto>("POST", "/teachers", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TeachersControllerFindOneRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Get teacher detail
 */
export async function teachersControllerFindOne(params: TeachersControllerFindOneRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/teachers/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TeachersControllerUpdateRequest = {
  path: {
    id: string;
  };
  body: UpdateTeacherDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Update teacher (director or superadmin)
 */
export async function teachersControllerUpdate(params: TeachersControllerUpdateRequest): Promise<unknown> {
  return request<unknown, UpdateTeacherDto>("PATCH", `/teachers/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TeachersControllerRemoveRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Soft delete teacher (director or superadmin)
 */
export async function teachersControllerRemove(params: TeachersControllerRemoveRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/teachers/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TeachersControllerAssignSubjectsRequest = {
  path: {
    id: string;
  };
  body: AssignSubjectsDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Přiřadit předměty učiteli (bulk add/replace)
 */
export async function teachersControllerAssignSubjects(params: TeachersControllerAssignSubjectsRequest): Promise<unknown> {
  return request<unknown, AssignSubjectsDto>("POST", `/teachers/${encodePathSegment(params.path.id)}/subjects`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TeachersControllerRemoveSubjectRequest = {
  path: {
    id: string;
    subjectId: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Odebrat jedno přiřazení předmětu učiteli
 */
export async function teachersControllerRemoveSubject(params: TeachersControllerRemoveSubjectRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/teachers/${encodePathSegment(params.path.id)}/subjects/${encodePathSegment(params.path.subjectId)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type UsersControllerFindAllRequest = {
  query?: {
    page?: number;
    limit?: number;
    /**
     * Fulltext: name, email, username
     */
    search?: string;
    /**
     * Filtrovat dle organizace (povoleno jen SUPERADMINovi). Ředitel má implicitně vlastní org.
     */
    organizationId?: string;
    /**
     * Filtrovat dle organizační role (přes Memberships)
     */
    hasOrgRole?: "STUDENT" | "TEACHER" | "DIRECTOR";
    /**
     * Řazení podle pole
     */
    orderBy?: "name" | "email" | "username" | "lastLoginAt";
    /**
     * Směr řazení
     */
    orderDir?: "asc" | "desc";
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * List users (search, filters, pagination, sorting)
 */
export async function usersControllerFindAll(params?: UsersControllerFindAllRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/users", buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type UsersControllerCreateRequest = {
  body: CreateUserDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Create user (SUPERADMIN only)
 */
export async function usersControllerCreate(params: UsersControllerCreateRequest): Promise<unknown> {
  return request<unknown, CreateUserDto>("POST", "/users", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type UsersControllerFindOneRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function usersControllerFindOne(params: UsersControllerFindOneRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/users/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type UsersControllerUpdateRequest = {
  path: {
    id: string;
  };
  body: UpdateUserDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Update user (self or SUPERADMIN)
 */
export async function usersControllerUpdate(params: UsersControllerUpdateRequest): Promise<unknown> {
  return request<unknown, UpdateUserDto>("PATCH", `/users/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type UsersControllerRemoveRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Delete/anonymize user (SUPERADMIN or DIRECTOR of same org, not superadmin target)
 */
export async function usersControllerRemove(params: UsersControllerRemoveRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/users/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type OrganizationsControllerFindAllRequest = {
  query?: {
    /**
     * Fulltext (název, město, země)
     */
    search?: string;
    page?: number;
    limit?: number;
    /**
     * Filtr podle typu organizace
     */
    type?: "SCHOOL" | "PRIVATE" | "COMMUNITY";
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Get organizations (only superadmin), s pagination + search
 */
export async function organizationsControllerFindAll(params?: OrganizationsControllerFindAllRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/organizations", buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type OrganizationsControllerCreateRequest = {
  body: CreateOrganizationDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Create organization (PRIVATE/COMMUNITY: any user, SCHOOL: superadmin nebo aktuální director)
 */
export async function organizationsControllerCreate(params: OrganizationsControllerCreateRequest): Promise<unknown> {
  return request<unknown, CreateOrganizationDto>("POST", "/organizations", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type OrganizationsControllerFindOneRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Get organization detail (director/teacher/student/superadmin)
 */
export async function organizationsControllerFindOne(params: OrganizationsControllerFindOneRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/organizations/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type OrganizationsControllerUpdateRequest = {
  path: {
    id: string;
  };
  body: UpdateOrganizationDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Update organization (director or superadmin)
 */
export async function organizationsControllerUpdate(params: OrganizationsControllerUpdateRequest): Promise<unknown> {
  return request<unknown, UpdateOrganizationDto>("PATCH", `/organizations/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type OrganizationsControllerRemoveRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Soft delete organization (only for superadmin)
 */
export async function organizationsControllerRemove(params: OrganizationsControllerRemoveRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/organizations/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type MembershipsControllerFindAllRequest = {
  query?: {
    /**
     * ID organizace, ve které listujeme členy
     */
    organizationId?: string;
    page?: number;
    limit?: number;
    /**
     * Fulltext přes uživatele (name, email, username)
     */
    search?: string;
    /**
     * Filtr role v organizaci
     */
    role?: "STUDENT" | "TEACHER" | "DIRECTOR";
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * List organization members (SUPERADMIN or DIRECTOR) + search/pagination
 */
export async function membershipsControllerFindAll(params?: MembershipsControllerFindAllRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/memberships", buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type MembershipsControllerCreateRequest = {
  body: CreateMembershipDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Add user to organization (SUPERADMIN or DIRECTOR)
 */
export async function membershipsControllerCreate(params: MembershipsControllerCreateRequest): Promise<unknown> {
  return request<unknown, CreateMembershipDto>("POST", "/memberships", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type MembershipsControllerUpdateRequest = {
  path: {
    id: string;
  };
  body: UpdateMembershipDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Update role of member (SUPERADMIN or DIRECTOR)
 */
export async function membershipsControllerUpdate(params: MembershipsControllerUpdateRequest): Promise<unknown> {
  return request<unknown, UpdateMembershipDto>("PATCH", `/memberships/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type MembershipsControllerRemoveRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Remove user from organization (SUPERADMIN or DIRECTOR)
 */
export async function membershipsControllerRemove(params: MembershipsControllerRemoveRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/memberships/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type ClassroomControllerFindAllRequest = {
  query: {
    /**
     * Školní rok
     */
    yearId: string;
    grade?: "GRADE_1" | "GRADE_2" | "GRADE_3" | "GRADE_4" | "GRADE_5" | "GRADE_6" | "GRADE_7" | "GRADE_8" | "GRADE_9" | "HIGH_SCHOOL_YEAR_1" | "HIGH_SCHOOL_YEAR_2" | "HIGH_SCHOOL_YEAR_3" | "HIGH_SCHOOL_YEAR_4";
    /**
     * Fulltext (label/section)
     */
    search?: string;
    page?: number;
    limit?: number;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Seznam tříd dle školního roku (volitelně grade/search) s paginací
 */
export async function classroomControllerFindAll(params: ClassroomControllerFindAllRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/class-sections", buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type ClassroomControllerCreateRequest = {
  body: CreateClassSectionDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Vytvoření třídy (class section)
 */
export async function classroomControllerCreate(params: ClassroomControllerCreateRequest): Promise<unknown> {
  return request<unknown, CreateClassSectionDto>("POST", "/class-sections", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type ClassroomControllerFindOneRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Detail třídy
 */
export async function classroomControllerFindOne(params: ClassroomControllerFindOneRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/class-sections/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type ClassroomControllerUpdateRequest = {
  path: {
    id: string;
  };
  body: UpdateClassroomDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Úprava třídy
 */
export async function classroomControllerUpdate(params: ClassroomControllerUpdateRequest): Promise<unknown> {
  return request<unknown, UpdateClassroomDto>("PATCH", `/class-sections/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type ClassroomControllerRemoveRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Smazání třídy
 */
export async function classroomControllerRemove(params: ClassroomControllerRemoveRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/class-sections/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type SubjectsControllerFindAllRequest = {
  query?: {
    page?: number;
    limit?: number;
    search?: string;
    includeLevels?: boolean;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Získat předměty (search, pagination, includeLevels)
 */
export async function subjectsControllerFindAll(params?: SubjectsControllerFindAllRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/subjects", buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type SubjectsControllerCreateRequest = {
  body: CreateSubjectDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Vytvoření předmětu
 */
export async function subjectsControllerCreate(params: SubjectsControllerCreateRequest): Promise<unknown> {
  return request<unknown, CreateSubjectDto>("POST", "/subjects", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type SubjectsControllerFindOneRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Detail předmětu
 */
export async function subjectsControllerFindOne(params: SubjectsControllerFindOneRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/subjects/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type SubjectsControllerUpdateRequest = {
  path: {
    id: string;
  };
  body: UpdateSubjectDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Úprava předmětu
 */
export async function subjectsControllerUpdate(params: SubjectsControllerUpdateRequest): Promise<unknown> {
  return request<unknown, UpdateSubjectDto>("PATCH", `/subjects/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type SubjectsControllerRemoveRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Soft smazání předmětu
 */
export async function subjectsControllerRemove(params: SubjectsControllerRemoveRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/subjects/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type SubjectsControllerFindLevelsRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Seznam SubjectLevel pro daný předmět
 */
export async function subjectsControllerFindLevels(params: SubjectsControllerFindLevelsRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/subjects/${encodePathSegment(params.path.id)}/levels`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type SubjectsControllerFindTopicsBySubjectRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Všechna TopicLevel pro daný předmět (přes SubjectLevel)
 */
export async function subjectsControllerFindTopicsBySubject(params: SubjectsControllerFindTopicsBySubjectRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/subjects/${encodePathSegment(params.path.id)}/topics`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type StudentsControllerExportRequest = {
  query?: {
    format?: "csv" | "xlsx";
    filename?: string;
    search?: string;
    yearId?: string;
    classSectionId?: string;
    batchSize?: number;
    /**
     * Volitelné: vybrané sloupce
     */
    columns?: Array<string>;
    includeEnrollments?: boolean;
    /**
     * Přednastavené sloupce/formát/volby
     */
    template?: "tridni" | "kontakty" | "lms" | "reditel";
    mode?: "light" | "full";
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function studentsControllerExport(params?: StudentsControllerExportRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/students/export", buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type StudentsControllerFindAllRequest = {
  query?: {
    page?: number;
    limit?: number;
    /**
     * Fulltext: jméno, studentNumber, externalId
     */
    search?: string;
    /**
     * Filtrovat podle aktuálního školního roku
     */
    yearId?: string;
    /**
     * Filtrovat podle třídy
     */
    classSectionId?: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * List students (pagination + filters)
 */
export async function studentsControllerFindAll(params?: StudentsControllerFindAllRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/students", buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type StudentsControllerCreateRequest = {
  body: CreateStudentDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Create new student
 */
export async function studentsControllerCreate(params: StudentsControllerCreateRequest): Promise<unknown> {
  return request<unknown, CreateStudentDto>("POST", "/students", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type StudentsControllerFindOneRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Get student by ID
 */
export async function studentsControllerFindOne(params: StudentsControllerFindOneRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/students/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type StudentsControllerUpdateRequest = {
  path: {
    id: string;
  };
  body: UpdateStudentDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Update student by ID
 */
export async function studentsControllerUpdate(params: StudentsControllerUpdateRequest): Promise<unknown> {
  return request<unknown, UpdateStudentDto>("PATCH", `/students/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type StudentsControllerRemoveRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Soft delete student by ID
 */
export async function studentsControllerRemove(params: StudentsControllerRemoveRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/students/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TopicsControllerListCatalogSubjectsRequest = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * CatalogSubject list (pro picker)
 */
export async function topicsControllerListCatalogSubjects(params?: TopicsControllerListCatalogSubjectsRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/topics/catalog/subjects", buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TopicsControllerListCatalogTopicsRequest = {
  path: {
    id: string;
  };
  query: {
    search: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * CatalogTopic list by CatalogSubject (pro picker)
 */
export async function topicsControllerListCatalogTopics(params: TopicsControllerListCatalogTopicsRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/topics/catalog/subjects/${encodePathSegment(params.path.id)}/topics`, buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TopicsControllerGetBySubjectRequest = {
  path: {
    subjectId: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * TopicLevel podle Subject ID
 */
export async function topicsControllerGetBySubject(params: TopicsControllerGetBySubjectRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/topics/by-subject/${encodePathSegment(params.path.subjectId)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TopicsControllerFindAllRequest = {
  query?: {
    subjectId?: string;
    subjectLevelId?: string;
    search?: string;
    page?: number;
    limit?: number;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Seznam TopicLevel s filtry (subjectId / subjectLevelId / search)
 */
export async function topicsControllerFindAll(params?: TopicsControllerFindAllRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/topics", buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TopicsControllerCreateRequest = {
  body: CreateTopicDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Vytvoření TopicLevel (téma)
 */
export async function topicsControllerCreate(params: TopicsControllerCreateRequest): Promise<unknown> {
  return request<unknown, CreateTopicDto>("POST", "/topics", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TopicsControllerFindOneRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Detail TopicLevel
 */
export async function topicsControllerFindOne(params: TopicsControllerFindOneRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/topics/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TopicsControllerUpdateRequest = {
  path: {
    id: string;
  };
  body: UpdateTopicDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Upravit TopicLevel
 */
export async function topicsControllerUpdate(params: TopicsControllerUpdateRequest): Promise<unknown> {
  return request<unknown, UpdateTopicDto>("PATCH", `/topics/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TopicsControllerRemoveRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Smazat TopicLevel
 */
export async function topicsControllerRemove(params: TopicsControllerRemoveRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/topics/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TopicsControllerAssignMaterialsRequest = {
  path: {
    id: string;
  };
  body: AssignMaterialsDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Přiřadit (bulk) materiály k TopicLevel
 */
export async function topicsControllerAssignMaterials(params: TopicsControllerAssignMaterialsRequest): Promise<unknown> {
  return request<unknown, AssignMaterialsDto>("POST", `/topics/${encodePathSegment(params.path.id)}/materials`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TopicsControllerRemoveMaterialRequest = {
  path: {
    id: string;
    materialId: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Odebrat materiál z TopicLevel
 */
export async function topicsControllerRemoveMaterial(params: TopicsControllerRemoveMaterialRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/topics/${encodePathSegment(params.path.id)}/materials/${encodePathSegment(params.path.materialId)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TopicsControllerAssignTestsRequest = {
  path: {
    id: string;
  };
  body: AssignTestsDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Přiřadit (bulk) testy k TopicLevel
 */
export async function topicsControllerAssignTests(params: TopicsControllerAssignTestsRequest): Promise<unknown> {
  return request<unknown, AssignTestsDto>("POST", `/topics/${encodePathSegment(params.path.id)}/tests`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TopicsControllerRemoveTestRequest = {
  path: {
    id: string;
    testId: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Odebrat test z TopicLevel
 */
export async function topicsControllerRemoveTest(params: TopicsControllerRemoveTestRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/topics/${encodePathSegment(params.path.id)}/tests/${encodePathSegment(params.path.testId)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type ClassSectionControllerSetHomeroomRequest = {
  path: {
    id: string;
  };
  body: SetHomeroomDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Nastavit/odstranit třídnictví (homeroom teacher)
 */
export async function classSectionControllerSetHomeroom(params: ClassSectionControllerSetHomeroomRequest): Promise<unknown> {
  return request<unknown, SetHomeroomDto>("PATCH", `/class-sections/${encodePathSegment(params.path.id)}/homeroom`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type CatalogControllerListSubjectsRequest = {
  query?: {
    search?: string;
    page?: number;
    limit?: number;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * CatalogSubject list (search + pagination, cached)
 */
export async function catalogControllerListSubjects(params?: CatalogControllerListSubjectsRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/catalog/subjects", buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type CatalogControllerCreateCatalogSubjectRequest = {
  body: CreateCatalogSubjectDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Create CatalogSubject (SUPERADMIN)
 */
export async function catalogControllerCreateCatalogSubject(params: CatalogControllerCreateCatalogSubjectRequest): Promise<unknown> {
  return request<unknown, CreateCatalogSubjectDto>("POST", "/catalog/subjects", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type CatalogControllerGetSubjectRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * CatalogSubject detail (cached)
 */
export async function catalogControllerGetSubject(params: CatalogControllerGetSubjectRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/catalog/subjects/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type CatalogControllerUpdateCatalogSubjectRequest = {
  path: {
    id: string;
  };
  body: UpdateCatalogSubjectDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Update CatalogSubject (SUPERADMIN)
 */
export async function catalogControllerUpdateCatalogSubject(params: CatalogControllerUpdateCatalogSubjectRequest): Promise<unknown> {
  return request<unknown, UpdateCatalogSubjectDto>("PATCH", `/catalog/subjects/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type CatalogControllerDeleteCatalogSubjectRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Delete CatalogSubject (SUPERADMIN)
 */
export async function catalogControllerDeleteCatalogSubject(params: CatalogControllerDeleteCatalogSubjectRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/catalog/subjects/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type CatalogControllerListTopicsRequest = {
  path: {
    id: string;
  };
  query?: {
    search?: string;
    page?: number;
    limit?: number;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * CatalogTopic list by CatalogSubject (cached)
 */
export async function catalogControllerListTopics(params: CatalogControllerListTopicsRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/catalog/subjects/${encodePathSegment(params.path.id)}/topics`, buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type CatalogControllerCreateCatalogTopicRequest = {
  path: {
    id: string;
  };
  body: CreateCatalogTopicDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Create CatalogTopic under CatalogSubject (SUPERADMIN)
 */
export async function catalogControllerCreateCatalogTopic(params: CatalogControllerCreateCatalogTopicRequest): Promise<unknown> {
  return request<unknown, CreateCatalogTopicDto>("POST", `/catalog/subjects/${encodePathSegment(params.path.id)}/topics`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type CatalogControllerGetTopicRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * CatalogTopic detail (cached)
 */
export async function catalogControllerGetTopic(params: CatalogControllerGetTopicRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/catalog/topics/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type CatalogControllerUpdateCatalogTopicRequest = {
  path: {
    id: string;
  };
  body: UpdateCatalogTopicDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Update CatalogTopic (SUPERADMIN)
 */
export async function catalogControllerUpdateCatalogTopic(params: CatalogControllerUpdateCatalogTopicRequest): Promise<unknown> {
  return request<unknown, UpdateCatalogTopicDto>("PATCH", `/catalog/topics/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type CatalogControllerDeleteCatalogTopicRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Delete CatalogTopic (SUPERADMIN)
 */
export async function catalogControllerDeleteCatalogTopic(params: CatalogControllerDeleteCatalogTopicRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/catalog/topics/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type CatalogControllerMaterializeSubjectRequest = {
  path: {
    id: string;
  };
  body: MaterializeSubjectDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Vytvoř Subject (+levels) v org z CatalogSubject
 */
export async function catalogControllerMaterializeSubject(params: CatalogControllerMaterializeSubjectRequest): Promise<unknown> {
  return request<unknown, MaterializeSubjectDto>("POST", `/catalog/subjects/${encodePathSegment(params.path.id)}/materialize-to-org`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type CatalogControllerMaterializeTopicRequest = {
  path: {
    id: string;
  };
  body: MaterializeTopicDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Vytvoř TopicLevel v SubjectLevel z CatalogTopic
 */
export async function catalogControllerMaterializeTopic(params: CatalogControllerMaterializeTopicRequest): Promise<unknown> {
  return request<unknown, MaterializeTopicDto>("POST", `/catalog/topics/${encodePathSegment(params.path.id)}/materialize-to-subject-level`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type CatalogControllerMaterializeTopicsBulkRequest = {
  path: {
    id: string;
  };
  body: MaterializeTopicsBulkDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Bulk materializace více CatalogTopic do SubjectLevel
 */
export async function catalogControllerMaterializeTopicsBulk(params: CatalogControllerMaterializeTopicsBulkRequest): Promise<unknown> {
  return request<unknown, MaterializeTopicsBulkDto>("POST", `/catalog/subjects/${encodePathSegment(params.path.id)}/materialize-topics`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type LearningMaterialsControllerFindAllRequest = {
  query?: {
    page?: number;
    limit?: number;
    /**
     * Fulltext (title, description)
     */
    search?: string;
    educationLevel?: "PRIMARY_1" | "PRIMARY_2" | "SECONDARY_MATURITA" | "SECONDARY_VOCATIONAL";
    schoolGrade?: "GRADE_1" | "GRADE_2" | "GRADE_3" | "GRADE_4" | "GRADE_5" | "GRADE_6" | "GRADE_7" | "GRADE_8" | "GRADE_9" | "HIGH_SCHOOL_YEAR_1" | "HIGH_SCHOOL_YEAR_2" | "HIGH_SCHOOL_YEAR_3" | "HIGH_SCHOOL_YEAR_4";
    /**
     * Scope filtr (GLOBAL/ORGANIZATION/SHARED)
     */
    scope?: "GLOBAL" | "ORGANIZATION" | "SHARED";
    contentType?: "MATERIAL" | "PRACTICE" | "TEST" | "VIDEO" | "LINK";
    /**
     * Org ID – povinné pro nesuperadmina při ORG obsahu
     */
    organizationId?: string;
    /**
     * Subject ID (volitelné) – zúžení
     */
    subjectId?: string;
    /**
     * TopicLevel ID (volitelné) – zúžení
     */
    topicLevelId?: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * List learning materials
 */
export async function learningMaterialsControllerFindAll(params?: LearningMaterialsControllerFindAllRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/learning-materials", buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type LearningMaterialsControllerCreateRequest = {
  body: CreateLearningMaterialDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Create learning material
 */
export async function learningMaterialsControllerCreate(params: LearningMaterialsControllerCreateRequest): Promise<unknown> {
  return request<unknown, CreateLearningMaterialDto>("POST", "/learning-materials", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type LearningMaterialsControllerFindOneRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Get material detail
 */
export async function learningMaterialsControllerFindOne(params: LearningMaterialsControllerFindOneRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/learning-materials/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type LearningMaterialsControllerUpdateRequest = {
  path: {
    id: string;
  };
  body: UpdateLearningMaterialDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Update learning material
 */
export async function learningMaterialsControllerUpdate(params: LearningMaterialsControllerUpdateRequest): Promise<unknown> {
  return request<unknown, UpdateLearningMaterialDto>("PATCH", `/learning-materials/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type LearningMaterialsControllerRemoveRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Soft delete material
 */
export async function learningMaterialsControllerRemove(params: LearningMaterialsControllerRemoveRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/learning-materials/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type LearningMaterialsControllerUploadRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Upload PDF file for material
 */
export async function learningMaterialsControllerUpload(params: LearningMaterialsControllerUploadRequest): Promise<unknown> {
  return request<unknown, unknown>("POST", `/learning-materials/${encodePathSegment(params.path.id)}/file`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerFindAllRequest = {
  query?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    organizationId?: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * List tests
 */
export async function testsControllerFindAll(params?: TestsControllerFindAllRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/tests", buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerCreateRequest = {
  body: CreateTestDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Create test
 */
export async function testsControllerCreate(params: TestsControllerCreateRequest): Promise<unknown> {
  return request<unknown, CreateTestDto>("POST", "/tests", buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerFindOneRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Get test detail
 */
export async function testsControllerFindOne(params: TestsControllerFindOneRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", `/tests/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerUpdateRequest = {
  path: {
    id: string;
  };
  body: UpdateTestDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Update test
 */
export async function testsControllerUpdate(params: TestsControllerUpdateRequest): Promise<unknown> {
  return request<unknown, UpdateTestDto>("PATCH", `/tests/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerRemoveRequest = {
  path: {
    id: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Soft delete test
 */
export async function testsControllerRemove(params: TestsControllerRemoveRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/tests/${encodePathSegment(params.path.id)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerReorderQuestionsRequest = {
  path: {
    id: string;
  };
  body: ReorderQuestionsDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Reorder questions
 */
export async function testsControllerReorderQuestions(params: TestsControllerReorderQuestionsRequest): Promise<unknown> {
  return request<unknown, ReorderQuestionsDto>("PATCH", `/tests/${encodePathSegment(params.path.id)}/questions/reorder`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerAddQuestionRequest = {
  path: {
    id: string;
  };
  body: CreateQuestionDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Add question to test
 */
export async function testsControllerAddQuestion(params: TestsControllerAddQuestionRequest): Promise<unknown> {
  return request<unknown, CreateQuestionDto>("POST", `/tests/${encodePathSegment(params.path.id)}/questions`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerUpdateQuestionRequest = {
  path: {
    id: string;
    questionId: string;
  };
  body: UpdateQuestionDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Update question
 */
export async function testsControllerUpdateQuestion(params: TestsControllerUpdateQuestionRequest): Promise<unknown> {
  return request<unknown, UpdateQuestionDto>("PATCH", `/tests/${encodePathSegment(params.path.id)}/questions/${encodePathSegment(params.path.questionId)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerRemoveQuestionRequest = {
  path: {
    id: string;
    questionId: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Remove question
 */
export async function testsControllerRemoveQuestion(params: TestsControllerRemoveQuestionRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/tests/${encodePathSegment(params.path.id)}/questions/${encodePathSegment(params.path.questionId)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerAddOptionRequest = {
  path: {
    id: string;
    questionId: string;
  };
  body: CreateOptionDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function testsControllerAddOption(params: TestsControllerAddOptionRequest): Promise<unknown> {
  return request<unknown, CreateOptionDto>("POST", `/tests/${encodePathSegment(params.path.id)}/questions/${encodePathSegment(params.path.questionId)}/options`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerUpdateOptionRequest = {
  path: {
    id: string;
    questionId: string;
    optionId: string;
  };
  body: UpdateOptionDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function testsControllerUpdateOption(params: TestsControllerUpdateOptionRequest): Promise<unknown> {
  return request<unknown, UpdateOptionDto>("PATCH", `/tests/${encodePathSegment(params.path.id)}/questions/${encodePathSegment(params.path.questionId)}/options/${encodePathSegment(params.path.optionId)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerRemoveOptionRequest = {
  path: {
    id: string;
    questionId: string;
    optionId: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function testsControllerRemoveOption(params: TestsControllerRemoveOptionRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/tests/${encodePathSegment(params.path.id)}/questions/${encodePathSegment(params.path.questionId)}/options/${encodePathSegment(params.path.optionId)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerAddAnswerRequest = {
  path: {
    id: string;
    questionId: string;
  };
  body: CreateAnswerDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function testsControllerAddAnswer(params: TestsControllerAddAnswerRequest): Promise<unknown> {
  return request<unknown, CreateAnswerDto>("POST", `/tests/${encodePathSegment(params.path.id)}/questions/${encodePathSegment(params.path.questionId)}/answers`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerUpdateAnswerRequest = {
  path: {
    id: string;
    questionId: string;
    answerId: string;
  };
  body: UpdateAnswerDto;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function testsControllerUpdateAnswer(params: TestsControllerUpdateAnswerRequest): Promise<unknown> {
  return request<unknown, UpdateAnswerDto>("PATCH", `/tests/${encodePathSegment(params.path.id)}/questions/${encodePathSegment(params.path.questionId)}/answers/${encodePathSegment(params.path.answerId)}`, buildRequestConfig({
    body: params?.body,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type TestsControllerRemoveAnswerRequest = {
  path: {
    id: string;
    questionId: string;
    answerId: string;
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function testsControllerRemoveAnswer(params: TestsControllerRemoveAnswerRequest): Promise<unknown> {
  return request<unknown, unknown>("DELETE", `/tests/${encodePathSegment(params.path.id)}/questions/${encodePathSegment(params.path.questionId)}/answers/${encodePathSegment(params.path.answerId)}`, buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type StatsControllerOverviewRequest = {
  query?: {
    /**
     * How passRate is computed. "evaluated" = APPROVED/(APPROVED+REJECTED). "all" = APPROVED/all submissions (incl. PENDING). Default: evaluated.
     */
    scope?: "evaluated" | "all";
  };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Organization overview (tests, submissions, averages)
 */
export async function statsControllerOverview(params?: StatsControllerOverviewRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/stats/overview", buildRequestConfig({
    query: params?.query,
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type StatsControllerStudentRequest = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Student dashboard (my progress)
 */
export async function statsControllerStudent(params?: StatsControllerStudentRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/dashboards/student", buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export type StatsControllerTeacherRequest = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Teacher dashboard (my classes/tests/performance)
 */
export async function statsControllerTeacher(params?: StatsControllerTeacherRequest): Promise<unknown> {
  return request<unknown, unknown>("GET", "/dashboards/teacher", buildRequestConfig({
    signal: params?.signal,
    headers: params?.headers
  }));
}

export const openApiClient = {
  "authControllerRegister": authControllerRegister,
  "authControllerLogin": authControllerLogin,
  "authControllerRefresh": authControllerRefresh,
  "authControllerLogout": authControllerLogout,
  "authControllerMe": authControllerMe,
  "teachersControllerFindAll": teachersControllerFindAll,
  "teachersControllerCreate": teachersControllerCreate,
  "teachersControllerFindOne": teachersControllerFindOne,
  "teachersControllerUpdate": teachersControllerUpdate,
  "teachersControllerRemove": teachersControllerRemove,
  "teachersControllerAssignSubjects": teachersControllerAssignSubjects,
  "teachersControllerRemoveSubject": teachersControllerRemoveSubject,
  "usersControllerFindAll": usersControllerFindAll,
  "usersControllerCreate": usersControllerCreate,
  "usersControllerFindOne": usersControllerFindOne,
  "usersControllerUpdate": usersControllerUpdate,
  "usersControllerRemove": usersControllerRemove,
  "organizationsControllerFindAll": organizationsControllerFindAll,
  "organizationsControllerCreate": organizationsControllerCreate,
  "organizationsControllerFindOne": organizationsControllerFindOne,
  "organizationsControllerUpdate": organizationsControllerUpdate,
  "organizationsControllerRemove": organizationsControllerRemove,
  "membershipsControllerFindAll": membershipsControllerFindAll,
  "membershipsControllerCreate": membershipsControllerCreate,
  "membershipsControllerUpdate": membershipsControllerUpdate,
  "membershipsControllerRemove": membershipsControllerRemove,
  "classroomControllerFindAll": classroomControllerFindAll,
  "classroomControllerCreate": classroomControllerCreate,
  "classroomControllerFindOne": classroomControllerFindOne,
  "classroomControllerUpdate": classroomControllerUpdate,
  "classroomControllerRemove": classroomControllerRemove,
  "subjectsControllerFindAll": subjectsControllerFindAll,
  "subjectsControllerCreate": subjectsControllerCreate,
  "subjectsControllerFindOne": subjectsControllerFindOne,
  "subjectsControllerUpdate": subjectsControllerUpdate,
  "subjectsControllerRemove": subjectsControllerRemove,
  "subjectsControllerFindLevels": subjectsControllerFindLevels,
  "subjectsControllerFindTopicsBySubject": subjectsControllerFindTopicsBySubject,
  "studentsControllerExport": studentsControllerExport,
  "studentsControllerFindAll": studentsControllerFindAll,
  "studentsControllerCreate": studentsControllerCreate,
  "studentsControllerFindOne": studentsControllerFindOne,
  "studentsControllerUpdate": studentsControllerUpdate,
  "studentsControllerRemove": studentsControllerRemove,
  "topicsControllerListCatalogSubjects": topicsControllerListCatalogSubjects,
  "topicsControllerListCatalogTopics": topicsControllerListCatalogTopics,
  "topicsControllerGetBySubject": topicsControllerGetBySubject,
  "topicsControllerFindAll": topicsControllerFindAll,
  "topicsControllerCreate": topicsControllerCreate,
  "topicsControllerFindOne": topicsControllerFindOne,
  "topicsControllerUpdate": topicsControllerUpdate,
  "topicsControllerRemove": topicsControllerRemove,
  "topicsControllerAssignMaterials": topicsControllerAssignMaterials,
  "topicsControllerRemoveMaterial": topicsControllerRemoveMaterial,
  "topicsControllerAssignTests": topicsControllerAssignTests,
  "topicsControllerRemoveTest": topicsControllerRemoveTest,
  "classSectionControllerSetHomeroom": classSectionControllerSetHomeroom,
  "catalogControllerListSubjects": catalogControllerListSubjects,
  "catalogControllerCreateCatalogSubject": catalogControllerCreateCatalogSubject,
  "catalogControllerGetSubject": catalogControllerGetSubject,
  "catalogControllerUpdateCatalogSubject": catalogControllerUpdateCatalogSubject,
  "catalogControllerDeleteCatalogSubject": catalogControllerDeleteCatalogSubject,
  "catalogControllerListTopics": catalogControllerListTopics,
  "catalogControllerCreateCatalogTopic": catalogControllerCreateCatalogTopic,
  "catalogControllerGetTopic": catalogControllerGetTopic,
  "catalogControllerUpdateCatalogTopic": catalogControllerUpdateCatalogTopic,
  "catalogControllerDeleteCatalogTopic": catalogControllerDeleteCatalogTopic,
  "catalogControllerMaterializeSubject": catalogControllerMaterializeSubject,
  "catalogControllerMaterializeTopic": catalogControllerMaterializeTopic,
  "catalogControllerMaterializeTopicsBulk": catalogControllerMaterializeTopicsBulk,
  "learningMaterialsControllerFindAll": learningMaterialsControllerFindAll,
  "learningMaterialsControllerCreate": learningMaterialsControllerCreate,
  "learningMaterialsControllerFindOne": learningMaterialsControllerFindOne,
  "learningMaterialsControllerUpdate": learningMaterialsControllerUpdate,
  "learningMaterialsControllerRemove": learningMaterialsControllerRemove,
  "learningMaterialsControllerUpload": learningMaterialsControllerUpload,
  "testsControllerFindAll": testsControllerFindAll,
  "testsControllerCreate": testsControllerCreate,
  "testsControllerFindOne": testsControllerFindOne,
  "testsControllerUpdate": testsControllerUpdate,
  "testsControllerRemove": testsControllerRemove,
  "testsControllerReorderQuestions": testsControllerReorderQuestions,
  "testsControllerAddQuestion": testsControllerAddQuestion,
  "testsControllerUpdateQuestion": testsControllerUpdateQuestion,
  "testsControllerRemoveQuestion": testsControllerRemoveQuestion,
  "testsControllerAddOption": testsControllerAddOption,
  "testsControllerUpdateOption": testsControllerUpdateOption,
  "testsControllerRemoveOption": testsControllerRemoveOption,
  "testsControllerAddAnswer": testsControllerAddAnswer,
  "testsControllerUpdateAnswer": testsControllerUpdateAnswer,
  "testsControllerRemoveAnswer": testsControllerRemoveAnswer,
  "statsControllerOverview": statsControllerOverview,
  "statsControllerStudent": statsControllerStudent,
  "statsControllerTeacher": statsControllerTeacher,
} as const;
