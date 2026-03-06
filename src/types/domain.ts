export interface CriblPipeline {
    id: string;
    config: any;
}

export interface CriblSource {
    id: string;
}

export interface CriblDestination {
    id: string;
    type?: string;
}

export interface CriblRoute {
    id: string;
    name?: string;
    filter?: string;
    pipeline?: string;
    output?: string;
    enabled?: boolean;
    description?: string;
}

export interface CriblLookup {
    id: string;
    fileInfo?: any;
    [key: string]: any;
}

export interface CriblPack {
    id: string;
    displayName?: string;
    version?: string;
    author?: string;
    [key: string]: any;
}

export interface CriblSample {
    id: string;
    description?: string;
    [key: string]: any;
}

export interface CriblEventBreakerRuleset {
    id: string;
    rules?: any[];
    [key: string]: any;
}

export interface CriblGlobalVariable {
    id: string;
    type?: string;
    value?: any;
    description?: string;
    [key: string]: any;
}

export interface CriblJob {
    id: string;
    status?: string;
    type?: string;
    [key: string]: any;
}

export interface CriblDatasetProvider {
    id: string;
    type?: string;
    [key: string]: any;
}

export interface CriblSystemInfo {
    version?: string;
    build?: string;
    license?: any;
    uptime?: number;
    [key: string]: any;
}

export interface CriblUser {
    id: string;
    username?: string;
    roles?: string[];
    disabled?: boolean;
    [key: string]: any;
}

export interface CriblSearchJob {
    id: string;
    status?: string;
    [key: string]: any;
}

export interface CriblWorker {
    id: string;
    hostname?: string;
    status?: string;
    version?: string;
    cpuUsage?: number;
    memUsage?: number;
    [key: string]: any;
}

export interface CriblWorkerGroup {
    id: string;
    name?: string;
    description?: string;
    isFleet?: boolean;
    isSearch?: boolean;
}

export interface CriblRegexEntry {
    id: string;
    lib?: string;
    regex?: string;
    description?: string;
    [key: string]: any;
}

export interface CriblParser {
    id: string;
    lib?: string;
    description?: string;
    [key: string]: any;
}

export interface CriblSchema {
    id: string;
    lib?: string;
    description?: string;
    [key: string]: any;
}

export interface CriblCollector {
    id: string;
    name?: string;
    version?: string;
    disabled?: boolean;
    destroyable?: boolean;
    [key: string]: any;
}

export interface CriblNotification {
    id: string;
    condition?: string;
    mode?: string;
    disabled?: boolean;
    targets?: any[];
    [key: string]: any;
}
