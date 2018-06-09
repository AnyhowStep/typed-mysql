import * as mysql from "mysql";
import {coalesce} from "@anyhowstep/type-util";
import {createQueryFormatDelegate} from "./my-util";

export interface PoolArgs {
    host      : string;
    database  : string;
    charset?  : string; //Default UTF8_GENERAL_CI
    user      : string;
    password  : string;
    timezone? : string; //Default local
}

export function isMySqlPool (mixed : mysql.Pool|PoolArgs) : mixed is mysql.Pool {
    return (mixed as any).config instanceof Object;
}

export function toPool (args : mysql.Pool|PoolArgs) : mysql.Pool {
    if (isMySqlPool(args)) {
        return args;
    }
    const connectionConfig = {
        host     : args.host,
        database : args.database,
        charset  : coalesce(args.charset, "UTF8_GENERAL_CI"),
        user     : args.user,
        password : args.password,
        timezone : coalesce(args.timezone, "local"),
    };
    return mysql.createPool(connectionConfig);
}

export function allocatePoolConnection (pool : mysql.Pool, useUtcOnly : boolean) {
    return new Promise<mysql.PoolConnection>((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err != undefined) {
                reject(err);
                return;
            }
            connection.config.queryFormat = createQueryFormatDelegate(useUtcOnly);
            if (useUtcOnly) {
                //TODO Check if this condition is enough to not need to set time_zone
                if (connection.config.timezone == "Z") {
                    resolve(connection);
                } else {
                    connection.query(
                        "SET time_zone = :offset;",
                        {
                            offset : "+00:00",
                        },
                        (err) => {
                            if (err != undefined) {
                                reject(err);
                                return;
                            }
                            connection.config.timezone = "Z";
                            resolve(connection);
                        }
                    );
                }
            } else {
                resolve(connection);
            }
        });
    });
}
