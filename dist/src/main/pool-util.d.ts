import * as mysql from "mysql";
export interface PoolArgs {
    host: string;
    database: string;
    charset?: string;
    user: string;
    password: string;
    timezone?: string;
}
export declare function isMySqlPool(mixed: mysql.Pool | PoolArgs): mixed is mysql.Pool;
export declare function toPool(args: mysql.Pool | PoolArgs): mysql.Pool;
export declare function allocatePoolConnection(pool: mysql.Pool, useUtcOnly: boolean): Promise<mysql.PoolConnection>;
