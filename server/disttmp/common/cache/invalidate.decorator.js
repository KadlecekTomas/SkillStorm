"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVALIDATE_SCOPES = void 0;
exports.InvalidateScopes = InvalidateScopes;
var common_1 = require("@nestjs/common");
exports.INVALIDATE_SCOPES = 'INVALIDATE_SCOPES';
function InvalidateScopes(scopes) {
    return (0, common_1.SetMetadata)(exports.INVALIDATE_SCOPES, scopes);
}
