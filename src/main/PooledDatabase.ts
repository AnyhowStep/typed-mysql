import * as mysql from "mysql";
import {coalesce} from "@anyhowstep/type-util";
import * as sd from "schema-decorator";
import {
    PaginationConfiguration,
    RawPaginationArgs,
    toPaginationArgs,
    getPaginationStart,
    calculatePagesFound
} from "./pagination";
import {QueryValues} from "./QueryValues";
import {OrderByItem} from "./OrderByItem";
import * as util from "./my-util";
import * as poolUtil from "./pool-util";
import {SingletonAllocator} from "./SingletonAllocator";

export interface SelectResult<T> {
    rows   : T[];
    fields : mysql.FieldInfo[];
}
export interface SelectOneResult<T> {
    row    : T;
    fields : mysql.FieldInfo[];
}
export interface SelectZeroOrOneResult<T> {
    row?   : T;
    fields : mysql.FieldInfo[];
}
export interface MysqlInsertResult {
    fieldCount   : number;
    affectedRows : number;
    insertId     : number;
    serverStatus : number;
    warningCount : number;
    message      : string;
    protocol41   : boolean;
    changedRows  : number;
}
export interface InsertResult<T> extends MysqlInsertResult {
    row : T;
}
export interface MysqlUpdateResult {
    fieldCount   : number;
    affectedRows : number;
    insertId     : number;
    serverStatus : number;
    warningCount : number;
    message      : string;
    protocol41   : boolean;
    changedRows  : number;
}
export interface UpdateResult<T, ConditionT> extends MysqlUpdateResult {
    row : T;
    condition : ConditionT;
}
export interface MysqlDeleteResult {
    fieldCount   : number;
    affectedRows : number;
    insertId     : number;
    serverStatus : number;
    warningCount : number;
    message      : string;
    protocol41   : boolean;
    changedRows  : number;
}
export interface SelectPaginatedInfo {
    itemsFound : number,
    pagesFound : number,
    page : number,
    itemsPerPage : number,
    fields : mysql.FieldInfo[],
}
export interface SelectPaginatedResult<T> {
    info : SelectPaginatedInfo,
    rows   : T[],
}


export interface RawQueryResult {
    query    : mysql.Query,
    results? : any,
    fields?  : mysql.FieldInfo[],
}

export interface PooledDatabaseData {
    useUtcOnly : boolean,
    paginationConfiguration : PaginationConfiguration,
}

export class PooledDatabase {
    private readonly pool : mysql.Pool;
    private readonly data : PooledDatabaseData;

    public getPool () {
        return this.pool;
    }
    protected getData () {
        return this.data;
    }

    public constructor (args : poolUtil.PoolArgs|mysql.Pool, data? : PooledDatabaseData) {
        this.pool = poolUtil.toPool(args);
        if (data == undefined) {
            data = {
                useUtcOnly : false,
                paginationConfiguration : new PaginationConfiguration(),
            };
        }
        this.data = {
            useUtcOnly : data.useUtcOnly,
            paginationConfiguration : {...data.paginationConfiguration},
        };
    }

    private readonly connection = new SingletonAllocator<mysql.PoolConnection, void>({
        onAllocate : () : Promise<mysql.PoolConnection> => {
            return poolUtil.allocatePoolConnection(this.pool, this.data.useUtcOnly);
        },
        onFree : (resource : mysql.PoolConnection) : void => {
            resource.release();
        }
    });
    public isUtcOnly () {
        return this.data.useUtcOnly;
    }
    public async utcOnly () : Promise<void> {
        this.data.useUtcOnly = true;
        if (!this.connection.isFree()) {
            this.connection.free();
        }
        await this.connection.getOrAllocate();
    }
    public escape (raw : any) {
        return util.escape(raw, this.isUtcOnly());
    }

    //The current connection
    public getConnectionOrError ()  {
        return this.connection.getOrError();
    }
    public getOrAllocateConnection () {
        return this.connection.getOrAllocate();
    }
    public isConnectionFree () {
        return this.connection.isFree();
    }
    public freeConnection () {
        return this.connection.free();
    }

    //Allocates a new PooledDatabase
    public allocate () {
        return new PooledDatabase(
            this.pool,
            this.data
        );
    }

