import { z } from "zod";
import data from "@/data/catalog.json";
const variantSchema = z.object({
  id: z.string().min(1).max(80), size: z.string().min(1).max(80),
  priceKopiykas: z.number().int().positive().max(100000000), available: z.boolean(),
});
export const productSchema = z.object({
  id: z.string().min(1).max(80), name: z.string().min(1).max(160),
  description: z.string().max(1500), material: z.string().max(160),
  image: z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_\-.]+$/),
  imageAlt: z.string().min(1).max(240),
  variants: z.array(variantSchema).min(1).max(30).refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length, "Variant IDs must be unique"
  ),
});
export type Product = z.infer<typeof productSchema>;
export function getCatalog(): Product[] {
  return z.array(productSchema).refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length, "Product IDs must be unique"
  ).parse(data);
}
export function formatMoney(kopiykas: number) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH", maximumFractionDigits: kopiykas % 100 ? 2 : 0 }).format(kopiykas / 100);
}
