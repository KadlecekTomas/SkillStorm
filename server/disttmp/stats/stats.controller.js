"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsController = exports.DEFAULT_STATS_OVERVIEW_SCOPE = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var permission_decorator_1 = require("src/modules/rbac/permission.decorator");
var client_1 = require("@prisma/client");
var stats_overview_query_dto_1 = require("./dto/stats-overview-query.dto");
var no_http_cache_interceptor_1 = require("src/common/interceptors/no-http-cache.interceptor");
exports.DEFAULT_STATS_OVERVIEW_SCOPE = 'evaluated';
var StatsController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Stats'), (0, swagger_1.ApiBearerAuth)(), (0, common_1.Controller)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _overview_decorators;
    var _student_decorators;
    var _teacher_decorators;
    var StatsController = _classThis = /** @class */ (function () {
        function StatsController_1(service) {
            this.service = (__runInitializers(this, _instanceExtraInitializers), service);
        }
        // ⚠️ odstraněno @CacheTTL(0)
        StatsController_1.prototype.overview = function (req, query) {
            var _a;
            var organizationId = req.user.organizationId;
            // tvrdá sanitizace: cokoliv mimo 'all' => 'evaluated'
            var raw = ((_a = query === null || query === void 0 ? void 0 : query.scope) !== null && _a !== void 0 ? _a : '').toString().trim().toLowerCase();
            var scope = (raw === 'all' ? 'all' : 'evaluated');
            return this.service.getOrgOverview(organizationId, req.user, scope);
        };
        // ⚠️ odstraněno @CacheTTL(0)
        StatsController_1.prototype.student = function (req) {
            var _a = req.user, membershipId = _a.membershipId, organizationId = _a.organizationId;
            return this.service.getStudentDashboard({ membershipId: membershipId, organizationId: organizationId }, req.user);
        };
        // ⚠️ odstraněno @CacheTTL(0)
        StatsController_1.prototype.teacher = function (req) {
            var _a = req.user, membershipId = _a.membershipId, organizationId = _a.organizationId;
            return this.service.getTeacherDashboard({ membershipId: membershipId, organizationId: organizationId }, req.user);
        };
        return StatsController_1;
    }());
    __setFunctionName(_classThis, "StatsController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _overview_decorators = [(0, common_1.UseInterceptors)(no_http_cache_interceptor_1.NoHttpCacheInterceptor), (0, common_1.Get)('stats/overview'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.VIEW_RESULTS), (0, swagger_1.ApiOperation)({
                summary: 'Organization overview (tests, submissions, averages)',
            }), (0, swagger_1.ApiQuery)({
                name: 'scope',
                required: false,
                enum: Object.values(stats_overview_query_dto_1.OverviewScope),
                description: 'How passRate is computed. "evaluated" = APPROVED/(APPROVED+REJECTED). "all" = APPROVED/ALL (incl. PENDING). Default: evaluated.',
            })];
        _student_decorators = [(0, common_1.UseInterceptors)(no_http_cache_interceptor_1.NoHttpCacheInterceptor), (0, common_1.Get)('dashboards/student'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.VIEW_RESULTS), (0, swagger_1.ApiOperation)({ summary: 'Student dashboard (my progress)' })];
        _teacher_decorators = [(0, common_1.UseInterceptors)(no_http_cache_interceptor_1.NoHttpCacheInterceptor), (0, common_1.Get)('dashboards/teacher'), (0, permission_decorator_1.Permission)(client_1.PermissionKey.VIEW_RESULTS), (0, swagger_1.ApiOperation)({ summary: 'Teacher dashboard (my classes/tests/performance)' })];
        __esDecorate(_classThis, null, _overview_decorators, { kind: "method", name: "overview", static: false, private: false, access: { has: function (obj) { return "overview" in obj; }, get: function (obj) { return obj.overview; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _student_decorators, { kind: "method", name: "student", static: false, private: false, access: { has: function (obj) { return "student" in obj; }, get: function (obj) { return obj.student; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _teacher_decorators, { kind: "method", name: "teacher", static: false, private: false, access: { has: function (obj) { return "teacher" in obj; }, get: function (obj) { return obj.teacher; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        StatsController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return StatsController = _classThis;
}();
exports.StatsController = StatsController;
