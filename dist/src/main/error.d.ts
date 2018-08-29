export declare class RowNotFoundError extends Error {
    constructor(message: string);
}
export declare class TooManyRowsFoundError extends Error {
    readonly rowsFound: number;
    constructor(message: string, rowsFound: number);
}
