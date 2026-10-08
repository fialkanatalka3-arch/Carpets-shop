import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const orderRequests = sqliteTable("order_requests", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(), phone: text("phone").notNull(),
  email: text("email"), note: text("note").notNull(), itemsJson: text("items_json").notNull(),
  totalKopiykas: integer("total_kopiykas").notNull(), currency: text("currency").notNull(),
  fingerprint: text("fingerprint").notNull(), createdAt: text("created_at").notNull(),
});
