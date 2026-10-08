"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { ShoppingBag, PackageOpen, X, Minus, Plus, Trash2, Check, LoaderCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { type Product, formatMoney } from "@/lib/catalog";
import { orderSchema } from "@/lib/order";

type CartLine = { productId: string; variantId: string; quantity: number };
type ModelContext = { registerTool: (tool: { name: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean }; execute: (input: unknown) => unknown }, options: { signal: AbortSignal }) => void | Promise<void> };
const CART_KEY = "kotys-carpet-cart-v1";
function Wordmark() {
  return <span className="wordmark"><span className="wordmark-main">Kotys</span><span className="wordmark-sub">CARPET</span></span>;
}
function TikTokIcon() {
  // TikTok glyph from https://github.com/simple-icons/simple-icons/blob/develop/icons/tiktok.svg
  return <span className="social-icon tiktok-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" focusable="false">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  </span>;
}
export default function Storefront({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [step, setStep] = useState<"cart" | "checkout" | "success">("cart");
  const [selected, setSelected] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState("");
  const [fields, setFields] = useState({ name: "", phone: "", email: "", note: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ orderNumber: string; totalKopiykas: number } | null>(null);
  const requestId = useRef("");
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const getVariant = (line: CartLine) => products.find((p) => p.id === line.productId)?.variants.find((v) => v.id === line.variantId);
  const count = cart.reduce((n, item) => n + item.quantity, 0);
  const total = cart.reduce((n, item) => n + (getVariant(item)?.priceKopiykas || 0) * item.quantity, 0);
  const selectedVariant = selected?.variants.find((v) => v.id === variantId);

  useEffect(() => {
    try {
      const saved = orderSchema.shape.items.safeParse(JSON.parse(localStorage.getItem(CART_KEY) || "[]"));
      if (saved.success) {
        const seen = new Set<string>();
        const valid = saved.data.filter((item) => {
          const key = item.productId + ":" + item.variantId;
          const variant = products.find((p) => p.id === item.productId)?.variants.find((v) => v.id === item.variantId);
          if (!variant?.available || seen.has(key)) return false;
          seen.add(key); return true;
        });
        if (valid.reduce((n, item) => n + item.quantity, 0) <= 20) setCart(valid);
      }
    } catch { /* Temporary cart drafts are optional. */ }
    setLoaded(true);
  }, [products]);
  useEffect(() => {
    if (loaded) try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* Continue without local drafts. */ }
  }, [cart, loaded]);

  function choose(product: Product) {
    setSelected(product);
    setVariantId(product.variants.find((v) => v.available)?.id || product.variants[0].id);
  }
  function stageItems(additions: CartLine[], previous = cartRef.current) {
    if (!Array.isArray(additions) || additions.length === 0 || additions.length > 20) throw new Error("Вкажи килим, розмір і кількість.");
    const next = previous.map((item) => ({ ...item }));
    for (const item of additions) {
      if (!item || typeof item.productId !== "string" || typeof item.variantId !== "string" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) throw new Error("Перевір кількість килимів.");
      if (!getVariant(item)?.available) throw new Error("Цей килим або розмір недоступний.");
      const existing = next.find((line) => line.productId === item.productId && line.variantId === item.variantId);
      if (existing) existing.quantity += item.quantity; else next.push({ ...item });
    }
    if (next.reduce((n, item) => n + item.quantity, 0) > 20) throw new Error("В одній заявці можна замовити до 20 килимів.");
    return next;
  }
  function addSelected() {
    if (!selected || !selectedVariant?.available) return;
    try {
      const next = stageItems([{ productId: selected.id, variantId: selectedVariant.id, quantity: 1 }]);
      setCart(next); requestId.current = ""; setSelected(null); setStep("cart");
      toast.success("Килим додано до кошика");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Не вдалося додати килим."); }
  }
  function changeQuantity(line: CartLine, delta: number) {
    setCart((previous) => {
      if (delta > 0 && previous.reduce((n, item) => n + item.quantity, 0) >= 20) return previous;
      return previous.map((item) => item.productId === line.productId && item.variantId === line.variantId ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0);
    });
    requestId.current = "";
  }
  function remove(line: CartLine) {
    setCart((previous) => previous.filter((item) => !(item.productId === line.productId && item.variantId === line.variantId)));
    requestId.current = "";
  }
  function returnToCatalog() {
    setCartOpen(false); setStep("cart");
    setTimeout(() => document.getElementById("catalog")?.scrollIntoView(), 150);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending || !cart.length) return;
    setError("");
    if (!requestId.current) requestId.current = crypto.randomUUID();
    const input = { requestId: requestId.current, ...fields, items: cart };
    const parsed = orderSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Перевір дані заявки."); return; }
    setPending(true);
    try {
      const result = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const raw = await result.json();
      if (!raw || typeof raw !== "object") throw new Error("Не вдалося підтвердити збереження заявки.");
      const body = raw as Record<string, unknown>;
      if (!result.ok) throw new Error(typeof body.error === "string" ? body.error : "Не вдалося зберегти заявку.");
      if (typeof body.orderNumber !== "string" || typeof body.totalKopiykas !== "number") throw new Error("Не вдалося підтвердити збереження заявки. Спробуй ще раз.");
      setReceipt({ orderNumber: body.orderNumber, totalKopiykas: body.totalKopiykas }); setCart([]); setStep("success"); requestId.current = "";
      setFields({ name: "", phone: "", email: "", note: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Немає зв’язку. Дані залишилися у формі — спробуй ще раз.");
    } finally { setPending(false); }
  }

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<ModelContext["registerTool"]>[0]) => {
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Optional browser capability. */ }
    };
    register({
      name: "list_carpets", description: "Read the real Kotys Carpet catalog, including sizes, availability and prices in kopecks.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true }, execute: () => ({ products }),
    });
    register({
      name: "get_carpet_cart", description: "Read the current visible carpet cart and its total in kopecks.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: () => ({ items: cartRef.current, totalKopiykas: cartRef.current.reduce((n, item) => n + (getVariant(item)?.priceKopiykas || 0) * item.quantity, 0), currency: "UAH" }),
    });
    register({
      name: "add_carpets_to_cart", description: "Stage real available carpets in the visible cart; does not submit an order.",
      inputSchema: { type: "object", properties: { items: { type: "array", minItems: 1, maxItems: 20, items: { type: "object", properties: { productId: { type: "string" }, variantId: { type: "string" }, quantity: { type: "integer", minimum: 1, maximum: 20 } }, required: ["productId", "variantId", "quantity"], additionalProperties: false } } }, required: ["items"], additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        if (!input || typeof input !== "object" || Object.keys(input).some((key) => key !== "items")) throw new Error("Expected items.");
        const additions = (input as { items: CartLine[] }).items;
        const next = stageItems(additions);
        flushSync(() => { setCart(next); setCartOpen(true); setStep("cart"); });
        requestId.current = ""; return { items: next };
      },
    });
    return () => lifecycle.abort();
    // Tools share the same catalog and current cart through cartRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  return <>
    <a href="#catalog" className="skip-link">Перейти до каталогу</a>
    <header className="site-header">
      <div className="container header-inner">
        <a href="/" aria-label="Kotys Carpet — головна"><Wordmark /></a>
        <div className="header-actions">
          <nav className="header-links" aria-label="Головне меню"><a href="#catalog">Каталог</a><a href="#how-to-order">Як замовити</a><a href="#contacts">Контакти</a></nav>
          <Sheet open={cartOpen} onOpenChange={(open) => { if (!pending) setCartOpen(open); }}>
            <SheetTrigger asChild><Button variant="outline" className="cart-button" aria-label={"Відкрити кошик, килимів: " + count}>
              <ShoppingBag size={19} aria-hidden="true" /><span className="cart-label">Кошик</span><span className="cart-count">{count}</span>
            </Button></SheetTrigger>
            <SheetContent className="drawer-content" showCloseButton={false} onEscapeKeyDown={(e) => { if (pending) e.preventDefault(); }} onInteractOutside={(e) => { if (pending) e.preventDefault(); }}>
              <SheetHeader className="drawer-header">
                <SheetTitle className="drawer-title">{step === "checkout" ? "Твоя заявка" : step === "success" ? "Дякуємо!" : "Твій кошик"}</SheetTitle>
                <SheetDescription className="drawer-description">{step === "checkout" ? "Залиш контакти для погодження замовлення." : step === "success" ? "Заявку збережено." : "Перевір килими та обрані розміри."}</SheetDescription>
              </SheetHeader>
              <SheetClose asChild><button className="modal-close" aria-label="Закрити кошик" disabled={pending}><X size={20} /></button></SheetClose>
              <div className="drawer-body">
                {step === "success" && receipt ? <div className="success-state">
                  <div className="success-icon"><Check size={32} /></div><h3>Заявка прийнята</h3>
                  <p>Збережи номер заявки. За вказаними контактами погодимо наявність, доставку й оплату.</p>
                  <span className="order-reference">{receipt.orderNumber}</span><p>Сума за килими: <strong>{formatMoney(receipt.totalKopiykas)}</strong></p>
                  <Button className="primary-button full-width" onClick={returnToCatalog}>Повернутися до каталогу</Button>
                </div> : step === "cart" ? cart.length ? cart.map((line) => {
                  const product = products.find((p) => p.id === line.productId)!;
                  const variant = getVariant(line)!;
                  return <div className="cart-row" key={line.productId + ":" + line.variantId}>
                    <img src={product.image} alt={product.imageAlt} width={80} height={103} />
                    <div><h3>{product.name}</h3><p className="cart-size">{variant.size}</p><strong>{formatMoney(variant.priceKopiykas * line.quantity)}</strong>
                      <div className="cart-row-controls"><div className="quantity">
                        <button aria-label={"Зменшити кількість: " + product.name} onClick={() => changeQuantity(line, -1)}><Minus size={16} /></button>
                        <span aria-label="Кількість">{line.quantity}</span>
                        <button aria-label={"Збільшити кількість: " + product.name} disabled={count >= 20} onClick={() => changeQuantity(line, 1)}><Plus size={16} /></button>
                      </div><button className="remove-button" aria-label={"Видалити з кошика: " + product.name} onClick={() => remove(line)}><Trash2 size={18} /></button></div>
                    </div>
                  </div>;
                }) : <div className="cart-empty"><ShoppingBag size={36} strokeWidth={1} /><h3>Тут буде твій килим</h3><p>Додай килим із каталогу, щоб залишити заявку.</p><Button variant="outline" onClick={returnToCatalog}>Переглянути каталог</Button></div>
                : <form id="order-form" className="checkout-form" onSubmit={submit}>
                  <div className="checkout-field"><Label htmlFor="customer-name">Ім’я *</Label><Input id="customer-name" name="name" autoComplete="name" required minLength={2} maxLength={120} value={fields.name} disabled={pending} onChange={(e) => setFields({ ...fields, name: e.target.value })} /></div>
                  <div className="checkout-field"><Label htmlFor="customer-phone">Телефон *</Label><Input id="customer-phone" name="phone" type="tel" autoComplete="tel" placeholder="+380" required maxLength={25} value={fields.phone} disabled={pending} onChange={(e) => setFields({ ...fields, phone: e.target.value })} /></div>
                  <div className="checkout-field"><Label htmlFor="customer-email">Електронна пошта <span className="variant-unavailable">(необов’язково)</span></Label><Input id="customer-email" name="email" type="email" autoComplete="email" maxLength={180} value={fields.email} disabled={pending} onChange={(e) => setFields({ ...fields, email: e.target.value })} /></div>
                  <div className="checkout-field"><Label htmlFor="customer-note">Коментар <span className="variant-unavailable">(необов’язково)</span></Label><textarea id="customer-note" name="note" placeholder="Місто доставки або запитання" maxLength={500} value={fields.note} disabled={pending} onChange={(e) => setFields({ ...fields, note: e.target.value })} /></div>
                  {error && <p role="alert" className="form-error">{error}</p>}
                  <p className="drawer-note">Контакти потрібні для відповіді на твою заявку. Оплату на сайті не списуємо.</p>
                </form>}
              </div>
              {step !== "success" && cart.length > 0 && <div className="drawer-footer">
                <div className="total-line"><span>Сума за килими</span><strong>{formatMoney(total)}</strong></div>
                {step === "cart" ? <Button className="primary-button full-width" onClick={() => { setStep("checkout"); setError(""); }}>Оформити заявку</Button> : <>
                  <Button form="order-form" type="submit" disabled={pending} className="primary-button full-width">{pending && <LoaderCircle className="animate-spin" size={18} />}{pending ? "Зберігаємо…" : "Надіслати заявку"}</Button>
                  <Button variant="ghost" className="full-width" disabled={pending} onClick={() => { setStep("cart"); setError(""); requestId.current = ""; }}>Повернутися до кошика</Button>
                </>}
                <p className="drawer-note">Наявність, вартість доставки та спосіб оплати погодимо після заявки.</p>
              </div>}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
    <main>
      <section className="container hero" aria-labelledby="hero-title">
        <div><p className="eyebrow">Килими для твого простору</p><h1 id="hero-title">Килим для<br /><em>твого дому.</em></h1>
          <p className="hero-copy">Обирай фактуру, розмір і колір. Знайди килим, із яким хочеться залишитися вдома.</p>
          <Button asChild className="primary-button"><a href="#catalog">Переглянути каталог</a></Button>
        </div>
        <figure className="hero-media"><img src="/images/interior.webp" width={1536} height={1024} alt="Декоративна ілюстрація інтер’єру з килимом у глибоких теракотових відтінках" fetchPriority="high" /><figcaption>Натхнення для твого простору</figcaption></figure>
      </section>
      <section id="catalog" className="container catalog-section" aria-labelledby="catalog-title">
        <div className="section-heading"><div><p className="eyebrow">Kotys Carpet</p><h2 id="catalog-title">Обери свій килим</h2></div>{products.length > 0 && <p className="catalog-count">У каталозі: {products.length}</p>}</div>
        {products.length === 0 ? <div className="catalog-empty"><div className="empty-icon"><PackageOpen size={28} strokeWidth={1.2} /></div><div><h3>Готуємо колекцію</h3><p>Скоро тут з’являться килими Kotys Carpet з фотографіями, розмірами та цінами.</p></div></div>
        : <div className="product-grid">{products.map((product) => {
          const available = product.variants.filter((v) => v.available);
          const prices = (available.length ? available : product.variants).map((v) => v.priceKopiykas);
          const minPrice = Math.min(...prices);
          return <article className="product-card" key={product.id}>
            <button className="product-cover" aria-label={"Переглянути килим " + product.name} onClick={() => choose(product)}><img src={product.image} alt={product.imageAlt} width={480} height={600} loading="lazy" /></button>
            <div className="product-description"><h3 className="product-name">{product.name}</h3>{product.material && <p className="product-material">{product.material}</p>}
              <p className="product-price">{new Set(prices).size > 1 ? "від " : ""}{formatMoney(minPrice)}</p>
              <Button variant="outline" className="product-card-button" onClick={() => choose(product)}>{available.length ? "Обрати розмір" : "Переглянути"}</Button>
            </div>
          </article>;
        })}</div>}
      </section>
      <section id="how-to-order" className="how-section" aria-labelledby="how-title"><div className="container how-inner">
        <div><p className="eyebrow">Три прості кроки</p><h2 id="how-title">Від вибору<br />до твого дому</h2></div>
        <div className="how-steps">
          <div><span className="step-number">01</span><h3 className="step-title">Обери килим</h3><p className="step-copy">Переглянь фото, обери розмір і додай килим у кошик.</p></div>
          <div><span className="step-number">02</span><h3 className="step-title">Залиш заявку</h3><p className="step-copy">Вкажи ім’я й телефон, щоб ми могли зв’язатися з тобою.</p></div>
          <div><span className="step-number">03</span><h3 className="step-title">Погодимо деталі</h3><p className="step-copy">Уточнимо наявність, доставку та зручний спосіб оплати.</p></div>
        </div>
      </div></section>
    </main>
    <footer id="contacts" className="site-footer">
      <div className="container footer-inner">
        <a href="/" aria-label="Kotys Carpet — головна"><Wordmark /></a>
        <div>
          <h2 className="footer-heading">Зв’язатися</h2>
          <p className="footer-contact-name">Тетяна</p>
          <a className="phone-button" href="tel:+380961332777" aria-label="Зателефонувати Тетяні: +380 96 133 27 77">
            <Phone size={19} strokeWidth={1.6} aria-hidden="true" /><span>+380 96 133 27 77</span>
          </a>
        </div>
        <div>
          <h2 className="footer-heading">Соцмережі</h2>
          <a className="footer-social-link" href="https://www.tiktok.com/@tani44ka1?_r=1&_t=ZS-9ANxcMN82ZM" target="_blank" rel="noopener noreferrer" aria-label="TikTok @tani44ka1 — відкрити в новій вкладці">
            <TikTokIcon />
            <span><span className="social-title">TikTok</span><span className="social-handle">@tani44ka1</span></span>
          </a>
        </div>
      </div>
      <div className="container footer-bottom"><a href="#catalog" className="footer-link">Каталог</a><span>© {new Date().getFullYear()} Kotys Carpet</span></div>
    </footer>
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent className="product-modal" showCloseButton={false}>
        <DialogClose asChild><button className="modal-close" aria-label="Закрити інформацію про килим"><X size={20} /></button></DialogClose>
        {selected && <>
          <img className="detail-image" src={selected.image} alt={selected.imageAlt} width={480} height={600} />
          <div className="detail-copy"><DialogTitle className="detail-title">{selected.name}</DialogTitle><DialogDescription className="detail-description">{selected.description || "Обери доступний розмір килима."}</DialogDescription>
            {selected.material && <p className="detail-description">Матеріал: {selected.material}</p>}
            <div className="variant-group"><span className="field-title" id="size-label">Розмір</span><RadioGroup value={variantId} onValueChange={setVariantId} aria-labelledby="size-label">
              {selected.variants.map((variant) => <div key={variant.id} className="variant-option"><RadioGroupItem id={"size-" + variant.id} value={variant.id} disabled={!variant.available} /><Label className="variant-label" htmlFor={"size-" + variant.id}><span>{variant.size}</span><span>{variant.available ? formatMoney(variant.priceKopiykas) : "Немає в наявності"}</span></Label></div>)}
            </RadioGroup></div>
            <p className="detail-price">{selectedVariant ? formatMoney(selectedVariant.priceKopiykas) : ""}</p>
            <Button className="primary-button full-width" disabled={!selectedVariant?.available} onClick={addSelected}><ShoppingBag size={18} />Додати до кошика</Button>
          </div>
        </>}
      </DialogContent>
    </Dialog>
    <Toaster position="bottom-center" />
  </>;
}
