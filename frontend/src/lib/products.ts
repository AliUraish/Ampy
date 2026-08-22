export interface Product {
  id: string;
  name: string;
  price: string;
  imageUrl: string;
  productUrl: string;
  retailer: string;
  reason: string;
}

export interface ProductSearchResponse {
  query: string;
  agentMessage: string;
  products: Product[];
}

export interface ProductSearchError {
  error: string;
  code?: string;
}

export function isProductSearchResponse(value: unknown): value is ProductSearchResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.query === "string" &&
    typeof candidate.agentMessage === "string" &&
    Array.isArray(candidate.products) &&
    candidate.products.length >= 1 &&
    candidate.products.every(isProduct)
  );
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const product = value as Record<string, unknown>;
  return ["id", "name", "price", "imageUrl", "productUrl", "retailer", "reason"].every(
    (key) => typeof product[key] === "string" && product[key].length > 0,
  );
}
