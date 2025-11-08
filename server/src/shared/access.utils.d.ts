import { Prisma } from '@prisma/client';
import { JwtPayload } from 'src/auth/types/jwt-payload';
export declare function assertSameOrganization(resourceOrgId: string, user: JwtPayload, context?: string): void;
export declare function assertTeacherOrDirectorInOrgOrSuperadmin(user: JwtPayload, orgId: string, context?: string): void;
export declare function assertReadScope(user: JwtPayload, orgId: string, context?: string): void;
export declare function makeSubjectSearch(search?: string): Prisma.SubjectWhereInput | undefined;
