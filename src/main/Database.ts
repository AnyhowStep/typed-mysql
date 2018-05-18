import * as mysql from "mysql";
import {TypeUtil} from "@anyhowstep/type-util";
import * as sd from "schema-decorator";
import {PaginationConfiguration, RawPaginationArgs} from "./pagination";
import {UnsafeQuery} from "./UnsafeQuery";
import {ConnectedDatabase} from "./ConnectedDatabase";
import {QueryValues} from "./QueryValues";
import {OrderByItem} from "./OrderByItem";
import * as util from "./my-util";
import {
    SelectResult,
    SelectOneResult,
    SelectZeroOrOneResult,
    InsertResult,
    MysqlUpdateResult,
    UpdateResult,
    MysqlDeleteResult,
    SelectPaginatedResult,
} from "./ConnectedDatabase";

const __dummySelectResult : SelectResult<any>|undefined = undefined;
__dummySelectResult;
const __dummySelectOneResult : SelectOneResult<any>|undefined = undefined;
__dummySelectOneResult;
const __dummySelectZeroOrOneResult : SelectZeroOrOneResult<any>|undefined = undefined;
__dummySelectZeroOrOneResult;
const __dummyInsertResult : InsertResult<any>|undefined = undefined;
__dummyInsertResult;
const __dummyMySqlUpdateResult : MysqlUpdateResult|undefined = undefined;
__dummyMySqlUpdateResult;
const __dummyUpdateResult : UpdateResult<any, any>|undefined = undefined;
__dummyUpdateResult;
const __dummyMySqlDeleteResult : MysqlDeleteResult|undefined = undefined;
__dummyMySqlDeleteResult;
const __dummySelectPaginatedResult : SelectPaginatedResult<any>|undefined = undefined;
__dummySelectPaginatedResult;

export interface DatabaseArgs {
    host      : string;
    database  : string;
    charset?  : string; //Default UTF8_GENERAL_CI
    user      : string;
    password  : string;
    timezone? : string; //Default local
}


export function insertUnsafeQueries (query : string, values : any) : string {
    if (values == undefined) {
        return query;
    }
    const newQuery = query.replace(/\:(\w+)/g, (substring : string, key : string) => {
        if (values.hasOwnProperty(key)) {
            const raw = values[key];
            if (raw instanceof UnsafeQuery) {
                return raw.value;
            } else {
                return substring;
            }
        }
        throw new Error(`Expected a value for ${key} in query`);
    });
    if (newQuery == query) {
        return newQuery;
    } else {
        return insertUnsafeQueries(newQuery, values);
    }
}
export function createQueryFormatCallback (useUtcOnly : boolean) {
    return (query : string, values : any) : string => {
        if (values == undefined) {
            return query;
        }
        query = insertUnsafeQueries(query, values);
        const newQuery = query.replace(/\:(\w+)/g, (_substring : string, key : string) => {
            if (values.hasOwnProperty(key)) {
                return Database.Escape(values[key], useUtcOnly);
            }
            throw new Error(`Expected a value for ${key} in query`);
        });
        return newQuery;
    };
}

export class Database {
    private pool : mysql.Pool;
    private defaultConnection : ConnectedDatabase|undefined;
    private useUtcOnly : boolean = false;

    public allocatePoolConnection () {
        return new Promise<mysql.PoolConnection>((resolve, reject) => {
            this.pool.getConnection((err, connection) => {
                if (err != undefined) {
                    reject(err);
                    return;
                }
                connection.config.queryFormat = createQueryFormatCallback(this.useUtcOnly);
                if (this.useUtcOnly) {
                    connection.query(
                        "SET time_zone = :offset;",
                        {
                            offset : "+00:00",
                        },
                        (err) => {
                            if (err != undefined) {
                                reject(err);
                                return;
                            }
                            connection.config.timezone = "Z";
                            resolve(connection);
                        }
                    );
                } else {
                    resolve(connection);
                }
            });
        });
    }

    //TODO refactor to another package?
    private allocatingDefaultConnection = false;
    private onAllocateCallback : ({
        onAllocate : (allocated : mysql.PoolConnection) => void,
        onError : (err : Error) => void,
    })[] = [];
    public async getOrAllocateDefaultConnection () {
        if (this.defaultConnection == undefined) {
            if (this.allocatingDefaultConnection) {
                return new Promise<mysql.PoolConnection>((resolve, reject) => {
                    this.onAllocateCallback.push({
                        onAllocate : resolve,
                        onError : reject,
                    });
                });
            } else {
                this.allocatingDefaultConnection = true;
                return new Promise<mysql.PoolConnection>((resolve, reject) => {
                    this.allocatePoolConnection()
                        .then((allocated) => {
                            this.defaultConnection = new ConnectedDatabase(this.useUtcOnly, allocated);
                            this.allocatingDefaultConnection = false;

                            //We requested first, so we resolve first
                            resolve(allocated);
                            for (let callback of this.onAllocateCallback) {
                                callback.onAllocate(allocated);
                            }
                            this.onAllocateCallback = [];
                        })
                        .catch((err) => {
                            this.allocatingDefaultConnection = false;

                            //We requested first, so we reject first
                            reject(err);
                            for (let callback of this.onAllocateCallback) {
                                callback.onError(err);
                            }
                            this.onAllocateCallback = [];
                        });
                });
            }
        } else {
            return this.defaultConnection;
        }
    }
    public async utcOnly () : Promise<void> {
        this.useUtcOnly = true;
        if (this.defaultConnection == undefined) {
            await this.getOrAllocateDefaultConnection();
        } else {
            this.defaultConnection.releaseConnection();
            this.defaultConnection = undefined;
            await this.getOrAllocateDefaultConnection();
        }
    }