    //Requires that a connection is already allocated
    public readonly queryFormat = async (query : string, values : any) : Promise<string> => {
        const connection = await this.getOrAllocateConnection();
        const queryFormat = connection.config.queryFormat;
        if (queryFormat == undefined) {
            throw new Error(`Could not get queryFormat() of connection`);
        }
        const result = queryFormat(query, values);
        if (typeof result != "string") {
            throw new Error(`Expected queryFormat result to be a string, received ${typeof result}`);
        }
        return result;
    };
    public async rawQuery (queryStr : string, queryValues : QueryValues|undefined) : Promise<RawQueryResult> {
        const connection = await this.getOrAllocateConnection();
        return new Promise<RawQueryResult>((resolve, reject) => {
            const query = connection.query(
                queryStr,
                queryValues,
                (err, results, fields) => {
                    if (err != undefined) {
                        reject(err);
                        return;
                    }
                    resolve({
                        query : query,
                        results : results,
                        fields : fields
                    });
                }
            )
        });
    }
    public selectAllAny (queryStr : string, queryValues? : QueryValues) : Promise<SelectResult<any>> {
        return this.rawQuery(queryStr, queryValues)
            .then(({results, fields}) => {
                if (results == undefined) {
                    throw new Error(`Expected results`);
                }
                if (fields == undefined) {
                    throw new Error(`Expected fields`);
                }
                if (!(results instanceof Array)) {
                    throw new Error(`Expected results to be an array`);
                }
                if (!(fields instanceof Array)) {
                    throw new Error(`Expected fields to be an array`);
                }

                return {
                    rows : results,
                    fields  : fields,
                };
            });
    }
    public async selectOneAny (queryStr : string, queryValues? : QueryValues) : Promise<SelectOneResult<any>>{
        return this.selectAllAny(queryStr, queryValues)
            .then(({rows, fields}) => {
                if (rows.length != 1) {
                    throw new Error(`Expected one result, received ${rows.length}`);
                }
                return {
                    row : rows[0],
                    fields : fields,
                }
            });
    }
    public async selectZeroOrOneAny (queryStr : string, queryValues? : QueryValues) : Promise<SelectZeroOrOneResult<any>> {
        return this.selectAllAny(queryStr, queryValues)
            .then(({rows, fields}) => {
                if (rows.length > 1) {
                    throw new Error(`Expected zero or one result, received ${rows.length}`);
                }
                if (rows.length == 0) {
                    return {
                        row : undefined,
                        fields : fields,
                    }
                } else {
                    return {
                        row : rows[0],
                        fields : fields,
                    }
                }
            });
    }
    public async selectAll<T> (
        assert       : sd.AssertFunc<T>,
        queryStr     : string,
        queryValues? : QueryValues
    ) : Promise<SelectResult<T>> {
        return this.selectAllAny(queryStr, queryValues)
            .then(({rows, fields}) => {
                const assertDelegate = sd.array(sd.toAssertDelegateExact(assert));
                const assertedRows = assertDelegate("results", rows);
                return {
                    rows : assertedRows,
                    fields : fields,
                }
            });
    }
    public async selectOne<T> (
        assert       : sd.AssertFunc<T>,
        queryStr     : string,
        queryValues? : QueryValues
    ) : Promise<SelectOneResult<T>> {
        return this.selectOneAny(queryStr, queryValues)
            .then(({row, fields}) => {
                const assertDelegate = sd.toAssertDelegateExact(assert);
                const assertedRow = assertDelegate("result", row);
                return {
                    row : assertedRow,
                    fields : fields,
                };
            });
    }
    public async selectZeroOrOne<T> (
        assert       : sd.AssertFunc<T>,
        queryStr     : string,
        queryValues? : QueryValues
    ) : Promise<SelectZeroOrOneResult<T>> {
        return this.selectZeroOrOneAny(queryStr, queryValues)
            .then(({row, fields}) => {
                if (row == undefined) {
                    return {
                        row : undefined,
                        fields : fields,
                    };
                }

                const assertDelegate = sd.toAssertDelegateExact(assert);
                const assertedRow = assertDelegate("result", row);
                return {
                    row : assertedRow,
                    fields : fields,
                };
            });
    }
    public async simpleSelectAll<T> (
        assert : sd.AssertFunc<T>,
        table  : string
    ) : Promise<SelectResult<T>> {
        return this.selectAll(
            assert,
            `
                SELECT
                    *
                FROM
                    ${mysql.escapeId(table)}
            `
        );
    }
    public async simpleSelectOne<T> (
        assert      : sd.AssertFunc<T>,
        table       : string,
        queryValues : QueryValues = {}
    ) {
        return this.selectOne(
            assert,
            `
                SELECT
                    *
                FROM
                    ${mysql.escapeId(table)}
                WHERE
                    ${util.toWhereEquals(queryValues)}
            `,
            queryValues
        );
    }
    public async simpleSelectZeroOrOne<T> (
        assert      : sd.AssertFunc<T>,
        table       : string,
        queryValues : QueryValues = {}
    ) {
        return this.selectZeroOrOne(
            assert,
            `
                SELECT
                    *
                FROM
                    ${mysql.escapeId(table)}
                WHERE
                    ${util.toWhereEquals(queryValues)}
            `,
            queryValues
        );
    }
    //Select Value
    public async selectValueAny (queryStr : string, queryValues? : QueryValues) : Promise<any> {
        return this.selectAllAny(queryStr, queryValues)
            .then(({rows, fields}) => {
                if (rows.length == 0) {
                    return undefined;
                }
                if (rows.length != 1) {
                    throw new Error(`Expected one result, received ${rows.length}`);
                }
                if (fields.length != 1) {
                    throw new Error(`Expected one field, received ${fields.length}`);
                }
                const fieldName = fields[0].name;
                const value = rows[0][fieldName];
                return value;
            });
    }
    public async selectValue<T> (assert : sd.AssertFunc<T>, queryStr : string, queryValues? : QueryValues) {
        return this.selectValueAny(queryStr, queryValues)
            .then((value) => {
                const assertDelegate = sd.toAssertDelegateExact(assert);
                return assertDelegate("value", value);
            });
    }
    public async selectBoolean (queryStr : string, queryValues? : QueryValues) {
        return this.selectValue(sd.numberToBoolean(), queryStr, queryValues);
    }
    public async selectNumber (queryStr : string, queryValues? : QueryValues) {
        return this.selectValue(sd.number(), queryStr, queryValues);
    }
    public async selectNaturalNumber (queryStr : string, queryValues? : QueryValues) {
        return this.selectValue(sd.naturalNumber(), queryStr, queryValues);
    }
    public async selectString (queryStr : string, queryValues? : QueryValues) {
        return this.selectValue(sd.string(), queryStr, queryValues);
    }
    public async selectDate (queryStr : string, queryValues? : QueryValues) {
        return this.selectValue(sd.date(), queryStr, queryValues);
    }
    public async exists (table : string, queryValues : QueryValues) {
        return this.selectBoolean(`
            SELECT EXISTS (
                SELECT
                    *
                FROM
                    ${mysql.escapeId(table)}
                WHERE
                    ${util.toWhereEquals(queryValues)}
            )
        `, queryValues);
    }
    public async now () {
        return this.selectDate(`SELECT NOW()`);
    }

