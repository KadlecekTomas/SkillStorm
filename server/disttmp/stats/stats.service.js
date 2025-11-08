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
exports.StatsService = void 0;
// src/stats/stats.service.ts
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var org_cache_utils_1 = require("src/shared/cache/org-cache.utils");
var StatsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var StatsService = _classThis = /** @class */ (function () {
        function StatsService_1(prisma, cache) {
            this.prisma = prisma;
            this.cache = cache;
        }
        // ----- Audit helper --------------------------------------------------------
        StatsService_1.prototype.audit = function (opts) {
            var _a, _b, _c, _d;
            return this.prisma.auditLog.create({
                data: {
                    userId: (_a = opts.userId) !== null && _a !== void 0 ? _a : null,
                    organizationId: (_b = opts.orgId) !== null && _b !== void 0 ? _b : null,
                    entityType: client_1.AuditEntityType.ORGANIZATION,
                    entityId: (_c = opts.orgId) !== null && _c !== void 0 ? _c : null,
                    action: opts.action,
                    metadata: (_d = opts.meta) !== null && _d !== void 0 ? _d : null,
                },
            });
        };
        // ----- Helpers -------------------------------------------------------------
        StatsService_1.prototype.ensureOrgContext = function (user, organizationId) {
            return __awaiter(this, void 0, void 0, function () {
                var member;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (user.systemRole === client_1.SystemRole.SUPERADMIN)
                                return [2 /*return*/];
                            if (!organizationId || user.organizationId !== organizationId) {
                                throw new common_1.ForbiddenException('Missing or foreign organization context.');
                            }
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: { userId: user.userId, organizationId: organizationId, deletedAt: null },
                                    select: { id: true },
                                })];
                        case 1:
                            member = _a.sent();
                            if (!member)
                                throw new common_1.ForbiddenException('Access denied.');
                            return [2 /*return*/];
                    }
                });
            });
        };
        // ===== ORG OVERVIEW ========================================================
        StatsService_1.prototype.getOrgOverview = function (organizationId_1, user_1) {
            return __awaiter(this, arguments, void 0, function (organizationId, user, scope) {
                var safeScope, isTestEnv, useCache, scopeId, ver, baseTestWhere, cacheKey, compute, data, _a;
                var _this = this;
                if (scope === void 0) { scope = 'evaluated'; }
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.ensureOrgContext(user, organizationId)];
                        case 1:
                            _b.sent();
                            safeScope = scope === 'all' ? 'all' : 'evaluated';
                            isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
                            useCache = !isTestEnv;
                            scopeId = organizationId !== null && organizationId !== void 0 ? organizationId : 'GLOBAL';
                            return [4 /*yield*/, (0, org_cache_utils_1.getOrgVersion)(this.cache, scopeId)];
                        case 2:
                            ver = _b.sent();
                            baseTestWhere = {
                                organizationId: organizationId !== null && organizationId !== void 0 ? organizationId : undefined,
                                deletedAt: null,
                            };
                            cacheKey = (0, org_cache_utils_1.buildVersionedListKey)({
                                namespace: 'stats:overview',
                                scopeId: scopeId,
                                version: ver,
                                // žádné proměnlivé filtry do klíče – ať se to nelepí na staré hodnoty
                                filters: {},
                            });
                            compute = function () { return __awaiter(_this, void 0, void 0, function () {
                                var _a, approved, rejected, pending, all, maxAgg, totalTests, avgAgg, evaluated, passRateEvaluated, passRateAll;
                                var _b, _c;
                                return __generator(this, function (_d) {
                                    switch (_d.label) {
                                        case 0: return [4 /*yield*/, this.prisma.$transaction([
                                                this.prisma.submission.count({
                                                    where: { test: baseTestWhere, status: client_1.SubmissionStatus.APPROVED },
                                                }),
                                                this.prisma.submission.count({
                                                    where: { test: baseTestWhere, status: client_1.SubmissionStatus.REJECTED },
                                                }),
                                                this.prisma.submission.count({
                                                    where: { test: baseTestWhere, status: client_1.SubmissionStatus.PENDING },
                                                }),
                                                this.prisma.submission.count({
                                                    where: { test: baseTestWhere },
                                                }),
                                                this.prisma.submission.aggregate({
                                                    where: { test: baseTestWhere, submittedAt: { not: null } },
                                                    _max: { submittedAt: true },
                                                }),
                                                this.prisma.test.count({ where: baseTestWhere }),
                                                this.prisma.submission.aggregate({
                                                    // průměr jen ze skutečně vyhodnocených (score != null)
                                                    where: { test: baseTestWhere, score: { not: null } },
                                                    _avg: { score: true },
                                                }),
                                            ])];
                                        case 1:
                                            _a = _d.sent(), approved = _a[0], rejected = _a[1], pending = _a[2], all = _a[3], maxAgg = _a[4], totalTests = _a[5], avgAgg = _a[6];
                                            evaluated = approved + rejected;
                                            passRateEvaluated = evaluated > 0 ? approved / evaluated : 0;
                                            passRateAll = all > 0 ? approved / all : 0;
                                            return [2 /*return*/, {
                                                    // preference z volání – už bezpečně normalizovaná
                                                    scope: safeScope,
                                                    // základní sumáře
                                                    totalTests: totalTests,
                                                    counts: { approved: approved, rejected: rejected, pending: pending, all: all },
                                                    // ALIASY pro zpětnou kompatibilitu (na to míří tvoje e2e testy)
                                                    totalSubmissions: safeScope === 'evaluated' ? evaluated : all,
                                                    pendingSubmissions: pending,
                                                    // primární hodnoty
                                                    passRate: safeScope === 'evaluated' ? passRateEvaluated : passRateAll,
                                                    passRateEvaluated: passRateEvaluated,
                                                    passRateAll: passRateAll,
                                                    avgScore: (_b = avgAgg._avg.score) !== null && _b !== void 0 ? _b : null,
                                                    lastSubmittedAt: (_c = maxAgg._max.submittedAt) !== null && _c !== void 0 ? _c : null,
                                                }];
                                    }
                                });
                            }); };
                            if (!useCache) return [3 /*break*/, 4];
                            return [4 /*yield*/, (0, org_cache_utils_1.cacheGetOrSet)(this.cache, cacheKey, 60000, compute)];
                        case 3:
                            _a = _b.sent();
                            return [3 /*break*/, 6];
                        case 4: return [4 /*yield*/, compute()];
                        case 5:
                            _a = _b.sent();
                            _b.label = 6;
                        case 6:
                            data = _a;
                            void this.audit({
                                userId: user.userId,
                                orgId: organizationId,
                                action: 'STATS_ORG_OVERVIEW_READ',
                                meta: { scope: safeScope },
                            });
                            return [2 /*return*/, data];
                    }
                });
            });
        };
        // ===== STUDENT DASHBOARD ===================================================
        StatsService_1.prototype.getStudentDashboard = function (ids, user) {
            return __awaiter(this, void 0, void 0, function () {
                var effectiveMembershipId, m, member, scopeId, ver, cacheKey;
                var _this = this;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            // AUTH: self v rámci organizace (kromě SUPERADMIN)
                            if (user.systemRole !== client_1.SystemRole.SUPERADMIN) {
                                if (!ids.organizationId || user.organizationId !== ids.organizationId) {
                                    throw new common_1.ForbiddenException('Foreign organization.');
                                }
                            }
                            effectiveMembershipId = ids.membershipId;
                            if (!!effectiveMembershipId) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: {
                                        userId: user.userId,
                                        organizationId: (_a = ids.organizationId) !== null && _a !== void 0 ? _a : undefined,
                                        deletedAt: null,
                                    },
                                    select: { id: true },
                                })];
                        case 1:
                            m = _d.sent();
                            if (!m)
                                throw new common_1.ForbiddenException('No membership found.');
                            effectiveMembershipId = m.id;
                            _d.label = 2;
                        case 2:
                            // Self-check
                            if (user.systemRole !== client_1.SystemRole.SUPERADMIN &&
                                user.organizationId === ids.organizationId &&
                                user['membershipId'] &&
                                user['membershipId'] !== effectiveMembershipId) {
                                throw new common_1.ForbiddenException('Can view only own dashboard.');
                            }
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: {
                                        id: effectiveMembershipId,
                                        organizationId: (_b = ids.organizationId) !== null && _b !== void 0 ? _b : undefined,
                                        deletedAt: null,
                                    },
                                    include: { user: true, organization: true },
                                })];
                        case 3:
                            member = _d.sent();
                            if (!member)
                                throw new common_1.NotFoundException('Membership not found.');
                            scopeId = (_c = ids.organizationId) !== null && _c !== void 0 ? _c : 'GLOBAL';
                            return [4 /*yield*/, (0, org_cache_utils_1.getOrgVersion)(this.cache, scopeId)];
                        case 4:
                            ver = _d.sent();
                            cacheKey = (0, org_cache_utils_1.buildVersionedListKey)({
                                namespace: 'dashboard:student',
                                scopeId: scopeId,
                                version: ver,
                                filters: { membershipId: effectiveMembershipId },
                            });
                            return [2 /*return*/, (0, org_cache_utils_1.cacheGetOrSet)(this.cache, cacheKey, 60000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var baseTestWhere, baseSubmissionWhere, _a, testsTaken, agg, lastSubmissions, allSubs, byTestMap, _i, allSubs_1, s, entry, byTest;
                                    var _b, _c, _d, _e, _f, _g, _h, _j;
                                    return __generator(this, function (_k) {
                                        switch (_k.label) {
                                            case 0:
                                                baseTestWhere = {
                                                    deletedAt: null,
                                                    organizationId: (_b = ids.organizationId) !== null && _b !== void 0 ? _b : undefined,
                                                };
                                                baseSubmissionWhere = {
                                                    studentId: effectiveMembershipId,
                                                    test: baseTestWhere,
                                                };
                                                return [4 /*yield*/, Promise.all([
                                                        this.prisma.submission.count({ where: baseSubmissionWhere }),
                                                        this.prisma.submission.aggregate({
                                                            where: __assign(__assign({}, baseSubmissionWhere), { score: { not: null } }),
                                                            _avg: { score: true },
                                                        }),
                                                        this.prisma.submission.findMany({
                                                            where: __assign(__assign({}, baseSubmissionWhere), { submittedAt: { not: null } }),
                                                            include: { test: { select: { id: true, title: true } } },
                                                            orderBy: { submittedAt: 'desc' },
                                                            take: 5,
                                                        }),
                                                        this.prisma.submission.findMany({
                                                            where: __assign(__assign({}, baseSubmissionWhere), { submittedAt: { not: null } }),
                                                            select: { id: true, testId: true, score: true, submittedAt: true },
                                                            orderBy: [{ testId: 'asc' }, { submittedAt: 'desc' }],
                                                        }),
                                                    ])];
                                            case 1:
                                                _a = _k.sent(), testsTaken = _a[0], agg = _a[1], lastSubmissions = _a[2], allSubs = _a[3];
                                                byTestMap = new Map();
                                                for (_i = 0, allSubs_1 = allSubs; _i < allSubs_1.length; _i++) {
                                                    s = allSubs_1[_i];
                                                    entry = (_c = byTestMap.get(s.testId)) !== null && _c !== void 0 ? _c : {};
                                                    if (!entry.latest)
                                                        entry.latest = s; // první pro daný test je nejnovější (řadili jsme desc)
                                                    if (typeof s.score === 'number' &&
                                                        (!entry.best || ((_d = entry.best.score) !== null && _d !== void 0 ? _d : -Infinity) < s.score)) {
                                                        entry.best = s;
                                                    }
                                                    byTestMap.set(s.testId, entry);
                                                }
                                                byTest = Array.from(byTestMap.entries()).map(function (_a) {
                                                    var _b;
                                                    var testId = _a[0], v = _a[1];
                                                    return ({
                                                        testId: testId,
                                                        latest: v.latest,
                                                        best: (_b = v.best) !== null && _b !== void 0 ? _b : null,
                                                    });
                                                });
                                                return [2 /*return*/, {
                                                        member: {
                                                            id: member.id,
                                                            name: (_f = (_e = member.user) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : null,
                                                            organization: (_h = (_g = member.organization) === null || _g === void 0 ? void 0 : _g.name) !== null && _h !== void 0 ? _h : null,
                                                            xp: member.xp, // pokud používáš XP/level na membershipu
                                                            level: member.level,
                                                        },
                                                        testsTaken: testsTaken,
                                                        avgScore: (_j = agg._avg.score) !== null && _j !== void 0 ? _j : null,
                                                        lastSubmissions: lastSubmissions.map(function (s) { return ({
                                                            id: s.id,
                                                            testId: s.testId,
                                                            testTitle: s.test.title,
                                                            score: s.score,
                                                            submittedAt: s.submittedAt,
                                                            status: s.status,
                                                        }); }),
                                                        byTest: byTest,
                                                    }];
                                        }
                                    });
                                }); })];
                    }
                });
            });
        };
        // ===== TEACHER DASHBOARD ===================================================
        StatsService_1.prototype.getTeacherDashboard = function (ids, user) {
            return __awaiter(this, void 0, void 0, function () {
                var teacher, scopeId, ver, cacheKey;
                var _this = this;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.ensureOrgContext(user, ids.organizationId)];
                        case 1:
                            _b.sent();
                            return [4 /*yield*/, this.prisma.teacher.findFirst({
                                    where: { membershipId: ids.membershipId },
                                    select: { id: true, organizationId: true },
                                })];
                        case 2:
                            teacher = _b.sent();
                            scopeId = (_a = ids.organizationId) !== null && _a !== void 0 ? _a : 'GLOBAL';
                            return [4 /*yield*/, (0, org_cache_utils_1.getOrgVersion)(this.cache, scopeId)];
                        case 3:
                            ver = _b.sent();
                            cacheKey = (0, org_cache_utils_1.buildVersionedListKey)({
                                namespace: 'dashboard:teacher',
                                scopeId: scopeId,
                                version: ver,
                                filters: { membershipId: ids.membershipId },
                            });
                            return [2 /*return*/, (0, org_cache_utils_1.cacheGetOrSet)(this.cache, cacheKey, 60000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var _a, classroomsCount, studentsCount, testsCreated, scoreAgg, pending, recent;
                                    var _b, _c, _d;
                                    return __generator(this, function (_e) {
                                        switch (_e.label) {
                                            case 0: return [4 /*yield*/, Promise.all([
                                                    this.prisma.classSection.count({
                                                        where: { teacherId: (_b = teacher === null || teacher === void 0 ? void 0 : teacher.id) !== null && _b !== void 0 ? _b : '___none___' },
                                                    }),
                                                    this.prisma.student.count({
                                                        where: { orgId: (_c = ids.organizationId) !== null && _c !== void 0 ? _c : undefined, deletedAt: null },
                                                    }),
                                                    this.prisma.test.count({
                                                        where: { creatorId: ids.membershipId, deletedAt: null },
                                                    }),
                                                    this.prisma.submission.aggregate({
                                                        where: {
                                                            test: { creatorId: ids.membershipId, deletedAt: null },
                                                            score: { not: null },
                                                        },
                                                        _avg: { score: true },
                                                    }),
                                                    this.prisma.submission.count({
                                                        where: {
                                                            test: { creatorId: ids.membershipId, deletedAt: null },
                                                            status: client_1.SubmissionStatus.PENDING,
                                                        },
                                                    }),
                                                    this.prisma.submission.findMany({
                                                        where: { test: { creatorId: ids.membershipId, deletedAt: null } },
                                                        include: {
                                                            test: { select: { id: true, title: true } },
                                                            student: { include: { user: { select: { name: true } } } },
                                                        },
                                                        orderBy: { submittedAt: 'desc' },
                                                        take: 10,
                                                    }),
                                                ])];
                                            case 1:
                                                _a = _e.sent(), classroomsCount = _a[0], studentsCount = _a[1], testsCreated = _a[2], scoreAgg = _a[3], pending = _a[4], recent = _a[5];
                                                return [2 /*return*/, {
                                                        classroomsCount: classroomsCount,
                                                        studentsCount: studentsCount,
                                                        testsCreated: testsCreated,
                                                        avgScoreOnMyTests: (_d = scoreAgg._avg.score) !== null && _d !== void 0 ? _d : null,
                                                        pendingSubmissions: pending,
                                                        recentActivity: recent.map(function (s) {
                                                            var _a, _b;
                                                            return ({
                                                                id: s.id,
                                                                testId: s.testId,
                                                                testTitle: s.test.title,
                                                                studentName: (_b = (_a = s.student.user) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : null,
                                                                score: s.score,
                                                                status: s.status,
                                                                submittedAt: s.submittedAt,
                                                            });
                                                        }),
                                                    }];
                                        }
                                    });
                                }); })];
                    }
                });
            });
        };
        return StatsService_1;
    }());
    __setFunctionName(_classThis, "StatsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        StatsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return StatsService = _classThis;
}();
exports.StatsService = StatsService;
