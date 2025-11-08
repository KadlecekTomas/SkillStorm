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
exports.SubjectsService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var org_cache_utils_1 = require("../shared/cache/org-cache.utils");
var access_utils_1 = require("src/shared/access.utils");
var SubjectsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var SubjectsService = _classThis = /** @class */ (function () {
        function SubjectsService_1(prisma, cache) {
            this.prisma = prisma;
            this.cache = cache;
        }
        /** ---------- Audit helper ---------- */
        SubjectsService_1.prototype.audit = function (opts) {
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
        /** ---------- Includes (pevně typované) ---------- */
        SubjectsService_1.prototype.subjectListInclude = function (includeLevels) {
            return client_1.Prisma.validator()({
                organization: true,
                catalogSubject: true,
                levels: includeLevels ? { include: { topics: true } } : false, // SubjectLevel[] + TopicLevel[]
                teachers: {
                    include: {
                        teacher: { include: { membership: { include: { user: true } } } },
                    },
                },
                learningMaterials: false,
            });
        };
        SubjectsService_1.prototype.subjectDetailInclude = function () {
            return client_1.Prisma.validator()({
                organization: true,
                catalogSubject: true,
                levels: { include: { topics: true } },
                teachers: {
                    include: {
                        teacher: { include: { membership: { include: { user: true } } } },
                    },
                },
                learningMaterials: true,
            });
        };
        /** ---------- CREATE ---------- */
        SubjectsService_1.prototype.create = function (dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var exists, dup, created;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            (0, access_utils_1.assertTeacherOrDirectorInOrgOrSuperadmin)(user, dto.organizationId, 'předmět');
                            if (!dto.catalogSubjectId) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.prisma.catalogSubject.findUnique({
                                    where: { id: dto.catalogSubjectId },
                                    select: { id: true },
                                })];
                        case 1:
                            exists = _b.sent();
                            if (!exists)
                                throw new common_1.NotFoundException('Zvolený katalogový předmět neexistuje.');
                            _b.label = 2;
                        case 2: return [4 /*yield*/, this.prisma.subject.findFirst({
                                where: {
                                    organizationId: dto.organizationId,
                                    name: dto.name.trim(),
                                    deletedAt: null,
                                },
                                select: { id: true },
                            })];
                        case 3:
                            dup = _b.sent();
                            if (dup)
                                throw new common_1.ConflictException('Předmět se stejným názvem v organizaci již existuje.');
                            return [4 /*yield*/, this.prisma.subject.create({
                                    data: {
                                        name: dto.name.trim(),
                                        organizationId: dto.organizationId,
                                        catalogSubjectId: (_a = dto.catalogSubjectId) !== null && _a !== void 0 ? _a : null,
                                    },
                                    select: {
                                        id: true,
                                        name: true,
                                        organizationId: true,
                                        catalogSubjectId: true,
                                        deletedAt: true,
                                    },
                                })];
                        case 4:
                            created = _b.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: dto.organizationId,
                                    action: 'SUBJECT_CREATE',
                                    entityId: created.id,
                                    changedFields: dto,
                                })];
                        case 5:
                            _b.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, dto.organizationId))];
                        case 6:
                            _b.sent();
                            return [2 /*return*/, created]; // obsahuje organizationId → controller invaliduje scope
                    }
                });
            });
        };
        /** ---------- LIST (search + pagination + cache s verzí) ---------- */
        SubjectsService_1.prototype.findAll = function (user, q) {
            return __awaiter(this, void 0, void 0, function () {
                var page, limit, skip, isSuper, scopedOrgId, where, s, include, scopeId, ver, cacheKey;
                var _this = this;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            page = (_a = q.page) !== null && _a !== void 0 ? _a : 1;
                            limit = (_b = q.limit) !== null && _b !== void 0 ? _b : 20;
                            skip = (page - 1) * limit;
                            isSuper = user.systemRole === client_1.SystemRole.SUPERADMIN;
                            scopedOrgId = isSuper ? null : user.organizationId;
                            where = isSuper
                                ? { deletedAt: null }
                                : { deletedAt: null, organizationId: scopedOrgId };
                            s = (0, access_utils_1.makeSubjectSearch)(q.search);
                            if (s)
                                Object.assign(where, s);
                            include = this.subjectListInclude(q.includeLevels);
                            scopeId = (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, user.organizationId);
                            return [4 /*yield*/, (0, org_cache_utils_1.getOrgVersion)(this.cache, scopeId)];
                        case 1:
                            ver = _c.sent();
                            cacheKey = (0, org_cache_utils_1.buildVersionedListKey)({
                                namespace: 'subjects',
                                scopeId: scopeId,
                                version: ver,
                                page: page,
                                limit: limit,
                                search: q.search,
                                includeLevels: q.includeLevels,
                                order: [{ name: 'asc' }, { id: 'asc' }],
                                filters: null,
                            });
                            return [2 /*return*/, (0, org_cache_utils_1.cacheGetOrSet)(this.cache, cacheKey, 600000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var _a, total, data;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, this.prisma.$transaction([
                                                    this.prisma.subject.count({ where: where }),
                                                    this.prisma.subject.findMany({
                                                        where: where,
                                                        include: include,
                                                        orderBy: [{ name: 'asc' }, { id: 'asc' }],
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
        /** ---------- DETAIL ---------- */
        SubjectsService_1.prototype.findOne = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var include, subject;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            include = this.subjectDetailInclude();
                            return [4 /*yield*/, this.prisma.subject.findUnique({
                                    where: { id: id },
                                    include: include,
                                })];
                        case 1:
                            subject = _a.sent();
                            if (!subject || subject.deletedAt)
                                throw new common_1.NotFoundException('Předmět nebyl nalezen');
                            (0, access_utils_1.assertReadScope)(user, subject.organizationId, 'předmět');
                            return [2 /*return*/, subject];
                    }
                });
            });
        };
        /** ---------- UPDATE ---------- */
        SubjectsService_1.prototype.update = function (id, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var current, exists, dup, updated;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, this.prisma.subject.findUnique({
                                where: { id: id },
                                select: {
                                    id: true,
                                    name: true,
                                    organizationId: true,
                                    catalogSubjectId: true,
                                    deletedAt: true,
                                },
                            })];
                        case 1:
                            current = _d.sent();
                            if (!current || current.deletedAt)
                                throw new common_1.NotFoundException('Předmět nebyl nalezen');
                            (0, access_utils_1.assertTeacherOrDirectorInOrgOrSuperadmin)(user, current.organizationId, 'předmět');
                            if (!dto.catalogSubjectId) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.catalogSubject.findUnique({
                                    where: { id: dto.catalogSubjectId },
                                    select: { id: true },
                                })];
                        case 2:
                            exists = _d.sent();
                            if (!exists)
                                throw new common_1.NotFoundException('Zvolený katalogový předmět neexistuje.');
                            _d.label = 3;
                        case 3:
                            if (!(dto.name && dto.name.trim() !== current.name)) return [3 /*break*/, 5];
                            return [4 /*yield*/, this.prisma.subject.findFirst({
                                    where: {
                                        organizationId: current.organizationId,
                                        name: dto.name.trim(),
                                        deletedAt: null,
                                        NOT: { id: id },
                                    },
                                    select: { id: true },
                                })];
                        case 4:
                            dup = _d.sent();
                            if (dup)
                                throw new common_1.ConflictException('Předmět se stejným názvem v organizaci již existuje.');
                            _d.label = 5;
                        case 5: return [4 /*yield*/, this.prisma.subject.update({
                                where: { id: id },
                                data: {
                                    name: (_b = (_a = dto.name) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : undefined,
                                    catalogSubjectId: (_c = dto.catalogSubjectId) !== null && _c !== void 0 ? _c : undefined,
                                },
                                select: {
                                    id: true,
                                    name: true,
                                    organizationId: true,
                                    catalogSubjectId: true,
                                    deletedAt: true,
                                },
                            })];
                        case 6:
                            updated = _d.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: current.organizationId,
                                    action: 'SUBJECT_UPDATE',
                                    entityId: id,
                                    changedFields: dto,
                                })];
                        case 7:
                            _d.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, current.organizationId))];
                        case 8:
                            _d.sent();
                            return [2 /*return*/, updated]; // obsahuje organizationId → controller invaliduje scope
                    }
                });
            });
        };
        /** ---------- DELETE (soft) ---------- */
        SubjectsService_1.prototype.remove = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var subject, deleted;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.subject.findUnique({
                                where: { id: id },
                                select: { id: true, name: true, organizationId: true },
                            })];
                        case 1:
                            subject = _a.sent();
                            if (!subject)
                                throw new common_1.NotFoundException('Předmět nebyl nalezen');
                            (0, access_utils_1.assertTeacherOrDirectorInOrgOrSuperadmin)(user, subject.organizationId, 'předmět');
                            return [4 /*yield*/, this.prisma.subject.update({
                                    where: { id: id },
                                    data: { deletedAt: new Date() },
                                    select: { id: true, organizationId: true },
                                })];
                        case 2:
                            deleted = _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: subject.organizationId,
                                    action: 'SUBJECT_DELETE_SOFT',
                                    entityId: id,
                                    metadata: { name: subject.name },
                                })];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, subject.organizationId))];
                        case 4:
                            _a.sent();
                            return [2 /*return*/, deleted];
                    }
                });
            });
        };
        /** ---------- Subject → Levels ---------- */
        SubjectsService_1.prototype.findLevels = function (subjectId, user) {
            return __awaiter(this, void 0, void 0, function () {
                var subj;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.subject.findUnique({
                                where: { id: subjectId },
                            })];
                        case 1:
                            subj = _a.sent();
                            if (!subj || subj.deletedAt)
                                throw new common_1.NotFoundException('Předmět nebyl nalezen');
                            (0, access_utils_1.assertReadScope)(user, subj.organizationId, 'předmět');
                            return [2 /*return*/, this.prisma.subjectLevel.findMany({
                                    where: { subjectId: subjectId },
                                    include: { topics: true }, // TopicLevel[]
                                    orderBy: [{ grade: 'asc' }, { order: 'asc' }],
                                })];
                    }
                });
            });
        };
        /** ---------- Subject → TopicLevels (přes Levels) ---------- */
        SubjectsService_1.prototype.findTopicLevels = function (subjectId, user) {
            return __awaiter(this, void 0, void 0, function () {
                var subj, levels;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.subject.findUnique({
                                where: { id: subjectId },
                            })];
                        case 1:
                            subj = _a.sent();
                            if (!subj || subj.deletedAt)
                                throw new common_1.NotFoundException('Předmět nebyl nalezen');
                            (0, access_utils_1.assertReadScope)(user, subj.organizationId, 'předmět');
                            return [4 /*yield*/, this.prisma.subjectLevel.findMany({
                                    where: { subjectId: subjectId },
                                    select: { id: true },
                                })];
                        case 2:
                            levels = _a.sent();
                            if (levels.length === 0)
                                return [2 /*return*/, []];
                            return [2 /*return*/, this.prisma.topicLevel.findMany({
                                    where: { subjectLevelId: { in: levels.map(function (l) { return l.id; }) } },
                                    include: { catalogTopic: true },
                                    orderBy: [{ subjectLevelId: 'asc' }, { order: 'asc' }],
                                })];
                    }
                });
            });
        };
        return SubjectsService_1;
    }());
    __setFunctionName(_classThis, "SubjectsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        SubjectsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return SubjectsService = _classThis;
}();
exports.SubjectsService = SubjectsService;
