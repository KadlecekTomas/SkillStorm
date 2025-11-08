"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSameOrganization = assertSameOrganization;
exports.assertTeacherOrDirectorInOrgOrSuperadmin = assertTeacherOrDirectorInOrgOrSuperadmin;
exports.assertReadScope = assertReadScope;
exports.makeSubjectSearch = makeSubjectSearch;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
function assertSameOrganization(resourceOrgId, user, context = 'zdroj') {
    if (user.systemRole === client_1.SystemRole.SUPERADMIN)
        return;
    if (user.organizationId !== resourceOrgId) {
        throw new common_1.ForbiddenException(`Nemáš oprávnění přistupovat k tomuto ${context}.`);
    }
}
function assertTeacherOrDirectorInOrgOrSuperadmin(user, orgId, context = 'zdroj') {
    if (user.systemRole === client_1.SystemRole.SUPERADMIN)
        return;
    const allowedRoles = new Set([
        client_1.$Enums.OrganizationRole.TEACHER,
        client_1.$Enums.OrganizationRole.DIRECTOR,
    ]);
    if (user.organizationId !== orgId ||
        !user.organizationRole ||
        !allowedRoles.has(user.organizationRole)) {
        throw new common_1.ForbiddenException(`Pouze učitel/ředitel dané školy nebo superadmin může spravovat tento ${context}.`);
    }
}
function assertReadScope(user, orgId, context = 'zdroj') {
    if (user.systemRole === client_1.SystemRole.SUPERADMIN)
        return;
    if (user.organizationId !== orgId) {
        throw new common_1.ForbiddenException(`Přístup k tomuto ${context} je omezen na vlastní organizaci.`);
    }
}
function makeSubjectSearch(search) {
    const raw = search?.trim();
    if (!raw)
        return undefined;
    const s = raw.replace(/\s+/g, ' ');
    return {
        OR: [
            { name: { contains: s, mode: 'insensitive' } },
            {
                catalogSubject: { is: { name: { contains: s, mode: 'insensitive' } } },
            },
            {
                catalogSubject: { is: { code: { contains: s, mode: 'insensitive' } } },
            },
        ],
    };
}
//# sourceMappingURL=access.utils.js.map