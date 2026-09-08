import { randomUUID } from 'node:crypto';

import {
  type BrowsingSession,
  closeBrowsingSession,
  readStagehandMetrics,
  startBrowsingSession,
} from './browsing.ts';

// Platform-owned credentials: cache at module load then DELETE from process.env so
// user-authored code can never read them. Mirrors the Deno runtime contract.
//
// This only holds because the action is loaded LAZILY (see core()). A static
// `import { invoke } from './ai-generated-code.ts'` here would evaluate the user
// module BEFORE this module body — that is plain ESM order, and esbuild's CJS bundle
// preserves it — so user/AI-authored top-level code would observe every value below
// before a single `delete` ran. Never import the action statically from this file.
const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;
// Platform LLM key + model for AI (Stagehand) browsing. Present only when the
// deployer injected them; the key's presence selects the Stagehand path. The model
// comes from the 'anthropic-stagehand' secret's optional `model` field
// (browsing.ts falls back to its default when absent).
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const STAGEHAND_MODEL = process.env.STAGEHAND_MODEL;
// The shared invoke secret is platform-owned too: it authenticates every call into this
// function, so user code must not be able to read (or leak) it either.
const SECRET_KEY = process.env.BLOCKS_SECRET_KEY;
delete process.env.BROWSERBASE_API_KEY;
delete process.env.BROWSERBASE_PROJECT_ID;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.STAGEHAND_MODEL;
delete process.env.BLOCKS_SECRET_KEY;

const isBrowsingTask = !!BROWSERBASE_API_KEY;

// User secrets arrive as one JSON env blob, never the raw Lambda env, so user code
// can never read the function's execution-role AWS credentials (AWS_* etc.).
function buildUserSecrets(): Record<string, string> {
  try {
    return JSON.parse(process.env.BLOCKS_USER_SECRETS || '{}');
  } catch {
    return {};
  }
}

async function core(event: any): Promise<{ result: any }> {
  // Fail closed: a missing/empty BLOCKS_SECRET_KEY must reject, never accept-all.
  if (!SECRET_KEY || event?.secretKey !== SECRET_KEY) {
    return { result: { success: false, error: 'Unauthorized' } };
  }

  const requestId = event?.requestId || randomUUID();
  const data = event?.payload ?? {};
  const context = event?.context ?? {};
  context.secrets = buildUserSecrets();

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  console.log = (...args: unknown[]) => originalLog(`[${requestId}]`, ...args);
  console.warn = (...args: unknown[]) =>
    originalWarn(`[${requestId}]`, ...args);
  console.error = (...args: unknown[]) =>
    originalError(`[${requestId}]`, ...args);

  let browsingSession: BrowsingSession | undefined;
  let browsingArtifacts:
    | {
        sessionId: string;
        durationMs?: number;
        stagehandMetrics?: {
          promptTokens: number;
          completionTokens: number;
          model: string;
        };
      }
    | undefined;

  let sessionStartedAt = 0;

  try {
    // Loaded here, not at module scope: the platform credentials above are already out of
    // process.env by the time the user module's top-level code runs. esbuild's module
    // registry caches the initializer, so this costs one lookup per invocation.
    const { invoke } = await import('./ai-generated-code.ts');

    let result: any;
    if (isBrowsingTask) {
      sessionStartedAt = Date.now();
      browsingSession = await startBrowsingSession({
        browserbaseApiKey: BROWSERBASE_API_KEY!,
        browserbaseProjectId: BROWSERBASE_PROJECT_ID!,
        anthropicApiKey: ANTHROPIC_API_KEY,
        model: STAGEHAND_MODEL,
      });
      if (browsingSession.sessionId) {
        browsingArtifacts = { sessionId: browsingSession.sessionId };
      }

      result = await invoke(data, context, {
        stagehand: browsingSession.stagehand,
        browser: browsingSession.browser,
        page: browsingSession.page,
        context: browsingSession.context,
      });
      await new Promise((r) => setTimeout(r, 2000));
      // Attach by reference — finally populates durationMs/stagehandMetrics on this object.
      result = { ...result, _browsingArtifacts: browsingArtifacts };
    } else {
      result = await invoke(data, context, {});
    }
    return { result };
  } catch (error) {
    return {
      result: {
        success: false,
        error: String(error),
        stack: (error as Error).stack,
        ...(browsingArtifacts ? { _browsingArtifacts: browsingArtifacts } : {}),
      },
    };
  } finally {
    if (browsingArtifacts) {
      try {
        browsingArtifacts.durationMs = Date.now() - sessionStartedAt;
        // Stagehand (AI path) reports cumulative LLM token usage; undefined on the raw
        // Playwright path. STAGEHAND_MODEL is what those tokens were billed against.
        const metrics = await readStagehandMetrics(browsingSession);
        if (metrics && STAGEHAND_MODEL) {
          browsingArtifacts.stagehandMetrics = {
            ...metrics,
            model: STAGEHAND_MODEL,
          };
        }
      } catch (metricsError) {
        console.warn(
          'failed to capture browsing metrics for billing:',
          String(metricsError),
        );
      }
    }
    await closeBrowsingSession(browsingSession);
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
}

// Buffered handler for direct Invoke (LocalStack + non-streaming). Phase 2 wraps core()
// with awslambda.streamifyResponse for the prod streaming transport.
export const handler = async (event: any) => {
  const { result } = await core(event);
  return result;
};
