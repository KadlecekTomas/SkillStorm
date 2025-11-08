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
exports.StatsOverviewQueryDto = exports.OverviewScope = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var class_validator_1 = require("class-validator");
var OverviewScope;
(function (OverviewScope) {
    OverviewScope["EVALUATED"] = "evaluated";
    OverviewScope["ALL"] = "all";
})(OverviewScope || (exports.OverviewScope = OverviewScope = {}));
/**
 * Query DTO pro /stats/overview
 * Sanitizace: cokoliv mimo "all" => "evaluated".
 * Nepoužíváme IsEnum, aby ?scope=blabla nevrátilo 400.
 */
var StatsOverviewQueryDto = function () {
    var _a;
    var _scope_decorators;
    var _scope_initializers = [];
    var _scope_extraInitializers = [];
    return _a = /** @class */ (function () {
            function StatsOverviewQueryDto() {
                this.scope = __runInitializers(this, _scope_initializers, OverviewScope.EVALUATED);
                __runInitializers(this, _scope_extraInitializers);
            }
            return StatsOverviewQueryDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _scope_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    enum: OverviewScope,
                    default: OverviewScope.EVALUATED,
                    description: 'Jak počítat passRate. "evaluated" = APPROVED/(APPROVED+REJECTED). "all" = APPROVED/ALL (vč. PENDING).',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    var v = String(value !== null && value !== void 0 ? value : '')
                        .trim()
                        .toLowerCase();
                    return v === OverviewScope.ALL
                        ? OverviewScope.ALL
                        : OverviewScope.EVALUATED;
                })];
            __esDecorate(null, null, _scope_decorators, { kind: "field", name: "scope", static: false, private: false, access: { has: function (obj) { return "scope" in obj; }, get: function (obj) { return obj.scope; }, set: function (obj, value) { obj.scope = value; } }, metadata: _metadata }, _scope_initializers, _scope_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.StatsOverviewQueryDto = StatsOverviewQueryDto;
