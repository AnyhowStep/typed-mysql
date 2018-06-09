"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql = require("mysql");
const type_util_1 = require("@anyhowstep/type-util");
const sd = require("schema-decorator");
const pagination_1 = require("./pagination");
const util = require("./my-util");
const poolUtil = require("./pool-util");
const SingletonAllocator_1 = require("./SingletonAllocator");
class PooledDatabase {
    constructor(args, data) {
        this.connection = new SingletonAllocator_1.SingletonAllocator({
            onAllocate: () => {
                return poolUtil.allocatePoolConnection(this.pool, this.data.useUtcOnly);
            },
            onFree: (resource) => {
                resource.release();
            }
        });
        this.acquiredTemporary = false;
        //Requires that a connection is already allocated
        this.queryFormat = (query, values) => {
            return this.getOrAllocateConnectionTemporary((connection) => {
                const queryFormat = connection.config.queryFormat;
                if (queryFormat == undefined) {
                    throw new Error(`Could not get queryFormat() of connection`);
                }
                const result = queryFormat(query, values);
                if (typeof result != "string") {
                    throw new Error(`Expected queryFormat result to be a string, received ${typeof result}`);
                }
                return Promise.resolve(result);
            });
        };
        //Transaction
        this.inTransaction = false;
        this.pool = poolUtil.toPool(args);
        if (data == undefined) {
            data = {
                useUtcOnly: false,
                paginationConfiguration: new pagination_1.PaginationConfiguration(),
            };
        }
        this.data = {
            useUtcOnly: data.useUtcOnly,
            paginationConfiguration: Object.assign({}, data.paginationConfiguration),
        };
    }
    getPool() {
        return this.pool;
    }
    getData() {
        return this.data;
    }
    isUtcOnly() {
        return this.data.useUtcOnly;
    }
    utcOnly() {
        return __awaiter(this, void 0, void 0, function* () {
            this.data.useUtcOnly = true;
            if (!this.connection.isFree()) {
                this.freeConnection();
            }
            yield this.connection.getOrAllocate();
        });
    }
    escape(raw) {
        return util.escape(raw, this.isUtcOnly());
    }
    //The current connection
    getConnectionOrError() {
        return this.connection.getOrError();
    }
    getOrAllocateConnection() {
        return this.connection.getOrAllocate();
    }
    isConnectionFree() {
        return this.connection.isFree();
    }
    freeConnection() {
        if (this.inTransaction) {
            console.warn("Attempted to free connection before performing commit/rollback on transaction");
            this.rollback();
        }
        return this.connection.free();
    }
    //Allocates a new PooledDatabase
    allocate() {
        return new PooledDatabase(this.pool, this.data);
    }
    isAcquiredTemporary() {
        return this.acquiredTemporary;
    }
    //A shortcut to allocate, and free connections.
    //Perform all your queries in the callback.
    acquire(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            const allocated = this.allocate();
            //Temporary because we'll automatically free it
            allocated.acquiredTemporary = true;
            return callback(allocated)
                .then((result) => {
                if (!allocated.connection.isFree()) {
                    allocated.freeConnection();
                }
                allocated.acquiredTemporary = false;
                return result;
            })
                .catch((err) => {
                if (!allocated.connection.isFree()) {
                    allocated.freeConnection();
                }
                allocated.acquiredTemporary = false;
                throw err;
            });
        });
    }
    acquireIfNotTemporary(callback) {
        if (this.isAcquiredTemporary()) {
            return callback(this);
        }
        else {
            return this.acquire(callback);
        }
    }
    //If is `acquiredTemporary`, then call `getOrAllocateConnection()`
    //Otherwise, call `getOrAllocateConnection()` and then call `freeConnection()` after
    getOrAllocateConnectionTemporary(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.acquireIfNotTemporary((db) => __awaiter(this, void 0, void 0, function* () {
                const connection = yield db.getOrAllocateConnection();
                return callback(connection);
            }));
        });
    }
    rawQuery(queryStr, queryValues) {
        return this.getOrAllocateConnectionTemporary((connection) => {
            return new Promise((resolve, reject) => {
                const query = connection.query(queryStr, queryValues, (err, results, fields) => {
                    if (err != undefined) {
                        reject(err);
                        return;
                    }
                    resolve({
                        query: query,
                        results: results,
                        fields: fields
                    });
                });
            });
        });
    }
    selectAllAny(queryStr, queryValues) {
        return this.rawQuery(queryStr, queryValues)
            .then(({ results, fields }) => {
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
                rows: results,
                fields: fields,
            };
        });
    }
    selectOneAny(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectAllAny(queryStr, queryValues)
                .then(({ rows, fields }) => {
                if (rows.length != 1) {
                    throw new Error(`Expected one result, received ${rows.length}`);
                }
                return {
                    row: rows[0],
                    fields: fields,
                };
            });
        });
    }
    selectZeroOrOneAny(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectAllAny(queryStr, queryValues)
                .then(({ rows, fields }) => {
                if (rows.length > 1) {
                    throw new Error(`Expected zero or one result, received ${rows.length}`);
                }
                if (rows.length == 0) {
                    return {
                        row: undefined,
                        fields: fields,
                    };
                }
                else {
                    return {
                        row: rows[0],
                        fields: fields,
                    };
                }
            });
        });
    }
    selectAll(assert, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectAllAny(queryStr, queryValues)
                .then(({ rows, fields }) => {
                const assertDelegate = sd.array(sd.toAssertDelegateExact(assert));
                const assertedRows = assertDelegate("results", rows);
                return {
                    rows: assertedRows,
                    fields: fields,
                };
            });
        });
    }
    selectOne(assert, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectOneAny(queryStr, queryValues)
                .then(({ row, fields }) => {
                const assertDelegate = sd.toAssertDelegateExact(assert);
                const assertedRow = assertDelegate("result", row);
                return {
                    row: assertedRow,
                    fields: fields,
                };
            });
        });
    }
    selectZeroOrOne(assert, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectZeroOrOneAny(queryStr, queryValues)
                .then(({ row, fields }) => {
                if (row == undefined) {
                    return {
                        row: undefined,
                        fields: fields,
                    };
                }
                const assertDelegate = sd.toAssertDelegateExact(assert);
                const assertedRow = assertDelegate("result", row);
                return {
                    row: assertedRow,
                    fields: fields,
                };
            });
        });
    }
    simpleSelectAll(assert, table) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectAll(assert, `
                SELECT
                    *
                FROM
                    ${mysql.escapeId(table)}
            `);
        });
    }
    simpleSelectOne(assert, table, queryValues = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectOne(assert, `
                SELECT
                    *
                FROM
                    ${mysql.escapeId(table)}
                WHERE
                    ${util.toWhereEquals(queryValues)}
            `, queryValues);
        });
    }
    simpleSelectZeroOrOne(assert, table, queryValues = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectZeroOrOne(assert, `
                SELECT
                    *
                FROM
                    ${mysql.escapeId(table)}
                WHERE
                    ${util.toWhereEquals(queryValues)}
            `, queryValues);
        });
    }
    //Select Value
    selectValueAny(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectAllAny(queryStr, queryValues)
                .then(({ rows, fields }) => {
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
        });
    }
    selectValue(assert, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectValueAny(queryStr, queryValues)
                .then((value) => {
                const assertDelegate = sd.toAssertDelegateExact(assert);
                return assertDelegate("value", value);
            });
        });
    }
    selectBoolean(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectValue(sd.numberToBoolean(), queryStr, queryValues);
        });
    }
    selectNumber(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectValue(sd.number(), queryStr, queryValues);
        });
    }
    selectNaturalNumber(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectValue(sd.naturalNumber(), queryStr, queryValues);
        });
    }
    selectString(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectValue(sd.string(), queryStr, queryValues);
        });
    }
    selectDate(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectValue(sd.date(), queryStr, queryValues);
        });
    }
    exists(table, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    now() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectDate(`SELECT NOW()`);
        });
    }
    //Select Value Array
    selectValueArrayAny(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectAllAny(queryStr, queryValues)
                .then(({ rows, fields }) => {
                if (fields.length != 1) {
                    throw new Error(`Expected one field, received ${fields.length}`);
                }
                const fieldName = fields[0].name;
                const result = [];
                for (let row of rows) {
                    const value = row[fieldName];
                    result.push(value);
                }
                return result;
            });
        });
    }
    selectValueArray(assert, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            this.selectValueArrayAny(queryStr, queryValues)
                .then((anyArr) => {
                const assertDelegate = sd.toAssertDelegateExact(assert);
                const result = [];
                for (let raw of anyArr) {
                    const value = assertDelegate("raw", raw);
                    result.push(value);
                }
                return result;
            });
        });
    }
    selectBooleanArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectValueArray(sd.numberToBoolean(), queryStr, queryValues);
        });
    }
    selectNumberArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectValueArray(sd.number(), queryStr, queryValues);
        });
    }
    selectNaturalNumberArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectValueArray(sd.naturalNumber(), queryStr, queryValues);
        });
    }
    selectStringArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectValueArray(sd.string(), queryStr, queryValues);
        });
    }
    selectDateArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectValueArray(sd.date(), queryStr, queryValues);
        });
    }
    isInTransaction() {
        return this.inTransaction;
    }
    beginTransaction() {
        if (this.inTransaction) {
            throw new Error(`Transaction already started`);
        }
        if (!this.acquiredTemporary) {
            throw new Error(`Cannot start a transaction unless inside of acquire()`);
        }
        return this.getOrAllocateConnection()
            .then((connection) => {
            return new Promise((resolve, reject) => {
                connection.beginTransaction((err) => {
                    if (err == undefined) {
                        this.inTransaction = true;
                        resolve();
                    }
                    else {
                        reject(err);
                    }
                });
            });
        });
    }
    rollback() {
        if (!this.inTransaction) {
            throw new Error(`Not in transaction; cannot rollback`);
        }
        if (!this.acquiredTemporary) {
            throw new Error(`Cannot rollback a transaction unless inside of acquire()`);
        }
        const connection = this.getConnectionOrError();
        return new Promise((resolve, reject) => {
            connection.rollback((err) => {
                if (err == undefined) {
                    this.inTransaction = false;
                    resolve();
                }
                else {
                    reject(err);
                }
            });
        });
    }
    commit() {
        if (!this.inTransaction) {
            throw new Error(`Not in transaction; cannot commit`);
        }
        if (!this.acquiredTemporary) {
            throw new Error(`Cannot commit a transaction unless inside of acquire()`);
        }
        const connection = this.getConnectionOrError();
        return new Promise((resolve, reject) => {
            connection.commit((err) => {
                if (err == undefined) {
                    this.inTransaction = false;
                    resolve();
                }
                else {
                    reject(err);
                }
            });
        });
    }
    //A shortcut to begin, and commit transactions.
    //Perform all your transactional queries in the callback.
    transaction(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.acquire((allocated) => __awaiter(this, void 0, void 0, function* () {
                yield allocated.beginTransaction();
                return callback(allocated)
                    .then((result) => __awaiter(this, void 0, void 0, function* () {
                    yield allocated.commit();
                    return result;
                }))
                    .catch((err) => __awaiter(this, void 0, void 0, function* () {
                    yield allocated.rollback();
                    throw err;
                }));
            }));
        });
    }
    transactionIfNotInOne(callback) {
        if (this.isInTransaction()) {
            return callback(this);
        }
        else {
            return this.transaction(callback);
        }
    }
    //Pagination
    getPaginationConfiguration() {
        return Object.assign({}, this.data.paginationConfiguration);
    }
    setPaginationConfiguration(paginationConfiguration) {
        this.data.paginationConfiguration = sd.toClassExact("paginationConfiguration", Object.assign({}, paginationConfiguration), pagination_1.PaginationConfiguration);
    }
    selectPaginated(assert, queryStr, queryValues, rawPaginationArgs) {
        return __awaiter(this, void 0, void 0, function* () {
            const paginationArgs = pagination_1.toPaginationArgs(type_util_1.coalesce(rawPaginationArgs, {}), this.data.paginationConfiguration);
            if (queryStr.indexOf("SQL_CALC_FOUND_ROWS") < 0) {
                if (queryStr.indexOf(":__start") >= 0 || queryStr.indexOf(":__count") >= 0) {
                    throw new Error(`Cannot specify :__start, and :__count, reserved for pagination queries`);
                }
                queryStr = queryStr
                    .replace(`SELECT`, `SELECT SQL_CALC_FOUND_ROWS `)
                    .concat(` LIMIT :__start, :__count`);
            }
            else {
                if (queryStr.indexOf(":__start") < 0 || queryStr.indexOf(":__count") < 0) {
                    throw new Error(`You must specify both :__start, and :__count, for pagination queries since SQL_CALC_FOUND_ROWS was specified`);
                }
            }
            //We allocate a new connection because `SELECT FOUND_ROWS()`
            //is bound to the connection, it may be "polluted" by
            //other queries if we use the current connection
            return this.acquire((allocated) => __awaiter(this, void 0, void 0, function* () {
                const page = yield allocated.selectAll(assert, queryStr, Object.assign({}, queryValues, { __start: pagination_1.getPaginationStart(paginationArgs), __count: paginationArgs.itemsPerPage }));
                const itemsFound = yield allocated.selectNaturalNumber(`SELECT FOUND_ROWS()`);
                const pagesFound = pagination_1.calculatePagesFound(paginationArgs, itemsFound);
                return {
                    info: Object.assign({}, paginationArgs, { itemsFound: itemsFound, pagesFound: pagesFound, fields: page.fields }),
                    rows: page.rows,
                };
            }));
        });
    }
    simpleSelectPaginated(assert, table, orderBy, queryValues = {}, rawPaginationArgs) {
        return __awaiter(this, void 0, void 0, function* () {
            let where = util.toWhereEquals(queryValues);
            if (where == "") {
                where = "TRUE";
            }
            let orderByStr = util.toOrderBy(orderBy);
            if (orderByStr != "") {
                orderByStr = "ORDER BY " + orderByStr;
            }
            return this.selectPaginated(assert, `
                SELECT
                    *
                FROM
                    ${mysql.escapeId(table)}
                WHERE
                    ${where}
                ${orderByStr}
            `, queryValues, rawPaginationArgs);
        });
    }
    //Insert
    rawInsert(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.rawQuery(queryStr, queryValues)
                .then(({ results }) => {
                if (results == undefined) {
                    throw new Error(`Expected a result`);
                }
                ;
                return results;
            });
        });
    }
    insertAny(table, row) {
        return __awaiter(this, void 0, void 0, function* () {
            const names = util.toInsert(row);
            return this.rawInsert(`
                INSERT INTO
                    ${mysql.escapeId(table)}
                VALUES (
                    ${names.keys}
                )
            `, row).then((result) => {
                return Object.assign({}, result, { row: row });
            });
        });
    }
    insert(assert, table, row) {
        return __awaiter(this, void 0, void 0, function* () {
            row = sd.toAssertDelegateExact(assert)("row", row);
            return this.insertAny(table, row);
        });
    }
    //Update
    rawUpdate(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.rawQuery(queryStr, queryValues)
                .then(({ results }) => {
                if (results == undefined) {
                    throw new Error(`Expected a result`);
                }
                ;
                return results;
            });
        });
    }
    updateAny(table, row, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Object.getOwnPropertyNames(condition).length == 0) {
                throw new Error(`Expected at least one query value; if you want to update everything, consider rawUpdate()`);
            }
            const set = yield this.queryFormat(util.toSet(row), row);
            if (set == "") {
                return {
                    fieldCount: 0,
                    affectedRows: -1,
                    insertId: 0,
                    serverStatus: 0,
                    warningCount: 1,
                    message: "SET clause is empty; no updates occurred",
                    protocol41: false,
                    changedRows: 0,
                    row: row,
                    condition: condition,
                };
            }
            let where = yield this.queryFormat(util.toWhereEquals(condition), condition);
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
            return this.rawUpdate(queryStr, {}).then((result) => {
                return Object.assign({}, result, { row: row, condition: condition });
            });
        });
    }
    update(assertRow, assertCondition, table, row, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            //Just to be safe
            row = sd.toAssertDelegateExact(assertRow)("new values", row);
            condition = sd.toAssertDelegateExact(assertCondition)("update condition", condition);
            return this.updateAny(table, row, condition);
        });
    }
    //Delete
    rawDelete(queryStr, queryValues) {
        return this.rawQuery(queryStr, queryValues)
            .then(({ results }) => {
            if (results == undefined) {
                throw new Error(`Expected a result`);
            }
            ;
            return results;
        });
    }
    delete(table, queryValues) {
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
exports.PooledDatabase = PooledDatabase;
//# sourceMappingURL=PooledDatabase.js.map