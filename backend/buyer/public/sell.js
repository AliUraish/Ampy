// public/sell.js — seller portal: photo upload -> Claude vision draft -> publish

const dropzone = document.getElementById("dropzone");
const photoInput = document.getElementById("photo-input");
const previewStrip = document.getElementById("photo-preview");
const detectBtn = document.getElementById("detect-btn");
const detectStatus = document.getElementById("detect-status");
const suggestedRangeEl = document.getElementById("suggested-range");
const publishBtn = document.getElementById("publish-btn");
const publishStatus = document.getElementById("publish-status");
const postCraigslistBtn = document.getElementById("post-craigslist-btn");
const craigslistStatus = document.getElementById("craigslist-status");
const clipboardFallback = document.getElementById("craigslist-clipboard-fallback");

let selectedFiles = [];
let lastDetection = null;

dropzone.addEventListener("click", () => photoInput.click());

photoInput.addEventListener("change", () => {
  selectedFiles = Array.from(photoInput.files || []);
  renderPreviews();
  detectBtn.disabled = selectedFiles.length === 0;
});

function renderPreviews() {
  previewStrip.innerHTML = "";
  selectedFiles.forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    previewStrip.appendChild(img);
  });
}

detectBtn.addEventListener("click", async () => {
  if (selectedFiles.length === 0) return;

  detectBtn.disabled = true;
  detectStatus.textContent = "Analyzing photos…";

  const formData = new FormData();
  selectedFiles.forEach((f) => formData.append("photos", f));

  try {
    const res = await fetch("/api/vision-detect", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || `HTTP ${res.status}`);
    }
    const { draft } = await res.json();
    lastDetection = draft;
    applyDraft(draft);
    detectStatus.textContent = "Draft ready — review and edit below before publishing.";
  } catch (err) {
    detectStatus.textContent = `Detection failed: ${err.message}`;
  } finally {
    detectBtn.disabled = false;
  }
});

function applyDraft(draft) {
  document.getElementById("title").value = draft.title || "";
  if (draft.category) document.getElementById("category").value = draft.category;
  if (draft.condition) document.getElementById("condition").value = draft.condition;
  document.getElementById("description").value = draft.description || "";

  const mid = Math.round(((draft.suggestedPriceLow || 0) + (draft.suggestedPriceHigh || 0)) / 2);
  if (mid > 0) document.getElementById("price").value = mid;

  const brandLine = draft.brandModel ? ` Likely brand/model: ${draft.brandModel}.` : "";
  suggestedRangeEl.textContent = `Claude suggests $${draft.suggestedPriceLow}–$${draft.suggestedPriceHigh}. ${draft.conditionNotes || ""}${brandLine}`;
}

publishBtn.addEventListener("click", async () => {
  const title = document.getElementById("title").value.trim();
  const price = document.getElementById("price").value;
  if (!title || !price) {
    publishStatus.textContent = "Title and price are required.";
    return;
  }

  publishBtn.disabled = true;
  publishStatus.textContent = "Publishing…";

  const formData = new FormData();
  formData.append("title", title);
  formData.append("category", document.getElementById("category").value);
  formData.append("condition", document.getElementById("condition").value);
  formData.append("price", price);
  formData.append("description", document.getElementById("description").value);
  formData.append("location", document.getElementById("location").value);
  formData.append("sellerName", document.getElementById("sellerName").value);
  const minAcceptablePrice = document.getElementById("minAcceptablePrice").value;
  if (minAcceptablePrice) formData.append("minAcceptablePrice", minAcceptablePrice);
  formData.append("negotiationStyle", document.getElementById("negotiationStyle").value);
  if (lastDetection) formData.append("detectedFrom", JSON.stringify(lastDetection));
  if (selectedFiles[0]) formData.append("photo", selectedFiles[0]);

  try {
    const res = await fetch("/api/listings", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || `HTTP ${res.status}`);
    }
    publishStatus.textContent = "Published! View it on your dashboard.";
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 900);
  } catch (err) {
    publishStatus.textContent = `Publish failed: ${err.message}`;
  } finally {
    publishBtn.disabled = false;
  }
});

// "Post to Craigslist" — NOT automated posting. Craigslist has no posting
// API and its Terms of Service explicitly prohibit automated submission
// (enforced with a CAPTCHA + phone/email verification on their real
// posting form). This button only preps the text and opens their actual
// page — a human (the seller) completes Craigslist's own flow themselves.
// See the README's "Not planned" section for why this app doesn't attempt
// to go further than that.
postCraigslistBtn.addEventListener("click", async () => {
  const title = document.getElementById("title").value.trim();
  const price = document.getElementById("price").value;
  if (!title || !price) {
    craigslistStatus.textContent = "Title and price are required first.";
    return;
  }

  const category = document.getElementById("category").value;
  const condition = document.getElementById("condition").value;
  const description = document.getElementById("description").value.trim();
  const location = document.getElementById("location").value.trim();

  const listingText =
    `${title}\n\n` +
    `Price: $${price}\n` +
    `Condition: ${condition}\n` +
    `Category: ${category}\n` +
    (location ? `Location: ${location}\n` : "") +
    `\n${description}`;

  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(listingText);
      copied = true;
    }
  } catch {
    // Fall through to the manual-copy fallback below.
  }

  if (!copied) {
    // Clipboard API blocked (permissions, insecure context, older
    // browser) — select the fallback textarea's content so the seller can
    // still copy with Cmd/Ctrl+C from the browser's own copy command.
    clipboardFallback.value = listingText;
    clipboardFallback.style.cssText = "position:fixed; top:10px; left:10px; width:320px; height:160px; z-index:999;";
    clipboardFallback.focus();
    clipboardFallback.select();
  }

  window.open("https://post.craigslist.org/", "_blank", "noopener");

  craigslistStatus.textContent = copied
    ? "Listing text copied — opened Craigslist's posting page in a new tab. Paste it in and finish their form there."
    : "Couldn't auto-copy — select the text box that just appeared (Cmd/Ctrl+C), then paste into the Craigslist tab that opened.";
});
