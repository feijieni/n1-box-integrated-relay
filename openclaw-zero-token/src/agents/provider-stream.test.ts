import type { Model } from "@mariozechner/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveProviderStreamFn = vi.fn();
const getWebStreamFactory = vi.fn();
const ensureCustomApiRegistered = vi.fn();

let registerProviderStreamForModel: typeof import("./provider-stream.js").registerProviderStreamForModel;

describe("registerProviderStreamForModel", () => {
  beforeEach(async () => {
    vi.resetModules();
    resolveProviderStreamFn.mockReset();
    getWebStreamFactory.mockReset();
    ensureCustomApiRegistered.mockReset();

    vi.doMock("../plugins/provider-runtime.js", () => ({
      resolveProviderStreamFn,
    }));
    vi.doMock("../zero-token/streams/web-stream-factories.js", () => ({
      getWebStreamFactory,
    }));
    vi.doMock("./custom-api-registry.js", () => ({
      ensureCustomApiRegistered,
    }));

    ({ registerProviderStreamForModel } = await import("./provider-stream.js"));
  });

  it("prefers plugin-owned stream functions", () => {
    const pluginStreamFn = vi.fn(() => "plugin-stream");
    resolveProviderStreamFn.mockReturnValue(pluginStreamFn);

    const model = {
      id: "llama3",
      name: "Llama 3",
      api: "ollama",
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 8192,
      maxTokens: 4096,
    } as Model<"ollama">;

    const result = registerProviderStreamForModel({ model });

    expect(getWebStreamFactory).not.toHaveBeenCalled();
    expect(ensureCustomApiRegistered).toHaveBeenCalledWith("ollama", pluginStreamFn);
    expect(result).toBe(pluginStreamFn);
  });

  it("falls back to zero-token web stream factories with runtime auth", () => {
    const delegatedStreamFn = vi.fn(() => "web-stream");
    const webFactory = vi.fn(() => delegatedStreamFn);
    resolveProviderStreamFn.mockReturnValue(undefined);
    getWebStreamFactory.mockReturnValue(webFactory);

    const model = {
      id: "moonshot-v1-32k",
      name: "Kimi Web",
      api: "kimi-web",
      provider: "kimi-web",
      baseUrl: "https://www.kimi.com",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 32000,
      maxTokens: 4096,
    } as unknown as Model<"openai-responses">;
    const context = { messages: [] };
    const options = { apiKey: '  {"cookie":"abc"}  ' };

    const result = registerProviderStreamForModel({ model });

    expect(result).toBeTypeOf("function");
    expect(ensureCustomApiRegistered).toHaveBeenCalledWith("kimi-web", result);
    expect(result?.(model as never, context as never, options as never)).toBe("web-stream");
    expect(webFactory).toHaveBeenCalledWith('{"cookie":"abc"}');
    expect(delegatedStreamFn).toHaveBeenCalledWith(model, context, options);
  });

  it("returns undefined when no provider stream is available", () => {
    resolveProviderStreamFn.mockReturnValue(undefined);
    getWebStreamFactory.mockReturnValue(undefined);

    const model = {
      id: "moonshot-v1-32k",
      name: "Kimi Web",
      api: "kimi-web",
      provider: "kimi-web",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 32000,
      maxTokens: 4096,
    } as unknown as Model<"openai-responses">;

    expect(registerProviderStreamForModel({ model })).toBeUndefined();
    expect(ensureCustomApiRegistered).not.toHaveBeenCalled();
  });
});
