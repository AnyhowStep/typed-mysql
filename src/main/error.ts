export class RowNotFoundError extends Error {
    constructor (message : string) {
        super(message);
        Object.setPrototypeOf(this, RowNotFoundError.prototype);
    }
}

export class TooManyRowsFoundError extends Error {
    readonly rowsFound : number;
    constructor (message : string, rowsFound : number) {
        super(message);
        Object.setPrototypeOf(this, TooManyRowsFoundError.prototype);
        this.rowsFound = rowsFound;
    }
}
