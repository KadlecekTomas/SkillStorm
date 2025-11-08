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
exports.QueryLearningMaterialsDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var client_1 = require("@prisma/client");
var QueryLearningMaterialsDto = function () {
    var _a;
    var _page_decorators;
    var _page_initializers = [];
    var _page_extraInitializers = [];
    var _limit_decorators;
    var _limit_initializers = [];
    var _limit_extraInitializers = [];
    var _search_decorators;
    var _search_initializers = [];
    var _search_extraInitializers = [];
    var _educationLevel_decorators;
    var _educationLevel_initializers = [];
    var _educationLevel_extraInitializers = [];
    var _schoolGrade_decorators;
    var _schoolGrade_initializers = [];
    var _schoolGrade_extraInitializers = [];
    var _scope_decorators;
    var _scope_initializers = [];
    var _scope_extraInitializers = [];
    var _contentType_decorators;
    var _contentType_initializers = [];
    var _contentType_extraInitializers = [];
    var _organizationId_decorators;
    var _organizationId_initializers = [];
    var _organizationId_extraInitializers = [];
    var _subjectId_decorators;
    var _subjectId_initializers = [];
    var _subjectId_extraInitializers = [];
    var _topicLevelId_decorators;
    var _topicLevelId_initializers = [];
    var _topicLevelId_extraInitializers = [];
    return _a = /** @class */ (function () {
            function QueryLearningMaterialsDto() {
                this.page = __runInitializers(this, _page_initializers, 1);
                this.limit = (__runInitializers(this, _page_extraInitializers), __runInitializers(this, _limit_initializers, 20));
                this.search = (__runInitializers(this, _limit_extraInitializers), __runInitializers(this, _search_initializers, void 0));
                this.educationLevel = (__runInitializers(this, _search_extraInitializers), __runInitializers(this, _educationLevel_initializers, void 0));
                this.schoolGrade = (__runInitializers(this, _educationLevel_extraInitializers), __runInitializers(this, _schoolGrade_initializers, void 0));
                this.scope = (__runInitializers(this, _schoolGrade_extraInitializers), __runInitializers(this, _scope_initializers, void 0));
                this.contentType = (__runInitializers(this, _scope_extraInitializers), __runInitializers(this, _contentType_initializers, void 0));
                this.organizationId = (__runInitializers(this, _contentType_extraInitializers), __runInitializers(this, _organizationId_initializers, void 0));
                this.subjectId = (__runInitializers(this, _organizationId_extraInitializers), __runInitializers(this, _subjectId_initializers, void 0));
                this.topicLevelId = (__runInitializers(this, _subjectId_extraInitializers), __runInitializers(this, _topicLevelId_initializers, void 0));
                __runInitializers(this, _topicLevelId_extraInitializers);
            }
            return QueryLearningMaterialsDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _page_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 1 }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Type)(function () { return Number; }), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1)];
            _limit_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 20 }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Type)(function () { return Number; }), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1)];
            _search_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Fulltext (title, description)',
                    example: 'Zlomky',
                }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return (typeof value === 'string' ? value.trim() : value);
                }), (0, class_validator_1.IsString)()];
            _educationLevel_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    enum: client_1.EducationLevel,
                    example: client_1.EducationLevel.PRIMARY_2,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.EducationLevel)];
            _schoolGrade_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    enum: client_1.SchoolGrade,
                    example: client_1.SchoolGrade.GRADE_5,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.SchoolGrade)];
            _scope_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Scope filtr (GLOBAL/ORGANIZATION/SHARED)',
                    enum: client_1.ContentScope,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.ContentScope)];
            _contentType_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    enum: client_1.ContentType,
                    example: client_1.ContentType.MATERIAL,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.ContentType)];
            _organizationId_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Org ID – povinné pro nesuperadmina při ORG obsahu',
                    example: '3b1b9f1b-6a6f-4a0d-9a33-3a27f7f6b9c1',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)('4')];
            _subjectId_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Subject ID (volitelné) – zúžení',
                    example: 'subject-uuid',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)('4')];
            _topicLevelId_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'TopicLevel ID (volitelné) – zúžení',
                    example: 'topic-level-uuid',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)('4')];
            __esDecorate(null, null, _page_decorators, { kind: "field", name: "page", static: false, private: false, access: { has: function (obj) { return "page" in obj; }, get: function (obj) { return obj.page; }, set: function (obj, value) { obj.page = value; } }, metadata: _metadata }, _page_initializers, _page_extraInitializers);
            __esDecorate(null, null, _limit_decorators, { kind: "field", name: "limit", static: false, private: false, access: { has: function (obj) { return "limit" in obj; }, get: function (obj) { return obj.limit; }, set: function (obj, value) { obj.limit = value; } }, metadata: _metadata }, _limit_initializers, _limit_extraInitializers);
            __esDecorate(null, null, _search_decorators, { kind: "field", name: "search", static: false, private: false, access: { has: function (obj) { return "search" in obj; }, get: function (obj) { return obj.search; }, set: function (obj, value) { obj.search = value; } }, metadata: _metadata }, _search_initializers, _search_extraInitializers);
            __esDecorate(null, null, _educationLevel_decorators, { kind: "field", name: "educationLevel", static: false, private: false, access: { has: function (obj) { return "educationLevel" in obj; }, get: function (obj) { return obj.educationLevel; }, set: function (obj, value) { obj.educationLevel = value; } }, metadata: _metadata }, _educationLevel_initializers, _educationLevel_extraInitializers);
            __esDecorate(null, null, _schoolGrade_decorators, { kind: "field", name: "schoolGrade", static: false, private: false, access: { has: function (obj) { return "schoolGrade" in obj; }, get: function (obj) { return obj.schoolGrade; }, set: function (obj, value) { obj.schoolGrade = value; } }, metadata: _metadata }, _schoolGrade_initializers, _schoolGrade_extraInitializers);
            __esDecorate(null, null, _scope_decorators, { kind: "field", name: "scope", static: false, private: false, access: { has: function (obj) { return "scope" in obj; }, get: function (obj) { return obj.scope; }, set: function (obj, value) { obj.scope = value; } }, metadata: _metadata }, _scope_initializers, _scope_extraInitializers);
            __esDecorate(null, null, _contentType_decorators, { kind: "field", name: "contentType", static: false, private: false, access: { has: function (obj) { return "contentType" in obj; }, get: function (obj) { return obj.contentType; }, set: function (obj, value) { obj.contentType = value; } }, metadata: _metadata }, _contentType_initializers, _contentType_extraInitializers);
            __esDecorate(null, null, _organizationId_decorators, { kind: "field", name: "organizationId", static: false, private: false, access: { has: function (obj) { return "organizationId" in obj; }, get: function (obj) { return obj.organizationId; }, set: function (obj, value) { obj.organizationId = value; } }, metadata: _metadata }, _organizationId_initializers, _organizationId_extraInitializers);
            __esDecorate(null, null, _subjectId_decorators, { kind: "field", name: "subjectId", static: false, private: false, access: { has: function (obj) { return "subjectId" in obj; }, get: function (obj) { return obj.subjectId; }, set: function (obj, value) { obj.subjectId = value; } }, metadata: _metadata }, _subjectId_initializers, _subjectId_extraInitializers);
            __esDecorate(null, null, _topicLevelId_decorators, { kind: "field", name: "topicLevelId", static: false, private: false, access: { has: function (obj) { return "topicLevelId" in obj; }, get: function (obj) { return obj.topicLevelId; }, set: function (obj, value) { obj.topicLevelId = value; } }, metadata: _metadata }, _topicLevelId_initializers, _topicLevelId_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.QueryLearningMaterialsDto = QueryLearningMaterialsDto;
