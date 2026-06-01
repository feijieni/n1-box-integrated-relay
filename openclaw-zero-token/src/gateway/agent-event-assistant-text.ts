import type { AgentEventPayload } from "../infra/agent-events.js";

function appendUniqueSuffix(base: string, suffix: string): string {
  if (!suffix) {
    return base;
  }
  if (!base) {
    return suffix;
  }
  if (base.endsWith(suffix)) {
    return base;
  }

  const maxOverlap = Math.min(base.length, suffix.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (base.slice(-overlap) === suffix.slice(0, overlap)) {
      return base + suffix.slice(overlap);
    }
  }
  return base + suffix;
}

export function resolveAssistantStreamDeltaText(evt: AgentEventPayload): string {
  const delta = evt.data.delta;
  const text = evt.data.text;
  return typeof delta === "string" ? delta : typeof text === "string" ? text : "";
}

export function resolveAssistantMergedText(params: {
  previousText: string;
  nextText: string;
}): string {
  const { previousText, nextText } = params;
  if (!nextText) {
    return previousText;
  }
  if (!previousText) {
    return nextText;
  }
  if (nextText.startsWith(previousText)) {
    return nextText;
  }
  if (previousText.startsWith(nextText)) {
    return previousText;
  }
  return appendUniqueSuffix(previousText, nextText);
}

export function resolveAssistantTextAppend(params: {
  previousText: string;
  nextText: string;
}): string {
  const mergedText = resolveAssistantMergedText(params);
  if (!mergedText) {
    return "";
  }
  if (!params.previousText) {
    return mergedText;
  }
  if (mergedText.startsWith(params.previousText)) {
    return mergedText.slice(params.previousText.length);
  }
  return "";
}

export function resolveAssistantStreamTextUpdate(params: {
  previousText: string;
  evt: AgentEventPayload;
}): { text: string; delta: string } {
  const nextDelta = resolveAssistantStreamDeltaText(params.evt);
  const nextText = typeof params.evt.data.text === "string" ? params.evt.data.text : "";

  if (nextText) {
    const mergedText = resolveAssistantMergedText({
      previousText: params.previousText,
      nextText,
    });
    return {
      text: mergedText,
      delta: resolveAssistantTextAppend({
        previousText: params.previousText,
        nextText: mergedText,
      }),
    };
  }

  if (nextDelta) {
    const mergedText = appendUniqueSuffix(params.previousText, nextDelta);
    return {
      text: mergedText,
      delta: mergedText.startsWith(params.previousText)
        ? mergedText.slice(params.previousText.length)
        : nextDelta,
    };
  }

  return { text: params.previousText, delta: "" };
}
