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
exports.AssignTestsDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var AssignTestsDto = function () {
    var _a;
    var _testIds_decorators;
    var _testIds_initializers = [];
    var _testIds_extraInitializers = [];
    var _replaceAll_decorators;
    var _replaceAll_initializers = [];
    var _replaceAll_extraInitializers = [];
    return _a = /** @class */ (function () {
            function AssignTestsDto() {
                this.testIds = __runInitializers(this, _testIds_initializers, void 0);
                this.replaceAll = (__runInitializers(this, _testIds_extraInitializers), __runInitializers(this, _replaceAll_initializers, void 0));
                __runInitializers(this, _replaceAll_extraInitializers);
            }
            return AssignTestsDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _testIds_decorators = [(0, swagger_1.ApiProperty)({ type: [String], example: ['test-uuid-1', 'test-uuid-2'] }), (0, class_validator_1.IsArray)(), (0, class_validator_1.ArrayNotEmpty)(), (0, class_validator_1.IsUUID)('4', { each: true }), (0, class_transformer_1.Type)(function () { return String; })];
            _replaceAll_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'true = nahradí existující přiřazení',
                    example: false,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            __esDecorate(null, null, _testIds_decorators, { kind: "field", name: "testIds", static: false, private: false, access: { has: function (obj) { return "testIds" in obj; }, get: function (obj) { return obj.testIds; }, set: function (obj, value) { obj.testIds = value; } }, metadata: _metadata }, _testIds_initializers, _testIds_extraInitializers);
            __esDecorate(null, null, _replaceAll_decorators, { kind: "field", name: "replaceAll", static: false, private: false, access: { has: function (obj) { return "replaceAll" in obj; }, get: function (obj) { return obj.replaceAll; }, set: function (obj, value) { obj.replaceAll = value; } }, metadata: _metadata }, _replaceAll_initializers, _replaceAll_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.AssignTestsDto = AssignTestsDto;
