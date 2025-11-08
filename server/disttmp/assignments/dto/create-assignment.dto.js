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
exports.CreateAssignmentDto = void 0;
// src/assignments/dto/create-assignment.dto.ts
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var CreateAssignmentDto = function () {
    var _a;
    var _organizationId_decorators;
    var _organizationId_initializers = [];
    var _organizationId_extraInitializers = [];
    var _testId_decorators;
    var _testId_initializers = [];
    var _testId_extraInitializers = [];
    var _targetType_decorators;
    var _targetType_initializers = [];
    var _targetType_extraInitializers = [];
    var _studentIds_decorators;
    var _studentIds_initializers = [];
    var _studentIds_extraInitializers = [];
    var _classSectionId_decorators;
    var _classSectionId_initializers = [];
    var _classSectionId_extraInitializers = [];
    var _topicLevelId_decorators;
    var _topicLevelId_initializers = [];
    var _topicLevelId_extraInitializers = [];
    var _openAt_decorators;
    var _openAt_initializers = [];
    var _openAt_extraInitializers = [];
    var _closeAt_decorators;
    var _closeAt_initializers = [];
    var _closeAt_extraInitializers = [];
    var _maxAttempts_decorators;
    var _maxAttempts_initializers = [];
    var _maxAttempts_extraInitializers = [];
    var _timeLimitSec_decorators;
    var _timeLimitSec_initializers = [];
    var _timeLimitSec_extraInitializers = [];
    var _shuffle_decorators;
    var _shuffle_initializers = [];
    var _shuffle_extraInitializers = [];
    var _showExplain_decorators;
    var _showExplain_initializers = [];
    var _showExplain_extraInitializers = [];
    var _createdById_decorators;
    var _createdById_initializers = [];
    var _createdById_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateAssignmentDto() {
                this.organizationId = __runInitializers(this, _organizationId_initializers, void 0);
                this.testId = (__runInitializers(this, _organizationId_extraInitializers), __runInitializers(this, _testId_initializers, void 0));
                this.targetType = (__runInitializers(this, _testId_extraInitializers), __runInitializers(this, _targetType_initializers, void 0)); // "CLASS" | "STUDENTS"
                this.studentIds = (__runInitializers(this, _targetType_extraInitializers), __runInitializers(this, _studentIds_initializers, void 0));
                this.classSectionId = (__runInitializers(this, _studentIds_extraInitializers), __runInitializers(this, _classSectionId_initializers, void 0));
                this.topicLevelId = (__runInitializers(this, _classSectionId_extraInitializers), __runInitializers(this, _topicLevelId_initializers, void 0));
                this.openAt = (__runInitializers(this, _topicLevelId_extraInitializers), __runInitializers(this, _openAt_initializers, void 0));
                this.closeAt = (__runInitializers(this, _openAt_extraInitializers), __runInitializers(this, _closeAt_initializers, void 0));
                this.maxAttempts = (__runInitializers(this, _closeAt_extraInitializers), __runInitializers(this, _maxAttempts_initializers, void 0));
                this.timeLimitSec = (__runInitializers(this, _maxAttempts_extraInitializers), __runInitializers(this, _timeLimitSec_initializers, void 0));
                this.shuffle = (__runInitializers(this, _timeLimitSec_extraInitializers), __runInitializers(this, _shuffle_initializers, void 0));
                this.showExplain = (__runInitializers(this, _shuffle_extraInitializers), __runInitializers(this, _showExplain_initializers, void 0));
                this.createdById = (__runInitializers(this, _showExplain_extraInitializers), __runInitializers(this, _createdById_initializers, void 0));
                __runInitializers(this, _createdById_extraInitializers);
            }
            return CreateAssignmentDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _organizationId_decorators = [(0, class_validator_1.IsUUID)()];
            _testId_decorators = [(0, class_validator_1.IsUUID)()];
            _targetType_decorators = [(0, class_validator_1.IsString)()];
            _studentIds_decorators = [(0, class_validator_1.ValidateIf)(function (o) { return o.targetType === 'STUDENTS'; }), (0, class_validator_1.IsArray)(), (0, class_validator_1.ArrayNotEmpty)(), (0, class_validator_1.IsUUID)('all', { each: true })];
            _classSectionId_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)()];
            _topicLevelId_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)()];
            _openAt_decorators = [(0, class_transformer_1.Type)(function () { return Date; }), (0, class_validator_1.IsDate)()];
            _closeAt_decorators = [(0, class_transformer_1.Type)(function () { return Date; }), (0, class_validator_1.IsDate)()];
            _maxAttempts_decorators = [(0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1)];
            _timeLimitSec_decorators = [(0, class_validator_1.IsOptional)(), (0, class_validator_1.IsInt)()];
            _shuffle_decorators = [(0, class_validator_1.IsBoolean)()];
            _showExplain_decorators = [(0, class_validator_1.IsString)()];
            _createdById_decorators = [(0, class_validator_1.IsUUID)()];
            __esDecorate(null, null, _organizationId_decorators, { kind: "field", name: "organizationId", static: false, private: false, access: { has: function (obj) { return "organizationId" in obj; }, get: function (obj) { return obj.organizationId; }, set: function (obj, value) { obj.organizationId = value; } }, metadata: _metadata }, _organizationId_initializers, _organizationId_extraInitializers);
            __esDecorate(null, null, _testId_decorators, { kind: "field", name: "testId", static: false, private: false, access: { has: function (obj) { return "testId" in obj; }, get: function (obj) { return obj.testId; }, set: function (obj, value) { obj.testId = value; } }, metadata: _metadata }, _testId_initializers, _testId_extraInitializers);
            __esDecorate(null, null, _targetType_decorators, { kind: "field", name: "targetType", static: false, private: false, access: { has: function (obj) { return "targetType" in obj; }, get: function (obj) { return obj.targetType; }, set: function (obj, value) { obj.targetType = value; } }, metadata: _metadata }, _targetType_initializers, _targetType_extraInitializers);
            __esDecorate(null, null, _studentIds_decorators, { kind: "field", name: "studentIds", static: false, private: false, access: { has: function (obj) { return "studentIds" in obj; }, get: function (obj) { return obj.studentIds; }, set: function (obj, value) { obj.studentIds = value; } }, metadata: _metadata }, _studentIds_initializers, _studentIds_extraInitializers);
            __esDecorate(null, null, _classSectionId_decorators, { kind: "field", name: "classSectionId", static: false, private: false, access: { has: function (obj) { return "classSectionId" in obj; }, get: function (obj) { return obj.classSectionId; }, set: function (obj, value) { obj.classSectionId = value; } }, metadata: _metadata }, _classSectionId_initializers, _classSectionId_extraInitializers);
            __esDecorate(null, null, _topicLevelId_decorators, { kind: "field", name: "topicLevelId", static: false, private: false, access: { has: function (obj) { return "topicLevelId" in obj; }, get: function (obj) { return obj.topicLevelId; }, set: function (obj, value) { obj.topicLevelId = value; } }, metadata: _metadata }, _topicLevelId_initializers, _topicLevelId_extraInitializers);
            __esDecorate(null, null, _openAt_decorators, { kind: "field", name: "openAt", static: false, private: false, access: { has: function (obj) { return "openAt" in obj; }, get: function (obj) { return obj.openAt; }, set: function (obj, value) { obj.openAt = value; } }, metadata: _metadata }, _openAt_initializers, _openAt_extraInitializers);
            __esDecorate(null, null, _closeAt_decorators, { kind: "field", name: "closeAt", static: false, private: false, access: { has: function (obj) { return "closeAt" in obj; }, get: function (obj) { return obj.closeAt; }, set: function (obj, value) { obj.closeAt = value; } }, metadata: _metadata }, _closeAt_initializers, _closeAt_extraInitializers);
            __esDecorate(null, null, _maxAttempts_decorators, { kind: "field", name: "maxAttempts", static: false, private: false, access: { has: function (obj) { return "maxAttempts" in obj; }, get: function (obj) { return obj.maxAttempts; }, set: function (obj, value) { obj.maxAttempts = value; } }, metadata: _metadata }, _maxAttempts_initializers, _maxAttempts_extraInitializers);
            __esDecorate(null, null, _timeLimitSec_decorators, { kind: "field", name: "timeLimitSec", static: false, private: false, access: { has: function (obj) { return "timeLimitSec" in obj; }, get: function (obj) { return obj.timeLimitSec; }, set: function (obj, value) { obj.timeLimitSec = value; } }, metadata: _metadata }, _timeLimitSec_initializers, _timeLimitSec_extraInitializers);
            __esDecorate(null, null, _shuffle_decorators, { kind: "field", name: "shuffle", static: false, private: false, access: { has: function (obj) { return "shuffle" in obj; }, get: function (obj) { return obj.shuffle; }, set: function (obj, value) { obj.shuffle = value; } }, metadata: _metadata }, _shuffle_initializers, _shuffle_extraInitializers);
            __esDecorate(null, null, _showExplain_decorators, { kind: "field", name: "showExplain", static: false, private: false, access: { has: function (obj) { return "showExplain" in obj; }, get: function (obj) { return obj.showExplain; }, set: function (obj, value) { obj.showExplain = value; } }, metadata: _metadata }, _showExplain_initializers, _showExplain_extraInitializers);
            __esDecorate(null, null, _createdById_decorators, { kind: "field", name: "createdById", static: false, private: false, access: { has: function (obj) { return "createdById" in obj; }, get: function (obj) { return obj.createdById; }, set: function (obj, value) { obj.createdById = value; } }, metadata: _metadata }, _createdById_initializers, _createdById_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateAssignmentDto = CreateAssignmentDto;
