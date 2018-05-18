import * as mysql from "mysql";
import * as sd from "schema-decorator";
import {QueryValues} from "./QueryValues";
import {OrderByItem} from "./OrderByItem";
import * as util from "./my-util";
import {PaginationConfiguration, RawPaginationArgs, toPaginationArgs, getPaginationStart} from "./pagination";
import {TypeUtil} from "@anyhowstep/type-util";

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
export class Id {
    @sd.assert(sd.naturalNumber())
    id : number = 0;
}
export interface SelectPaginatedInfo {
    itemsFound : number,
    pagesFound : number,
    page : number,
    itemsPerPage : number,
}
export interface SelectPaginatedResult<T> {
    info : SelectPaginatedInfo,
    page : SelectResult<T>
}

export class ConnectedDatabase {
    private useUtcOnly : boolean;
    private connection : mysql.PoolConnection|undefined;
    private paginationConfiguration : PaginationConfiguration = new PaginationConfiguration();

    public constructor (useUtcOnly : boolean, connection? : mysql.PoolConnection|undefined) {
        this.useUtcOnly = useUtcOnly;
        this.connection = connection;
    }

    public setConnection (connection : mysql.PoolConnection) {
        if (this.connection != undefined) {
            throw new Error(`Release the current connection first`);
        }
        this.connection = connection;
    }
    public getConnection () {
        if (this.connection == undefined) {
            throw new Error(`The connection has already been released; or not initialized yet`);
        }
        return this.connection;
    }
    public releaseConnection () {
        this.getConnection().release();
        this.connection = undefined;
    }

    public queryFormat (query: string, values: QueryValues) : string {
        const queryFormat = this.getConnection().config.queryFormat;
        if (queryFormat == undefined) {
            throw new Error(`This connection does not have a custom queryFormat`);
        } else {
            const formatted = queryFormat(query, values) as any;
            if (typeof formatted == "string") {
                return formatted;
            } else {
                throw new Error(`queryFormat must return string`);
            }
        }
    }
    public rawQuery (queryStr : string, queryValues : QueryValues|undefined, callback : (err: mysql.MysqlError | null, results?: any, fields?: mysql.FieldInfo[]) => void) {
        return this.getConnection().query(
            queryStr,
            queryValues,
            callback
        );
    }
    public selectAny (queryStr : string, queryValues? : QueryValues) : Promise<SelectResult<any>> {
        return new Promise<SelectResult<any>>((resolve, reject) => {
            this.rawQuery(
                queryStr,
                queryValues,
                (err, results? : any, fields? : mysql.FieldInfo[]) => {
                    if (err == undefined) {
                        if (results == undefined) {
                            reject(new Error(`Expected results`));
                            return;
                        }
                        if (fields == undefined) {
                            reject(new Error(`Expected fields`));
                            return;
                        }
                        if (!(results instanceof Array)) {
                            reject(new Error(`Expected results to be an array`));
                            return;
                        }
                        if (!(fields instanceof Array)) {
                            reject(new Error(`Expected fields to be an array`));
                            return;
                        }

                        resolve({
                            rows : results,
                            fields  : fields,
                        });
                    } else {
                        reject(err);
                    }
                }
            );
        });
    }
    public async select<T> (
        assert       : sd.AssertFunc<T>,
        queryStr     : string,
        queryValues? : QueryValues
    ) : Promise<SelectResult<T>> {
        const anyResult    = await this.selectAny(queryStr, queryValues);
        const assertion    = sd.array(sd.toAssertDelegateExact(assert));
        const assertedRows = assertion("results", anyResult.rows);
        return {
            rows   : assertedRows,
            fields : anyResult.fields,
        };
    }
    public async selectAll<T> (
        assert : sd.AssertFunc<T>,
        table  : string
    ) : Promise<SelectResult<T>> {
        return this.select(assert, `
            SELECT
                *
            FROM
                ${mysql.escapeId(table)}
        `);
    }
    public async selectOneAny (queryStr : string, queryValues? : QueryValues) : Promise<SelectOneResult<any>> {
        const result = await this.selectAny(queryStr, queryValues);
        if (result.rows.length != 1) {
            throw new Error(`Expected 1 row, received ${result.rows.length}`);
        }
        return {
            row    : result.rows[0],
            fields : result.fields,
        };
    }
    public async selectOne<T> (
        assert       : sd.AssertFunc<T>,
        queryStr     : string,
        queryValues? : QueryValues
    ) : Promise<SelectOneResult<T>> {
        const anyResult = await this.selectOneAny(queryStr, queryValues);
        const assertion   = sd.toAssertDelegateExact(assert);
        const assertedRow = assertion("result", anyResult.row);
        return {
            row    : assertedRow,
            fields : anyResult.fields,
        };
    }
    public async selectZeroOrOneAny (queryStr : string, queryValues? : QueryValues) : Promise<SelectZeroOrOneResult<any>> {
        const result = await this.selectAny(queryStr, queryValues);
        if (result.rows.length > 1) {
            throw new Error(`Expected zero or one rows, received ${result.rows.length}`);
        }
        if (result.rows.length == 0) {
            return {
                row    : undefined,
                fields : result.fields,
            };
        } else {
            return {
                row    : result.rows[0],
                fields : result.fields,
            };
        }
    }
    public async selectZeroOrOne<T> (
        assert       : sd.AssertFunc<T>,
        queryStr     : string,
        queryValues? : QueryValues
    ) : Promise<SelectZeroOrOneResult<T>> {
        const anyResult = await this.selectZeroOrOneAny(queryStr, queryValues);
        if (anyResult.row == undefined) {
            return anyResult;
        }
        const assertion   = sd.toAssertDelegateExact(assert);
        const assertedRow = assertion("result", anyResult.row);
        return {
            row    : assertedRow,
            fields : anyResult.fields,
        };
    }

