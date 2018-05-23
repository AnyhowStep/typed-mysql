export interface SingletonAllocatorArgs<T, OnFreeT extends void|Promise<void>> {
    onAllocate () : Promise<T>;
    onFree (resource : T) : OnFreeT;
}
export interface OnAllocateDelegate<T> {
    onAllocate : (allocated : T) => void,
    onError : (err : any) => void,
}

export class SingletonAllocator<T, OnFreeT extends void|Promise<void>> {
    private allocating = false;
    private onAllocateDelegates : OnAllocateDelegate<T>[] = [];
    private resource : T|undefined = undefined;
    private args : SingletonAllocatorArgs<T, OnFreeT>;

    public constructor (args : SingletonAllocatorArgs<T, OnFreeT>) {
        this.args = args;
    }
    public async getOrAllocate () : Promise<T> {
        if (this.resource != undefined) {
            return this.resource;
        }
        if (this.allocating) {
            return new Promise<T>((resolve, reject) => {
                this.onAllocateDelegates.push({
                    onAllocate : resolve,
                    onError : reject
                });
            });
        }
        this.allocating = false;
        return new Promise<T>((resolve, reject) => {
            this.args.onAllocate()
                .then((resource) => {
                    this.resource = resource;
                    this.allocating = false;

                    resolve(resource);

                    //We swap out the delegates in case they call allocateOrGet()
                    //inside `onAllocate()`
                    const delegates = this.onAllocateDelegates;
                    this.onAllocateDelegates = [];
                    for (let d of delegates) {
                        d.onAllocate(resource);
                    }
                })
                .catch((err) => {
                    this.allocating = false;

                    reject(err);

                    //We swap out the delegates in case they call allocateOrGet()
                    //inside `onError()`
                    const delegates = this.onAllocateDelegates;
                    this.onAllocateDelegates = [];
                    for (let d of delegates) {
                        d.onError(err);
                    }
                });
        })
    }

    public isFree () : boolean {
        return (this.resource == undefined);
    }

    public free () : OnFreeT {
        const resource = this.resource;
        if (resource == undefined) {
            throw new Error(`Resource has already been freed`);
        }
        this.resource = undefined;
        return this.args.onFree(resource);
    }

    public getOrError () : T|never {
        if (this.resource == undefined) {
            throw new Error(`Resource has not been allocated yet, consider using allocateOrGet()`);
        }
        return this.resource;
    }
}
