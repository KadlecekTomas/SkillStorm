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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubjectsController = void 0;
// src/modules/subjects/subjects.controller.ts
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var cache_manager_1 = require("@nestjs/cache-manager");
var client_1 = require("@prisma/client");
var permission_decorator_1 = require("src/modules/rbac/permission.decorator");
var invalidate_decorator_1 = require("src/common/cache/invalidate.decorator");
var SubjectsController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Subjects'), (0, swagger_1.ApiBearerAuth)(), (0, common_1.Controller)('subjects')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _create_decorators;
    var _findAll_decorators;
    var _findOne_decorators;
    var _update_decorators;
    var _remove_decorators;
    var _findLevels_decorators;
    var _findTopicsBySubject_decorators;
    var SubjectsController = _classThis = /** @class */ (function () {
        function SubjectsController_1(service) {
            this.service = (__runInitializers(this, _instanceExtraInitializers), service);
        }
        // ---------- CREATE ----------
        SubjectsController_1.prototype.create = function (dto, req) {
            return this.service.create(dto, req.user);
        };
        // ---------- LIST ----------
        SubjectsController_1.prototype.findAll = function (req, q) {
            return this.service.findAll(req.user, q);
        };
        // ---------- DETAIL ----------
        SubjectsController_1.prototype.findOne = function (id, req) {
            return this.service.findOne(id, req.user);
        };
        // ---------- UPDATE ----------
        SubjectsController_1.prototype.update = function (id, dto, req) {
            return this.service.update(id, dto, req.user);
        };
        // ---------- DELETE (soft) ----------
        SubjectsController_1.prototype.remove = function (id, req) {
            return this.service.remove(id, req.user);
        };
        // ---------- Subject → Levels ----------
        SubjectsController_1.prototype.findLevels = function (subjectId, req) {
            return this.service.findLevels(subjectId, req.user);
        };
        // ---------- Subject → TopicLevels (přes Levels) ----------
        SubjectsController_1.prototype.findTopicsBySubject = function (subjectId, req) {
            return this.service.findTopicLevels(subjectId, req.user);
        };
        return SubjectsController_1;
    }());
    __setFunctionName(_classThis, "SubjectsController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _create_decorators = [(0, common_1.Post)(), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Vytvoření předmětu' }), (0, invalidate_decorator_1.InvalidateScopes)(function (_a) {
                var _b;
                var req = _a.req;
                return [(_b = req.body) === null || _b === void 0 ? void 0 : _b.organizationId].filter(Boolean);
            })];
        _findAll_decorators = [(0, common_1.Get)(), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({
                summary: 'Získat předměty (search, pagination, includeLevels)',
            }), (0, swagger_1.ApiQuery)({ name: 'page', required: false, example: 1 }), (0, swagger_1.ApiQuery)({ name: 'limit', required: false, example: 20 }), (0, swagger_1.ApiQuery)({ name: 'search', required: false, example: 'mat' }), (0, swagger_1.ApiQuery)({ name: 'includeLevels', required: false, example: false }), (0, cache_manager_1.CacheTTL)(0)];
        _findOne_decorators = [(0, common_1.Get)(':id'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Detail předmětu' }), (0, cache_manager_1.CacheTTL)(0)];
        _update_decorators = [(0, common_1.Patch)(':id'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Úprava předmětu' }), (0, invalidate_decorator_1.InvalidateScopes)(function (_a) {
                var result = _a.result;
                return (result === null || result === void 0 ? void 0 : result.organizationId) ? [result.organizationId] : [];
            })];
        _remove_decorators = [(0, common_1.Delete)(':id'), (0, permission_decorator_1.Permission)(client_1.SystemRole.SUPERADMIN, client_1.OrganizationRole.DIRECTOR), (0, swagger_1.ApiOperation)({ summary: 'Soft smazání předmětu' }), (0, invalidate_decorator_1.InvalidateScopes)(function (_a) {
                var result = _a.result;
                return (result === null || result === void 0 ? void 0 : result.organizationId) ? [result.organizationId] : [];
            })];
        _findLevels_decorators = [(0, common_1.Get)(':id/levels'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Seznam SubjectLevel pro daný předmět' }), (0, cache_manager_1.CacheTTL)(0)];
        _findTopicsBySubject_decorators = [(0, common_1.Get)(':id/topics'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({
                summary: 'Všechna TopicLevel pro daný předmět (přes SubjectLevel)',
            }), (0, cache_manager_1.CacheTTL)(0)];
        __esDecorate(_classThis, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: function (obj) { return "create" in obj; }, get: function (obj) { return obj.create; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findAll_decorators, { kind: "method", name: "findAll", static: false, private: false, access: { has: function (obj) { return "findAll" in obj; }, get: function (obj) { return obj.findAll; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findOne_decorators, { kind: "method", name: "findOne", static: false, private: false, access: { has: function (obj) { return "findOne" in obj; }, get: function (obj) { return obj.findOne; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: function (obj) { return "update" in obj; }, get: function (obj) { return obj.update; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _remove_decorators, { kind: "method", name: "remove", static: false, private: false, access: { has: function (obj) { return "remove" in obj; }, get: function (obj) { return obj.remove; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findLevels_decorators, { kind: "method", name: "findLevels", static: false, private: false, access: { has: function (obj) { return "findLevels" in obj; }, get: function (obj) { return obj.findLevels; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findTopicsBySubject_decorators, { kind: "method", name: "findTopicsBySubject", static: false, private: false, access: { has: function (obj) { return "findTopicsBySubject" in obj; }, get: function (obj) { return obj.findTopicsBySubject; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        SubjectsController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return SubjectsController = _classThis;
}();
exports.SubjectsController = SubjectsController;
