import type { StreamFn } from "@mariozechner/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type TextContent,
  type ThinkingContent,
  type ToolCall,
  type ToolResultMessage,
} from "@mariozechner/pi-ai";
import {
  KimiWebClientBrowser,
  type KimiWebClientOptions,
} from "../providers/kimi-web-client-browser.js";

interface KimiSessionState {
  sessionId: string;
  parentMessageId: string;
  turnCount: number;
}

interface KimiContextMessage {
  role: string;
  content?: unknown;
  toolCallId?: string;
  toolName?: string;
}

interface KimiContextTool {
  name: string;
  description: string;
}

interface KimiPromptPlan {
  mode: "fresh" | "continue" | "rotate";
  prompt: string;
  sessionId?: string;
  parentMessageId?: string;
  historyMessagesUsed: number;
}

const kimiSessionStateMap = new Map<string, KimiSessionState>();

const KIMI_MAX_PROVIDER_TURNS = 12;
const KIMI_RECENT_HISTORY_LIMIT = 8;
const KIMI_MAX_FRESH_PROMPT_CHARS = 24_000;
const KIMI_CONTINUATION_TOOL_HINT =
  '\n\n[SYSTEM HINT]: Keep in mind your available tools. To use a tool, you MUST output the EXACT XML format: <tool_call id="unique_id" name="tool_name">{"arg": "value"}</tool_call>. Using plain text to describe your action will FAIL to execute the tool.';

function extractKimiMessageContent(message: KimiContextMessage): string {
  if (message.role === "toolResult") {
    const toolResult = message as ToolResultMessage;
    let resultText = "";
    if (Array.isArray(toolResult.content)) {
      for (const part of toolResult.content) {
        if (part.type === "text") {
          resultText += part.text;
        }
      }
    }

    return `\n<tool_response id="${toolResult.toolCallId}" name="${toolResult.toolName}">\n${resultText}\n</tool_response>\n`;
  }

  if (Array.isArray(message.content)) {
    let content = "";
    for (const part of message.content) {
      if (part.type === "text") {
        content += part.text;
      } else if (part.type === "thinking") {
        content += `<think>\n${part.thinking}\n</think>\n`;
      } else if (part.type === "toolCall") {
        content += `<tool_call id="${part.id}" name="${part.name}">${JSON.stringify(part.arguments)}</tool_call>`;
      }
    }
    return content;
  }

  if (typeof message.content === "string") {
    return message.content;
  }

  return message.content == null ? "" : String(message.content);
}

function formatKimiHistoryMessage(message: KimiContextMessage): string {
  const role = message.role === "user" || message.role === "toolResult" ? "User" : "Assistant";
  return `${role}: ${extractKimiMessageContent(message)}`;
}

function buildKimiToolPrompt(tools: KimiContextTool[]): string {
  if (tools.length === 0) {
    return "";
  }

  let prompt = "\n## Available Tools\n";
  for (const tool of tools) {
    prompt += `- ${tool.name}: ${tool.description}\n`;
  }
  return prompt;
}

function buildKimiHistoryPrompt(params: {
  messages: KimiContextMessage[];
  systemPrompt: string;
  toolPrompt: string;
  recentMessageLimit?: number;
  includeFreshSessionNote?: boolean;
}): string {
  const selectedMessages = params.recentMessageLimit
    ? params.messages.slice(-params.recentMessageLimit)
    : params.messages;
  const historyParts: string[] = [];
  let systemPromptContent = params.systemPrompt;

  if (params.toolPrompt) {
    systemPromptContent += params.toolPrompt;
  }

  if (systemPromptContent && !selectedMessages.some((message) => message.role === "system")) {
    historyParts.push(`System: ${systemPromptContent}`);
  }

  if (params.includeFreshSessionNote) {
    historyParts.push(
      "System: This is a fresh provider-side Kimi session created to keep latency low. Use the recent transcript below as context and continue naturally.",
    );
  }

  for (const message of selectedMessages) {
    historyParts.push(formatKimiHistoryMessage(message));
  }

  return historyParts.join("\n\n");
}

