declare function onchange (matches: string[], command: string, args?: string[], options?: onchange.Options): void;

declare namespace onchange {
  export interface Options {
    exclude?: string[];
    cwd?: string;
    initial?: boolean;
    verbose?: boolean;
    wait?: boolean;
    poll?: boolean | number;
    delay?: number;
    stdout?: any;
    stderr?: any;
    outpipe?: string;
    filter?: string[];
  }
}

export = onchange;
