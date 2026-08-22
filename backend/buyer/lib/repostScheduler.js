// lib/repostScheduler.js
//
// Weekly job: find low-traction seller listings and notify via Telegram
// with actionable "Repost" / "Drop price" / "Leave it" buttons. This used
// to be a stub describing the intended logic — it's now wired up for real
// (see lib/telegramNotifier.js for the actual Bot API calls).
//
// Still true, and out of scope here: this never touches real Craigslist.
// "Repost" means bump the listing's postedAt in this app's own store, not
// re-post on craigslist.org — see the README for why this app doesn't
// automate posting to Craigslist at all.

const cron = require("node-cron");
const listingStore = require("./listingStore.js");
const telegram = require("./telegramNotifier.js");

const LOW_TRACTION_VIEW_THRESHOLD = 5;
const STALE_AFTER_DAYS = 7;
// Don't re-notify a listing more than once within this window even if
// it's still flagged next run — avoids spamming the same "still no
// inquiries" alert every single week for a listing the seller has already
// seen and chosen not to act on. Slightly under 7 days so a weekly cron
// never skips a listing due to run-to-run jitter.
const NOTIFY_COOLDOWN_DAYS = 6;
const DROP_PRICE_PERCENT = 10;
const CALLBACK_POLL_BACKOFF_MS = 5000;

/**
 * Read-only heuristic: which listings look like repost/price-drop
 * candidates right now. Does not mutate anything or contact Telegram.
 *
 * @param {object[]} listings - seller listings (from lib/listingStore.js)
 * @returns {object[]} listings with a `repostSuggestion` field attached:
 *   { type: 'repost' | 'price_drop' | null, reason: string }
 */
function findRepostCandidates(listings) {
  const now = Date.now();

  return listings.map((listing) => {
    const ageDays = (now - new Date(listing.postedAt).getTime()) / (1000 * 60 * 60 * 24);
    const { views = 0, inquiries = 0 } = listing.traction || {};

    let suggestion = null;
    if (ageDays >= STALE_AFTER_DAYS && inquiries === 0 && views < LOW_TRACTION_VIEW_THRESHOLD) {
      // Very low signal at all — a repost (fresh timestamp, re-surfaced in
      // search) is more likely to help than a price change nobody's seen.
      suggestion = {
        type: "repost",
        reason: `${views} views and 0 inquiries after ${Math.floor(ageDays)} days — low visibility, consider reposting.`,
      };
    } else if (ageDays >= STALE_AFTER_DAYS * 2 && inquiries === 0) {
      // Been visible for a while (views exist) but still no inquiries —
      // visibility isn't the problem, price likely is.
      suggestion = {
        type: "price_drop",
        reason: `${views} views but 0 inquiries after ${Math.floor(ageDays)} days — consider a price drop.`,
      };
    }

    return { ...listing, repostSuggestion: suggestion };
  });
}

