export interface VersionControlItem {
    versioning: boolean;
    remote: string;
    branch?: string;
    status?: {
        staged: any[];
        unstaged: any[];
        untracked: any[];
    };
    lastCommit?: {
        id: string;
        date: string;
        message: string;
        author: string;
    };
    [key: string]: any;
}

export interface CommitResult {
    branch: string;
    commit: string;
    root: boolean;
    summary: {
        added?: number;
        deleted?: number;
        modified?: number;
        [key: string]: any;
    };
    files: {
        added?: string[];
        deleted?: string[];
        modified?: string[];
        [key: string]: any;
    };
    message?: string;
    [key: string]: any;
}

export interface DeploymentResult {
    deployed: boolean;
    workerCount?: number;
    started?: string;
    completed?: string;
    count?: number;
    files?: string[];
    version?: string;
    groupName?: string;
    status?: string;
    error?: string;
    message?: string;
    [key: string]: any;
}

export interface ConfigGroup {
    id: string;
    name?: string;
    description?: string;
    configVersion?: string;
    workerCount?: number;
    isFleet?: boolean;
    isSearch?: boolean;
    deployingWorkerCount?: number;
    incompatibleWorkerCount?: number;
    tags?: string;
    streamtags?: string[];
    git?: {
        commit?: string;
        localChanges?: number;
        log?: any[];
    };
    [key: string]: any;
}

export interface DeployResponse {
    count: number;
    items: ConfigGroup[];
}
