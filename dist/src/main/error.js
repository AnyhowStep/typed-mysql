"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RowNotFoundError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, RowNotFoundError.prototype);
    }
}
exports.RowNotFoundError = RowNotFoundError;
class TooManyRowsFoundError extends Error {
    constructor(message, rowsFound) {
        super(message);
        Object.setPrototypeOf(this, TooManyRowsFoundError.prototype);
        this.rowsFound = rowsFound;
    }
}
exports.TooManyRowsFoundError = TooManyRowsFoundError;
//# sourceMappingURL=error.js.map