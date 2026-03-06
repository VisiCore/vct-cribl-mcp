import { z, ZodRawShape } from 'zod';
import { listWorkerGroups } from '../api/workers.js';

// Helper type for validated args based on Zod schema shape
export type ValidatedArgs<T extends ZodRawShape> = z.infer<z.ZodObject<T>>;

// Reusable schema for optional groupName: preprocess null to undefined, validate as optional string
export const GroupNameArgSchema = z.preprocess(
  (val) => (val === null ? undefined : val),
  z.string().optional()
).describe(
  "Optional: The name of the Worker Group/Fleet. If omitted, defaults to attempting to use Cribl Stream and if only one group exists for Stream, it will use that sole group."
);

export type ProductType = 'stream' | 'edge' | 'search';

// Shared predicate for filtering worker groups by product type
export function filterGroupsByProductType(groups: any[], productType: ProductType): any[] {
    return groups.filter(group => {
        if (productType === 'stream') return !group.isFleet && !group.isSearch;
        if (productType === 'edge') return group.isFleet === true;
        if (productType === 'search') return group.isSearch === true;
        return false;
    });
}

// Helper function for group name resolution; expects string or undefined
export async function resolveGroupName(providedGroupName?: string, defaultProductType: ProductType = 'stream'): Promise<{ groupName?: string; error?: string }> {
    const listResult = await listWorkerGroups();
    if (!listResult.success || !listResult.data) {
        const errorMsg = `Failed to list worker groups: ${listResult.error || 'Unknown error'}`;
        console.error(`[stderr] ${errorMsg}`);
        return { error: errorMsg };
    }
    const allGroups = listResult.data;
    const allGroupIds = allGroups.map(g => g.id);

    if (providedGroupName) {
        if (!allGroupIds.includes(providedGroupName)) {
            const errorMsg = `Worker group '${providedGroupName}' not found. Available groups are: [${allGroupIds.join(', ')}]`;
            console.error(`[stderr] Error: ${errorMsg}`);
            return { error: errorMsg };
        }
        console.error(`[stderr] Using provided valid group name: ${providedGroupName}`);
        return { groupName: providedGroupName };
    }

    console.error(`[stderr] Group name not provided, attempting lookup for default product '${defaultProductType}'...`);
    const filteredGroups = filterGroupsByProductType(allGroups, defaultProductType);

    if (filteredGroups.length === 1) {
        const resolvedName = filteredGroups[0].id;
        console.error(`[stderr] Found single worker group for product '${defaultProductType}': ${resolvedName}, using it as default.`);
        return { groupName: resolvedName };
    } else if (filteredGroups.length === 0) {
         const errorMsg = `No worker groups found for default product type '${defaultProductType}'. Please specify a groupName. Available groups are: [${allGroupIds.join(', ')}]`;
         console.error(`[stderr] Error: ${errorMsg}`);
         return { error: errorMsg };
    } else {
        const filteredGroupIds = filteredGroups.map(g => g.id);
        const errorMsg = `Multiple worker groups found for default product type '${defaultProductType}': [${filteredGroupIds.join(', ')}]. Please specify the 'groupName' argument.`;
        console.error(`[stderr] Error: ${errorMsg}`);
        return { error: errorMsg };
    }
}
