import * as mysql from "mysql";
import * as sd from "schema-decorator";
import { PaginationConfiguration, RawPaginationArgs } from "./pagination";
import { QueryValues } from "./QueryValues";
import { OrderByItem } from "./OrderByItem";
import * as poolUtil from "./pool-util";
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
export interface SelectPaginatedInfo {
    itemsFound: number;
    pagesFound: number;
    page: number;
    itemsPerPage: number;
    fields: mysql.FieldInfo[];
}
export interface SelectPaginatedResult<T> {
    info: SelectPaginatedInfo;
    rows: T[];
}
export interface RawQueryResult {
    query: mysql.Query;
    results?: any;
    fields?: mysql.FieldInfo[];
}
export interface PooledDatabaseData {
    useUtcOnly: boolean;
    paginationConfiguration: PaginationConfiguration;
}
export declare class PooledDatabase {
    private readonly pool;
    private readonly data;
    getPool(): mysql.Pool;
    protected getData(): PooledDatabaseData;
    constructor(args: poolUtil.PoolArgs | mysql.Pool, data?: PooledDatabaseData);
    private readonly connection;
    isUtcOnly(): boolean;
    utcOnly(): Promise<void>;
    escape(raw: any): string;
    getConnectionOrError(): mysql.PoolConnection;
    getOrAllocateConnection(): Promise<mysql.PoolConnection>;
    isConnectionFree(): boolean;
    freeConnection(): void;
    allocate(): PooledDatabase;
    private acquiredTemporary;
    isAcquiredTemporary(): boolean;
    acquire<ResultT>(callback: (db: PooledDatabase) => Promise<ResultT>): Promise<ResultT>;
    acquireIfNotTemporary<ResultT>(callback: (db: PooledDatabase) => Promise<ResultT>): Promise<ResultT>;
    getOrAllocateConnectionTemporary<ResultT>(callback: (connection: mysql.PoolConnection) => Promise<ResultT>): Promise<ResultT>;
    readonly queryFormat: (query: string, values: any) => Promise<string>;
    rawQuery(queryStr: string, queryValues: QueryValues | undefined): Promise<RawQueryResult>;
    selectAllAny(queryStr: string, queryValues?: QueryValues): Promise<SelectResult<any>>;
    selectOneAny(queryStr: string, queryValues?: QueryValues): Promise<SelectOneResult<any>>;
    selectZeroOrOneAny(queryStr: string, queryValues?: QueryValues): Promise<SelectZeroOrOneResult<any>>;
    selectAll<T>(assert: sd.AssertFunc<T>, queryStr: string, queryValues?: QueryValues): Promise<SelectResult<T>>;
    selectOne<T>(assert: sd.AssertFunc<T>, queryStr: string, queryValues?: QueryValues): Promise<SelectOneResult<T>>;
    selectZeroOrOne<T>(assert: sd.AssertFunc<T>, queryStr: string, queryValues?: QueryValues): Promise<SelectZeroOrOneResult<T>>;
    simpleSelectAll<T>(assert: sd.AssertFunc<T>, table: string): Promise<SelectResult<T>>;
    simpleSelectOne<T>(assert: sd.AssertFunc<T>, table: string, queryValues?: QueryValues): Promise<SelectOneResult<T>>;
    simpleSelectZeroOrOne<T>(assert: sd.AssertFunc<T>, table: string, queryValues?: QueryValues): Promise<SelectZeroOrOneResult<T>>;
    selectValueAny(queryStr: string, queryValues?: QueryValues): Promise<any>;
    selectValue<T>(assert: sd.AssertFunc<T>, queryStr: string, queryValues?: QueryValues): Promise<T>;
    selectBoolean(queryStr: string, queryValues?: QueryValues): Promise<boolean>;
    selectNumber(queryStr: string, queryValues?: QueryValues): Promise<number>;
    selectNaturalNumber(queryStr: string, queryValues?: QueryValues): Promise<number>;
    selectString(queryStr: string, queryValues?: QueryValues): Promise<string>;
    selectDate(queryStr: string, queryValues?: QueryValues): Promise<Date>;
    exists(table: string, queryValues: QueryValues): Promise<boolean>;
    now(): Promise<Date>;
    selectValueArrayAny(queryStr: string, queryValues?: QueryValues): Promise<any[]>;
    selectValueArray<T>(assert: sd.AssertFunc<T>, queryStr: string, queryValues?: QueryValues): Promise<void>;
    selectBooleanArray(queryStr: string, queryValues?: QueryValues): Promise<void>;
    selectNumberArray(queryStr: string, queryValues?: QueryValues): Promise<void>;
    selectNaturalNumberArray(queryStr: string, queryValues?: QueryValues): Promise<void>;
    selectStringArray(queryStr: string, queryValues?: QueryValues): Promise<void>;
    selectDateArray(queryStr: string, queryValues?: QueryValues): Promise<void>;
    private inTransaction;
    isInTransaction(): boolean;
    beginTransaction(): Promise<{}>;
    rollback(): Promise<{}>;
    commit(): Promise<{}>;
    transaction<ResultT>(callback: (db: PooledDatabase) => Promise<ResultT>): Promise<ResultT>;
    transactionIfNotInOne<ResultT>(callback: (db: PooledDatabase) => Promise<ResultT>): Promise<ResultT>;
    getPaginationConfiguration(): {
        defaultPage: number;
        maxItemsPerPage: number;
        minItemsPerPage: number;
        defaultItemsPerPage: number;
    };
    setPaginationConfiguration(paginationConfiguration: PaginationConfiguration): void;
    selectPaginated<T>(assert: sd.AssertFunc<T>, queryStr: string, queryValues?: QueryValues, rawPaginationArgs?: RawPaginationArgs): Promise<SelectPaginatedResult<T>>;
    simpleSelectPaginated<T>(assert: sd.AssertFunc<T>, table: string, orderBy: OrderByItem[], queryValues?: QueryValues, rawPaginationArgs?: RawPaginationArgs): Promise<SelectPaginatedResult<T>>;
    rawInsert(queryStr: string, queryValues: QueryValues): Promise<MysqlInsertResult>;
    insertAny(table: string, row: any): Promise<InsertResult<any>>;
    insert<T extends QueryValues>(assert: sd.AssertFunc<T>, table: string, row: T): Promise<InsertResult<T>>;
    rawUpdate(queryStr: string, queryValues: QueryValues): Promise<MysqlUpdateResult>;
    updateAny(table: string, row: any, condition: any): Promise<UpdateResult<any, any>>;
    update<T extends QueryValues, ConditionT extends QueryValues>(assertRow: sd.AssertFunc<T>, assertCondition: sd.AssertFunc<ConditionT>, table: string, row: T, condition: ConditionT): Promise<UpdateResult<T, ConditionT>>;
    rawDelete(queryStr: string, queryValues?: QueryValues): Promise<MysqlDeleteResult>;
    delete(table: string, queryValues: QueryValues): Promise<MysqlDeleteResult>;
}
