// lib/vision.js
//
// Sends seller-uploaded photos to Claude (vision) and asks it to draft a
// starting listing: title, category, likely brand/model, condition
// assessment, and a suggested price range. This is a *draft* — the seller
// portal pre-fills the listing form with it and the seller edits before
// publishing; nothing here is ever published without a human confirming it.

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();
const MODEL = "claude-opus-5";

const LISTING_DRAFT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "A concise, marketplace-style listing title." },
    category: {
      type: "string",
      description: "Best-fit category, e.g. electronics, furniture, vehicles, appliances, instruments, sporting goods, general.",
    },
    brandModel: {
      type: ["string", "null"],
      description: "Best guess at brand and/or model, if identifiable. Null if not confidently identifiable.",
    },
    condition: {
      type: "string",
      enum: ["new", "like new", "excellent", "good", "fair"],
      description: "Condition assessment based on visible wear, damage, packaging, etc.",
    },
    conditionNotes: {
      type: "string",
      description: "One or two sentences explaining the condition assessment (visible scuffs, missing parts, etc.).",
    },
    suggestedPriceLow: { type: "number", description: "Low end of a reasonable asking-price range, in USD." },
    suggestedPriceHigh: { type: "number", description: "High end of a reasonable asking-price range, in USD." },
    description: { type: "string", description: "A draft 2-4 sentence listing description a seller could edit and publish." },
  },
  required: [
    "title",
    "category",
    "brandModel",
    "condition",
    "conditionNotes",
    "suggestedPriceLow",
    "suggestedPriceHigh",
    "description",
  ],
  additionalProperties: false,
};

/**
 * @param {Array<{data: string, mediaType: string}>} images - base64-encoded image data
 * @returns {Promise<object>} listing draft matching LISTING_DRAFT_SCHEMA
 */
async function detectListingFromPhotos(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("detectListingFromPhotos requires at least one image");
  }

  const imageBlocks = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mediaType, data: img.data },
  }));

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema: LISTING_DRAFT_SCHEMA } },
    system:
      "You help sellers on a secondhand marketplace quickly draft a listing from photos of their " +
      "item. Look closely for brand markings, model numbers, visible wear, damage, or missing " +
      "accessories. Suggest a realistic resale price range for the item's apparent condition — " +
      "don't anchor to original retail price. If you can't identify something confidently, say so " +
      "rather than guessing specifics.",
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text: "Draft a listing for the item shown in these photos.",
          },
        ],
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  return JSON.parse(text);
}

module.exports = { detectListingFromPhotos };
