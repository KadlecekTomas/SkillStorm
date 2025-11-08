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
exports.CatalogController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var client_1 = require("@prisma/client");
var permission_decorator_1 = require("src/modules/rbac/permission.decorator");
var CatalogController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Catalog'), (0, swagger_1.ApiBearerAuth)(), (0, common_1.Controller)('catalog')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _listSubjects_decorators;
    var _getSubject_decorators;
    var _listTopics_decorators;
    var _getTopic_decorators;
    var _materializeSubject_decorators;
    var _materializeTopic_decorators;
    var _materializeTopicsBulk_decorators;
    var _createCatalogSubject_decorators;
    var _updateCatalogSubject_decorators;
    var _deleteCatalogSubject_decorators;
    var _createCatalogTopic_decorators;
    var _updateCatalogTopic_decorators;
    var _deleteCatalogTopic_decorators;
    var CatalogController = _classThis = /** @class */ (function () {
        function CatalogController_1(service) {
            this.service = (__runInitializers(this, _instanceExtraInitializers), service);
        }
        // ---------- READ (teacher/director/superadmin) ----------
        CatalogController_1.prototype.listSubjects = function (q) {
            return this.service.listSubjects(q);
        };
        CatalogController_1.prototype.getSubject = function (id) {
            return this.service.getSubject(id);
        };
        CatalogController_1.prototype.listTopics = function (id, q) {
            return this.service.listTopicsByCatalogSubject(id, q);
        };
        CatalogController_1.prototype.getTopic = function (id) {
            return this.service.getTopic(id);
        };
        // ---------- MATERIALIZE (teacher/director in org, or superadmin) ----------
        CatalogController_1.prototype.materializeSubject = function (catalogSubjectId, dto, req) {
            return this.service.materializeSubject(catalogSubjectId, dto, req.user);
        };
        CatalogController_1.prototype.materializeTopic = function (catalogTopicId, dto, req) {
            return this.service.materializeTopic(catalogTopicId, dto, req.user);
        };
        CatalogController_1.prototype.materializeTopicsBulk = function (catalogSubjectId, dto, req) {
            return this.service.materializeTopicsBulk(catalogSubjectId, dto, req.user);
        };
        // ---------- CRUD (superadmin only) ----------
        CatalogController_1.prototype.createCatalogSubject = function (dto) {
            return this.service.createCatalogSubject(dto);
        };
        CatalogController_1.prototype.updateCatalogSubject = function (id, dto) {
            return this.service.updateCatalogSubject(id, dto);
        };
        CatalogController_1.prototype.deleteCatalogSubject = function (id) {
            return this.service.deleteCatalogSubject(id);
        };
        CatalogController_1.prototype.createCatalogTopic = function (subjectId, dto) {
            return this.service.createCatalogTopic(subjectId, dto);
        };
        CatalogController_1.prototype.updateCatalogTopic = function (id, dto) {
            return this.service.updateCatalogTopic(id, dto);
        };
        CatalogController_1.prototype.deleteCatalogTopic = function (id) {
            return this.service.deleteCatalogTopic(id);
        };
        return CatalogController_1;
    }());
    __setFunctionName(_classThis, "CatalogController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _listSubjects_decorators = [(0, common_1.Get)('subjects'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({
                summary: 'CatalogSubject list (search + pagination, cached)',
            }), (0, swagger_1.ApiQuery)({ name: 'search', required: false, type: String }), (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number, example: 1 }), (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, example: 20 })];
        _getSubject_decorators = [(0, common_1.Get)('subjects/:id'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'CatalogSubject detail (cached)' })];
        _listTopics_decorators = [(0, common_1.Get)('subjects/:id/topics'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'CatalogTopic list by CatalogSubject (cached)' }), (0, swagger_1.ApiQuery)({ name: 'search', required: false, type: String }), (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number, example: 1 }), (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, example: 50 })];
        _getTopic_decorators = [(0, common_1.Get)('topics/:id'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'CatalogTopic detail (cached)' })];
        _materializeSubject_decorators = [(0, common_1.Post)('subjects/:id/materialize-to-org'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Vytvoř Subject (+levels) v org z CatalogSubject' })];
        _materializeTopic_decorators = [(0, common_1.Post)('topics/:id/materialize-to-subject-level'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({ summary: 'Vytvoř TopicLevel v SubjectLevel z CatalogTopic' })];
        _materializeTopicsBulk_decorators = [(0, common_1.Post)('subjects/:id/materialize-topics'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.MANAGE_TEACHERS), (0, swagger_1.ApiOperation)({
                summary: 'Bulk materializace více CatalogTopic do SubjectLevel',
            })];
        _createCatalogSubject_decorators = [(0, common_1.Post)('subjects'), (0, permission_decorator_1.Permission)(client_1.SystemRole.SUPERADMIN), (0, swagger_1.ApiOperation)({ summary: 'Create CatalogSubject (SUPERADMIN)' })];
        _updateCatalogSubject_decorators = [(0, common_1.Patch)('subjects/:id'), (0, permission_decorator_1.Permission)(client_1.SystemRole.SUPERADMIN), (0, swagger_1.ApiOperation)({ summary: 'Update CatalogSubject (SUPERADMIN)' })];
        _deleteCatalogSubject_decorators = [(0, common_1.Delete)('subjects/:id'), (0, permission_decorator_1.Permission)(client_1.SystemRole.SUPERADMIN), (0, swagger_1.ApiOperation)({ summary: 'Delete CatalogSubject (SUPERADMIN)' })];
        _createCatalogTopic_decorators = [(0, common_1.Post)('subjects/:id/topics'), (0, permission_decorator_1.Permission)(client_1.SystemRole.SUPERADMIN), (0, swagger_1.ApiOperation)({
                summary: 'Create CatalogTopic under CatalogSubject (SUPERADMIN)',
            })];
        _updateCatalogTopic_decorators = [(0, common_1.Patch)('topics/:id'), (0, permission_decorator_1.Permission)(client_1.SystemRole.SUPERADMIN), (0, swagger_1.ApiOperation)({ summary: 'Update CatalogTopic (SUPERADMIN)' })];
        _deleteCatalogTopic_decorators = [(0, common_1.Delete)('topics/:id'), (0, permission_decorator_1.Permission)(client_1.SystemRole.SUPERADMIN), (0, swagger_1.ApiOperation)({ summary: 'Delete CatalogTopic (SUPERADMIN)' })];
        __esDecorate(_classThis, null, _listSubjects_decorators, { kind: "method", name: "listSubjects", static: false, private: false, access: { has: function (obj) { return "listSubjects" in obj; }, get: function (obj) { return obj.listSubjects; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getSubject_decorators, { kind: "method", name: "getSubject", static: false, private: false, access: { has: function (obj) { return "getSubject" in obj; }, get: function (obj) { return obj.getSubject; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _listTopics_decorators, { kind: "method", name: "listTopics", static: false, private: false, access: { has: function (obj) { return "listTopics" in obj; }, get: function (obj) { return obj.listTopics; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getTopic_decorators, { kind: "method", name: "getTopic", static: false, private: false, access: { has: function (obj) { return "getTopic" in obj; }, get: function (obj) { return obj.getTopic; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _materializeSubject_decorators, { kind: "method", name: "materializeSubject", static: false, private: false, access: { has: function (obj) { return "materializeSubject" in obj; }, get: function (obj) { return obj.materializeSubject; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _materializeTopic_decorators, { kind: "method", name: "materializeTopic", static: false, private: false, access: { has: function (obj) { return "materializeTopic" in obj; }, get: function (obj) { return obj.materializeTopic; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _materializeTopicsBulk_decorators, { kind: "method", name: "materializeTopicsBulk", static: false, private: false, access: { has: function (obj) { return "materializeTopicsBulk" in obj; }, get: function (obj) { return obj.materializeTopicsBulk; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _createCatalogSubject_decorators, { kind: "method", name: "createCatalogSubject", static: false, private: false, access: { has: function (obj) { return "createCatalogSubject" in obj; }, get: function (obj) { return obj.createCatalogSubject; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateCatalogSubject_decorators, { kind: "method", name: "updateCatalogSubject", static: false, private: false, access: { has: function (obj) { return "updateCatalogSubject" in obj; }, get: function (obj) { return obj.updateCatalogSubject; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _deleteCatalogSubject_decorators, { kind: "method", name: "deleteCatalogSubject", static: false, private: false, access: { has: function (obj) { return "deleteCatalogSubject" in obj; }, get: function (obj) { return obj.deleteCatalogSubject; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _createCatalogTopic_decorators, { kind: "method", name: "createCatalogTopic", static: false, private: false, access: { has: function (obj) { return "createCatalogTopic" in obj; }, get: function (obj) { return obj.createCatalogTopic; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateCatalogTopic_decorators, { kind: "method", name: "updateCatalogTopic", static: false, private: false, access: { has: function (obj) { return "updateCatalogTopic" in obj; }, get: function (obj) { return obj.updateCatalogTopic; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _deleteCatalogTopic_decorators, { kind: "method", name: "deleteCatalogTopic", static: false, private: false, access: { has: function (obj) { return "deleteCatalogTopic" in obj; }, get: function (obj) { return obj.deleteCatalogTopic; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CatalogController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CatalogController = _classThis;
}();
exports.CatalogController = CatalogController;
