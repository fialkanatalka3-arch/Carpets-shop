import { z } from "zod";
import type { Product } from "./catalog";
export const orderSchema = z.object({
  requestId: z.string().uuid(),
  name: z.string().trim().min(2, "Вкажи ім’я — щонайменше 2 символи.").max(120),
  phone: z.string().trim().regex(/^\+?[\d\s()\-]{9,25}$/, "Перевір номер телефону.")
    .refine((s) => s.replace(/\D/g, "").length >= 10 && s.replace(/\D/g, "").length <= 15, "Перевір номер телефону."),
  email: z.union([z.literal(""), z.string().trim().email("Перевір електронну адресу.").max(180)]).optional(),
  note: z.string().trim().max(500).default(""),
  items: z.array(z.object({
    productId: z.string().min(1).max(80), variantId: z.string().min(1).max(80),
    quantity: z.number().int().min(1).max(20),
  }).strict()).min(1, "Кошик порожній.").max(20),
}).strict();
export type OrderInput = z.infer<typeof orderSchema>;
export class InvalidCartError extends Error {}
export function calculateOrder(input: OrderInput, products: Product[]) {
  const seen = new Set<string>();
  const items = input.items.map((line) => {
    const product = products.find((p) => p.id === line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant || !variant.available) throw new InvalidCartError("Один із килимів уже недоступний. Онови каталог і перевір кошик.");
    const key = line.productId + ":" + line.variantId;
    if (seen.has(key)) throw new InvalidCartError("У кошику є повторювані позиції. Перевір кількість килимів.");
    seen.add(key);
    return { productId: product.id, variantId: variant.id, name: product.name, size: variant.size, priceKopiykas: variant.priceKopiykas, quantity: line.quantity };
  });
  if (items.reduce((n, item) => n + item.quantity, 0) > 20) throw new InvalidCartError("Для замовлення понад 20 килимів зменш кількість у цій заявці.");
  return { items, totalKopiykas: items.reduce((n, item) => n + item.priceKopiykas * item.quantity, 0) };
}
