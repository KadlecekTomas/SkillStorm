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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
var core_1 = require("@nestjs/core");
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var app_module_1 = require("./app.module");
var prisma_service_1 = require("./prisma/prisma.service");
var client_1 = require("@prisma/client");
var zod_1 = require("zod");
var bootstrap_search_all_1 = require("./db/bootstrap-search-all");
/**
 * Jednotný exception filter:
 * - HttpException vrací, jak je
 * - ZodError → 400
 * - PrismaKnownError → 400/404/409 podle kódu
 * - fallback → 500
 */
var AllExceptionsFilter = function () {
    var _classDecorators = [(0, common_1.Catch)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AllExceptionsFilter = _classThis = /** @class */ (function () {
        function AllExceptionsFilter_1() {
        }
        AllExceptionsFilter_1.prototype.catch = function (exception, host) {
            var _a;
            var ctx = host.switchToHttp();
            var res = ctx.getResponse();
            if (exception instanceof common_1.HttpException) {
                var status_1 = exception.getStatus();
                var body = exception.getResponse();
                return res
                    .status(status_1)
                    .json(typeof body === 'string' ? { message: body } : body);
            }
            if (exception instanceof zod_1.ZodError) {
                return res.status(common_1.HttpStatus.BAD_REQUEST).json({
                    statusCode: 400,
                    message: 'Validation failed',
                    issues: exception.issues,
                });
            }
            if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                switch (exception.code) {
                    case 'P2002': // unique violation
                        return res.status(common_1.HttpStatus.CONFLICT).json({
                            statusCode: 409,
                            message: 'Unique constraint failed',
                            meta: exception.meta,
                        });
                    case 'P2003': // foreign key
                        return res.status(common_1.HttpStatus.BAD_REQUEST).json({
                            statusCode: 400,
                            message: 'Foreign key constraint failed',
                            meta: exception.meta,
                        });
                    case 'P2025': // not found
                        return res.status(common_1.HttpStatus.NOT_FOUND).json({
                            statusCode: 404,
                            message: 'Record not found',
                            meta: exception.meta,
                        });
                }
            }
            return res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
                statusCode: 500,
                message: 'Internal Server Error',
                error: String((_a = exception === null || exception === void 0 ? void 0 : exception.message) !== null && _a !== void 0 ? _a : exception),
            });
        };
        return AllExceptionsFilter_1;
    }());
    __setFunctionName(_classThis, "AllExceptionsFilter");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AllExceptionsFilter = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AllExceptionsFilter = _classThis;
}();
/**
 * Společná factory – používej ji v prod (main) i v e2e testech.
 */
function createApp() {
    return __awaiter(this, void 0, void 0, function () {
        var app, corsOrigins, allowedOrigins, prisma, e_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, core_1.NestFactory.create(app_module_1.AppModule, {
                        logger: process.env.NODE_ENV === 'test' ? false : undefined,
                    })];
                case 1:
                    app = _c.sent();
                    corsOrigins = (_a = process.env.CORS_ORIGINS) !== null && _a !== void 0 ? _a : 'http://localhost:4200,http://localhost:3000';
                    allowedOrigins = corsOrigins
                        .split(',')
                        .map(function (origin) { return origin.trim(); })
                        .filter(Boolean);
                    app.enableCors({
                        origin: allowedOrigins.length ? allowedOrigins : '*',
                        credentials: true,
                        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                        allowedHeaders: [
                            'Content-Type',
                            'Authorization',
                            'X-Requested-With',
                            'Accept',
                        ],
                    });
                    app.useGlobalPipes(new common_1.ValidationPipe({
                        whitelist: true,
                        forbidNonWhitelisted: true,
                        transform: true,
                    }));
                    app.useGlobalFilters(new AllExceptionsFilter());
                    if (!(process.env.NODE_ENV !== 'test' &&
                        process.env.DISABLE_BOOTSTRAP_SEARCH !== '1')) return [3 /*break*/, 5];
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 4, , 5]);
                    prisma = app.get(prisma_service_1.PrismaService);
                    return [4 /*yield*/, (0, bootstrap_search_all_1.bootstrapSearchAll)(prisma)];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _c.sent();
                    console.error('bootstrapSearchAll failed:', (_b = e_1 === null || e_1 === void 0 ? void 0 : e_1.message) !== null && _b !== void 0 ? _b : e_1);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/, app];
            }
        });
    });
}
/**
 * Produkční/dev bootstrap (spouští HTTP server).
 * V test módu se server nespouští – v e2e si zavolej `createApp()` + `app.init()`.
 */
function bootstrap() {
    return __awaiter(this, void 0, void 0, function () {
        var app, config, document_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, createApp()];
                case 1:
                    app = _b.sent();
                    if (!(process.env.NODE_ENV !== 'test')) return [3 /*break*/, 3];
                    config = new swagger_1.DocumentBuilder()
                        .setTitle('Test System API')
                        .setDescription('The test system API description')
                        .setVersion('1.0')
                        .addBearerAuth({
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        name: 'JWT',
                        in: 'header',
                    })
                        .build();
                    document_1 = swagger_1.SwaggerModule.createDocument(app, config);
                    swagger_1.SwaggerModule.setup('api', app, document_1);
                    return [4 /*yield*/, app.listen((_a = process.env.PORT) !== null && _a !== void 0 ? _a : 3001)];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 5];
                case 3: 
                // e2e: pouze inicializace bez otevření portu
                return [4 /*yield*/, app.init()];
                case 4:
                    // e2e: pouze inicializace bez otevření portu
                    _b.sent();
                    _b.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
bootstrap();
