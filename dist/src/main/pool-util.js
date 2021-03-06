"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mysql = require("mysql");
const type_util_1 = require("@anyhowstep/type-util");
const my_util_1 = require("./my-util");
function isMySqlPool(mixed) {
    return mixed.config instanceof Object;
}
exports.isMySqlPool = isMySqlPool;
function toPool(args) {
    if (isMySqlPool(args)) {
        return args;
    }
    const connectionConfig = {
        host: args.host,
        database: args.database,
        charset: type_util_1.coalesce(args.charset, "UTF8_GENERAL_CI"),
        user: args.user,
        password: args.password,
        timezone: type_util_1.coalesce(args.timezone, "local"),
        supportBigNumbers: true,
        /*
            Enabling supportBigNumbers but leaving bigNumberStrings
            disabled will return big numbers as String objects only
            when they cannot be accurately represented with
            [JavaScript Number objects] (http://ecma262-5.com/ELS5_HTML.htm#Section_8.5)
            (which happens when they exceed the [-2^53, +2^53] range),
            otherwise they will be returned as Number objects.
        */
        bigNumberStrings: false,
    };
    return mysql.createPool(connectionConfig);
}
exports.toPool = toPool;
function allocatePoolConnection(pool, useUtcOnly) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err != undefined) {
                reject(err);
                return;
            }
            connection.config.queryFormat = my_util_1.createQueryFormatDelegate(useUtcOnly);
            if (useUtcOnly) {
                //TODO Check if this condition is enough to not need to set time_zone
                if (connection.config.timezone == "Z") {
                    resolve(connection);
                }
                else {
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
            }
            else {
                resolve(connection);
            }
        });
    });
}
exports.allocatePoolConnection = allocatePoolConnection;
//# sourceMappingURL=pool-util.js.map