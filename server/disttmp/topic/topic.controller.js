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
exports.TopicsController = void 0;
// src/modules/topics/topic.controller.ts
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var cache_manager_1 = require("@nestjs/cache-manager");
var permission_decorator_1 = require("src/modules/rbac/permission.decorator");
var client_1 = require("@prisma/client");
var invalidate_decorator_1 = require("src/common/cache/invalidate.decorator");
var TopicsController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Topics'), (0, swagger_1.ApiBearerAuth)(), (0, common_1.Controller)('topics')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _listCatalogSubjects_decorators;
    var _listCatalogTopics_decorators;
    var _getBySubject_decorators;
    var _findAll_decorators;
    var _create_decorators;
    var _findOne_decorators;
    var _update_decorators;
    var _remove_decorators;
    var _assignMaterials_decorators;
    var _removeMaterial_decorators;
    var _assignTests_decorators;
    var _removeTest_decorators;
    var TopicsController = _classThis = /** @class */ (function () {
        function TopicsController_1(service) {
            this.service = (__runInitializers(this, _instanceExtraInitializers), service);
        }
        // =======================
        // CATALOG (read-only) – DEJ SEM NAHORU, PŘED :id
        // =======================
        TopicsController_1.prototype.listCatalogSubjects = function () {
            return this.service.listCatalogSubjects();
        };
        TopicsController_1.prototype.listCatalogTopics = function (catalogSubjectId, search) {
            return this.service.listCatalogTopics(catalogSubjectId, search);
        };
        // =======================
        // BY SUBJECT – TAKY PŘED :id
        // =======================
        TopicsController_1.prototype.getBySubject = function (subjectId, req) {
            return this.service.findBySubjectId(subjectId, req.user);
        };
        // =======================
        // LIST
        // =======================
        TopicsController_1.prototype.findAll = function (req, q) {
            return this.service.findAll(req.user, q);
        };
        // =======================
        // CREATE
        // =======================
        TopicsController_1.prototype.create = function (dto, req) {
            return this.service.create(dto, req.user);
        };
        // =======================
        // DETAIL
        // =======================
        TopicsController_1.prototype.findOne = function (id, req) {
            return this.service.findOne(id, req.user);
        };
        // =======================
        // UPDATE
        // =======================
        TopicsController_1.prototype.update = function (id, dto, req) {
            return this.service.update(id, dto, req.user);
        };
        // =======================
        // DELETE
        // =======================
        TopicsController_1.prototype.remove = function (id, req) {
            return this.service.remove(id, req.user);
        };
        // =======================
        // MATERIALS
        // =======================
        TopicsController_1.prototype.assignMaterials = function (topicLevelId, dto, req) {
            return this.service.assignMaterials(topicLevelId, dto, req.user);
        };
        TopicsController_1.prototype.removeMaterial = function (topicLevelId, materialId, req) {
            return this.service.removeMaterial(topicLevelId, materialId, req.user);
        };
        // =======================
        // TESTS
        // =======================
        TopicsController_1.prototype.assignTests = function (topicLevelId, dto, req) {
            return this.service.assignTests(topicLevelId, dto, req.user);
        };
        TopicsController_1.prototype.removeTest = function (topicLevelId, testId, req) {
            return this.service.removeTest(topicLevelId, testId, req.user);
        };
        return TopicsController_1;
    }());
    __setFunctionName(_classThis, "TopicsController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _listCatalogSubjects_decorators = [(0, common_1.Get)('/catalog/subjects'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'CatalogSubject list (pro picker)' }), (0, cache_manager_1.CacheTTL)(0)];
        _listCatalogTopics_decorators = [(0, common_1.Get)('/catalog/subjects/:id/topics'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'CatalogTopic list by CatalogSubject (pro picker)' }), (0, cache_manager_1.CacheTTL)(0)];
        _getBySubject_decorators = [(0, common_1.Get)('/by-subject/:subjectId'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'TopicLevel podle Subject ID' }), (0, cache_manager_1.CacheTTL)(0)];
        _findAll_decorators = [(0, common_1.Get)(), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({
                summary: 'Seznam TopicLevel s filtry (subjectId / subjectLevelId / search)',
            }), (0, swagger_1.ApiQuery)({ name: 'subjectId', required: false, type: String }), (0, swagger_1.ApiQuery)({ name: 'subjectLevelId', required: false, type: String }), (0, swagger_1.ApiQuery)({ name: 'search', required: false, type: String }), (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }), (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }), (0, cache_manager_1.CacheTTL)(0)];
        _create_decorators = [(0, common_1.Post)(), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Vytvoření TopicLevel (téma)' }), (0, invalidate_decorator_1.InvalidateScopes)(function (_a) {
                var result = _a.result;
                return (result === null || result === void 0 ? void 0 : result.organizationId) ? [result.organizationId] : [];
            })];
        _findOne_decorators = [(0, common_1.Get)(':id'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Detail TopicLevel' }), (0, cache_manager_1.CacheTTL)(0)];
        _update_decorators = [(0, common_1.Patch)(':id'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Upravit TopicLevel' }), (0, invalidate_decorator_1.InvalidateScopes)(function (_a) {
                var result = _a.result;
                return (result === null || result === void 0 ? void 0 : result.organizationId) ? [result.organizationId] : [];
            })];
        _remove_decorators = [(0, common_1.Delete)(':id'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Smazat TopicLevel' }), (0, invalidate_decorator_1.InvalidateScopes)(function (_a) {
                var result = _a.result;
                return (result === null || result === void 0 ? void 0 : result.organizationId) ? [result.organizationId] : [];
            })];
        _assignMaterials_decorators = [(0, common_1.Post)(':id/materials'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Přiřadit (bulk) materiály k TopicLevel' }), (0, invalidate_decorator_1.InvalidateScopes)(function (_a) {
                var result = _a.result;
                return (result === null || result === void 0 ? void 0 : result.organizationId) ? [result.organizationId] : [];
            })];
        _removeMaterial_decorators = [(0, common_1.Delete)(':id/materials/:materialId'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Odebrat materiál z TopicLevel' }), (0, invalidate_decorator_1.InvalidateScopes)(function (_a) {
                var result = _a.result;
                return (result === null || result === void 0 ? void 0 : result.organizationId) ? [result.organizationId] : [];
            })];
        _assignTests_decorators = [(0, common_1.Post)(':id/tests'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Přiřadit (bulk) testy k TopicLevel' }), (0, invalidate_decorator_1.InvalidateScopes)(function (_a) {
                var result = _a.result;
                return (result === null || result === void 0 ? void 0 : result.organizationId) ? [result.organizationId] : [];
            })];
        _removeTest_decorators = [(0, common_1.Delete)(':id/tests/:testId'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Odebrat test z TopicLevel' }), (0, invalidate_decorator_1.InvalidateScopes)(function (_a) {
                var result = _a.result;
                return (result === null || result === void 0 ? void 0 : result.organizationId) ? [result.organizationId] : [];
            })];
        __esDecorate(_classThis, null, _listCatalogSubjects_decorators, { kind: "method", name: "listCatalogSubjects", static: false, private: false, access: { has: function (obj) { return "listCatalogSubjects" in obj; }, get: function (obj) { return obj.listCatalogSubjects; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _listCatalogTopics_decorators, { kind: "method", name: "listCatalogTopics", static: false, private: false, access: { has: function (obj) { return "listCatalogTopics" in obj; }, get: function (obj) { return obj.listCatalogTopics; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getBySubject_decorators, { kind: "method", name: "getBySubject", static: false, private: false, access: { has: function (obj) { return "getBySubject" in obj; }, get: function (obj) { return obj.getBySubject; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findAll_decorators, { kind: "method", name: "findAll", static: false, private: false, access: { has: function (obj) { return "findAll" in obj; }, get: function (obj) { return obj.findAll; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: function (obj) { return "create" in obj; }, get: function (obj) { return obj.create; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findOne_decorators, { kind: "method", name: "findOne", static: false, private: false, access: { has: function (obj) { return "findOne" in obj; }, get: function (obj) { return obj.findOne; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: function (obj) { return "update" in obj; }, get: function (obj) { return obj.update; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _remove_decorators, { kind: "method", name: "remove", static: false, private: false, access: { has: function (obj) { return "remove" in obj; }, get: function (obj) { return obj.remove; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _assignMaterials_decorators, { kind: "method", name: "assignMaterials", static: false, private: false, access: { has: function (obj) { return "assignMaterials" in obj; }, get: function (obj) { return obj.assignMaterials; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _removeMaterial_decorators, { kind: "method", name: "removeMaterial", static: false, private: false, access: { has: function (obj) { return "removeMaterial" in obj; }, get: function (obj) { return obj.removeMaterial; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _assignTests_decorators, { kind: "method", name: "assignTests", static: false, private: false, access: { has: function (obj) { return "assignTests" in obj; }, get: function (obj) { return obj.assignTests; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _removeTest_decorators, { kind: "method", name: "removeTest", static: false, private: false, access: { has: function (obj) { return "removeTest" in obj; }, get: function (obj) { return obj.removeTest; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        TopicsController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return TopicsController = _classThis;
}();
exports.TopicsController = TopicsController;
