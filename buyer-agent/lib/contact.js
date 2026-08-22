// lib/contact.js
//
// Finds a way to actually reach the person who posted a listing.
//
// This is the piece that makes the buyer agent's "just ask the seller"
// step possible at all, and it's harder than it sounds, because the
// marketplaces deliberately make it hard:
//
//   - Craigslist listings are ANONYMOUS by design. There is no seller
//     phone/email field to read. Craigslist's own contact path is a relay
//     ("reply" button -> a rotating @sale.craigslist.org address) that
//     isn't in the listing HTML and isn't an iMessage handle anyway.
//   - So the only phone number a Craigslist listing ever has is one the
//     seller TYPED INTO THE DESCRIPTION themselves — "call or text me at
//     ...". That's extremely common (it's how sellers skip the relay), and
//     it's a number they published publicly for exactly this purpose.
//   - Those sellers know scrapers read descriptions, so they obfuscate:
//     "415 555 1234", "415.555.1234", "four one five 555 1234",
//     "415-555-l234" (letter L for 1), "415*555*1234". A naive
//     \d{3}-\d{3}-\d{4} regex misses most real listings.
//
// So: normalize the text first (spelled-out digits, letter-for-digit
// lookalikes, separator noise), THEN match. And validate against real NANP
// rules afterwards, because loosening the match this much will otherwise
// happily "find" a phone number inside a serial number or a set of
// dimensions.
//
// Hagglr's own seller listings are the easy case — /sell collects
// sellerPhone directly, so it's a structured field, not a guess. Every
// result carries `confidence` so the agent can tell the two apart and the
// UI can show which is which.

// Spelled-out digits. Ordered longest-first is not needed here (all are
// distinct words) but word boundaries are, or "one" matches inside "phone".
const WORD_DIGITS = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};

// Characters sellers substitute for digits to defeat naive scrapers.
const LOOKALIKES = { o: "0", O: "0", l: "1", I: "1", i: "1", S: "5" };

/**
 * Rewrite spelled-out digits ("four one five") into real digits so the
 * phone matcher below can see them. Only applied to runs of 3+ consecutive
 * digit-words — otherwise ordinary prose ("one of two speakers included")
 * would turn into digit soup and manufacture phone numbers that aren't
 * there.
 */
function normalizeSpelledDigits(text) {
  const words = Object.keys(WORD_DIGITS).join("|");
  const run = new RegExp(`\\b(?:(?:${words})[\\s.,-]+){2,}(?:${words})\\b`, "gi");
  return text.replace(run, (match) =>
    match
      .split(/[\s.,-]+/)
      .filter(Boolean)
      .map((w) => WORD_DIGITS[w.toLowerCase()] ?? w)
      .join("")
  );
}

// North American Numbering Plan validity. This is what stops the loosened
// matching above from turning every long number into a phone number:
//   - exactly 10 digits (or 11 with a leading country code 1)
//   - area code and exchange both start 2-9 (NANP forbids 0/1 there)
//   - not a repdigit like 0000000000 / 1111111111, which is what you get
//     from a serial number or an order id far more often than a real line
function normalizePhone(raw) {
  let digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  if (/^(\d)\1{9}$/.test(digits)) return null;
  return `+1${digits}`;
}

// Matches a 10/11-digit number with any junk separators sellers use
// between the groups. Kept intentionally permissive — normalizePhone()
// above is what rejects the false positives, not this.
const PHONE_PATTERN = /(?:\+?1[\s.\-*_/]*)?\(?([2-9]\d{2})\)?[\s.\-*_/]{0,3}(\d{3})[\s.\-*_/]{0,3}(\d{4})(?!\d)/g;

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/**
 * Pull every plausible phone number out of a blob of listing text.
 * Returns E.164 strings ("+14155551234"), deduped, best-effort.
 */
function extractPhones(text) {
  if (!text) return [];
  let prepared = normalizeSpelledDigits(String(text));

  // Undo letter-for-digit substitution, but ONLY inside runs that already
  // look mostly numeric. Applying it to the whole description would mangle
  // ordinary words ("look" -> "l00k") and invent numbers out of prose.
  prepared = prepared.replace(/[\dOoIilS][\dOoIilS\s.\-*_/()]{6,}[\dOoIilS]/g, (run) =>
    run.replace(/[OoIilS]/g, (c) => LOOKALIKES[c] ?? c)
  );

  const found = new Set();
  for (const m of prepared.matchAll(PHONE_PATTERN)) {
    const normalized = normalizePhone(m[0]);
    if (normalized) found.add(normalized);
  }
  return [...found];
}

function extractEmails(text) {
  if (!text) return [];
  const found = new Set();
  for (const m of String(text).matchAll(EMAIL_PATTERN)) {
    found.add(m[0].toLowerCase());
  }
  return [...found];
}

/** Pretty-print E.164 back to human form for the UI: +14155551234 -> (415) 555-1234 */
function formatPhone(e164) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164 || "");
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

/**
 * Work out how (and whether) the buyer agent can reach a listing's seller.
 *
 * @returns {{
 *   channel: 'imessage'|'email'|null,  // null = unreachable, agent must say so
 *   handle: string|null,               // what to actually send to
 *   display: string|null,              // human-readable form of `handle`
 *   confidence: 'high'|'medium'|'none',
 *   reason: string,                    // why — surfaced in the UI, never guessed at
 *   phones: string[], emails: string[],
 * }}
 */
function resolveContact(listing) {
  if (!listing) {
    return { channel: null, handle: null, display: null, confidence: "none", reason: "no listing", phones: [], emails: [] };
  }

  // Hagglr's own sellers gave us a real phone field at publish time — a
  // structured value, not something inferred out of prose.
  if (listing.source === "seller" && listing.sellerPhone) {
    const normalized = normalizePhone(listing.sellerPhone);
    if (normalized) {
      return {
        channel: "imessage",
        handle: normalized,
        display: formatPhone(normalized),
        confidence: "high",
        reason: "Phone number provided by the seller when they published this listing.",
        phones: [normalized],
        emails: [],
      };
    }
  }

  // Everything else: the seller published a number in the listing body.
  const haystack = [listing.title, listing.description].filter(Boolean).join("\n");
  const phones = extractPhones(haystack);
  const emails = extractEmails(haystack);

  if (phones.length > 0) {
    return {
      channel: "imessage",
      handle: phones[0],
      display: formatPhone(phones[0]),
      confidence: "medium",
      reason: "Phone number the seller published in the listing description.",
      phones,
      emails,
    };
  }

  if (emails.length > 0) {
    // iMessage does deliver to an Apple ID email, so this is worth trying —
    // but plenty of addresses aren't registered with iMessage, and the send
    // path reports that back rather than pretending it went through.
    return {
      channel: "email",
      handle: emails[0],
      display: emails[0],
      confidence: "medium",
      reason: "Email address in the listing. Only reachable over iMessage if it's an Apple ID.",
      phones,
      emails,
    };
  }

  return {
    channel: null,
    handle: null,
    display: null,
    confidence: "none",
    // The honest answer, and the one the agent should relay verbatim: most
    // Craigslist listings genuinely have no direct contact, and inventing
    // one would be worse than saying so.
    reason:
      listing.source === "craigslist"
        ? "This seller didn't publish a phone number — Craigslist routes contact through its own anonymous relay, which isn't an iMessage handle. Use the listing's reply button."
        : "No phone number or email found on this listing.",
    phones,
    emails,
  };
}

module.exports = { resolveContact, extractPhones, extractEmails, normalizePhone, formatPhone };
