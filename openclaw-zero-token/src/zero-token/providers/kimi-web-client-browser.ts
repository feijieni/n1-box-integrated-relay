import { Buffer } from "node:buffer";
import { chromium } from "playwright-core";
import type { BrowserContext, Page } from "playwright-core";
import { getHeadersWithAuth } from "../../../extensions/browser/src/browser/cdp.helpers.js";
import {
  getChromeWebSocketUrl,
  launchOpenClawChrome,
  stopOpenClawChrome,
  type RunningChrome,
} from "../../../extensions/browser/src/browser/chrome.js";
import { resolveBrowserConfig, resolveProfile } from "../../../extensions/browser/src/browser/config.js";
import { loadConfig } from "../../config/io.js";
import type { ModelDefinitionConfig } from "../../config/types.models.js";

export interface KimiWebClientOptions {
  cookie: string;
  userAgent?: string;
}

interface KimiChatRequest {
  scenario: string;
  message: {
    role: "user";
    blocks: Array<{
      message_id: string;
      text: { content: string };
    }>;
    scenario: string;
    parent_id?: string;
  };
  options: { thinking: boolean };
  chat_id?: string;
}

interface KimiCookieEntry {
  name: string;
  value: string;
}

interface KimiAuthCandidate {
  value: string;
  source: "browser" | "configured";
  domain?: string;
}

interface KimiJwtPayload {
  exp?: number;
  sub?: string;
  ssid?: string;
  space_id?: string;
  membership?: unknown;
}

type KimiConnectParseResult =
  | {
      ok: true;
      text: string;
      sessionId?: string;
      assistantMessageId?: string;
    }
  | {
      ok: false;
      error: string;
    };

function parseCookieHeader(cookieHeader: string): KimiCookieEntry[] {
  return cookieHeader
    .split(";")
    .map((entry) => {
      const [name, ...valueParts] = entry.trim().split("=");
      const trimmedName = name?.trim() ?? "";
      if (!trimmedName) {
        return null;
      }

      return {
        name: trimmedName,
        value: valueParts.join("=").trim(),
      } satisfies KimiCookieEntry;
    })
    .filter((entry): entry is KimiCookieEntry => entry !== null);
}

function extractCookieValue(cookieHeader: string, name: string): string | undefined {
  return parseCookieHeader(cookieHeader).find((entry) => entry.name === name)?.value;
}

function decodeKimiJwtPayload(token: string): KimiJwtPayload | null {
  const [, payloadPart] = token.split(".");
  if (!payloadPart) {
    return null;
  }

  const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  try {
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? (parsed as KimiJwtPayload) : null;
  } catch {
    return null;
  }
}

function scoreKimiAuthCandidate(candidate: KimiAuthCandidate, nowMs: number): number {
  const payload = decodeKimiJwtPayload(candidate.value);
  let score = candidate.source === "configured" ? 4 : 0;

  if (candidate.domain === ".kimi.com") {
    score += 8;
  } else if (candidate.domain === "www.kimi.com") {
    score += 2;
  }

  if (payload) {
    if (typeof payload.exp === "number") {
      score += payload.exp * 1000 > nowMs ? 40 : -100;
    }
    if (typeof payload.sub === "string" && payload.sub.trim()) {
      score += 20;
    }
    if (typeof payload.space_id === "string" && payload.space_id.trim()) {
      score += 20;
    }
    if (typeof payload.ssid === "string" && payload.ssid.trim()) {
      score += 5;
    }
    if (payload.membership && typeof payload.membership === "object") {
      score += 10;
    }
  }

  return score + Math.min(candidate.value.length, 1024) / 128;
}

function selectKimiAuthToken(params: {
  configuredCookieHeader: string;
  browserCookies: Array<{ name: string; value: string; domain: string }>;
  nowMs?: number;
}): string | undefined {
  const nowMs = params.nowMs ?? Date.now();
  const candidates: KimiAuthCandidate[] = [];
  const configuredToken = extractCookieValue(params.configuredCookieHeader, "kimi-auth");

  if (configuredToken) {
    candidates.push({
      value: configuredToken,
      source: "configured",
      domain: ".kimi.com",
    });
  }

  for (const cookie of params.browserCookies) {
    if (cookie.name !== "kimi-auth" || !cookie.value.trim()) {
      continue;
    }

    candidates.push({
      value: cookie.value,
      source: "browser",
      domain: cookie.domain,
    });
  }

  if (candidates.length === 0) {
    return undefined;
  }

  return candidates
    .toSorted(
      (left, right) => scoreKimiAuthCandidate(right, nowMs) - scoreKimiAuthCandidate(left, nowMs),
    )
    .at(0)?.value;
}