    public getDefaultConnection () : ConnectedDatabase {
        if (this.defaultConnection == undefined) {
            throw new Error(`Call connect() first, or use getOrAllocateDefaultConnection()`);
        }
        return this.defaultConnection;
    }
    public getRawConnection () : mysql.Connection {
        return this.getDefaultConnection().getConnection();
    }

    public constructor (args : DatabaseArgs) {
        const connectionConfig = {
            host     : args.host,
            database : args.database,
            charset  : TypeUtil.Coalesce<string>(args.charset, "UTF8_GENERAL_CI"),
            user     : args.user,
            password : args.password,
            timezone : TypeUtil.Coalesce<string>(args.timezone, "local"),
        };
        this.pool = mysql.createPool(connectionConfig);
    }
    //TODO Phase out
    public static InsertUnsafeQueries (query : string, values : any) : string {
        return insertUnsafeQueries(query, values);
    }
    public readonly queryFormat = (query : string, values : any) : string => {
        return this.getDefaultConnection().queryFormat(query, values);
    };
    public async connect () : Promise<void> {
        await this.getOrAllocateDefaultConnection();
    }
    public rawQuery (queryStr : string, queryValues : QueryValues|undefined, callback : (err: mysql.MysqlError | null, results?: any, fields?: mysql.FieldInfo[]) => void) {
        return this.getDefaultConnection().rawQuery(
            queryStr,
            queryValues,
            callback
        );
    }
    public selectAny (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().selectAny(queryStr, queryValues);
    }
    public async select<T> (
        assert       : sd.AssertFunc<T>,
        queryStr     : string,
        queryValues? : QueryValues
    ) {
        return this.getDefaultConnection().select(assert, queryStr, queryValues);
    }
    public async selectAll<T> (
        assert : sd.AssertFunc<T>,
        table  : string
    ) {
        return this.getDefaultConnection().selectAll(assert, table);
    }
    public async selectOneAny (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().selectOneAny(queryStr, queryValues);
    }
    public async selectOne<T> (
        assert       : sd.AssertFunc<T>,
        queryStr     : string,
        queryValues? : QueryValues
    ) {
        return this.getDefaultConnection().selectOne(assert, queryStr, queryValues);
    }
    public async selectZeroOrOneAny (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().selectZeroOrOneAny(queryStr, queryValues);
    }
    public async selectZeroOrOne<T> (
        assert       : sd.AssertFunc<T>,
        queryStr     : string,
        queryValues? : QueryValues
    ) {
        return this.getDefaultConnection().selectZeroOrOne(assert, queryStr, queryValues);
    }
    //TODO Phase out
    public static ToEqualsArray (queryValues : QueryValues) {
        return util.toEqualsArray(queryValues);
    }
    public static ToWhereEquals (queryValues : QueryValues) {
        return util.toWhereEquals(queryValues);
    }
    public static ToSet (queryValues : QueryValues) {
        return util.toSet(queryValues);
    }
    public static ToOrderBy (orderByArr : OrderByItem[]) {
        return util.toOrderBy(orderByArr);
    }
    public static ToInsert (queryValues : QueryValues) {
        return util.toInsert(queryValues);
    }
    public async insertAny<T extends QueryValues> (table : string, row : T) {
        return this.getDefaultConnection().insertAny(table, row);
    }
    public async insert<T extends QueryValues> (assert : sd.AssertFunc<T>, table : string, row : T) {
        return this.getDefaultConnection().insert(assert, table, row);
    }
    public async rawUpdate (
        queryStr : string,
        queryValues : QueryValues
    ) {
        return this.getDefaultConnection().rawUpdate(queryStr, queryValues);
    }
    public async updateAny<T extends QueryValues, ConditionT extends QueryValues> (
        table : string,
        row : T,
        condition : ConditionT
    ) {
        return this.getDefaultConnection().updateAny(table, row, condition);
    }
    public async update<T extends QueryValues, ConditionT extends QueryValues> (
        assertRow       : sd.AssertFunc<T>,
        assertCondition : sd.AssertFunc<ConditionT>,
        table : string,
        row : T,
        condition : ConditionT
    ) {
        return this.getDefaultConnection().update(assertRow, assertCondition, table, row, condition);
    }
    public async updateByNumberId<T extends QueryValues> (assert : sd.AssertFunc<T>, table : string, row : T, id : number) {
        return this.getDefaultConnection().updateByNumberId(assert, table, row, id);
    }
    public rawDelete (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().rawDelete(queryStr, queryValues);
    }
    //Too dangerous to call this without queryValues or with empty queryValues
    public delete (table : string, queryValues : QueryValues) {
        return this.getDefaultConnection().delete(table, queryValues);
    }
    public async getAny (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().getAny(queryStr, queryValues);
    }
    public async get<T> (assertion : sd.AssertDelegate<T>, queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().get(assertion, queryStr, queryValues);
    }
    public async getBoolean (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().getBoolean(queryStr, queryValues);
    }
    public async getNumber (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().getNumber(queryStr, queryValues);
    }
    public async getNaturalNumber (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().getNaturalNumber(queryStr, queryValues);
    }
    public async getString (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().getString(queryStr, queryValues);
    }
    public async getDate (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().getDate(queryStr, queryValues);
    }
    public async exists (table : string, queryValues : QueryValues) {
        return this.getDefaultConnection().exists(table, queryValues);
    }
    public async now () {
        return this.getDefaultConnection().now();
    }
    public static Escape (raw : any, toUTCIfDate : boolean = false) {
        return util.escape(raw, toUTCIfDate);
    }
    public static EscapeId (raw : string) {
        return mysql.escapeId(raw);
    }
    public async getArrayAny (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().getArrayAny(queryStr, queryValues);
    }
    public async getArray<T> (assertion : sd.AssertDelegate<T>, queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().getArray(assertion, queryStr, queryValues);
    }
    public async getBooleanArray (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().getBooleanArray(queryStr, queryValues);
    }
    public async getNumberArray (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().getNumberArray(queryStr, queryValues);
    }
    public async getNaturalNumberArray (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().getNaturalNumberArray(queryStr, queryValues);
    }
    public async getStringArray (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().getStringArray(queryStr, queryValues);
    }
    public async getDateArray (queryStr : string, queryValues? : QueryValues) {
        return this.getDefaultConnection().getDateArray(queryStr, queryValues);
    }
    //TODO Phase out
    public beginTransaction () {
        return this.getDefaultConnection().beginTransaction();
    }
    //TODO Phase out
    public rollback () {
        return this.getDefaultConnection().rollback();
    }
    //TODO Phase out
    public commit () {
        return this.getDefaultConnection().commit();
    }

