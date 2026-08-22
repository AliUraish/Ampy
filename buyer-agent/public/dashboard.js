// public/dashboard.js — seller traction dashboard

const body = document.getElementById("dashboard-body");

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function suggestionHtml(suggestion) {
  if (!suggestion) return `<span class="hint">—</span>`;
  const cls = suggestion.type === "repost" ? "suggestion-repost" : "suggestion-price_drop";
  const label = suggestion.type === "repost" ? "Suggest repost" : "Suggest price drop";
  return `<span class="${cls}">${label}</span><br /><span class="hint">${escapeHtml(suggestion.reason)}</span>`;
}

async function load() {
  body.innerHTML = `<p class="spinner-label">Loading…</p>`;
  try {
    const res = await fetch("/api/dashboard/listings");
    const data = await res.json();
    const listings = data.listings || [];

    if (listings.length === 0) {
      body.innerHTML = `<div class="empty-state">You haven't posted anything yet. <a href="/sell">List an item</a> to get started.</div>`;
      return;
    }

    body.innerHTML = `
      <table class="ledger">
        <thead>
          <tr>
            <th>Listing</th>
            <th>Price</th>
            <th>Posted</th>
            <th>Views</th>
            <th>Inquiries</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${listings
            .map(
              (l) => `
            <tr>
              <td>${escapeHtml(l.title)}</td>
              <td class="mono">$${Number(l.price).toLocaleString()}</td>
              <td class="mono">${new Date(l.postedAt).toLocaleDateString()}</td>
              <td class="mono">${l.traction?.views ?? 0}</td>
              <td class="mono">${l.traction?.inquiries ?? 0}</td>
              <td>${suggestionHtml(l.repostSuggestion)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    body.innerHTML = `<div class="error-banner">Failed to load dashboard: ${escapeHtml(err.message)}</div>`;
  }
}

load();
