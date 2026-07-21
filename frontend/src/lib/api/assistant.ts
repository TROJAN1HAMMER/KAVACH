import { API_BASE_URL, tokenStorage } from "./client";
import type {
  AssistantDoneEvent,
  AssistantInsufficientContextEvent,
  AssistantRetrievalEvent,
  ChatMessage,
} from "../../types/api";

// Not built on `apiClient` (axios) — axios's response streaming support
// for a POST body in the browser is awkward, and the native `fetch`
// ReadableStream reader below is the standard way to consume
// Server-Sent Events that (unlike EventSource) need a POST body. The
// Authorization header is attached manually since this bypasses
// apiClient's request interceptor.
export interface AssistantStreamCallbacks {
  onRetrieval: (event: AssistantRetrievalEvent) => void;
  onToken: (text: string) => void;
  onInsufficientContext: (event: AssistantInsufficientContextEvent) => void;
  onDone: (event: AssistantDoneEvent) => void;
  onError: (message: string) => void;
}

function dispatchEvent(rawEvent: string, callbacks: AssistantStreamCallbacks) {
  let eventType = "message";
  const dataLines: string[] = [];
  for (const line of rawEvent.split("\n")) {
    if (line.startsWith("event: ")) eventType = line.slice("event: ".length);
    else if (line.startsWith("data: ")) dataLines.push(line.slice("data: ".length));
  }
  // Multi-line SSE payloads carry one "data: " per source line (see
  // backend's `_sse_pack`) — rejoining with "\n" reverses that exactly.
  const data = dataLines.join("\n");
  if (!data && eventType === "message") return;

  switch (eventType) {
    case "retrieval":
      callbacks.onRetrieval(JSON.parse(data));
      break;
    case "token":
      callbacks.onToken(data);
      break;
    case "insufficient_context":
      callbacks.onInsufficientContext(JSON.parse(data));
      break;
    case "done":
      callbacks.onDone(JSON.parse(data));
      break;
    case "error":
      callbacks.onError(data);
      break;
  }
}

export async function streamAssistantChat(
  payload: { message: string; history: ChatMessage[] },
  callbacks: AssistantStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const token = tokenStorage.getAccessToken();
  const response = await fetch(`${API_BASE_URL}/assistant/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok || !response.body) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {
      // response wasn't JSON — keep the generic status-based message
    }
    callbacks.onError(detail);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      dispatchEvent(buffer.slice(0, boundary), callbacks);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
  }
}
