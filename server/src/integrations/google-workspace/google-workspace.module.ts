import { Module } from '@nestjs/common';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { AuditModule } from '@/audit/audit.module';
import { OrgContextModule } from '@/common/org-context/org-context.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { GoogleWorkspaceController } from './google-workspace.controller';
import { GoogleWorkspaceOAuthController } from './google-workspace-oauth.controller';
import { GoogleWorkspaceService } from './google-workspace.service';
import { GoogleWorkspaceConfigService } from './google-workspace-config.service';
import { TokenEncryptionService } from './token-encryption.service';
import { OAuthStateService } from './oauth-state.service';
import {
  HttpGoogleWorkspaceDirectoryClientFactory,
  type GoogleWorkspaceDirectoryClientFactory,
} from './directory/google-workspace-directory.client';
import { MockGoogleWorkspaceDirectoryClientFactory } from './directory/mock-google-workspace-directory.client';
import { GOOGLE_WORKSPACE_DIRECTORY_CLIENT } from './google-workspace.constants';

@Module({
  imports: [PrismaModule, AcademicYearsModule, OrgContextModule, AuditModule],
  controllers: [GoogleWorkspaceController, GoogleWorkspaceOAuthController],
  providers: [
    GoogleWorkspaceService,
    GoogleWorkspaceConfigService,
    TokenEncryptionService,
    OAuthStateService,
    {
      // In dev mock mode serve the in-memory fixture directory; otherwise use
      // the real read-only Directory API client.
      provide: GOOGLE_WORKSPACE_DIRECTORY_CLIENT,
      inject: [GoogleWorkspaceConfigService],
      useFactory: (
        config: GoogleWorkspaceConfigService,
      ): GoogleWorkspaceDirectoryClientFactory =>
        config.mockMode
          ? new MockGoogleWorkspaceDirectoryClientFactory()
          : new HttpGoogleWorkspaceDirectoryClientFactory(),
    },
  ],
  exports: [GoogleWorkspaceService],
})
export class GoogleWorkspaceModule {}
