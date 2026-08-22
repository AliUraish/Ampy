// lib/llm.js
//
// The one file that talks to Mistral. Every model call in the app —
// the buyer agent's tool loop, negotiation turns, floor estimation,
// photo-to-listing drafts, and the reference seller agent — goes through
// these helpers, so the Mistral-specific wire format lives here and
// nowhere else. (This app previously ran on the Anthropic API; porting it
// meant touching exactly the call sites, because the callers only ever
// dealt in prompts and parsed results. Keep it that way.)
//
// Plain fetch, no SDK: the chat-completions endpoint is simple REST, and
// one less dependency is one less thing to break on hackathon wifi.
//
// THE THREE MISTRAL QUIRKS CALLERS SHOULDN'T HAVE TO KNOW:
//   1. Tools are declared {type:"function", function:{name, description,
//      parameters}} and results go back as role:"tool" messages.
//   2. Tool-call arguments arrive as a JSON *string*, not an object.
//      chatTools() parses them (and hands back {} on garbage).
//   3. There's no schema-enforced output mode we can rely on across
//      plans, so chatJSON() gets JSON mode + the schema embedded in the
//      prompt, then validates shape client-side with one retry.
//
// Rate limits: the free "Experiment" tier allows roughly 1 request/sec.
// An agent loop bursts harder than that, so every call retries on 429/5xx
// with exponential backoff instead of dying mid-run.

const API_URL = "https://api.mistral.ai/v1/chat/completions";

const MODEL = () => process.env.MISTRAL_MODEL || "mistral-medium-latest";
// Pixtral is Mistral's vision family — used only by lib/vision.js.
const VISION_MODEL = () => process.env.MISTRAL_VISION_MODEL || "pixtral-large-latest";
const SEARCH_TOOL = () => process.env.MISTRAL_SEARCH_TOOL || "web_search";

const MAX_RETRIES = 6;
const RETRY_BASE_MS = 2000;
// Minimum spacing between request STARTS, across every caller in the
// process. The free "Experiment" tier allows ~1 request/second; an agent
// loop plus the reference seller agent in the same process bursts well
// past that, and burning all the retries on self-inflicted 429s helps
// nobody. Set to 0 on a paid tier where the limit doesn't bite.
const MIN_INTERVAL_MS = () => Number(process.env.MISTRAL_MIN_INTERVAL_MS ?? 1100);

function apiKey() {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) {
    throw new Error(
      "MISTRAL_API_KEY is not set. Create one at https://console.mistral.ai (API Keys), " +
        "add MISTRAL_API_KEY=... to .env, and restart."
    );
  }
  return key;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Process-wide gate: chains every outbound request so their starts are at
// least MIN_INTERVAL_MS apart, regardless of which helper initiated them.
let gate = Promise.resolve();
let lastStartMs = 0;
function throttled(fn) {
  const run = gate.then(async () => {
    const wait = lastStartMs + MIN_INTERVAL_MS() - Date.now();
    if (wait > 0) await sleep(wait);
    lastStartMs = Date.now();
    return fn();
  });
  gate = run.then(() => {}, () => {}); // failures release the gate too
  return run;
}

/**
 * One chat-completions call, with 429/5xx retry. Returns the raw
 * `choices[0].message` — callers that need more use the helpers below.
 */
async function chat({ model, messages, tools, maxTokens = 1024, temperature, responseFormat }) {
  const body = {
    model: model || MODEL(),
    messages,
    max_tokens: maxTokens,
    ...(tools ? { tools, tool_choice: "auto" } : {}),
    ...(temperature != null ? { temperature } : {}),
    ...(responseFormat ? { response_format: responseFormat } : {}),
  };

  let lastError;
  let retryAfterMs = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff, but if Mistral told us exactly how long to
      // wait (Retry-After), believe it — token-per-minute limits reset on
      // the minute, and guessing shorter just burns an attempt.
      const backoff = RETRY_BASE_MS * 2 ** (attempt - 1) * (0.5 + Math.random());
      await sleep(Math.max(backoff, retryAfterMs));
      retryAfterMs = 0;
    }

    let res;
    try {
      res = await throttled(() =>
        fetch(API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })
      );
    } catch (err) {
      lastError = new Error(`could not reach Mistral: ${err.message}`);
      continue; // network blip — retry
    }

    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get("retry-after"));
      if (Number.isFinite(ra) && ra > 0) retryAfterMs = ra * 1000;
      lastError = new Error(
        `Mistral responded ${res.status} (attempt ${attempt + 1}/${MAX_RETRIES + 1})` +
          (retryAfterMs ? ` — retrying after ${retryAfterMs / 1000}s as instructed` : "")
      );
      continue;
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // 4xx other than 429: retrying won't help — surface the real message.
      const detail = data?.message || data?.error?.message || JSON.stringify(data)?.slice(0, 300);
      throw new Error(`Mistral API error ${res.status}: ${detail}`);
    }

    const message = data?.choices?.[0]?.message;
    if (!message) throw new Error("Mistral returned no choices");
    message._finishReason = data.choices[0].finish_reason;
    return message;
  }

  throw lastError || new Error("Mistral call failed");
}

