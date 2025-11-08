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
exports.TestsService = void 0;
// src/tests/tests.service.ts
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var org_cache_utils_1 = require("../shared/cache/org-cache.utils");
function searchExpr(search) {
    var s = search === null || search === void 0 ? void 0 : search.trim();
    if (!s)
        return undefined;
    return {
        OR: [
            { title: { contains: s, mode: 'insensitive' } },
            { description: { contains: s, mode: 'insensitive' } },
        ],
    };
}
var TestsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var TestsService = _classThis = /** @class */ (function () {
        function TestsService_1(prisma, cache) {
            this.prisma = prisma;
            this.cache = cache;
        }
        TestsService_1.prototype.includeAll = function () {
            return client_1.Prisma.validator()({
                organization: true,
                creator: { include: { user: true, organization: true } },
                questions: {
                    include: { options: true, answers: true },
                    orderBy: [{ order: 'asc' }, { id: 'asc' }], // => bez createdAt (není ve schématu)
                },
            });
        };
        // ----- Audit helper -----
        TestsService_1.prototype.audit = function (opts) {
            var _a, _b, _c, _d, _e, _f;
            return this.prisma.auditLog.create({
                data: {
                    userId: (_a = opts.userId) !== null && _a !== void 0 ? _a : null,
                    organizationId: (_b = opts.orgId) !== null && _b !== void 0 ? _b : null,
                    entityType: client_1.AuditEntityType.TEST,
                    entityId: (_c = opts.entityId) !== null && _c !== void 0 ? _c : null,
                    action: opts.action,
                    ipAddress: (_d = opts.ip) !== null && _d !== void 0 ? _d : null,
                    userAgent: (_e = opts.ua) !== null && _e !== void 0 ? _e : null,
                    changedFields: (_f = opts.changedFields) !== null && _f !== void 0 ? _f : null,
                },
            });
        };
        // ----- Permissions -----
        TestsService_1.prototype.ensureCanEditTest = function (user, test) {
            return __awaiter(this, void 0, void 0, function () {
                var sameOrg, isDirector, isAuthor;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (user.systemRole === client_1.SystemRole.SUPERADMIN)
                                return [2 /*return*/];
                            sameOrg = user.organizationId === test.organizationId;
                            if (!sameOrg)
                                throw new common_1.ForbiddenException('Cizí organizace.');
                            isDirector = user.organizationRole === client_1.OrganizationRole.DIRECTOR;
                            if (isDirector)
                                return [2 /*return*/];
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: { id: test.creatorId, userId: user.userId, deletedAt: null },
                                    select: { id: true },
                                })];
                        case 1:
                            isAuthor = _a.sent();
                            if (!isAuthor)
                                throw new common_1.ForbiddenException('Upravovat může jen autor nebo ředitel.');
                            return [2 /*return*/];
                    }
                });
            });
        };
        // ====== TESTS ===================================================
        TestsService_1.prototype.create = function (dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var isSuper, author, created;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            isSuper = user.systemRole === client_1.SystemRole.SUPERADMIN;
                            if (!isSuper) {
                                if (!user.organizationId || user.organizationId !== dto.organizationId) {
                                    throw new common_1.ForbiddenException('Test lze vytvořit jen ve své organizaci.');
                                }
                            }
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: {
                                        userId: user.userId,
                                        organizationId: dto.organizationId,
                                        deletedAt: null,
                                    },
                                    select: { id: true },
                                })];
                        case 1:
                            author = _c.sent();
                            if (!!author) return [3 /*break*/, 4];
                            if (!isSuper) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.membership.create({
                                    data: {
                                        organizationId: dto.organizationId,
                                        userId: user.userId,
                                        role: client_1.OrganizationRole.DIRECTOR, // nebo TEACHER – na politice nezáleží, musí existovat membership
                                    },
                                    select: { id: true },
                                })];
                        case 2:
                            author = _c.sent();
                            return [3 /*break*/, 4];
                        case 3: throw new common_1.ForbiddenException('Nejste členem organizace.');
                        case 4: return [4 /*yield*/, this.prisma.test.create({
                                data: {
                                    title: dto.title,
                                    description: (_a = dto.description) !== null && _a !== void 0 ? _a : null,
                                    organizationId: dto.organizationId,
                                    status: (_b = dto.status) !== null && _b !== void 0 ? _b : client_1.PublishStatus.DRAFT,
                                    creatorId: author.id,
                                },
                                include: this.includeAll(),
                            })];
                        case 5:
                            created = _c.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: dto.organizationId,
                                    action: 'TEST_CREATE',
                                    entityId: created.id,
                                    changedFields: dto,
                                })];
                        case 6:
                            _c.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, dto.organizationId))];
                        case 7:
                            _c.sent();
                            return [2 /*return*/, created];
                    }
                });
            });
        };
        TestsService_1.prototype.findAll = function (user, q) {
            return __awaiter(this, void 0, void 0, function () {
                var page, limit, skip, isSuper, effectiveOrgId, member, where, include, scopeId, ver, cacheKey;
                var _this = this;
                var _a, _b, _c, _d, _e, _f, _g;
                return __generator(this, function (_h) {
                    switch (_h.label) {
                        case 0:
                            page = (_a = q.page) !== null && _a !== void 0 ? _a : 1;
                            limit = Math.min((_b = q.limit) !== null && _b !== void 0 ? _b : 20, 100);
                            skip = (page - 1) * limit;
                            isSuper = user.systemRole === client_1.SystemRole.SUPERADMIN;
                            effectiveOrgId = isSuper
                                ? ((_c = q.organizationId) !== null && _c !== void 0 ? _c : null)
                                : ((_e = (_d = q.organizationId) !== null && _d !== void 0 ? _d : user.organizationId) !== null && _e !== void 0 ? _e : null);
                            if (!!isSuper) return [3 /*break*/, 2];
                            if (!effectiveOrgId) {
                                throw new common_1.ForbiddenException('Missing organization context.');
                            }
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: {
                                        userId: user.userId,
                                        organizationId: effectiveOrgId,
                                        deletedAt: null,
                                    },
                                    select: { id: true },
                                })];
                        case 1:
                            member = _h.sent();
                            if (!member) {
                                throw new common_1.ForbiddenException('Access denied');
                            }
                            _h.label = 2;
                        case 2:
                            where = __assign(__assign(__assign({ deletedAt: null }, (effectiveOrgId ? { organizationId: effectiveOrgId } : {})), (q.status ? { status: q.status } : {})), ((_f = searchExpr(q.search)) !== null && _f !== void 0 ? _f : {}));
                            include = this.includeAll();
                            scopeId = effectiveOrgId !== null && effectiveOrgId !== void 0 ? effectiveOrgId : 'GLOBAL';
                            return [4 /*yield*/, (0, org_cache_utils_1.getOrgVersion)(this.cache, scopeId)];
                        case 3:
                            ver = _h.sent();
                            cacheKey = (0, org_cache_utils_1.buildVersionedListKey)({
                                namespace: 'tests',
                                scopeId: scopeId,
                                version: ver,
                                page: page,
                                limit: limit,
                                search: q.search,
                                order: [{ createdAt: 'desc' }, { id: 'asc' }],
                                filters: { status: (_g = q.status) !== null && _g !== void 0 ? _g : null, organizationId: effectiveOrgId },
                            });
                            return [2 /*return*/, (0, org_cache_utils_1.cacheGetOrSet)(this.cache, cacheKey, 600000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var _a, total, items;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, this.prisma.$transaction([
                                                    this.prisma.test.count({ where: where }),
                                                    this.prisma.test.findMany({
                                                        where: where,
                                                        include: include,
                                                        skip: skip,
                                                        take: limit,
                                                        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
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
        TestsService_1.prototype.findOne = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var t, member;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.test.findFirst({
                                where: { id: id, deletedAt: null },
                                include: this.includeAll(),
                            })];
                        case 1:
                            t = _a.sent();
                            if (!t)
                                throw new common_1.NotFoundException('Test nenalezen');
                            if (user.systemRole === client_1.SystemRole.SUPERADMIN)
                                return [2 /*return*/, t];
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: {
                                        userId: user.userId,
                                        organizationId: t.organizationId,
                                        deletedAt: null,
                                    },
                                    select: { id: true },
                                })];
                        case 2:
                            member = _a.sent();
                            if (!member)
                                throw new common_1.ForbiddenException('Cizí organizace.');
                            return [2 /*return*/, t];
                    }
                });
            });
        };
        TestsService_1.prototype.update = function (id, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var current, updated;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, this.prisma.test.findUnique({
                                where: { id: id },
                                select: {
                                    id: true,
                                    organizationId: true,
                                    creatorId: true,
                                    deletedAt: true,
                                },
                            })];
                        case 1:
                            current = _d.sent();
                            if (!current || current.deletedAt)
                                throw new common_1.NotFoundException('Test nenalezen');
                            return [4 /*yield*/, this.ensureCanEditTest(user, current)];
                        case 2:
                            _d.sent();
                            return [4 /*yield*/, this.prisma.test.update({
                                    where: { id: id },
                                    data: {
                                        title: (_a = dto.title) !== null && _a !== void 0 ? _a : undefined,
                                        description: (_b = dto.description) !== null && _b !== void 0 ? _b : undefined,
                                        status: (_c = dto.status) !== null && _c !== void 0 ? _c : undefined,
                                    },
                                    include: this.includeAll(),
                                })];
                        case 3:
                            updated = _d.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: current.organizationId,
                                    action: 'TEST_UPDATE',
                                    entityId: id,
                                    changedFields: dto,
                                })];
                        case 4:
                            _d.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, current.organizationId))];
                        case 5:
                            _d.sent();
                            return [2 /*return*/, updated];
                    }
                });
            });
        };
        TestsService_1.prototype.remove = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var current, deleted;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.test.findUnique({
                                where: { id: id },
                                select: {
                                    id: true,
                                    organizationId: true,
                                    creatorId: true,
                                    deletedAt: true,
                                },
                            })];
                        case 1:
                            current = _a.sent();
                            if (!current || current.deletedAt)
                                throw new common_1.NotFoundException('Test nenalezen');
                            if (user.systemRole !== client_1.SystemRole.SUPERADMIN) {
                                if (user.organizationId !== current.organizationId ||
                                    user.organizationRole !== client_1.OrganizationRole.DIRECTOR) {
                                    throw new common_1.ForbiddenException('Mazat smí jen ředitel nebo superadmin.');
                                }
                            }
                            return [4 /*yield*/, this.prisma.test.update({
                                    where: { id: id },
                                    data: { deletedAt: new Date() },
                                })];
                        case 2:
                            deleted = _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: current.organizationId,
                                    action: 'TEST_DELETE_SOFT',
                                    entityId: id,
                                })];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, current.organizationId))];
                        case 4:
                            _a.sent();
                            return [2 /*return*/, deleted];
                    }
                });
            });
        };
        // ====== QUESTIONS / OPTIONS / ANSWERS ===========================
        TestsService_1.prototype.getEditableTestFor = function (user, testId) {
            return __awaiter(this, void 0, void 0, function () {
                var t;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.test.findUnique({
                                where: { id: testId },
                                select: {
                                    id: true,
                                    organizationId: true,
                                    creatorId: true,
                                    deletedAt: true,
                                },
                            })];
                        case 1:
                            t = _a.sent();
                            if (!t || t.deletedAt)
                                throw new common_1.NotFoundException('Test nenalezen');
                            return [4 /*yield*/, this.ensureCanEditTest(user, t)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, t];
                    }
                });
            });
        };
        // Questions
        TestsService_1.prototype.addQuestion = function (testId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var t, q;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getEditableTestFor(user, testId)];
                        case 1:
                            t = _b.sent();
                            return [4 /*yield*/, this.prisma.question.create({
                                    data: { testId: testId, text: dto.text, type: dto.type, order: (_a = dto.order) !== null && _a !== void 0 ? _a : 0 },
                                })];
                        case 2:
                            q = _b.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: t.organizationId,
                                    action: 'QUESTION_CREATE',
                                    entityId: q.id,
                                })];
                        case 3:
                            _b.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, t.organizationId))];
                        case 4:
                            _b.sent();
                            return [2 /*return*/, q];
                    }
                });
            });
        };
        TestsService_1.prototype.updateQuestion = function (testId, questionId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var t, exists, q;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, this.getEditableTestFor(user, testId)];
                        case 1:
                            t = _d.sent();
                            return [4 /*yield*/, this.prisma.question.findFirst({
                                    where: { id: questionId, testId: testId },
                                })];
                        case 2:
                            exists = _d.sent();
                            if (!exists)
                                throw new common_1.NotFoundException('Otázka nenalezena');
                            return [4 /*yield*/, this.prisma.question.update({
                                    where: { id: questionId },
                                    data: {
                                        text: (_a = dto.text) !== null && _a !== void 0 ? _a : undefined,
                                        type: (_b = dto.type) !== null && _b !== void 0 ? _b : undefined,
                                        order: (_c = dto.order) !== null && _c !== void 0 ? _c : undefined,
                                    },
                                })];
                        case 3:
                            q = _d.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: t.organizationId,
                                    action: 'QUESTION_UPDATE',
                                    entityId: q.id,
                                    changedFields: dto,
                                })];
                        case 4:
                            _d.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, t.organizationId))];
                        case 5:
                            _d.sent();
                            return [2 /*return*/, q];
                    }
                });
            });
        };
        TestsService_1.prototype.reorderQuestions = function (testId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var t, ids, count;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getEditableTestFor(user, testId)];
                        case 1:
                            t = _a.sent();
                            ids = dto.items.map(function (i) { return i.id; });
                            return [4 /*yield*/, this.prisma.question.count({
                                    where: { id: { in: ids }, testId: testId },
                                })];
                        case 2:
                            count = _a.sent();
                            if (count !== ids.length)
                                throw new common_1.BadRequestException('Některé otázky nepatří do testu.');
                            return [4 /*yield*/, this.prisma.$transaction(dto.items.map(function (i) {
                                    return _this.prisma.question.update({
                                        where: { id: i.id },
                                        data: { order: i.order },
                                    });
                                }))];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: t.organizationId,
                                    action: 'QUESTION_REORDER',
                                    changedFields: dto,
                                })];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, t.organizationId))];
                        case 5:
                            _a.sent();
                            return [2 /*return*/, { ok: true }];
                    }
                });
            });
        };
        TestsService_1.prototype.removeQuestion = function (testId, questionId, user) {
            return __awaiter(this, void 0, void 0, function () {
                var t, exists;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getEditableTestFor(user, testId)];
                        case 1:
                            t = _a.sent();
                            return [4 /*yield*/, this.prisma.question.findFirst({
                                    where: { id: questionId, testId: testId },
                                })];
                        case 2:
                            exists = _a.sent();
                            if (!exists)
                                throw new common_1.NotFoundException('Otázka nenalezena');
                            return [4 /*yield*/, this.prisma.question.delete({ where: { id: questionId } })];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: t.organizationId,
                                    action: 'QUESTION_DELETE',
                                    entityId: questionId,
                                })];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, t.organizationId))];
                        case 5:
                            _a.sent();
                            return [2 /*return*/, { id: questionId, deleted: true }];
                    }
                });
            });
        };
        // Options
        TestsService_1.prototype.addOption = function (testId, questionId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var t, q, o;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getEditableTestFor(user, testId)];
                        case 1:
                            t = _a.sent();
                            return [4 /*yield*/, this.prisma.question.findFirst({
                                    where: { id: questionId, testId: testId },
                                })];
                        case 2:
                            q = _a.sent();
                            if (!q)
                                throw new common_1.NotFoundException('Otázka nenalezena');
                            return [4 /*yield*/, this.prisma.option.create({
                                    data: { questionId: questionId, text: dto.text },
                                })];
                        case 3:
                            o = _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: t.organizationId,
                                    action: 'OPTION_CREATE',
                                    entityId: o.id,
                                })];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, t.organizationId))];
                        case 5:
                            _a.sent();
                            return [2 /*return*/, o];
                    }
                });
            });
        };
        TestsService_1.prototype.updateOption = function (testId, questionId, optionId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var t, exists, o;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getEditableTestFor(user, testId)];
                        case 1:
                            t = _b.sent();
                            return [4 /*yield*/, this.prisma.option.findFirst({
                                    where: { id: optionId, questionId: questionId, question: { testId: testId } },
                                })];
                        case 2:
                            exists = _b.sent();
                            if (!exists)
                                throw new common_1.NotFoundException('Možnost nenalezena');
                            return [4 /*yield*/, this.prisma.option.update({
                                    where: { id: optionId },
                                    data: { text: (_a = dto.text) !== null && _a !== void 0 ? _a : undefined },
                                })];
                        case 3:
                            o = _b.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: t.organizationId,
                                    action: 'OPTION_UPDATE',
                                    entityId: o.id,
                                    changedFields: dto,
                                })];
                        case 4:
                            _b.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, t.organizationId))];
                        case 5:
                            _b.sent();
                            return [2 /*return*/, o];
                    }
                });
            });
        };
        TestsService_1.prototype.removeOption = function (testId, questionId, optionId, user) {
            return __awaiter(this, void 0, void 0, function () {
                var t, exists;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getEditableTestFor(user, testId)];
                        case 1:
                            t = _a.sent();
                            return [4 /*yield*/, this.prisma.option.findFirst({
                                    where: { id: optionId, questionId: questionId, question: { testId: testId } },
                                })];
                        case 2:
                            exists = _a.sent();
                            if (!exists)
                                throw new common_1.NotFoundException('Možnost nenalezena');
                            return [4 /*yield*/, this.prisma.option.delete({ where: { id: optionId } })];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: t.organizationId,
                                    action: 'OPTION_DELETE',
                                    entityId: optionId,
                                })];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, t.organizationId))];
                        case 5:
                            _a.sent();
                            return [2 /*return*/, { id: optionId, deleted: true }];
                    }
                });
            });
        };
        // Answers
        TestsService_1.prototype.addAnswer = function (testId, questionId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var t, q, a;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getEditableTestFor(user, testId)];
                        case 1:
                            t = _a.sent();
                            return [4 /*yield*/, this.prisma.question.findFirst({
                                    where: { id: questionId, testId: testId },
                                })];
                        case 2:
                            q = _a.sent();
                            if (!q)
                                throw new common_1.NotFoundException('Otázka nenalezena');
                            return [4 /*yield*/, this.prisma.answer.create({
                                    data: { questionId: questionId, text: dto.text },
                                })];
                        case 3:
                            a = _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: t.organizationId,
                                    action: 'ANSWER_CREATE',
                                    entityId: a.id,
                                })];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, t.organizationId))];
                        case 5:
                            _a.sent();
                            return [2 /*return*/, a];
                    }
                });
            });
        };
        TestsService_1.prototype.updateAnswer = function (testId, questionId, answerId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var t, exists, a;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.getEditableTestFor(user, testId)];
                        case 1:
                            t = _b.sent();
                            return [4 /*yield*/, this.prisma.answer.findFirst({
                                    where: { id: answerId, questionId: questionId, question: { testId: testId } },
                                })];
                        case 2:
                            exists = _b.sent();
                            if (!exists)
                                throw new common_1.NotFoundException('Odpověď nenalezena');
                            return [4 /*yield*/, this.prisma.answer.update({
                                    where: { id: answerId },
                                    data: { text: (_a = dto.text) !== null && _a !== void 0 ? _a : undefined },
                                })];
                        case 3:
                            a = _b.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: t.organizationId,
                                    action: 'ANSWER_UPDATE',
                                    entityId: a.id,
                                    changedFields: dto,
                                })];
                        case 4:
                            _b.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, t.organizationId))];
                        case 5:
                            _b.sent();
                            return [2 /*return*/, a];
                    }
                });
            });
        };
        TestsService_1.prototype.removeAnswer = function (testId, questionId, answerId, user) {
            return __awaiter(this, void 0, void 0, function () {
                var t, exists;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getEditableTestFor(user, testId)];
                        case 1:
                            t = _a.sent();
                            return [4 /*yield*/, this.prisma.answer.findFirst({
                                    where: { id: answerId, questionId: questionId, question: { testId: testId } },
                                })];
                        case 2:
                            exists = _a.sent();
                            if (!exists)
                                throw new common_1.NotFoundException('Odpověď nenalezena');
                            return [4 /*yield*/, this.prisma.answer.delete({ where: { id: answerId } })];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: t.organizationId,
                                    action: 'ANSWER_DELETE',
                                    entityId: answerId,
                                })];
                        case 4:
                            _a.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, t.organizationId))];
                        case 5:
                            _a.sent();
                            return [2 /*return*/, { id: answerId, deleted: true }];
                    }
                });
            });
        };
        return TestsService_1;
    }());
    __setFunctionName(_classThis, "TestsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        TestsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return TestsService = _classThis;
}();
exports.TestsService = TestsService;
