export type StudentImportPreviewRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  class: string;
  status: "VALID" | "INVALID";
  errors: string[];
};

export type StudentImportPreviewResponse = {
  fileName: string;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
  rows: StudentImportPreviewRow[];
  meta: {
    usernameModeEnabled: boolean;
    classOptions: Array<{
      id: string;
      label: string;
    }>;
    reservedEmails: string[];
  };
};

export type StudentImportCommitResponse = {
  batchId: string;
  summary: {
    requestedRows: number;
    importedRows: number;
    failedRows: number;
    createdUsers: number;
    createdMemberships: number;
    createdStudents: number;
    createdEnrollments: number;
  };
  results: Array<{
    rowNumber: number;
    status: "IMPORTED" | "ERROR";
    message?: string;
  }>;
  errors: Array<{
    rowNumber: number;
    message: string;
  }>;
};
