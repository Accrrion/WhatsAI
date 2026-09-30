// Development/demo seed: "Paul's Fashion Store". Creates a full tenant for the
// authenticated user so the dashboard is immediately testable. Idempotent: only
// seeds when the user has no business yet.
import { newId, nowIso, appError, getBusinessForUser } from "./db.mjs";

const PRODUCTS = [
  { name: "Black Hoodie", description: "Soft cotton-blend hoodie, unisex fit. Sizes M–XXL.", price: 2500000, category: "Hoodies", stock_status: "in_stock", sku: "PF-HOOD-BLK" },
  { name: "White Sneakers", description: "Classic low-top white sneakers, durable sole. Sizes 39–45.", price: 4500000, category: "Footwear", stock_status: "in_stock", sku: "PF-SNK-WHT" },
  { name: "Blue Jeans", description: "Slim-fit stretch denim jeans. Sizes 30–40 waist.", price: 3000000, category: "Jeans", stock_status: "low_stock", sku: "PF-JEAN-BLU" },
];

const FAQS = [
  { question: "How do I place an order?", answer: "Send the item name, your size, and your delivery address here. Our team will confirm the total and arrange delivery." },
  { question: "Do you deliver outside Lagos?", answer: "Yes, we deliver nationwide. Delivery within Lagos is 1–2 days; other states take 3–5 days." },
  { question: "What payment methods do you accept?", answer: "We accept bank transfer and payment on delivery within Lagos." },
];

const POLICIES = [
  { kind: "delivery", body: "We deliver nationwide. Within Lagos: 1–2 business days (₦2,000). Other states: 3–5 business days (₦3,500–₦5,000). Orders are dispatched after payment confirmation." },
  { kind: "returns", body: "Unworn items in original condition can be returned within 7 days of delivery. Sale items are final." },
  { kind: "refunds", body: "Approved refunds are processed to your original payment method within 5–7 business days after we receive the returned item." },
  { kind: "exchanges", body: "Size exchanges are free within 7 days, subject to availability. Customer covers return shipping unless the item was faulty." },
  { kind: "payments", body: "We accept bank transfer and payment on delivery (Lagos only). A payment link can be sent on request." },
  { kind: "cancellations", body: "Orders can be cancelled free of charge before dispatch. After dispatch, the return policy applies." },
];

const HOURS = [
  { day: "monday", is_open: true, open_time: "09:00", close_time: "18:00" },
  { day: "tuesday", is_open: true, open_time: "09:00", close_time: "18:00" },
  { day: "wednesday", is_open: true, open_time: "09:00", close_time: "18:00" },
  { day: "thursday", is_open: true, open_time: "09:00", close_time: "18:00" },
  { day: "friday", is_open: true, open_time: "09:00", close_time: "18:00" },
  { day: "saturday", is_open: true, open_time: "10:00", close_time: "16:00" },
  { day: "sunday", is_open: false, open_time: null, close_time: null },
];

