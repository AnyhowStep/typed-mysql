import * as mysql from "mysql";
import {TypeUtil} from "@anyhowstep/type-util";
import * as sd from "schema-decorator";

export interface DatabaseArgs {
    host      : string;
    database  : string;
    charset?  : string; //Default UTF8_GENERAL_CI
    user      : string;
    password  : string;
    timezone? : string; //Default local
}
export type QueryValues = {};//{ [key : string] : string|number|boolean|Date|null|undefined };
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
export function assertQueryKey (k : string) {
    if (!/^\w+$/.test(k)) {
        throw new Error(`Only alphanumeric, and underscores are allowed to be query keys`);
    }
}

export class Database {
    private connection : mysql.Connection;
    public constructor (args : DatabaseArgs) {
        this.connection = mysql.createConnection({
            host     : args.host,
            database : args.database,
            charset  : TypeUtil.Coalesce<string>(args.charset, "UTF8_GENERAL_CI"),
            user     : args.user,
            password : args.password,
            timezone : TypeUtil.Coalesce<string>(args.timezone, "local"),
        });
        this.connection.config.queryFormat = this.queryFormat;
    }
    public readonly queryFormat = (query : string, values : any) : string => {
        if (values == undefined) {
            return query;
        }
        const newQuery = query.replace(/\:(\w+)/g, (_substring : string, key : string) => {
            if (values.hasOwnProperty(key)) {
                return mysql.escape(values[key]);
            }
            throw new Error(`Expected a value for ${key} in query`);
        });
        return newQuery;
    };
    public getRawConnection () : mysql.Connection {
        return this.connection;
    }
    public connect () : Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.connect((err) => {
                if (err == undefined) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    }
    public rawQuery (queryStr : string, queryValues : QueryValues|undefined, callback : (err: mysql.MysqlError | null, results?: any, fields?: mysql.FieldInfo[]) => void) {
        return this.connection.query(
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
        ctor         : {new():T},
        queryStr     : string,
        queryValues? : QueryValues
    ) : Promise<SelectResult<T>> {
        const anyResult    = await this.selectAny(queryStr, queryValues);
        const assertion    = sd.array(sd.nested(ctor));
        const assertedRows = assertion("results", anyResult.rows);
        return {
            rows   : assertedRows,
            fields : anyResult.fields,
        };
    }
    public async selectAll<T> (
        ctor  : {new():T},
        table : string
    ) : Promise<SelectResult<T>> {
        return this.select(ctor, `
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
        ctor         : {new():T},
        queryStr     : string,
        queryValues? : QueryValues
    ) : Promise<SelectOneResult<T>> {
        const anyResult = await this.selectOneAny(queryStr, queryValues);
        const assertion   = sd.nested(ctor);
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
        ctor         : {new():T},
        queryStr     : string,
        queryValues? : QueryValues
    ) : Promise<SelectZeroOrOneResult<T>> {
        const anyResult = await this.selectZeroOrOneAny(queryStr, queryValues);
        if (anyResult.row == undefined) {
            return anyResult;
        }
        const assertion   = sd.nested(ctor);
        const assertedRow = assertion("result", anyResult.row);
        return {
            row    : assertedRow,
            fields : anyResult.fields,
        };
    }
    public static ToEqualsArray (queryValues : QueryValues) {
        const result : string[] = [];
        for (let k in queryValues) {
            if (queryValues.hasOwnProperty(k)) {
                assertQueryKey(k);
                result.push(`${mysql.escapeId(k)} = :${k}`);
            }
        }
        return result;
    }
    public static ToWhereEquals (queryValues : QueryValues) {
        const arr = Database.ToEqualsArray(queryValues);
        return arr.join(" AND ");
    }
    public static ToSet (queryValues : QueryValues) {
        const arr = Database.ToEqualsArray(queryValues);
        return arr.join(",");
    }
    public async insert<T extends QueryValues> (ctor : {new():T}, table : string, row : T) : Promise<InsertResult<T>> {
        //Just to be safe
        row = sd.toClass("insert target", row, ctor);
        const queryValues = sd.toRaw("insert target", row);

        const columnArr : string[] = [];
        const keyArr    : string[] = [];
        for (let k in queryValues) {
            if (queryValues.hasOwnProperty(k)) {
                assertQueryKey(k);
                columnArr.push(k);
                keyArr.push(`:${k}`)
            }
        }
        const queryStr = `
            INSERT INTO
                ${mysql.escapeId(table)} (${columnArr.join(",")})
            VALUES (
                ${keyArr.join(",")}
            )
        `;
        return new Promise<InsertResult<T>>((resolve, reject) => {
            this.rawQuery(
                queryStr,
                queryValues,
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
    public async update<T extends QueryValues, ConditionT extends QueryValues> (
        ctor : {new():T},
        conditionCtor : {new():ConditionT},
        table : string,
        row : T,
        condition : ConditionT
    ) : Promise<UpdateResult<T, ConditionT>> {
        //Just to be safe
        row       = sd.toClass("update target", row, ctor);
        condition = sd.toClass("update condition", condition, conditionCtor);

        const rowQueryValues       : {} = sd.toRaw("update target", row);
        const conditionQueryValues : {} = sd.toRaw("update condition", condition);

        const set   = this.queryFormat(Database.ToSet(rowQueryValues), rowQueryValues);
        const where = this.queryFormat(Database.ToWhereEquals(conditionQueryValues), conditionQueryValues);

        const queryStr = `
            UPDATE
                ${mysql.escapeId(table)}
            SET
                ${set}
            WHERE
                ${where}
        `;

        return new Promise<UpdateResult<T, ConditionT>>((resolve, reject) => {
            this.rawQuery(
                queryStr,
                {},
                (err, result? : MysqlUpdateResult) => {
                    if (err == undefined) {
                        if (result == undefined) {
                            reject(new Error(`Expected a result`))
                        } else {
                            resolve({
                                ...result,
                                row : row,
                                condition : condition,
                            });
                        }
                    } else {
                        reject(err);
                    }
                }
            );
        });
    }
    public async updateByNumberId<T extends QueryValues> (ctor : {new():T}, table : string, row : T, id : number) : Promise<InsertResult<T>> {
        return this.update(
            ctor,
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
                ${Database.ToWhereEquals(queryValues)}
        `;
        return this.rawDelete(queryStr, queryValues);
    }
    public async getAny (queryStr : string, queryValues? : QueryValues) {
        const result = await this.selectOneAny(
            queryStr,
            queryValues
        );
        if (result.fields.length != 1) {
            throw new Error(`Expected one field, received ${result.fields.length}`);
        }
        const k = result.fields[0].name;
        const value = result.row[k];
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
                    ${Database.ToWhereEquals(queryValues)}
            )
        `;
        const result = await this.getBoolean(queryStr, queryValues);
        return result;
    }
    public async now () {
        const result = await this.getDate("SELECT NOW()");
        return result;
    }
    public static Escape (raw : any) {
        return mysql.escape(raw);
    }
    public static EscapeId (raw : string) {
        return mysql.escapeId(raw);
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
    public beginTransaction () {
        return new Promise((resolve, reject) => {
            this.connection.beginTransaction((err) => {
                if (err == undefined) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    }
    public rollback () {
        return new Promise((resolve, reject) => {
            this.connection.rollback((err) => {
                if (err == undefined) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    }
    public commit () {
        return new Promise((resolve, reject) => {
            this.connection.commit((err) => {
                if (err == undefined) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    }
}