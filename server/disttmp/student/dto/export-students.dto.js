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
exports.ExportStudentsDto = void 0;
// src/modules/students/dto/export-students.dto.ts
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var ExportStudentsDto = function () {
    var _a;
    var _format_decorators;
    var _format_initializers = [];
    var _format_extraInitializers = [];
    var _filename_decorators;
    var _filename_initializers = [];
    var _filename_extraInitializers = [];
    var _search_decorators;
    var _search_initializers = [];
    var _search_extraInitializers = [];
    var _yearId_decorators;
    var _yearId_initializers = [];
    var _yearId_extraInitializers = [];
    var _classSectionId_decorators;
    var _classSectionId_initializers = [];
    var _classSectionId_extraInitializers = [];
    var _batchSize_decorators;
    var _batchSize_initializers = [];
    var _batchSize_extraInitializers = [];
    var _columns_decorators;
    var _columns_initializers = [];
    var _columns_extraInitializers = [];
    var _includeEnrollments_decorators;
    var _includeEnrollments_initializers = [];
    var _includeEnrollments_extraInitializers = [];
    var _template_decorators;
    var _template_initializers = [];
    var _template_extraInitializers = [];
    var _mode_decorators;
    var _mode_initializers = [];
    var _mode_extraInitializers = [];
    return _a = /** @class */ (function () {
            function ExportStudentsDto() {
                this.format = __runInitializers(this, _format_initializers, 'xlsx');
                this.filename = (__runInitializers(this, _format_extraInitializers), __runInitializers(this, _filename_initializers, void 0));
                // filtry
                this.search = (__runInitializers(this, _filename_extraInitializers), __runInitializers(this, _search_initializers, void 0));
                this.yearId = (__runInitializers(this, _search_extraInitializers), __runInitializers(this, _yearId_initializers, void 0));
                this.classSectionId = (__runInitializers(this, _yearId_extraInitializers), __runInitializers(this, _classSectionId_initializers, void 0));
                // batch
                this.batchSize = (__runInitializers(this, _classSectionId_extraInitializers), __runInitializers(this, _batchSize_initializers, 1000));
                // manuální sloupce (přetluče template)
                this.columns = (__runInitializers(this, _batchSize_extraInitializers), __runInitializers(this, _columns_initializers, void 0));
                // zahrnout enrollments (u některých template zapneme automaticky)
                this.includeEnrollments = (__runInitializers(this, _columns_extraInitializers), __runInitializers(this, _includeEnrollments_initializers, void 0));
                // 🔥 NOVĚ: presety
                this.template = (__runInitializers(this, _includeEnrollments_extraInitializers), __runInitializers(this, _template_initializers, void 0));
                // volitelný mód
                this.mode = (__runInitializers(this, _template_extraInitializers), __runInitializers(this, _mode_initializers, void 0));
                __runInitializers(this, _mode_extraInitializers);
            }
            return ExportStudentsDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _format_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: ['csv', 'xlsx'], example: 'xlsx' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsIn)(['csv', 'xlsx'])];
            _filename_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'students_export' }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return value === null || value === void 0 ? void 0 : value.trim();
                }), (0, class_validator_1.IsString)()];
            _search_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'Novák' }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return value === null || value === void 0 ? void 0 : value.trim();
                }), (0, class_validator_1.IsString)()];
            _yearId_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'academic-year-uuid' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)()];
            _classSectionId_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'class-section-uuid' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)()];
            _batchSize_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 1000 }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Type)(function () { return Number; }), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(100)];
            _columns_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Volitelné: vybrané sloupce',
                    example: ['userName', 'userEmail', 'classLabel', 'yearLabel'],
                    isArray: true,
                    type: String,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.ArrayNotEmpty)(), (0, class_validator_1.ArrayUnique)(), (0, class_validator_1.IsString)({ each: true })];
            _includeEnrollments_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: true }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Type)(function () { return Boolean; }), (0, class_validator_1.IsBoolean)()];
            _template_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    enum: ['tridni', 'kontakty', 'lms', 'reditel'],
                    example: 'tridni',
                    description: 'Přednastavené sloupce/formát/volby',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsIn)(['tridni', 'kontakty', 'lms', 'reditel'])];
            _mode_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: ['light', 'full'], example: 'light' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsIn)(['light', 'full'])];
            __esDecorate(null, null, _format_decorators, { kind: "field", name: "format", static: false, private: false, access: { has: function (obj) { return "format" in obj; }, get: function (obj) { return obj.format; }, set: function (obj, value) { obj.format = value; } }, metadata: _metadata }, _format_initializers, _format_extraInitializers);
            __esDecorate(null, null, _filename_decorators, { kind: "field", name: "filename", static: false, private: false, access: { has: function (obj) { return "filename" in obj; }, get: function (obj) { return obj.filename; }, set: function (obj, value) { obj.filename = value; } }, metadata: _metadata }, _filename_initializers, _filename_extraInitializers);
            __esDecorate(null, null, _search_decorators, { kind: "field", name: "search", static: false, private: false, access: { has: function (obj) { return "search" in obj; }, get: function (obj) { return obj.search; }, set: function (obj, value) { obj.search = value; } }, metadata: _metadata }, _search_initializers, _search_extraInitializers);
            __esDecorate(null, null, _yearId_decorators, { kind: "field", name: "yearId", static: false, private: false, access: { has: function (obj) { return "yearId" in obj; }, get: function (obj) { return obj.yearId; }, set: function (obj, value) { obj.yearId = value; } }, metadata: _metadata }, _yearId_initializers, _yearId_extraInitializers);
            __esDecorate(null, null, _classSectionId_decorators, { kind: "field", name: "classSectionId", static: false, private: false, access: { has: function (obj) { return "classSectionId" in obj; }, get: function (obj) { return obj.classSectionId; }, set: function (obj, value) { obj.classSectionId = value; } }, metadata: _metadata }, _classSectionId_initializers, _classSectionId_extraInitializers);
            __esDecorate(null, null, _batchSize_decorators, { kind: "field", name: "batchSize", static: false, private: false, access: { has: function (obj) { return "batchSize" in obj; }, get: function (obj) { return obj.batchSize; }, set: function (obj, value) { obj.batchSize = value; } }, metadata: _metadata }, _batchSize_initializers, _batchSize_extraInitializers);
            __esDecorate(null, null, _columns_decorators, { kind: "field", name: "columns", static: false, private: false, access: { has: function (obj) { return "columns" in obj; }, get: function (obj) { return obj.columns; }, set: function (obj, value) { obj.columns = value; } }, metadata: _metadata }, _columns_initializers, _columns_extraInitializers);
            __esDecorate(null, null, _includeEnrollments_decorators, { kind: "field", name: "includeEnrollments", static: false, private: false, access: { has: function (obj) { return "includeEnrollments" in obj; }, get: function (obj) { return obj.includeEnrollments; }, set: function (obj, value) { obj.includeEnrollments = value; } }, metadata: _metadata }, _includeEnrollments_initializers, _includeEnrollments_extraInitializers);
            __esDecorate(null, null, _template_decorators, { kind: "field", name: "template", static: false, private: false, access: { has: function (obj) { return "template" in obj; }, get: function (obj) { return obj.template; }, set: function (obj, value) { obj.template = value; } }, metadata: _metadata }, _template_initializers, _template_extraInitializers);
            __esDecorate(null, null, _mode_decorators, { kind: "field", name: "mode", static: false, private: false, access: { has: function (obj) { return "mode" in obj; }, get: function (obj) { return obj.mode; }, set: function (obj, value) { obj.mode = value; } }, metadata: _metadata }, _mode_initializers, _mode_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ExportStudentsDto = ExportStudentsDto;
