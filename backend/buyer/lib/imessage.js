// lib/imessage.js
//
// The buyer agent's outbound channel: sends iMessages to sellers and reads
// their replies back, so "ask the seller a question" is a real round trip
// and not just a draft the agent hands you.
//
// macOS only, and it works by driving the local Messages.app — there is no
// iMessage API. Two halves, two different OS permissions:
//
//   SENDING   -> AppleScript via osascript. The first send raises a
//                one-time "allow Terminal to control Messages" prompt
//                (System Settings > Privacy & Security > Automation).
//   READING   -> ~/Library/Messages/chat.db, a SQLite file Messages keeps
//                locally. Requires Full Disk Access for whatever runs
//                node. Without it every query fails with "authorization
//                denied", which this module reports as a setup problem
//                with the fix, not as a mystery error.
//
// The app degrades cleanly if either is missing: sends fail with an
// actionable message, replies come back empty with a `needsSetup` flag.
// Nothing here throws into the agent loop.
//
// AUTONOMY AND GUARDRAILS
// -----------------------
// The agent sends without asking (that's the configured behavior), so the
// guardrails are here in code rather than in a human's approval click.
// These bound the blast radius of a bad loop or a misparsed number; they
// don't require anyone's approval and don't slow a normal send:
//   - per-seller daily cap        (MAX_PER_HANDLE_PER_DAY)
//   - global daily cap            (MAX_PER_DAY)
//   - near-duplicate suppression  (DEDUPE_WINDOW_MS)
//   - an append-only audit log of everything sent (data/messageLog.json)
//   - IMESSAGE_DRY_RUN=true to exercise the whole path sending nothing
//
// SECURITY NOTE: message bodies are written by an LLM, and seller replies
// are written by strangers. Neither is ever interpolated into a shell
// command or an AppleScript source string — the script is fixed and the
// text is passed as an argv parameter (see sendMessage). Treat reply text
// as data, never as instructions.

const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const CHAT_DB = path.join(os.homedir(), "Library", "Messages", "chat.db");
const LOG_PATH = path.join(__dirname, "..", "data", "messageLog.json");

const MAX_PER_HANDLE_PER_DAY = Number(process.env.IMESSAGE_MAX_PER_SELLER_PER_DAY || 3);
const MAX_PER_DAY = Number(process.env.IMESSAGE_MAX_PER_DAY || 40);
const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h — don't re-ask the same thing
const SEND_TIMEOUT_MS = 20000;

const DRY_RUN = () => String(process.env.IMESSAGE_DRY_RUN || "").toLowerCase() === "true";

// Fixed AppleScript. Reads both parameters from argv so nothing from a
// listing, a model, or a seller is ever concatenated into this source.
// `participant` handles a raw phone/email that isn't in Contacts, which is
// exactly the case here — we're messaging strangers off a listing.
const SEND_SCRIPT = `
on run {targetHandle, messageText}
  tell application "Messages"
    set targetService to 1st account whose service type = iMessage
    set targetBuddy to participant targetHandle of targetService
    send messageText to targetBuddy
  end tell
end run
`;

// --- audit log --------------------------------------------------------------

function readLog() {
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn("[imessage] could not read message log, starting empty:", err.message);
    }
    return [];
  }
}

function writeLog(entries) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(entries, null, 2));
}

function appendLog(entry) {
  const entries = readLog();
  entries.push(entry);
  writeLog(entries);
  return entry;
}

// --- environment ------------------------------------------------------------

function isAvailable() {
  return process.platform === "darwin" && fs.existsSync("/System/Applications/Messages.app");
}

/**
 * Report exactly which of the two permissions are in place, so setup
 * problems surface as instructions instead of as failed sends.
 */
