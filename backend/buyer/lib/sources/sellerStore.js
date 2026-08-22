// lib/sources/sellerStore.js
//
// Ampy's own seller-posted listings as a marketplace source (see
// lib/sources/index.js for the contract).
//
// These come from /sell and live in lib/listingStore.js. They're already
// complete — photo, description, condition and all were captured at publish
// time — so there's no enrich() to implement here.
//
// Unlike Craigslist listings these can carry a real seller-set floor price
// and a real seller name, which is why the agent's reports distinguish
// them.

const listingStore = require("../listingStore.js");

module.exports = {
  id: "seller",
  label: "Ampy sellers",

  enabled() {
    return true;
  },

  async search({ query, category, maxPrice }) {
    let listings = listingStore.listAll();

    // Filter locally — this is an in-process array, not a remote query.
    if (query) {
      const needle = query.toLowerCase();
      listings = listings.filter(
        (l) =>
          l.title.toLowerCase().includes(needle) ||
          (l.description || "").toLowerCase().includes(needle)
      );
    }
    if (category) listings = listings.filter((l) => l.category === category);
    if (maxPrice) {
      listings = listings.filter(
        (l) => typeof l.price !== "number" || l.price <= Number(maxPrice)
      );
    }

    return { listings };
  },
};
