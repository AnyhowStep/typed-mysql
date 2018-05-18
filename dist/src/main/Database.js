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
const UnsafeQuery_1 = require("./UnsafeQuery");
const ConnectedDatabase_1 = require("./ConnectedDatabase");
const util = require("./my-util");
const __dummySelectResult = undefined;
__dummySelectResult;
const __dummySelectOneResult = undefined;
__dummySelectOneResult;
const __dummySelectZeroOrOneResult = undefined;
__dummySelectZeroOrOneResult;
const __dummyInsertResult = undefined;
__dummyInsertResult;
const __dummyMySqlUpdateResult = undefined;
__dummyMySqlUpdateResult;
const __dummyUpdateResult = undefined;
__dummyUpdateResult;
const __dummyMySqlDeleteResult = undefined;
__dummyMySqlDeleteResult;
const __dummySelectPaginatedResult = undefined;
__dummySelectPaginatedResult;
function insertUnsafeQueries(query, values) {
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
        return insertUnsafeQueries(newQuery, values);
    }
}
exports.insertUnsafeQueries = insertUnsafeQueries;
function createQueryFormatCallback(useUtcOnly) {
    return (query, values) => {
        if (values == undefined) {
            return query;
        }
        query = insertUnsafeQueries(query, values);
        const newQuery = query.replace(/\:(\w+)/g, (_substring, key) => {
            if (values.hasOwnProperty(key)) {
                return Database.Escape(values[key], useUtcOnly);
            }
            throw new Error(`Expected a value for ${key} in query`);
        });
        return newQuery;
    };
}
exports.createQueryFormatCallback = createQueryFormatCallback;
class Database {
    constructor(args) {
        this.useUtcOnly = false;
        //TODO refactor to another package?
        this.allocatingDefaultConnection = false;
        this.onAllocateCallback = [];
        this.queryFormat = (query, values) => {
            return this.getDefaultConnection().queryFormat(query, values);
        };
        const connectionConfig = {
            host: args.host,
            database: args.database,
            charset: type_util_1.TypeUtil.Coalesce(args.charset, "UTF8_GENERAL_CI"),
            user: args.user,
            password: args.password,
            timezone: type_util_1.TypeUtil.Coalesce(args.timezone, "local"),
        };
        this.pool = mysql.createPool(connectionConfig);
    }
    allocatePoolConnection() {
        return new Promise((resolve, reject) => {
            this.pool.getConnection((err, connection) => {
                if (err != undefined) {
                    reject(err);
                    return;
                }
                connection.config.queryFormat = createQueryFormatCallback(this.useUtcOnly);
                if (this.useUtcOnly) {
                    connection.query("SET time_zone = :offset;", {
                        offset: "+00:00",
                    }, (err) => {
                        if (err != undefined) {
                            reject(err);
                            return;
                        }
                        connection.config.timezone = "Z";
                        resolve(connection);
                    });
                }
                else {
                    resolve(connection);
                }
            });
        });
    }
    getOrAllocateDefaultConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.defaultConnection == undefined) {
                if (this.allocatingDefaultConnection) {
                    return new Promise((resolve, reject) => {
                        this.onAllocateCallback.push({
                            onAllocate: resolve,
                            onError: reject,
                        });
                    });
                }
                else {
                    this.allocatingDefaultConnection = true;
                    return new Promise((resolve, reject) => {
                        this.allocatePoolConnection()
                            .then((allocated) => {
                            this.defaultConnection = new ConnectedDatabase_1.ConnectedDatabase(this.useUtcOnly, allocated);
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
            }
            else {
                return this.defaultConnection;
            }
        });
    }
    utcOnly() {
        return __awaiter(this, void 0, void 0, function* () {
            this.useUtcOnly = true;
            if (this.defaultConnection == undefined) {
                yield this.getOrAllocateDefaultConnection();
            }
            else {
                this.defaultConnection.releaseConnection();
                this.defaultConnection = undefined;
                yield this.getOrAllocateDefaultConnection();
            }
        });
    }
    getDefaultConnection() {
        if (this.defaultConnection == undefined) {
            throw new Error(`Call connect() first, or use getOrAllocateDefaultConnection()`);
        }
        return this.defaultConnection;
    }
    getRawConnection() {
        return this.getDefaultConnection().getConnection();
    }
    //TODO Phase out
    static InsertUnsafeQueries(query, values) {
        return insertUnsafeQueries(query, values);
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.getOrAllocateDefaultConnection();
        });
    }
    rawQuery(queryStr, queryValues, callback) {
        return this.getDefaultConnection().rawQuery(queryStr, queryValues, callback);
    }
    selectAny(queryStr, queryValues) {
        return this.getDefaultConnection().selectAny(queryStr, queryValues);
    }
    select(assert, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().select(assert, queryStr, queryValues);
        });
    }
    selectAll(assert, table) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().selectAll(assert, table);
        });
    }
    selectOneAny(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().selectOneAny(queryStr, queryValues);
        });
    }
    selectOne(assert, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().selectOne(assert, queryStr, queryValues);
        });
    }
    selectZeroOrOneAny(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().selectZeroOrOneAny(queryStr, queryValues);
        });
    }
    selectZeroOrOne(assert, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().selectZeroOrOne(assert, queryStr, queryValues);
        });
    }
    //TODO Phase out
    static ToEqualsArray(queryValues) {
        return util.toEqualsArray(queryValues);
    }
    static ToWhereEquals(queryValues) {
        return util.toWhereEquals(queryValues);
    }
    static ToSet(queryValues) {
        return util.toSet(queryValues);
    }
    static ToOrderBy(orderByArr) {
        return util.toOrderBy(orderByArr);
    }
    static ToInsert(queryValues) {
        return util.toInsert(queryValues);
    }
    insertAny(table, row) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().insertAny(table, row);
        });
    }
    insert(assert, table, row) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().insert(assert, table, row);
        });
    }
    rawUpdate(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().rawUpdate(queryStr, queryValues);
        });
    }
    updateAny(table, row, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().updateAny(table, row, condition);
        });
    }
    update(assertRow, assertCondition, table, row, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().update(assertRow, assertCondition, table, row, condition);
        });
    }
    updateByNumberId(assert, table, row, id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().updateByNumberId(assert, table, row, id);
        });
    }
    rawDelete(queryStr, queryValues) {
        return this.getDefaultConnection().rawDelete(queryStr, queryValues);
    }
    //Too dangerous to call this without queryValues or with empty queryValues
    delete(table, queryValues) {
        return this.getDefaultConnection().delete(table, queryValues);
    }
    getAny(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().getAny(queryStr, queryValues);
        });
    }
    get(assertion, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().get(assertion, queryStr, queryValues);
        });
    }
    getBoolean(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().getBoolean(queryStr, queryValues);
        });
    }
    getNumber(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().getNumber(queryStr, queryValues);
        });
    }
    getNaturalNumber(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().getNaturalNumber(queryStr, queryValues);
        });
    }
    getString(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().getString(queryStr, queryValues);
        });
    }
    getDate(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().getDate(queryStr, queryValues);
        });
    }
    exists(table, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().exists(table, queryValues);
        });
    }
    now() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().now();
        });
    }
    static Escape(raw, toUTCIfDate = false) {
        return util.escape(raw, toUTCIfDate);
    }
    static EscapeId(raw) {
        return mysql.escapeId(raw);
    }
    getArrayAny(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().getArrayAny(queryStr, queryValues);
        });
    }
    getArray(assertion, queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().getArray(assertion, queryStr, queryValues);
        });
    }
    getBooleanArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().getBooleanArray(queryStr, queryValues);
        });
    }
    getNumberArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().getNumberArray(queryStr, queryValues);
        });
    }
    getNaturalNumberArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().getNaturalNumberArray(queryStr, queryValues);
        });
    }
    getStringArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().getStringArray(queryStr, queryValues);
        });
    }
    getDateArray(queryStr, queryValues) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().getDateArray(queryStr, queryValues);
        });
    }
    //TODO Phase out
    beginTransaction() {
        return this.getDefaultConnection().beginTransaction();
    }
    //TODO Phase out
    rollback() {
        return this.getDefaultConnection().rollback();
    }
    //TODO Phase out
    commit() {
        return this.getDefaultConnection().commit();
    }
    getPaginationConfiguration() {
        return this.getDefaultConnection().getPaginationConfiguration();
    }
    setPaginationConfiguration(paginationConfiguration) {
        return this.getDefaultConnection().setPaginationConfiguration(paginationConfiguration);
    }
    selectPaginated(assert, queryStr, queryValues, rawPaginationArgs) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().selectPaginated(assert, queryStr, queryValues, rawPaginationArgs);
        });
    }
    simpleSelectZeroOrOne(assert, table, queryValues = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().simpleSelectZeroOrOne(assert, table, queryValues);
        });
    }
    simpleSelectOne(assert, table, queryValues = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().simpleSelectOne(assert, table, queryValues);
        });
    }
    simpleSelectPaginated(assert, table, orderBy, queryValues = {}, rawPaginationArgs) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getDefaultConnection().simpleSelectPaginated(assert, table, orderBy, queryValues, rawPaginationArgs);
        });
    }
    escape(raw) {
        this.getDefaultConnection().escape(raw);
    }
    transaction(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            const allocated = new ConnectedDatabase_1.ConnectedDatabase(this.useUtcOnly, yield this.allocatePoolConnection());
            allocated.setPaginationConfiguration(this.getPaginationConfiguration());
            yield allocated.beginTransaction();
            yield callback(allocated);
            yield allocated.commit();
            allocated.releaseConnection();
        });
    }
}
exports.Database = Database;
//# sourceMappingURL=Database.js.map