    //Select Value Array
    public async selectValueArrayAny (queryStr : string, queryValues? : QueryValues) : Promise<any[]> {
        return this.selectAllAny(queryStr, queryValues)
            .then(({rows, fields}) => {
                if (fields.length != 1) {
                    throw new Error(`Expected one field, received ${fields.length}`);
                }
                const fieldName = fields[0].name;
                const result : any[] = [];
                for (let row of rows) {
                    const value = row[fieldName];
                    result.push(value);
                }
                return result;
            });
    }
    public async selectValueArray<T> (assert : sd.AssertFunc<T>, queryStr : string, queryValues? : QueryValues) {
        this.selectValueArrayAny(queryStr, queryValues)
            .then((anyArr) => {
                const assertDelegate = sd.toAssertDelegateExact(assert);
                const result : T[] = [];
                for (let raw of anyArr) {
                    const value = assertDelegate("raw", raw);
                    result.push(value);
                }
                return result;
            });
    }
    public async selectBooleanArray (queryStr : string, queryValues? : QueryValues) {
        return this.selectValueArray(sd.numberToBoolean(), queryStr, queryValues);
    }
    public async selectNumberArray (queryStr : string, queryValues? : QueryValues) {
        return this.selectValueArray(sd.number(), queryStr, queryValues);
    }
    public async selectNaturalNumberArray (queryStr : string, queryValues? : QueryValues) {
        return this.selectValueArray(sd.naturalNumber(), queryStr, queryValues);
    }
    public async selectStringArray (queryStr : string, queryValues? : QueryValues) {
        return this.selectValueArray(sd.string(), queryStr, queryValues);
    }
    public async selectDateArray (queryStr : string, queryValues? : QueryValues) {
        return this.selectValueArray(sd.date(), queryStr, queryValues);
    }