export async function seedDemo(supabase, userId) {
  const existing = await getBusinessForUser(supabase, userId);
  if (existing) throw appError("already_seeded", 409);

  const ts = nowIso();
  const businessId = newId();
  const business = {
    id: businessId, owner_user_id: userId, name: "Paul's Fashion Store", business_type: "fashion",
    description: "Trendy, affordable fashion for everyday wear — hoodies, sneakers and denim, delivered nationwide.",
    location: "12 Adeola Odeku Street, Victoria Island, Lagos", phone: "+234 802 555 0134",
    email: "hello@paulsfashion.example", website: "https://paulsfashion.example",
    social_links: { instagram: "@paulsfashion", facebook: "paulsfashionstore" },
    currency: "NGN", onboarding_step: 11, created_at: ts, updated_at: ts,
  };
  const { error: bErr } = await supabase.from("businesses").insert(business);
  if (bErr) throw appError("db_error", 503);

  const inserts = [];
  for (const h of HOURS) inserts.push(supabase.from("business_hours").insert({ id: newId(), business_id: businessId, ...h }));
  for (const p of POLICIES) inserts.push(supabase.from("policies").insert({ id: newId(), business_id: businessId, kind: p.kind, body: p.body }));
  for (const f of FAQS) inserts.push(supabase.from("faqs").insert({ id: newId(), business_id: businessId, question: f.question, answer: f.answer, created_at: ts }));
  const productIds = [];
  for (const p of PRODUCTS) {
    const id = newId(); productIds.push({ id, ...p });
    inserts.push(supabase.from("products").insert({ id, business_id: businessId, ...p, currency: "NGN", image_url: null, variants: {}, created_at: ts, updated_at: ts }));
  }
  inserts.push(supabase.from("ai_configs").insert({
    id: newId(), business_id: businessId, assistant_name: "Amaka", tone: "friendly", language: "en",
    welcome_message: "Hi! Welcome to Paul's Fashion Store 👋 I'm Amaka. Ask me about our hoodies, sneakers or jeans, prices, delivery or anything else!",
    fallback_message: "Let me connect you with a member of our team who can help with that.",
    response_length: "medium", handoff_behavior: "on_request", is_active: true, updated_at: ts,
  }));
  await Promise.all(inserts);

  // Sample customers, conversations, leads and an order for a lively dashboard.
  const c1 = newId(), c2 = newId();
  await supabase.from("customers").insert([
    { id: c1, business_id: businessId, dedupe_key: `${businessId}:2348031112222`, wa_id: "2348031112222", name: "Chidinma O.", phone: "+234 803 111 2222", email: null, created_at: ts, updated_at: ts },
    { id: c2, business_id: businessId, dedupe_key: `${businessId}:2347061234567`, wa_id: "2347061234567", name: "Tunde A.", phone: "+234 706 123 4567", email: null, created_at: ts, updated_at: ts },
  ]);

  const conv1 = newId(), conv2 = newId();
  await supabase.from("conversations").insert([
    { id: conv1, business_id: businessId, customer_id: c1, status: "open", mode: "ai", tags: ["vip"], last_message: "Do you have the black hoodie in XL?", last_message_at: ts, unread: 1, created_at: ts, updated_at: ts },
    { id: conv2, business_id: businessId, customer_id: c2, status: "human_handoff", mode: "human", tags: [], last_message: "I want to speak to someone about a bulk order.", last_message_at: ts, unread: 0, created_at: ts, updated_at: ts },
  ]);
  await supabase.from("messages").insert([
    { id: newId(), conversation_id: conv1, business_id: businessId, direction: "inbound", sender: "customer", body: "Hi, how much is the black hoodie?", status: "received", created_at: ts },
    { id: newId(), conversation_id: conv1, business_id: businessId, direction: "outbound", sender: "ai", body: "The Black Hoodie is ₦25,000. It's available in sizes M–XXL. Would you like to order one?", status: "sent", created_at: ts },
    { id: newId(), conversation_id: conv1, business_id: businessId, direction: "inbound", sender: "customer", body: "Do you have the black hoodie in XL?", status: "received", created_at: ts },
    { id: newId(), conversation_id: conv2, business_id: businessId, direction: "inbound", sender: "customer", body: "I want to speak to someone about a bulk order.", status: "received", created_at: ts },
    { id: newId(), conversation_id: conv2, business_id: businessId, direction: "outbound", sender: "ai", body: "Sure. I'll connect you with a member of our team who can help with that.", status: "sent", created_at: ts },
  ]);

  await supabase.from("leads").insert([
    { id: newId(), business_id: businessId, customer_id: c2, name: "Tunde A.", phone: "+234 706 123 4567", email: null, interest: "bulk_order", product: null, source: "whatsapp", status: "new", notes: "Wants a bulk order — escalated to human.", created_at: ts, updated_at: ts },
  ]);

  const orderId = newId();
  await supabase.from("orders").insert({
    id: orderId, business_id: businessId, customer_id: c1, status: "processing", total: 2500000, currency: "NGN",
    delivery_address: "5 Allen Avenue, Ikeja, Lagos", payment_status: "pending", created_at: ts, updated_at: ts,
  });
  await supabase.from("order_items").insert({
    id: newId(), order_id: orderId, business_id: businessId, product_id: productIds[0].id,
    name: "Black Hoodie", quantity: 1, unit_price: 2500000,
  });

  return { business_id: businessId, name: business.name };
}
