"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./my-util"));
__export(require("./pagination"));
__export(require("./pool-util"));
__export(require("./PooledDatabase"));
__export(require("./SingletonAllocator"));
__export(require("./UnsafeQuery"));
var mysql_1 = require("mysql");
exports.escapeId = mysql_1.escapeId;
//# sourceMappingURL=index.js.map