    //Transaction
    public beginTransaction () {
        return this.getOrAllocateConnection()
            .then((connection) => {
                return new Promise((resolve, reject) => {
                    connection.beginTransaction((err) => {
                        if (err == undefined) {
                            resolve();
                        } else {
                            reject(err);
                        }
                    })
                });
            });
    }
    public rollback () {
        return this.getOrAllocateConnection()
            .then((connection) => {
                return new Promise((resolve, reject) => {
                    connection.rollback((err) => {
                        if (err == undefined) {
                            resolve();
                        } else {
                            reject(err);
                        }
                    })
                });
            });
    }
    public commit () {
        return this.getOrAllocateConnection()
            .then((connection) => {
                return new Promise((resolve, reject) => {
                    connection.commit((err) => {
                        if (err == undefined) {
                            resolve();
                        } else {
                            reject(err);
                        }
                    })
                });
            });
    }
    //A shortcut to begin, and commit transactions.
    //Perform all your transactional queries in the callback.
    public async transaction (callback : (db : PooledDatabase) => Promise<void>) {
        const allocated = this.allocate();

        await allocated.beginTransaction();
        await callback(allocated)
            .then(async () => {
                await allocated.commit();
                allocated.freeConnection();
            })
            .catch(async (err) => {
                await allocated.rollback();
                allocated.freeConnection();
                throw err;
            });
    }

    //Pagination
    public getPaginationConfiguration () {
        return {...this.data.paginationConfiguration};
    }
    public setPaginationConfiguration (paginationConfiguration : PaginationConfiguration) {
        this.data.paginationConfiguration = sd.toClassExact(
            "paginationConfiguration",
            {...paginationConfiguration},
            PaginationConfiguration
        );
    }

    public async selectPaginated<T> (
        assert : sd.AssertFunc<T>,
        queryStr : string,
        queryValues? : QueryValues,
        rawPaginationArgs? : RawPaginationArgs
    ) : Promise<SelectPaginatedResult<T>> {
        const paginationArgs = toPaginationArgs(
            coalesce<RawPaginationArgs>(
                rawPaginationArgs,
                {}
            ),
            this.data.paginationConfiguration
        );

        if (queryStr.indexOf("SQL_CALC_FOUND_ROWS") < 0) {
            if (queryStr.indexOf(":__start") >= 0 || queryStr.indexOf(":__count") >= 0) {
                throw new Error(`Cannot specify :__start, and :__count, reserved for pagination queries`);
            }

            queryStr = queryStr
                .replace(`SELECT`, `SELECT SQL_CALC_FOUND_ROWS `)
                .concat(` LIMIT :__start, :__count`);
        } else {
            if (queryStr.indexOf(":__start") < 0 || queryStr.indexOf(":__count") < 0) {
                throw new Error(`You must specify both :__start, and :__count, for pagination queries since SQL_CALC_FOUND_ROWS was specified`);
            }
        }

        //We allocate a new connection because `SELECT FOUND_ROWS()`
        //is bound to the connection, it may be "polluted" by
        //other queries if we use the current connection
        const allocated = this.allocate();

        const page = await allocated.selectAll(
            assert,
            queryStr,
            {
                ...queryValues,
                __start : getPaginationStart(paginationArgs),
                __count : paginationArgs.itemsPerPage,
            }
        );
        const itemsFound = await allocated.selectNaturalNumber(`SELECT FOUND_ROWS()`);
        const pagesFound = calculatePagesFound(paginationArgs, itemsFound);

        return {
            info : {
                ...paginationArgs,
                itemsFound : itemsFound,
                pagesFound : pagesFound,
                fields : page.fields,
            },
            rows : page.rows,
        };
    }
    public async simpleSelectPaginated<T> (
        assert      : sd.AssertFunc<T>,
        table       : string,
        orderBy     : OrderByItem[],
        queryValues : QueryValues = {},
        rawPaginationArgs? : RawPaginationArgs
    ) {
        let where = util.toWhereEquals(queryValues);
        if (where == "") {
            where = "TRUE";
        }
        let orderByStr = util.toOrderBy(orderBy);
        if (orderByStr != "") {
            orderByStr = "ORDER BY " + orderByStr;
        }

        return this.selectPaginated(
            assert,
            `
                SELECT
                    *
                FROM
                    ${mysql.escapeId(table)}
                WHERE
                    ${where}
                ${orderByStr}
            `,
            queryValues,
            rawPaginationArgs
        );
    }

