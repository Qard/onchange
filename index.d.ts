/// <reference types="node" />

declare function onchange (matches: string[], command: string, args?: string[], options?: onchange.Options): void;

declare namespace onchange {
  export interface Options {
    exclude?: string[];
    cwd?: string;
    add?: boolean;
    initial?: boolean;
    verbose?: boolean;
    jobs?: number;
    kill?: boolean;
    poll?: boolean | number;
    delay?: number;
    stdout?: NodeJS.WritableStream;
    stderr?: NodeJS.WritableStream;
    env?: NodeJS.ProcessEnv;
    outpipe?: string;
    filter?: string[];
    awaitWriteFinish?: boolean | number;
  }
}

export = onchange;
