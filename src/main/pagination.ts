import {TypeUtil} from "@anyhowstep/type-util";
import * as sd from "schema-decorator";

export const minPage = 0;

@sd.ignoreExtraVariables
export class PaginationConfiguration {
    @sd.assert(sd.naturalNumber())
    defaultPage         : number = 0;
    @sd.assert(sd.naturalNumber())
    maxItemsPerPage     : number = 50;
    @sd.assert(sd.naturalNumber())
    minItemsPerPage     : number = 1;
    @sd.assert(sd.naturalNumber())
    defaultItemsPerPage : number = 20;
}

@sd.ignoreExtraVariables
export class RawPaginationArgs {
    @sd.assert(sd.maybe(sd.naturalNumber()))
    page? : number|null|undefined;
    @sd.assert(sd.maybe(sd.naturalNumber()))
    itemsPerPage? : number|null|undefined;
}

export interface PaginationArgs {
    page : number;
    itemsPerPage : number;
}

export function toPaginationArgs (raw : RawPaginationArgs, configuration : PaginationConfiguration) : PaginationArgs {
    raw = sd.toClassExact("raw", raw, RawPaginationArgs);
    configuration = sd.toClassExact("configuration", configuration, PaginationConfiguration);

    let page = TypeUtil.Coalesce<number>(raw.page, configuration.defaultPage);
    if (page < minPage) {
        page = minPage;
    }

    let itemsPerPage = TypeUtil.Coalesce<number>(raw.itemsPerPage, configuration.defaultItemsPerPage);
    if (itemsPerPage < configuration.minItemsPerPage) {
        itemsPerPage = configuration.minItemsPerPage;
    }
    if (itemsPerPage > configuration.maxItemsPerPage) {
        itemsPerPage = configuration.maxItemsPerPage;
    }
    return {
        page : page,
        itemsPerPage : itemsPerPage,
    };
}

export function getPaginationStart (args : PaginationArgs) : number {
    return args.page * args.itemsPerPage;
}

export function calculatePagesFound (args : PaginationArgs, itemsFound : number) {
    if (itemsFound < 0) {
        return 0;
    }
    if (args.itemsPerPage <= 0) {
        return 0;
    }
    return (
        Math.floor(itemsFound/args.itemsPerPage) +
        (
            (itemsFound%args.itemsPerPage == 0) ?
                0 : 1
        )
    )
}
