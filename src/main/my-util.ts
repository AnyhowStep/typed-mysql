import * as mysql from "mysql";
import {QueryValues} from "./QueryValues";
import {OrderByItem} from "./OrderByItem";

export function zeroPad (n : number|string, length : number) {
    n = n.toString();
    while (n.length < length) {
        n = "0" + n;
    }
    return n;
}


export function assertQueryKey (k : string) {
    if (!/^\w+$/.test(k)) {
        throw new Error(`Only alphanumeric, and underscores are allowed to be query keys`);
    }
}
export function toEqualsArray (queryValues : QueryValues) {
    const result : string[] = [];
    for (let k in queryValues) {
        if (queryValues.hasOwnProperty(k)) {
            assertQueryKey(k);
            if ((queryValues as any)[k] === undefined) {
                continue;
            }
            result.push(`${mysql.escapeId(k)} = :${k}`);
        }
    }
    return result;
}
export function toWhereEquals (queryValues : QueryValues) {
    const arr = toEqualsArray(queryValues);
    return arr.join(" AND ");
}
export function toSet (queryValues : QueryValues) {
    const arr = toEqualsArray(queryValues);
    return arr.join(",");
}
export function toOrderBy (orderByArr : OrderByItem[]) {
    const arr : string[] = [];
    for (let i of orderByArr) {
        const order = i[1] ? "ASC" : "DESC";
        arr.push(`${mysql.escapeId(i[0])} ${order}`);
    }
    return arr.join(",");
}
export function toInsert (queryValues : QueryValues) {
    const columnArr : string[] = [];
    const keyArr    : string[] = [];
    for (let k in queryValues) {
        if (queryValues.hasOwnProperty(k)) {
            assertQueryKey(k);
            if ((queryValues as any)[k] === undefined) {
                continue;
            }
            columnArr.push(mysql.escapeId(k));
            keyArr.push(`:${k}`)
        }
    }
    return {
        columns : columnArr.join(","),
        keys : keyArr.join(","),
    };
}
export function escape (raw : any, toUTCIfDate : boolean = false) {
    if (raw instanceof Date && toUTCIfDate) {
        const year  = zeroPad(raw.getUTCFullYear(), 4);
        const month = zeroPad(raw.getUTCMonth()+1, 2);
        const day   = zeroPad(raw.getUTCDate(), 2);

        const hour   = zeroPad(raw.getUTCHours(), 2);
        const minute = zeroPad(raw.getUTCMinutes(), 2);
        const second = zeroPad(raw.getUTCSeconds(), 2);
        const ms     = zeroPad(raw.getMilliseconds(), 3);

        return mysql.escape(`${year}-${month}-${day} ${hour}:${minute}:${second}.${ms}`);
    } else {
        return mysql.escape(raw);
    }
}
