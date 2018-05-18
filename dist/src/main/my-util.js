"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mysql = require("mysql");
function zeroPad(n, length) {
    n = n.toString();
    while (n.length < length) {
        n = "0" + n;
    }
    return n;
}
exports.zeroPad = zeroPad;
function assertQueryKey(k) {
    if (!/^\w+$/.test(k)) {
        throw new Error(`Only alphanumeric, and underscores are allowed to be query keys`);
    }
}
exports.assertQueryKey = assertQueryKey;
function toEqualsArray(queryValues) {
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
exports.toEqualsArray = toEqualsArray;
function toWhereEquals(queryValues) {
    const arr = toEqualsArray(queryValues);
    return arr.join(" AND ");
}
exports.toWhereEquals = toWhereEquals;
function toSet(queryValues) {
    const arr = toEqualsArray(queryValues);
    return arr.join(",");
}
exports.toSet = toSet;
function toOrderBy(orderByArr) {
    const arr = [];
    for (let i of orderByArr) {
        const order = i[1] ? "ASC" : "DESC";
        arr.push(`${mysql.escapeId(i[0])} ${order}`);
    }
    return arr.join(",");
}
exports.toOrderBy = toOrderBy;
function toInsert(queryValues) {
    const columnArr = [];
    const keyArr = [];
    for (let k in queryValues) {
        if (queryValues.hasOwnProperty(k)) {
            assertQueryKey(k);
            if (queryValues[k] === undefined) {
                continue;
            }
            columnArr.push(mysql.escapeId(k));
            keyArr.push(`:${k}`);
        }
    }
    return {
        columns: columnArr.join(","),
        keys: keyArr.join(","),
    };
}
exports.toInsert = toInsert;
function escape(raw, toUTCIfDate = false) {
    if (raw instanceof Date && toUTCIfDate) {
        const year = zeroPad(raw.getUTCFullYear(), 4);
        const month = zeroPad(raw.getUTCMonth() + 1, 2);
        const day = zeroPad(raw.getUTCDate(), 2);
        const hour = zeroPad(raw.getUTCHours(), 2);
        const minute = zeroPad(raw.getUTCMinutes(), 2);
        const second = zeroPad(raw.getUTCSeconds(), 2);
        const ms = zeroPad(raw.getMilliseconds(), 3);
        return mysql.escape(`${year}-${month}-${day} ${hour}:${minute}:${second}.${ms}`);
    }
    else {
        return mysql.escape(raw);
    }
}
exports.escape = escape;
//# sourceMappingURL=my-util.js.map