async function checkSetup() {
  const status = {
    platform: process.platform,
    available: isAvailable(),
    dryRun: DRY_RUN(),
    canReadReplies: false,
    chatDbPath: CHAT_DB,
    issues: [],
  };

  if (process.platform !== "darwin") {
    status.issues.push("iMessage sending requires macOS — this server is running on " + process.platform + ".");
    return status;
  }
  if (!status.available) {
    status.issues.push("Messages.app was not found at /System/Applications/Messages.app.");
  }

  if (!fs.existsSync(CHAT_DB)) {
    status.issues.push(
      "No ~/Library/Messages/chat.db — open Messages.app and sign in to iMessage at least once."
    );
  } else {
    try {
      await queryChatDb("SELECT 1;");
      status.canReadReplies = true;
    } catch (err) {
      if (/authorization denied|unable to open/i.test(err.message)) {
        status.issues.push(
          "Can't read chat.db (authorization denied) — sending will work but replies won't be picked up. " +
            "Grant Full Disk Access to the app running this server (Terminal, iTerm, or your IDE) in " +
            "System Settings > Privacy & Security > Full Disk Access, then restart it."
        );
      } else {
        status.issues.push(`Can't read chat.db: ${err.message}`);
      }
    }
  }

  return status;
}

// --- sending ----------------------------------------------------------------

function withinLast24h(entry) {
  return Date.now() - new Date(entry.sentAt).getTime() < 24 * 60 * 60 * 1000;
}

/**
 * Check the autonomy guardrails before a send.
 * @returns {{allowed: boolean, reason?: string}}
 */
function checkGuardrails({ handle, text }) {
  const log = readLog();
  const recent = log.filter((e) => e.status !== "blocked" && withinLast24h(e));

  if (recent.length >= MAX_PER_DAY) {
    return { allowed: false, reason: `daily send cap reached (${MAX_PER_DAY} messages/24h)` };
  }

  const toHandle = recent.filter((e) => e.handle === handle);
  if (toHandle.length >= MAX_PER_HANDLE_PER_DAY) {
    return {
      allowed: false,
      reason: `already messaged this seller ${toHandle.length}x in the last 24h (cap ${MAX_PER_HANDLE_PER_DAY})`,
    };
  }

  const normalized = text.trim().toLowerCase();
  const dupe = toHandle.find(
    (e) =>
      e.text.trim().toLowerCase() === normalized &&
      Date.now() - new Date(e.sentAt).getTime() < DEDUPE_WINDOW_MS
  );
  if (dupe) {
    return { allowed: false, reason: "an identical message was already sent to this seller recently" };
  }

  return { allowed: true };
}

/**
 * Send one iMessage and record it.
 *
 * Never throws — the agent loop gets {ok:false, error} and can tell the
 * buyer what happened instead of dying mid-run.
 *
 * @param {object} args
 * @param {string} args.handle     E.164 phone ("+14155551234") or an Apple ID email
 * @param {string} args.text       message body
 * @param {string} [args.listingId] ties the message to a listing for threading
 * @param {object} [args.meta]     anything extra worth keeping in the audit log
 */
async function sendMessage({ handle, text, listingId = null, meta = {} }) {
  if (!handle) return { ok: false, error: "no contact handle for this seller" };
  if (!text || !text.trim()) return { ok: false, error: "refusing to send an empty message" };

  if (!isAvailable()) {
    return {
      ok: false,
      error:
        process.platform === "darwin"
          ? "Messages.app not found on this machine."
          : `iMessage sending only works on macOS (running ${process.platform}). Set IMESSAGE_DRY_RUN=true to exercise the flow without sending.`,
    };
  }

  const guard = checkGuardrails({ handle, text });
  if (!guard.allowed) {
    appendLog({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      handle, text, listingId, meta,
      sentAt: new Date().toISOString(),
      status: "blocked",
      error: guard.reason,
    });
    return { ok: false, error: `blocked by send guardrail: ${guard.reason}`, blocked: true };
  }

  if (DRY_RUN()) {
    const entry = appendLog({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      handle, text, listingId, meta,
      sentAt: new Date().toISOString(),
      status: "dry-run",
    });
    console.log(`[imessage] DRY RUN — would send to ${handle}: ${text}`);
    return { ok: true, dryRun: true, message: entry };
  }

  try {
    // `-` reads the script from stdin; everything after it is argv for the
    // script's `on run` handler. Nothing is interpolated into the script.
    await execFileAsync("osascript", ["-", handle, text], {
      input: SEND_SCRIPT,
      timeout: SEND_TIMEOUT_MS,
    });
  } catch (err) {
    const stderr = (err.stderr || "").trim();
    let friendly = stderr || err.message;
    if (/not allowed|not authorized|-1743/i.test(stderr)) {
      friendly =
        "macOS blocked this app from controlling Messages. Grant it in System Settings > " +
        "Privacy & Security > Automation (allow your terminal/IDE to control Messages), then retry.";
    } else if (/Invalid (index|key)|-1728/i.test(stderr)) {
      friendly =
        `Messages couldn't resolve "${handle}" as an iMessage account. It may be a landline, an ` +
        "Android number, or an email that isn't an Apple ID — iMessage can't deliver to those.";
    }
    appendLog({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      handle, text, listingId, meta,
      sentAt: new Date().toISOString(),
      status: "failed",
      error: friendly,
    });
    return { ok: false, error: friendly };
  }

  const entry = appendLog({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    handle, text, listingId, meta,
    sentAt: new Date().toISOString(),
    status: "sent",
  });
  return { ok: true, message: entry };
}


