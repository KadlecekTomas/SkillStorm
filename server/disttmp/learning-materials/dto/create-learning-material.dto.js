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
exports.CreateLearningMaterialDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var client_1 = require("@prisma/client");
var CreateLearningMaterialDto = function () {
    var _a;
    var _title_decorators;
    var _title_initializers = [];
    var _title_extraInitializers = [];
    var _description_decorators;
    var _description_initializers = [];
    var _description_extraInitializers = [];
    var _contentType_decorators;
    var _contentType_initializers = [];
    var _contentType_extraInitializers = [];
    var _educationLevel_decorators;
    var _educationLevel_initializers = [];
    var _educationLevel_extraInitializers = [];
    var _schoolGrade_decorators;
    var _schoolGrade_initializers = [];
    var _schoolGrade_extraInitializers = [];
    var _subjectId_decorators;
    var _subjectId_initializers = [];
    var _subjectId_extraInitializers = [];
    var _topicLevelId_decorators;
    var _topicLevelId_initializers = [];
    var _topicLevelId_extraInitializers = [];
    var _scope_decorators;
    var _scope_initializers = [];
    var _scope_extraInitializers = [];
    var _organizationId_decorators;
    var _organizationId_initializers = [];
    var _organizationId_extraInitializers = [];
    var _accessLevel_decorators;
    var _accessLevel_initializers = [];
    var _accessLevel_extraInitializers = [];
    var _price_decorators;
    var _price_initializers = [];
    var _price_extraInitializers = [];
    var _isDownloadable_decorators;
    var _isDownloadable_initializers = [];
    var _isDownloadable_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateLearningMaterialDto() {
                this.title = __runInitializers(this, _title_initializers, void 0);
                this.description = (__runInitializers(this, _title_extraInitializers), __runInitializers(this, _description_initializers, void 0));
                this.contentType = (__runInitializers(this, _description_extraInitializers), __runInitializers(this, _contentType_initializers, void 0));
                this.educationLevel = (__runInitializers(this, _contentType_extraInitializers), __runInitializers(this, _educationLevel_initializers, void 0));
                this.schoolGrade = (__runInitializers(this, _educationLevel_extraInitializers), __runInitializers(this, _schoolGrade_initializers, void 0));
                this.subjectId = (__runInitializers(this, _schoolGrade_extraInitializers), __runInitializers(this, _subjectId_initializers, void 0));
                this.topicLevelId = (__runInitializers(this, _subjectId_extraInitializers), __runInitializers(this, _topicLevelId_initializers, void 0));
                this.scope = (__runInitializers(this, _topicLevelId_extraInitializers), __runInitializers(this, _scope_initializers, void 0));
                // organizationId je povinné pouze, pokud je scope ORGANIZATION (nechceme měnit DB)
                this.organizationId = (__runInitializers(this, _scope_extraInitializers), __runInitializers(this, _organizationId_initializers, void 0));
                this.accessLevel = (__runInitializers(this, _organizationId_extraInitializers), __runInitializers(this, _accessLevel_initializers, void 0));
                // price jen když accessLevel=PAID
                this.price = (__runInitializers(this, _accessLevel_extraInitializers), __runInitializers(this, _price_initializers, void 0));
                this.isDownloadable = (__runInitializers(this, _price_extraInitializers), __runInitializers(this, _isDownloadable_initializers, void 0));
                __runInitializers(this, _isDownloadable_extraInitializers);
            }
            return CreateLearningMaterialDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _title_decorators = [(0, swagger_1.ApiProperty)({ example: 'Zlomky – úvod' }), (0, class_validator_1.IsString)(), (0, class_validator_1.Length)(3, 255)];
            _description_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'Materiál vysvětluje základy zlomků.' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _contentType_decorators = [(0, swagger_1.ApiProperty)({
                    enum: client_1.ContentType,
                    example: client_1.ContentType.MATERIAL,
                }), (0, class_validator_1.IsEnum)(client_1.ContentType)];
            _educationLevel_decorators = [(0, swagger_1.ApiProperty)({
                    enum: client_1.EducationLevel,
                    example: client_1.EducationLevel.PRIMARY_2,
                }), (0, class_validator_1.IsEnum)(client_1.EducationLevel)];
            _schoolGrade_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    enum: client_1.SchoolGrade,
                    example: client_1.SchoolGrade.GRADE_5,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.SchoolGrade)];
            _subjectId_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Subject ID (volitelné)',
                    example: 'subject-uuid',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)('4')];
            _topicLevelId_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'TopicLevel ID (volitelné)',
                    example: 'topic-level-uuid',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)('4')];
            _scope_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    enum: client_1.ContentScope,
                    example: client_1.ContentScope.ORGANIZATION,
                    default: client_1.ContentScope.ORGANIZATION,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.ContentScope)];
            _organizationId_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Organization ID – povinné, pokud scope=ORGANIZATION',
                    example: 'organization-uuid',
                }), (0, class_validator_1.ValidateIf)(function (o) { var _b; return ((_b = o.scope) !== null && _b !== void 0 ? _b : client_1.ContentScope.ORGANIZATION) === client_1.ContentScope.ORGANIZATION; }), (0, class_validator_1.IsUUID)('4')];
            _accessLevel_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    enum: client_1.MaterialAccessLevel,
                    example: client_1.MaterialAccessLevel.FREE,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.MaterialAccessLevel)];
            _price_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 99.0 }), (0, class_validator_1.ValidateIf)(function (o) { return o.accessLevel === client_1.MaterialAccessLevel.PAID; }), (0, class_validator_1.IsNumber)()];
            _isDownloadable_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: true }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            __esDecorate(null, null, _title_decorators, { kind: "field", name: "title", static: false, private: false, access: { has: function (obj) { return "title" in obj; }, get: function (obj) { return obj.title; }, set: function (obj, value) { obj.title = value; } }, metadata: _metadata }, _title_initializers, _title_extraInitializers);
            __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: function (obj) { return "description" in obj; }, get: function (obj) { return obj.description; }, set: function (obj, value) { obj.description = value; } }, metadata: _metadata }, _description_initializers, _description_extraInitializers);
            __esDecorate(null, null, _contentType_decorators, { kind: "field", name: "contentType", static: false, private: false, access: { has: function (obj) { return "contentType" in obj; }, get: function (obj) { return obj.contentType; }, set: function (obj, value) { obj.contentType = value; } }, metadata: _metadata }, _contentType_initializers, _contentType_extraInitializers);
            __esDecorate(null, null, _educationLevel_decorators, { kind: "field", name: "educationLevel", static: false, private: false, access: { has: function (obj) { return "educationLevel" in obj; }, get: function (obj) { return obj.educationLevel; }, set: function (obj, value) { obj.educationLevel = value; } }, metadata: _metadata }, _educationLevel_initializers, _educationLevel_extraInitializers);
            __esDecorate(null, null, _schoolGrade_decorators, { kind: "field", name: "schoolGrade", static: false, private: false, access: { has: function (obj) { return "schoolGrade" in obj; }, get: function (obj) { return obj.schoolGrade; }, set: function (obj, value) { obj.schoolGrade = value; } }, metadata: _metadata }, _schoolGrade_initializers, _schoolGrade_extraInitializers);
            __esDecorate(null, null, _subjectId_decorators, { kind: "field", name: "subjectId", static: false, private: false, access: { has: function (obj) { return "subjectId" in obj; }, get: function (obj) { return obj.subjectId; }, set: function (obj, value) { obj.subjectId = value; } }, metadata: _metadata }, _subjectId_initializers, _subjectId_extraInitializers);
            __esDecorate(null, null, _topicLevelId_decorators, { kind: "field", name: "topicLevelId", static: false, private: false, access: { has: function (obj) { return "topicLevelId" in obj; }, get: function (obj) { return obj.topicLevelId; }, set: function (obj, value) { obj.topicLevelId = value; } }, metadata: _metadata }, _topicLevelId_initializers, _topicLevelId_extraInitializers);
            __esDecorate(null, null, _scope_decorators, { kind: "field", name: "scope", static: false, private: false, access: { has: function (obj) { return "scope" in obj; }, get: function (obj) { return obj.scope; }, set: function (obj, value) { obj.scope = value; } }, metadata: _metadata }, _scope_initializers, _scope_extraInitializers);
            __esDecorate(null, null, _organizationId_decorators, { kind: "field", name: "organizationId", static: false, private: false, access: { has: function (obj) { return "organizationId" in obj; }, get: function (obj) { return obj.organizationId; }, set: function (obj, value) { obj.organizationId = value; } }, metadata: _metadata }, _organizationId_initializers, _organizationId_extraInitializers);
            __esDecorate(null, null, _accessLevel_decorators, { kind: "field", name: "accessLevel", static: false, private: false, access: { has: function (obj) { return "accessLevel" in obj; }, get: function (obj) { return obj.accessLevel; }, set: function (obj, value) { obj.accessLevel = value; } }, metadata: _metadata }, _accessLevel_initializers, _accessLevel_extraInitializers);
            __esDecorate(null, null, _price_decorators, { kind: "field", name: "price", static: false, private: false, access: { has: function (obj) { return "price" in obj; }, get: function (obj) { return obj.price; }, set: function (obj, value) { obj.price = value; } }, metadata: _metadata }, _price_initializers, _price_extraInitializers);
            __esDecorate(null, null, _isDownloadable_decorators, { kind: "field", name: "isDownloadable", static: false, private: false, access: { has: function (obj) { return "isDownloadable" in obj; }, get: function (obj) { return obj.isDownloadable; }, set: function (obj, value) { obj.isDownloadable = value; } }, metadata: _metadata }, _isDownloadable_initializers, _isDownloadable_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateLearningMaterialDto = CreateLearningMaterialDto;
