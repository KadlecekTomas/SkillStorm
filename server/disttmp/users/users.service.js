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
exports.UsersService = void 0;
// src/users/users.service.ts
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var library_1 = require("@prisma/client/runtime/library");
var bcrypt = require("bcrypt");
var uuid_1 = require("uuid");
// pokud to máš jinde, nech cestu dle projektu
var org_cache_utils_1 = require("../shared/cache/org-cache.utils");
var UsersService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var UsersService = _classThis = /** @class */ (function () {
        function UsersService_1(prisma, cache) {
            this.prisma = prisma;
            this.cache = cache;
            // -------- výběr bez citlivých polí --------
            this.selectSafe = {
                id: true,
                email: true,
                username: true,
                name: true,
                preferredLang: true,
                systemRole: true,
                status: true,
                lastLoginAt: true,
                isAnonymized: true,
                deletedAt: true,
            };
            // -------- cache versioning --------
            this.GLOBAL_VER = 'users_version_global';
            this.userVerKey = function (id) { return "user_v:".concat(id); };
            this.detailKey = function (id, ver) {
                return "users:detail:".concat(id, ":v").concat(ver);
            };
        }
        // -------- audit helper --------
        UsersService_1.prototype.audit = function (opts) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0: return [4 /*yield*/, this.prisma.auditLog.create({
                                data: {
                                    userId: (_a = opts.userId) !== null && _a !== void 0 ? _a : null,
                                    organizationId: (_b = opts.orgId) !== null && _b !== void 0 ? _b : null,
                                    entityType: client_1.AuditEntityType.USER,
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
        UsersService_1.prototype.getGlobalVer = function () {
            return __awaiter(this, void 0, void 0, function () {
                var v;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.cache.get(this.GLOBAL_VER)];
                        case 1:
                            v = _a.sent();
                            return [2 /*return*/, typeof v === 'number' ? v : 1];
                    }
                });
            });
        };
        UsersService_1.prototype.bumpGlobal = function () {
            return __awaiter(this, void 0, void 0, function () {
                var v;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getGlobalVer()];
                        case 1:
                            v = _a.sent();
                            // TTL musí být objekt; 0 = bez expirace
                            return [4 /*yield*/, this.cache.set(this.GLOBAL_VER, v + 1, 0)];
                        case 2:
                            // TTL musí být objekt; 0 = bez expirace
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        UsersService_1.prototype.getUserVer = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var v;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.cache.get(this.userVerKey(id))];
                        case 1:
                            v = _a.sent();
                            return [2 /*return*/, typeof v === 'number' ? v : 1];
                    }
                });
            });
        };
        UsersService_1.prototype.bumpUser = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var v;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getUserVer(id)];
                        case 1:
                            v = _a.sent();
                            return [4 /*yield*/, this.cache.set(this.userVerKey(id), v + 1, 0)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        UsersService_1.prototype.cacheGetOrSet = function (key, ttlSec, factory) {
            return __awaiter(this, void 0, void 0, function () {
                var hit, fresh;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.cache.get(key)];
                        case 1:
                            hit = _a.sent();
                            if (hit !== undefined && hit !== null)
                                return [2 /*return*/, hit];
                            return [4 /*yield*/, factory()];
                        case 2:
                            fresh = _a.sent();
                            return [4 /*yield*/, this.cache.set(key, fresh, ttlSec)];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, fresh];
                    }
                });
            });
        };
        // -------- LIST (jednoduchý; nepoužívá controller) --------
        UsersService_1.prototype.findAll = function (q) {
            return __awaiter(this, void 0, void 0, function () {
                var skip, where, ver, cacheKey;
                var _this = this;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            skip = (q.page - 1) * q.limit;
                            where = __assign({ isAnonymized: false, deletedAt: null }, (q.search
                                ? {
                                    OR: [
                                        { name: { contains: q.search, mode: 'insensitive' } },
                                        { email: { contains: q.search, mode: 'insensitive' } },
                                        { username: { contains: q.search, mode: 'insensitive' } },
                                    ],
                                }
                                : {}));
                            return [4 /*yield*/, this.getGlobalVer()];
                        case 1:
                            ver = _b.sent();
                            cacheKey = "users:list:v".concat(ver, ":p").concat(q.page, ":l").concat(q.limit, ":s=").concat((_a = q.search) !== null && _a !== void 0 ? _a : '');
                            return [2 /*return*/, this.cacheGetOrSet(cacheKey, 60, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var _a, total, data;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, this.prisma.$transaction([
                                                    this.prisma.user.count({ where: where }),
                                                    this.prisma.user.findMany({
                                                        where: where,
                                                        select: this.selectSafe,
                                                        orderBy: [{ name: 'asc' }, { email: 'asc' }],
                                                        skip: skip,
                                                        take: q.limit,
                                                    }),
                                                ])];
                                            case 1:
                                                _a = _b.sent(), total = _a[0], data = _a[1];
                                                return [2 /*return*/, {
                                                        data: data,
                                                        meta: {
                                                            page: q.page,
                                                            limit: q.limit,
                                                            total: total,
                                                            pages: Math.max(1, Math.ceil(total / q.limit)),
                                                        },
                                                    }];
                                        }
                                    });
                                }); })];
                    }
                });
            });
        };
        // -------- DETAIL (verzovaná cache) --------
        UsersService_1.prototype.findOneSafe = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var ver, cacheKey;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getUserVer(id)];
                        case 1:
                            ver = _a.sent();
                            cacheKey = this.detailKey(id, ver);
                            return [2 /*return*/, this.cacheGetOrSet(cacheKey, 60, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var user;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, this.prisma.user.findUnique({
                                                    where: { id: id },
                                                    select: __assign(__assign({}, this.selectSafe), { memberships: {
                                                            select: { id: true, organizationId: true, role: true },
                                                        } }),
                                                })];
                                            case 1:
                                                user = _a.sent();
                                                if (!user || user.isAnonymized || user.deletedAt) {
                                                    throw new common_1.NotFoundException('User not found');
                                                }
                                                return [2 /*return*/, user];
                                        }
                                    });
                                }); })];
                    }
                });
            });
        };
        // -------- CREATE --------
        UsersService_1.prototype.create = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var passwordHash, created, error_1, target;
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0: return [4 /*yield*/, bcrypt.hash(dto.password, 10)];
                        case 1:
                            passwordHash = _f.sent();
                            _f.label = 2;
                        case 2:
                            _f.trys.push([2, 6, , 7]);
                            return [4 /*yield*/, this.prisma.user.create({
                                    data: {
                                        email: dto.email,
                                        username: (_a = dto.username) !== null && _a !== void 0 ? _a : null,
                                        name: dto.name,
                                        preferredLang: (_b = dto.preferredLang) !== null && _b !== void 0 ? _b : null,
                                        passwordHash: passwordHash,
                                        systemRole: (_c = dto.systemRole) !== null && _c !== void 0 ? _c : null,
                                    },
                                    select: this.selectSafe,
                                })];
                        case 3:
                            created = _f.sent();
                            return [4 /*yield*/, this.audit({
                                    action: 'USER_CREATE',
                                    entityId: created.id,
                                    changedFields: __assign(__assign({}, dto), { password: '***' }),
                                })];
                        case 4:
                            _f.sent();
                            return [4 /*yield*/, this.bumpGlobal()];
                        case 5:
                            _f.sent(); // invalidace listů
                            return [2 /*return*/, { user: created, affectedOrgIds: [] }];
                        case 6:
                            error_1 = _f.sent();
                            if (error_1 instanceof library_1.PrismaClientKnownRequestError &&
                                error_1.code === 'P2002') {
                                target = (_e = (_d = error_1.meta) === null || _d === void 0 ? void 0 : _d.target) !== null && _e !== void 0 ? _e : [];
                                if (target.some(function (t) { return t.includes('email'); })) {
                                    throw new common_1.ConflictException('Email už existuje.');
                                }
                                if (target.some(function (t) { return t.includes('username'); })) {
                                    throw new common_1.ConflictException('Username už existuje.');
                                }
                            }
                            throw error_1;
                        case 7: return [2 /*return*/];
                    }
                });
            });
        };
        // -------- UPDATE --------
        UsersService_1.prototype.update = function (id, dto, opts) {
            return __awaiter(this, void 0, void 0, function () {
                var current, data, _a, updated, memberships, affectedOrgIds, error_2, target;
                var _b, _c, _d, _e, _f, _g, _h;
                return __generator(this, function (_j) {
                    switch (_j.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.findUnique({
                                where: { id: id },
                                select: {
                                    id: true,
                                    systemRole: true,
                                    isAnonymized: true,
                                    deletedAt: true,
                                },
                            })];
                        case 1:
                            current = _j.sent();
                            if (!current || current.isAnonymized || current.deletedAt) {
                                throw new common_1.NotFoundException('User not found');
                            }
                            if (dto.systemRole !== undefined && !opts.requesterIsSuperadmin) {
                                throw new common_1.ForbiddenException('Změnu systemRole smí jen SUPERADMIN.');
                            }
                            if (opts.requesterIsSuperadmin &&
                                opts.requesterId === id &&
                                dto.systemRole !== undefined &&
                                current.systemRole === client_1.SystemRole.SUPERADMIN &&
                                dto.systemRole !== client_1.SystemRole.SUPERADMIN) {
                                throw new common_1.ForbiddenException('Nelze si odebrat roli SUPERADMIN.');
                            }
                            data = {
                                email: (_b = dto.email) !== null && _b !== void 0 ? _b : undefined,
                                username: (_c = dto.username) !== null && _c !== void 0 ? _c : undefined,
                                name: (_d = dto.name) !== null && _d !== void 0 ? _d : undefined,
                                preferredLang: (_e = dto.preferredLang) !== null && _e !== void 0 ? _e : undefined,
                                systemRole: (_f = dto.systemRole) !== null && _f !== void 0 ? _f : undefined,
                            };
                            if (!dto.password) return [3 /*break*/, 3];
                            _a = data;
                            return [4 /*yield*/, bcrypt.hash(dto.password, 10)];
                        case 2:
                            _a.passwordHash = _j.sent();
                            _j.label = 3;
                        case 3:
                            _j.trys.push([3, 9, , 10]);
                            return [4 /*yield*/, this.prisma.user.update({
                                    where: { id: id },
                                    data: data,
                                    select: this.selectSafe,
                                })];
                        case 4:
                            updated = _j.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: opts.requesterId,
                                    action: 'USER_UPDATE',
                                    entityId: id,
                                    changedFields: __assign(__assign({}, dto), { password: dto.password ? '***' : undefined }),
                                })];
                        case 5:
                            _j.sent();
                            return [4 /*yield*/, this.prisma.membership.findMany({
                                    where: { userId: id },
                                    select: { organizationId: true },
                                })];
                        case 6:
                            memberships = _j.sent();
                            affectedOrgIds = __spreadArray([], new Set(memberships.map(function (m) { return m.organizationId; })), true);
                            // invalidace listů + detailu (přes bump verze)
                            return [4 /*yield*/, this.bumpGlobal()];
                        case 7:
                            // invalidace listů + detailu (přes bump verze)
                            _j.sent();
                            return [4 /*yield*/, this.bumpUser(id)];
                        case 8:
                            _j.sent();
                            return [2 /*return*/, { user: updated, affectedOrgIds: affectedOrgIds }];
                        case 9:
                            error_2 = _j.sent();
                            if (error_2 instanceof library_1.PrismaClientKnownRequestError &&
                                error_2.code === 'P2002') {
                                target = (_h = (_g = error_2.meta) === null || _g === void 0 ? void 0 : _g.target) !== null && _h !== void 0 ? _h : [];
                                if (target.some(function (t) { return t.includes('email'); })) {
                                    throw new common_1.ConflictException('Email už existuje.');
                                }
                                if (target.some(function (t) { return t.includes('username'); })) {
                                    throw new common_1.ConflictException('Username už existuje.');
                                }
                            }
                            throw error_2;
                        case 10: return [2 /*return*/];
                    }
                });
            });
        };
        // -------- DELETE / anonymizace --------
        UsersService_1.prototype.remove = function (id, requester) {
            return __awaiter(this, void 0, void 0, function () {
                var target, requesterIsSuperadmin, sameOrg, isDirector, affectedOrgIds, anonymizedEmail, updated;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.findUnique({
                                where: { id: id },
                                select: {
                                    id: true,
                                    systemRole: true,
                                    isAnonymized: true,
                                    deletedAt: true,
                                    memberships: { select: { organizationId: true } },
                                },
                            })];
                        case 1:
                            target = _c.sent();
                            if (!target || target.isAnonymized || target.deletedAt) {
                                throw new common_1.NotFoundException('User not found');
                            }
                            requesterIsSuperadmin = requester.systemRole === 'SUPERADMIN';
                            if (target.systemRole === client_1.SystemRole.SUPERADMIN && !requesterIsSuperadmin) {
                                throw new common_1.ForbiddenException('Smazat SUPERADMINa smí pouze SUPERADMIN.');
                            }
                            if (!requesterIsSuperadmin) {
                                sameOrg = target.memberships.some(function (m) { return m.organizationId === requester.organizationId; });
                                isDirector = requester.organizationRole === 'DIRECTOR';
                                if (!(sameOrg && isDirector)) {
                                    throw new common_1.ForbiddenException('Nemáš oprávnění smazat tohoto uživatele.');
                                }
                            }
                            affectedOrgIds = __spreadArray([], new Set(target.memberships.map(function (m) { return m.organizationId; })), true);
                            anonymizedEmail = "anonymized-".concat((0, uuid_1.v4)(), "@deleted.local");
                            return [4 /*yield*/, this.prisma.user.update({
                                    where: { id: id },
                                    data: {
                                        email: anonymizedEmail,
                                        username: null,
                                        name: 'Deleted User',
                                        status: 'INACTIVE',
                                        isAnonymized: true,
                                        deletedAt: new Date(),
                                    },
                                    select: this.selectSafe,
                                })];
                        case 2:
                            updated = _c.sent();
                            return [4 /*yield*/, this.prisma.refreshToken.deleteMany({ where: { userId: id } })];
                        case 3:
                            _c.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: (_a = requester.userId) !== null && _a !== void 0 ? _a : null,
                                    action: 'USER_DELETE_SOFT',
                                    entityId: id,
                                    metadata: { requesterOrgId: (_b = requester.organizationId) !== null && _b !== void 0 ? _b : null },
                                })];
                        case 4:
                            _c.sent();
                            // bump verze → další GET detailu sáhne na nový klíč a vrátí 404
                            return [4 /*yield*/, this.bumpGlobal()];
                        case 5:
                            // bump verze → další GET detailu sáhne na nový klíč a vrátí 404
                            _c.sent();
                            return [4 /*yield*/, this.bumpUser(id)];
                        case 6:
                            _c.sent();
                            return [2 /*return*/, { user: updated, affectedOrgIds: affectedOrgIds }];
                    }
                });
            });
        };
        // -------- last login (bez list cache; ať se hned projeví v detailu) --------
        UsersService_1.prototype.updateLastLogin = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                var res;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.update({
                                where: { id: userId },
                                data: { lastLoginAt: new Date() },
                                select: this.selectSafe,
                            })];
                        case 1:
                            res = _a.sent();
                            return [4 /*yield*/, this.bumpUser(userId)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, res];
                    }
                });
            });
        };
        // -------- LIST (plně filtrovaný/řazený; používá controller) --------
        UsersService_1.prototype.findAllQuery = function (requester, q) {
            return __awaiter(this, void 0, void 0, function () {
                var page, limit, skip, membershipsFilter, where, orderBy, ver, cacheKey;
                var _this = this;
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
                return __generator(this, function (_p) {
                    switch (_p.label) {
                        case 0:
                            page = (_a = q.page) !== null && _a !== void 0 ? _a : 1;
                            limit = Math.min(200, (_b = q.limit) !== null && _b !== void 0 ? _b : 50);
                            skip = (page - 1) * limit;
                            if (requester.systemRole !== 'SUPERADMIN') {
                                membershipsFilter = __assign(__assign({}, (membershipsFilter !== null && membershipsFilter !== void 0 ? membershipsFilter : {})), { organizationId: requester.organizationId });
                            }
                            if (requester.systemRole === 'SUPERADMIN' && q.organizationId) {
                                membershipsFilter = __assign(__assign({}, (membershipsFilter !== null && membershipsFilter !== void 0 ? membershipsFilter : {})), { organizationId: q.organizationId });
                            }
                            if (q.hasOrgRole) {
                                membershipsFilter = __assign(__assign({}, (membershipsFilter !== null && membershipsFilter !== void 0 ? membershipsFilter : {})), { role: q.hasOrgRole });
                            }
                            where = __assign(__assign({ isAnonymized: false, deletedAt: null }, (membershipsFilter
                                ? { memberships: { some: membershipsFilter } }
                                : {})), ((_c = (0, org_cache_utils_1.makeUserSearch)(q.search)) !== null && _c !== void 0 ? _c : {}));
                            orderBy = q.orderBy === 'email'
                                ? { email: (_d = q.orderDir) !== null && _d !== void 0 ? _d : 'asc' }
                                : q.orderBy === 'username'
                                    ? { username: (_e = q.orderDir) !== null && _e !== void 0 ? _e : 'asc' }
                                    : q.orderBy === 'lastLoginAt'
                                        ? { lastLoginAt: (_f = q.orderDir) !== null && _f !== void 0 ? _f : 'asc' }
                                        : { name: (_g = q.orderDir) !== null && _g !== void 0 ? _g : 'asc' };
                            return [4 /*yield*/, this.getGlobalVer()];
                        case 1:
                            ver = _p.sent();
                            cacheKey = [
                                'users:q',
                                "v".concat(ver),
                                "p".concat(page),
                                "l".concat(limit),
                                "s=".concat(((_h = q.search) !== null && _h !== void 0 ? _h : '').trim().toLowerCase()),
                                "org=".concat((_j = q.organizationId) !== null && _j !== void 0 ? _j : (requester.systemRole === 'SUPERADMIN' ? 'ALL' : ((_k = requester.organizationId) !== null && _k !== void 0 ? _k : '-'))),
                                "role=".concat((_l = q.hasOrgRole) !== null && _l !== void 0 ? _l : '-'),
                                "ob=".concat((_m = q.orderBy) !== null && _m !== void 0 ? _m : 'name'),
                                "od=".concat((_o = q.orderDir) !== null && _o !== void 0 ? _o : 'asc'),
                            ].join(':');
                            return [2 /*return*/, this.cacheGetOrSet(cacheKey, 60, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var _a, total, data;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, this.prisma.$transaction([
                                                    this.prisma.user.count({ where: where }),
                                                    this.prisma.user.findMany({
                                                        where: where,
                                                        select: __assign(__assign({}, this.selectSafe), { memberships: {
                                                                select: {
                                                                    id: true,
                                                                    role: true,
                                                                    organization: { select: { id: true, name: true } },
                                                                },
                                                            } }),
                                                        orderBy: orderBy,
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
        return UsersService_1;
    }());
    __setFunctionName(_classThis, "UsersService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        UsersService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return UsersService = _classThis;
}();
exports.UsersService = UsersService;
