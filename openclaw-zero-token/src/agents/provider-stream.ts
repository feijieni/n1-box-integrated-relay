import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Api, Model } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../config/config.js";
import { resolveProviderStreamFn } from "../plugins/provider-runtime.js";
import { getWebStreamFactory } from "../zero-token/streams/web-stream-factories.js";
import { ensureCustomApiRegistered } from "./custom-api-registry.js";

function resolveZeroTokenWebStreamFn<TApi extends Api>(model: Model<TApi>): StreamFn | undefined {
  const factory = getWebStreamFactory(model.api);
  if (!factory) {
    return undefined;
  }

  return (runtimeModel, context, options) => {
    const apiKey =
      typeof (options as { apiKey?: unknown } | undefined)?.apiKey === "string"
        ? options.apiKey.trim()
        : "";
    if (!apiKey) {
      throw new Error(`No runtime auth available for provider "${runtimeModel.provider}".`);
    }
    return factory(apiKey)(runtimeModel, context, options);
  };
}

export function registerProviderStreamForModel<TApi extends Api>(params: {
  model: Model<TApi>;
  cfg?: OpenClawConfig;
  agentDir?: string;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): StreamFn | undefined {
  const streamFn = resolveProviderStreamFn({
    provider: params.model.provider,
    config: params.cfg,
    workspaceDir: params.workspaceDir,
    env: params.env,
    context: {
      config: params.cfg,
      agentDir: params.agentDir,
      workspaceDir: params.workspaceDir,
      provider: params.model.provider,
      modelId: params.model.id,
      model: params.model,
    },
  });
  const resolvedStreamFn = streamFn ?? resolveZeroTokenWebStreamFn(params.model);
  if (!resolvedStreamFn) {
    return undefined;
  }
  ensureCustomApiRegistered(params.model.api, resolvedStreamFn);
  return resolvedStreamFn;
}
