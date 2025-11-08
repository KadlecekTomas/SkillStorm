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
exports.CreateClassSectionDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var client_1 = require("@prisma/client");
var CreateClassSectionDto = function () {
    var _a;
    var _yearId_decorators;
    var _yearId_initializers = [];
    var _yearId_extraInitializers = [];
    var _grade_decorators;
    var _grade_initializers = [];
    var _grade_extraInitializers = [];
    var _section_decorators;
    var _section_initializers = [];
    var _section_extraInitializers = [];
    var _label_decorators;
    var _label_initializers = [];
    var _label_extraInitializers = [];
    var _studyField_decorators;
    var _studyField_initializers = [];
    var _studyField_extraInitializers = [];
    var _teacherId_decorators;
    var _teacherId_initializers = [];
    var _teacherId_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateClassSectionDto() {
                this.yearId = __runInitializers(this, _yearId_initializers, void 0);
                this.grade = (__runInitializers(this, _yearId_extraInitializers), __runInitializers(this, _grade_initializers, void 0));
                this.section = (__runInitializers(this, _grade_extraInitializers), __runInitializers(this, _section_initializers, void 0));
                this.label = (__runInitializers(this, _section_extraInitializers), __runInitializers(this, _label_initializers, void 0));
                this.studyField = (__runInitializers(this, _label_extraInitializers), __runInitializers(this, _studyField_initializers, void 0));
                this.teacherId = (__runInitializers(this, _studyField_extraInitializers), __runInitializers(this, _teacherId_initializers, void 0));
                __runInitializers(this, _teacherId_extraInitializers);
            }
            return CreateClassSectionDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _yearId_decorators = [(0, swagger_1.ApiProperty)({
                    example: 'year-uuid',
                    description: 'ID školního roku (AcademicYear)',
                }), (0, class_validator_1.IsUUID)()];
            _grade_decorators = [(0, swagger_1.ApiProperty)({
                    example: 'PRIMARY_1',
                    description: 'Ročník třídy (např. PRIMARY_1, PRIMARY_2...)',
                }), (0, class_validator_1.IsEnum)(client_1.SchoolGrade)];
            _section_decorators = [(0, swagger_1.ApiProperty)({
                    example: 'A',
                    description: 'Označení sekce (A, B, C...)',
                }), (0, class_validator_1.IsString)()];
            _label_decorators = [(0, swagger_1.ApiProperty)({
                    example: '1.A',
                    description: 'Celé označení třídy',
                }), (0, class_validator_1.IsString)()];
            _studyField_decorators = [(0, swagger_1.ApiProperty)({
                    example: 'Informatika',
                    description: 'Studijní obor (volitelné)',
                    required: false,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _teacherId_decorators = [(0, swagger_1.ApiProperty)({
                    example: 'teacher-uuid',
                    description: 'Učitel třídní (volitelné)',
                    required: false,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)()];
            __esDecorate(null, null, _yearId_decorators, { kind: "field", name: "yearId", static: false, private: false, access: { has: function (obj) { return "yearId" in obj; }, get: function (obj) { return obj.yearId; }, set: function (obj, value) { obj.yearId = value; } }, metadata: _metadata }, _yearId_initializers, _yearId_extraInitializers);
            __esDecorate(null, null, _grade_decorators, { kind: "field", name: "grade", static: false, private: false, access: { has: function (obj) { return "grade" in obj; }, get: function (obj) { return obj.grade; }, set: function (obj, value) { obj.grade = value; } }, metadata: _metadata }, _grade_initializers, _grade_extraInitializers);
            __esDecorate(null, null, _section_decorators, { kind: "field", name: "section", static: false, private: false, access: { has: function (obj) { return "section" in obj; }, get: function (obj) { return obj.section; }, set: function (obj, value) { obj.section = value; } }, metadata: _metadata }, _section_initializers, _section_extraInitializers);
            __esDecorate(null, null, _label_decorators, { kind: "field", name: "label", static: false, private: false, access: { has: function (obj) { return "label" in obj; }, get: function (obj) { return obj.label; }, set: function (obj, value) { obj.label = value; } }, metadata: _metadata }, _label_initializers, _label_extraInitializers);
            __esDecorate(null, null, _studyField_decorators, { kind: "field", name: "studyField", static: false, private: false, access: { has: function (obj) { return "studyField" in obj; }, get: function (obj) { return obj.studyField; }, set: function (obj, value) { obj.studyField = value; } }, metadata: _metadata }, _studyField_initializers, _studyField_extraInitializers);
            __esDecorate(null, null, _teacherId_decorators, { kind: "field", name: "teacherId", static: false, private: false, access: { has: function (obj) { return "teacherId" in obj; }, get: function (obj) { return obj.teacherId; }, set: function (obj, value) { obj.teacherId = value; } }, metadata: _metadata }, _teacherId_initializers, _teacherId_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateClassSectionDto = CreateClassSectionDto;
