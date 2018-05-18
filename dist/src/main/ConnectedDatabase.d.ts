import * as mysql from "mysql";
import * as sd from "schema-decorator";
import { QueryValues } from "./QueryValues";
import { OrderByItem } from "./OrderByItem";
import { PaginationConfiguration, RawPaginationArgs } from "./pagination";
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
export declare class ConnectedDatabase {
    private useUtcOnly;
    private connection;
    private paginationConfiguration;
    constructor(useUtcOnly: boolean, connection?: mysql.PoolConnection | undefined);
    setConnection(connection: mysql.PoolConnection): void;
    getConnection(): mysql.PoolConnection;
    releaseConnection(): void;
    queryFormat(query: string, values: QueryValues): string;
    rawQuery(queryStr: string, queryValues: QueryValues | undefined, callback: (err: mysql.MysqlError | null, results?: any, fields?: mysql.FieldInfo[]) => void): mysql.Query;
    selectAny(queryStr: string, queryValues?: QueryValues): Promise<SelectResult<any>>;
    select<T>(assert: sd.AssertFunc<T>, queryStr: string, queryValues?: QueryValues): Promise<SelectResult<T>>;
    selectAll<T>(assert: sd.AssertFunc<T>, table: string): Promise<SelectResult<T>>;
    selectOneAny(queryStr: string, queryValues?: QueryValues): Promise<SelectOneResult<any>>;
    selectOne<T>(assert: sd.AssertFunc<T>, queryStr: string, queryValues?: QueryValues): Promise<SelectOneResult<T>>;
    selectZeroOrOneAny(queryStr: string, queryValues?: QueryValues): Promise<SelectZeroOrOneResult<any>>;
    selectZeroOrOne<T>(assert: sd.AssertFunc<T>, queryStr: string, queryValues?: QueryValues): Promise<SelectZeroOrOneResult<T>>;
    insertAny<T extends QueryValues>(table: string, row: T): Promise<InsertResult<T>>;
    insert<T extends QueryValues>(assert: sd.AssertFunc<T>, table: string, row: T): Promise<InsertResult<T>>;
    rawUpdate(queryStr: string, queryValues: QueryValues): Promise<MysqlUpdateResult>;
    updateAny<T extends QueryValues, ConditionT extends QueryValues>(table: string, row: T, condition: ConditionT): Promise<UpdateResult<T, ConditionT>>;
    update<T extends QueryValues, ConditionT extends QueryValues>(assertRow: sd.AssertFunc<T>, assertCondition: sd.AssertFunc<ConditionT>, table: string, row: T, condition: ConditionT): Promise<UpdateResult<T, ConditionT>>;
    updateByNumberId<T extends QueryValues>(assert: sd.AssertFunc<T>, table: string, row: T, id: number): Promise<InsertResult<T>>;
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
    selectPaginated<T>(assert: sd.AssertFunc<T>, queryStr: string, queryValues?: QueryValues, rawPaginationArgs?: RawPaginationArgs): Promise<SelectPaginatedResult<T>>;
    simpleSelectZeroOrOne<T>(assert: sd.AssertFunc<T>, table: string, queryValues?: QueryValues): Promise<SelectZeroOrOneResult<T>>;
    simpleSelectOne<T>(assert: sd.AssertFunc<T>, table: string, queryValues?: QueryValues): Promise<SelectOneResult<T>>;
    simpleSelectPaginated<T>(assert: sd.AssertFunc<T>, table: string, orderBy: OrderByItem[], queryValues?: QueryValues, rawPaginationArgs?: RawPaginationArgs): Promise<SelectPaginatedResult<T>>;
    escape(raw: any): void;
    isUtcOnly(): boolean;
}
