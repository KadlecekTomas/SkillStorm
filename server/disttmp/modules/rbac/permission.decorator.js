"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permission = exports.PERMISSION_KEY = void 0;
var common_1 = require("@nestjs/common");
exports.PERMISSION_KEY = 'required_permissions';
var Permission = function () {
    var permissions = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        permissions[_i] = arguments[_i];
    }
    return (0, common_1.SetMetadata)(exports.PERMISSION_KEY, permissions);
};
exports.Permission = Permission;
