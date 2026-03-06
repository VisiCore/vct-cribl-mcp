import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { versionControl, commitPipeline, deployPipeline, getGitDiff } from '../api/versionControl.js';
import { ValidatedArgs, GroupNameArgSchema, resolveGroupName } from './shared.js';

export function registerVersionControlTools(server: McpServer) {
    server.tool(
        'cribl_versionControl',
        'Detects if version control (git) is enabled on the Cribl instance and whether a remote repository URL is configured.',
        {},
        async () => {
            console.error(`[Tool Call] cribl_versionControl`);
            const result = await versionControl();
            if (!result.success || !result.data) {
                console.error(`[Tool Error] cribl_versionControl:`, result.error);
                return { isError: true, content: [{ type: 'text', text: `Error detecting version control: ${result.error}` }] };
            }

            const versionInfo = result.data;
            const isEnabled = versionInfo.versioning === true;
            const remoteUrl = versionInfo.remote || 'None configured';
            const branch = versionInfo.branch || 'unknown';

            console.error(`[Tool Success] cribl_versionControl: enabled=${isEnabled}, remoteUrl=${remoteUrl}, branch=${branch}`);

            if (versionInfo.lastCommit) {
                console.error(`[Tool Success] cribl_versionControl: lastCommit=${versionInfo.lastCommit.id}, message="${versionInfo.lastCommit.message}", author=${versionInfo.lastCommit.author}`);
            }

            if (versionInfo.status) {
                const hasChanges = (
                    (versionInfo.status.staged && versionInfo.status.staged.length > 0) ||
                    (versionInfo.status.unstaged && versionInfo.status.unstaged.length > 0) ||
                    (versionInfo.status.untracked && versionInfo.status.untracked.length > 0)
                );
                console.error(`[Tool Success] cribl_versionControl: hasChanges=${hasChanges}, staged=${versionInfo.status.staged?.length || 0}, unstaged=${versionInfo.status.unstaged?.length || 0}, untracked=${versionInfo.status.untracked?.length || 0}`);
            }

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(versionInfo, null, 2)
                }]
            };
        }
    );

    const CommitPipelineArgsShape = {
        message: z.string().min(1).describe('The commit message.')
    };

    server.tool(
        'cribl_commitPipeline',
        'Commits staged pipeline config changes to version control with a message. Returns detailed commit information including branch, commit ID, and summary of changed files.',
        CommitPipelineArgsShape,
        async (args: ValidatedArgs<typeof CommitPipelineArgsShape>) => {
            console.error(`[Tool Call] cribl_commitPipeline with args:`, args);
            const result = await commitPipeline(args.message);

            if (!result.success || !result.data || !result.data.commit) {
                console.error(`[Tool Error] cribl_commitPipeline:`, result.error || 'No commit information returned.');
                return {
                    isError: true,
                    content: [{
                        type: 'text',
                        text: `Error committing pipeline changes: ${result.error || 'No commit information returned.'}`
                    }]
                };
            }

            const { commit: commitId, branch, summary } = result.data;
            console.error(`[Tool Success] cribl_commitPipeline: commitId=${commitId}, branch=${branch}`);
            if (summary) {
                console.error(`[Tool Success] cribl_commitPipeline: files changed - added=${summary.added || 0}, modified=${summary.modified || 0}, deleted=${summary.deleted || 0}`);
            }

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result.data, null, 2)
                }]
            };
        }
    );

    const DeployPipelineArgsShape = {
        groupName: GroupNameArgSchema,
        version: z.string().min(1).describe('The commit ID (version) to deploy.')
    };

    server.tool(
        'cribl_deployPipeline',
        'Deploys a specific committed configuration version to a worker group. Returns the list of ConfigGroup objects Cribl provides.',
        DeployPipelineArgsShape,
        async (args: ValidatedArgs<typeof DeployPipelineArgsShape>) => {
            console.error(`[Tool Call] cribl_deployPipeline with args:`, args);
            const groupResolution = await resolveGroupName(args.groupName);
            if (groupResolution.error || !groupResolution.groupName) {
                return { isError: true, content: [{ type: 'text', text: groupResolution.error || 'Could not determine group name.' }] };
            }
            const groupName = groupResolution.groupName;
            const { version } = args;

            const result = await deployPipeline(groupName, version);
            if (!result.success || !result.data) {
                console.error(`[Tool Error] cribl_deployPipeline:`, result.error || 'Unknown error');
                return { isError: true, content: [{ type: 'text', text: `Error deploying version ${version}: ${result.error}` }] };
            }

            console.error(`[Tool Success] cribl_deployPipeline: Deployed commit ${version} to group ${groupName}. ConfigGroups returned: ${result.data.count}`);
            return {
                content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }]
            };
        }
    );

    server.tool(
        'cribl_getGitDiff',
        'Shows uncommitted configuration changes (git diff) in the Cribl deployment. Use before cribl_commitPipeline to review what will be committed.',
        {},
        async () => {
            console.error(`[Tool Call] cribl_getGitDiff`);
            const result = await getGitDiff();
            if (!result.success) {
                return { isError: true, content: [{ type: 'text', text: `Error fetching git diff: ${result.error}` }] };
            }
            console.error(`[Tool Success] cribl_getGitDiff`);
            return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
        }
    );
}
