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
const type_util_1 = require("@anyhowstep/type-util");
const sd = require("schema-decorator");
const pagination_1 = require("./pagination");
const my_util_1 = require("./my-util");
const UnsafeQuery_1 = require("./UnsafeQuery");
class Id {
    constructor() {
        this.id = 0;
    }
}
__decorate([
    sd.assert(sd.naturalNumber())
], Id.prototype, "id", void 0);
exports.Id = Id;
function assertQueryKey(k) {
    if (!/^\w+$/.test(k)) {
        throw new Error(`Only alphanumeric, and underscores are allowed to be query keys`);
    }
}
exports.assertQueryKey = assertQueryKey;
class Database {
    constructor(args) {
        this.paginationConfiguration = new pagination_1.PaginationConfiguration();
        this.useUtcOnly = false;
        this.queryFormat = (query, values) => {
            if (values == undefined) {
                return query;
            }
            query = Database.InsertUnsafeQueries(query, values);
            const newQuery = query.replace(/\:(\w+)/g, (_substring, key) => {
                if (values.hasOwnProperty(key)) {
                    return Database.Escape(values[key], this.useUtcOnly);
                }
                throw new Error(`Expected a value for ${key} in query`);
            });
            return newQuery;
        };
        this.connection = mysql.createConnection({
            host: args.host,
            database: args.database,
            charset: type_util_1.TypeUtil.Coalesce(args.charset, "UTF8_GENERAL_CI"),
            user: args.user,
            password: args.password,
            timezone: type_util_1.TypeUtil.Coalesce(args.timezone, "local"),
        });
        this.connection.config.queryFormat = this.queryFormat;
    }
    static InsertUnsafeQueries(query, values) {
        if (values == undefined) {
            return query;
        }
        const newQuery = query.replace(/\:(\w+)/g, (substring, key) => {
            if (values.hasOwnProperty(key)) {
                const raw = values[key];
                if (raw instanceof UnsafeQuery_1.UnsafeQuery) {
                    return raw.value;
                }
                else {
                    return substring;
                }
            }
            throw new Error(`Expected a value for ${key} in query`);
        });
        if (newQuery == query) {
            return newQuery;
        }
        else {
            return Database.InsertUnsafeQueries(newQuery, values);
        }
    }
    getRawConnection() {
        return this.connection;
    }
    connect() {
        return new Promise((resolve, reject) => {
            this.connection.connect((err) => {
                if (err == undefined) {
                    resolve();
                }
                else {
                    reject(err);
                }
            });
        });
    }
    rawQuery(queryStr, queryValues, callback) {
        return this.connection.query(queryStr, queryValues, callback);
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
    select(ctor, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            const anyResult = yield this.selectAny(queryStr, queryValues);
            const assertion = sd.array(sd.nested(ctor));
            const assertedRows = assertion("results", anyResult.rows);
            return {
                rows: assertedRows,
                fields: anyResult.fields,
            };
        });
    }
    selectAll(ctor, table) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.select(ctor, `
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
    selectOne(ctor, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            const anyResult = yield this.selectOneAny(queryStr, queryValues);
            const assertion = sd.nested(ctor);
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
    selectZeroOrOne(ctor, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            const anyResult = yield this.selectZeroOrOneAny(queryStr, queryValues);
            if (anyResult.row == undefined) {
                return anyResult;
            }
            const assertion = sd.nested(ctor);
            const assertedRow = assertion("result", anyResult.row);
            return {
                row: assertedRow,
                fields: anyResult.fields,
            };
        });
    }
    static ToEqualsArray(queryValues) {
        const result = [];
        for (let k in queryValues) {
            if (queryValues.hasOwnProperty(k)) {
                assertQueryKey(k);
                if (queryValues[k] === undefined) {
                    continue;
                }
                result.push(`${mysql.escapeId(k)} = :${k}`);
            }
        }
        return result;
    }
    static ToWhereEquals(queryValues) {
        const arr = Database.ToEqualsArray(queryValues);
        return arr.join(" AND ");
    }
    static ToSet(queryValues) {
        const arr = Database.ToEqualsArray(queryValues);
        return arr.join(",");
    }
    static ToOrderBy(orderByArr) {
        const arr = [];
        for (let i of orderByArr) {
            const order = i[1] ? "ASC" : "DESC";
            arr.push(`${mysql.escapeId(i[0])} ${order}`);
        }
        return arr.join(",");
    }
    static ToInsert(queryValues) {
        const columnArr = [];
        const keyArr = [];
        for (let k in queryValues) {
            if (queryValues.hasOwnProperty(k)) {
                assertQueryKey(k);
                if (queryValues[k] === undefined) {
                    continue;
                }
                columnArr.push(k);
                keyArr.push(`:${k}`);
            }
        }
        return {
            columns: columnArr.join(","),
            keys: keyArr.join(","),
        };
    }
    insertAny(table, row) {
        return __awaiter(this, void 0, void 0, function* () {
            const names = Database.ToInsert(row);
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
    insert(ctor, table, row) {
        return __awaiter(this, void 0, void 0, function* () {
            //Just to be safe
            row = sd.toClass("insert target", row, ctor);
            //TODO Seems like this line can be deleted...
            const queryValues = sd.toRaw("insert target", row);
            return this.insertAny(table, queryValues);
        });
    }
    updateAny(table, row, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            const set = this.queryFormat(Database.ToSet(row), row);
            if (set == "") {
                return {
                    fieldCount: 0,
                    affectedRows: 0,
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
            let where = this.queryFormat(Database.ToWhereEquals(condition), condition);
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
            return new Promise((resolve, reject) => {
                this.rawQuery(queryStr, {}, (err, result) => {
                    if (err == undefined) {
                        if (result == undefined) {
                            reject(new Error(`Expected a result`));
                        }
                        else {
                            resolve(Object.assign({}, result, { row: row, condition: condition }));
                        }
                    }
                    else {
                        reject(err);
                    }
                });
            });
        });
    }
    update(ctor, conditionCtor, table, row, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            //Just to be safe
            row = sd.toClass("update target", row, ctor);
            condition = sd.toClass("update condition", condition, conditionCtor);
            //TODO Seems like this line can be deleted...
            const rowQueryValues = sd.toRaw("update target", row);
            //TODO Seems like this line can be deleted...
            const conditionQueryValues = sd.toRaw("update condition", condition);
            return this.updateAny(table, rowQueryValues, conditionQueryValues);
        });
    }
    updateByNumberId(ctor, table, row, id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.update(ctor, Id, table, row, {
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
                ${Database.ToWhereEquals(queryValues)}
        `;
        return this.rawDelete(queryStr, queryValues);
    }
    getAny(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.selectOneAny(queryStr, queryValues);
            if (result.fields.length != 1) {
                throw new Error(`Expected one field, received ${result.fields.length}`);
            }
            const k = result.fields[0].name;
            const value = result.row[k];
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
                    ${Database.ToWhereEquals(queryValues)}
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
    static Escape(raw, toUTCIfDate = false) {
        if (raw instanceof Date && toUTCIfDate) {
            const year = my_util_1.zeroPad(raw.getUTCFullYear(), 4);
            const month = my_util_1.zeroPad(raw.getUTCMonth() + 1, 2);
            const day = my_util_1.zeroPad(raw.getUTCDate(), 2);
            const hour = my_util_1.zeroPad(raw.getUTCHours(), 2);
            const minute = my_util_1.zeroPad(raw.getUTCMinutes(), 2);
            const second = my_util_1.zeroPad(raw.getUTCSeconds(), 2);
            const ms = my_util_1.zeroPad(raw.getMilliseconds(), 3);
            return mysql.escape(`${year}-${month}-${day} ${hour}:${minute}:${second}.${ms}`);
        }
        else {
            return mysql.escape(raw);
        }
    }
    static EscapeId(raw) {
        return mysql.escapeId(raw);
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
    beginTransaction() {
        return new Promise((resolve, reject) => {
            this.connection.beginTransaction((err) => {
                if (err == undefined) {
                    resolve();
                }
                else {
                    reject(err);
                }
            });
        });
    }
    rollback() {
        return new Promise((resolve, reject) => {
            this.connection.rollback((err) => {
                if (err == undefined) {
                    resolve();
                }
                else {
                    reject(err);
                }
            });
        });
    }
    commit() {
        return new Promise((resolve, reject) => {
            this.connection.commit((err) => {
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
        this.paginationConfiguration = sd.toClass("paginationConfiguration", paginationConfiguration, pagination_1.PaginationConfiguration);
    }
    selectPaginated(ctor, queryStr, queryValues, rawPaginationArgs) {
        return __awaiter(this, void 0, void 0, function* () {
            const paginationArgs = pagination_1.toPaginationArgs(type_util_1.TypeUtil.Coalesce(rawPaginationArgs, {}), this.paginationConfiguration);
            const page = yield this.select(ctor, queryStr
                .replace(`SELECT`, `SELECT SQL_CALC_FOUND_ROWS `)
                .concat(` LIMIT :start, :count`), Object.assign({}, queryValues, { start: pagination_1.getPaginationStart(paginationArgs), count: paginationArgs.itemsPerPage }));
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
    simpleSelectZeroOrOne(ctor, table, queryValues = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectZeroOrOne(ctor, `
                SELECT
                    *
                FROM
                    ${mysql.escapeId(table)}
                WHERE
                    ${Database.ToWhereEquals(queryValues)}
            `, queryValues);
        });
    }
    simpleSelectPaginated(ctor, table, orderBy, queryValues = {}, rawPaginationArgs) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.selectPaginated(ctor, `
                SELECT
                    *
                FROM
                    ${mysql.escapeId(table)}
                WHERE
                    ${Database.ToWhereEquals(queryValues)}
                ORDER BY
                    ${Database.ToOrderBy(orderBy)}
            `, queryValues, rawPaginationArgs);
        });
    }
    utcOnly() {
        return new Promise((resolve) => {
            this.rawQuery("SET time_zone = :offset;", {
                offset: "+00:00",
            }, () => {
                this.connection.config.timezone = "Z";
                this.useUtcOnly = true;
                resolve();
            });
        });
    }
}
exports.Database = Database;
//# sourceMappingURL=Database.js.map