    //Insert
    public async rawInsert (queryStr : string, queryValues : QueryValues) : Promise<MysqlInsertResult> {
        return this.rawQuery(queryStr, queryValues)
            .then(({results}) => {
                if (results == undefined) {
                    throw new Error(`Expected a result`);
                };
                return results;
            });
    }
    public async insertAny (table : string, row : any) : Promise<InsertResult<any>> {
        const names = util.toInsert(row);

        return this.rawInsert(
            `
                INSERT INTO
                    ${mysql.escapeId(table)}
                VALUES (
                    ${names.keys}
                )
            `,
            row
        ).then((result) => {
            return {
                ...result,
                row : row,
            };
        });
    }
    public async insert<T extends QueryValues> (assert : sd.AssertFunc<T>, table : string, row : T) : Promise<InsertResult<T>> {
        row = sd.toAssertDelegateExact(assert)("row", row);
        return this.insertAny(table, row);
    }

    //Update
    public async rawUpdate (
        queryStr : string,
        queryValues : QueryValues
    ) : Promise<MysqlUpdateResult> {
        return this.rawQuery(queryStr, queryValues)
            .then(({results}) => {
                if (results == undefined) {
                    throw new Error(`Expected a result`);
                };
                return results;
            });
    }
    public async updateAny (
        table : string,
        row : any,
        condition : any
    ) : Promise<UpdateResult<any, any>> {
        if (Object.getOwnPropertyNames(condition).length == 0) {
            throw new Error(`Expected at least one query value; if you want to update everything, consider rawUpdate()`);
        }

        const set = await this.queryFormat(util.toSet(row), row);
        if (set == "") {
            return {
                fieldCount   : 0,
                affectedRows : -1, //-1 because we don't know
                insertId     : 0,
                serverStatus : 0,
                warningCount : 1,
                message      : "SET clause is empty; no updates occurred",
                protocol41   : false,
                changedRows  : 0,
                row : row,
                condition : condition,
            };
        }

        let where = await this.queryFormat(util.toWhereEquals(condition), condition);
        if (where == "") {
            where = "TRUE";
        }

        const queryStr = `
            UPDATE
                ${mysql.escapeId(table)}
            SET
                ${set}
            WHERE
                ${where}
        `;

        return this.rawUpdate(
            queryStr,
            {}
        ).then((result) => {
            return {
                ...result,
                row : row,
                condition : condition,
            };
        })
    }
    public async update<T extends QueryValues, ConditionT extends QueryValues> (
        assertRow       : sd.AssertFunc<T>,
        assertCondition : sd.AssertFunc<ConditionT>,
        table : string,
        row : T,
        condition : ConditionT
    ) : Promise<UpdateResult<T, ConditionT>> {
        //Just to be safe
        row       = sd.toAssertDelegateExact(assertRow)("new values", row);
        condition = sd.toAssertDelegateExact(assertCondition)("update condition", condition);

        return this.updateAny(table, row, condition);
    }

    //Delete
    public rawDelete (queryStr : string, queryValues? : QueryValues) : Promise<MysqlDeleteResult> {
        return this.rawQuery(queryStr, queryValues)
            .then(({results}) => {
                if (results == undefined) {
                    throw new Error(`Expected a result`);
                };
                return results;
            });
    }
    public delete (table : string, queryValues : QueryValues) : Promise<MysqlDeleteResult> {
        if (Object.getOwnPropertyNames(queryValues).length == 0) {
            throw new Error(`Expected at least one query value; if you want to delete everything, consider rawDelete()`);
        }
        const queryStr = `
            DELETE FROM
                ${mysql.escapeId(table)}
            WHERE
                ${util.toWhereEquals(queryValues)}
        `;
        return this.rawDelete(queryStr, queryValues);
    }
}
