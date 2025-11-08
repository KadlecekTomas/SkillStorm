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
exports.AuthService = void 0;
// src/auth/auth.service.ts
var common_1 = require("@nestjs/common");
var bcrypt = require("bcrypt");
var client_1 = require("@prisma/client");
var crypto_1 = require("crypto");
var date_fns_1 = require("date-fns");
var library_1 = require("@prisma/client/runtime/library");
var AuthService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AuthService = _classThis = /** @class */ (function () {
        function AuthService_1(prisma, jwtService, config) {
            this.prisma = prisma;
            this.jwtService = jwtService;
            this.config = config;
        }
        // -------------------------
        // Helpers
        // -------------------------
        AuthService_1.prototype.normalize = function (s) {
            return s
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
        };
        AuthService_1.prototype.ensureUniqueUsername = function (baseInput) {
            return __awaiter(this, void 0, void 0, function () {
                var base, candidate, i, exists;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            base = (this.normalize(baseInput) || 'user')
                                .replace(/[^a-z0-9]+/g, '')
                                .slice(0, 16) || 'user';
                            candidate = base;
                            i = 1;
                            _a.label = 1;
                        case 1:
                            if (!true) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.user.findUnique({
                                    where: { username: candidate },
                                    select: { id: true },
                                })];
                        case 2:
                            exists = _a.sent();
                            if (!exists)
                                return [2 /*return*/, candidate];
                            candidate = "".concat(base).concat(i++);
                            return [3 /*break*/, 1];
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        AuthService_1.prototype.buildClaims = function (user, membership) {
            var _a, _b, _c, _d, _e;
            return {
                sub: user.id,
                email: (_a = user.email) !== null && _a !== void 0 ? _a : null,
                username: (_b = user.username) !== null && _b !== void 0 ? _b : null,
                systemRole: (_c = user.systemRole) !== null && _c !== void 0 ? _c : null,
                organizationRole: (_d = membership === null || membership === void 0 ? void 0 : membership.role) !== null && _d !== void 0 ? _d : null,
                organizationId: (_e = membership === null || membership === void 0 ? void 0 : membership.organizationId) !== null && _e !== void 0 ? _e : null,
            };
        };
        // ---------- Refresh token (opaque + retry na P2002) ----------
        AuthService_1.prototype.issueRefreshToken = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                var attempt, token, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            attempt = 0;
                            _a.label = 1;
                        case 1:
                            if (!(attempt < 3)) return [3 /*break*/, 6];
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 4, , 5]);
                            token = (0, crypto_1.randomBytes)(48).toString('hex');
                            return [4 /*yield*/, this.prisma.refreshToken.create({
                                    data: {
                                        token: token,
                                        userId: userId,
                                        expiresAt: (0, date_fns_1.addDays)(new Date(), 7),
                                    },
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, token];
                        case 4:
                            e_1 = _a.sent();
                            if (e_1 instanceof library_1.PrismaClientKnownRequestError && e_1.code === 'P2002') {
                                // unikátní kolize tokenu – zkusíme znova
                                return [3 /*break*/, 5];
                            }
                            throw e_1;
                        case 5:
                            attempt++;
                            return [3 /*break*/, 1];
                        case 6: throw new Error('Failed to issue refresh token after retries');
                    }
                });
            });
        };
        AuthService_1.prototype.generateTokens = function (user, membership) {
            return __awaiter(this, void 0, void 0, function () {
                var claims, accessSecret, accessToken, refreshToken;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            claims = this.buildClaims(user, membership);
                            accessSecret = this.config.get('JWT_SECRET');
                            accessToken = this.jwtService.sign(__assign({}, claims), {
                                secret: accessSecret,
                                expiresIn: '15m',
                                jwtid: (0, crypto_1.randomUUID)(), // unikátní JTI → lepší revokace
                            });
                            return [4 /*yield*/, this.issueRefreshToken(user.id)];
                        case 1:
                            refreshToken = _a.sent();
                            return [2 /*return*/, { accessToken: accessToken, refreshToken: refreshToken }];
                    }
                });
            });
        };
        // -------------------------
        // Public API
        // -------------------------
        AuthService_1.prototype.register = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var existing, passwordHash, baseUname, now, attempt, username, user, tokens, e_2, target;
                var _a, _b, _c, _d, _e, _f, _g;
                return __generator(this, function (_h) {
                    switch (_h.label) {
                        case 0:
                            if (!dto.email) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.prisma.user.findUnique({
                                    where: { email: dto.email },
                                })];
                        case 1:
                            existing = _h.sent();
                            if (existing) {
                                // dřív: throw new BadRequestException('Email already exists');
                                throw new common_1.ConflictException('Email already exists'); // ← změna na 409
                            }
                            _h.label = 2;
                        case 2: return [4 /*yield*/, bcrypt.hash(dto.password, 10)];
                        case 3:
                            passwordHash = _h.sent();
                            baseUname = (_d = (_c = (_a = dto.username) !== null && _a !== void 0 ? _a : (_b = dto.email) === null || _b === void 0 ? void 0 : _b.split('@')[0]) !== null && _c !== void 0 ? _c : dto.name) !== null && _d !== void 0 ? _d : 'user';
                            now = new Date();
                            attempt = 0;
                            _h.label = 4;
                        case 4:
                            if (!(attempt < 2)) return [3 /*break*/, 11];
                            return [4 /*yield*/, this.ensureUniqueUsername(attempt === 0
                                    ? baseUname
                                    : "".concat(baseUname).concat(Math.floor(Math.random() * 1000)))];
                        case 5:
                            username = _h.sent();
                            _h.label = 6;
                        case 6:
                            _h.trys.push([6, 9, , 10]);
                            return [4 /*yield*/, this.prisma.user.create({
                                    data: {
                                        email: (_e = dto.email) !== null && _e !== void 0 ? _e : null,
                                        username: username,
                                        name: dto.name,
                                        passwordHash: passwordHash,
                                        systemRole: (_f = dto.systemRole) !== null && _f !== void 0 ? _f : null,
                                        lastLoginAt: now,
                                    },
                                })];
                        case 7:
                            user = _h.sent();
                            return [4 /*yield*/, this.generateTokens(user, null)];
                        case 8:
                            tokens = _h.sent();
                            return [2 /*return*/, __assign(__assign({}, tokens), { user: {
                                        id: user.id,
                                        email: user.email,
                                        username: user.username,
                                        name: user.name,
                                        systemRole: user.systemRole,
                                        organizationRole: null,
                                        organizationId: null,
                                        lastLoginAt: user.lastLoginAt,
                                    } })];
                        case 9:
                            e_2 = _h.sent();
                            // Prisma unique clash (username/email)
                            if (e_2 instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                                e_2.code === 'P2002') {
                                target = (_g = e_2.meta) === null || _g === void 0 ? void 0 : _g.target;
                                if (target === null || target === void 0 ? void 0 : target.includes('email')) {
                                    throw new common_1.ConflictException('Email already exists');
                                }
                                // pokud username, zkusíme ještě jednou s jiným suffixem; jinak po 2 pokusech 409
                                return [3 /*break*/, 10];
                            }
                            throw e_2;
                        case 10:
                            attempt++;
                            return [3 /*break*/, 4];
                        case 11: 
                        // po 2 pokusech stále kolize username → 409
                        throw new common_1.ConflictException('Username already exists');
                    }
                });
            });
        };
        AuthService_1.prototype.login = function (dto) {
            return __awaiter(this, void 0, void 0, function () {
                var user, isPasswordValid, updatedUser, membership, tokens;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.findFirst({
                                where: {
                                    OR: [{ username: dto.login }, { email: dto.login }],
                                },
                            })];
                        case 1:
                            user = _c.sent();
                            if (!user)
                                throw new common_1.UnauthorizedException('Invalid credentials');
                            return [4 /*yield*/, bcrypt.compare(dto.password, user.passwordHash)];
                        case 2:
                            isPasswordValid = _c.sent();
                            if (!isPasswordValid)
                                throw new common_1.UnauthorizedException('Invalid credentials');
                            return [4 /*yield*/, this.prisma.user.update({
                                    where: { id: user.id },
                                    data: { lastLoginAt: new Date() },
                                })];
                        case 3:
                            updatedUser = _c.sent();
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: { userId: user.id },
                                    orderBy: { createdAt: 'asc' }, // deterministicky, pokud má víc členství
                                })];
                        case 4:
                            membership = _c.sent();
                            return [4 /*yield*/, this.generateTokens(updatedUser, membership)];
                        case 5:
                            tokens = _c.sent();
                            return [2 /*return*/, __assign(__assign({}, tokens), { user: {
                                        id: updatedUser.id,
                                        email: updatedUser.email,
                                        username: updatedUser.username,
                                        name: updatedUser.name,
                                        systemRole: updatedUser.systemRole,
                                        organizationRole: (_a = membership === null || membership === void 0 ? void 0 : membership.role) !== null && _a !== void 0 ? _a : null,
                                        organizationId: (_b = membership === null || membership === void 0 ? void 0 : membership.organizationId) !== null && _b !== void 0 ? _b : null,
                                        lastLoginAt: updatedUser.lastLoginAt, // ← propsáno ven
                                    } })];
                    }
                });
            });
        };
        AuthService_1.prototype.refreshAccessToken = function (oldRefreshToken) {
            return __awaiter(this, void 0, void 0, function () {
                var row, user, membership, claims, accessToken, refreshToken;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.refreshToken.findUnique({
                                where: { token: oldRefreshToken },
                            })];
                        case 1:
                            row = _a.sent();
                            if (!(!row || row.expiresAt < new Date())) return [3 /*break*/, 4];
                            if (!row) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.refreshToken.delete({
                                    where: { token: oldRefreshToken },
                                })];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3: throw new common_1.UnauthorizedException('Invalid or expired refresh token');
                        case 4: 
                        // 2) rotate – smaž starý refresh token
                        return [4 /*yield*/, this.prisma.refreshToken.delete({
                                where: { token: oldRefreshToken },
                            })];
                        case 5:
                            // 2) rotate – smaž starý refresh token
                            _a.sent();
                            return [4 /*yield*/, this.prisma.user.findUnique({
                                    where: { id: row.userId },
                                })];
                        case 6:
                            user = _a.sent();
                            if (!user)
                                throw new common_1.UnauthorizedException('User not found');
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: { userId: user.id },
                                    orderBy: { createdAt: 'asc' },
                                })];
                        case 7:
                            membership = _a.sent();
                            claims = this.buildClaims(user, membership);
                            accessToken = this.jwtService.sign(__assign({}, claims), {
                                secret: this.config.get('JWT_SECRET'),
                                expiresIn: '15m',
                                jwtid: (0, crypto_1.randomUUID)(),
                            });
                            return [4 /*yield*/, this.issueRefreshToken(user.id)];
                        case 8:
                            refreshToken = _a.sent();
                            return [2 /*return*/, { accessToken: accessToken, refreshToken: refreshToken }];
                    }
                });
            });
        };
        AuthService_1.prototype.logout = function (accessToken, refreshToken) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!accessToken) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.prisma.revokedToken.create({ data: { token: accessToken } })];
                        case 1:
                            _a.sent();
                            _a.label = 2;
                        case 2:
                            if (!refreshToken) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.refreshToken.deleteMany({
                                    where: { token: refreshToken },
                                })];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4: return [2 /*return*/, { message: 'Logged out successfully' }];
                    }
                });
            });
        };
        AuthService_1.prototype.getUserProfile = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.user.findUnique({
                            where: { id: userId },
                            select: {
                                id: true,
                                email: true,
                                username: true,
                                name: true,
                                systemRole: true,
                                createdAt: true,
                                lastLoginAt: true,
                            },
                        })];
                });
            });
        };
        return AuthService_1;
    }());
    __setFunctionName(_classThis, "AuthService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AuthService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AuthService = _classThis;
}();
exports.AuthService = AuthService;
