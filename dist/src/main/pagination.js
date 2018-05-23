"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const type_util_1 = require("@anyhowstep/type-util");
const sd = require("schema-decorator");
exports.minPage = 0;
let PaginationConfiguration = class PaginationConfiguration {
    constructor() {
        this.defaultPage = 0;
        this.maxItemsPerPage = 50;
        this.minItemsPerPage = 1;
        this.defaultItemsPerPage = 20;
    }
};
__decorate([
    sd.assert(sd.naturalNumber())
], PaginationConfiguration.prototype, "defaultPage", void 0);
__decorate([
    sd.assert(sd.naturalNumber())
], PaginationConfiguration.prototype, "maxItemsPerPage", void 0);
__decorate([
    sd.assert(sd.naturalNumber())
], PaginationConfiguration.prototype, "minItemsPerPage", void 0);
__decorate([
    sd.assert(sd.naturalNumber())
], PaginationConfiguration.prototype, "defaultItemsPerPage", void 0);
PaginationConfiguration = __decorate([
    sd.ignoreExtraVariables
], PaginationConfiguration);
exports.PaginationConfiguration = PaginationConfiguration;
let RawPaginationArgs = class RawPaginationArgs {
};
__decorate([
    sd.assert(sd.maybe(sd.naturalNumber()))
], RawPaginationArgs.prototype, "page", void 0);
__decorate([
    sd.assert(sd.maybe(sd.naturalNumber()))
], RawPaginationArgs.prototype, "itemsPerPage", void 0);
RawPaginationArgs = __decorate([
    sd.ignoreExtraVariables
], RawPaginationArgs);
exports.RawPaginationArgs = RawPaginationArgs;
function toPaginationArgs(raw, configuration) {
    raw = sd.toClassExact("raw", raw, RawPaginationArgs);
    configuration = sd.toClassExact("configuration", configuration, PaginationConfiguration);
    let page = type_util_1.TypeUtil.Coalesce(raw.page, configuration.defaultPage);
    if (page < exports.minPage) {
        page = exports.minPage;
    }
    let itemsPerPage = type_util_1.TypeUtil.Coalesce(raw.itemsPerPage, configuration.defaultItemsPerPage);
    if (itemsPerPage < configuration.minItemsPerPage) {
        itemsPerPage = configuration.minItemsPerPage;
    }
    if (itemsPerPage > configuration.maxItemsPerPage) {
        itemsPerPage = configuration.maxItemsPerPage;
    }
    return {
        page: page,
        itemsPerPage: itemsPerPage,
    };
}
exports.toPaginationArgs = toPaginationArgs;
function getPaginationStart(args) {
    return args.page * args.itemsPerPage;
}
exports.getPaginationStart = getPaginationStart;
function calculatePagesFound(args, itemsFound) {
    if (itemsFound < 0) {
        return 0;
    }
    if (args.itemsPerPage <= 0) {
        return 0;
    }
    return (Math.floor(itemsFound / args.itemsPerPage) +
        ((itemsFound % args.itemsPerPage == 0) ?
            0 : 1));
}
exports.calculatePagesFound = calculatePagesFound;
//# sourceMappingURL=pagination.js.map