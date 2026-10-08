import { env } from "cloudflare:workers";
import { getCatalog } from "@/lib/catalog";
import { orderSchema, calculateOrder, InvalidCartError } from "@/lib/order";
export const dynamic = "force-dynamic";
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return response({ error: "Онови сторінку й спробуй ще раз." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return response({ error: "Некоректний формат заявки." }, 415);
  try {
    if (Number(request.headers.get("content-length")) > 12000) return response({ error: "Заявка завелика." }, 413);
    const reader = request.body?.getReader();
    if (!reader) return response({ error: "Заявка порожня." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 12000) {
          await reader.cancel();
          return response({ error: "Заявка завелика." }, 413);
        }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const payload = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { payload.set(chunk, offset); offset += chunk.byteLength; }
    const text = new TextDecoder().decode(payload);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return response({ error: "Некоректний формат заявки." }, 400); }
    const parsed = orderSchema.safeParse(raw);
    if (!parsed.success) return response({ error: parsed.error.issues[0]?.message || "Перевір дані заявки." }, 400);
    const input = parsed.data;
    const { items, totalKopiykas } = calculateOrder(input, getCatalog());
    if (!env.DB) return response({ error: "Зараз не вдалося зберегти заявку. Твої дані залишилися у формі — спробуй трохи пізніше." }, 503);
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ ...input, items })));
    const fingerprint = Array.from(new Uint8Array(bytes)).map((n) => n.toString(16).padStart(2, "0")).join("");
    const orderNumber = "KC-" + crypto.randomUUID().slice(0, 12).toUpperCase();
    await env.DB.prepare("INSERT INTO order_requests (id, order_number, customer_name, phone, email, note, items_json, total_kopiykas, currency, fingerprint, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
      .bind(input.requestId, orderNumber, input.name, input.phone, input.email || null, input.note, JSON.stringify(items), totalKopiykas, "UAH", fingerprint, new Date().toISOString()).run();
    const saved = await env.DB.prepare("SELECT order_number, fingerprint, total_kopiykas FROM order_requests WHERE id = ?").bind(input.requestId)
      .first<{ order_number: string; fingerprint: string; total_kopiykas: number }>();
    if (!saved) throw new Error("Order was not persisted");
    if (saved.fingerprint !== fingerprint) return response({ error: "Дані заявки змінилися. Закрий форму, перевір кошик і спробуй знову." }, 409);
    return response({ orderNumber: saved.order_number, totalKopiykas: saved.total_kopiykas }, 201);
  } catch (error) {
    if (error instanceof InvalidCartError) return response({ error: error.message }, 409);
    console.error("Order request storage failed");
    return response({ error: "Зараз не вдалося зберегти заявку. Твої дані залишилися у формі — спробуй трохи пізніше." }, 503);
  }
}