function buildKimiContinuationPrompt(messages: KimiContextMessage[]): string {
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "toolResult") {
    const toolResult = lastMessage as ToolResultMessage;
    let resultText = "";
    if (Array.isArray(toolResult.content)) {
      for (const part of toolResult.content) {
        if (part.type === "text") {
          resultText += part.text;
        }
      }
    }

    return `\n<tool_response id="${toolResult.toolCallId}" name="${toolResult.toolName}">\n${resultText}\n</tool_response>\n\nPlease proceed based on this tool result.`;
  }

  const lastUserMessage = [...messages].toReversed().find((message) => message.role === "user");
  if (!lastUserMessage) {
    return "";
  }

  if (typeof lastUserMessage.content === "string") {
    return lastUserMessage.content;
  }

  if (Array.isArray(lastUserMessage.content)) {
    return lastUserMessage.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("");
  }

  return lastUserMessage.content == null ? "" : String(lastUserMessage.content);
}

function shouldRotateKimiSession(params: {
  sessionState?: KimiSessionState;
  messages: KimiContextMessage[];
}): boolean {
  if (!params.sessionState) {
    return false;
  }

  const lastMessage = params.messages[params.messages.length - 1];
  if (lastMessage?.role === "toolResult") {
    return false;
  }

  return params.sessionState.turnCount >= KIMI_MAX_PROVIDER_TURNS;
}

function buildKimiPromptPlan(params: {
  messages: KimiContextMessage[];
  systemPrompt: string;
  tools: KimiContextTool[];
  sessionState?: KimiSessionState;
  forceFreshSession?: boolean;
  forceRecentHistory?: boolean;
}): KimiPromptPlan {
  const toolPrompt = buildKimiToolPrompt(params.tools);
  const reusableSession =
    !params.forceFreshSession &&
    !!params.sessionState?.sessionId &&
    !!params.sessionState?.parentMessageId;

  if (reusableSession && shouldRotateKimiSession(params)) {
    return {
      mode: "rotate",
      prompt: buildKimiHistoryPrompt({
        messages: params.messages,
        systemPrompt: params.systemPrompt,
        toolPrompt,
        recentMessageLimit: KIMI_RECENT_HISTORY_LIMIT,
        includeFreshSessionNote: true,
      }),
      historyMessagesUsed: Math.min(params.messages.length, KIMI_RECENT_HISTORY_LIMIT),
    };
  }

  if (reusableSession) {
    let prompt = buildKimiContinuationPrompt(params.messages);
    if (prompt && toolPrompt) {
      prompt += KIMI_CONTINUATION_TOOL_HINT;
    }

    return {
      mode: "continue",
      prompt,
      sessionId: params.sessionState!.sessionId,
      parentMessageId: params.sessionState!.parentMessageId,
      historyMessagesUsed: 1,
    };
  }

  const fullPrompt = buildKimiHistoryPrompt({
    messages: params.messages,
    systemPrompt: params.systemPrompt,
    toolPrompt,
  });
  const shouldTrim = params.forceRecentHistory || fullPrompt.length > KIMI_MAX_FRESH_PROMPT_CHARS;
  if (shouldTrim) {
    return {
      mode: "fresh",
      prompt: buildKimiHistoryPrompt({
        messages: params.messages,
        systemPrompt: params.systemPrompt,
        toolPrompt,
        recentMessageLimit: KIMI_RECENT_HISTORY_LIMIT,
        includeFreshSessionNote:
          params.forceRecentHistory || params.messages.length > KIMI_RECENT_HISTORY_LIMIT,
      }),
      historyMessagesUsed: Math.min(params.messages.length, KIMI_RECENT_HISTORY_LIMIT),
    };
  }

  return {
    mode: "fresh",
    prompt: fullPrompt,
    historyMessagesUsed: params.messages.length,
  };
}

function isRecoverableKimiConversationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\u4f1a\u8bdd\u6d88\u606f\u4e0d\u5b58\u5728|message not found|chat message not found/i.test(
    message,
  );
}

export const __testOnlyKimiWebStream = {
  buildKimiContinuationPrompt,
  buildKimiPromptPlan,
  extractKimiMessageContent,
  isRecoverableKimiConversationError,
  shouldRotateKimiSession,
  constants: {
    KIMI_MAX_PROVIDER_TURNS,
    KIMI_RECENT_HISTORY_LIMIT,
    KIMI_MAX_FRESH_PROMPT_CHARS,
  },
};

