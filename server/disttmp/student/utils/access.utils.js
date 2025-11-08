"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canAccessStudent = canAccessStudent;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
function canAccessStudent(student, user) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (user.systemRole === client_1.SystemRole.SUPERADMIN)
        return;
    var jwtUserId = (_c = (_b = (_a = user.userId) !== null && _a !== void 0 ? _a : user.id) !== null && _b !== void 0 ? _b : user.sub) !== null && _c !== void 0 ? _c : null;
    // ✅ Self access – kontroluj 3 způsoby: membership.user.id, membership.userId i fallback na přímé porovnání, pokud je payload jinak pojmenovaný
    var isSelf = (((_e = (_d = student === null || student === void 0 ? void 0 : student.membership) === null || _d === void 0 ? void 0 : _d.user) === null || _e === void 0 ? void 0 : _e.id) &&
        String(student.membership.user.id) === String(jwtUserId)) ||
        (((_f = student === null || student === void 0 ? void 0 : student.membership) === null || _f === void 0 ? void 0 : _f.userId) &&
            String(student.membership.userId) === String(jwtUserId));
    if (isSelf)
        return;
    if (user.organizationRole === client_1.OrganizationRole.DIRECTOR &&
        student.orgId === user.organizationId) {
        return;
    }
    if (user.organizationRole === client_1.OrganizationRole.TEACHER) {
        var teachesThisStudent = ((_g = student.enrollments) !== null && _g !== void 0 ? _g : []).some(function (enr) {
            var _a, _b, _c, _d;
            return ((_a = enr === null || enr === void 0 ? void 0 : enr.academicYear) === null || _a === void 0 ? void 0 : _a.isCurrent) === true &&
                ((_d = (_c = (_b = enr === null || enr === void 0 ? void 0 : enr.classSection) === null || _b === void 0 ? void 0 : _b.teacher) === null || _c === void 0 ? void 0 : _c.membership) === null || _d === void 0 ? void 0 : _d.userId) &&
                String(enr.classSection.teacher.membership.userId) ===
                    String(jwtUserId);
        });
        if (teachesThisStudent)
            return;
        throw new common_1.ForbiddenException('Tento student není ve tvé třídě.');
    }
    if (user.organizationRole === client_1.OrganizationRole.STUDENT) {
        // student může jen sám sebe – když to neprošlo výše, tak zakázat
        throw new common_1.ForbiddenException('Nemáš oprávnění zobrazit jiného studenta.');
    }
    throw new common_1.UnauthorizedException('Neautorizovaný přístup.');
}
