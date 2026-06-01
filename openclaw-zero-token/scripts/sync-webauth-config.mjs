import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ZERO_COST = Object.freeze({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
});
const NON_ENV_SECRETREF_MARKER = "secretref-managed";

const WEB_PROVIDER_CATALOG = {
  "claude-web": {
    defaultModelId: "claude-sonnet-4-6",
    provider: {
      baseUrl: "https://claude.ai",
      api: "claude-web",
      models: [
        { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6 (Web)", reasoning: false, input: ["text", "image"], contextWindow: 200000, maxTokens: 8192 },
        { id: "claude-opus-4-6", name: "Claude Opus 4.6 (Web)", reasoning: false, input: ["text", "image"], contextWindow: 200000, maxTokens: 16384 },
        { id: "claude-haiku-4-6", name: "Claude Haiku 4.6 (Web)", reasoning: false, input: ["text", "image"], contextWindow: 200000, maxTokens: 8192 },
      ],
    },
  },
  "chatgpt-web": {
    defaultModelId: "gpt-4",
    provider: {
      baseUrl: "https://chatgpt.com",
      api: "chatgpt-web",
      models: [
        { id: "gpt-4", name: "GPT-4 (Web)", reasoning: false, input: ["text", "image"], contextWindow: 128000, maxTokens: 4096 },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo (Web)", reasoning: false, input: ["text", "image"], contextWindow: 128000, maxTokens: 4096 },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo (Web)", reasoning: false, input: ["text"], contextWindow: 16000, maxTokens: 4096 },
      ],
    },
  },
  "deepseek-web": {
    defaultModelId: "deepseek-chat",
    provider: {
      baseUrl: "https://chat.deepseek.com",
      api: "deepseek-web",
      models: [
        { id: "deepseek-chat", name: "DeepSeek V3 (Web)", reasoning: false, input: ["text"], contextWindow: 64000, maxTokens: 8192 },
        { id: "deepseek-reasoner", name: "DeepSeek R1 (Web)", reasoning: true, input: ["text"], contextWindow: 64000, maxTokens: 8192 },
        { id: "deepseek-chat-search", name: "DeepSeek V3 (Web + Search)", reasoning: false, input: ["text"], contextWindow: 64000, maxTokens: 8192 },
        { id: "deepseek-reasoner-search", name: "DeepSeek R1 (Web + Search)", reasoning: true, input: ["text"], contextWindow: 64000, maxTokens: 8192 },
      ],
    },
  },
  "doubao-web": {
    defaultModelId: "doubao-seed-2.0",
    provider: {
      baseUrl: "https://www.doubao.com",
      api: "doubao-web",
      models: [
        { id: "doubao-seed-2.0", name: "Doubao-Seed 2.0 (Web)", reasoning: true, input: ["text"], contextWindow: 64000, maxTokens: 8192 },
        { id: "doubao-pro", name: "Doubao Pro (Web)", reasoning: false, input: ["text"], contextWindow: 64000, maxTokens: 8192 },
      ],
    },
  },
  "gemini-web": {
    defaultModelId: "gemini-pro",
    provider: {
      baseUrl: "https://gemini.google.com",
      api: "gemini-web",
      models: [
        { id: "gemini-pro", name: "Gemini Pro (Web)", reasoning: false, input: ["text", "image"], contextWindow: 32000, maxTokens: 8192 },
        { id: "gemini-ultra", name: "Gemini Ultra (Web)", reasoning: false, input: ["text", "image"], contextWindow: 32000, maxTokens: 8192 },
      ],
    },
  },
  "glm-web": {
    defaultModelId: "glm-4-plus",
    provider: {
      baseUrl: "https://chatglm.cn",
      api: "glm-web",
      models: [
        { id: "glm-4-plus", name: "GLM-4 Plus (Web)", reasoning: false, input: ["text"], contextWindow: 128000, maxTokens: 4096 },
        { id: "glm-4-think", name: "GLM-4 Think (Web)", reasoning: true, input: ["text"], contextWindow: 128000, maxTokens: 4096 },
      ],
    },
  },
  "glm-intl-web": {
    defaultModelId: "glm-4-plus",
    provider: {
      baseUrl: "https://chat.z.ai",
      api: "glm-intl-web",
      models: [
        { id: "glm-4-plus", name: "GLM-4 Plus (International)", reasoning: false, input: ["text"], contextWindow: 128000, maxTokens: 4096 },
        { id: "glm-4-think", name: "GLM-4 Think (International)", reasoning: true, input: ["text"], contextWindow: 128000, maxTokens: 4096 },
      ],
    },
  },
  "grok-web": {
    defaultModelId: "grok-2",
    provider: {
      baseUrl: "https://grok.com",
      api: "grok-web",
      models: [
        { id: "grok-1", name: "Grok 1 (Web)", reasoning: false, input: ["text"], contextWindow: 32000, maxTokens: 4096 },
        { id: "grok-2", name: "Grok 2 (Web)", reasoning: false, input: ["text"], contextWindow: 32000, maxTokens: 4096 },
      ],
    },
  },
  "kimi-web": {
    defaultModelId: "moonshot-v1-32k",
    provider: {
      baseUrl: "https://www.kimi.com",
      api: "kimi-web",
      models: [
        { id: "moonshot-v1-8k", name: "Moonshot v1 8K (Web)", reasoning: false, input: ["text"], contextWindow: 8000, maxTokens: 4096 },
        { id: "moonshot-v1-32k", name: "Moonshot v1 32K (Web)", reasoning: false, input: ["text"], contextWindow: 32000, maxTokens: 4096 },
        { id: "moonshot-v1-128k", name: "Moonshot v1 128K (Web)", reasoning: false, input: ["text"], contextWindow: 128000, maxTokens: 4096 },
      ],
    },
  },
  "perplexity-web": {
    defaultModelId: "perplexity-web",
    provider: {
      baseUrl: "https://www.perplexity.ai",
      api: "perplexity-web",
      models: [
        { id: "perplexity-web", name: "Perplexity (Sonar)", reasoning: false, input: ["text"], contextWindow: 128000, maxTokens: 4096 },
        { id: "perplexity-pro", name: "Perplexity Pro", reasoning: false, input: ["text"], contextWindow: 128000, maxTokens: 8192 },
      ],
    },
  },
  "qwen-web": {
    defaultModelId: "qwen3.5-plus",
    provider: {
      baseUrl: "https://chat.qwen.ai",
      api: "qwen-web",
      models: [
        { id: "qwen3.5-plus", name: "Qwen 3.5 Plus", reasoning: false, input: ["text"], contextWindow: 32000, maxTokens: 8192 },
        { id: "qwen3.5-turbo", name: "Qwen 3.5 Turbo", reasoning: false, input: ["text"], contextWindow: 32000, maxTokens: 8192 },
      ],
    },
  },
  "qwen-cn-web": {
    defaultModelId: "Qwen3.5-Plus",
    provider: {
      baseUrl: "https://chat2.qianwen.com",
      api: "qwen-cn-web",
      models: [
        { id: "Qwen3.5-Plus", name: "Qwen 3.5 Plus (CN Web)", reasoning: false, input: ["text"], contextWindow: 128000, maxTokens: 4096 },
        { id: "Qwen3.5-Turbo", name: "Qwen 3.5 Turbo (CN Web)", reasoning: false, input: ["text"], contextWindow: 128000, maxTokens: 4096 },
      ],
    },
  },
  "xiaomimo-web": {
    defaultModelId: "xiaomimo-chat",
    provider: {
      baseUrl: "https://aistudio.xiaomimimo.com",
      api: "xiaomimo-web",
      models: [
        { id: "xiaomimo-chat", name: "MiMo Chat", reasoning: false, input: ["text"], contextWindow: 128000, maxTokens: 4096 },
      ],
    },
  },
};

