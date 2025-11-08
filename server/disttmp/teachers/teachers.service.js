"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeachersService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var org_cache_utils_1 = require("../shared/cache/org-cache.utils");
function teacherSearch(search) {
    var raw = search === null || search === void 0 ? void 0 : search.trim();
    if (!raw)
        return undefined;
    var s = raw.replace(/\s+/g, ' ');
    return {
        membership: {
            is: {
                user: {
                    OR: [
                        { name: { contains: s, mode: 'insensitive' } },
                        { email: { contains: s, mode: 'insensitive' } },
                        { username: { contains: s, mode: 'insensitive' } },
                    ],
                },
            },
        },
    };
}
var TeachersService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var TeachersService = _classThis = /** @class */ (function () {
        function TeachersService_1(prisma, cache) {
            this.prisma = prisma;
            this.cache = cache;
        }
        // ---------- Audit ----------
        TeachersService_1.prototype.audit = function (opts) {
            var _a, _b, _c, _d, _e;
            return this.prisma.auditLog.create({
                data: {
                    userId: (_a = opts.userId) !== null && _a !== void 0 ? _a : null,
                    organizationId: (_b = opts.orgId) !== null && _b !== void 0 ? _b : null,
                    entityType: client_1.AuditEntityType.ORGANIZATION,
                    entityId: (_c = opts.entityId) !== null && _c !== void 0 ? _c : null,
                    action: opts.action,
                    metadata: (_d = opts.metadata) !== null && _d !== void 0 ? _d : null,
                    changedFields: (_e = opts.changedFields) !== null && _e !== void 0 ? _e : null,
                },
            });
        };
        // ---------- Includes (typově bezpečné) ----------
        TeachersService_1.prototype.teacherListInclude = function () {
            return client_1.Prisma.validator()({
                membership: { include: { user: true } },
                subjects: { include: { subject: true } }, // TeacherSubject[] + Subject
                homeroomOf: { include: { academicYear: true } }, // ClassSection[]
            });
        };
        TeachersService_1.prototype.teacherDetailInclude = function () {
            return this.teacherListInclude();
        };
        // ---------- CREATE ----------
        TeachersService_1.prototype.create = function (dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var membership, sameOrg, exists, created;
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
                            // role TEACHER
                            if (membership.role !== client_1.OrganizationRole.TEACHER) {
                                throw new common_1.ConflictException('Membership nemá roli TEACHER.');
                            }
                            // membership patří do zadané org
                            if (membership.organizationId !== dto.organizationId) {
                                throw new common_1.ForbiddenException('Membership nepatří do zadané organizace.');
                            }
                            sameOrg = user.organizationId === dto.organizationId;
                            if (!(user.systemRole === client_1.SystemRole.SUPERADMIN ||
                                (sameOrg && user.organizationRole === client_1.OrganizationRole.DIRECTOR))) {
                                throw new common_1.ForbiddenException('Pouze ředitel dané školy nebo superadmin může vytvořit učitele.');
                            }
                            return [4 /*yield*/, this.prisma.teacher.findUnique({
                                    where: { membershipId: dto.membershipId },
                                    select: { id: true },
                                })];
                        case 2:
                            exists = _a.sent();
                            if (exists)
                                throw new common_1.ConflictException('Tento člen je již zapsán jako učitel.');
                            return [4 /*yield*/, this.prisma.teacher.create({
                                    data: {
                                        membershipId: dto.membershipId,
                                        organizationId: dto.organizationId,
                                    },
                                })];
                        case 3:
                            created = _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: dto.organizationId,
                                    action: 'TEACHER_CREATE',
                                    entityId: created.id,
                                    changedFields: dto,
                                })];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, dto.organizationId))];
                        case 5:
                            _a.sent();
                            return [2 /*return*/, created];
                    }
                });
            });
        };
        // ---------- LIST (search + pagination + cache + soft delete) ----------
        // teachers.service.ts
        // ---------- LIST (search + pagination + cache + soft delete) ----------
        TeachersService_1.prototype.findAll = function (user, q) {
            return __awaiter(this, void 0, void 0, function () {
                var page, limit, skip, isSuper, effectiveOrgId, member, where, t, include, scopeId, ver, cacheKey;
                var _this = this;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            page = (_a = q.page) !== null && _a !== void 0 ? _a : 1;
                            limit = (_b = q.limit) !== null && _b !== void 0 ? _b : 20;
                            skip = (page - 1) * limit;
                            isSuper = user.systemRole === client_1.SystemRole.SUPERADMIN;
                            effectiveOrgId = null;
                            if (!isSuper) return [3 /*break*/, 1];
                            if (!q.organizationId) {
                                throw new common_1.BadRequestException('organizationId is required for SUPERADMIN.');
                            }
                            effectiveOrgId = q.organizationId;
                            return [3 /*break*/, 3];
                        case 1:
                            // pro nesuperadmina preferuj org z query (pokud přichází z UI), jinak z JWT
                            effectiveOrgId = (_d = (_c = q.organizationId) !== null && _c !== void 0 ? _c : user.organizationId) !== null && _d !== void 0 ? _d : null;
                            if (!effectiveOrgId) {
                                throw new common_1.ForbiddenException('Missing organization context.');
                            }
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: {
                                        userId: user.userId,
                                        organizationId: effectiveOrgId,
                                        role: client_1.OrganizationRole.DIRECTOR,
                                        deletedAt: null,
                                    },
                                    select: { id: true },
                                })];
                        case 2:
                            member = _e.sent();
                            if (!member) {
                                // nechceme vyzrazovat existenci → klidně NotFound; pro testy držíme 403
                                throw new common_1.ForbiddenException('Cross-organization listing is forbidden.');
                            }
                            _e.label = 3;
                        case 3:
                            where = {
                                deletedAt: null,
                                organizationId: effectiveOrgId,
                            };
                            t = teacherSearch(q.search);
                            if (t)
                                Object.assign(where, t);
                            include = this.teacherListInclude();
                            scopeId = effectiveOrgId;
                            return [4 /*yield*/, (0, org_cache_utils_1.getOrgVersion)(this.cache, scopeId)];
                        case 4:
                            ver = _e.sent();
                            cacheKey = (0, org_cache_utils_1.buildVersionedListKey)({
                                namespace: 'teachers',
                                scopeId: scopeId,
                                version: ver,
                                page: page,
                                limit: limit,
                                search: q.search,
                                order: [{ membership: { user: { name: 'asc' } } }, { id: 'asc' }],
                                filters: null,
                            });
                            return [2 /*return*/, (0, org_cache_utils_1.cacheGetOrSet)(this.cache, cacheKey, 600000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var _a, total, items;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, this.prisma.$transaction([
                                                    this.prisma.teacher.count({ where: where }),
                                                    this.prisma.teacher.findMany({
                                                        where: where,
                                                        include: include,
                                                        orderBy: [{ membership: { user: { name: 'asc' } } }, { id: 'asc' }],
                                                        skip: skip,
                                                        take: limit,
                                                    }),
                                                ])];
                                            case 1:
                                                _a = _b.sent(), total = _a[0], items = _a[1];
                                                return [2 /*return*/, {
                                                        items: items,
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
        TeachersService_1.prototype.findOne = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var teacher, member;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.teacher.findFirst({
                                where: { id: id, deletedAt: null },
                                include: { subjects: { select: { subjectId: true } } }, // aby test "změna je vidět hned" prošel
                            })];
                        case 1:
                            teacher = _b.sent();
                            if (!teacher)
                                throw new common_1.NotFoundException('Teacher not found');
                            // superadmin může vše
                            if ((user === null || user === void 0 ? void 0 : user.systemRole) === client_1.SystemRole.SUPERADMIN)
                                return [2 /*return*/, teacher];
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: {
                                        userId: (_a = user === null || user === void 0 ? void 0 : user.userId) !== null && _a !== void 0 ? _a : user === null || user === void 0 ? void 0 : user.sub,
                                        organizationId: teacher.organizationId,
                                        deletedAt: null,
                                    },
                                    select: { id: true },
                                })];
                        case 2:
                            member = _b.sent();
                            if (!member) {
                                // pokud chceš maskovat existenci, můžeš dát místo 403 -> NotFoundException
                                throw new common_1.ForbiddenException('Access denied');
                            }
                            return [2 /*return*/, teacher];
                    }
                });
            });
        };
        // ---------- UPDATE ----------
        TeachersService_1.prototype.update = function (id, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var current, sameOrg, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.teacher.findUnique({
                                where: { id: id },
                                select: {
                                    id: true,
                                    membershipId: true,
                                    organizationId: true,
                                    deletedAt: true,
                                },
                            })];
                        case 1:
                            current = _a.sent();
                            if (!current || current.deletedAt)
                                throw new common_1.NotFoundException('Učitel nebyl nalezen');
                            sameOrg = user.organizationId === current.organizationId;
                            if (!(user.systemRole === client_1.SystemRole.SUPERADMIN ||
                                (sameOrg && user.organizationRole === client_1.OrganizationRole.DIRECTOR))) {
                                throw new common_1.ForbiddenException('Pouze ředitel dané školy nebo superadmin může upravit učitele.');
                            }
                            // bezpečnost: zákaz přehazování membership/org
                            if (dto.membershipId && dto.membershipId !== current.membershipId) {
                                throw new common_1.ConflictException('Změna membershipId není povolena.');
                            }
                            if (dto.organizationId && dto.organizationId !== current.organizationId) {
                                throw new common_1.ConflictException('Změna organizationId není povolena.');
                            }
                            return [4 /*yield*/, this.prisma.teacher.update({
                                    where: { id: id },
                                    data: {},
                                })];
                        case 2:
                            updated = _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: current.organizationId,
                                    action: 'TEACHER_UPDATE',
                                    entityId: id,
                                    changedFields: dto,
                                })];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, current.organizationId))];
                        case 4:
                            _a.sent();
                            return [2 /*return*/, updated];
                    }
                });
            });
        };
        // ---------- DELETE (soft) ----------
        TeachersService_1.prototype.remove = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var teacher, sameOrg, deleted;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.teacher.findUnique({
                                where: { id: id },
                                select: { id: true, organizationId: true, deletedAt: true },
                            })];
                        case 1:
                            teacher = _a.sent();
                            if (!teacher)
                                throw new common_1.NotFoundException('Učitel nebyl nalezen');
                            sameOrg = user.organizationId === teacher.organizationId;
                            if (!(user.systemRole === client_1.SystemRole.SUPERADMIN ||
                                (sameOrg && user.organizationRole === client_1.OrganizationRole.DIRECTOR))) {
                                throw new common_1.ForbiddenException('Pouze ředitel dané školy nebo superadmin může smazat učitele.');
                            }
                            return [4 /*yield*/, this.prisma.teacher.update({
                                    where: { id: id },
                                    data: { deletedAt: new Date() },
                                })];
                        case 2:
                            deleted = _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: teacher.organizationId,
                                    action: 'TEACHER_DELETE_SOFT',
                                    entityId: id,
                                })];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, teacher.organizationId))];
                        case 4:
                            _a.sent();
                            return [2 /*return*/, deleted];
                    }
                });
            });
        };
        /**
         * Přiřazení předmětů učiteli.
         * - validace: superadmin nebo ředitel stejné školy
         * - kontrola, že všechny subjectIds patří do stejné organizace jako teacher
         * - replaceAll=true → transakčně smaže ostatní vazby a přidá jen uvedené
         * - replaceAll=false/undefined → pouze doplní chybějící vazby
         * - audit + cache invalidace (teachers+subjects scope)
         */
        TeachersService_1.prototype.assignSubjects = function (teacherId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var teacher, sameOrg, isAllowed, uniqueIds, subjectsAll, foreign, existing, existingIds_1, toAdd;
                var _this = this;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.teacher.findUnique({
                                where: { id: teacherId },
                                select: { id: true, organizationId: true, deletedAt: true },
                            })];
                        case 1:
                            teacher = _b.sent();
                            if (!teacher || teacher.deletedAt) {
                                throw new common_1.NotFoundException('Učitel nebyl nalezen');
                            }
                            sameOrg = user.organizationId === teacher.organizationId;
                            isAllowed = user.systemRole === client_1.SystemRole.SUPERADMIN ||
                                (sameOrg && user.organizationRole === client_1.OrganizationRole.DIRECTOR);
                            if (!isAllowed) {
                                throw new common_1.ForbiddenException('Pouze ředitel dané školy nebo superadmin může přiřazovat předměty.');
                            }
                            uniqueIds = Array.from(new Set((_a = dto.subjectIds) !== null && _a !== void 0 ? _a : []));
                            if (uniqueIds.length === 0) {
                                // replaceAll s prázdným polem = odstraní vše, add režim s prázdnem = no‑op
                                // necháme to projít – chování vyřešíme níž
                            }
                            if (!(uniqueIds.length > 0)) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.subject.findMany({
                                    where: { id: { in: uniqueIds }, deletedAt: null },
                                    select: { id: true, organizationId: true },
                                })];
                        case 2:
                            subjectsAll = _b.sent();
                            if (subjectsAll.length !== uniqueIds.length) {
                                // někdo neexistuje / smazán → 404
                                throw new common_1.NotFoundException('Některé zadané předměty neexistují.');
                            }
                            foreign = subjectsAll.find(function (s) { return s.organizationId !== teacher.organizationId; });
                            if (foreign) {
                                // cross‑org pokus → 403 (pokud chceš maskovat, dej raději NotFound)
                                throw new common_1.ForbiddenException('Předmět patří do jiné organizace.');
                            }
                            _b.label = 3;
                        case 3:
                            if (!(dto.replaceAll === true)) return [3 /*break*/, 5];
                            // REPLACE režim – atomicky, ať paralelní požadavky skončí konzistentně
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.teacherSubject.deleteMany({ where: { teacherId: teacherId } })];
                                            case 1:
                                                _a.sent();
                                                if (!(uniqueIds.length > 0)) return [3 /*break*/, 3];
                                                return [4 /*yield*/, tx.teacherSubject.createMany({
                                                        data: uniqueIds.map(function (id) { return ({ teacherId: teacherId, subjectId: id }); }),
                                                        skipDuplicates: true,
                                                    })];
                                            case 2:
                                                _a.sent();
                                                _a.label = 3;
                                            case 3: return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 4:
                            // REPLACE režim – atomicky, ať paralelní požadavky skončí konzistentně
                            _b.sent();
                            return [3 /*break*/, 8];
                        case 5:
                            if (!(uniqueIds.length > 0)) return [3 /*break*/, 8];
                            return [4 /*yield*/, this.prisma.teacherSubject.findMany({
                                    where: { teacherId: teacherId, subjectId: { in: uniqueIds } },
                                    select: { subjectId: true },
                                })];
                        case 6:
                            existing = _b.sent();
                            existingIds_1 = new Set(existing.map(function (e) { return e.subjectId; }));
                            toAdd = uniqueIds.filter(function (id) { return !existingIds_1.has(id); });
                            if (!(toAdd.length > 0)) return [3 /*break*/, 8];
                            return [4 /*yield*/, this.prisma.teacherSubject.createMany({
                                    data: toAdd.map(function (id) { return ({ teacherId: teacherId, subjectId: id }); }),
                                    skipDuplicates: true,
                                })];
                        case 7:
                            _b.sent();
                            _b.label = 8;
                        case 8: 
                        // 6) Audit
                        return [4 /*yield*/, this.audit({
                                userId: user.userId,
                                orgId: teacher.organizationId,
                                action: dto.replaceAll
                                    ? 'TEACHER_SUBJECTS_REPLACE'
                                    : 'TEACHER_SUBJECTS_ADD',
                                entityId: teacherId,
                                metadata: { subjectIds: uniqueIds, replaceAll: !!dto.replaceAll },
                            })];
                        case 9:
                            // 6) Audit
                            _b.sent();
                            // 7) Cache invalidace – stačí bumpnout verzi organizace
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, teacher.organizationId)];
                        case 10:
                            // 7) Cache invalidace – stačí bumpnout verzi organizace
                            _b.sent();
                            // 8) Vrať aktuální stav – přes centrální findOne (musí includovat subjects)
                            return [2 /*return*/, this.findOne(teacherId, user)];
                    }
                });
            });
        };
        /**
         * Odstranění jedné vazby teacher–subject.
         */
        TeachersService_1.prototype.removeSubject = function (teacherId, subjectId, user) {
            return __awaiter(this, void 0, void 0, function () {
                var teacher, sameOrg, subject, scope;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.teacher.findUnique({
                                where: { id: teacherId },
                                select: { id: true, organizationId: true, deletedAt: true },
                            })];
                        case 1:
                            teacher = _a.sent();
                            if (!teacher || teacher.deletedAt)
                                throw new common_1.NotFoundException('Učitel nebyl nalezen');
                            sameOrg = user.organizationId === teacher.organizationId;
                            if (!(user.systemRole === client_1.SystemRole.SUPERADMIN ||
                                (sameOrg && user.organizationRole === client_1.OrganizationRole.DIRECTOR))) {
                                throw new common_1.ForbiddenException('Pouze ředitel dané školy nebo superadmin může odebírat předměty.');
                            }
                            return [4 /*yield*/, this.prisma.subject.findFirst({
                                    where: {
                                        id: subjectId,
                                        organizationId: teacher.organizationId,
                                        deletedAt: null,
                                    },
                                    select: { id: true },
                                })];
                        case 2:
                            subject = _a.sent();
                            if (!subject)
                                throw new common_1.NotFoundException('Předmět neexistuje nebo nepatří do stejné organizace.');
                            return [4 /*yield*/, this.prisma.teacherSubject.deleteMany({
                                    where: { teacherId: teacherId, subjectId: subjectId },
                                })];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: teacher.organizationId,
                                    action: 'TEACHER_SUBJECT_REMOVE',
                                    entityId: teacherId,
                                    metadata: { subjectId: subjectId },
                                })];
                        case 4:
                            _a.sent();
                            scope = (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, teacher.organizationId);
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, scope)];
                        case 5:
                            _a.sent(); // teachers i subjects sdílí scope
                            return [2 /*return*/, { ok: true }];
                    }
                });
            });
        };
        return TeachersService_1;
    }());
    __setFunctionName(_classThis, "TeachersService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        TeachersService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return TeachersService = _classThis;
}();
exports.TeachersService = TeachersService;
