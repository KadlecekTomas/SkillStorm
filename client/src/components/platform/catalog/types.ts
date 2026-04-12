export type CatalogMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type CatalogSubjectItem = {
  id: string;
  code: string;
  name: string;
  topicCount: number;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
};

export type CatalogTopicItem = {
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

export type CatalogSubjectListResponse = {
  items: CatalogSubjectItem[];
  meta: CatalogMeta;
};

export type CatalogTopicListResponse = {
  items: CatalogTopicItem[];
  meta: CatalogMeta;
};