function buildKimiChatRequest(params: {
  message: string;
  scenario: string;
  conversationId?: string;
  parentMessageId?: string;
}): KimiChatRequest {
  const request: KimiChatRequest = {
    scenario: params.scenario,
    message: {
      role: "user",
      blocks: [{ message_id: "", text: { content: params.message } }],
      scenario: params.scenario,
    },
    options: { thinking: false },
  };

  const chatId = params.conversationId?.trim();
  const parentId = params.parentMessageId?.trim();
  if (chatId && parentId) {
    request.chat_id = chatId;
    request.message.parent_id = parentId;
  }

  return request;
}

function parseKimiConnectResponse(bytes: Uint8Array): KimiConnectParseResult {
  const texts: string[] = [];
  let sessionId: string | undefined;
  let assistantMessageId: string | undefined;
  let offset = 0;

  while (offset + 5 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset + 1, 4).getUint32(0, false);
    if (offset + 5 + length > bytes.length) {
      break;
    }

    const chunk = bytes.slice(offset + 5, offset + 5 + length);
    try {
      const obj = JSON.parse(new TextDecoder().decode(chunk)) as {
        error?: {
          message?: string;
          code?: string;
          details?: Array<{ debug?: { localizedMessage?: { message?: string } } }>;
        };
        chat?: { id?: string };
        message?: { id?: string; role?: string };
        block?: { text?: { content?: string } };
        op?: string;
      };

      if (obj.error) {
        const localizedMessage = obj.error.details?.find(
          (detail) => detail?.debug?.localizedMessage?.message,
        )?.debug?.localizedMessage?.message;

        return {
          ok: false,
          error:
            localizedMessage ||
            obj.error.message ||
            obj.error.code ||
            JSON.stringify(obj.error).slice(0, 200),
        };
      }

      const chatId = obj.chat?.id?.trim();
      if (chatId) {
        sessionId = chatId;
      }

      const messageId = obj.message?.id?.trim();
      if (messageId && (!obj.message?.role || obj.message.role === "assistant")) {
        assistantMessageId = messageId;
      }

      const text = obj.block?.text?.content;
      if (text && ["set", "append"].includes(obj.op || "")) {
        texts.push(text);
      }
    } catch {
      // Ignore non-JSON envelopes.
    }

    offset += 5 + length;
  }

  return {
    ok: true,
    text: texts.join(""),
    sessionId,
    assistantMessageId,
  };
}

function resolveKimiScenario(modelId: string): string {
  if (modelId.includes("search")) {
    return "SCENARIO_SEARCH";
  }
  if (modelId.includes("research")) {
    return "SCENARIO_RESEARCH";
  }
  if (modelId.includes("k1")) {
    return "SCENARIO_K1";
  }
  return "SCENARIO_K2";
}

export const __testOnlyKimiWebClientBrowser = {
  buildKimiChatRequest,
  decodeKimiJwtPayload,
  extractCookieValue,
  parseKimiConnectResponse,
  resolveKimiScenario,
  selectKimiAuthToken,
};

export class KimiWebClientBrowser {
  private cookie: string;
  private userAgent: string;
  private baseUrl = "https://www.kimi.com";
  private browser: BrowserContext | null = null;
  private page: Page | null = null;
  private running: RunningChrome | null = null;

  constructor(options: KimiWebClientOptions | string) {
    if (typeof options === "string") {
      try {
        const parsed = JSON.parse(options) as KimiWebClientOptions;
        this.cookie = parsed.cookie;
        this.userAgent = parsed.userAgent || "Mozilla/5.0";
      } catch {
        this.cookie = options;
        this.userAgent = "Mozilla/5.0";
      }
    } else {
      this.cookie = options.cookie;
      this.userAgent = options.userAgent || "Mozilla/5.0";
    }
  }

