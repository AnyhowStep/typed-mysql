export declare const minPage = 0;
export declare class PaginationConfiguration {
    defaultPage: number;
    maxItemsPerPage: number;
    minItemsPerPage: number;
    defaultItemsPerPage: number;
}
export declare class RawPaginationArgs {
    page?: number | null | undefined;
    itemsPerPage?: number | null | undefined;
}
export interface PaginationArgs {
    page: number;
    itemsPerPage: number;
}
export declare function toPaginationArgs(raw: RawPaginationArgs, configuration: PaginationConfiguration): PaginationArgs;
export declare function getPaginationStart(args: PaginationArgs): number;
export declare function calculatePagesFound(args: PaginationArgs, itemsFound: number): number;
