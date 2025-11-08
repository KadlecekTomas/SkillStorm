"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentsService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var access_utils_1 = require("./utils/access.utils");
var XLSX = require("xlsx");
var org_cache_utils_1 = require("../shared/cache/org-cache.utils");
function toPrismaSearch(search) {
    var s = (search !== null && search !== void 0 ? search : '').trim();
    if (!s)
        return undefined;
    return {
        OR: [
            // jméno / email (uživatelský účet studenta)
            {
                membership: {
                    is: { user: { is: { name: { contains: s, mode: 'insensitive' } } } },
                },
            },
            {
                membership: {
                    is: { user: { is: { email: { contains: s, mode: 'insensitive' } } } },
                },
            },
            // studentNumber
            { studentNumber: { equals: s, mode: 'insensitive' } },
            { studentNumber: { contains: s, mode: 'insensitive' } },
            // externalId
            { externalId: { equals: s, mode: 'insensitive' } },
            { externalId: { contains: s, mode: 'insensitive' } },
        ],
    };
}
function toEnrollmentFilter(yearId, classSectionId) {
    if (!yearId && !classSectionId)
        return undefined;
    return {
        enrollments: {
            some: __assign(__assign({}, (yearId ? { yearId: yearId } : {})), (classSectionId ? { classSectionId: classSectionId } : {})),
        },
    };
}
// ---- export helpers (beze změny) ----
var DEFAULT_COLUMNS = [
    'studentId',
    'orgId',
    'userId',
    'userName',
    'userEmail',
    'studentNumber',
    'externalId',
    'classLabel',
    'classGrade',
    'classSection',
    'teacherName',
    'yearLabel',
    'isCurrentYear',
];
var TEMPLATES = {
    tridni: {
        columns: [
            'userName',
            'studentNumber',
            'classLabel',
            'teacherName',
            'yearLabel',
        ],
        includeEnrollments: true,
        format: 'xlsx',
        mode: 'light',
        filename: 'prechled_tridni',
    },
    kontakty: {
        columns: ['userName', 'userEmail', 'classLabel', 'yearLabel'],
        includeEnrollments: true,
        format: 'csv',
        mode: 'light',
        filename: 'kontakty_studentu',
    },
    lms: {
        columns: ['userId', 'userEmail', 'userName', 'classLabel', 'yearLabel'],
        includeEnrollments: true,
        format: 'csv',
        mode: 'light',
        filename: 'lms_import',
    },
    reditel: {
        columns: [
            'classLabel',
            'classGrade',
            'classSection',
            'yearLabel',
            'isCurrentYear',
            'userName',
            'studentNumber',
            'userEmail',
        ],
        includeEnrollments: true,
        format: 'xlsx',
        mode: 'full',
        filename: 'reditelsky_prehled',
    },
};
var ALLOWED_COLUMNS = new Set(DEFAULT_COLUMNS);
function resolveExportOptions(q) {
    var _a, _b, _c, _d, _e;
    var tpl = q.template ? TEMPLATES[q.template] : undefined;
    var columns = q.columns && q.columns.length
        ? q.columns.filter(function (c) { return ALLOWED_COLUMNS.has(c); })
        : ((_a = tpl === null || tpl === void 0 ? void 0 : tpl.columns) !== null && _a !== void 0 ? _a : __spreadArray([], DEFAULT_COLUMNS, true));
    var includeEnrollments = typeof q.includeEnrollments === 'boolean'
        ? q.includeEnrollments
        : ((_b = tpl === null || tpl === void 0 ? void 0 : tpl.includeEnrollments) !== null && _b !== void 0 ? _b : true);
    var format = ((_d = (_c = q.format) !== null && _c !== void 0 ? _c : tpl === null || tpl === void 0 ? void 0 : tpl.format) !== null && _d !== void 0 ? _d : 'xlsx');
    var filenameBase = (q.filename && q.filename.trim().length > 1
        ? q.filename.trim()
        : ((_e = tpl === null || tpl === void 0 ? void 0 : tpl.filename) !== null && _e !== void 0 ? _e : 'students_export')).replace(/[^a-z0-9_\-]/gi, '_');
    return { columns: columns, includeEnrollments: includeEnrollments, format: format, filenameBase: filenameBase };
}
var StudentsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var StudentsService = _classThis = /** @class */ (function () {
        function StudentsService_1(prisma, cache) {
            this.prisma = prisma;
            this.cache = cache;
        }
        StudentsService_1.prototype.audit = function (opts) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    return [2 /*return*/, this.prisma.auditLog.create({
                            data: {
                                userId: (_a = opts.userId) !== null && _a !== void 0 ? _a : null,
                                organizationId: (_b = opts.orgId) !== null && _b !== void 0 ? _b : null,
                                entityType: client_1.AuditEntityType.ORGANIZATION,
                                entityId: (_c = opts.entityId) !== null && _c !== void 0 ? _c : null,
                                action: opts.action,
                                metadata: (_d = opts.metadata) !== null && _d !== void 0 ? _d : null,
                                changedFields: (_e = opts.changedFields) !== null && _e !== void 0 ? _e : null,
                            },
                        })];
                });
            });
        };
        // ---------- CREATE ----------
        StudentsService_1.prototype.create = function (dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var membership, alreadyStudent, created;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.membership.findUnique({
                                where: { id: dto.membershipId },
                                select: { id: true, role: true, organizationId: true },
                            })];
                        case 1:
                            membership = _a.sent();
                            if (!membership)
                                throw new common_1.NotFoundException('Zadané membershipId neexistuje.');
                            if (membership.role !== client_1.OrganizationRole.STUDENT) {
                                throw new common_1.ForbiddenException('Membership nemá roli STUDENT.');
                            }
                            if (membership.organizationId !== dto.orgId) {
                                throw new common_1.ForbiddenException('Membership nepatří do zadané organizace.');
                            }
                            return [4 /*yield*/, this.prisma.student.findUnique({
                                    where: { membershipId: dto.membershipId },
                                    select: { id: true },
                                })];
                        case 2:
                            alreadyStudent = _a.sent();
                            if (alreadyStudent)
                                throw new common_1.ForbiddenException('Tento uživatel je již studentem.');
                            if (user.systemRole !== client_1.SystemRole.SUPERADMIN &&
                                user.organizationId !== dto.orgId) {
                                throw new common_1.ForbiddenException('Nelze vytvářet studenta v jiné organizaci.');
                            }
                            return [4 /*yield*/, this.prisma.student.create({
                                    data: {
                                        membershipId: dto.membershipId,
                                        orgId: dto.orgId,
                                        studentNumber: dto.studentNumber,
                                        externalId: dto.externalId,
                                    },
                                })];
                        case 3:
                            created = _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: dto.orgId,
                                    action: 'STUDENT_CREATE',
                                    entityId: dto.orgId,
                                    metadata: { studentId: created.id, membershipId: dto.membershipId },
                                    changedFields: dto,
                                })];
                        case 4:
                            _a.sent();
                            // 🔔 invalidace org‑scoped cache (listy studentů)
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, dto.orgId))];
                        case 5:
                            // 🔔 invalidace org‑scoped cache (listy studentů)
                            _a.sent();
                            return [2 /*return*/, created];
                    }
                });
            });
        };
        // ---------- LIST (versioned list cache) ----------
        StudentsService_1.prototype.findAll = function (user, q) {
            return __awaiter(this, void 0, void 0, function () {
                var page, limit, skip, baseWhere, where, scopeId, ver, cacheKey;
                var _this = this;
                var _a, _b, _c, _d, _e, _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            page = (_a = q.page) !== null && _a !== void 0 ? _a : 1;
                            limit = (_b = q.limit) !== null && _b !== void 0 ? _b : 20;
                            skip = (page - 1) * limit;
                            baseWhere = user.systemRole === client_1.SystemRole.SUPERADMIN
                                ? { deletedAt: null }
                                : { deletedAt: null, orgId: user.organizationId };
                            where = __assign(__assign(__assign({}, baseWhere), ((_c = toPrismaSearch(q.search)) !== null && _c !== void 0 ? _c : {})), ((_d = toEnrollmentFilter(q.yearId, q.classSectionId)) !== null && _d !== void 0 ? _d : {}));
                            scopeId = (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, user.organizationId);
                            return [4 /*yield*/, (0, org_cache_utils_1.getOrgVersion)(this.cache, scopeId)];
                        case 1:
                            ver = _g.sent();
                            cacheKey = (0, org_cache_utils_1.buildVersionedListKey)({
                                namespace: 'students',
                                scopeId: scopeId,
                                version: ver,
                                page: page,
                                limit: limit,
                                search: q.search,
                                includeLevels: false,
                                order: [{ 'membership.user.name': 'asc' }, { studentNumber: 'asc' }],
                                filters: {
                                    yearId: (_e = q.yearId) !== null && _e !== void 0 ? _e : null,
                                    classSectionId: (_f = q.classSectionId) !== null && _f !== void 0 ? _f : null,
                                },
                            });
                            return [2 /*return*/, (0, org_cache_utils_1.cacheGetOrSet)(this.cache, cacheKey, 300000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var _a, total, data;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, this.prisma.$transaction([
                                                    this.prisma.student.count({ where: where }),
                                                    this.prisma.student.findMany({
                                                        where: where,
                                                        include: {
                                                            membership: { include: { user: true } },
                                                            enrollments: {
                                                                include: {
                                                                    academicYear: true,
                                                                    classSection: {
                                                                        include: {
                                                                            teacher: {
                                                                                include: { membership: { include: { user: true } } },
                                                                            },
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        },
                                                        orderBy: [
                                                            { membership: { user: { name: 'asc' } } },
                                                            { studentNumber: 'asc' },
                                                            { membershipId: 'asc' },
                                                        ],
                                                        skip: skip,
                                                        take: limit,
                                                    }),
                                                ])];
                                            case 1:
                                                _a = _b.sent(), total = _a[0], data = _a[1];
                                                return [2 /*return*/, {
                                                        data: data,
                                                        meta: {
                                                            page: page,
                                                            limit: limit,
                                                            total: total,
                                                            pages: Math.max(1, Math.ceil(total / limit)),
                                                        },
                                                    }];
                                        }
                                    });
                                }); })];
                    }
                });
            });
        };
        // ---------- DETAIL ----------
        StudentsService_1.prototype.findOne = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var student;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.student.findUnique({
                                where: { id: id },
                                include: {
                                    membership: { select: { id: true, userId: true, user: true } },
                                    enrollments: {
                                        include: {
                                            academicYear: true,
                                            classSection: {
                                                include: {
                                                    teacher: {
                                                        include: {
                                                            membership: { select: { userId: true, user: true } },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            })];
                        case 1:
                            student = _a.sent();
                            if (!student || student.deletedAt)
                                throw new common_1.NotFoundException('Student nenalezen.');
                            (0, access_utils_1.canAccessStudent)(student, user);
                            return [2 /*return*/, student];
                    }
                });
            });
        };
        // ---------- UPDATE ----------
        StudentsService_1.prototype.update = function (id, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var student, updated;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, this.getStudentWithContext(id)];
                        case 1:
                            student = _c.sent();
                            (0, access_utils_1.canAccessStudent)(student, user);
                            return [4 /*yield*/, this.prisma.student.update({
                                    where: { id: id },
                                    data: {
                                        studentNumber: (_a = dto.studentNumber) !== null && _a !== void 0 ? _a : undefined,
                                        externalId: (_b = dto.externalId) !== null && _b !== void 0 ? _b : undefined,
                                    },
                                })];
                        case 2:
                            updated = _c.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: student.orgId,
                                    action: 'STUDENT_UPDATE',
                                    entityId: student.orgId,
                                    metadata: { studentId: student.id },
                                    changedFields: dto,
                                })];
                        case 3:
                            _c.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, student.orgId))];
                        case 4:
                            _c.sent();
                            return [2 /*return*/, updated];
                    }
                });
            });
        };
        // ---------- DELETE (soft) ----------
        StudentsService_1.prototype.remove = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var student, deleted;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getStudentWithContext(id)];
                        case 1:
                            student = _a.sent();
                            if (user.systemRole !== client_1.SystemRole.SUPERADMIN &&
                                !(user.organizationRole === client_1.OrganizationRole.DIRECTOR &&
                                    user.organizationId === student.orgId)) {
                                throw new common_1.ForbiddenException('Mazat studenta může jen ředitel nebo superadmin.');
                            }
                            return [4 /*yield*/, this.prisma.student.update({
                                    where: { id: id },
                                    data: { deletedAt: new Date() },
                                })];
                        case 2:
                            deleted = _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: deleted.orgId,
                                    action: 'STUDENT_DELETE_SOFT',
                                    entityId: deleted.orgId,
                                    metadata: { studentId: deleted.id },
                                })];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, deleted.orgId))];
                        case 4:
                            _a.sent();
                            return [2 /*return*/, deleted];
                    }
                });
            });
        };
        StudentsService_1.prototype.getStudentWithContext = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var student;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.student.findUnique({
                                where: { id: id },
                                include: {
                                    membership: { include: { user: true } },
                                    enrollments: {
                                        include: {
                                            academicYear: true,
                                            classSection: {
                                                include: {
                                                    teacher: {
                                                        include: { membership: { include: { user: true } } },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            })];
                        case 1:
                            student = _a.sent();
                            if (!student || student.deletedAt)
                                throw new common_1.NotFoundException('Student nenalezen.');
                            return [2 /*return*/, student];
                    }
                });
            });
        };
        // ---------- EXPORT (beze změny logiky) ----------
        StudentsService_1.prototype.export = function (user, q) {
            return __awaiter(this, void 0, void 0, function () {
                var batchSize, _a, columns, includeEnrollments, format, filenameBase, baseWhere, where, total, bookType, studentInclude, wb, rows, skip, chunk, _i, chunk_1, s, base, enrolls, _b, enrolls_1, e, row, ws, buffer, filename, contentType;
                var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13;
                return __generator(this, function (_14) {
                    switch (_14.label) {
                        case 0:
                            batchSize = (_c = q.batchSize) !== null && _c !== void 0 ? _c : 1000;
                            _a = resolveExportOptions(q), columns = _a.columns, includeEnrollments = _a.includeEnrollments, format = _a.format, filenameBase = _a.filenameBase;
                            baseWhere = user.systemRole === client_1.SystemRole.SUPERADMIN
                                ? { deletedAt: null }
                                : { deletedAt: null, orgId: user.organizationId };
                            where = __assign(__assign(__assign({}, baseWhere), ((_d = toPrismaSearch(q.search)) !== null && _d !== void 0 ? _d : {})), ((_e = toEnrollmentFilter(q.yearId, q.classSectionId)) !== null && _e !== void 0 ? _e : {}));
                            return [4 /*yield*/, this.prisma.student.count({ where: where })];
                        case 1:
                            total = _14.sent();
                            bookType = total > 20000 && format === 'xlsx' ? 'csv' : format;
                            studentInclude = client_1.Prisma.validator()({
                                organization: true,
                                membership: { include: { user: true } },
                                enrollments: {
                                    include: {
                                        academicYear: true,
                                        classSection: {
                                            include: {
                                                teacher: { include: { membership: { include: { user: true } } } },
                                            },
                                        },
                                    },
                                },
                            });
                            wb = XLSX.utils.book_new();
                            rows = [];
                            skip = 0;
                            _14.label = 2;
                        case 2:
                            if (!(skip < total)) return [3 /*break*/, 5];
                            return [4 /*yield*/, this.prisma.student.findMany({
                                    where: where,
                                    include: studentInclude,
                                    orderBy: [
                                        { membership: { user: { name: 'asc' } } },
                                        { membershipId: 'asc' },
                                    ],
                                    skip: skip,
                                    take: batchSize,
                                })];
                        case 3:
                            chunk = _14.sent();
                            for (_i = 0, chunk_1 = chunk; _i < chunk_1.length; _i++) {
                                s = chunk_1[_i];
                                base = {
                                    studentId: s.id,
                                    orgId: s.orgId,
                                    userId: (_h = (_g = (_f = s.membership) === null || _f === void 0 ? void 0 : _f.user) === null || _g === void 0 ? void 0 : _g.id) !== null && _h !== void 0 ? _h : null,
                                    userName: (_l = (_k = (_j = s.membership) === null || _j === void 0 ? void 0 : _j.user) === null || _k === void 0 ? void 0 : _k.name) !== null && _l !== void 0 ? _l : null,
                                    userEmail: (_p = (_o = (_m = s.membership) === null || _m === void 0 ? void 0 : _m.user) === null || _o === void 0 ? void 0 : _o.email) !== null && _p !== void 0 ? _p : null,
                                    studentNumber: (_q = s.studentNumber) !== null && _q !== void 0 ? _q : null,
                                    externalId: (_r = s.externalId) !== null && _r !== void 0 ? _r : null,
                                };
                                enrolls = includeEnrollments && ((_s = s.enrollments) === null || _s === void 0 ? void 0 : _s.length) ? s.enrollments : [null];
                                for (_b = 0, enrolls_1 = enrolls; _b < enrolls_1.length; _b++) {
                                    e = enrolls_1[_b];
                                    row = __assign(__assign({}, base), { classLabel: e
                                            ? ((_u = (_t = e.classSection) === null || _t === void 0 ? void 0 : _t.label) !== null && _u !== void 0 ? _u : "".concat((_w = (_v = e.classSection) === null || _v === void 0 ? void 0 : _v.grade) !== null && _w !== void 0 ? _w : '').concat(((_x = e.classSection) === null || _x === void 0 ? void 0 : _x.section) ? '.' + e.classSection.section : ''))
                                            : null, classGrade: (_z = (_y = e === null || e === void 0 ? void 0 : e.classSection) === null || _y === void 0 ? void 0 : _y.grade) !== null && _z !== void 0 ? _z : null, classSection: (_1 = (_0 = e === null || e === void 0 ? void 0 : e.classSection) === null || _0 === void 0 ? void 0 : _0.section) !== null && _1 !== void 0 ? _1 : null, teacherName: (_6 = (_5 = (_4 = (_3 = (_2 = e === null || e === void 0 ? void 0 : e.classSection) === null || _2 === void 0 ? void 0 : _2.teacher) === null || _3 === void 0 ? void 0 : _3.membership) === null || _4 === void 0 ? void 0 : _4.user) === null || _5 === void 0 ? void 0 : _5.name) !== null && _6 !== void 0 ? _6 : null, yearLabel: (_8 = (_7 = e === null || e === void 0 ? void 0 : e.academicYear) === null || _7 === void 0 ? void 0 : _7.label) !== null && _8 !== void 0 ? _8 : null, isCurrentYear: (_10 = (_9 = e === null || e === void 0 ? void 0 : e.academicYear) === null || _9 === void 0 ? void 0 : _9.isCurrent) !== null && _10 !== void 0 ? _10 : null });
                                    rows.push(this.pickColumns(row, columns));
                                }
                            }
                            _14.label = 4;
                        case 4:
                            skip += batchSize;
                            return [3 /*break*/, 2];
                        case 5:
                            ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
                            XLSX.utils.sheet_add_aoa(ws, [columns], { origin: 'A1' });
                            XLSX.utils.book_append_sheet(wb, ws, 'Students');
                            buffer = XLSX.write(wb, { type: 'buffer', bookType: bookType });
                            // audit exportu
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: user.systemRole === client_1.SystemRole.SUPERADMIN
                                        ? undefined
                                        : user.organizationId,
                                    action: "STUDENT_EXPORT_".concat(String(bookType).toUpperCase()),
                                    entityId: user.systemRole === client_1.SystemRole.SUPERADMIN
                                        ? undefined
                                        : ((_11 = user.organizationId) !== null && _11 !== void 0 ? _11 : undefined),
                                    metadata: {
                                        total: total,
                                        filters: {
                                            search: q.search,
                                            yearId: q.yearId,
                                            classSectionId: q.classSectionId,
                                        },
                                        columns: columns,
                                        batchSize: batchSize,
                                        template: (_12 = q.template) !== null && _12 !== void 0 ? _12 : null,
                                        requestedFormat: (_13 = q.format) !== null && _13 !== void 0 ? _13 : null,
                                        resolvedFormat: bookType,
                                    },
                                })];
                        case 6:
                            // audit exportu
                            _14.sent();
                            filename = "".concat(filenameBase, ".").concat(bookType === 'xlsx' ? 'xlsx' : 'csv');
                            contentType = bookType === 'xlsx'
                                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                                : 'text/csv; charset=utf-8';
                            return [2 /*return*/, { buffer: buffer, contentType: contentType, filename: filename }];
                    }
                });
            });
        };
        StudentsService_1.prototype.pickColumns = function (row, columns) {
            var _a;
            var out = {};
            for (var _i = 0, columns_1 = columns; _i < columns_1.length; _i++) {
                var c = columns_1[_i];
                out[c] = (_a = row[c]) !== null && _a !== void 0 ? _a : null;
            }
            return out;
        };
        return StudentsService_1;
    }());
    __setFunctionName(_classThis, "StudentsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        StudentsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return StudentsService = _classThis;
}();
exports.StudentsService = StudentsService;
