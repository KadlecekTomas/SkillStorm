"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSubjectDto = void 0;
var class_validator_1 = require("class-validator");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var CreateSubjectDto = function () {
    var _a;
    var _name_decorators;
    var _name_initializers = [];
    var _name_extraInitializers = [];
    var _organizationId_decorators;
    var _organizationId_initializers = [];
    var _organizationId_extraInitializers = [];
    var _catalogSubjectId_decorators;
    var _catalogSubjectId_initializers = [];
    var _catalogSubjectId_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateSubjectDto() {
                this.name = __runInitializers(this, _name_initializers, void 0);
                this.organizationId = (__runInitializers(this, _name_extraInitializers), __runInitializers(this, _organizationId_initializers, void 0));
                this.catalogSubjectId = (__runInitializers(this, _organizationId_extraInitializers), __runInitializers(this, _catalogSubjectId_initializers, void 0));
                __runInitializers(this, _catalogSubjectId_extraInitializers);
            }
            return CreateSubjectDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _name_decorators = [(0, swagger_1.ApiProperty)({ example: 'Matematika' }), (0, class_validator_1.IsString)(), (0, class_validator_1.Length)(2, 120), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return value === null || value === void 0 ? void 0 : value.trim();
                })];
            _organizationId_decorators = [(0, swagger_1.ApiProperty)({ example: 'organization-id-uuid' }), (0, class_validator_1.IsUUID)()];
            _catalogSubjectId_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'catalog-subject-id-uuid' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)()];
            __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } }, metadata: _metadata }, _name_initializers, _name_extraInitializers);
            __esDecorate(null, null, _organizationId_decorators, { kind: "field", name: "organizationId", static: false, private: false, access: { has: function (obj) { return "organizationId" in obj; }, get: function (obj) { return obj.organizationId; }, set: function (obj, value) { obj.organizationId = value; } }, metadata: _metadata }, _organizationId_initializers, _organizationId_extraInitializers);
            __esDecorate(null, null, _catalogSubjectId_decorators, { kind: "field", name: "catalogSubjectId", static: false, private: false, access: { has: function (obj) { return "catalogSubjectId" in obj; }, get: function (obj) { return obj.catalogSubjectId; }, set: function (obj, value) { obj.catalogSubjectId = value; } }, metadata: _metadata }, _catalogSubjectId_initializers, _catalogSubjectId_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateSubjectDto = CreateSubjectDto;
