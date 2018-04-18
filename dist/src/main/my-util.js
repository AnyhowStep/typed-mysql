"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function zeroPad(n, length) {
    n = n.toString();
    while (n.length < length) {
        n = "0" + n;
    }
    return n;
}
exports.zeroPad = zeroPad;
//# sourceMappingURL=my-util.js.map