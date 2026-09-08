// eslint-disable-next-line import/no-extraneous-dependencies -- axios is supplied by the Lambda bundler.
import axios from 'axios';

import { blocksClientMappings } from './blocks-client-mappings.ts';

/**
 * Represents a user's data
 * @interface User
 * @property {string} [id] - The user's ID (optional, must exist if user is authenticated)
 * @property {string} [tenantId] - The user's tenant ID (optional, only exists if user is authenticated and app is multi-tenant)
 * @property {string} [name] - The user's name (optional, must exist if user is authenticated)
 * @property {string} [firstName] - The user's first name (optional, must exist if user is authenticated)
 * @property {string} [lastName] - The user's last name (optional, must exist if user is authenticated)
 * @property {string} [email] - The user's email (optional, must exist if user is authenticated)
 * @property {Date} [createdAt] - The user creation time
 * @property {Date} [updatedAt] - The user last update time
 * @property {string} [permission] - The user's permission use/build (optional, must exist if user is authenticated)
 * @property {string} [profileImageUrl] - The user's profile image URL (optional)
 * @property {string} [role] - The user's role name (optional)
 * @property {boolean} [isAuthenticated] - true if the user is authenticated, false otherwise
 */
export interface User {
  id: string;
  tenantId?: string;
  name: string | null;
  firstName: string | undefined;
  lastName: string | undefined;
  email: string;
  createdAt: Date;
  updatedAt: Date | null;
  permission: string | null;
  profileImageUrl?: string | null;
  role?: string;
  isAuthenticated?: boolean;
}

// the blocks context passed as 2nd parameter to the code action entry point `invoke` method
interface BlocksContext {
  token: string;
  appId: string;
  userId: number;
  accountId: number;
  secrets: Record<string, string>;
  mainWorkflowId: string;
  appVersion?: number;
}

const ACTION_RESULT_MEDIA_TYPE = 'application/vnd.blocks.action-result.v1+json';

// A clause is either a single condition (`column` + `value`) or a group (`and` / `or`)
// of nested clauses. Everything is optional, so write only the parts you need:
//   { column: 'status', value: 'open' }
//   { and: [{ column: 'checkId', value: id }, { column: 'documentName', value: name }] }
// Parts that appear together are AND-ed, so `{ column, value, and: [...] }` means
// "this condition AND all of these" - but the nested form above reads clearer.
export interface WhereClause {
  column?: string; // Column name to filter, can be prefixed with table alias
  operator?:
    | '='
    | '>'
    | '>='
    | '<'
    | '<='
    | '!='
    | 'in'
    | 'not in'
    | 'is null'
    | 'is not null'; // Default: '='
  value?: any; // Column value ('in' / 'not in' take an array; null checks take none)
  and?: WhereClause[]; // Array of conditions that must all be true (AND operation)
  or?: WhereClause[]; // Array of conditions where at least one must be true (OR operation)
  not?: boolean; // Negates this clause (NOT operation)
}

export interface QueryOptions {
  from: {
    table: string; // Table Name
    as?: string; // Table alias
  };
  join?: {
    table: string; // Table Name
    as?: string; // Table alias
    type?: 'inner' | 'left' | 'right' | 'full'; // Default: 'inner'
    on: {
      left: string; // Column from the main table, can be prefixed with table alias
      right: string; // Column from the joined table, can be prefixed with table alias
      operator?: '=' | '>' | '>=' | '<' | '<=' | '!=' | 'in'; // Default: '='
    }[];
  }[];
  select?: {
    column: string; // Column name to select, can be prefixed with table alias
    as?: string; // Alias for the column
    function?: 'count' | 'sum' | 'avg' | 'min' | 'max'; // Default: undefined
  }[];
  where?: WhereClause;
  groupBy?: string[]; // list of column names, can be prefixed with table alias
  orderBy?: {
    column: string; // Column name to order by, can be prefixed with table alias
    direction?: 'asc' | 'desc'; // Default: 'asc'
  }[];
  limit?: number; // Max number of rows to return
  offset?: number; // Starting offset for pagination
}

export type Item = Record<string, any>;

export class BlocksClient {
  private readonly basePath: string;
  private readonly context: BlocksContext;
  constructor(context: BlocksContext) {
    this.basePath = process.env.BLOCKS_BASE_PATH as string;
    this.context = context;
  }

