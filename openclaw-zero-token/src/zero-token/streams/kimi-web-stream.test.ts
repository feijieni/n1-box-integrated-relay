import { describe, expect, it } from "vitest";
import { __testOnlyKimiWebStream } from "./kimi-web-stream.js";

function user(text: string) {
  return {
    role: "user",
    content: [{ type: "text" as const, text }],
  };
}

function assistant(text: string) {
  return {
    role: "assistant",
    content: [{ type: "text" as const, text }],
  };
}

describe("kimi-web-stream prompt planning", () => {
  it("uses the provider session for short continuation turns", () => {
    const plan = __testOnlyKimiWebStream.buildKimiPromptPlan({
      sessionState: {
        sessionId: "chat-1",
        parentMessageId: "assistant-2",
        turnCount: 3,
      },
      messages: [user("old question"), assistant("old answer"), user("latest question")],
      systemPrompt: "You are helpful.",
      tools: [{ name: "shell", description: "Run shell commands" }],
    });

    expect(plan.mode).toBe("continue");
    expect(plan.sessionId).toBe("chat-1");
    expect(plan.parentMessageId).toBe("assistant-2");
    expect(plan.prompt).toContain("latest question");
    expect(plan.prompt).not.toContain("old question");
    expect(plan.prompt).toContain("[SYSTEM HINT]");
  });

  it("rotates to a fresh Kimi session after the turn threshold", () => {
    const messages = [
      user("very old question"),
      assistant("very old answer"),
      user("middle question"),
      assistant("middle answer"),
      user("later question"),
      assistant("later answer"),
      user("recent question"),
      assistant("recent answer"),
      user("latest question"),
    ];

    const plan = __testOnlyKimiWebStream.buildKimiPromptPlan({
      sessionState: {
        sessionId: "chat-1",
        parentMessageId: "assistant-8",
        turnCount: __testOnlyKimiWebStream.constants.KIMI_MAX_PROVIDER_TURNS,
      },
      messages,
      systemPrompt: "You are helpful.",
      tools: [],
    });

    expect(plan.mode).toBe("rotate");
    expect(plan.sessionId).toBeUndefined();
    expect(plan.prompt).toContain("fresh provider-side Kimi session");
    expect(plan.prompt).toContain("latest question");
    expect(plan.prompt).not.toContain("very old question");
  });

  it("keeps tool-result continuations on the same provider session", () => {
    const plan = __testOnlyKimiWebStream.buildKimiPromptPlan({
      sessionState: {
        sessionId: "chat-1",
        parentMessageId: "assistant-tool",
        turnCount: __testOnlyKimiWebStream.constants.KIMI_MAX_PROVIDER_TURNS,
      },
      messages: [
        assistant('<tool_call id="call_1" name="lookup">{"id":1}</tool_call>'),
        {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "lookup",
          content: [{ type: "text" as const, text: "lookup done" }],
        },
      ],
      systemPrompt: "",
      tools: [],
    });

    expect(plan.mode).toBe("continue");
    expect(plan.prompt).toContain("<tool_response");
    expect(plan.prompt).toContain("lookup done");
  });

  it("trims fresh-session history when the aggregated prompt gets too large", () => {
    const longText = "x".repeat(__testOnlyKimiWebStream.constants.KIMI_MAX_FRESH_PROMPT_CHARS);
    const plan = __testOnlyKimiWebStream.buildKimiPromptPlan({
      messages: [
        user(longText),
        assistant("brief answer"),
        user("latest question"),
      ],
      systemPrompt: "You are helpful.",
      tools: [],
    });

    expect(plan.mode).toBe("fresh");
    expect(plan.historyMessagesUsed).toBeLessThanOrEqual(
      __testOnlyKimiWebStream.constants.KIMI_RECENT_HISTORY_LIMIT,
    );
    expect(plan.prompt).toContain("fresh provider-side Kimi session");
    expect(plan.prompt).toContain("latest question");
  });
});

describe("kimi-web-stream recovery helpers", () => {
  it("treats missing conversation-message errors as recoverable", () => {
    expect(
      __testOnlyKimiWebStream.isRecoverableKimiConversationError(
        new Error("Kimi API error: \u4f1a\u8bdd\u6d88\u606f\u4e0d\u5b58\u5728"),
      ),
    ).toBe(true);
  });

  it("does not treat generic transport errors as recoverable", () => {
    expect(
      __testOnlyKimiWebStream.isRecoverableKimiConversationError(new Error("network timeout")),
    ).toBe(false);
  });
});
