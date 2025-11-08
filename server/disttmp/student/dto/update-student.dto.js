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
exports.UpdateStudentDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var UpdateStudentDto = function () {
    var _a;
    var _studentNumber_decorators;
    var _studentNumber_initializers = [];
    var _studentNumber_extraInitializers = [];
    var _externalId_decorators;
    var _externalId_initializers = [];
    var _externalId_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpdateStudentDto() {
                this.studentNumber = __runInitializers(this, _studentNumber_initializers, void 0);
                this.externalId = (__runInitializers(this, _studentNumber_extraInitializers), __runInitializers(this, _externalId_initializers, void 0));
                __runInitializers(this, _externalId_extraInitializers);
            }
            return UpdateStudentDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _studentNumber_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: '2025-00123' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _externalId_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'BK-778899' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _studentNumber_decorators, { kind: "field", name: "studentNumber", static: false, private: false, access: { has: function (obj) { return "studentNumber" in obj; }, get: function (obj) { return obj.studentNumber; }, set: function (obj, value) { obj.studentNumber = value; } }, metadata: _metadata }, _studentNumber_initializers, _studentNumber_extraInitializers);
            __esDecorate(null, null, _externalId_decorators, { kind: "field", name: "externalId", static: false, private: false, access: { has: function (obj) { return "externalId" in obj; }, get: function (obj) { return obj.externalId; }, set: function (obj, value) { obj.externalId = value; } }, metadata: _metadata }, _externalId_initializers, _externalId_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdateStudentDto = UpdateStudentDto;
