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
exports.TopicsService = void 0;
// src/topic/topic.service.ts
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var access_utils_1 = require("src/shared/access.utils");
var org_cache_utils_1 = require("../shared/cache/org-cache.utils");
var TopicsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var TopicsService = _classThis = /** @class */ (function () {
        function TopicsService_1(prisma, cache) {
            this.prisma = prisma;
            this.cache = cache;
        }
        // ------- helpers -------
        TopicsService_1.prototype.getOrgIdBySubjectLevelId = function (subjectLevelId) {
            return __awaiter(this, void 0, void 0, function () {
                var sl;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.subjectLevel.findUnique({
                                where: { id: subjectLevelId },
                                select: { subject: { select: { organizationId: true } } },
                            })];
                        case 1:
                            sl = _a.sent();
                            if (!sl)
                                throw new common_1.NotFoundException('SubjectLevel nebyl nalezen.');
                            return [2 /*return*/, sl.subject.organizationId];
                    }
                });
            });
        };
        TopicsService_1.prototype.getTopicLevelOrg = function (topicLevelId) {
            return __awaiter(this, void 0, void 0, function () {
                var tl;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.topicLevel.findUnique({
                                where: { id: topicLevelId },
                                select: {
                                    subjectLevel: {
                                        select: { subject: { select: { organizationId: true } } },
                                    },
                                },
                            })];
                        case 1:
                            tl = _a.sent();
                            if (!tl)
                                throw new common_1.NotFoundException('TopicLevel nebyl nalezen.');
                            return [2 /*return*/, tl.subjectLevel.subject.organizationId];
                    }
                });
            });
        };
        TopicsService_1.prototype.audit = function (opts) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0: return [4 /*yield*/, this.prisma.auditLog.create({
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
                        case 1:
                            _f.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        // jen „bezpečné“ include (žádné assignments atd. – ty se dotáhnou ručně)
        TopicsService_1.prototype.includeBase = function () {
            return client_1.Prisma.validator()({
                catalogTopic: true,
                subjectLevel: { include: { subject: true } },
            });
        };
        // složí payload tak, jak to chtějí testy:
        // - LearningMaterial: [{ id, title }]
        // - assignments: [{ testId, order, isPrimary }]
        TopicsService_1.prototype.buildTopicPayload = function (topicId) {
            return __awaiter(this, void 0, void 0, function () {
                var topic, matAssigns, LearningMaterial, testAssigns;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.topicLevel.findUnique({
                                where: { id: topicId },
                                include: this.includeBase(),
                            })];
                        case 1:
                            topic = _a.sent();
                            if (!topic)
                                return [2 /*return*/, null];
                            return [4 /*yield*/, this.prisma.materialAssignment.findMany({
                                    where: { topicLevelId: topicId },
                                    include: {
                                        // POZOR: pokud se relation v schema jmenuje jinak (např. "material"),
                                        // přejmenuj tento klíč z "learningMaterial" na správný.
                                        material: { select: { id: true, title: true } },
                                    },
                                    orderBy: { order: 'asc' },
                                })];
                        case 2:
                            matAssigns = _a.sent();
                            LearningMaterial = matAssigns.map(function (a) { return a.material; });
                            return [4 /*yield*/, this.prisma.testAssignment.findMany({
                                    where: { topicLevelId: topicId },
                                    select: { testId: true, order: true, isPrimary: true },
                                    orderBy: { order: 'asc' },
                                })];
                        case 3:
                            testAssigns = _a.sent();
                            return [2 /*return*/, __assign(__assign({}, topic), { LearningMaterial: LearningMaterial, assignments: testAssigns })];
                    }
                });
            });
        };
        TopicsService_1.prototype.search = function (search) {
            var raw = search === null || search === void 0 ? void 0 : search.trim();
            if (!raw)
                return undefined;
            var s = raw.replace(/\s+/g, ' ');
            return {
                OR: [
                    { name: { contains: s, mode: 'insensitive' } },
                    {
                        catalogTopic: { is: { name: { contains: s, mode: 'insensitive' } } },
                    },
                ],
            };
        };
        // ------- CREATE -------
        TopicsService_1.prototype.create = function (dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var orgId, catalogOk, phase, exists, created, payload;
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0: return [4 /*yield*/, this.getOrgIdBySubjectLevelId(dto.subjectLevelId)];
                        case 1:
                            orgId = _f.sent();
                            (0, access_utils_1.assertSameOrganization)(orgId, user, 'téma');
                            return [4 /*yield*/, this.prisma.catalogTopic.findUnique({
                                    where: { id: dto.catalogTopicId },
                                    select: { id: true },
                                })];
                        case 2:
                            catalogOk = _f.sent();
                            if (!catalogOk)
                                throw new common_1.NotFoundException('CatalogTopic neexistuje.');
                            phase = (_a = dto.phase) !== null && _a !== void 0 ? _a : client_1.TopicPhase.INTRO;
                            return [4 /*yield*/, this.prisma.topicLevel.findUnique({
                                    where: {
                                        subjectLevelId_catalogTopicId_phase: {
                                            subjectLevelId: dto.subjectLevelId,
                                            catalogTopicId: dto.catalogTopicId,
                                            phase: phase,
                                        },
                                    },
                                    select: { id: true },
                                })];
                        case 3:
                            exists = _f.sent();
                            if (exists) {
                                throw new common_1.ConflictException('Tento TopicLevel (phase) už v daném SubjectLevel existuje.');
                            }
                            return [4 /*yield*/, this.prisma.topicLevel.create({
                                    data: {
                                        subjectLevelId: dto.subjectLevelId,
                                        catalogTopicId: dto.catalogTopicId,
                                        name: (_c = (_b = dto.name) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : null,
                                        phase: phase,
                                        difficulty: (_d = dto.difficulty) !== null && _d !== void 0 ? _d : client_1.Difficulty.BASIC,
                                        order: (_e = dto.order) !== null && _e !== void 0 ? _e : null,
                                    },
                                    include: this.includeBase(),
                                })];
                        case 4:
                            created = _f.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: orgId,
                                    action: 'TOPICLEVEL_CREATE',
                                    entityId: created.id,
                                    changedFields: dto,
                                })];
                        case 5:
                            _f.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, orgId))];
                        case 6:
                            _f.sent();
                            return [4 /*yield*/, this.buildTopicPayload(created.id)];
                        case 7:
                            payload = _f.sent();
                            return [2 /*return*/, __assign(__assign({}, payload), { organizationId: orgId })];
                    }
                });
            });
        };
        // ------- LIST (versioned cache) -------
        TopicsService_1.prototype.findAll = function (user, q) {
            return __awaiter(this, void 0, void 0, function () {
                var page, limit, skip, where, orgScope, s, include, version, cacheKey;
                var _this = this;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            page = (_a = q.page) !== null && _a !== void 0 ? _a : 1;
                            limit = (_b = q.limit) !== null && _b !== void 0 ? _b : 20;
                            skip = (page - 1) * limit;
                            where = {};
                            orgScope = 'ALL';
                            if (user.systemRole !== 'SUPERADMIN') {
                                orgScope = user.organizationId;
                                where = {
                                    subjectLevel: { subject: { organizationId: user.organizationId } },
                                };
                            }
                            if (q.subjectId) {
                                where = __assign(__assign({}, where), { subjectLevel: { subject: { id: q.subjectId } } });
                            }
                            if (q.subjectLevelId) {
                                where = __assign(__assign({}, where), { subjectLevelId: q.subjectLevelId });
                            }
                            s = this.search(q.search);
                            if (s)
                                where = { AND: [where, s] };
                            include = this.includeBase();
                            return [4 /*yield*/, (0, org_cache_utils_1.getOrgVersion)(this.cache, orgScope)];
                        case 1:
                            version = _e.sent();
                            cacheKey = (0, org_cache_utils_1.buildVersionedListKey)({
                                namespace: 'topics',
                                scopeId: orgScope,
                                version: version,
                                page: page,
                                limit: limit,
                                search: q.search,
                                order: [{ subjectLevelId: 'asc' }, { order: 'asc' }, { id: 'asc' }],
                                filters: {
                                    subjectId: (_c = q.subjectId) !== null && _c !== void 0 ? _c : null,
                                    subjectLevelId: (_d = q.subjectLevelId) !== null && _d !== void 0 ? _d : null,
                                    super: user.systemRole === 'SUPERADMIN',
                                },
                            });
                            return [2 /*return*/, (0, org_cache_utils_1.cacheGetOrSet)(this.cache, cacheKey, 300000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var _a, total, data;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, this.prisma.$transaction([
                                                    this.prisma.topicLevel.count({ where: where }),
                                                    this.prisma.topicLevel.findMany({
                                                        where: where,
                                                        include: include,
                                                        orderBy: [{ subjectLevelId: 'asc' }, { order: 'asc' }, { id: 'asc' }],
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
        // ------- DETAIL (versioned cache) -------
        TopicsService_1.prototype.findOne = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var base, orgId, scope, version, cacheKey;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.topicLevel.findUnique({
                                where: { id: id },
                                select: {
                                    subjectLevel: {
                                        select: { subject: { select: { organizationId: true } } },
                                    },
                                },
                            })];
                        case 1:
                            base = _a.sent();
                            if (!base)
                                throw new common_1.NotFoundException('Téma nebylo nalezeno.');
                            orgId = base.subjectLevel.subject.organizationId;
                            (0, access_utils_1.assertSameOrganization)(orgId, user, 'téma');
                            scope = (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, orgId);
                            return [4 /*yield*/, (0, org_cache_utils_1.getOrgVersion)(this.cache, scope)];
                        case 2:
                            version = _a.sent();
                            cacheKey = "topics:detail:".concat(id, ":v").concat(version, ":scope:").concat(scope);
                            return [2 /*return*/, (0, org_cache_utils_1.cacheGetOrSet)(this.cache, cacheKey, 300000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var payload;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, this.buildTopicPayload(id)];
                                            case 1:
                                                payload = _a.sent();
                                                if (!payload)
                                                    throw new common_1.NotFoundException('Téma nebylo nalezeno.');
                                                return [2 /*return*/, payload];
                                        }
                                    });
                                }); })];
                    }
                });
            });
        };
        // ------- BY SUBJECT (versioned cache) -------
        TopicsService_1.prototype.findBySubjectId = function (subjectId, user) {
            return __awaiter(this, void 0, void 0, function () {
                var subj, scope, version, cacheKey;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.subject.findUnique({
                                where: { id: subjectId },
                                select: { organizationId: true },
                            })];
                        case 1:
                            subj = _a.sent();
                            if (!subj)
                                throw new common_1.NotFoundException('Předmět nebyl nalezen.');
                            (0, access_utils_1.assertSameOrganization)(subj.organizationId, user, 'předmět');
                            scope = (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, subj.organizationId);
                            return [4 /*yield*/, (0, org_cache_utils_1.getOrgVersion)(this.cache, scope)];
                        case 2:
                            version = _a.sent();
                            cacheKey = (0, org_cache_utils_1.buildVersionedListKey)({
                                namespace: 'topics-by-subject',
                                scopeId: scope,
                                version: version,
                                filters: { subjectId: subjectId },
                                order: [{ subjectLevelId: 'asc' }, { order: 'asc' }, { id: 'asc' }],
                                page: 1,
                                limit: 1000,
                            });
                            return [2 /*return*/, (0, org_cache_utils_1.cacheGetOrSet)(this.cache, cacheKey, 300000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        return [2 /*return*/, this.prisma.topicLevel.findMany({
                                                where: { subjectLevel: { subjectId: subjectId } },
                                                include: this.includeBase(),
                                                orderBy: [{ subjectLevelId: 'asc' }, { order: 'asc' }, { id: 'asc' }],
                                            })];
                                    });
                                }); })];
                    }
                });
            });
        };
        // ------- UPDATE -------
        TopicsService_1.prototype.update = function (id, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var current, orgId, nextSubjectLevelId, nextCatalogTopicId, nextPhase, dupe, payload;
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                return __generator(this, function (_l) {
                    switch (_l.label) {
                        case 0: return [4 /*yield*/, this.prisma.topicLevel.findUnique({
                                where: { id: id },
                                include: { subjectLevel: { include: { subject: true } } },
                            })];
                        case 1:
                            current = _l.sent();
                            if (!current)
                                throw new common_1.NotFoundException('Téma nebylo nalezeno.');
                            orgId = current.subjectLevel.subject.organizationId;
                            (0, access_utils_1.assertSameOrganization)(orgId, user, 'téma');
                            nextSubjectLevelId = (_a = dto.subjectLevelId) !== null && _a !== void 0 ? _a : current.subjectLevelId;
                            nextCatalogTopicId = (_b = dto.catalogTopicId) !== null && _b !== void 0 ? _b : current.catalogTopicId;
                            nextPhase = (_c = dto.phase) !== null && _c !== void 0 ? _c : current.phase;
                            if (!(nextSubjectLevelId !== current.subjectLevelId ||
                                nextCatalogTopicId !== current.catalogTopicId ||
                                nextPhase !== current.phase)) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.topicLevel.findUnique({
                                    where: {
                                        subjectLevelId_catalogTopicId_phase: {
                                            subjectLevelId: nextSubjectLevelId,
                                            catalogTopicId: nextCatalogTopicId,
                                            phase: nextPhase,
                                        },
                                    },
                                    select: { id: true },
                                })];
                        case 2:
                            dupe = _l.sent();
                            if (dupe && dupe.id !== id) {
                                throw new common_1.ConflictException('Tento TopicLevel (phase) už existuje.');
                            }
                            _l.label = 3;
                        case 3: return [4 /*yield*/, this.prisma.topicLevel.update({
                                where: { id: id },
                                data: {
                                    name: (_e = (_d = dto.name) === null || _d === void 0 ? void 0 : _d.trim()) !== null && _e !== void 0 ? _e : undefined,
                                    subjectLevelId: (_f = dto.subjectLevelId) !== null && _f !== void 0 ? _f : undefined,
                                    catalogTopicId: (_g = dto.catalogTopicId) !== null && _g !== void 0 ? _g : undefined,
                                    phase: (_h = dto.phase) !== null && _h !== void 0 ? _h : undefined,
                                    difficulty: (_j = dto.difficulty) !== null && _j !== void 0 ? _j : undefined,
                                    order: (_k = dto.order) !== null && _k !== void 0 ? _k : undefined,
                                },
                            })];
                        case 4:
                            _l.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: orgId,
                                    action: 'TOPICLEVEL_UPDATE',
                                    entityId: id,
                                    changedFields: dto,
                                })];
                        case 5:
                            _l.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, orgId))];
                        case 6:
                            _l.sent();
                            return [4 /*yield*/, this.buildTopicPayload(id)];
                        case 7:
                            payload = _l.sent();
                            return [2 /*return*/, __assign(__assign({}, payload), { organizationId: orgId })];
                    }
                });
            });
        };
        // ------- DELETE -------
        TopicsService_1.prototype.remove = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var current, orgId, deleted;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.topicLevel.findUnique({
                                where: { id: id },
                                include: { subjectLevel: { include: { subject: true } } },
                            })];
                        case 1:
                            current = _a.sent();
                            if (!current)
                                throw new common_1.NotFoundException('Téma nebylo nalezeno.');
                            orgId = current.subjectLevel.subject.organizationId;
                            (0, access_utils_1.assertSameOrganization)(orgId, user, 'téma');
                            return [4 /*yield*/, this.prisma.topicLevel.delete({ where: { id: id } })];
                        case 2:
                            deleted = _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: orgId,
                                    action: 'TOPICLEVEL_DELETE',
                                    entityId: id,
                                    metadata: {
                                        subjectLevelId: current.subjectLevelId,
                                        catalogTopicId: current.catalogTopicId,
                                        phase: current.phase,
                                    },
                                })];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, orgId))];
                        case 4:
                            _a.sent();
                            return [2 /*return*/, __assign(__assign({}, deleted), { organizationId: orgId })];
                    }
                });
            });
        };
        // ------- MATERIALS -------
        TopicsService_1.prototype.assignMaterials = function (topicLevelId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var orgId, materials, existing, have_1, toAdd, last, start_1, payload;
                var _this = this;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getTopicLevelOrg(topicLevelId)];
                        case 1:
                            orgId = _b.sent();
                            (0, access_utils_1.assertSameOrganization)(orgId, user, 'téma');
                            return [4 /*yield*/, this.prisma.learningMaterial.findMany({
                                    where: {
                                        id: { in: dto.materialIds },
                                        OR: [{ organizationId: null }, { organizationId: orgId }],
                                        deletedAt: null,
                                    },
                                    select: { id: true },
                                })];
                        case 2:
                            materials = _b.sent();
                            if (materials.length !== dto.materialIds.length) {
                                throw new common_1.NotFoundException('Některé materiály neexistují, jsou smazané nebo mimo organizaci.');
                            }
                            if (!dto.replaceAll) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.materialAssignment.deleteMany({ where: { topicLevelId: topicLevelId } })];
                                            case 1:
                                                _a.sent();
                                                if (!materials.length) return [3 /*break*/, 3];
                                                return [4 /*yield*/, tx.materialAssignment.createMany({
                                                        data: materials.map(function (m, i) { return ({
                                                            topicLevelId: topicLevelId,
                                                            materialId: m.id,
                                                            isPrimary: i === 0,
                                                            order: i + 1,
                                                        }); }),
                                                        skipDuplicates: true,
                                                    })];
                                            case 2:
                                                _a.sent();
                                                _a.label = 3;
                                            case 3: return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 3:
                            _b.sent();
                            return [3 /*break*/, 8];
                        case 4: return [4 /*yield*/, this.prisma.materialAssignment.findMany({
                                where: { topicLevelId: topicLevelId, materialId: { in: dto.materialIds } },
                                select: { materialId: true },
                            })];
                        case 5:
                            existing = _b.sent();
                            have_1 = new Set(existing.map(function (e) { return e.materialId; }));
                            toAdd = materials.filter(function (m) { return !have_1.has(m.id); });
                            if (!toAdd.length) return [3 /*break*/, 8];
                            return [4 /*yield*/, this.prisma.materialAssignment.findFirst({
                                    where: { topicLevelId: topicLevelId },
                                    orderBy: { order: 'desc' },
                                    select: { order: true },
                                })];
                        case 6:
                            last = _b.sent();
                            start_1 = ((_a = last === null || last === void 0 ? void 0 : last.order) !== null && _a !== void 0 ? _a : 0) + 1;
                            return [4 /*yield*/, this.prisma.materialAssignment.createMany({
                                    data: toAdd.map(function (m, idx) { return ({
                                        topicLevelId: topicLevelId,
                                        materialId: m.id,
                                        isPrimary: false,
                                        order: start_1 + idx,
                                    }); }),
                                    skipDuplicates: true,
                                })];
                        case 7:
                            _b.sent();
                            _b.label = 8;
                        case 8: return [4 /*yield*/, this.audit({
                                userId: user.userId,
                                orgId: orgId,
                                action: dto.replaceAll
                                    ? 'TOPICLEVEL_MATERIALS_REPLACE'
                                    : 'TOPICLEVEL_MATERIALS_ADD',
                                entityId: topicLevelId,
                                metadata: { materialIds: dto.materialIds, replaceAll: !!dto.replaceAll },
                            })];
                        case 9:
                            _b.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, orgId))];
                        case 10:
                            _b.sent();
                            return [4 /*yield*/, this.buildTopicPayload(topicLevelId)];
                        case 11:
                            payload = _b.sent();
                            return [2 /*return*/, __assign(__assign({}, payload), { organizationId: orgId })];
                    }
                });
            });
        };
        TopicsService_1.prototype.removeMaterial = function (topicLevelId, materialId, user) {
            return __awaiter(this, void 0, void 0, function () {
                var orgId, payload;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getTopicLevelOrg(topicLevelId)];
                        case 1:
                            orgId = _a.sent();
                            (0, access_utils_1.assertSameOrganization)(orgId, user, 'téma');
                            return [4 /*yield*/, this.prisma.materialAssignment.deleteMany({
                                    where: { topicLevelId: topicLevelId, materialId: materialId },
                                })];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: orgId,
                                    action: 'TOPICLEVEL_MATERIAL_REMOVE',
                                    entityId: topicLevelId,
                                    metadata: { materialId: materialId },
                                })];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, orgId))];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, this.buildTopicPayload(topicLevelId)];
                        case 5:
                            payload = _a.sent();
                            return [2 /*return*/, __assign(__assign({}, payload), { organizationId: orgId })];
                    }
                });
            });
        };
        // ------- TESTS -------
        TopicsService_1.prototype.assignTests = function (topicLevelId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var orgId, tests, existing, have_2, toAdd, last, start_2, payload;
                var _this = this;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getTopicLevelOrg(topicLevelId)];
                        case 1:
                            orgId = _b.sent();
                            (0, access_utils_1.assertSameOrganization)(orgId, user, 'téma');
                            return [4 /*yield*/, this.prisma.test.findMany({
                                    where: {
                                        id: { in: dto.testIds },
                                        organizationId: orgId,
                                        deletedAt: null,
                                    },
                                    select: { id: true },
                                })];
                        case 2:
                            tests = _b.sent();
                            if (tests.length !== dto.testIds.length) {
                                throw new common_1.NotFoundException('Některé testy neexistují nebo nejsou v organizaci.');
                            }
                            if (!dto.replaceAll) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.testAssignment.deleteMany({ where: { topicLevelId: topicLevelId } })];
                                            case 1:
                                                _a.sent();
                                                if (!tests.length) return [3 /*break*/, 3];
                                                return [4 /*yield*/, tx.testAssignment.createMany({
                                                        data: tests.map(function (t, i) { return ({
                                                            topicLevelId: topicLevelId,
                                                            testId: t.id,
                                                            isPrimary: i === 0,
                                                            order: i + 1,
                                                        }); }),
                                                        skipDuplicates: true,
                                                    })];
                                            case 2:
                                                _a.sent();
                                                _a.label = 3;
                                            case 3: return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 3:
                            _b.sent();
                            return [3 /*break*/, 8];
                        case 4: return [4 /*yield*/, this.prisma.testAssignment.findMany({
                                where: { topicLevelId: topicLevelId, testId: { in: dto.testIds } },
                                select: { testId: true },
                            })];
                        case 5:
                            existing = _b.sent();
                            have_2 = new Set(existing.map(function (e) { return e.testId; }));
                            toAdd = tests.filter(function (t) { return !have_2.has(t.id); });
                            if (!toAdd.length) return [3 /*break*/, 8];
                            return [4 /*yield*/, this.prisma.testAssignment.findFirst({
                                    where: { topicLevelId: topicLevelId },
                                    orderBy: { order: 'desc' },
                                    select: { order: true },
                                })];
                        case 6:
                            last = _b.sent();
                            start_2 = ((_a = last === null || last === void 0 ? void 0 : last.order) !== null && _a !== void 0 ? _a : 0) + 1;
                            return [4 /*yield*/, this.prisma.testAssignment.createMany({
                                    data: toAdd.map(function (t, idx) { return ({
                                        topicLevelId: topicLevelId,
                                        testId: t.id,
                                        isPrimary: false,
                                        order: start_2 + idx,
                                    }); }),
                                    skipDuplicates: true,
                                })];
                        case 7:
                            _b.sent();
                            _b.label = 8;
                        case 8: return [4 /*yield*/, this.audit({
                                userId: user.userId,
                                orgId: orgId,
                                action: dto.replaceAll
                                    ? 'TOPICLEVEL_TESTS_REPLACE'
                                    : 'TOPICLEVEL_TESTS_ADD',
                                entityId: topicLevelId,
                                metadata: { testIds: dto.testIds, replaceAll: !!dto.replaceAll },
                            })];
                        case 9:
                            _b.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, orgId))];
                        case 10:
                            _b.sent();
                            return [4 /*yield*/, this.buildTopicPayload(topicLevelId)];
                        case 11:
                            payload = _b.sent();
                            return [2 /*return*/, __assign(__assign({}, payload), { organizationId: orgId })];
                    }
                });
            });
        };
        TopicsService_1.prototype.removeTest = function (topicLevelId, testId, user) {
            return __awaiter(this, void 0, void 0, function () {
                var orgId, payload;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getTopicLevelOrg(topicLevelId)];
                        case 1:
                            orgId = _a.sent();
                            (0, access_utils_1.assertSameOrganization)(orgId, user, 'téma');
                            return [4 /*yield*/, this.prisma.testAssignment.deleteMany({
                                    where: { topicLevelId: topicLevelId, testId: testId },
                                })];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: orgId,
                                    action: 'TOPICLEVEL_TEST_REMOVE',
                                    entityId: topicLevelId,
                                    metadata: { testId: testId },
                                })];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, orgId))];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, this.buildTopicPayload(topicLevelId)];
                        case 5:
                            payload = _a.sent();
                            return [2 /*return*/, __assign(__assign({}, payload), { organizationId: orgId })];
                    }
                });
            });
        };
        // ------- Catalog (read-only; bez org-cache) -------
        TopicsService_1.prototype.listCatalogSubjects = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.catalogSubject.findMany({
                            select: { id: true, code: true, name: true },
                            orderBy: [{ name: 'asc' }],
                        })];
                });
            });
        };
        TopicsService_1.prototype.listCatalogTopics = function (subjectId, search) {
            return __awaiter(this, void 0, void 0, function () {
                var where;
                return __generator(this, function (_a) {
                    where = __assign({ subjectId: subjectId }, ((search === null || search === void 0 ? void 0 : search.trim())
                        ? { name: { contains: search.trim(), mode: 'insensitive' } }
                        : {}));
                    return [2 /*return*/, this.prisma.catalogTopic.findMany({
                            where: where,
                            select: { id: true, name: true },
                            orderBy: [{ name: 'asc' }],
                        })];
                });
            });
        };
        return TopicsService_1;
    }());
    __setFunctionName(_classThis, "TopicsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        TopicsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return TopicsService = _classThis;
}();
exports.TopicsService = TopicsService;
