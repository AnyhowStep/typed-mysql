import * as mysql from "mysql";
import * as sd from "schema-decorator";
import { PaginationConfiguration, RawPaginationArgs } from "./pagination";
export interface DatabaseArgs {
    host: string;
    database: string;
    charset?: string;
    user: string;
    password: string;
    timezone?: string;
}
export declare type QueryValues = {};
export interface SelectResult<T> {
    rows: T[];
    fields: mysql.FieldInfo[];
}
export interface SelectOneResult<T> {
    row: T;
    fields: mysql.FieldInfo[];
}
export interface SelectZeroOrOneResult<T> {
    row?: T;
    fields: mysql.FieldInfo[];
}
export interface MysqlInsertResult {
    fieldCount: number;
    affectedRows: number;
    insertId: number;
    serverStatus: number;
    warningCount: number;
    message: string;
    protocol41: boolean;
    changedRows: number;
}
export interface InsertResult<T> extends MysqlInsertResult {
    row: T;
}
export interface MysqlUpdateResult {
    fieldCount: number;
    affectedRows: number;
    insertId: number;
    serverStatus: number;
    warningCount: number;
    message: string;
    protocol41: boolean;
    changedRows: number;
}
export interface UpdateResult<T, ConditionT> extends MysqlUpdateResult {
    row: T;
    condition: ConditionT;
}
export interface MysqlDeleteResult {
    fieldCount: number;
    affectedRows: number;
    insertId: number;
    serverStatus: number;
    warningCount: number;
    message: string;
    protocol41: boolean;
    changedRows: number;
}
export declare class Id {
    id: number;
}
export declare function assertQueryKey(k: string): void;
export interface SelectPaginatedInfo {
    itemsFound: number;
    pagesFound: number;
    page: number;
    itemsPerPage: number;
}
export interface SelectPaginatedResult<T> {
    info: SelectPaginatedInfo;
    page: SelectResult<T>;
}
export declare class Database {
    private connection;
    private paginationConfiguration;
    constructor(args: DatabaseArgs);
    readonly queryFormat: (query: string, values: any) => string;
    getRawConnection(): mysql.Connection;
    connect(): Promise<void>;
    rawQuery(queryStr: string, queryValues: QueryValues | undefined, callback: (err: mysql.MysqlError | null, results?: any, fields?: mysql.FieldInfo[]) => void): mysql.Query;
    selectAny(queryStr: string, queryValues?: QueryValues): Promise<SelectResult<any>>;
    select<T>(ctor: {
        new (): T;
    }, queryStr: string, queryValues?: QueryValues): Promise<SelectResult<T>>;
    selectAll<T>(ctor: {
        new (): T;
    }, table: string): Promise<SelectResult<T>>;
    selectOneAny(queryStr: string, queryValues?: QueryValues): Promise<SelectOneResult<any>>;
    selectOne<T>(ctor: {
        new (): T;
    }, queryStr: string, queryValues?: QueryValues): Promise<SelectOneResult<T>>;
    selectZeroOrOneAny(queryStr: string, queryValues?: QueryValues): Promise<SelectZeroOrOneResult<any>>;
    selectZeroOrOne<T>(ctor: {
        new (): T;
    }, queryStr: string, queryValues?: QueryValues): Promise<SelectZeroOrOneResult<T>>;
    static ToEqualsArray(queryValues: QueryValues): string[];
    static ToWhereEquals(queryValues: QueryValues): string;
    static ToSet(queryValues: QueryValues): string;
    insert<T extends QueryValues>(ctor: {
        new (): T;
    }, table: string, row: T): Promise<InsertResult<T>>;
    update<T extends QueryValues, ConditionT extends QueryValues>(ctor: {
        new (): T;
    }, conditionCtor: {
        new (): ConditionT;
    }, table: string, row: T, condition: ConditionT): Promise<UpdateResult<T, ConditionT>>;
    updateByNumberId<T extends QueryValues>(ctor: {
        new (): T;
    }, table: string, row: T, id: number): Promise<InsertResult<T>>;
    rawDelete(queryStr: string, queryValues?: QueryValues): Promise<MysqlDeleteResult>;
    delete(table: string, queryValues: QueryValues): Promise<MysqlDeleteResult>;
    getAny(queryStr: string, queryValues?: QueryValues): Promise<any>;
    get<T>(assertion: sd.AssertDelegate<T>, queryStr: string, queryValues?: QueryValues): Promise<T>;
    getBoolean(queryStr: string, queryValues?: QueryValues): Promise<boolean>;
    getNumber(queryStr: string, queryValues?: QueryValues): Promise<number>;
    getNaturalNumber(queryStr: string, queryValues?: QueryValues): Promise<number>;
    getString(queryStr: string, queryValues?: QueryValues): Promise<string>;
    getDate(queryStr: string, queryValues?: QueryValues): Promise<Date>;
    exists(table: string, queryValues: QueryValues): Promise<boolean>;
    now(): Promise<Date>;
    static Escape(raw: any): string;
    static EscapeId(raw: string): string;
    getArrayAny(queryStr: string, queryValues?: QueryValues): Promise<any[]>;
    getArray<T>(assertion: sd.AssertDelegate<T>, queryStr: string, queryValues?: QueryValues): Promise<T[]>;
    getBooleanArray(queryStr: string, queryValues?: QueryValues): Promise<boolean[]>;
    getNumberArray(queryStr: string, queryValues?: QueryValues): Promise<number[]>;
    getNaturalNumberArray(queryStr: string, queryValues?: QueryValues): Promise<number[]>;
    getStringArray(queryStr: string, queryValues?: QueryValues): Promise<string[]>;
    getDateArray(queryStr: string, queryValues?: QueryValues): Promise<Date[]>;
    beginTransaction(): Promise<{}>;
    rollback(): Promise<{}>;
    commit(): Promise<{}>;
    getPaginationConfiguration(): {
        defaultPage: number;
        maxItemsPerPage: number;
        minItemsPerPage: number;
        defaultItemsPerPage: number;
    };
    setPaginationConfiguration(paginationConfiguration: PaginationConfiguration): void;
    selectPaginated<T>(ctor: {
        new (): T;
    }, queryStr: string, queryValues?: QueryValues, rawPaginationArgs?: RawPaginationArgs): Promise<SelectPaginatedResult<T>>;
    simpleSelectZeroOrOne<T>(ctor: {
        new (): T;
    }, table: string, queryValues?: QueryValues): Promise<SelectZeroOrOneResult<T>>;
    simpleSelectPaginated<T>(ctor: {
        new (): T;
    }, table: string, orderBy: string, queryValues?: QueryValues, rawPaginationArgs?: RawPaginationArgs): Promise<SelectPaginatedResult<T>>;
}