function resolvePaths() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(scriptDir, "..");
  const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(rootDir, ".openclaw-upstream-state");
  const configPath = process.env.OPENCLAW_CONFIG_PATH || path.join(stateDir, "openclaw.json");
  const authStorePath = path.join(stateDir, "agents", "main", "agent", "auth-profiles.json");
  const modelsPath = path.join(stateDir, "agents", "main", "agent", "models.json");
  return { configPath, authStorePath, modelsPath };
}

async function readJson(pathname, fallback) {
  try {
    return JSON.parse(await fs.readFile(pathname, "utf8"));
  } catch {
    return fallback;
  }
}

function extractPrimaryModel(modelConfig) {
  if (!modelConfig) {
    return null;
  }
  if (typeof modelConfig === "string") {
    return modelConfig;
  }
  if (typeof modelConfig === "object" && typeof modelConfig.primary === "string") {
    return modelConfig.primary;
  }
  return null;
}

function cloneProviderConfig(providerId) {
  const entry = WEB_PROVIDER_CATALOG[providerId];
  if (!entry) {
    return null;
  }
  return {
    baseUrl: entry.provider.baseUrl,
    api: entry.provider.api,
    // pi-coding-agent requires custom providers with inline models to declare
    // an apiKey field, even when auth is sourced from auth-profiles.json.
    apiKey: NON_ENV_SECRETREF_MARKER,
    models: entry.provider.models.map((model) => ({
      ...model,
      input: [...model.input],
      cost: { ...ZERO_COST },
    })),
  };
}