    public async insertAny<T extends QueryValues> (table : string, row : T) : Promise<InsertResult<T>> {
        const names = util.toInsert(row);

        const queryStr = `
            INSERT INTO
                ${mysql.escapeId(table)} (${names.columns})
            VALUES (
                ${names.keys}
            )
        `;
        return new Promise<InsertResult<T>>((resolve, reject) => {
            this.rawQuery(
                queryStr,
                row,
                (err, result? : MysqlInsertResult) => {
                    if (err == undefined) {
                        if (result == undefined) {
                            reject(new Error(`Expected a result`))
                        } else {
                            resolve({
                                ...result,
                                row : row,
                            });
                        }
                    } else {
                        reject(err);
                    }
                }
            );
        });
    }
    public async insert<T extends QueryValues> (assert : sd.AssertFunc<T>, table : string, row : T) : Promise<InsertResult<T>> {
        //Just to be safe
        row = sd.toAssertDelegateExact(assert)("insert target", row);
        //TODO Seems like this line can be deleted...
        //const queryValues = sd.toRaw("insert target", row);

        return this.insertAny(table, row);
    }
    public async rawUpdate (
        queryStr : string,
        queryValues : QueryValues
    ) : Promise<MysqlUpdateResult> {
        return new Promise<MysqlUpdateResult>((resolve, reject) => {
            this.rawQuery(
                queryStr,
                queryValues,
                (err, result? : MysqlUpdateResult) => {
                    if (err == undefined) {
                        if (result == undefined) {
                            reject(new Error(`Expected a result`))
                        } else {
                            resolve(result);
                        }
                    } else {
                        reject(err);
                    }
                }
            );
        });
    }
    public async updateAny<T extends QueryValues, ConditionT extends QueryValues> (
        table : string,
        row : T,
        condition : ConditionT
    ) : Promise<UpdateResult<T, ConditionT>> {
        const set = this.queryFormat(util.toSet(row), row);

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

        let where = this.queryFormat(util.toWhereEquals(condition), condition);

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

        return this.rawUpdate(queryStr, {})
            .then((result) => {
                return {
                    ...result,
                    row : row,
                    condition : condition,
                };
            });
    }
    public async update<T extends QueryValues, ConditionT extends QueryValues> (
        assertRow       : sd.AssertFunc<T>,
        assertCondition : sd.AssertFunc<ConditionT>,
        table : string,
        row : T,
        condition : ConditionT
    ) : Promise<UpdateResult<T, ConditionT>> {
        //Just to be safe
        row       = sd.toAssertDelegateExact(assertRow)("update target", row);
        condition = sd.toAssertDelegateExact(assertCondition)("update condition", condition);

        return this.updateAny<T, ConditionT>(
            table,
            row,
            condition
        );
    }
    public async updateByNumberId<T extends QueryValues> (assert : sd.AssertFunc<T>, table : string, row : T, id : number) : Promise<InsertResult<T>> {
        return this.update(
            assert,
            Id,
            table,
            row,
            {
                id : id,
            }
        );
    }
    public rawDelete (queryStr : string, queryValues? : QueryValues) : Promise<MysqlDeleteResult> {
        return new Promise<MysqlDeleteResult>((resolve, reject) => {
            this.rawQuery(
                queryStr,
                queryValues,
                (err, results? : MysqlDeleteResult) => {
                    if (err == undefined) {
                        if (results == undefined) {
                            reject(new Error(`Expected results`));
                            return;
                        }
                        resolve(results);
                    } else {
                        reject(err);
                    }
                }
            );
        });
    }
    //Too dangerous to call this without queryValues or with empty queryValues
    public delete (table : string, queryValues : QueryValues) {
        if (Object.getOwnPropertyNames(queryValues).length == 0) {
            throw new Error(`Expected at least one query value; if you want to delete everything, consider rawDelete`);
        }
        const queryStr = `
            DELETE FROM
                ${mysql.escapeId(table)}
            WHERE
                ${util.toWhereEquals(queryValues)}
        `;
        return this.rawDelete(queryStr, queryValues);
    }
    public async getAny (queryStr : string, queryValues? : QueryValues) {
        const result = await this.selectAny(
            queryStr,
            queryValues
        );
        if (result.rows.length == 0) {
            return undefined;
        }
        if (result.rows.length != 1) {
            throw new Error(`Expected 1 row, received ${result.rows.length}`);
        }
        if (result.fields.length != 1) {
            throw new Error(`Expected one field, received ${result.fields.length}`);
        }
        const k = result.fields[0].name;
        const value = result.rows[0][k];
        return value;
    }
    public async get<T> (assertion : sd.AssertDelegate<T>, queryStr : string, queryValues? : QueryValues) {
        const anyValue = await this.getAny(queryStr, queryValues);
        const value    = assertion("value", anyValue);
        return value;
    }
    public async getBoolean (queryStr : string, queryValues? : QueryValues) {
        return this.get(sd.numberToBoolean(), queryStr, queryValues);
    }
    public async getNumber (queryStr : string, queryValues? : QueryValues) {
        return this.get(sd.number(), queryStr, queryValues);
    }
    public async getNaturalNumber (queryStr : string, queryValues? : QueryValues) {
        return this.get(sd.naturalNumber(), queryStr, queryValues);
    }
    public async getString (queryStr : string, queryValues? : QueryValues) {
        return this.get(sd.string(), queryStr, queryValues);
    }
    public async getDate (queryStr : string, queryValues? : QueryValues) {
        return this.get(sd.date(), queryStr, queryValues);
    }
    public async exists (table : string, queryValues : QueryValues) {
        const queryStr = `
            SELECT EXISTS (
                SELECT
                    *
                FROM
                    ${mysql.escapeId(table)}
                WHERE
                    ${util.toWhereEquals(queryValues)}
            )
        `;
        const result = await this.getBoolean(queryStr, queryValues);
        return result;
    }
    public async now () {
        const result = await this.getDate("SELECT NOW()");
        return result;
    }
    public async getArrayAny (queryStr : string, queryValues? : QueryValues) {
        const result = await this.selectAny(
            queryStr,
            queryValues
        );
        if (result.fields.length != 1) {
            throw new Error(`Expected one field, received ${result.fields.length}`);
        }
        const k = result.fields[0].name;

        const arr : any[] = [];
        for (let row of result.rows) {
            const value = row[k];
            arr.push(value);
        }
        return arr;
    }
    public async getArray<T> (assertion : sd.AssertDelegate<T>, queryStr : string, queryValues? : QueryValues) {
        const anyArr = await this.getArrayAny(queryStr, queryValues);
        const arr    = sd.array(assertion)("array", anyArr);
        return arr;
    }
    public async getBooleanArray (queryStr : string, queryValues? : QueryValues) {
        return this.getArray(sd.numberToBoolean(), queryStr, queryValues);
    }
    public async getNumberArray (queryStr : string, queryValues? : QueryValues) {
        return this.getArray(sd.number(), queryStr, queryValues);
    }
    public async getNaturalNumberArray (queryStr : string, queryValues? : QueryValues) {
        return this.getArray(sd.naturalNumber(), queryStr, queryValues);
    }
    public async getStringArray (queryStr : string, queryValues? : QueryValues) {
        return this.getArray(sd.string(), queryStr, queryValues);
    }
    public async getDateArray (queryStr : string, queryValues? : QueryValues) {
        return this.getArray(sd.date(), queryStr, queryValues);
    }
    //TODO Phase out
    public beginTransaction () {
        return new Promise((resolve, reject) => {
            this.getConnection().beginTransaction((err) => {
                if (err == undefined) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    }
    //TODO Phase out
    public rollback () {
        return new Promise((resolve, reject) => {
            this.getConnection().rollback((err) => {
                if (err == undefined) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    }
    //TODO Phase out
    public commit () {
        return new Promise((resolve, reject) => {
            this.getConnection().commit((err) => {
                if (err == undefined) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    }
    public getPaginationConfiguration () {
        return {
            ...this.paginationConfiguration
        };
    }
    public setPaginationConfiguration (paginationConfiguration : PaginationConfiguration) {
        this.paginationConfiguration = sd.toClassExact(
            "paginationConfiguration",
            paginationConfiguration,
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
            TypeUtil.Coalesce<RawPaginationArgs>(
                rawPaginationArgs,
                {}
            ),
            this.paginationConfiguration
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

        const page = await this.select(
            assert,
            queryStr,
            {
                ...queryValues,
                __start : getPaginationStart(paginationArgs),
                __count : paginationArgs.itemsPerPage,
            }
        );

        const itemsFound = await this.getNumber(`SELECT FOUND_ROWS()`);
        const pagesFound = (
            Math.floor(itemsFound/paginationArgs.itemsPerPage) +
            (
                (itemsFound%paginationArgs.itemsPerPage == 0) ?
                    0 : 1
            )
        );

        return {
            info : {
                itemsFound : itemsFound,
                pagesFound : pagesFound,
                ...paginationArgs
            },
            page : page,
        };
    }

    public async simpleSelectZeroOrOne<T> (
        assert      : sd.AssertFunc<T>,
        table       : string,
        queryValues : QueryValues = {}
    ) : Promise<SelectZeroOrOneResult<T>> {
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
    public async simpleSelectOne<T> (
        assert      : sd.AssertFunc<T>,
        table       : string,
        queryValues : QueryValues = {}
    ) : Promise<SelectOneResult<T>> {
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
    public async simpleSelectPaginated<T> (
        assert      : sd.AssertFunc<T>,
        table       : string,
        orderBy     : OrderByItem[],
        queryValues : QueryValues = {},
        rawPaginationArgs? : RawPaginationArgs
    ) : Promise<SelectPaginatedResult<T>> {
        let where = util.toWhereEquals(queryValues);

        if (where == "") {
            where = "TRUE";
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
                ORDER BY
                    ${util.toOrderBy(orderBy)}
            `,
            queryValues,
            rawPaginationArgs
        );
    }

    public escape (raw : any) {
        util.escape(raw, this.useUtcOnly)
    }
    public isUtcOnly () {
        return this.useUtcOnly;
    }
}