  private async ensureBrowser() {
    if (this.browser && this.page) {
      return { browser: this.browser, page: this.page };
    }

    const rootConfig = loadConfig();
    const browserConfig = resolveBrowserConfig(rootConfig.browser, rootConfig);
    const profile = resolveProfile(browserConfig, browserConfig.defaultProfile);
    if (!profile) {
      throw new Error(`Could not resolve browser profile '${browserConfig.defaultProfile}'`);
    }

    if (browserConfig.attachOnly) {
      let wsUrl: string | null = null;
      for (let i = 0; i < 10; i++) {
        wsUrl = await getChromeWebSocketUrl(profile.cdpUrl, 2000);
        if (wsUrl) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (!wsUrl) {
        throw new Error(
          `Failed to connect to Chrome at ${profile.cdpUrl}. Make sure Chrome is running in debug mode (./start-chrome-debug.sh)`,
        );
      }

      this.browser = (
        await chromium.connectOverCDP(wsUrl, { headers: getHeadersWithAuth(wsUrl) })
      ).contexts()[0]!;

      const pages = this.browser.pages();
      const kimiPage = pages.find(
        (candidate) => candidate.url().includes("kimi.com") || candidate.url().includes("moonshot.cn"),
      );
      if (kimiPage) {
        this.page = kimiPage;
      } else {
        this.page = await this.browser.newPage();
        await this.page.goto(`${this.baseUrl}/`, { waitUntil: "domcontentloaded" });
      }
    } else {
      this.running = await launchOpenClawChrome(browserConfig, profile);
      const cdpUrl = `http://127.0.0.1:${this.running.cdpPort}`;
      let wsUrl: string | null = null;
      for (let i = 0; i < 10; i++) {
        wsUrl = await getChromeWebSocketUrl(cdpUrl, 2000);
        if (wsUrl) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (!wsUrl) {
        throw new Error(`Failed to resolve Chrome WebSocket URL from ${cdpUrl}`);
      }

      this.browser = (
        await chromium.connectOverCDP(wsUrl, { headers: getHeadersWithAuth(wsUrl) })
      ).contexts()[0]!;
      this.page = this.browser.pages()[0] || (await this.browser.newPage());
    }

    if (this.cookie.trim()) {
      const pageUrl = this.page?.url() ?? this.baseUrl;
      const domain = pageUrl.includes("moonshot.cn") ? ".moonshot.cn" : ".kimi.com";

      const rawCookies = parseCookieHeader(this.cookie).map((entry) => {
        const cookie: {
          name: string;
          value: string;
          domain: string;
          path: string;
          secure?: boolean;
        } = {
          name: entry.name,
          value: entry.value,
          domain,
          path: "/",
        };
        if (entry.name.startsWith("__Secure-") || entry.name.startsWith("__Host-")) {
          cookie.secure = true;
        }
        return cookie;
      });

      if (rawCookies.length > 0) {
        try {
          await this.browser.addCookies(rawCookies);
        } catch (err) {
          console.warn(
            `[Kimi Web] addCookies failed (page may already have session): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    return { browser: this.browser, page: this.page };
  }

  async init() {
    await this.ensureBrowser();
  }

  async chatCompletions(params: {
    conversationId?: string;
    parentMessageId?: string;
    message: string;
    model: string;
    signal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array>> {
    const { browser, page } = await this.ensureBrowser();

    const cookies = await browser.cookies([this.baseUrl]);
    const kimiAuth = selectKimiAuthToken({
      configuredCookieHeader: this.cookie,
      browserCookies: cookies,
    });
    if (!kimiAuth) {
      throw new Error("Kimi: missing kimi-auth cookie; please log into www.kimi.com in Chrome first.");
    }

    const request = buildKimiChatRequest({
      message: params.message,
      scenario: resolveKimiScenario(params.model),
      conversationId: params.conversationId,
      parentMessageId: params.parentMessageId,
    });

    const result = await page.evaluate(
      async ({
        baseUrl,
        kimiAuthToken,
        request,
      }: {
        baseUrl: string;
        kimiAuthToken: string;
        request: KimiChatRequest;
      }) => {
        const encoded = new TextEncoder().encode(JSON.stringify(request));
        const body = new ArrayBuffer(5 + encoded.byteLength);
        const view = new DataView(body);
        view.setUint8(0, 0x00);
        view.setUint32(1, encoded.byteLength, false);
        new Uint8Array(body, 5).set(encoded);

        const response = await fetch(`${baseUrl}/apiv2/kimi.gateway.chat.v1.ChatService/Chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/connect+json",
            "Connect-Protocol-Version": "1",
            Accept: "*/*",
            Origin: baseUrl,
            Referer: `${baseUrl}/`,
            "X-Language": "zh-CN",
            "X-Msh-Platform": "web",
            Authorization: `Bearer ${kimiAuthToken}`,
          },
          body,
        });

        if (!response.ok) {
          const text = await response.text();
          return { ok: false as const, error: text.slice(0, 400) };
        }

        return {
          ok: true as const,
          bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
        };
      },
      {
        baseUrl: this.baseUrl,
        kimiAuthToken: kimiAuth,
        request,
      },
    );

    if (!result.ok) {
      throw new Error(`Kimi API error: ${result.error}`);
    }

    const parsed = parseKimiConnectResponse(new Uint8Array(result.bytes));
    if (!parsed.ok) {
      throw new Error(`Kimi API error: ${parsed.error}`);
    }

    const events: string[] = [];
    if (parsed.sessionId || parsed.assistantMessageId) {
      events.push(
        `data: ${JSON.stringify({
          sessionId: parsed.sessionId,
          assistantMessageId: parsed.assistantMessageId,
        })}\n\n`,
      );
    }
    events.push(`data: ${JSON.stringify({ text: parsed.text })}\n\n`);
    events.push("data: [DONE]\n\n");

    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(events.join("")));
        controller.close();
      },
    });
  }

  async close() {
    if (this.running) {
      await stopOpenClawChrome(this.running);
      this.running = null;
    }

    this.browser = null;
    this.page = null;
  }

  async discoverModels(): Promise<ModelDefinitionConfig[]> {
    return [
      {
        id: "moonshot-v1-32k",
        name: "Moonshot v1 32K",
        api: "kimi-web",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32000,
        maxTokens: 4096,
      },
    ] as ModelDefinitionConfig[];
  }
}