    public getPaginationConfiguration () {
        return this.getDefaultConnection().getPaginationConfiguration();
    }
    public setPaginationConfiguration (paginationConfiguration : PaginationConfiguration) {
        return this.getDefaultConnection().setPaginationConfiguration(paginationConfiguration);
    }

    public async selectPaginated<T> (
        assert : sd.AssertFunc<T>,
        queryStr : string,
        queryValues? : QueryValues,
        rawPaginationArgs? : RawPaginationArgs
    ) {
        return this.getDefaultConnection().selectPaginated(
            assert,
            queryStr,
            queryValues,
            rawPaginationArgs
        );
    }

    public async simpleSelectZeroOrOne<T> (
        assert      : sd.AssertFunc<T>,
        table       : string,
        queryValues : QueryValues = {}
    ) {
        return this.getDefaultConnection().simpleSelectZeroOrOne(
            assert,
            table,
            queryValues
        );
    }
    public async simpleSelectOne<T> (
        assert      : sd.AssertFunc<T>,
        table       : string,
        queryValues : QueryValues = {}
    ) {
        return this.getDefaultConnection().simpleSelectOne(
            assert,
            table,
            queryValues
        );
    }
    public async simpleSelectPaginated<T> (
        assert      : sd.AssertFunc<T>,
        table       : string,
        orderBy     : OrderByItem[],
        queryValues : QueryValues = {},
        rawPaginationArgs? : RawPaginationArgs
    ) {
        return this.getDefaultConnection().simpleSelectPaginated(
            assert,
            table,
            orderBy,
            queryValues,
            rawPaginationArgs
        );
    }
    public escape (raw : any) {
        this.getDefaultConnection().escape(raw);
    }

    public async transaction (callback : (db : ConnectedDatabase) => Promise<void>) {
        const allocated = new ConnectedDatabase(
            this.useUtcOnly,
            await this.allocatePoolConnection()
        );
        allocated.setPaginationConfiguration(this.getPaginationConfiguration());

        await allocated.beginTransaction();
        await callback(allocated);
        await allocated.commit();
        allocated.releaseConnection();
    }
}