// --- reading replies --------------------------------------------------------
//
// Messages stores everything in a local SQLite file. We shell out to the
// system `sqlite3` rather than adding a native SQLite dependency: chat.db
// is read-only for our purposes, the queries are trivial, and a native
// module would mean a compile step in a project that currently has none.

/** Run a read-only query against chat.db and return rows as objects. */
async function queryChatDb(sql, params = {}) {
  // sqlite3's .parameter mechanism keeps values out of the SQL string.
  // Nothing here is user-authored today (handles are validated E.164 or
  // emails), but a reply-reading path that concatenates strings into SQL
  // is the kind of thing that stops being safe the moment someone adds a
  // free-text search box on top of it.
  const bindings = Object.entries(params)
    .map(([k, v]) => `.parameter set :${k} '${String(v).replace(/'/g, "''")}'`)
    .join("\n");

  const script = `.parameter init\n${bindings}\n${sql}\n`;

  try {
    const { stdout } = await execFileAsync("sqlite3", ["-readonly", "-json", CHAT_DB], {
      input: script,
      maxBuffer: 16 * 1024 * 1024,
    });
    const trimmed = stdout.trim();
    return trimmed ? JSON.parse(trimmed) : [];
  } catch (err) {
    const detail = (err.stderr || err.message || "").trim();
    throw new Error(detail || "chat.db query failed");
  }
}