export function createKimiWebStreamFn(cookieOrJson: string): StreamFn {
  let options: KimiWebClientOptions;
  try {
    const parsed = JSON.parse(cookieOrJson);
    options = parsed;
  } catch {
    options = { cookie: cookieOrJson, userAgent: "Mozilla/5.0" };
  }

  const client = new KimiWebClientBrowser(options);

  return (model, context, streamOptions) => {
    const stream = createAssistantMessageEventStream();

    const run = async () => {
      try {
        await client.init();

        const sessionKey = (context as unknown as { sessionId?: string }).sessionId || "default";
        const currentState = kimiSessionStateMap.get(sessionKey);
        const messages = ((context.messages || []) as KimiContextMessage[]) || [];
        const systemPrompt = (context as unknown as { systemPrompt?: string }).systemPrompt || "";
        const tools = ((context.tools || []) as KimiContextTool[]) || [];

        let promptPlan = buildKimiPromptPlan({
          messages,
          systemPrompt,
          tools,
          sessionState: currentState,
        });

        if (!promptPlan.prompt) {
          throw new Error("No message found to send to KimiWeb API");
        }

        const requestCompletion = async (plan: KimiPromptPlan) =>
          client.chatCompletions({
            conversationId: plan.sessionId,
            parentMessageId: plan.parentMessageId,
            message: plan.prompt,
            model: model.id,
            signal: streamOptions?.signal,
          });

        console.log(`[KimiWebStream] Starting run for session: ${sessionKey}`);
        console.log(`[KimiWebStream] Mode: ${promptPlan.mode}`);
        console.log(`[KimiWebStream] Conversation ID: ${promptPlan.sessionId || "new"}`);
        console.log(`[KimiWebStream] History messages used: ${promptPlan.historyMessagesUsed}`);
        console.log(`[KimiWebStream] Tools available: ${tools.length}`);
        console.log(`[KimiWebStream] Prompt length: ${promptPlan.prompt.length}`);

        let responseStream: ReadableStream<Uint8Array>;
        try {
          responseStream = await requestCompletion(promptPlan);
        } catch (error) {
          if (promptPlan.mode === "continue" && isRecoverableKimiConversationError(error)) {
            console.warn(
              `[KimiWebStream] Recovering from stale Kimi conversation for ${sessionKey}; starting a fresh provider session.`,
            );
            kimiSessionStateMap.delete(sessionKey);
            promptPlan = buildKimiPromptPlan({
              messages,
              systemPrompt,
              tools,
              forceFreshSession: true,
              forceRecentHistory: true,
            });
            console.log(`[KimiWebStream] Retry mode: ${promptPlan.mode}`);
            console.log(`[KimiWebStream] Retry prompt length: ${promptPlan.prompt.length}`);
            responseStream = await requestCompletion(promptPlan);
          } else {
            throw error;
          }
        }

        const reader = responseStream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const indexMap = new Map<string, number>();
        let nextIndex = 0;
        const contentParts: (TextContent | ThinkingContent | ToolCall)[] = [];
        const accumulatedToolCalls: {
          id: string;
          name: string;
          arguments: string;
          index: number;
        }[] = [];

        const createPartial = (): AssistantMessage => {
          const message: AssistantMessage = {
            role: "assistant",
            content: [...contentParts],
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            stopReason: accumulatedToolCalls.length > 0 ? "toolUse" : "stop",
            timestamp: Date.now(),
          };
          (message as AssistantMessage & { thinking_enabled?: boolean }).thinking_enabled =
            contentParts.some((part) => part.type === "thinking");
          return message;
        };

        let currentMode: "text" | "thinking" | "tool_call" = "text";
        let currentToolName = "";
        let currentToolIndex = 0;
        let tagBuffer = "";
        let nextSessionId: string | undefined;
        let nextParentMessageId: string | undefined;

        const emitDelta = (
          type: "text" | "thinking" | "toolcall",
          delta: string,
          forceId?: string,
        ) => {
          if (delta === "" && type !== "toolcall") {
            return;
          }

          const key = type === "toolcall" ? `tool_${currentToolIndex}` : type;
          if (!indexMap.has(key)) {
            const index = nextIndex++;
            indexMap.set(key, index);
            if (type === "text") {
              contentParts[index] = { type: "text", text: "" };
              stream.push({ type: "text_start", contentIndex: index, partial: createPartial() });
            } else if (type === "thinking") {
              contentParts[index] = { type: "thinking", thinking: "" };
              stream.push({
                type: "thinking_start",
                contentIndex: index,
                partial: createPartial(),
              });
            } else {
              const toolId = forceId || `call_${Date.now()}_${index}`;
              contentParts[index] = {
                type: "toolCall",
                id: toolId,
                name: currentToolName,
                arguments: {},
              };
              accumulatedToolCalls[currentToolIndex] = {
                id: toolId,
                name: currentToolName,
                arguments: "",
                index: currentToolIndex,
              };
              stream.push({
                type: "toolcall_start",
                contentIndex: index,
                partial: createPartial(),
              });
            }
          }

          const index = indexMap.get(key)!;
          if (type === "text") {
            (contentParts[index] as TextContent).text += delta;
            stream.push({
              type: "text_delta",
              contentIndex: index,
              delta,
              partial: createPartial(),
            });
          } else if (type === "thinking") {
            (contentParts[index] as ThinkingContent).thinking += delta;
            stream.push({
              type: "thinking_delta",
              contentIndex: index,
              delta,
              partial: createPartial(),
            });
          } else {
            accumulatedToolCalls[currentToolIndex].arguments += delta;
            stream.push({
              type: "toolcall_delta",
              contentIndex: index,
              delta,
              partial: createPartial(),
            });
          }
        };

        const pushDelta = (delta: string, forceType?: "text" | "thinking") => {
          if (!delta) {
            return;
          }

          if (forceType === "thinking") {
            emitDelta("thinking", delta);
            return;
          }

          tagBuffer += delta;

          const checkTags = () => {
            const thinkStart = tagBuffer.match(/<think\b[^<>]*>/i);
            const thinkEnd = tagBuffer.match(/<\/think\b[^<>]*>/i);
            const toolCallStart = tagBuffer.match(
              /<tool_call\s*(?:id=['"]?([^'"]+)['"]?\s*)?name=['"]?([^'"]+)['"]?\s*>/i,
            );
            const toolCallEnd = tagBuffer.match(/<\/tool_call\s*>/i);

            const indices = [
              {
                type: "think_start",
                idx: thinkStart?.index ?? -1,
                len: thinkStart?.[0].length ?? 0,
              },
              {
                type: "think_end",
                idx: thinkEnd?.index ?? -1,
                len: thinkEnd?.[0].length ?? 0,
              },
              {
                type: "tool_start",
                idx: toolCallStart?.index ?? -1,
                len: toolCallStart?.[0].length ?? 0,
                id: toolCallStart?.[1],
                name: toolCallStart?.[2],
              },
              {
                type: "tool_end",
                idx: toolCallEnd?.index ?? -1,
                len: toolCallEnd?.[0].length ?? 0,
              },
            ]
              .filter((entry) => entry.idx !== -1)
              .toSorted((left, right) => left.idx - right.idx);

            if (indices.length > 0) {
              const first = indices[0];
              const before = tagBuffer.slice(0, first.idx);
              if (before) {
                if (currentMode === "thinking") {
                  emitDelta("thinking", before);
                } else if (currentMode === "tool_call") {
                  emitDelta("toolcall", before);
                } else {
                  emitDelta("text", before);
                }
              }

              if (first.type === "think_start") {
                currentMode = "thinking";
              } else if (first.type === "think_end") {
                currentMode = "text";
              } else if (first.type === "tool_start") {
                currentMode = "tool_call";
                currentToolName = first.name!;
                emitDelta("toolcall", "", first.id);
              } else {
                const index = indexMap.get(`tool_${currentToolIndex}`);
                if (index !== undefined) {
                  const part = contentParts[index] as ToolCall;
                  const rawArguments = accumulatedToolCalls[currentToolIndex].arguments || "{}";

                  let cleanedArguments = rawArguments.trim();
                  if (cleanedArguments.startsWith("```json")) {
                    cleanedArguments = cleanedArguments.substring(7);
                  } else if (cleanedArguments.startsWith("```")) {
                    cleanedArguments = cleanedArguments.substring(3);
                  }
                  if (cleanedArguments.endsWith("```")) {
                    cleanedArguments = cleanedArguments.substring(0, cleanedArguments.length - 3);
                  }
                  cleanedArguments = cleanedArguments.trim();

                  try {
                    part.arguments = JSON.parse(cleanedArguments);
                  } catch (parseError) {
                    part.arguments = { raw: rawArguments };
                    console.error(
                      `[KimiWebStream] Failed to parse JSON for tool call ${currentToolName}:`,
                      rawArguments,
                      "\nError:",
                      parseError,
                    );
                  }

                  stream.push({
                    type: "toolcall_end",
                    contentIndex: index,
                    toolCall: part,
                    partial: createPartial(),
                  });
                }
                currentMode = "text";
                currentToolIndex++;
              }

              tagBuffer = tagBuffer.slice(first.idx + first.len);
              checkTags();
            } else {
              const lastAngle = tagBuffer.lastIndexOf("<");
              if (lastAngle === -1) {
                const mode =
                  currentMode === "thinking"
                    ? "thinking"
                    : currentMode === "tool_call"
                      ? "toolcall"
                      : "text";
                emitDelta(mode, tagBuffer);
                tagBuffer = "";
              } else if (lastAngle > 0) {
                const safe = tagBuffer.slice(0, lastAngle);
                const mode =
                  currentMode === "thinking"
                    ? "thinking"
                    : currentMode === "tool_call"
                      ? "toolcall"
                      : "text";
                emitDelta(mode, safe);
                tagBuffer = tagBuffer.slice(lastAngle);
              }
            }
          };

          checkTags();
        };

        const processLine = (line: string) => {
          if (!line || !line.startsWith("data:")) {
            return;
          }

          const dataString = line.slice(5).trim();
          if (!dataString || dataString === "[DONE]") {
            return;
          }

          try {
            const data = JSON.parse(dataString) as {
              sessionId?: string;
              assistantMessageId?: string;
              choices?: Array<{ delta?: { content?: string } }>;
              text?: string;
              content?: string;
              delta?: string;
            };

            if (typeof data.sessionId === "string" && data.sessionId.trim()) {
              nextSessionId = data.sessionId.trim();
            }
            if (typeof data.assistantMessageId === "string" && data.assistantMessageId.trim()) {
              nextParentMessageId = data.assistantMessageId.trim();
            }

            const delta =
              data.choices?.[0]?.delta?.content ?? data.text ?? data.content ?? data.delta;
            if (typeof delta === "string" && delta) {
              pushDelta(delta);
            }
          } catch {
            // Ignore parse errors on malformed SSE rows.
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              processLine(buffer.trim());
            }
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const combined = buffer + chunk;
          const parts = combined.split("\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            processLine(part.trim());
          }
        }

        if (tagBuffer) {
          const mode =
            currentMode === "thinking"
              ? "thinking"
              : currentMode === "tool_call"
                ? "toolcall"
                : "text";
          emitDelta(mode, tagBuffer);
        }

        if (nextSessionId && nextParentMessageId) {
          kimiSessionStateMap.set(sessionKey, {
            sessionId: nextSessionId,
            parentMessageId: nextParentMessageId,
            turnCount: promptPlan.mode === "continue" ? (currentState?.turnCount ?? 0) + 1 : 1,
          });
        } else {
          kimiSessionStateMap.delete(sessionKey);
          console.warn(
            `[KimiWebStream] Missing conversation metadata after ${promptPlan.mode} response for ${sessionKey}; next turn will start fresh.`,
          );
        }

        console.log(
          `[KimiWebStream] Stream completed. Parts: ${contentParts.length}, Tools: ${accumulatedToolCalls.length}`,
        );

        stream.push({
          type: "done",
          reason: accumulatedToolCalls.length > 0 ? "toolUse" : "stop",
          message: createPartial(),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        stream.push({
          type: "error",
          reason: "error",
          error: {
            role: "assistant",
            content: [],
            stopReason: "error",
            errorMessage,
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            timestamp: Date.now(),
          },
        } as never);
      } finally {
        stream.end();
      }
    };

    queueMicrotask(() => void run());
    return stream;
  };
}
