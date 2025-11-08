"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
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
exports.OrganizationsController = void 0;
// src/modules/organizations/organizations.controller.ts
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var swagger_1 = require("@nestjs/swagger");
var school_access_guard_1 = require("../auth/guards/school-access.guard");
var cache_manager_1 = require("@nestjs/cache-manager");
var invalidate_decorator_1 = require("src/common/cache/invalidate.decorator");
var permission_decorator_1 = require("src/modules/rbac/permission.decorator");
var OrganizationsController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('organizations'), (0, swagger_1.ApiBearerAuth)(), (0, common_1.Controller)('organizations')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _create_decorators;
    var _findAll_decorators;
    var _findOne_decorators;
    var _update_decorators;
    var _remove_decorators;
    var OrganizationsController = _classThis = /** @class */ (function () {
        function OrganizationsController_1(service) {
            this.service = (__runInitializers(this, _instanceExtraInitializers), service);
        }
        OrganizationsController_1.prototype.create = function (dto, req) {
            return __awaiter(this, void 0, void 0, function () {
                var userId, isSuper, isDirectorSomewhere;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
                            isSuper = ((_b = req.user) === null || _b === void 0 ? void 0 : _b.systemRole) === client_1.SystemRole.SUPERADMIN;
                            if (!(dto.type === client_1.OrganizationType.SCHOOL && !isSuper)) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.service.userIsDirector(userId)];
                        case 1:
                            isDirectorSomewhere = _c.sent();
                            if (!isDirectorSomewhere) {
                                throw new common_1.ForbiddenException('Školu může vytvořit pouze superadmin nebo uživatel, který je již ředitelem v jiné organizaci.');
                            }
                            _c.label = 2;
                        case 2: return [2 /*return*/, this.service.create(dto, userId)];
                    }
                });
            });
        };
        OrganizationsController_1.prototype.findAll = function (q) {
            return this.service.findAll(q);
        };
        OrganizationsController_1.prototype.findOne = function (id) {
            return this.service.findOne(id);
        };
        OrganizationsController_1.prototype.update = function (id, dto, req) {
            var _a, _b, _c;
            if (dto.type === client_1.OrganizationType.SCHOOL &&
                ((_a = req.user) === null || _a === void 0 ? void 0 : _a.systemRole) !== client_1.SystemRole.SUPERADMIN) {
                throw new common_1.ForbiddenException('Pouze superadmin může změnit typ organizace na SCHOOL.');
            }
            return this.service.update(id, dto, (_c = (_b = req.user) === null || _b === void 0 ? void 0 : _b.userId) !== null && _c !== void 0 ? _c : null);
        };
        OrganizationsController_1.prototype.remove = function (id) {
            return this.service.remove(id);
        };
        return OrganizationsController_1;
    }());
    __setFunctionName(_classThis, "OrganizationsController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _create_decorators = [(0, common_1.Post)(), (0, swagger_1.ApiOperation)({
                summary: 'Create organization (PRIVATE/COMMUNITY: any user, SCHOOL: superadmin nebo aktuální director)',
            }), (0, invalidate_decorator_1.InvalidateScopes)(function () { return ['ALL']; })];
        _findAll_decorators = [(0, common_1.Get)(), (0, permission_decorator_1.Permission)(client_1.SystemRole.SUPERADMIN), (0, swagger_1.ApiOperation)({
                summary: 'Get organizations (only superadmin), s pagination + search',
            }), (0, swagger_1.ApiQuery)({ name: 'search', required: false, type: String }), (0, swagger_1.ApiQuery)({ name: 'type', required: false, enum: client_1.OrganizationType }), (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }), (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }), (0, cache_manager_1.CacheTTL)(0)];
        _findOne_decorators = [(0, common_1.Get)(':id'), (0, common_1.UseGuards)(school_access_guard_1.SchoolAccessGuard), (0, permission_decorator_1.Permission)(client_1.OrganizationRole.DIRECTOR, client_1.OrganizationRole.TEACHER, client_1.OrganizationRole.STUDENT, client_1.SystemRole.SUPERADMIN), (0, swagger_1.ApiOperation)({
                summary: 'Get organization detail (director/teacher/student/superadmin)',
            }), (0, cache_manager_1.CacheTTL)(0)];
        _update_decorators = [(0, common_1.Patch)(':id'), (0, common_1.UseGuards)(school_access_guard_1.SchoolAccessGuard), (0, permission_decorator_1.Permission)(client_1.OrganizationRole.DIRECTOR, client_1.SystemRole.SUPERADMIN), (0, swagger_1.ApiOperation)({ summary: 'Update organization (director or superadmin)' }), (0, invalidate_decorator_1.InvalidateScopes)(function () { return ['ALL']; })];
        _remove_decorators = [(0, common_1.Delete)(':id'), (0, permission_decorator_1.Permission)(client_1.SystemRole.SUPERADMIN), (0, swagger_1.ApiOperation)({ summary: 'Soft delete organization (only for superadmin)' }), (0, invalidate_decorator_1.InvalidateScopes)(function () { return ['ALL']; })];
        __esDecorate(_classThis, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: function (obj) { return "create" in obj; }, get: function (obj) { return obj.create; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findAll_decorators, { kind: "method", name: "findAll", static: false, private: false, access: { has: function (obj) { return "findAll" in obj; }, get: function (obj) { return obj.findAll; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findOne_decorators, { kind: "method", name: "findOne", static: false, private: false, access: { has: function (obj) { return "findOne" in obj; }, get: function (obj) { return obj.findOne; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: function (obj) { return "update" in obj; }, get: function (obj) { return obj.update; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _remove_decorators, { kind: "method", name: "remove", static: false, private: false, access: { has: function (obj) { return "remove" in obj; }, get: function (obj) { return obj.remove; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        OrganizationsController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return OrganizationsController = _classThis;
}();
exports.OrganizationsController = OrganizationsController;
