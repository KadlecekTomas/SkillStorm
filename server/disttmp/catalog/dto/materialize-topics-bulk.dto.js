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
exports.MaterializeTopicsBulkDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var client_1 = require("@prisma/client");
var MaterializeTopicsBulkDto = function () {
    var _a;
    var _catalogSubjectId_decorators;
    var _catalogSubjectId_initializers = [];
    var _catalogSubjectId_extraInitializers = [];
    var _subjectLevelId_decorators;
    var _subjectLevelId_initializers = [];
    var _subjectLevelId_extraInitializers = [];
    var _catalogTopicIds_decorators;
    var _catalogTopicIds_initializers = [];
    var _catalogTopicIds_extraInitializers = [];
    var _defaultPhase_decorators;
    var _defaultPhase_initializers = [];
    var _defaultPhase_extraInitializers = [];
    var _defaultDifficulty_decorators;
    var _defaultDifficulty_initializers = [];
    var _defaultDifficulty_extraInitializers = [];
    var _appendAfter_decorators;
    var _appendAfter_initializers = [];
    var _appendAfter_extraInitializers = [];
    return _a = /** @class */ (function () {
            function MaterializeTopicsBulkDto() {
                this.catalogSubjectId = __runInitializers(this, _catalogSubjectId_initializers, void 0);
                this.subjectLevelId = (__runInitializers(this, _catalogSubjectId_extraInitializers), __runInitializers(this, _subjectLevelId_initializers, void 0));
                this.catalogTopicIds = (__runInitializers(this, _subjectLevelId_extraInitializers), __runInitializers(this, _catalogTopicIds_initializers, void 0));
                this.defaultPhase = (__runInitializers(this, _catalogTopicIds_extraInitializers), __runInitializers(this, _defaultPhase_initializers, void 0));
                this.defaultDifficulty = (__runInitializers(this, _defaultPhase_extraInitializers), __runInitializers(this, _defaultDifficulty_initializers, void 0));
                this.appendAfter = (__runInitializers(this, _defaultDifficulty_extraInitializers), __runInitializers(this, _appendAfter_initializers, void 0));
                __runInitializers(this, _appendAfter_extraInitializers);
            }
            return MaterializeTopicsBulkDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _catalogSubjectId_decorators = [(0, swagger_1.ApiProperty)({ example: 'catalog-subject-id-uuid' }), (0, class_validator_1.IsUUID)()];
            _subjectLevelId_decorators = [(0, swagger_1.ApiProperty)({ example: 'subject-level-id-uuid' }), (0, class_validator_1.IsUUID)()];
            _catalogTopicIds_decorators = [(0, swagger_1.ApiProperty)({
                    type: [String],
                    example: ['catalog-topic-id-1', 'catalog-topic-id-2'],
                }), (0, class_validator_1.IsArray)(), (0, class_validator_1.ArrayNotEmpty)(), (0, class_validator_1.IsUUID)('4', { each: true }), (0, class_transformer_1.Type)(function () { return String; })];
            _defaultPhase_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: client_1.TopicPhase, example: client_1.TopicPhase.INTRO }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.TopicPhase)];
            _defaultDifficulty_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: client_1.Difficulty, example: client_1.Difficulty.BASIC }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.Difficulty)];
            _appendAfter_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 100 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(0)];
            __esDecorate(null, null, _catalogSubjectId_decorators, { kind: "field", name: "catalogSubjectId", static: false, private: false, access: { has: function (obj) { return "catalogSubjectId" in obj; }, get: function (obj) { return obj.catalogSubjectId; }, set: function (obj, value) { obj.catalogSubjectId = value; } }, metadata: _metadata }, _catalogSubjectId_initializers, _catalogSubjectId_extraInitializers);
            __esDecorate(null, null, _subjectLevelId_decorators, { kind: "field", name: "subjectLevelId", static: false, private: false, access: { has: function (obj) { return "subjectLevelId" in obj; }, get: function (obj) { return obj.subjectLevelId; }, set: function (obj, value) { obj.subjectLevelId = value; } }, metadata: _metadata }, _subjectLevelId_initializers, _subjectLevelId_extraInitializers);
            __esDecorate(null, null, _catalogTopicIds_decorators, { kind: "field", name: "catalogTopicIds", static: false, private: false, access: { has: function (obj) { return "catalogTopicIds" in obj; }, get: function (obj) { return obj.catalogTopicIds; }, set: function (obj, value) { obj.catalogTopicIds = value; } }, metadata: _metadata }, _catalogTopicIds_initializers, _catalogTopicIds_extraInitializers);
            __esDecorate(null, null, _defaultPhase_decorators, { kind: "field", name: "defaultPhase", static: false, private: false, access: { has: function (obj) { return "defaultPhase" in obj; }, get: function (obj) { return obj.defaultPhase; }, set: function (obj, value) { obj.defaultPhase = value; } }, metadata: _metadata }, _defaultPhase_initializers, _defaultPhase_extraInitializers);
            __esDecorate(null, null, _defaultDifficulty_decorators, { kind: "field", name: "defaultDifficulty", static: false, private: false, access: { has: function (obj) { return "defaultDifficulty" in obj; }, get: function (obj) { return obj.defaultDifficulty; }, set: function (obj, value) { obj.defaultDifficulty = value; } }, metadata: _metadata }, _defaultDifficulty_initializers, _defaultDifficulty_extraInitializers);
            __esDecorate(null, null, _appendAfter_decorators, { kind: "field", name: "appendAfter", static: false, private: false, access: { has: function (obj) { return "appendAfter" in obj; }, get: function (obj) { return obj.appendAfter; }, set: function (obj, value) { obj.appendAfter = value; } }, metadata: _metadata }, _appendAfter_initializers, _appendAfter_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.MaterializeTopicsBulkDto = MaterializeTopicsBulkDto;