  private async apiCall(
    method: string,
    url: string,
    data?: any,
    streamAction = false,
  ) {
    const finalUrl = `${this.basePath}${url}`;

    const response = await axios.request({
      method,
      url: finalUrl,
      data: data ? JSON.stringify(data) : undefined,
      headers: {
        ...(streamAction
          ? { Accept: ACTION_RESULT_MEDIA_TYPE, 'Accept-Encoding': 'identity' }
          : {}),
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.context.token}`,
        'x-app-id': this.context.appId,
        'x-app-version': this.context.appVersion,
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      },
      validateStatus: () => true, // Accept any status code without throwing
    });

    if (response.status >= 300) {
      const msg = `Failed to ${method} call ${url}: ${response.statusText}`;
      console.error(msg);
      throw new Error(msg);
    }
    if (
      streamAction &&
      response.headers['content-type']?.split(';')[0].trim() ===
        ACTION_RESULT_MEDIA_TYPE
    ) {
      const envelope = response.data;
      if (
        !envelope ||
        typeof envelope !== 'object' ||
        typeof envelope.ok !== 'boolean'
      ) {
        throw new Error('Invalid action response');
      }
      if (!envelope.ok) {
        if (typeof envelope.error?.message !== 'string') {
          throw new Error('Invalid action error response');
        }
        throw new Error(
          `Action failed (HTTP ${envelope.error.statusCode}): ${envelope.error.message}`,
        );
      }
      return envelope.output;
    }
    // An older server ignores Accept and still returns the original JSON result.
    return response.data;
  }

  async invokeAction(actionName: string, input: any) {
    const actionId = blocksClientMappings[actionName];
    if (!actionId) {
      throw new Error(`action ${actionName} not found`);
    }
    // The ref must occupy exactly ONE path segment. Under the unified (v2) block model it is a
    // named ref (`productSlug/BlockName`, plus `&`-joined segments for a table-ops tool), and
    // wf-service serves only single-segment `:workflowId` routes — a raw `/` becomes a second
    // segment and matches no route (404). Encoded, it round-trips: Express decodes the param
    // and blocks-store resolves the qualified ref. Same contract wf-service already enforces on
    // its own outbound calls (blocks-store-url.util.ts). Byte-identical for a plain block id,
    // so apps on the older block model keep the exact URL they use today; their `&`-joined
    // composites become `%26`, which the route decodes back before splitting on `&`.
    const response = await this.apiCall(
      'POST',
      `/workflow/api/${encodeURIComponent(actionId)}`,
      {
        input,
        context: {
          appId: this.context.appId,
          mainWorkflowId: this.context.mainWorkflowId,
        },
      },
      true,
    );
    return response;
  }

  async generateFileSignedUrl(
    fileUrl: string,
  ): Promise<{ signedUrl: string; expiration: Date }> {
    const response = await this.invokeAction('GenerateFileSignedUrl', {
      fileUrl,
    });

    return response;
  }

  async getCurrentUser(): Promise<{ user: User }> {
    const response = await this.apiCall('GET', `/app-users/api/current`);
    return { user: response };
  }

  async createItem(tableName: string, item: Item): Promise<{ item: Item }> {
    const response = await this.apiCall(
      'POST',
      `/data/api/tables/${tableName}/items`,
      [item],
    );
    return { item: response.items[0] };
  }

  async createItems(
    tableName: string,
    items: Item[],
  ): Promise<{ items: Item[] }> {
    const response = await this.apiCall(
      'POST',
      `/data/api/tables/${tableName}/items`,
      items,
    );
    return response;
  }

  async getItem(tableName: string, itemId: string): Promise<{ item: Item }> {
    const response = await this.apiCall(
      'GET',
      `/data/api/tables/${tableName}/items/${itemId}`,
    );
    return response;
  }

  async updateItem(
    tableName: string,
    itemId: string,
    item: Item,
  ): Promise<{ item: Item }> {
    const response = await this.apiCall(
      'PUT',
      `/data/api/tables/${tableName}/items/${itemId}`,
      item,
    );
    return response;
  }

  async updateItems(
    tableName: string,
    items: Item[],
  ): Promise<{ items: Item[] }> {
    const response = await this.apiCall(
      'PUT',
      `/data/api/tables/${tableName}/items`,
      { items },
    );
    return response;
  }

  async deleteItem(
    tableName: string,
    itemId: string,
  ): Promise<{ itemId: string }> {
    const response = await this.apiCall(
      'DELETE',
      `/data/api/tables/${tableName}/items/${itemId}`,
    );
    return response;
  }

  async deleteItems(
    tableName: string,
    body: { where: WhereClause },
  ): Promise<{ itemIds: string[] }> {
    const response = await this.apiCall(
      'POST',
      `/data/api/tables/${tableName}/items/delete`,
      body,
    );
    return response;
  }

  async queryTable(
    tableName: string,
    query: QueryOptions,
  ): Promise<{ items: Item[] }> {
    const response = await this.apiCall(
      'POST',
      `/data/api/tables/${tableName}/query`,
      query,
    );
    return response;
  }
}
