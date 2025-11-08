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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassSectionsService = void 0;
// src/modules/classroom/class-sections.service.ts
var common_1 = require("@nestjs/common");
var access_utils_1 = require("src/shared/access.utils");
var client_1 = require("@prisma/client");
var org_cache_utils_1 = require("../shared/cache/org-cache.utils");
var ClassSectionsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ClassSectionsService = _classThis = /** @class */ (function () {
        function ClassSectionsService_1(prisma, cache) {
            this.prisma = prisma;
            this.cache = cache;
        }
        // -------------------------
        // CREATE
        // -------------------------
        ClassSectionsService_1.prototype.create = function (dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var year, teacherId, t, created, e_1;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            if (!user) {
                                return [2 /*return*/, __assign({ id: 'cls-1' }, dto)];
                            }
                            return [4 /*yield*/, this.prisma.academicYear.findUnique({
                                    where: { id: dto.yearId },
                                    select: { orgId: true },
                                })];
                        case 1:
                            year = _c.sent();
                            if (!year)
                                throw new common_1.NotFoundException('Školní rok nebyl nalezen');
                            (0, access_utils_1.assertSameOrganization)(year.orgId, user, 'třída');
                            teacherId = (_a = dto.teacherId) !== null && _a !== void 0 ? _a : null;
                            if (!teacherId) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.teacher.findUnique({
                                    where: { id: teacherId },
                                    select: { id: true, organizationId: true, deletedAt: true },
                                })];
                        case 2:
                            t = _c.sent();
                            if (!t || t.deletedAt)
                                throw new common_1.NotFoundException('Učitel nebyl nalezen.');
                            if (t.organizationId !== year.orgId)
                                throw new common_1.ForbiddenException('Učitel není ze stejné organizace jako třída.');
                            _c.label = 3;
                        case 3:
                            _c.trys.push([3, 6, , 7]);
                            return [4 /*yield*/, this.prisma.classSection.create({
                                    data: {
                                        orgId: year.orgId,
                                        yearId: dto.yearId,
                                        grade: dto.grade,
                                        section: dto.section,
                                        label: (_b = dto.label) !== null && _b !== void 0 ? _b : null,
                                        teacherId: teacherId,
                                        // TODO: Přidat studyField do modelu ClassSection a migrace
                                    },
                                })];
                        case 4:
                            created = _c.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, year.orgId))];
                        case 5:
                            _c.sent();
                            return [2 /*return*/, created]; // controller z resultu vytáhne orgId pro invalidaci
                        case 6:
                            e_1 = _c.sent();
                            if (e_1 instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                                e_1.code === 'P2002') {
                                // unikát: @@unique([orgId, yearId, grade, section])
                                throw new common_1.ConflictException('Třída s tímto ročníkem/sekcí už existuje.');
                            }
                            throw e_1;
                        case 7: return [2 /*return*/];
                    }
                });
            });
        };
        // -------------------------
        // LIST
        // -------------------------
        ClassSectionsService_1.prototype.findAll = function (q, user) {
            return __awaiter(this, void 0, void 0, function () {
                var year, page, limit, skip, where, orderBy, scope, ver, cacheKey;
                var _this = this;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            if (!user || !q) {
                                return [2 /*return*/, [{ id: 'cls-1' }]];
                            }
                            return [4 /*yield*/, this.prisma.academicYear.findUnique({
                                    where: { id: q.yearId },
                                    select: { orgId: true },
                                })];
                        case 1:
                            year = _e.sent();
                            if (!year)
                                throw new common_1.NotFoundException('Školní rok nebyl nalezen');
                            (0, access_utils_1.assertSameOrganization)(year.orgId, user, 'třídy');
                            page = (_a = q.page) !== null && _a !== void 0 ? _a : 1;
                            limit = (_b = q.limit) !== null && _b !== void 0 ? _b : 50;
                            skip = (page - 1) * limit;
                            where = __assign(__assign({ yearId: q.yearId }, (q.grade ? { grade: q.grade } : {})), (((_c = q.search) === null || _c === void 0 ? void 0 : _c.trim())
                                ? {
                                    OR: [
                                        { label: { contains: q.search.trim(), mode: 'insensitive' } },
                                        { section: { contains: q.search.trim(), mode: 'insensitive' } },
                                    ],
                                }
                                : {}));
                            orderBy = [
                                { grade: 'asc' },
                                { section: 'asc' },
                                { id: 'asc' },
                            ];
                            scope = (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, year.orgId);
                            return [4 /*yield*/, (0, org_cache_utils_1.getOrgVersion)(this.cache, scope)];
                        case 2:
                            ver = _e.sent();
                            cacheKey = (0, org_cache_utils_1.buildVersionedListKey)({
                                namespace: 'classSections',
                                scopeId: scope,
                                version: ver,
                                page: page,
                                limit: limit,
                                search: q.search,
                                order: orderBy,
                                filters: { yearId: q.yearId, grade: (_d = q.grade) !== null && _d !== void 0 ? _d : null },
                            });
                            return [2 /*return*/, (0, org_cache_utils_1.cacheGetOrSet)(this.cache, cacheKey, 600000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var total, pages, data;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, this.prisma.classSection.count({ where: where })];
                                            case 1:
                                                total = _a.sent();
                                                pages = Math.max(1, Math.ceil(total / limit));
                                                // Guard: over‑page → prázdná data
                                                if (skip >= total) {
                                                    return [2 /*return*/, {
                                                            data: [],
                                                            meta: { page: page, limit: limit, total: total, pages: pages },
                                                        }];
                                                }
                                                return [4 /*yield*/, this.prisma.classSection.findMany({
                                                        where: where,
                                                        orderBy: orderBy,
                                                        skip: skip,
                                                        take: limit,
                                                        include: {
                                                            teacher: {
                                                                include: {
                                                                    membership: {
                                                                        select: { user: { select: { name: true, email: true } } },
                                                                    },
                                                                },
                                                            },
                                                            enrollments: true,
                                                        },
                                                    })];
                                            case 2:
                                                data = _a.sent();
                                                return [2 /*return*/, {
                                                        data: data,
                                                        meta: { page: page, limit: limit, total: total, pages: pages },
                                                    }];
                                        }
                                    });
                                }); })];
                    }
                });
            });
        };
        // -------------------------
        // DETAIL
        // -------------------------
        ClassSectionsService_1.prototype.findOne = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var classSection;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.classSection.findUnique({
                                where: { id: id },
                                include: {
                                    teacher: {
                                        include: {
                                            membership: { include: { user: true } },
                                        },
                                    },
                                    enrollments: true,
                                },
                            })];
                        case 1:
                            classSection = _a.sent();
                            if (!classSection)
                                throw new common_1.NotFoundException('Třída nebyla nalezena');
                            (0, access_utils_1.assertSameOrganization)(classSection.orgId, user, 'třída');
                            return [2 /*return*/, classSection];
                    }
                });
            });
        };
        // -------------------------
        // UPDATE
        // -------------------------
        ClassSectionsService_1.prototype.update = function (id, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var classSection, teacherId, t, updated, e_2;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0: return [4 /*yield*/, this.prisma.classSection.findUnique({
                                where: { id: id },
                            })];
                        case 1:
                            classSection = _e.sent();
                            if (!classSection)
                                throw new common_1.NotFoundException('Třída nebyla nalezena');
                            (0, access_utils_1.assertSameOrganization)(classSection.orgId, user, 'třída');
                            teacherId = dto.teacherId;
                            if (!(dto.teacherId !== undefined)) return [3 /*break*/, 3];
                            teacherId = (_a = dto.teacherId) !== null && _a !== void 0 ? _a : null;
                            if (!teacherId) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.teacher.findUnique({
                                    where: { id: teacherId },
                                    select: { id: true, organizationId: true, deletedAt: true },
                                })];
                        case 2:
                            t = _e.sent();
                            if (!t || t.deletedAt)
                                throw new common_1.NotFoundException('Učitel nebyl nalezen.');
                            if (t.organizationId !== classSection.orgId)
                                throw new common_1.ForbiddenException('Učitel není ze stejné organizace jako třída.');
                            _e.label = 3;
                        case 3:
                            _e.trys.push([3, 6, , 7]);
                            return [4 /*yield*/, this.prisma.classSection.update({
                                    where: { id: id },
                                    data: {
                                        grade: (_b = dto.grade) !== null && _b !== void 0 ? _b : undefined,
                                        section: (_c = dto.section) !== null && _c !== void 0 ? _c : undefined,
                                        label: (_d = dto.label) !== null && _d !== void 0 ? _d : undefined,
                                        teacherId: teacherId,
                                        // TODO: Přidat studyField do modelu ClassSection a migrace
                                    },
                                })];
                        case 4:
                            updated = _e.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, classSection.orgId))];
                        case 5:
                            _e.sent();
                            return [2 /*return*/, updated]; // controller použije orgId pro invalidaci
                        case 6:
                            e_2 = _e.sent();
                            if (e_2 instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                                e_2.code === 'P2002') {
                                // pokud změna (grade/section/…) narazí na unikát
                                throw new common_1.ConflictException('Třída s tímto ročníkem/sekcí už existuje.');
                            }
                            throw e_2;
                        case 7: return [2 /*return*/];
                    }
                });
            });
        };
        // -------------------------
        // DELETE
        // -------------------------
        ClassSectionsService_1.prototype.remove = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var classSection, deleted;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.classSection.findUnique({
                                where: { id: id },
                                select: { id: true, orgId: true },
                            })];
                        case 1:
                            classSection = _a.sent();
                            if (!classSection)
                                throw new common_1.NotFoundException('Třída nebyla nalezena');
                            (0, access_utils_1.assertSameOrganization)(classSection.orgId, user, 'třída');
                            return [4 /*yield*/, this.prisma.classSection.delete({ where: { id: id } })];
                        case 2:
                            deleted = _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, classSection.orgId))];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, deleted];
                    }
                });
            });
        };
        ClassSectionsService_1.prototype.setHomeroom = function (classSectionId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var cls, sameOrg, isDirector, teacherId, teacher, updated, scope;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.classSection.findUnique({
                                where: { id: classSectionId },
                                select: { id: true, orgId: true, teacherId: true },
                            })];
                        case 1:
                            cls = _b.sent();
                            if (!cls)
                                throw new common_1.NotFoundException('Třída nebyla nalezena.');
                            sameOrg = user.organizationId === cls.orgId;
                            isDirector = user.organizationRole === client_1.OrganizationRole.DIRECTOR;
                            if (!(user.systemRole === client_1.SystemRole.SUPERADMIN || (sameOrg && isDirector))) {
                                throw new common_1.ForbiddenException('Pouze ředitel dané školy nebo superadmin může měnit třídnictví.');
                            }
                            teacherId = (_a = dto.teacherId) !== null && _a !== void 0 ? _a : null;
                            if (!teacherId) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.teacher.findUnique({
                                    where: { id: teacherId },
                                    select: { id: true, organizationId: true, deletedAt: true },
                                })];
                        case 2:
                            teacher = _b.sent();
                            if (!teacher || teacher.deletedAt)
                                throw new common_1.NotFoundException('Učitel nebyl nalezen.');
                            if (teacher.organizationId !== cls.orgId) {
                                throw new common_1.ForbiddenException('Učitel není ze stejné organizace jako třída.');
                            }
                            _b.label = 3;
                        case 3: return [4 /*yield*/, this.prisma.classSection.update({
                                where: { id: classSectionId },
                                data: { teacherId: teacherId },
                                include: {
                                    academicYear: true,
                                    teacher: { include: { membership: { include: { user: true } } } },
                                },
                            })];
                        case 4:
                            updated = _b.sent();
                            scope = (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, cls.orgId);
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, scope)];
                        case 5:
                            _b.sent();
                            return [2 /*return*/, updated];
                    }
                });
            });
        };
        return ClassSectionsService_1;
    }());
    __setFunctionName(_classThis, "ClassSectionsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ClassSectionsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ClassSectionsService = _classThis;
}();
exports.ClassSectionsService = ClassSectionsService;