/** Plain text in, plain text out. */
async function chatText({ model, system, user, messages, maxTokens = 512, temperature }) {
  const msgs = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...(messages || (user != null ? [{ role: "user", content: user }] : [])),
  ];
  const message = await chat({ model, messages: msgs, maxTokens, temperature });
  return contentToText(message.content).trim();
}

// Mistral content is usually a string, but can be an array of chunks
// (notably from pixtral). Normalize either way.
function contentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((c) => (typeof c === "string" ? c : c.text || "")).join("");
  }
  return "";
}

/**
 * Ask for JSON matching a schema. JSON mode guarantees syntactically valid
 * JSON; the schema is embedded in the prompt and required keys are
 * validated here, with one corrective retry — because "valid JSON" and
 * "the JSON you asked for" are different promises.
 */
async function chatJSON({ model, system, user, schema, maxTokens = 1024 }) {
  const schemaNote =
    "\n\nRespond with a single JSON object and nothing else, matching exactly this JSON Schema " +
    "(all required keys present, correct types):\n" +
    JSON.stringify(schema);

  const required = schema?.required || [];
  let lastProblem;

  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await chat({
      model,
      messages: [
        { role: "system", content: (system || "") + schemaNote + (lastProblem ? `\n\nYour previous reply was invalid: ${lastProblem}` : "") },
        { role: "user", content: user },
      ],
      maxTokens,
      responseFormat: { type: "json_object" },
    });

    let parsed;
    try {
      parsed = JSON.parse(contentToText(message.content));
    } catch (err) {
      lastProblem = `not parseable JSON (${err.message})`;
      continue;
    }

    const missing = required.filter((k) => parsed[k] === undefined);
    if (missing.length > 0) {
      lastProblem = `missing required keys: ${missing.join(", ")}`;
      continue;
    }

    return parsed;
  }

  throw new Error(`Mistral did not return valid JSON for the requested schema (${lastProblem})`);
}

/**
 * One turn of a tool-use conversation.
 *
 * Takes tools in the app's neutral shape ({name, description,
 * input_schema}) and a messages array the CALLER owns and appends to.
 * Returns { text, toolCalls: [{id, name, input}], assistantMessage,
 * stopReason } with arguments already parsed.
 */
async function chatTools({ model, system, messages, tools, maxTokens = 2048 }) {
  const message = await chat({
    model,
    messages: [{ role: "system", content: system }, ...messages],
    tools: tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    })),
    maxTokens,
  });

  const toolCalls = (message.tool_calls || []).map((tc) => {
    let input = {};
    try {
      input = typeof tc.function.arguments === "string"
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments || {};
    } catch {
      // Garbage arguments — hand the tool an empty input; its own
      // validation will produce a useful error for the model to react to.
    }
    return { id: tc.id, name: tc.function.name, input };
  });

  return {
    text: contentToText(message.content).trim(),
    toolCalls,
    // Pushed back onto the transcript verbatim so Mistral can pair the
    // role:"tool" results that follow with its own tool_calls ids.
    assistantMessage: { role: "assistant", content: message.content ?? "", tool_calls: message.tool_calls },
    stopReason: message._finishReason,
  };
}

/** A role:"tool" result message for one tool call. */
function toolResult(callId, name, output) {
  return { role: "tool", tool_call_id: callId, name, content: JSON.stringify(output) };
}

module.exports = { chat, chatText, chatJSON, chatTools, toolResult, contentToText, MODEL, VISION_MODEL, SEARCH_TOOL };
