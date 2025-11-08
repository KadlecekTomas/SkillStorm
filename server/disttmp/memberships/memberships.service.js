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
exports.MembershipsService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var org_cache_utils_1 = require("../shared/cache/org-cache.utils");
var MembershipsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var MembershipsService = _classThis = /** @class */ (function () {
        function MembershipsService_1(prisma, cache) {
            this.prisma = prisma;
            this.cache = cache;
        }
        // -------- CREATE --------
        MembershipsService_1.prototype.create = function (dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var isSuper, sameOrg, _a, org, memberUser, exists, created;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            isSuper = (user === null || user === void 0 ? void 0 : user.systemRole) === client_1.SystemRole.SUPERADMIN;
                            sameOrg = (user === null || user === void 0 ? void 0 : user.organizationId) && user.organizationId === dto.organizationId;
                            if (!(isSuper || sameOrg)) {
                                throw new common_1.ForbiddenException('Cross-organization create is forbidden.');
                            }
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.organization.findUnique({
                                        where: { id: dto.organizationId },
                                    }),
                                    this.prisma.user.findUnique({ where: { id: dto.userId } }),
                                ])];
                        case 1:
                            _a = _b.sent(), org = _a[0], memberUser = _a[1];
                            if (!org)
                                throw new common_1.NotFoundException('Organizace nebyla nalezena');
                            if (!memberUser)
                                throw new common_1.NotFoundException('Uživatel nebyl nalezen');
                            return [4 /*yield*/, this.prisma.membership.findUnique({
                                    where: {
                                        userId_organizationId: {
                                            userId: dto.userId,
                                            organizationId: dto.organizationId,
                                        },
                                    },
                                })];
                        case 2:
                            exists = _b.sent();
                            if (exists) {
                                throw new common_1.ConflictException('Uživatel je už členem této organizace.');
                            }
                            return [4 /*yield*/, this.prisma.membership.create({ data: dto })];
                        case 3:
                            created = _b.sent();
                            // invalidace listů v rámci org
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, dto.organizationId)];
                        case 4:
                            // invalidace listů v rámci org
                            _b.sent();
                            return [2 /*return*/, created];
                    }
                });
            });
        };
        // -------- LIST (search + pagination + cache) --------
        MembershipsService_1.prototype.findAll = function (user, q) {
            return __awaiter(this, void 0, void 0, function () {
                var page, limit, skip, isSuper, director, where, orderBy, scopeId, ver, cacheKey;
                var _this = this;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            page = (_a = q.page) !== null && _a !== void 0 ? _a : 1;
                            limit = (_b = q.limit) !== null && _b !== void 0 ? _b : 20;
                            skip = (page - 1) * limit;
                            isSuper = (user === null || user === void 0 ? void 0 : user.systemRole) === client_1.SystemRole.SUPERADMIN;
                            // 1) organizationId je POVINNÝ pro všechny (včetně superadmina)
                            if (!q.organizationId) {
                                throw new common_1.BadRequestException('organizationId is required.');
                            }
                            if (!!isSuper) return [3 /*break*/, 2];
                            if ((user === null || user === void 0 ? void 0 : user.organizationId) !== q.organizationId) {
                                throw new common_1.ForbiddenException('Cross-organization list is forbidden.');
                            }
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: {
                                        userId: (_c = user === null || user === void 0 ? void 0 : user.userId) !== null && _c !== void 0 ? _c : user === null || user === void 0 ? void 0 : user.sub,
                                        organizationId: q.organizationId,
                                        role: client_1.OrganizationRole.DIRECTOR,
                                        deletedAt: null,
                                    },
                                    select: { id: true },
                                })];
                        case 1:
                            director = _e.sent();
                            if (!director) {
                                throw new common_1.ForbiddenException('Access denied (not a director in this organization).');
                            }
                            _e.label = 2;
                        case 2:
                            where = __assign(__assign({ organizationId: q.organizationId, deletedAt: null }, (q.role ? { role: q.role } : {})), { user: (0, org_cache_utils_1.makeUserSearch)(q.search) });
                            orderBy = [
                                { user: { name: 'asc' } },
                                { id: 'asc' },
                            ];
                            scopeId = q.organizationId;
                            return [4 /*yield*/, (0, org_cache_utils_1.getOrgVersion)(this.cache, scopeId)];
                        case 3:
                            ver = _e.sent();
                            cacheKey = (0, org_cache_utils_1.buildVersionedListKey)({
                                namespace: 'memberships',
                                scopeId: scopeId,
                                version: ver,
                                page: page,
                                limit: limit,
                                search: q.search,
                                order: [{ user: { name: 'asc' } }, { id: 'asc' }],
                                filters: { role: (_d = q.role) !== null && _d !== void 0 ? _d : null },
                            });
                            return [2 /*return*/, (0, org_cache_utils_1.cacheGetOrSet)(this.cache, cacheKey, 600000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var _a, total, items;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, this.prisma.$transaction([
                                                    this.prisma.membership.count({ where: where }),
                                                    this.prisma.membership.findMany({
                                                        where: where,
                                                        orderBy: orderBy,
                                                        skip: skip,
                                                        take: limit,
                                                        include: {
                                                            user: {
                                                                select: {
                                                                    id: true,
                                                                    email: true,
                                                                    username: true,
                                                                    name: true,
                                                                    preferredLang: true,
                                                                    systemRole: true,
                                                                    status: true,
                                                                    lastLoginAt: true,
                                                                    isAnonymized: true,
                                                                    createdAt: true,
                                                                    updatedAt: true,
                                                                    deletedAt: true,
                                                                },
                                                            },
                                                            teacher: {
                                                                include: {
                                                                    subjects: {
                                                                        include: { subject: { select: { id: true, name: true } } },
                                                                    },
                                                                    homeroomOf: {
                                                                        select: {
                                                                            id: true,
                                                                            grade: true,
                                                                            section: true,
                                                                            label: true,
                                                                            academicYear: {
                                                                                select: { id: true, label: true, isCurrent: true },
                                                                            },
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                            student: {
                                                                include: {
                                                                    enrollments: {
                                                                        include: {
                                                                            academicYear: {
                                                                                select: { id: true, label: true, isCurrent: true },
                                                                            },
                                                                            classSection: {
                                                                                select: {
                                                                                    id: true,
                                                                                    grade: true,
                                                                                    section: true,
                                                                                    label: true,
                                                                                },
                                                                            },
                                                                        },
                                                                    },
                                                                    StudentClassroom: {
                                                                        include: {
                                                                            classSection: {
                                                                                select: {
                                                                                    id: true,
                                                                                    grade: true,
                                                                                    section: true,
                                                                                    label: true,
                                                                                },
                                                                            },
                                                                            TopicLevel: {
                                                                                select: {
                                                                                    id: true,
                                                                                    phase: true,
                                                                                    difficulty: true,
                                                                                    subjectLevel: {
                                                                                        select: {
                                                                                            id: true,
                                                                                            grade: true,
                                                                                            subject: { select: { id: true, name: true } },
                                                                                        },
                                                                                    },
                                                                                },
                                                                            },
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        },
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
        // -------- DETAIL (pro interní použití) --------
        MembershipsService_1.prototype.findOne = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var membership;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.membership.findUnique({
                                where: { id: id },
                            })];
                        case 1:
                            membership = _a.sent();
                            if (!membership)
                                throw new common_1.NotFoundException('Membership not found');
                            return [2 /*return*/, membership];
                    }
                });
            });
        };
        // -------- UPDATE --------
        MembershipsService_1.prototype.update = function (id, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var current, isSuper, sameOrg, updated;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.membership.findUnique({ where: { id: id } })];
                        case 1:
                            current = _b.sent();
                            if (!current)
                                throw new common_1.NotFoundException('Membership not found');
                            isSuper = (user === null || user === void 0 ? void 0 : user.systemRole) === client_1.SystemRole.SUPERADMIN;
                            sameOrg = (user === null || user === void 0 ? void 0 : user.organizationId) === current.organizationId;
                            if (!isSuper) {
                                if (!sameOrg)
                                    throw new common_1.ForbiddenException('Cross-organization update is forbidden.');
                                if (current.role === client_1.OrganizationRole.DIRECTOR) {
                                    throw new common_1.ForbiddenException('Ředitele může upravit pouze SUPERADMIN.');
                                }
                                if (current.userId === ((_a = user === null || user === void 0 ? void 0 : user.userId) !== null && _a !== void 0 ? _a : user === null || user === void 0 ? void 0 : user.sub)) {
                                    throw new common_1.ForbiddenException('Nemůžeš měnit vlastní členství.');
                                }
                            }
                            return [4 /*yield*/, this.prisma.membership.update({
                                    where: { id: id },
                                    data: { role: dto.role },
                                    select: {
                                        id: true,
                                        userId: true,
                                        organizationId: true, // 👈 důležité pro invalidaci
                                        role: true,
                                        createdAt: true,
                                        updatedAt: true,
                                    },
                                })];
                        case 2:
                            updated = _b.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, current.organizationId)];
                        case 3:
                            _b.sent();
                            return [2 /*return*/, updated];
                    }
                });
            });
        };
        // -------- DELETE --------
        MembershipsService_1.prototype.remove = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var current, isSuper, sameOrg, deleted;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.membership.findUnique({ where: { id: id } })];
                        case 1:
                            current = _b.sent();
                            if (!current)
                                throw new common_1.NotFoundException('Membership not found');
                            isSuper = (user === null || user === void 0 ? void 0 : user.systemRole) === client_1.SystemRole.SUPERADMIN;
                            sameOrg = (user === null || user === void 0 ? void 0 : user.organizationId) === current.organizationId;
                            if (!isSuper) {
                                if (!sameOrg)
                                    throw new common_1.ForbiddenException('Cross-organization delete is forbidden.');
                                if (current.role === client_1.OrganizationRole.DIRECTOR) {
                                    throw new common_1.ForbiddenException('Ředitele může upravit pouze SUPERADMIN.');
                                }
                                if (current.userId === ((_a = user === null || user === void 0 ? void 0 : user.userId) !== null && _a !== void 0 ? _a : user === null || user === void 0 ? void 0 : user.sub)) {
                                    throw new common_1.ForbiddenException('Nemůžeš smazat vlastní členství.');
                                }
                            }
                            return [4 /*yield*/, this.prisma.membership.delete({ where: { id: id } })];
                        case 2:
                            deleted = _b.sent();
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, current.organizationId)];
                        case 3:
                            _b.sent();
                            return [2 /*return*/, __assign(__assign({}, deleted), { organizationId: current.organizationId })];
                    }
                });
            });
        };
        return MembershipsService_1;
    }());
    __setFunctionName(_classThis, "MembershipsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MembershipsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MembershipsService = _classThis;
}();
exports.MembershipsService = MembershipsService;
