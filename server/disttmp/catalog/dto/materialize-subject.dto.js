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
exports.MaterializeSubjectDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var client_1 = require("@prisma/client");
var MaterializeSubjectDto = function () {
    var _a;
    var _organizationId_decorators;
    var _organizationId_initializers = [];
    var _organizationId_extraInitializers = [];
    var _nameOverride_decorators;
    var _nameOverride_initializers = [];
    var _nameOverride_extraInitializers = [];
    var _createLevelsForGrades_decorators;
    var _createLevelsForGrades_initializers = [];
    var _createLevelsForGrades_extraInitializers = [];
    return _a = /** @class */ (function () {
            function MaterializeSubjectDto() {
                this.organizationId = __runInitializers(this, _organizationId_initializers, void 0);
                this.nameOverride = (__runInitializers(this, _organizationId_extraInitializers), __runInitializers(this, _nameOverride_initializers, void 0));
                this.createLevelsForGrades = (__runInitializers(this, _nameOverride_extraInitializers), __runInitializers(this, _createLevelsForGrades_initializers, void 0));
                __runInitializers(this, _createLevelsForGrades_extraInitializers);
            }
            return MaterializeSubjectDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _organizationId_decorators = [(0, swagger_1.ApiProperty)({ example: 'organization-id-uuid' }), (0, class_validator_1.IsUUID)()];
            _nameOverride_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'Matematika pro ZŠ' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _createLevelsForGrades_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    type: [String],
                    enum: client_1.SchoolGrade,
                    example: ['GRADE_6', 'GRADE_7'],
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_transformer_1.Type)(function () { return String; })];
            __esDecorate(null, null, _organizationId_decorators, { kind: "field", name: "organizationId", static: false, private: false, access: { has: function (obj) { return "organizationId" in obj; }, get: function (obj) { return obj.organizationId; }, set: function (obj, value) { obj.organizationId = value; } }, metadata: _metadata }, _organizationId_initializers, _organizationId_extraInitializers);
            __esDecorate(null, null, _nameOverride_decorators, { kind: "field", name: "nameOverride", static: false, private: false, access: { has: function (obj) { return "nameOverride" in obj; }, get: function (obj) { return obj.nameOverride; }, set: function (obj, value) { obj.nameOverride = value; } }, metadata: _metadata }, _nameOverride_initializers, _nameOverride_extraInitializers);
            __esDecorate(null, null, _createLevelsForGrades_decorators, { kind: "field", name: "createLevelsForGrades", static: false, private: false, access: { has: function (obj) { return "createLevelsForGrades" in obj; }, get: function (obj) { return obj.createLevelsForGrades; }, set: function (obj, value) { obj.createLevelsForGrades = value; } }, metadata: _metadata }, _createLevelsForGrades_initializers, _createLevelsForGrades_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.MaterializeSubjectDto = MaterializeSubjectDto;
