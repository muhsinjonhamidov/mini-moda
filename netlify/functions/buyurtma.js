// Buyurtmani Telegram'ga yuboruvchi Netlify funksiyasi.
// Bot tokeni va chat ID faqat Netlify muhit o'zgaruvchilaridan olinadi:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

const MAX_BODY = 10000;          // so'rov hajmi (bayt)
const MAX_ITEMS = 30;            // savatdagi turli tovarlar soni
const MAX_QTY = 99;              // bitta tovar soni
const MIN_FILL_MS = 3000;        // forma bundan tez to'ldirilsa — bot
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;              // bitta IP dan 10 daqiqada 5 ta buyurtma

const hits = new Map();          // oddiy (funksiya nusxasi ichidagi) cheklov

const json = (status, data) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  body: JSON.stringify(data),
});

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clean = s => (typeof s === "string" ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim() : "");
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE_MAX;
}

function validate(d) {
  if (!d || typeof d !== "object") return "Ma'lumot noto'g'ri";

  const ism = clean(d.ism);
  const tel = clean(d.tel);
  const izoh = clean(d.izoh);
  if (ism.length < 2 || ism.length > 60) return "Ismni to'g'ri kiriting (2–60 belgi)";
  const digits = tel.replace(/\D/g, "");
  if (!/^[+\d\s()-]{7,20}$/.test(tel) || digits.length < 9 || digits.length > 12) return "Telefon raqamni to'g'ri kiriting";
  if (izoh.length > 300) return "Manzil yoki izoh juda uzun (300 belgigacha)";

  if (!Array.isArray(d.items) || d.items.length === 0) return "Savat bo'sh";
  if (d.items.length > MAX_ITEMS) return "Savatda tovarlar juda ko'p";
  const items = [];
  for (const it of d.items) {
    const nomi = clean(it && it.nomi);
    const soni = Number(it && it.soni);
    const narx = Number(it && it.narx);
    if (!nomi || nomi.length > 80) return "Tovar nomi noto'g'ri";
    if (!Number.isInteger(soni) || soni < 1 || soni > MAX_QTY) return "Tovar soni noto'g'ri";
    if (!Number.isInteger(narx) || narx < 0 || narx > 100000000) return "Tovar narxi noto'g'ri";
    items.push({ nomi, soni, narx });
  }
  return { ism, tel, izoh, items };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok: false, xato: "Faqat POST so'rov qabul qilinadi" });

  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chatId) {
    // Faqat o'zgaruvchi NOMLARI yoziladi, qiymatlari hech qachon logga chiqmaydi.
    const yoq = [!token && "TELEGRAM_BOT_TOKEN", !chatId && "TELEGRAM_CHAT_ID"].filter(Boolean);
    const oxshash = Object.keys(process.env).filter(k => /TELEGRAM|BOT|CHAT/i.test(k) && !yoq.includes(k));
    console.error(
      `Server sozlanmagan: ${yoq.join(" va ")} topilmadi (yoki bo'sh).` +
      (oxshash.length ? ` O'xshash nomli o'zgaruvchilar bor: ${oxshash.join(", ")} — nomida xato bo'lishi mumkin.` : " O'xshash nomli o'zgaruvchi ham yo'q.") +
      " Netlify: Site configuration → Environment variables, «Scopes»da Functions belgilanganini tekshiring va saytni qayta deploy qiling."
    );
    return json(500, { ok: false, xato: "Server sozlanmagan" });
  }

  const raw = event.body || "";
  if (raw.length > MAX_BODY) return json(413, { ok: false, xato: "So'rov juda katta" });

  let d;
  try { d = JSON.parse(event.isBase64Encoded ? Buffer.from(raw, "base64").toString("utf8") : raw); }
  catch { return json(400, { ok: false, xato: "Ma'lumot noto'g'ri" }); }

  // Spamdan himoya: yashirin maydon to'ldirilgan yoki forma juda tez yuborilgan bo'lsa —
  // botga muvaffaqiyat deb javob beramiz, lekin Telegram'ga yubormaymiz.
  const elapsed = Number(d && d.t);
  if ((d && d.website) || !Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) return json(200, { ok: true });

  const ip = (event.headers && (event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"] || "")).split(",")[0].trim() || "?";
  if (tooMany(ip)) return json(429, { ok: false, xato: "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring" });

  const v = validate(d);
  if (typeof v === "string") return json(400, { ok: false, xato: v });

  const jami = v.items.reduce((a, x) => a + x.soni * x.narx, 0);
  const soni = v.items.reduce((a, x) => a + x.soni, 0);
  const text = [
    "🛍 <b>Yangi buyurtma — Mini Moda</b>",
    "",
    ...v.items.map((x, i) => `${i + 1}. ${esc(x.nomi)} — ${x.soni} ta × ${fmt(x.narx)} = <b>${fmt(x.soni * x.narx)} so'm</b>`),
    "",
    `📦 Jami: ${soni} ta tovar`,
    `💰 <b>Jami summa: ${fmt(jami)} so'm</b>`,
    "",
    `👤 Ism: ${esc(v.ism)}`,
    `📞 Telefon: ${esc(v.tel)}`,
    `📍 Manzil / izoh: ${v.izoh ? esc(v.izoh) : "—"}`,
  ].join("\n");

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const res = await r.json().catch(() => ({}));
    if (!r.ok || !res.ok) {
      console.error("Telegram xatosi:", r.status, res.description);
      return json(502, { ok: false, xato: "Buyurtmani yuborib bo'lmadi" });
    }
  } catch (e) {
    console.error("Telegram'ga ulanib bo'lmadi:", e.message);
    return json(502, { ok: false, xato: "Buyurtmani yuborib bo'lmadi" });
  }

  return json(200, { ok: true });
};
