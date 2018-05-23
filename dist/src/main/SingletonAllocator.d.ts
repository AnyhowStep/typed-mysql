export interface SingletonAllocatorArgs<T, OnFreeT extends void | Promise<void>> {
    onAllocate(): Promise<T>;
    onFree(resource: T): OnFreeT;
}
export interface OnAllocateDelegate<T> {
    onAllocate: (allocated: T) => void;
    onError: (err: any) => void;
}
export declare class SingletonAllocator<T, OnFreeT extends void | Promise<void>> {
    private allocating;
    private onAllocateDelegates;
    private resource;
    private args;
    constructor(args: SingletonAllocatorArgs<T, OnFreeT>);
    getOrAllocate(): Promise<T>;
    isFree(): boolean;
    free(): OnFreeT;
    getOrError(): T | never;
}
