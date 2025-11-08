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
exports.LearningMaterialsService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var org_cache_utils_1 = require("../shared/cache/org-cache.utils");
var path = require("path");
var fs = require("fs");
function materialSearch(search) {
    var raw = search === null || search === void 0 ? void 0 : search.trim();
    if (!raw)
        return undefined;
    var s = raw.replace(/\s+/g, ' ');
    return {
        OR: [
            { title: { contains: s, mode: 'insensitive' } },
            { description: { contains: s, mode: 'insensitive' } },
        ],
    };
}
// jednoduchý MIME sniff pro PDF (bez dalších libek): kontrola magic bytes "%PDF"
function isPdfBuffer(buf) {
    if (!buf || buf.length < 4)
        return false;
    var header = buf.subarray(0, 4).toString('utf8');
    return header === '%PDF';
}
var LearningMaterialsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var LearningMaterialsService = _classThis = /** @class */ (function () {
        function LearningMaterialsService_1(prisma, cache) {
            this.prisma = prisma;
            this.cache = cache;
        }
        // ---------- Audit helper ----------
        LearningMaterialsService_1.prototype.audit = function (opts) {
            var _a, _b, _c, _d, _e, _f, _g;
            return this.prisma.auditLog.create({
                data: {
                    userId: (_a = opts.userId) !== null && _a !== void 0 ? _a : null,
                    organizationId: (_b = opts.orgId) !== null && _b !== void 0 ? _b : null,
                    entityType: client_1.AuditEntityType.LEARNING_MATERIAL,
                    entityId: (_c = opts.entityId) !== null && _c !== void 0 ? _c : null,
                    action: opts.action,
                    ipAddress: (_d = opts.ip) !== null && _d !== void 0 ? _d : null,
                    userAgent: (_e = opts.ua) !== null && _e !== void 0 ? _e : null,
                    metadata: (_f = opts.metadata) !== null && _f !== void 0 ? _f : null,
                    changedFields: (_g = opts.changedFields) !== null && _g !== void 0 ? _g : null,
                },
            });
        };
        LearningMaterialsService_1.prototype.includeAll = function () {
            return client_1.Prisma.validator()({
                subject: true,
                topicLevel: true,
                organization: true,
                createdBy: { include: { user: true, organization: true } },
            });
        };
        // ---------- CREATE ----------
        LearningMaterialsService_1.prototype.create = function (dto, user, ctx) {
            return __awaiter(this, void 0, void 0, function () {
                var scope, orgId, uid, sameOrg, allowed, authorMembershipId, authorMembership, anyMember, subject, tl, created;
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
                return __generator(this, function (_o) {
                    switch (_o.label) {
                        case 0:
                            scope = (_a = dto.scope) !== null && _a !== void 0 ? _a : client_1.ContentScope.ORGANIZATION;
                            orgId = (_b = dto.organizationId) !== null && _b !== void 0 ? _b : null;
                            uid = user.userId;
                            // 1) Org context + membership autora
                            if (scope === client_1.ContentScope.GLOBAL && orgId) {
                                throw new common_1.BadRequestException('Pro GLOBAL scope nesmí být vyplněn organizationId.');
                            }
                            sameOrg = !!orgId && user.organizationId === orgId;
                            allowed = user.systemRole === client_1.SystemRole.SUPERADMIN ||
                                (sameOrg &&
                                    (user.organizationRole === client_1.OrganizationRole.DIRECTOR ||
                                        user.organizationRole === client_1.OrganizationRole.TEACHER));
                            if (!allowed) {
                                throw new common_1.ForbiddenException('Nemáte oprávnění vytvořit materiál v této organizaci.');
                            }
                            authorMembershipId = null;
                            if (!(scope === client_1.ContentScope.ORGANIZATION)) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: {
                                        userId: uid,
                                        organizationId: orgId,
                                        deletedAt: null,
                                    },
                                    select: { id: true },
                                })];
                        case 1:
                            authorMembership = _o.sent();
                            if (!authorMembership) {
                                throw new common_1.ForbiddenException('Autor není členem dané organizace.');
                            }
                            authorMembershipId = authorMembership.id;
                            return [3 /*break*/, 4];
                        case 2: return [4 /*yield*/, this.prisma.membership.findFirst({
                                where: { userId: uid, deletedAt: null },
                                select: { id: true },
                            })];
                        case 3:
                            anyMember = _o.sent();
                            authorMembershipId = (_c = anyMember === null || anyMember === void 0 ? void 0 : anyMember.id) !== null && _c !== void 0 ? _c : null;
                            _o.label = 4;
                        case 4:
                            if (!dto.subjectId) return [3 /*break*/, 6];
                            return [4 /*yield*/, this.prisma.subject.findFirst({
                                    where: {
                                        id: dto.subjectId,
                                        organizationId: orgId !== null && orgId !== void 0 ? orgId : undefined,
                                        deletedAt: null,
                                    },
                                    select: { id: true },
                                })];
                        case 5:
                            subject = _o.sent();
                            if (!subject)
                                throw new common_1.BadRequestException('Subject neexistuje v dané organizaci.');
                            _o.label = 6;
                        case 6:
                            if (!dto.topicLevelId) return [3 /*break*/, 8];
                            return [4 /*yield*/, this.prisma.topicLevel.findFirst({
                                    where: { id: dto.topicLevelId },
                                    select: { id: true },
                                })];
                        case 7:
                            tl = _o.sent();
                            if (!tl)
                                throw new common_1.BadRequestException('TopicLevel neexistuje.');
                            _o.label = 8;
                        case 8:
                            // accessLevel PAID ⇒ price vyžadována (zajištěno i v DTO přes ValidateIf)
                            if (dto.accessLevel === client_1.MaterialAccessLevel.PAID &&
                                (dto.price === undefined || dto.price === null)) {
                                throw new common_1.BadRequestException('Pro placený materiál je nutné zadat price.');
                            }
                            return [4 /*yield*/, this.prisma.learningMaterial.create({
                                    data: {
                                        title: dto.title,
                                        description: (_d = dto.description) !== null && _d !== void 0 ? _d : null,
                                        contentType: dto.contentType,
                                        educationLevel: dto.educationLevel,
                                        schoolGrade: (_e = dto.schoolGrade) !== null && _e !== void 0 ? _e : null,
                                        subjectId: (_f = dto.subjectId) !== null && _f !== void 0 ? _f : null,
                                        topicLevelId: (_g = dto.topicLevelId) !== null && _g !== void 0 ? _g : null,
                                        scope: scope,
                                        organizationId: orgId,
                                        createdById: authorMembershipId, // pro GLOBAL fallback na libovolné členství
                                        accessLevel: (_h = dto.accessLevel) !== null && _h !== void 0 ? _h : client_1.MaterialAccessLevel.FREE,
                                        price: (_j = dto.price) !== null && _j !== void 0 ? _j : null,
                                        isDownloadable: (_k = dto.isDownloadable) !== null && _k !== void 0 ? _k : true,
                                    },
                                    include: this.includeAll(),
                                })];
                        case 9:
                            created = _o.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: uid,
                                    orgId: orgId,
                                    action: 'MATERIAL_CREATE',
                                    entityId: created.id,
                                    changedFields: dto,
                                    ip: (_l = ctx === null || ctx === void 0 ? void 0 : ctx.ip) !== null && _l !== void 0 ? _l : null,
                                    ua: (_m = ctx === null || ctx === void 0 ? void 0 : ctx.ua) !== null && _m !== void 0 ? _m : null,
                                })];
                        case 10:
                            _o.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, scope === client_1.ContentScope.GLOBAL
                                    ? 'GLOBAL'
                                    : (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, orgId))];
                        case 11:
                            _o.sent();
                            return [2 /*return*/, created];
                    }
                });
            });
        };
        // ---------- LIST ----------
        LearningMaterialsService_1.prototype.findAll = function (user, q) {
            return __awaiter(this, void 0, void 0, function () {
                var page, limit, skip, isSuper, effectiveOrgId, where, t, include, scopeId, ver, cacheKey;
                var _this = this;
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                return __generator(this, function (_m) {
                    switch (_m.label) {
                        case 0:
                            page = (_a = q.page) !== null && _a !== void 0 ? _a : 1;
                            limit = Math.min((_b = q.limit) !== null && _b !== void 0 ? _b : 20, 100);
                            skip = (page - 1) * limit;
                            isSuper = user.systemRole === client_1.SystemRole.SUPERADMIN;
                            effectiveOrgId = (_c = q.organizationId) !== null && _c !== void 0 ? _c : null;
                            if (!isSuper) {
                                effectiveOrgId = (_e = (_d = q.organizationId) !== null && _d !== void 0 ? _d : user.organizationId) !== null && _e !== void 0 ? _e : null;
                                if (!effectiveOrgId)
                                    throw new common_1.ForbiddenException('Missing organization context.');
                            }
                            where = __assign(__assign(__assign(__assign(__assign(__assign({ deletedAt: null }, (q.scope ? { scope: q.scope } : {})), (q.contentType ? { contentType: q.contentType } : {})), (q.educationLevel ? { educationLevel: q.educationLevel } : {})), (q.schoolGrade ? { schoolGrade: q.schoolGrade } : {})), (q.subjectId ? { subjectId: q.subjectId } : {})), (q.topicLevelId ? { topicLevelId: q.topicLevelId } : {}));
                            if (isSuper) {
                                if (effectiveOrgId) {
                                    // když superadmin pošle organizationId, filtruj na tu ORG
                                    where.organizationId = effectiveOrgId;
                                }
                                else {
                                    // ⬇️ NOVÉ: bez orgId ukaž jen GLOBAL
                                    where.scope = client_1.ContentScope.GLOBAL;
                                }
                            }
                            else {
                                where.OR = [
                                    { scope: client_1.ContentScope.GLOBAL },
                                    { organizationId: effectiveOrgId },
                                ];
                            }
                            t = materialSearch(q.search);
                            if (t)
                                Object.assign(where, t);
                            include = this.includeAll();
                            scopeId = effectiveOrgId !== null && effectiveOrgId !== void 0 ? effectiveOrgId : 'GLOBAL';
                            return [4 /*yield*/, (0, org_cache_utils_1.getOrgVersion)(this.cache, scopeId)];
                        case 1:
                            ver = _m.sent();
                            cacheKey = (0, org_cache_utils_1.buildVersionedListKey)({
                                namespace: 'learning-materials',
                                scopeId: scopeId,
                                version: ver,
                                page: page,
                                limit: limit,
                                search: q.search,
                                order: [{ title: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
                                filters: {
                                    scope: (_f = q.scope) !== null && _f !== void 0 ? _f : null,
                                    contentType: (_g = q.contentType) !== null && _g !== void 0 ? _g : null,
                                    educationLevel: (_h = q.educationLevel) !== null && _h !== void 0 ? _h : null,
                                    schoolGrade: (_j = q.schoolGrade) !== null && _j !== void 0 ? _j : null,
                                    subjectId: (_k = q.subjectId) !== null && _k !== void 0 ? _k : null,
                                    topicLevelId: (_l = q.topicLevelId) !== null && _l !== void 0 ? _l : null,
                                },
                            });
                            return [2 /*return*/, (0, org_cache_utils_1.cacheGetOrSet)(this.cache, cacheKey, 600000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var _a, total, items;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, this.prisma.$transaction([
                                                    this.prisma.learningMaterial.count({ where: where }),
                                                    this.prisma.learningMaterial.findMany({
                                                        where: where,
                                                        include: include,
                                                        orderBy: [{ title: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
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
        LearningMaterialsService_1.prototype.findOne = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var uid, m, member;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            uid = user.userId;
                            return [4 /*yield*/, this.prisma.learningMaterial.findFirst({
                                    where: { id: id, deletedAt: null },
                                    include: this.includeAll(),
                                })];
                        case 1:
                            m = _a.sent();
                            if (!m)
                                throw new common_1.NotFoundException('LearningMaterial not found');
                            if (user.systemRole === client_1.SystemRole.SUPERADMIN)
                                return [2 /*return*/, m];
                            if (m.scope === client_1.ContentScope.GLOBAL)
                                return [2 /*return*/, m];
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: {
                                        userId: uid,
                                        organizationId: m.organizationId,
                                        deletedAt: null,
                                    },
                                    select: { id: true },
                                })];
                        case 2:
                            member = _a.sent();
                            if (!member)
                                throw new common_1.ForbiddenException('Access denied');
                            return [2 /*return*/, m];
                    }
                });
            });
        };
        // ---------- UPDATE ----------
        LearningMaterialsService_1.prototype.update = function (id, dto, user, ctx) {
            return __awaiter(this, void 0, void 0, function () {
                var uid, current, sameOrg, isDirector, author, updated;
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
                return __generator(this, function (_p) {
                    switch (_p.label) {
                        case 0:
                            uid = user.userId;
                            return [4 /*yield*/, this.prisma.learningMaterial.findUnique({
                                    where: { id: id },
                                    select: {
                                        id: true,
                                        organizationId: true,
                                        scope: true,
                                        createdById: true,
                                        deletedAt: true,
                                    },
                                })];
                        case 1:
                            current = _p.sent();
                            if (!current || current.deletedAt)
                                throw new common_1.NotFoundException('Material not found');
                            sameOrg = user.organizationId && current.organizationId === user.organizationId;
                            isDirector = user.organizationRole === client_1.OrganizationRole.DIRECTOR && !!sameOrg;
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: { id: current.createdById, userId: uid },
                                    select: { id: true },
                                })];
                        case 2:
                            author = _p.sent();
                            if (!(user.systemRole === client_1.SystemRole.SUPERADMIN || isDirector || !!author)) {
                                throw new common_1.ForbiddenException('Nemáte oprávnění upravit tento materiál.');
                            }
                            if (dto.organizationId || dto.scope) {
                                throw new common_1.BadRequestException('Změna scope/organizationId není povolena.');
                            }
                            return [4 /*yield*/, this.prisma.learningMaterial.update({
                                    where: { id: id },
                                    data: {
                                        title: (_a = dto.title) !== null && _a !== void 0 ? _a : undefined,
                                        description: (_b = dto.description) !== null && _b !== void 0 ? _b : undefined,
                                        contentType: (_c = dto.contentType) !== null && _c !== void 0 ? _c : undefined,
                                        educationLevel: (_d = dto.educationLevel) !== null && _d !== void 0 ? _d : undefined,
                                        schoolGrade: (_e = dto.schoolGrade) !== null && _e !== void 0 ? _e : undefined,
                                        subjectId: (_f = dto.subjectId) !== null && _f !== void 0 ? _f : undefined,
                                        topicLevelId: (_g = dto.topicLevelId) !== null && _g !== void 0 ? _g : undefined,
                                        accessLevel: (_h = dto.accessLevel) !== null && _h !== void 0 ? _h : undefined,
                                        price: (_j = dto.price) !== null && _j !== void 0 ? _j : undefined,
                                        isDownloadable: (_k = dto.isDownloadable) !== null && _k !== void 0 ? _k : undefined,
                                    },
                                    include: this.includeAll(),
                                })];
                        case 3:
                            updated = _p.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: uid,
                                    orgId: current.organizationId,
                                    action: 'MATERIAL_UPDATE',
                                    entityId: id,
                                    changedFields: dto,
                                    ip: (_l = ctx === null || ctx === void 0 ? void 0 : ctx.ip) !== null && _l !== void 0 ? _l : null,
                                    ua: (_m = ctx === null || ctx === void 0 ? void 0 : ctx.ua) !== null && _m !== void 0 ? _m : null,
                                })];
                        case 4:
                            _p.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, current.scope === client_1.ContentScope.GLOBAL
                                    ? 'GLOBAL'
                                    : (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, (_o = current.organizationId) !== null && _o !== void 0 ? _o : 'GLOBAL'))];
                        case 5:
                            _p.sent();
                            return [2 /*return*/, updated];
                    }
                });
            });
        };
        // ---------- DELETE (soft) ----------
        LearningMaterialsService_1.prototype.remove = function (id, user, ctx) {
            return __awaiter(this, void 0, void 0, function () {
                var uid, current, sameOrg, allowed, deleted;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            uid = user.userId;
                            return [4 /*yield*/, this.prisma.learningMaterial.findUnique({
                                    where: { id: id },
                                    select: { id: true, organizationId: true, scope: true, deletedAt: true },
                                })];
                        case 1:
                            current = _d.sent();
                            if (!current || current.deletedAt)
                                throw new common_1.NotFoundException('Material not found');
                            sameOrg = user.organizationId === current.organizationId;
                            allowed = user.systemRole === client_1.SystemRole.SUPERADMIN ||
                                (sameOrg && user.organizationRole === client_1.OrganizationRole.DIRECTOR);
                            if (!allowed)
                                throw new common_1.ForbiddenException('Pouze ředitel nebo superadmin může smazat materiál.');
                            return [4 /*yield*/, this.prisma.learningMaterial.update({
                                    where: { id: id },
                                    data: { deletedAt: new Date() },
                                })];
                        case 2:
                            deleted = _d.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: uid,
                                    orgId: current.organizationId,
                                    action: 'MATERIAL_DELETE_SOFT',
                                    entityId: id,
                                    ip: (_a = ctx === null || ctx === void 0 ? void 0 : ctx.ip) !== null && _a !== void 0 ? _a : null,
                                    ua: (_b = ctx === null || ctx === void 0 ? void 0 : ctx.ua) !== null && _b !== void 0 ? _b : null,
                                })];
                        case 3:
                            _d.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, current.scope === client_1.ContentScope.GLOBAL
                                    ? 'GLOBAL'
                                    : (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, (_c = current.organizationId) !== null && _c !== void 0 ? _c : 'GLOBAL'))];
                        case 4:
                            _d.sent();
                            return [2 /*return*/, deleted];
                    }
                });
            });
        };
        // ---------- ATTACH FILE (PDF) ----------
        LearningMaterialsService_1.prototype.attachFile = function (id, file, user, ctx) {
            return __awaiter(this, void 0, void 0, function () {
                var uid, m, sameOrg, allowed, uploadsDir, targetPath, publicUrl, updated, scopeId;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            uid = (_a = user.userId) !== null && _a !== void 0 ? _a : user.userId;
                            return [4 /*yield*/, this.prisma.learningMaterial.findUnique({
                                    where: { id: id },
                                    select: { id: true, organizationId: true, scope: true, deletedAt: true },
                                })];
                        case 1:
                            m = _e.sent();
                            if (!m || m.deletedAt)
                                throw new common_1.NotFoundException('Material not found');
                            sameOrg = user.organizationId === m.organizationId;
                            allowed = user.systemRole === client_1.SystemRole.SUPERADMIN ||
                                (sameOrg &&
                                    (user.organizationRole === client_1.OrganizationRole.DIRECTOR ||
                                        user.organizationRole === client_1.OrganizationRole.TEACHER));
                            if (!allowed)
                                throw new common_1.ForbiddenException('Nemáte oprávnění nahrát soubor.');
                            if (!isPdfBuffer(Buffer.from(file.buffer))) {
                                throw new common_1.BadRequestException('Soubor nevypadá jako platné PDF (chybí PDF magic bytes).');
                            }
                            uploadsDir = path.resolve(process.cwd(), 'uploads', 'materials');
                            fs.mkdirSync(uploadsDir, { recursive: true });
                            targetPath = path.join(uploadsDir, "".concat(id, ".pdf"));
                            fs.writeFileSync(targetPath, file.buffer);
                            publicUrl = "/uploads/materials/".concat(id, ".pdf");
                            return [4 /*yield*/, this.prisma.learningMaterial.update({
                                    where: { id: id },
                                    data: { fileUrl: publicUrl },
                                })];
                        case 2:
                            updated = _e.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: uid,
                                    orgId: m.organizationId,
                                    action: 'MATERIAL_FILE_ATTACH',
                                    entityId: id,
                                    ip: (_b = ctx === null || ctx === void 0 ? void 0 : ctx.ip) !== null && _b !== void 0 ? _b : null,
                                    ua: (_c = ctx === null || ctx === void 0 ? void 0 : ctx.ua) !== null && _c !== void 0 ? _c : null,
                                    metadata: {
                                        fileUrl: publicUrl,
                                        bytes: file.size,
                                        mimetype: file.mimetype,
                                    },
                                })];
                        case 3:
                            _e.sent();
                            scopeId = m.scope === client_1.ContentScope.GLOBAL
                                ? 'GLOBAL'
                                : ((_d = m.organizationId) !== null && _d !== void 0 ? _d : 'GLOBAL');
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, scopeId)];
                        case 4:
                            _e.sent();
                            return [2 /*return*/, updated];
                    }
                });
            });
        };
        return LearningMaterialsService_1;
    }());
    __setFunctionName(_classThis, "LearningMaterialsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        LearningMaterialsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return LearningMaterialsService = _classThis;
}();
exports.LearningMaterialsService = LearningMaterialsService;
