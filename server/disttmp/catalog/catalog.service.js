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
exports.CatalogService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var access_utils_1 = require("src/shared/access.utils");
var org_cache_utils_1 = require("../shared/cache/org-cache.utils");
var CatalogService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var CatalogService = _classThis = /** @class */ (function () {
        function CatalogService_1(prisma, cache) {
            this.prisma = prisma;
            this.cache = cache;
            // ---------------- GLOBAL CACHE (catalog READ) ----------------
            this.globalVersionKey = 'global_catalog_version';
        }
        CatalogService_1.prototype.getGlobalVersion = function () {
            return __awaiter(this, void 0, void 0, function () {
                var v;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.cache.get(this.globalVersionKey)];
                        case 1:
                            v = _a.sent();
                            return [2 /*return*/, typeof v === 'number' ? v : 1];
                    }
                });
            });
        };
        CatalogService_1.prototype.bumpGlobalVersion = function () {
            return __awaiter(this, void 0, void 0, function () {
                var v;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getGlobalVersion()];
                        case 1:
                            v = _a.sent();
                            return [4 /*yield*/, this.cache.set(this.globalVersionKey, v + 1, 0)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        CatalogService_1.prototype.cacheGetOrSet = function (key, ttlMs, factory) {
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
                            return [4 /*yield*/, this.cache.set(key, fresh, ttlMs)];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, fresh];
                    }
                });
            });
        };
        // ---------------- AUDIT ----------------
        CatalogService_1.prototype.audit = function (opts) {
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
        // ---------------- READ (catalog) ----------------
        CatalogService_1.prototype.listSubjects = function (q) {
            return __awaiter(this, void 0, void 0, function () {
                var page, limit, skip, term, ver, cacheKey;
                var _this = this;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            page = (_a = q.page) !== null && _a !== void 0 ? _a : 1;
                            limit = (_b = q.limit) !== null && _b !== void 0 ? _b : 20;
                            skip = (page - 1) * limit;
                            term = ((_c = q.search) !== null && _c !== void 0 ? _c : '').trim();
                            return [4 /*yield*/, this.getGlobalVersion()];
                        case 1:
                            ver = _d.sent();
                            cacheKey = "catalog:subjects:v".concat(ver, ":p").concat(page, ":l").concat(limit, ":s=").concat(term);
                            return [2 /*return*/, this.cacheGetOrSet(cacheKey, 300000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var _a, total, data, rows, ids, totalRows, total, data, _b, _c, where, _d, total, data;
                                    var _e, _f;
                                    return __generator(this, function (_g) {
                                        switch (_g.label) {
                                            case 0:
                                                if (!!term) return [3 /*break*/, 2];
                                                return [4 /*yield*/, this.prisma.$transaction([
                                                        this.prisma.catalogSubject.count(),
                                                        this.prisma.catalogSubject.findMany({
                                                            select: { id: true, code: true, name: true },
                                                            orderBy: [{ name: 'asc' }],
                                                            skip: skip,
                                                            take: limit,
                                                        }),
                                                    ])];
                                            case 1:
                                                _a = _g.sent(), total = _a[0], data = _a[1];
                                                return [2 /*return*/, {
                                                        data: data,
                                                        meta: {
                                                            page: page,
                                                            limit: limit,
                                                            total: total,
                                                            pages: Math.max(1, Math.ceil(total / limit)),
                                                        },
                                                    }];
                                            case 2:
                                                _g.trys.push([2, 8, , 10]);
                                                return [4 /*yield*/, this.prisma.$queryRawUnsafe("\n        SELECT cs.id\n        FROM catalog_subjects cs\n        WHERE unaccent(lower(cs.name)) LIKE '%' || unaccent(lower($1)) || '%'\n           OR unaccent(lower(cs.code)) LIKE '%' || unaccent(lower($1)) || '%'\n        ORDER BY cs.name ASC, cs.id ASC\n        OFFSET $2 LIMIT $3\n        ", term, skip, limit)];
                                            case 3:
                                                rows = _g.sent();
                                                ids = rows.map(function (r) { return r.id; });
                                                return [4 /*yield*/, this.prisma.$queryRawUnsafe("\n        SELECT COUNT(*)::text as count\n        FROM catalog_subjects cs\n        WHERE unaccent(lower(cs.name)) LIKE '%' || unaccent(lower($1)) || '%'\n           OR unaccent(lower(cs.code)) LIKE '%' || unaccent(lower($1)) || '%'\n        ", term)];
                                            case 4:
                                                totalRows = _g.sent();
                                                total = parseInt((_f = (_e = totalRows[0]) === null || _e === void 0 ? void 0 : _e.count) !== null && _f !== void 0 ? _f : '0', 10);
                                                if (!ids.length) return [3 /*break*/, 6];
                                                return [4 /*yield*/, this.prisma.catalogSubject.findMany({
                                                        where: { id: { in: ids } },
                                                        select: { id: true, code: true, name: true },
                                                        orderBy: [{ name: 'asc' }, { id: 'asc' }],
                                                    })];
                                            case 5:
                                                _b = _g.sent();
                                                return [3 /*break*/, 7];
                                            case 6:
                                                _b = [];
                                                _g.label = 7;
                                            case 7:
                                                data = _b;
                                                return [2 /*return*/, {
                                                        data: data,
                                                        meta: {
                                                            page: page,
                                                            limit: limit,
                                                            total: total,
                                                            pages: Math.max(1, Math.ceil(total / limit)),
                                                        },
                                                    }];
                                            case 8:
                                                _c = _g.sent();
                                                where = {
                                                    OR: [
                                                        { name: { contains: term, mode: 'insensitive' } },
                                                        { code: { contains: term, mode: 'insensitive' } },
                                                    ],
                                                };
                                                return [4 /*yield*/, this.prisma.$transaction([
                                                        this.prisma.catalogSubject.count({ where: where }),
                                                        this.prisma.catalogSubject.findMany({
                                                            where: where,
                                                            select: { id: true, code: true, name: true },
                                                            orderBy: [{ name: 'asc' }],
                                                            skip: skip,
                                                            take: limit,
                                                        }),
                                                    ])];
                                            case 9:
                                                _d = _g.sent(), total = _d[0], data = _d[1];
                                                return [2 /*return*/, {
                                                        data: data,
                                                        meta: {
                                                            page: page,
                                                            limit: limit,
                                                            total: total,
                                                            pages: Math.max(1, Math.ceil(total / limit)),
                                                        },
                                                    }];
                                            case 10: return [2 /*return*/];
                                        }
                                    });
                                }); })];
                    }
                });
            });
        };
        CatalogService_1.prototype.getSubject = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var ver, cacheKey;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getGlobalVersion()];
                        case 1:
                            ver = _a.sent();
                            cacheKey = "catalog:subject:".concat(id, ":v").concat(ver);
                            return [2 /*return*/, this.cacheGetOrSet(cacheKey, 300000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var subj;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, this.prisma.catalogSubject.findUnique({
                                                    where: { id: id },
                                                    select: { id: true, code: true, name: true },
                                                })];
                                            case 1:
                                                subj = _a.sent();
                                                if (!subj)
                                                    throw new common_1.NotFoundException('CatalogSubject nenalezen.');
                                                return [2 /*return*/, subj];
                                        }
                                    });
                                }); })];
                    }
                });
            });
        };
        CatalogService_1.prototype.listTopicsByCatalogSubject = function (id, q) {
            return __awaiter(this, void 0, void 0, function () {
                var exists, page, limit, skip, where, ver, cacheKey;
                var _this = this;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0: return [4 /*yield*/, this.prisma.catalogSubject.findUnique({
                                where: { id: id },
                                select: { id: true },
                            })];
                        case 1:
                            exists = _e.sent();
                            if (!exists)
                                throw new common_1.NotFoundException('CatalogSubject nenalezen.');
                            page = (_a = q.page) !== null && _a !== void 0 ? _a : 1;
                            limit = (_b = q.limit) !== null && _b !== void 0 ? _b : 50;
                            skip = (page - 1) * limit;
                            where = __assign({ subjectId: id }, (((_c = q.search) === null || _c === void 0 ? void 0 : _c.trim())
                                ? { name: { contains: q.search.trim(), mode: 'insensitive' } }
                                : {}));
                            return [4 /*yield*/, this.getGlobalVersion()];
                        case 2:
                            ver = _e.sent();
                            cacheKey = "catalog:topics:subject:".concat(id, ":v").concat(ver, ":p").concat(page, ":l").concat(limit, ":s=").concat((_d = q.search) !== null && _d !== void 0 ? _d : '');
                            return [2 /*return*/, this.cacheGetOrSet(cacheKey, 300000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var _a, total, data;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, this.prisma.$transaction([
                                                    this.prisma.catalogTopic.count({ where: where }),
                                                    this.prisma.catalogTopic.findMany({
                                                        where: where,
                                                        select: { id: true, name: true },
                                                        orderBy: [{ name: 'asc' }],
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
        CatalogService_1.prototype.getTopic = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var ver, cacheKey;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getGlobalVersion()];
                        case 1:
                            ver = _a.sent();
                            cacheKey = "catalog:topic:".concat(id, ":v").concat(ver);
                            return [2 /*return*/, this.cacheGetOrSet(cacheKey, 300000, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var topic;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, this.prisma.catalogTopic.findUnique({
                                                    where: { id: id },
                                                    select: {
                                                        id: true,
                                                        name: true,
                                                        subjectId: true,
                                                        subject: { select: { id: true, code: true, name: true } },
                                                    },
                                                })];
                                            case 1:
                                                topic = _a.sent();
                                                if (!topic)
                                                    throw new common_1.NotFoundException('CatalogTopic nenalezen.');
                                                return [2 /*return*/, topic];
                                        }
                                    });
                                }); })];
                    }
                });
            });
        };
        // ---------------- CRUD (SUPERADMIN) ----------------
        CatalogService_1.prototype.createCatalogSubject = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var created, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            return [4 /*yield*/, this.prisma.catalogSubject.create({
                                    data: { code: dto.code.trim(), name: dto.name.trim() },
                                    select: { id: true, code: true, name: true },
                                })];
                        case 1:
                            created = _a.sent();
                            return [4 /*yield*/, this.bumpGlobalVersion()];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, created];
                        case 3:
                            e_1 = _a.sent();
                            if (e_1.code === 'P2002') {
                                throw new common_1.ConflictException('Subject s tímto kódem už existuje.');
                            }
                            throw e_1;
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        CatalogService_1.prototype.updateCatalogSubject = function (id, dto) {
            return __awaiter(this, void 0, void 0, function () {
                var existing, updated;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, this.prisma.catalogSubject.findUnique({
                                where: { id: id },
                                select: { id: true },
                            })];
                        case 1:
                            existing = _c.sent();
                            if (!existing)
                                throw new common_1.NotFoundException('CatalogSubject nenalezen.');
                            return [4 /*yield*/, this.prisma.catalogSubject.update({
                                    where: { id: id },
                                    data: {
                                        code: (_a = dto.code) === null || _a === void 0 ? void 0 : _a.trim(),
                                        name: (_b = dto.name) === null || _b === void 0 ? void 0 : _b.trim(),
                                    },
                                    select: { id: true, code: true, name: true },
                                })];
                        case 2:
                            updated = _c.sent();
                            return [4 /*yield*/, this.bumpGlobalVersion()];
                        case 3:
                            _c.sent();
                            return [2 /*return*/, updated];
                    }
                });
            });
        };
        CatalogService_1.prototype.deleteCatalogSubject = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var existing;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.catalogSubject.findUnique({
                                where: { id: id },
                                select: { id: true },
                            })];
                        case 1:
                            existing = _a.sent();
                            if (!existing)
                                throw new common_1.NotFoundException('CatalogSubject nenalezen.');
                            return [4 /*yield*/, this.prisma.catalogSubject.delete({ where: { id: id } })];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.bumpGlobalVersion()];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, { ok: true }];
                    }
                });
            });
        };
        CatalogService_1.prototype.createCatalogTopic = function (subjectId, dto) {
            return __awaiter(this, void 0, void 0, function () {
                var subj, created, e_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            // preferuj subjectId z path; DTO subjectId ber jen jako guard
                            if (dto.subjectId && dto.subjectId !== subjectId) {
                                throw new common_1.ForbiddenException('subjectId v těle se liší od path parametru.');
                            }
                            return [4 /*yield*/, this.prisma.catalogSubject.findUnique({
                                    where: { id: subjectId },
                                    select: { id: true },
                                })];
                        case 1:
                            subj = _a.sent();
                            if (!subj)
                                throw new common_1.NotFoundException('CatalogSubject neexistuje.');
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 5, , 6]);
                            return [4 /*yield*/, this.prisma.catalogTopic.create({
                                    data: { subjectId: subjectId, name: dto.name.trim() },
                                    select: { id: true, subjectId: true, name: true },
                                })];
                        case 3:
                            created = _a.sent();
                            return [4 /*yield*/, this.bumpGlobalVersion()];
                        case 4:
                            _a.sent();
                            return [2 /*return*/, created];
                        case 5:
                            e_2 = _a.sent();
                            if (e_2.code === 'P2002') {
                                throw new common_1.ConflictException('Pro tento katalogový předmět už téma s tímto názvem existuje.');
                            }
                            throw e_2;
                        case 6: return [2 /*return*/];
                    }
                });
            });
        };
        CatalogService_1.prototype.updateCatalogTopic = function (id, dto) {
            return __awaiter(this, void 0, void 0, function () {
                var existing, updated, e_3;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, this.prisma.catalogTopic.findUnique({
                                where: { id: id },
                                select: { id: true, subjectId: true },
                            })];
                        case 1:
                            existing = _c.sent();
                            if (!existing)
                                throw new common_1.NotFoundException('CatalogTopic nenalezen.');
                            _c.label = 2;
                        case 2:
                            _c.trys.push([2, 5, , 6]);
                            return [4 /*yield*/, this.prisma.catalogTopic.update({
                                    where: { id: id },
                                    data: {
                                        subjectId: (_a = dto.subjectId) !== null && _a !== void 0 ? _a : undefined,
                                        name: (_b = dto.name) === null || _b === void 0 ? void 0 : _b.trim(),
                                    },
                                    select: { id: true, subjectId: true, name: true },
                                })];
                        case 3:
                            updated = _c.sent();
                            return [4 /*yield*/, this.bumpGlobalVersion()];
                        case 4:
                            _c.sent();
                            return [2 /*return*/, updated];
                        case 5:
                            e_3 = _c.sent();
                            if (e_3.code === 'P2002') {
                                // uniq constraint [subjectId, name]
                                throw new common_1.ConflictException('Pro cílový katalogový předmět už téma s tímto názvem existuje.');
                            }
                            throw e_3;
                        case 6: return [2 /*return*/];
                    }
                });
            });
        };
        CatalogService_1.prototype.deleteCatalogTopic = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var existing;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.catalogTopic.findUnique({
                                where: { id: id },
                                select: { id: true },
                            })];
                        case 1:
                            existing = _a.sent();
                            if (!existing)
                                throw new common_1.NotFoundException('CatalogTopic nenalezen.');
                            return [4 /*yield*/, this.prisma.catalogTopic.delete({ where: { id: id } })];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.bumpGlobalVersion()];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, { ok: true }];
                    }
                });
            });
        };
        // ---------------- MATERIALIZE ----------------
        CatalogService_1.prototype.materializeSubject = function (catalogSubjectId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var cat, name, created, distinct, scope;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            // DIRECTOR/TEACHER: pouze v rámci své organizace
                            if (user.systemRole !== client_1.SystemRole.SUPERADMIN) {
                                (0, access_utils_1.assertSameOrganization)(dto.organizationId, user, 'organizace');
                            }
                            return [4 /*yield*/, this.prisma.catalogSubject.findUnique({
                                    where: { id: catalogSubjectId },
                                    select: { id: true, name: true },
                                })];
                        case 1:
                            cat = _c.sent();
                            if (!cat)
                                throw new common_1.NotFoundException('CatalogSubject nenalezen.');
                            name = ((_a = dto.nameOverride) !== null && _a !== void 0 ? _a : cat.name).trim();
                            return [4 /*yield*/, this.prisma.subject
                                    .create({
                                    data: {
                                        organizationId: dto.organizationId,
                                        catalogSubjectId: cat.id,
                                        name: name,
                                    },
                                    select: {
                                        id: true,
                                        organizationId: true,
                                        catalogSubjectId: true,
                                        name: true,
                                    },
                                })
                                    .catch(function (e) {
                                    if (e.code === 'P2002') {
                                        throw new common_1.ConflictException('Tento katalogový předmět už je v organizaci přidán.');
                                    }
                                    throw e;
                                })];
                        case 2:
                            created = _c.sent();
                            if (!(Array.isArray(dto.createLevelsForGrades) &&
                                dto.createLevelsForGrades.length > 0)) return [3 /*break*/, 4];
                            distinct = Array.from(new Set(dto.createLevelsForGrades));
                            return [4 /*yield*/, this.prisma.subjectLevel.createMany({
                                    data: distinct.map(function (grade) { return ({ subjectId: created.id, grade: grade }); }),
                                    skipDuplicates: true,
                                })];
                        case 3:
                            _c.sent();
                            _c.label = 4;
                        case 4: return [4 /*yield*/, this.audit({
                                userId: user.userId,
                                orgId: dto.organizationId,
                                action: 'CATALOG_SUBJECT_MATERIALIZE',
                                entityId: created.id,
                                metadata: {
                                    catalogSubjectId: catalogSubjectId,
                                    createLevelsForGrades: (_b = dto.createLevelsForGrades) !== null && _b !== void 0 ? _b : [],
                                },
                            })];
                        case 5:
                            _c.sent();
                            scope = (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, dto.organizationId);
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, scope)];
                        case 6:
                            _c.sent();
                            return [2 /*return*/, created];
                    }
                });
            });
        };
        CatalogService_1.prototype.materializeTopic = function (catalogTopicId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var sl, orgId, ct, phase, difficulty, created, scope;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, this.prisma.subjectLevel.findUnique({
                                where: { id: dto.subjectLevelId },
                                select: { subject: { select: { organizationId: true, id: true } } },
                            })];
                        case 1:
                            sl = _d.sent();
                            if (!sl)
                                throw new common_1.NotFoundException('SubjectLevel nenalezen.');
                            orgId = sl.subject.organizationId;
                            if (user.systemRole !== client_1.SystemRole.SUPERADMIN) {
                                (0, access_utils_1.assertSameOrganization)(orgId, user, 'organizace');
                            }
                            return [4 /*yield*/, this.prisma.catalogTopic.findUnique({
                                    where: { id: catalogTopicId },
                                    select: { id: true },
                                })];
                        case 2:
                            ct = _d.sent();
                            if (!ct)
                                throw new common_1.NotFoundException('CatalogTopic nenalezen.');
                            phase = (_a = dto.phase) !== null && _a !== void 0 ? _a : client_1.TopicPhase.INTRO;
                            difficulty = (_b = dto.difficulty) !== null && _b !== void 0 ? _b : client_1.Difficulty.BASIC;
                            return [4 /*yield*/, this.prisma.topicLevel
                                    .create({
                                    data: {
                                        subjectLevelId: dto.subjectLevelId,
                                        catalogTopicId: catalogTopicId,
                                        name: null, // necháme prázdné -> z katalogu se čte pro zobrazení, nebo si může učitel přepsat v TopicsService.update
                                        phase: phase,
                                        difficulty: difficulty,
                                        order: (_c = dto.order) !== null && _c !== void 0 ? _c : null,
                                    },
                                    include: {
                                        catalogTopic: true,
                                        subjectLevel: { include: { subject: true } },
                                        LearningMaterial: true,
                                    },
                                })
                                    .catch(function (e) {
                                    if (e.code === 'P2002') {
                                        throw new common_1.ConflictException('Tento TopicLevel (phase) už existuje v daném SubjectLevel.');
                                    }
                                    throw e;
                                })];
                        case 3:
                            created = _d.sent();
                            return [4 /*yield*/, this.audit({
                                    userId: user.userId,
                                    orgId: orgId,
                                    action: 'CATALOG_TOPIC_MATERIALIZE',
                                    entityId: created.id,
                                    metadata: { catalogTopicId: catalogTopicId },
                                })];
                        case 4:
                            _d.sent();
                            scope = (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, orgId);
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, scope)];
                        case 5:
                            _d.sent();
                            return [2 /*return*/, created];
                    }
                });
            });
        };
        CatalogService_1.prototype.materializeTopicsBulk = function (catalogSubjectId, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var sl, orgId, topics, phase, difficulty, startOrder, last, createdIds, i, catalogTopicId, created, e_4, scope;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0: return [4 /*yield*/, this.prisma.subjectLevel.findUnique({
                                where: { id: dto.subjectLevelId },
                                select: { subject: { select: { organizationId: true, id: true } } },
                            })];
                        case 1:
                            sl = _e.sent();
                            if (!sl)
                                throw new common_1.NotFoundException('SubjectLevel nenalezen.');
                            orgId = sl.subject.organizationId;
                            if (user.systemRole !== client_1.SystemRole.SUPERADMIN) {
                                (0, access_utils_1.assertSameOrganization)(orgId, user, 'organizace');
                            }
                            return [4 /*yield*/, this.prisma.catalogTopic.findMany({
                                    where: { id: { in: dto.catalogTopicIds }, subjectId: catalogSubjectId },
                                    select: { id: true },
                                })];
                        case 2:
                            topics = _e.sent();
                            if (topics.length !== dto.catalogTopicIds.length) {
                                throw new common_1.NotFoundException('Některé CatalogTopic neexistují nebo nepatří do zadaného CatalogSubject.');
                            }
                            phase = (_a = dto.defaultPhase) !== null && _a !== void 0 ? _a : client_1.TopicPhase.INTRO;
                            difficulty = (_b = dto.defaultDifficulty) !== null && _b !== void 0 ? _b : client_1.Difficulty.BASIC;
                            startOrder = (_c = dto.appendAfter) !== null && _c !== void 0 ? _c : 0;
                            if (!(startOrder === 0)) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.topicLevel.findFirst({
                                    where: { subjectLevelId: dto.subjectLevelId },
                                    orderBy: { order: 'desc' },
                                    select: { order: true },
                                })];
                        case 3:
                            last = _e.sent();
                            startOrder = (_d = last === null || last === void 0 ? void 0 : last.order) !== null && _d !== void 0 ? _d : 0;
                            _e.label = 4;
                        case 4:
                            createdIds = [];
                            i = 0;
                            _e.label = 5;
                        case 5:
                            if (!(i < topics.length)) return [3 /*break*/, 10];
                            catalogTopicId = topics[i].id;
                            _e.label = 6;
                        case 6:
                            _e.trys.push([6, 8, , 9]);
                            return [4 /*yield*/, this.prisma.topicLevel.create({
                                    data: {
                                        subjectLevelId: dto.subjectLevelId,
                                        catalogTopicId: catalogTopicId,
                                        name: null,
                                        phase: phase,
                                        difficulty: difficulty,
                                        order: startOrder + i + 1,
                                    },
                                    select: { id: true },
                                })];
                        case 7:
                            created = _e.sent();
                            createdIds.push(created.id);
                            return [3 /*break*/, 9];
                        case 8:
                            e_4 = _e.sent();
                            if (e_4.code === 'P2002') {
                                // už existuje — přeskoč
                                return [3 /*break*/, 9];
                            }
                            throw e_4;
                        case 9:
                            i++;
                            return [3 /*break*/, 5];
                        case 10: return [4 /*yield*/, this.audit({
                                userId: user.userId,
                                orgId: orgId,
                                action: 'CATALOG_TOPICS_MATERIALIZE_BULK',
                                entityId: null,
                                metadata: {
                                    catalogSubjectId: catalogSubjectId,
                                    subjectLevelId: dto.subjectLevelId,
                                    createdCount: createdIds.length,
                                },
                            })];
                        case 11:
                            _e.sent();
                            scope = (0, org_cache_utils_1.cacheScopeForUser)(user.systemRole, orgId);
                            return [4 /*yield*/, (0, org_cache_utils_1.bumpOrgVersion)(this.cache, scope)];
                        case 12:
                            _e.sent();
                            return [2 /*return*/, { createdCount: createdIds.length, createdIds: createdIds }];
                    }
                });
            });
        };
        return CatalogService_1;
    }());
    __setFunctionName(_classThis, "CatalogService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CatalogService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CatalogService = _classThis;
}();
exports.CatalogService = CatalogService;