// Messages stopped writing plain `message.text` for a lot of messages and
// now puts the body in `attributedBody` — an NSAttributedString serialized
// in Apple's binary typedstream format. There's no public parser for it,
// but the layout around the string payload is stable: the class name
// "NSString", then a marker byte 0x2B, then a length, then UTF-8 bytes.
// Lengths >= 128 are escaped with a 0x81 prefix and a 16-bit LE length.
//
// Best-effort by design: anything unexpected returns null and the caller
// falls back to `message.text` (or shows nothing) rather than surfacing
// binary garbage as a seller's reply.
function decodeAttributedBody(hex) {
  if (!hex) return null;
  try {
    const buf = Buffer.from(hex, "hex");
    const marker = buf.indexOf("NSString", 0, "utf8");
    if (marker === -1) return null;

    // Skip the class name and the short type-encoding preamble that
    // follows it, then find the 0x2B that introduces the payload.
    let i = buf.indexOf(0x2b, marker);
    if (i === -1) return null;
    i += 1;

    let length = buf[i];
    i += 1;
    if (length === 0x81) {
      length = buf.readUInt16LE(i);
      i += 2;
    } else if (length > 0x81) {
      return null; // 32/64-bit length forms — not seen in practice, don't guess
    }

    if (!length || i + length > buf.length) return null;
    const text = buf.subarray(i, i + length).toString("utf8");
    // A mis-parse yields control-character soup; a real message doesn't.
    if (/[\u0000-\u0008\u000e-\u001f]/.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

// chat.db timestamps are nanoseconds since 2001-01-01 (Apple epoch) on
// modern macOS, but seconds on older ones. Discriminate by magnitude
// rather than by OS version.
const APPLE_EPOCH_OFFSET_SEC = 978307200;
function appleDateToIso(value) {
  if (!value) return null;
  const n = Number(value);
  const seconds = n > 1e11 ? n / 1e9 : n;
  return new Date((seconds + APPLE_EPOCH_OFFSET_SEC) * 1000).toISOString();
}

/** Last 10 digits of a phone handle — the stable part across formats. */
function handleSuffix(handle) {
  const digits = String(handle).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/**
 * Read the message history with one seller.
 *
 * Matches on the exact handle OR its last 10 digits, because Messages may
 * have stored the same person as "+14155551234", "14155551234", or
 * "(415) 555-1234" depending on how the thread started.
 *
 * @returns {Promise<{ok, messages, needsSetup?, error?}>} — never throws.
 */
async function readThread({ handle, sinceIso } = {}) {
  if (!handle) return { ok: false, error: "no handle", messages: [] };
  if (process.platform !== "darwin") {
    return { ok: false, error: "reading iMessage replies requires macOS", messages: [] };
  }
  if (!fs.existsSync(CHAT_DB)) {
    return {
      ok: false, needsSetup: true, messages: [],
      error: "No ~/Library/Messages/chat.db yet — sign in to Messages.app first.",
    };
  }

  const suffix = handleSuffix(handle);
  const sql = `
    SELECT m.ROWID          AS rowid,
           m.text           AS text,
           hex(m.attributedBody) AS body_hex,
           m.is_from_me     AS is_from_me,
           m.date           AS apple_date,
           h.id             AS handle
    FROM message m
    JOIN handle h ON m.handle_id = h.ROWID
    WHERE h.id = :handle
       OR (:suffix IS NOT NULL AND replace(replace(replace(replace(h.id,'+',''),'-',''),' ',''),'.','') LIKE '%' || :suffix)
    ORDER BY m.date ASC
    LIMIT 200;
  `;

  let rows;
  try {
    rows = await queryChatDb(sql, { handle, suffix: suffix || "" });
  } catch (err) {
    const denied = /authorization denied|unable to open/i.test(err.message);
    return {
      ok: false,
      needsSetup: denied,
      messages: [],
      error: denied
        ? "Can't read iMessage replies: this app needs Full Disk Access. System Settings > " +
          "Privacy & Security > Full Disk Access > enable your terminal or IDE, then restart the server."
        : `chat.db read failed: ${err.message}`,
    };
  }

  let messages = rows
    .map((r) => ({
      rowId: r.rowid,
      // Reply text is written by a stranger. It is DATA — rendered escaped
      // in the UI and passed to the model as quoted seller content, never
      // as instructions.
      text: r.text || decodeAttributedBody(r.body_hex),
      fromMe: r.is_from_me === 1,
      at: appleDateToIso(r.apple_date),
      handle: r.handle,
    }))
    .filter((m) => m.text && m.text.trim());

  if (sinceIso) {
    messages = messages.filter((m) => m.at && m.at > sinceIso);
  }

  return { ok: true, messages };
}

/**
 * Everything that has passed between the buyer agent and a seller about
 * one listing: what we sent (from the audit log, which is authoritative
 * for our own sends and works even without Full Disk Access) plus whatever
 * came back (from chat.db, which needs it).
 */
async function getThreadForListing(listingId) {
  const sent = readLog().filter((e) => e.listingId === listingId);
  if (sent.length === 0) {
    return { ok: true, listingId, handle: null, sent: [], replies: [], messages: [] };
  }

  const handle = sent[sent.length - 1].handle;
  const firstSentAt = sent[0].sentAt;
  const thread = await readThread({ handle });

  // Only count replies that arrived after we first reached out — the
  // seller's handle might already have unrelated history in Messages, and
  // pulling that into a listing thread would be both wrong and a privacy
  // leak into the agent's context.
  const replies = (thread.messages || []).filter((m) => !m.fromMe && m.at && m.at >= firstSentAt);

  const messages = [
    ...sent.map((s) => ({ direction: "out", text: s.text, at: s.sentAt, status: s.status })),
    ...replies.map((r) => ({ direction: "in", text: r.text, at: r.at, status: "received" })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  return {
    ok: thread.ok,
    listingId,
    handle,
    sent,
    replies,
    messages,
    ...(thread.error ? { error: thread.error, needsSetup: thread.needsSetup } : {}),
  };
}

module.exports = {
  isAvailable, checkSetup, sendMessage, checkGuardrails,
  readThread, getThreadForListing, queryChatDb, decodeAttributedBody,
  readLog, CHAT_DB,
  MAX_PER_HANDLE_PER_DAY, MAX_PER_DAY,
};
