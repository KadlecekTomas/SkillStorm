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
exports.QueryUsersDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var client_1 = require("@prisma/client");
var QueryUsersDto = function () {
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
    var _organizationId_decorators;
    var _organizationId_initializers = [];
    var _organizationId_extraInitializers = [];
    var _hasOrgRole_decorators;
    var _hasOrgRole_initializers = [];
    var _hasOrgRole_extraInitializers = [];
    var _orderBy_decorators;
    var _orderBy_initializers = [];
    var _orderBy_extraInitializers = [];
    var _orderDir_decorators;
    var _orderDir_initializers = [];
    var _orderDir_extraInitializers = [];
    return _a = /** @class */ (function () {
            function QueryUsersDto() {
                this.page = __runInitializers(this, _page_initializers, 1);
                this.limit = (__runInitializers(this, _page_extraInitializers), __runInitializers(this, _limit_initializers, 50));
                this.search = (__runInitializers(this, _limit_extraInitializers), __runInitializers(this, _search_initializers, void 0));
                this.organizationId = (__runInitializers(this, _search_extraInitializers), __runInitializers(this, _organizationId_initializers, void 0));
                this.hasOrgRole = (__runInitializers(this, _organizationId_extraInitializers), __runInitializers(this, _hasOrgRole_initializers, void 0));
                this.orderBy = (__runInitializers(this, _hasOrgRole_extraInitializers), __runInitializers(this, _orderBy_initializers, 'name'));
                this.orderDir = (__runInitializers(this, _orderBy_extraInitializers), __runInitializers(this, _orderDir_initializers, 'asc'));
                __runInitializers(this, _orderDir_extraInitializers);
            }
            return QueryUsersDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _page_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 1 }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Type)(function () { return Number; }), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1)];
            _limit_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 50 }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Type)(function () { return Number; }), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1)];
            _search_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Fulltext: name, email, username',
                    example: 'novak',
                }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return value === null || value === void 0 ? void 0 : value.trim();
                }), (0, class_validator_1.IsString)()];
            _organizationId_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Filtrovat dle organizace (povoleno jen SUPERADMINovi). Ředitel má implicitně vlastní org.',
                    example: 'organization-uuid',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)()];
            _hasOrgRole_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Filtrovat dle organizační role (přes Memberships)',
                    enum: client_1.OrganizationRole,
                    example: client_1.OrganizationRole.TEACHER,
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.OrganizationRole)];
            _orderBy_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Řazení podle pole',
                    enum: ['name', 'email', 'username', 'lastLoginAt'],
                    example: 'name',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _orderDir_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Směr řazení',
                    enum: ['asc', 'desc'],
                    example: 'asc',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _page_decorators, { kind: "field", name: "page", static: false, private: false, access: { has: function (obj) { return "page" in obj; }, get: function (obj) { return obj.page; }, set: function (obj, value) { obj.page = value; } }, metadata: _metadata }, _page_initializers, _page_extraInitializers);
            __esDecorate(null, null, _limit_decorators, { kind: "field", name: "limit", static: false, private: false, access: { has: function (obj) { return "limit" in obj; }, get: function (obj) { return obj.limit; }, set: function (obj, value) { obj.limit = value; } }, metadata: _metadata }, _limit_initializers, _limit_extraInitializers);
            __esDecorate(null, null, _search_decorators, { kind: "field", name: "search", static: false, private: false, access: { has: function (obj) { return "search" in obj; }, get: function (obj) { return obj.search; }, set: function (obj, value) { obj.search = value; } }, metadata: _metadata }, _search_initializers, _search_extraInitializers);
            __esDecorate(null, null, _organizationId_decorators, { kind: "field", name: "organizationId", static: false, private: false, access: { has: function (obj) { return "organizationId" in obj; }, get: function (obj) { return obj.organizationId; }, set: function (obj, value) { obj.organizationId = value; } }, metadata: _metadata }, _organizationId_initializers, _organizationId_extraInitializers);
            __esDecorate(null, null, _hasOrgRole_decorators, { kind: "field", name: "hasOrgRole", static: false, private: false, access: { has: function (obj) { return "hasOrgRole" in obj; }, get: function (obj) { return obj.hasOrgRole; }, set: function (obj, value) { obj.hasOrgRole = value; } }, metadata: _metadata }, _hasOrgRole_initializers, _hasOrgRole_extraInitializers);
            __esDecorate(null, null, _orderBy_decorators, { kind: "field", name: "orderBy", static: false, private: false, access: { has: function (obj) { return "orderBy" in obj; }, get: function (obj) { return obj.orderBy; }, set: function (obj, value) { obj.orderBy = value; } }, metadata: _metadata }, _orderBy_initializers, _orderBy_extraInitializers);
            __esDecorate(null, null, _orderDir_decorators, { kind: "field", name: "orderDir", static: false, private: false, access: { has: function (obj) { return "orderDir" in obj; }, get: function (obj) { return obj.orderDir; }, set: function (obj, value) { obj.orderDir = value; } }, metadata: _metadata }, _orderDir_initializers, _orderDir_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.QueryUsersDto = QueryUsersDto;
