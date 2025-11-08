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
exports.RbacService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var CACHE_TTL_MS = 60000;
var RbacService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var RbacService = _classThis = /** @class */ (function () {
        function RbacService_1(prisma) {
            this.prisma = prisma;
            this.cache = new Map();
        }
        RbacService_1.prototype.canUser = function (userId, organizationId, permissionKey) {
            return __awaiter(this, void 0, void 0, function () {
                var cacheKey, cached, user, orgFilter, userPermission, membership, rolePermission, allowed;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            cacheKey = this.buildCacheKey(userId, organizationId, permissionKey);
                            cached = this.getFromCache(cacheKey);
                            if (cached !== undefined) {
                                return [2 /*return*/, cached];
                            }
                            return [4 /*yield*/, this.prisma.user.findUnique({
                                    where: { id: userId },
                                    select: { systemRole: true },
                                })];
                        case 1:
                            user = _a.sent();
                            if (!user) {
                                this.setCache(cacheKey, false);
                                return [2 /*return*/, false];
                            }
                            if (user.systemRole === client_1.SystemRole.SUPERADMIN ||
                                user.systemRole === client_1.SystemRole.DEVOPS) {
                                this.setCache(cacheKey, true);
                                return [2 /*return*/, true];
                            }
                            orgFilter = organizationId !== null && organizationId !== void 0 ? organizationId : undefined;
                            return [4 /*yield*/, this.prisma.userPermission.findFirst({
                                    where: {
                                        userId: userId,
                                        organizationId: orgFilter,
                                        permission: { key: permissionKey },
                                        allowed: true,
                                    },
                                })];
                        case 2:
                            userPermission = _a.sent();
                            if (userPermission) {
                                this.setCache(cacheKey, true);
                                return [2 /*return*/, true];
                            }
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: __assign({ userId: userId }, (organizationId ? { organizationId: organizationId } : {})),
                                    select: { role: true, organizationId: true },
                                })];
                        case 3:
                            membership = _a.sent();
                            if (!membership) {
                                this.setCache(cacheKey, false);
                                return [2 /*return*/, false];
                            }
                            return [4 /*yield*/, this.prisma.rolePermission.findFirst({
                                    where: {
                                        role: membership.role,
                                        permission: { key: permissionKey },
                                        OR: [
                                            { organizationId: membership.organizationId },
                                            { organizationId: null },
                                        ],
                                        allowed: true,
                                    },
                                })];
                        case 4:
                            rolePermission = _a.sent();
                            allowed = !!rolePermission;
                            this.setCache(cacheKey, allowed);
                            return [2 /*return*/, allowed];
                    }
                });
            });
        };
        RbacService_1.prototype.canUserMultiple = function (userId, organizationId, keys) {
            return __awaiter(this, void 0, void 0, function () {
                var entries;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, Promise.all(keys.map(function (key) { return __awaiter(_this, void 0, void 0, function () {
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _a = {
                                                key: key
                                            };
                                            return [4 /*yield*/, this.canUser(userId, organizationId, key)];
                                        case 1: return [2 /*return*/, (_a.allowed = _b.sent(),
                                                _a)];
                                    }
                                });
                            }); }))];
                        case 1:
                            entries = _a.sent();
                            return [2 /*return*/, entries.reduce(function (acc, entry) {
                                    acc[entry.key] = entry.allowed;
                                    return acc;
                                }, {})];
                    }
                });
            });
        };
        RbacService_1.prototype.buildCacheKey = function (userId, orgId, key) {
            return "".concat(userId, ":").concat(orgId !== null && orgId !== void 0 ? orgId : 'global', ":").concat(key);
        };
        RbacService_1.prototype.getFromCache = function (cacheKey) {
            var entry = this.cache.get(cacheKey);
            if (!entry)
                return undefined;
            if (entry.expires < Date.now()) {
                this.cache.delete(cacheKey);
                return undefined;
            }
            return entry.value;
        };
        RbacService_1.prototype.setCache = function (cacheKey, value) {
            this.cache.set(cacheKey, {
                value: value,
                expires: Date.now() + CACHE_TTL_MS,
            });
        };
        return RbacService_1;
    }());
    __setFunctionName(_classThis, "RbacService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        RbacService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return RbacService = _classThis;
}();
exports.RbacService = RbacService;
