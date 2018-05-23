# `typed-mysql`

Uses `schema-decorator` to ensure the type-correctness of your MySQL queries.

### Installation

`npm install --save typed-mysql`

### Usage

```
import {Database} from "typed-mysql";
import * as sd from "schema-decorator";

class User {
    @sd.assert(sd.naturalNumber())
    id : number = 0;
    @sd.assert(sd.string())
    username : string = "";
}

async function main () {
    const db = new PooledDatabase({
        host     : Configuration.MysqlHost(),
        database : Configuration.MysqlDatabase(),
        charset  : Configuration.MysqlCharset(),
        user     : Configuration.MysqlUser(),
        password : Configuration.MysqlPassword(),
    });

    const user = await db.selectZeroOrOne(
        User,
        `
            SELECT
                id, username
            FROM
                user
            WHERE
                id = :id
        `,
        {
            id : id,
        }
    );
    console.log(user.id, user.username);
}
main()
    .catch((err) => {
        console.error(`Error in main()`, err);
        process.exit(1);
    });
```
