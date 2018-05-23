import { QueryValues } from "./QueryValues";
import { OrderByItem } from "./OrderByItem";
export declare function zeroPad(n: number | string, length: number): string;
export declare function assertQueryKey(k: string): void;
export declare function toEqualsArray(queryValues: QueryValues): string[];
export declare function toWhereEquals(queryValues: QueryValues): string;
export declare function toSet(queryValues: QueryValues): string;
export declare function toOrderBy(orderByArr: OrderByItem[]): string;
export declare function toInsert(queryValues: QueryValues): {
    columns: string;
    keys: string;
};
export declare function escape(raw: any, toUTCIfDate?: boolean): string;
export declare function insertUnsafeQueries(query: string, values: any): string;
export declare function createQueryFormatDelegate(useUtcOnly: boolean): (query: string, values: any) => string;
