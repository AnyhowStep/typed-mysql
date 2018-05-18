"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
const sd = require("schema-decorator");
const util = require("./my-util");
const pagination_1 = require("./pagination");
const type_util_1 = require("@anyhowstep/type-util");
class Id {
    constructor() {
        this.id = 0;
    }
}
__decorate([
    sd.assert(sd.naturalNumber())
], Id.prototype, "id", void 0);
exports.Id = Id;
class ConnectedDatabase {
    constructor(useUtcOnly, connection) {
        this.paginationConfiguration = new pagination_1.PaginationConfiguration();
        this.useUtcOnly = useUtcOnly;
        this.connection = connection;
    }
    setConnection(connection) {
        if (this.connection != undefined) {
            throw new Error(`Release the current connection first`);
        }
        this.connection = connection;
    }
    getConnection() {
        if (this.connection == undefined) {
            throw new Error(`The connection has already been released; or not initialized yet`);
        }
        return this.connection;
    }
    releaseConnection() {
        this.getConnection().release();
        this.connection = undefined;
    }
    queryFormat(query, values) {
        const queryFormat = this.getConnection().config.queryFormat;
        if (queryFormat == undefined) {
            throw new Error(`This connection does not have a custom queryFormat`);
        }
        else {
            const formatted = queryFormat(query, values);
            if (typeof formatted == "string") {
                return formatted;
            }
            else {
                throw new Error(`queryFormat must return string`);
            }
        }
    }
    rawQuery(queryStr, queryValues, callback) {
        return this.getConnection().query(queryStr, queryValues, callback);
    }
    selectAny(queryStr, queryValues) {
        return new Promise((resolve, reject) => {
            this.rawQuery(queryStr, queryValues, (err, results, fields) => {
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
                        rows: results,
                        fields: fields,
                    });
                }
                else {
                    reject(err);
                }
            });
        });
    }
    select(assert, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            const anyResult = yield this.selectAny(queryStr, queryValues);
            const assertion = sd.array(sd.toAssertDelegateExact(assert));
            const assertedRows = assertion("results", anyResult.rows);
            return {
                rows: assertedRows,
                fields: anyResult.fields,
            };
        });
    }
    selectAll(assert, table) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.select(assert, `
            SELECT
                *
            FROM
                ${mysql.escapeId(table)}
        `);
        });
    }
    selectOneAny(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.selectAny(queryStr, queryValues);
            if (result.rows.length != 1) {
                throw new Error(`Expected 1 row, received ${result.rows.length}`);
            }
            return {
                row: result.rows[0],
                fields: result.fields,
            };
        });
    }
    selectOne(assert, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            const anyResult = yield this.selectOneAny(queryStr, queryValues);
            const assertion = sd.toAssertDelegateExact(assert);
            const assertedRow = assertion("result", anyResult.row);
            return {
                row: assertedRow,
                fields: anyResult.fields,
            };
        });
    }
    selectZeroOrOneAny(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.selectAny(queryStr, queryValues);
            if (result.rows.length > 1) {
                throw new Error(`Expected zero or one rows, received ${result.rows.length}`);
            }
            if (result.rows.length == 0) {
                return {
                    row: undefined,
                    fields: result.fields,
                };
            }
            else {
                return {
                    row: result.rows[0],
                    fields: result.fields,
                };
            }
        });
    }
    selectZeroOrOne(assert, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            const anyResult = yield this.selectZeroOrOneAny(queryStr, queryValues);
            if (anyResult.row == undefined) {
                return anyResult;
            }
            const assertion = sd.toAssertDelegateExact(assert);
            const assertedRow = assertion("result", anyResult.row);
            return {
                row: assertedRow,
                fields: anyResult.fields,
            };
        });
    }
    insertAny(table, row) {
        return __awaiter(this, void 0, void 0, function* () {
            const names = util.toInsert(row);
            const queryStr = `
            INSERT INTO
                ${mysql.escapeId(table)} (${names.columns})
            VALUES (
                ${names.keys}
            )
        `;
            return new Promise((resolve, reject) => {
                this.rawQuery(queryStr, row, (err, result) => {
                    if (err == undefined) {
                        if (result == undefined) {
                            reject(new Error(`Expected a result`));
                        }
                        else {
                            resolve(Object.assign({}, result, { row: row }));
                        }
                    }
                    else {
                        reject(err);
                    }
                });
            });
        });
    }
    insert(assert, table, row) {
        return __awaiter(this, void 0, void 0, function* () {
            //Just to be safe
            row = sd.toAssertDelegateExact(assert)("insert target", row);
            //TODO Seems like this line can be deleted...
            //const queryValues = sd.toRaw("insert target", row);
            return this.insertAny(table, row);
        });
    }
    rawUpdate(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.rawQuery(queryStr, queryValues, (err, result) => {
                    if (err == undefined) {
                        if (result == undefined) {
                            reject(new Error(`Expected a result`));
                        }
                        else {
                            resolve(result);
                        }
                    }
                    else {
                        reject(err);
                    }
                });
            });
        });
    }
    updateAny(table, row, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            const set = this.queryFormat(util.toSet(row), row);
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
                return Object.assign({}, result, { row: row, condition: condition });
            });
        });
    }
    update(assertRow, assertCondition, table, row, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            //Just to be safe
            row = sd.toAssertDelegateExact(assertRow)("update target", row);
            condition = sd.toAssertDelegateExact(assertCondition)("update condition", condition);
            return this.updateAny(table, row, condition);
        });
    }
    updateByNumberId(assert, table, row, id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.update(assert, Id, table, row, {
                id: id,
            });
        });
    }
    rawDelete(queryStr, queryValues) {
        return new Promise((resolve, reject) => {
            this.rawQuery(queryStr, queryValues, (err, results) => {
                if (err == undefined) {
                    if (results == undefined) {
                        reject(new Error(`Expected results`));
                        return;
                    }
                    resolve(results);
                }
                else {
                    reject(err);
                }
            });
        });
    }
    //Too dangerous to call this without queryValues or with empty queryValues
    delete(table, queryValues) {
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
    getAny(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.selectAny(queryStr, queryValues);
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
        });
    }
    get(assertion, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            const anyValue = yield this.getAny(queryStr, queryValues);
            const value = assertion("value", anyValue);
            return value;
        });
    }
    getBoolean(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.get(sd.numberToBoolean(), queryStr, queryValues);
        });
    }
    getNumber(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.get(sd.number(), queryStr, queryValues);
        });
    }
    getNaturalNumber(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.get(sd.naturalNumber(), queryStr, queryValues);
        });
    }
    getString(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.get(sd.string(), queryStr, queryValues);
        });
    }
    getDate(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.get(sd.date(), queryStr, queryValues);
        });
    }
    exists(table, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
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
            const result = yield this.getBoolean(queryStr, queryValues);
            return result;
        });
    }
    now() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.getDate("SELECT NOW()");
            return result;
        });
    }
    getArrayAny(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.selectAny(queryStr, queryValues);
            if (result.fields.length != 1) {
                throw new Error(`Expected one field, received ${result.fields.length}`);
            }
            const k = result.fields[0].name;
            const arr = [];
            for (let row of result.rows) {
                const value = row[k];
                arr.push(value);
            }
            return arr;
        });
    }
    getArray(assertion, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            const anyArr = yield this.getArrayAny(queryStr, queryValues);
            const arr = sd.array(assertion)("array", anyArr);
            return arr;
        });
    }
    getBooleanArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getArray(sd.numberToBoolean(), queryStr, queryValues);
        });
    }
    getNumberArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getArray(sd.number(), queryStr, queryValues);
        });
    }
    getNaturalNumberArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getArray(sd.naturalNumber(), queryStr, queryValues);
        });
    }
    getStringArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getArray(sd.string(), queryStr, queryValues);
        });
    }
    getDateArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getArray(sd.date(), queryStr, queryValues);
        });
    }
    //TODO Phase out
    beginTransaction() {
        return new Promise((resolve, reject) => {
            this.getConnection().beginTransaction((err) => {
                if (err == undefined) {
                    resolve();
                }
                else {
                    reject(err);
                }
            });
        });
    }
    //TODO Phase out
    rollback() {
        return new Promise((resolve, reject) => {
            this.getConnection().rollback((err) => {
                if (err == undefined) {
                    resolve();
                }
                else {
                    reject(err);
                }
            });
        });
    }
    //TODO Phase out
    commit() {
        return new Promise((resolve, reject) => {
            this.getConnection().commit((err) => {
                if (err == undefined) {
                    resolve();
                }
                else {
                    reject(err);
                }
            });
        });
    }
    getPaginationConfiguration() {
        return Object.assign({}, this.paginationConfiguration);
    }
    setPaginationConfiguration(paginationConfiguration) {
        this.paginationConfiguration = sd.toClassExact("paginationConfiguration", paginationConfiguration, pagination_1.PaginationConfiguration);
    }
    selectPaginated(assert, queryStr, queryValues, rawPaginationArgs) {
        return __awaiter(this, void 0, void 0, function* () {
            const paginationArgs = pagination_1.toPaginationArgs(type_util_1.TypeUtil.Coalesce(rawPaginationArgs, {}), this.paginationConfiguration);
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
            const page = yield this.select(assert, queryStr, Object.assign({}, queryValues, { __start: pagination_1.getPaginationStart(paginationArgs), __count: paginationArgs.itemsPerPage }));
            const itemsFound = yield this.getNumber(`SELECT FOUND_ROWS()`);
            const pagesFound = (Math.floor(itemsFound / paginationArgs.itemsPerPage) +
                ((itemsFound % paginationArgs.itemsPerPage == 0) ?
                    0 : 1));
            return {
                info: Object.assign({ itemsFound: itemsFound, pagesFound: pagesFound }, paginationArgs),
                page: page,
            };
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
    simpleSelectPaginated(assert, table, orderBy, queryValues = {}, rawPaginationArgs) {
        return __awaiter(this, void 0, void 0, function* () {
            let where = util.toWhereEquals(queryValues);
            if (where == "") {
                where = "TRUE";
            }
            return this.selectPaginated(assert, `
                SELECT
                    *
                FROM
                    ${mysql.escapeId(table)}
                WHERE
                    ${where}
                ORDER BY
                    ${util.toOrderBy(orderBy)}
            `, queryValues, rawPaginationArgs);
        });
    }
    escape(raw) {
        util.escape(raw, this.useUtcOnly);
    }
    isUtcOnly() {
        return this.useUtcOnly;
    }
}
exports.ConnectedDatabase = ConnectedDatabase;
//# sourceMappingURL=ConnectedDatabase.js.map