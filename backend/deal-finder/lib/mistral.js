const CHAT_COMPLETIONS_URL = "https://api.mistral.ai/v1/chat/completions";
const RETRY_DELAY_MS = 1500;
const MAX_ATTEMPTS = 4;
// Global throttle: demo-tier keys are limited per request, so parallel
// callers just collide. Every chatJSON() call waits its turn and is spaced
// MIN_GAP_MS from the previous one, regardless of concurrency upstream.
const MIN_GAP_MS = Number(process.env.MISTRAL_MIN_GAP_MS || 2000);
let lastStart = 0;
let queue = Promise.resolve();
function throttle() {
  const turn = queue.then(async () => {
    const gap = lastStart + MIN_GAP_MS - Date.now();
    if (gap > 0) await wait(gap);
    lastStart = Date.now();
  });
  queue = turn.catch(() => {});
  return turn;
} // 429s are common at hackathon-tier rate limits; back off 1.5s, 3s, 4.5s

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function chatJSON({
  model,
  messages,
  maxTokens = 600,
  temperature = 0.2,
} = {}) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is required to call the Mistral API");
  }

  const body = JSON.stringify({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    response_format: { type: "json_object" },
  });

  let response;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    await throttle();
    response = await fetch(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    const retryable = response.status === 429 ||
      (response.status >= 500 && response.status <= 599);
    if (response.ok || !retryable || attempt === MAX_ATTEMPTS - 1) break;
    await wait(RETRY_DELAY_MS * (attempt + 1));
  }

  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(
      `Mistral API request failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`Mistral API returned invalid JSON: ${error.message}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Mistral API response is missing choices[0].message.content");
  }

  let result;
  try {
    result = JSON.parse(content);
  } catch (error) {
    throw new Error(`Mistral response content is not valid JSON: ${error.message}`);
  }

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Mistral response content must be a JSON object");
  }
  return result;
}

module.exports = { chatJSON };
