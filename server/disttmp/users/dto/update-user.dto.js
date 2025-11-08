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
exports.UpdateUserDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var client_1 = require("@prisma/client");
var UpdateUserDto = function () {
    var _a;
    var _email_decorators;
    var _email_initializers = [];
    var _email_extraInitializers = [];
    var _username_decorators;
    var _username_initializers = [];
    var _username_extraInitializers = [];
    var _name_decorators;
    var _name_initializers = [];
    var _name_extraInitializers = [];
    var _password_decorators;
    var _password_initializers = [];
    var _password_extraInitializers = [];
    var _systemRole_decorators;
    var _systemRole_initializers = [];
    var _systemRole_extraInitializers = [];
    var _preferredLang_decorators;
    var _preferredLang_initializers = [];
    var _preferredLang_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpdateUserDto() {
                this.email = __runInitializers(this, _email_initializers, void 0);
                this.username = (__runInitializers(this, _email_extraInitializers), __runInitializers(this, _username_initializers, void 0));
                this.name = (__runInitializers(this, _username_extraInitializers), __runInitializers(this, _name_initializers, void 0));
                this.password = (__runInitializers(this, _name_extraInitializers), __runInitializers(this, _password_initializers, void 0));
                this.systemRole = (__runInitializers(this, _password_extraInitializers), __runInitializers(this, _systemRole_initializers, void 0));
                this.preferredLang = (__runInitializers(this, _systemRole_extraInitializers), __runInitializers(this, _preferredLang_initializers, void 0));
                __runInitializers(this, _preferredLang_extraInitializers);
            }
            return UpdateUserDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _email_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'john.doe@example.com' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEmail)()];
            _username_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'jdoe' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(64)];
            _name_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'John Doe' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(150)];
            _password_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'newpassword123', minLength: 6 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MinLength)(6)];
            _systemRole_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    enum: client_1.SystemRole,
                    example: client_1.SystemRole.SUPERADMIN,
                    description: 'Povoleno měnit pouze SUPERADMINovi',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.SystemRole)];
            _preferredLang_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'en-US' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(10)];
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } }, metadata: _metadata }, _email_initializers, _email_extraInitializers);
            __esDecorate(null, null, _username_decorators, { kind: "field", name: "username", static: false, private: false, access: { has: function (obj) { return "username" in obj; }, get: function (obj) { return obj.username; }, set: function (obj, value) { obj.username = value; } }, metadata: _metadata }, _username_initializers, _username_extraInitializers);
            __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } }, metadata: _metadata }, _name_initializers, _name_extraInitializers);
            __esDecorate(null, null, _password_decorators, { kind: "field", name: "password", static: false, private: false, access: { has: function (obj) { return "password" in obj; }, get: function (obj) { return obj.password; }, set: function (obj, value) { obj.password = value; } }, metadata: _metadata }, _password_initializers, _password_extraInitializers);
            __esDecorate(null, null, _systemRole_decorators, { kind: "field", name: "systemRole", static: false, private: false, access: { has: function (obj) { return "systemRole" in obj; }, get: function (obj) { return obj.systemRole; }, set: function (obj, value) { obj.systemRole = value; } }, metadata: _metadata }, _systemRole_initializers, _systemRole_extraInitializers);
            __esDecorate(null, null, _preferredLang_decorators, { kind: "field", name: "preferredLang", static: false, private: false, access: { has: function (obj) { return "preferredLang" in obj; }, get: function (obj) { return obj.preferredLang; }, set: function (obj, value) { obj.preferredLang = value; } }, metadata: _metadata }, _preferredLang_initializers, _preferredLang_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdateUserDto = UpdateUserDto;
