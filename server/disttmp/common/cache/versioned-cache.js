"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GLOBAL_SCOPE = void 0;
exports.versionKey = versionKey;
exports.getVersion = getVersion;
exports.bumpVersion = bumpVersion;
exports.bumpMany = bumpMany;
exports.stableStringify = stableStringify;
exports.listKey = listKey;
exports.detailKey = detailKey;
exports.cacheGetOrSet = cacheGetOrSet;
exports.versionedList = versionedList;
exports.versionedDetail = versionedDetail;
exports.GLOBAL_SCOPE = 'GLOBAL:ALL';
function versionKey(scopeId) {
    return "ver:".concat(scopeId);
}
function getVersion(cache, scopeId) {
    return __awaiter(this, void 0, void 0, function () {
        var v;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cache.get(versionKey(scopeId))];
                case 1:
                    v = _a.sent();
                    return [2 /*return*/, v !== null && v !== void 0 ? v : 1];
            }
        });
    });
}
function bumpVersion(cache, scopeId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cache.set(versionKey(scopeId), Date.now(), 0)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function bumpMany(cache, scopeIds) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.all(scopeIds.map(function (s) { return bumpVersion(cache, s); }))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function stableStringify(obj) {
    if (obj == null)
        return '';
    if (typeof obj !== 'object')
        return String(obj);
    var entries = Object.entries(obj)
        .sort(function (_a, _b) {
        var a = _a[0];
        var b = _b[0];
        return a.localeCompare(b);
    })
        .map(function (_a) {
        var k = _a[0], v = _a[1];
        return "".concat(k, ":").concat(stableStringify(v));
    });
    return "{".concat(entries.join(','), "}");
}
function listKey(opts) {
    var _a, _b, _c;
    var p = (_a = opts.page) !== null && _a !== void 0 ? _a : 1;
    var l = (_b = opts.limit) !== null && _b !== void 0 ? _b : 20;
    var s = ((_c = opts.search) !== null && _c !== void 0 ? _c : '').trim().toLowerCase();
    return [
        "".concat(opts.ns, ":list"),
        "v".concat(opts.ver),
        "scope:".concat(opts.scope),
        "p".concat(p),
        "l".concat(l),
        "q:".concat(s),
        "ord:".concat(stableStringify(opts.order)),
        "f:".concat(stableStringify(opts.filters)),
    ].join(':');
}
function detailKey(opts) {
    return "".concat(opts.ns, ":detail:v").concat(opts.ver, ":scope:").concat(opts.scope, ":id:").concat(opts.id);
}
function cacheGetOrSet(cache, key, ttlMs, fetcher) {
    return __awaiter(this, void 0, void 0, function () {
        var hit, fresh;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cache.get(key)];
                case 1:
                    hit = _a.sent();
                    if (hit !== undefined && hit !== null)
                        return [2 /*return*/, hit];
                    return [4 /*yield*/, fetcher()];
                case 2:
                    fresh = _a.sent();
                    return [4 /*yield*/, cache.set(key, fresh, ttlMs)];
                case 3:
                    _a.sent();
                    return [2 /*return*/, fresh];
            }
        });
    });
}
// Convenience
function versionedList(cache, ns, scope, ttlMs, args, fetcher) {
    return __awaiter(this, void 0, void 0, function () {
        var ver, key;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVersion(cache, scope)];
                case 1:
                    ver = _a.sent();
                    key = listKey(__assign({ ns: ns, scope: scope, ver: ver }, args));
                    return [2 /*return*/, cacheGetOrSet(cache, key, ttlMs, fetcher)];
            }
        });
    });
}
function versionedDetail(cache, ns, id, scope, ttlMs, fetcher) {
    return __awaiter(this, void 0, void 0, function () {
        var ver, key;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVersion(cache, scope)];
                case 1:
                    ver = _a.sent();
                    key = detailKey({ ns: ns, id: id, scope: scope, ver: ver });
                    return [2 /*return*/, cacheGetOrSet(cache, key, ttlMs, fetcher)];
            }
        });
    });
}