function withinCooldown(listing) {
  if (!listing.lastNotifiedAt) return false;
  const daysSinceNotified = (Date.now() - new Date(listing.lastNotifiedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceNotified < NOTIFY_COOLDOWN_DAYS;
}

/**
 * Finds low-traction listings and sends a Telegram alert for each one that
 * isn't still in its notification cooldown. No-ops cleanly (logs and
 * returns an empty summary) if Telegram isn't configured — this can be
 * called safely regardless of whether TELEGRAM_BOT_TOKEN is set.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.force] - ignore NOTIFY_COOLDOWN_DAYS (used by the
 *   manual `/api/repost-check` trigger so testing doesn't require waiting
 *   out a real cooldown; the scheduled weekly run always respects it)
 * @returns {Promise<{checked: number, flagged: number, notified: string[], skippedCooldown: number}>}
 */
async function runRepostCheck({ force = false } = {}) {
  if (!telegram.isConfigured()) {
    console.warn(
      "[repostScheduler] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — repost check will not send notifications"
    );
    return { checked: 0, flagged: 0, notified: [], skippedCooldown: 0 };
  }

  const listings = listingStore.listAll();
  const flagged = findRepostCandidates(listings).filter((l) => l.repostSuggestion);
  const toNotify = force ? flagged : flagged.filter((l) => !withinCooldown(l));

  const notified = [];
  for (const listing of toNotify) {
    const sent = await telegram.sendRepostSuggestion(listing);
    if (sent) {
      listingStore.markNotified(listing.id);
      notified.push(listing.id);
    }
  }

  return {
    checked: listings.length,
    flagged: flagged.length,
    notified,
    skippedCooldown: flagged.length - toNotify.length,
  };
}

/**
 * Handles a button press from a sendRepostSuggestion message. Applies the
 * corresponding mutation via lib/listingStore.js, acknowledges the button
 * press, and clears the message's buttons so it can't be actioned twice.
 * Never throws — logs and returns on any malformed/unrecognized callback.
 */
async function handleCallbackQuery(callbackQuery) {
  const [action, listingId] = (callbackQuery.data || "").split(":");
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;

  let ackText = "Done.";
  switch (action) {
    case "repost": {
      const listing = listingStore.repost(listingId);
      ackText = listing ? `Reposted "${listing.title}"` : "Listing not found";
      break;
    }
    case "dropprice": {
      const listing = listingStore.dropPrice(listingId, DROP_PRICE_PERCENT);
      ackText = listing ? `Price dropped to $${listing.price}` : "Listing not found";
      break;
    }
    case "dismiss":
      ackText = "Left as-is.";
      break;
    default:
      console.warn(`[repostScheduler] unrecognized callback action: ${callbackQuery.data}`);
      ackText = "Unrecognized action.";
  }

  await telegram.answerCallbackQuery(callbackQuery.id, ackText);
  if (chatId && messageId) {
    await telegram.clearMessageButtons(chatId, messageId);
  }
}

// --- Background wiring, started from server.js at boot ---------------------

let pollingActive = false;

/**
 * Long-polls Telegram for button presses and handles them as they arrive.
 * Runs forever in the background (fire-and-forget from server.js) — never
 * blocks server startup, and any single failed poll just retries on the
 * next loop iteration rather than crashing the process.
 */
async function startCallbackListener() {
  if (pollingActive) return;
  if (!telegram.isConfigured()) {
    console.warn("[repostScheduler] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — callback listener not started");
    return;
  }
  pollingActive = true;
  console.log("[repostScheduler] Telegram callback listener started");

  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const updates = await telegram.getUpdates(offset);
    if (updates === null) {
      // Request itself failed (bad token, network blip, ...) — that
      // returns immediately with none of Telegram's own 25s long-poll
      // wait, so back off here explicitly. Otherwise a misconfigured
      // token turns this into a tight loop hammering Telegram's API.
      await new Promise((resolve) => setTimeout(resolve, CALLBACK_POLL_BACKOFF_MS));
      continue;
    }
    for (const update of updates) {
      offset = update.update_id + 1;
      if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
      }
    }
  }
}

/**
 * Schedules the weekly repost check via node-cron. No-ops with a log
 * message if Telegram isn't configured, rather than scheduling a job that
 * would just fail every week.
 *
 * @param {string} [schedule] - cron expression, default every Monday 9am server time
 */
function startWeeklySchedule(schedule = "0 9 * * 1") {
  if (!telegram.isConfigured()) {
    console.warn("[repostScheduler] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — weekly repost job not scheduled");
    return;
  }
  cron.schedule(schedule, () => {
    console.log("[repostScheduler] running scheduled weekly repost check");
    runRepostCheck().then((summary) =>
      console.log(`[repostScheduler] weekly check: ${JSON.stringify(summary)}`)
    );
  });
  console.log(`[repostScheduler] weekly repost check scheduled (cron: "${schedule}")`);
}

module.exports = {
  findRepostCandidates,
  runRepostCheck,
  handleCallbackQuery,
  startCallbackListener,
  startWeeklySchedule,
};
