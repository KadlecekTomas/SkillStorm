"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.JwtStrategy = void 0;
var common_1 = require("@nestjs/common");
var passport_1 = require("@nestjs/passport");
var passport_jwt_1 = require("passport-jwt");
var JwtStrategy = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _classSuper = (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy);
    var JwtStrategy = _classThis = /** @class */ (function (_super) {
        __extends(JwtStrategy_1, _super);
        function JwtStrategy_1(prisma, configService) {
            var _this = _super.call(this, {
                jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
                secretOrKey: configService.get('JWT_SECRET'),
                ignoreExpiration: false,
                passReqToCallback: true,
            }) || this;
            _this.prisma = prisma;
            _this.configService = configService;
            return _this;
        }
        JwtStrategy_1.prototype.validate = function (req, payload) {
            return __awaiter(this, void 0, void 0, function () {
                var token, revoked, user, requestedOrgId, organizationRole, organizationId, m;
                var _a, _b, _c, _d, _e, _f, _g, _h;
                return __generator(this, function (_j) {
                    switch (_j.label) {
                        case 0:
                            token = passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken()(req);
                            return [4 /*yield*/, this.prisma.revokedToken.findUnique({
                                    where: { token: token },
                                })];
                        case 1:
                            revoked = _j.sent();
                            if (revoked)
                                throw new common_1.UnauthorizedException('Token has been revoked');
                            return [4 /*yield*/, this.prisma.user.findUnique({
                                    where: { id: payload.sub },
                                    select: {
                                        id: true,
                                        email: true,
                                        username: true,
                                        name: true,
                                        systemRole: true,
                                        memberships: {
                                            where: { deletedAt: null },
                                            select: { organizationId: true, role: true },
                                        },
                                    },
                                })];
                        case 2:
                            user = _j.sent();
                            if (!user)
                                throw new common_1.UnauthorizedException('User not found');
                            requestedOrgId = (_d = (_b = (_a = req.query) === null || _a === void 0 ? void 0 : _a.organizationId) !== null && _b !== void 0 ? _b : (_c = req.body) === null || _c === void 0 ? void 0 : _c.organizationId) !== null && _d !== void 0 ? _d : null;
                            organizationRole = (_e = payload.organizationRole) !== null && _e !== void 0 ? _e : null;
                            organizationId = (_f = payload.organizationId) !== null && _f !== void 0 ? _f : null;
                            if (requestedOrgId) {
                                m = (_g = user.memberships) === null || _g === void 0 ? void 0 : _g.find(function (x) { return x.organizationId === requestedOrgId; });
                                if (m) {
                                    organizationRole = m.role;
                                    organizationId = m.organizationId;
                                }
                            }
                            if (!organizationRole && ((_h = user.memberships) === null || _h === void 0 ? void 0 : _h.length)) {
                                organizationRole = user.memberships[0].role;
                                organizationId = user.memberships[0].organizationId;
                            }
                            return [2 /*return*/, {
                                    userId: user.id,
                                    email: user.email,
                                    username: user.username,
                                    name: user.name,
                                    systemRole: user.systemRole,
                                    organizationRole: organizationRole !== null && organizationRole !== void 0 ? organizationRole : null,
                                    organizationId: organizationId !== null && organizationId !== void 0 ? organizationId : null,
                                }];
                    }
                });
            });
        };
        return JwtStrategy_1;
    }(_classSuper));
    __setFunctionName(_classThis, "JwtStrategy");
    (function () {
        var _a;
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_a = _classSuper[Symbol.metadata]) !== null && _a !== void 0 ? _a : null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        JwtStrategy = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return JwtStrategy = _classThis;
}();
exports.JwtStrategy = JwtStrategy;
