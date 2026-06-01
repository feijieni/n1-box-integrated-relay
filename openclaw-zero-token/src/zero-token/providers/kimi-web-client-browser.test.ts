import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { __testOnlyKimiWebClientBrowser } from "./kimi-web-client-browser.js";

function createJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

function encodeConnectEnvelope(payload: unknown): Uint8Array {
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const bytes = new Uint8Array(5 + encoded.length);
  bytes[0] = 0x00;
  new DataView(bytes.buffer).setUint32(1, encoded.length, false);
  bytes.set(encoded, 5);
  return bytes;
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

describe("kimi-web-client-browser auth selection", () => {
  it("prefers the authenticated kimi-auth over an anonymous host cookie", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const anonymousToken = createJwt({ exp: nowSeconds + 3600 });
    const authenticatedToken = createJwt({
      exp: nowSeconds + 3600,
      sub: "user-1",
      space_id: "space-1",
      ssid: "ssid-1",
      membership: { level: 10 },
    });

    const selected = __testOnlyKimiWebClientBrowser.selectKimiAuthToken({
      configuredCookieHeader: `theme=light; kimi-auth=${authenticatedToken}`,
      browserCookies: [
        { name: "kimi-auth", value: anonymousToken, domain: "www.kimi.com" },
        { name: "kimi-auth", value: authenticatedToken, domain: ".kimi.com" },
      ],
      nowMs: nowSeconds * 1000,
    });

    expect(selected).toBe(authenticatedToken);
  });

  it("falls back to the fresher browser token when the configured one is expired", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiredConfiguredToken = createJwt({
      exp: nowSeconds - 60,
      sub: "user-1",
      space_id: "space-1",
    });
    const freshBrowserToken = createJwt({
      exp: nowSeconds + 3600,
      sub: "user-2",
      space_id: "space-2",
      membership: { level: 10 },
    });

    const selected = __testOnlyKimiWebClientBrowser.selectKimiAuthToken({
      configuredCookieHeader: `kimi-auth=${expiredConfiguredToken}`,
      browserCookies: [{ name: "kimi-auth", value: freshBrowserToken, domain: ".kimi.com" }],
      nowMs: nowSeconds * 1000,
    });

    expect(selected).toBe(freshBrowserToken);
  });

  it("returns undefined when no kimi-auth candidate is available", () => {
    const selected = __testOnlyKimiWebClientBrowser.selectKimiAuthToken({
      configuredCookieHeader: "theme=light",
      browserCookies: [],
    });

    expect(selected).toBeUndefined();
  });
});

describe("kimi-web-client-browser request and response helpers", () => {
  it("adds chat_id and parent_id when continuing an existing Kimi conversation", () => {
    const request = __testOnlyKimiWebClientBrowser.buildKimiChatRequest({
      message: "continue please",
      scenario: "SCENARIO_K2",
      conversationId: "chat-123",
      parentMessageId: "msg-456",
    });

    expect(request.chat_id).toBe("chat-123");
    expect(request.message.parent_id).toBe("msg-456");
    expect(request.message.blocks[0]?.text.content).toBe("continue please");
  });

  it("parses text plus continuation metadata from connect envelopes", () => {
    const bytes = concatUint8Arrays([
      encodeConnectEnvelope({
        chat: { id: "chat-1" },
        message: { id: "assistant-1", role: "assistant" },
      }),
      encodeConnectEnvelope({
        op: "set",
        block: { text: { content: "你" } },
      }),
      encodeConnectEnvelope({
        op: "append",
        block: { text: { content: "好" } },
      }),
    ]);

    const parsed = __testOnlyKimiWebClientBrowser.parseKimiConnectResponse(bytes);

    expect(parsed).toEqual({
      ok: true,
      sessionId: "chat-1",
      assistantMessageId: "assistant-1",
      text: "你好",
    });
  });

  it("surfaces localized connect errors", () => {
    const bytes = concatUint8Arrays([
      encodeConnectEnvelope({
        error: {
          message: "fallback",
          details: [
            {
              debug: {
                localizedMessage: { message: "\u4f1a\u8bdd\u6d88\u606f\u4e0d\u5b58\u5728" },
              },
            },
          ],
        },
      }),
    ]);

    const parsed = __testOnlyKimiWebClientBrowser.parseKimiConnectResponse(bytes);

    expect(parsed).toEqual({
      ok: false,
      error: "\u4f1a\u8bdd\u6d88\u606f\u4e0d\u5b58\u5728",
    });
  });
});
