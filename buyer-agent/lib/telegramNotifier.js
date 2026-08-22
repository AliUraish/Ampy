// lib/telegramNotifier.js
//
// Thin wrapper around Telegram's official Bot API (https://api.telegram.org)
// — plain HTTP calls, no SDK needed for something this small. This is the
// piece that was previously stubbed out in lib/repostScheduler.js's
// comments; it's now real. Telegram's Bot API is official and intended for
// exactly this kind of automation (unlike Craigslist, which has no posting
// API and explicitly prohibits automated posting — see the seller-portal
// docs / README for why this app never posts to Craigslist itself).
//
// Requires TELEGRAM_BOT_TOKEN (and TELEGRAM_CHAT_ID to know who to notify)
// in the environment. Both are optional — every function here degrades to
// a no-op with a logged warning if they're missing, so the app runs fine
// without a Telegram bot configured at all (matches this app's existing
// "never crash the server over an optional integration" pattern — see
// lib/craigslistFetcher.js).
//
// Setup: message @BotFather on Telegram, /newbot, follow the prompts —
// that gives you TELEGRAM_BOT_TOKEN. To get TELEGRAM_CHAT_ID, message your
// new bot anything, then GET
// https://api.telegram.org/bot<token>/getUpdates and read `message.chat.id`
// from the response.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function isConfigured() {
  return Boolean(BOT_TOKEN && CHAT_ID);
}

function apiUrl(method) {
  return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
}

async function callTelegram(method, body) {
  try {
    const res = await fetch(apiUrl(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn(`[telegramNotifier] ${method} failed: ${data.description || res.status}`);
      return null;
    }
    return data.result;
  } catch (err) {
    console.warn(`[telegramNotifier] ${method} request failed: ${err.message}`);
    return null;
  }
}

/**
 * Send one listing's repost/price-drop suggestion as a message with
 * actionable inline buttons. One message per listing (not a combined
 * digest) so each button's callback_data unambiguously maps to one
 * listing, no parsing required beyond a plain `action:listingId` split.
 */
async function sendRepostSuggestion(listing) {
  if (!isConfigured()) {
    console.warn("[telegramNotifier] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — skipping notification");
    return null;
  }

  const { repostSuggestion, traction } = listing;
  if (!repostSuggestion) return null;

  const text =
    `*Low traction:* ${escapeMarkdown(listing.title)}\n` +
    `Price: $${listing.price} · Views: ${traction?.views ?? 0} · Inquiries: ${traction?.inquiries ?? 0}\n` +
    `${escapeMarkdown(repostSuggestion.reason)}`;

  return callTelegram("sendMessage", {
    chat_id: CHAT_ID,
    text,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔁 Repost", callback_data: `repost:${listing.id}` },
          { text: "💰 Drop price 10%", callback_data: `dropprice:${listing.id}` },
          { text: "✋ Leave it", callback_data: `dismiss:${listing.id}` },
        ],
      ],
    },
  });
}

/** Acknowledges a button press so Telegram's client stops showing a spinner on it. */
async function answerCallbackQuery(callbackQueryId, text) {
  if (!isConfigured()) return null;
  return callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

/** Removes the inline keyboard from a message once its action has been handled, so it can't be pressed twice. */
async function clearMessageButtons(chatId, messageId) {
  if (!isConfigured()) return null;
  return callTelegram("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

/**
 * Long-polls Telegram for new updates (button presses) since `offset`.
 * Blocks up to ~25s server-side if there's nothing new (Telegram's own
 * long-poll timeout) — call this in a loop, not on a tight interval.
 * Never throws. Returns `[]` for a genuine "nothing new" response (already
 * rate-limited by Telegram's own 25s wait) but `null` on an actual request
 * failure (bad token, network error, ...) — those return immediately with
 * no server-side wait, so a caller looping on this should treat `null`
 * as "back off before retrying", not just "nothing happened".
 */
async function getUpdates(offset) {
  if (!isConfigured()) return [];
  const result = await callTelegram("getUpdates", {
    offset,
    timeout: 25,
    allowed_updates: ["callback_query"],
  });
  return result === null ? null : result;
}

function escapeMarkdown(text) {
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

module.exports = {
  isConfigured,
  sendRepostSuggestion,
  answerCallbackQuery,
  clearMessageButtons,
  getUpdates,
};
