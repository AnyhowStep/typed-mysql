"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
class SingletonAllocator {
    constructor(args) {
        this.allocating = false;
        this.onAllocateDelegates = [];
        this.resource = undefined;
        this.args = args;
    }
    getOrAllocate() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.resource != undefined) {
                return this.resource;
            }
            if (this.allocating) {
                return new Promise((resolve, reject) => {
                    this.onAllocateDelegates.push({
                        onAllocate: resolve,
                        onError: reject
                    });
                });
            }
            this.allocating = false;
            return new Promise((resolve, reject) => {
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
            });
        });
    }
    isFree() {
        return (this.resource == undefined);
    }
    free() {
        const resource = this.resource;
        if (resource == undefined) {
            throw new Error(`Resource has already been freed`);
        }
        this.resource = undefined;
        return this.args.onFree(resource);
    }
    getOrError() {
        if (this.resource == undefined) {
            throw new Error(`Resource has not been allocated yet, consider using allocateOrGet()`);
        }
        return this.resource;
    }
}
exports.SingletonAllocator = SingletonAllocator;
//# sourceMappingURL=SingletonAllocator.js.map