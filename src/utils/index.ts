import * as assertBuiltin from "assert";

export const assert = (condition: boolean, msg: string) => {
    if (typeof assertBuiltin === "function") {
        assertBuiltin(condition, msg);
    } else {
        console.assert(condition, msg);
    }
}