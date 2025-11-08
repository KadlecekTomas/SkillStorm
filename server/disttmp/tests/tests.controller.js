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
exports.TestsController = void 0;
// src/tests/tests.controller.ts
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var permission_decorator_1 = require("src/modules/rbac/permission.decorator");
var client_1 = require("@prisma/client");
var cache_manager_1 = require("@nestjs/cache-manager");
var invalidate_decorator_1 = require("src/common/cache/invalidate.decorator");
var TestsController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Tests'), (0, swagger_1.ApiBearerAuth)(), (0, common_1.Controller)('tests')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _create_decorators;
    var _findAll_decorators;
    var _findOne_decorators;
    var _update_decorators;
    var _remove_decorators;
    var _reorderQuestions_decorators;
    var _addQuestion_decorators;
    var _updateQuestion_decorators;
    var _removeQuestion_decorators;
    var _addOption_decorators;
    var _updateOption_decorators;
    var _removeOption_decorators;
    var _addAnswer_decorators;
    var _updateAnswer_decorators;
    var _removeAnswer_decorators;
    var TestsController = _classThis = /** @class */ (function () {
        function TestsController_1(service) {
            this.service = (__runInitializers(this, _instanceExtraInitializers), service);
        }
        // TESTS ------------------------------------------------
        TestsController_1.prototype.create = function (dto, req) {
            return this.service.create(dto, req.user);
        };
        TestsController_1.prototype.findAll = function (req, q) {
            return this.service.findAll(req.user, q);
        };
        TestsController_1.prototype.findOne = function (id, req) {
            return this.service.findOne(id, req.user);
        };
        TestsController_1.prototype.update = function (id, dto, req) {
            return this.service.update(id, dto, req.user);
        };
        TestsController_1.prototype.remove = function (id, req) {
            return this.service.remove(id, req.user);
        };
        // QUESTIONS -------------------------------------------
        // Reorder MUSÍ být nad ':id/questions/:questionId'
        TestsController_1.prototype.reorderQuestions = function (testId, dto, req) {
            return this.service.reorderQuestions(testId, dto, req.user);
        };
        TestsController_1.prototype.addQuestion = function (testId, dto, req) {
            return this.service.addQuestion(testId, dto, req.user);
        };
        TestsController_1.prototype.updateQuestion = function (testId, questionId, dto, req) {
            return this.service.updateQuestion(testId, questionId, dto, req.user);
        };
        TestsController_1.prototype.removeQuestion = function (testId, questionId, req) {
            return this.service.removeQuestion(testId, questionId, req.user);
        };
        // OPTIONS ---------------------------------------------
        TestsController_1.prototype.addOption = function (testId, questionId, dto, req) {
            return this.service.addOption(testId, questionId, dto, req.user);
        };
        TestsController_1.prototype.updateOption = function (testId, questionId, optionId, dto, req) {
            return this.service.updateOption(testId, questionId, optionId, dto, req.user);
        };
        TestsController_1.prototype.removeOption = function (testId, questionId, optionId, req) {
            return this.service.removeOption(testId, questionId, optionId, req.user);
        };
        // ANSWERS (správné odpovědi) --------------------------
        TestsController_1.prototype.addAnswer = function (testId, questionId, dto, req) {
            return this.service.addAnswer(testId, questionId, dto, req.user);
        };
        TestsController_1.prototype.updateAnswer = function (testId, questionId, answerId, dto, req) {
            return this.service.updateAnswer(testId, questionId, answerId, dto, req.user);
        };
        TestsController_1.prototype.removeAnswer = function (testId, questionId, answerId, req) {
            return this.service.removeAnswer(testId, questionId, answerId, req.user);
        };
        return TestsController_1;
    }());
    __setFunctionName(_classThis, "TestsController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _create_decorators = [(0, common_1.Post)(), (0, permission_decorator_1.Permission)(client_1.PermissionKey.CREATE_TEST), (0, swagger_1.ApiOperation)({ summary: 'Create test' }), (0, invalidate_decorator_1.InvalidateScopes)(function (_a) {
                var _b;
                var req = _a.req;
                return [(_b = req.body) === null || _b === void 0 ? void 0 : _b.organizationId].filter(Boolean);
            })];
        _findAll_decorators = [(0, common_1.Get)(), (0, permission_decorator_1.Permission)(client_1.PermissionKey.VIEW_RESULTS), (0, swagger_1.ApiOperation)({ summary: 'List tests' }), (0, swagger_1.ApiQuery)({ name: 'organizationId', required: false, type: String }), (0, cache_manager_1.CacheTTL)(0)];
        _findOne_decorators = [(0, common_1.Get)(':id'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.VIEW_RESULTS), (0, swagger_1.ApiOperation)({ summary: 'Get test detail' }), (0, cache_manager_1.CacheTTL)(0)];
        _update_decorators = [(0, common_1.Patch)(':id'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.EDIT_TEST), (0, swagger_1.ApiOperation)({ summary: 'Update test' }), (0, invalidate_decorator_1.InvalidateScopes)(function (_a) {
                var result = _a.result;
                return (result === null || result === void 0 ? void 0 : result.organizationId) ? [result.organizationId] : [];
            })];
        _remove_decorators = [(0, common_1.Delete)(':id'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.DELETE_TEST), (0, swagger_1.ApiOperation)({ summary: 'Soft delete test' }), (0, invalidate_decorator_1.InvalidateScopes)(function (_a) {
                var result = _a.result;
                return (result === null || result === void 0 ? void 0 : result.organizationId) ? [result.organizationId] : [];
            })];
        _reorderQuestions_decorators = [(0, common_1.Patch)(':id/questions/reorder'), (0, common_1.Patch)(':id/questions/reorder'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.EDIT_TEST), (0, swagger_1.ApiOperation)({ summary: 'Reorder questions' })];
        _addQuestion_decorators = [(0, common_1.Post)(':id/questions'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.EDIT_TEST), (0, swagger_1.ApiOperation)({ summary: 'Add question to test' })];
        _updateQuestion_decorators = [(0, common_1.Patch)(':id/questions/:questionId([0-9a-fA-F-]{36})'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.EDIT_TEST), (0, swagger_1.ApiOperation)({ summary: 'Update question' })];
        _removeQuestion_decorators = [(0, common_1.Delete)(':id/questions/:questionId([0-9a-fA-F-]{36})'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.EDIT_TEST), (0, swagger_1.ApiOperation)({ summary: 'Remove question' })];
        _addOption_decorators = [(0, common_1.Post)(':id/questions/:questionId([0-9a-fA-F-]{36})/options'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.EDIT_TEST)];
        _updateOption_decorators = [(0, common_1.Patch)(':id/questions/:questionId([0-9a-fA-F-]{36})/options/:optionId([0-9a-fA-F-]{36})'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.EDIT_TEST)];
        _removeOption_decorators = [(0, common_1.Delete)(':id/questions/:questionId([0-9a-fA-F-]{36})/options/:optionId([0-9a-fA-F-]{36})'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.EDIT_TEST)];
        _addAnswer_decorators = [(0, common_1.Post)(':id/questions/:questionId([0-9a-fA-F-]{36})/answers'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.EDIT_TEST)];
        _updateAnswer_decorators = [(0, common_1.Patch)(':id/questions/:questionId([0-9a-fA-F-]{36})/answers/:answerId([0-9a-fA-F-]{36})'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.EDIT_TEST)];
        _removeAnswer_decorators = [(0, common_1.Delete)(':id/questions/:questionId([0-9a-fA-F-]{36})/answers/:answerId([0-9a-fA-F-]{36})'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.EDIT_TEST)];
        __esDecorate(_classThis, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: function (obj) { return "create" in obj; }, get: function (obj) { return obj.create; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findAll_decorators, { kind: "method", name: "findAll", static: false, private: false, access: { has: function (obj) { return "findAll" in obj; }, get: function (obj) { return obj.findAll; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findOne_decorators, { kind: "method", name: "findOne", static: false, private: false, access: { has: function (obj) { return "findOne" in obj; }, get: function (obj) { return obj.findOne; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: function (obj) { return "update" in obj; }, get: function (obj) { return obj.update; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _remove_decorators, { kind: "method", name: "remove", static: false, private: false, access: { has: function (obj) { return "remove" in obj; }, get: function (obj) { return obj.remove; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _reorderQuestions_decorators, { kind: "method", name: "reorderQuestions", static: false, private: false, access: { has: function (obj) { return "reorderQuestions" in obj; }, get: function (obj) { return obj.reorderQuestions; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _addQuestion_decorators, { kind: "method", name: "addQuestion", static: false, private: false, access: { has: function (obj) { return "addQuestion" in obj; }, get: function (obj) { return obj.addQuestion; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateQuestion_decorators, { kind: "method", name: "updateQuestion", static: false, private: false, access: { has: function (obj) { return "updateQuestion" in obj; }, get: function (obj) { return obj.updateQuestion; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _removeQuestion_decorators, { kind: "method", name: "removeQuestion", static: false, private: false, access: { has: function (obj) { return "removeQuestion" in obj; }, get: function (obj) { return obj.removeQuestion; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _addOption_decorators, { kind: "method", name: "addOption", static: false, private: false, access: { has: function (obj) { return "addOption" in obj; }, get: function (obj) { return obj.addOption; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateOption_decorators, { kind: "method", name: "updateOption", static: false, private: false, access: { has: function (obj) { return "updateOption" in obj; }, get: function (obj) { return obj.updateOption; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _removeOption_decorators, { kind: "method", name: "removeOption", static: false, private: false, access: { has: function (obj) { return "removeOption" in obj; }, get: function (obj) { return obj.removeOption; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _addAnswer_decorators, { kind: "method", name: "addAnswer", static: false, private: false, access: { has: function (obj) { return "addAnswer" in obj; }, get: function (obj) { return obj.addAnswer; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _updateAnswer_decorators, { kind: "method", name: "updateAnswer", static: false, private: false, access: { has: function (obj) { return "updateAnswer" in obj; }, get: function (obj) { return obj.updateAnswer; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _removeAnswer_decorators, { kind: "method", name: "removeAnswer", static: false, private: false, access: { has: function (obj) { return "removeAnswer" in obj; }, get: function (obj) { return obj.removeAnswer; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        TestsController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return TestsController = _classThis;
}();
exports.TestsController = TestsController;