function buildAgentModels(providerId, providerConfig) {
  const entries = {};
  for (const model of providerConfig.models) {
    entries[`${providerId}/${model.id}`] = { alias: model.name };
  }
  return entries;
}

function collectAuthorizedProviders(authStore) {
  const profiles = authStore?.profiles ?? {};
  const providerIds = new Set();

  for (const [profileId, profile] of Object.entries(profiles)) {
    const providerId =
      profile && typeof profile === "object" && typeof profile.provider === "string"
        ? profile.provider
        : String(profileId).split(":")[0];
    if (WEB_PROVIDER_CATALOG[providerId]) {
      providerIds.add(providerId);
    }
  }

  return [...providerIds];
}

async function writeJsonWithBackup(pathname, value) {
  try {
    await fs.copyFile(pathname, `${pathname}.bak`);
  } catch {
    // Ignore missing file on first write.
  }
  await fs.writeFile(pathname, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const requestedProviderIds = process.argv.slice(2).filter((id) => WEB_PROVIDER_CATALOG[id]);
  const { configPath, authStorePath, modelsPath } = resolvePaths();

  const authStore = await readJson(authStorePath, { profiles: {} });
  const providerIds = requestedProviderIds.length
    ? requestedProviderIds
    : collectAuthorizedProviders(authStore);

  if (providerIds.length === 0) {
    console.log("[sync-webauth-config] No authorized web providers found.");
    return;
  }

  const config = await readJson(configPath, {});
  const modelsJson = await readJson(modelsPath, { providers: {} });
  config.agents = config.agents && typeof config.agents === "object" ? config.agents : {};
  config.agents.defaults =
    config.agents.defaults && typeof config.agents.defaults === "object"
      ? config.agents.defaults
      : {};
  config.agents.defaults.models =
    config.agents.defaults.models && typeof config.agents.defaults.models === "object"
      ? config.agents.defaults.models
      : {};
  config.models = config.models && typeof config.models === "object" ? config.models : {};
  config.models.providers =
    config.models.providers && typeof config.models.providers === "object"
      ? config.models.providers
      : {};
  modelsJson.providers =
    modelsJson.providers && typeof modelsJson.providers === "object"
      ? modelsJson.providers
      : {};

  for (const providerId of providerIds) {
    const providerConfig = cloneProviderConfig(providerId);
    if (!providerConfig) {
      continue;
    }
    modelsJson.providers[providerId] = providerConfig;
    delete config.models.providers[providerId];
    Object.assign(config.agents.defaults.models, buildAgentModels(providerId, providerConfig));
  }

  const currentPrimary = extractPrimaryModel(config.agents.defaults.model);
  const hasUsablePrimary =
    typeof currentPrimary === "string" &&
    currentPrimary.includes("/") &&
    Boolean(modelsJson.providers[currentPrimary.split("/")[0]]);

  if (!hasUsablePrimary) {
    const fallbackProviderId = providerIds[0];
    const fallbackPrimary = `${fallbackProviderId}/${WEB_PROVIDER_CATALOG[fallbackProviderId].defaultModelId}`;
    const existingFallbacks =
      config.agents.defaults.model &&
      typeof config.agents.defaults.model === "object" &&
      Array.isArray(config.agents.defaults.model.fallbacks)
        ? config.agents.defaults.model.fallbacks
        : undefined;
    config.agents.defaults.model = {
      ...(existingFallbacks ? { fallbacks: existingFallbacks } : {}),
      primary: fallbackPrimary,
    };
  }

  config.meta = config.meta && typeof config.meta === "object" ? config.meta : {};
  config.meta.lastTouchedAt = new Date().toISOString();

  await writeJsonWithBackup(configPath, config);
  await fs.mkdir(path.dirname(modelsPath), { recursive: true });
  await writeJsonWithBackup(modelsPath, modelsJson);
  await fs.chmod(modelsPath, 0o600).catch(() => {});
  console.log(`[sync-webauth-config] Synced providers: ${providerIds.join(", ")}`);
  console.log(`[sync-webauth-config] Default model: ${extractPrimaryModel(config.agents.defaults.model) ?? "-"}`);
}

await main();
