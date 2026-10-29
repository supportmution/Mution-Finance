import { logger } from "../lib/logger";

interface CategoryRecord {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  cost_class: string | null;
}

interface TransactionRecord {
  amount: number | string;
  type: string;
  description: string;
  date: string;
}

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://yuxjfdkqajkdtlhsxorc.supabase.co";

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_L8aeCLVv9v5XxkMwoVNGRA_fz4iU1aJ";

export function getAIConfig() {
  return {
    baseUrl: process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1",
    apiKey: process.env.AI_API_KEY?.trim() || "",
    modelId: process.env.AI_MODEL_ID?.trim() || "gpt-4o-mini",
    isConfigured: Boolean(process.env.AI_API_KEY?.trim()),
  };
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function processFinancialMessageWithAI(
  userMessage: string,
): Promise<string> {
  const config = getAIConfig();

  if (!config.isConfigured) {
    return (
      "⚠️ *Fitur AI Belum Dikonfigurasi*\n\n" +
      "Silakan tambahkan Environment Variables di Railway Dashboard:\n" +
      "• `AI_API_KEY` : API Key Anda\n" +
      "• `AI_BASE_URL`: Endpoint API (default: https://api.openai.com/v1)\n" +
      "• `AI_MODEL_ID`: Model ID (default: gpt-4o-mini)\n\n" +
      "_Anda tetap bisa menggunakan perintah dasar seperti *!ping* dan *!menu*._"
    );
  }

  try {
    // 1. Fetch available categories from Supabase PostgREST
    let categories: CategoryRecord[] = [];
    try {
      const catRes = await fetch(
        `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/categories?select=id,name,type,cost_class`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        },
      );
      if (catRes.ok) {
        categories = (await catRes.json()) as CategoryRecord[];
      }
    } catch (catErr) {
      logger.warn({ catErr }, "Unable to fetch categories from Supabase");
    }

    const categoryList = categories
      .map((c: CategoryRecord) => `- ${c.name} (ID: ${c.id}, Jenis: ${c.type})`)
      .join("\n");

    const now = new Date();
    const currentDate = now.toISOString().slice(0, 10);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const systemPrompt = `You are Mution Finance AI Assistant, an intelligent financial tracker for Mution.tech via WhatsApp.
Current Date: ${currentDate}.
Currency: Indonesian Rupiah (IDR).

Available Categories in Database:
${categoryList || "No custom categories yet. Use generic category."}

Your job is to analyze the user's message and determine the action:
1. If the user wants to record an EXPENSE or INCOME (e.g. "keluar 50rb bensin", "beli server aws 250.000", "dapat bayaran 10jt"):
Return valid JSON only in this format:
{
  "action": "RECORD_TRANSACTION",
  "type": "EXPENSE" or "INCOME",
  "amount": number (integer in IDR, e.g. 50000 for 50rb/50k),
  "category_id": "exact ID from list above if matches, otherwise null",
  "category_name": "name of closest category",
  "description": "clean description of what was purchased/received",
  "payment_method": "BCA / Mandiri / Cash / Card / etc. if mentioned, otherwise null"
}

2. If the user asks for balance, spending summary, or report (e.g. "berapa saldo kita?", "laporan bulan ini", "pengeluaran terbesar apa?"):
Return valid JSON only:
{
  "action": "GET_REPORT",
  "query": "summary"
}

3. If the user is chatting, asking for help, or greeting:
Return valid JSON only:
{
  "action": "CHAT",
  "reply": "friendly, helpful response in Indonesian as Mution Finance bot"
}

Respond STRICTLY with JSON without backticks or markdown formatting.`;

    const cleanBaseUrl = config.baseUrl.replace(/\/+$/, "");
    const endpoint = `${cleanBaseUrl}/chat/completions`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error({ status: response.status, errText }, "AI API call failed");
      return `❌ Gagal menghubungi provider AI (${response.status}): ${errText.slice(0, 100)}`;
    }

    const resJson = (await response.json()) as any;
    const rawContent: string =
      resJson.choices?.[0]?.message?.content?.trim() || "";

    // Parse JSON from response
    const cleanJson = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      return rawContent;
    }

    // Action 1: RECORD_TRANSACTION
    if (parsed.action === "RECORD_TRANSACTION" && parsed.amount > 0) {
      let matchedCategoryId = parsed.category_id;

      if (!matchedCategoryId && categories.length) {
        const found = categories.find(
          (c: CategoryRecord) =>
            c.name.toLowerCase() === parsed.category_name?.toLowerCase() ||
            (c.type === parsed.type &&
              c.name.toLowerCase().includes(parsed.category_name?.toLowerCase())),
        );
        matchedCategoryId = found?.id || categories[0].id;
      }

      if (!matchedCategoryId) {
        return "⚠️ Kategori belum tersedia di database. Tambahkan kategori terlebih dahulu di dashboard.";
      }

      const insertRes = await fetch(
        `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/transactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            type: parsed.type,
            category_id: matchedCategoryId,
            amount: parsed.amount,
            description: parsed.description || userMessage,
            payment_method: parsed.payment_method || null,
            date: new Date().toISOString(),
          }),
        },
      );

      if (!insertRes.ok) {
        const insertErr = await insertRes.text();
        logger.error({ insertErr }, "Failed to insert transaction");
        return `❌ Gagal mencatat transaksi: ${insertErr.slice(0, 120)}`;
      }

      const typeLabel = parsed.type === "INCOME" ? "🟢 Pemasukan" : "🔴 Pengeluaran";
      return (
        `✅ *Transaksi Berhasil Dicatat!*\n\n` +
        `• *Jenis:* ${typeLabel}\n` +
        `• *Jumlah:* ${formatRupiah(parsed.amount)}\n` +
        `• *Kategori:* ${parsed.category_name || "Umum"}\n` +
        `• *Keterangan:* ${parsed.description}\n` +
        (parsed.payment_method ? `• *Metode:* ${parsed.payment_method}\n` : "") +
        `\n_Data langsung tersimpan ke Supabase & muncul di Dashboard Mution Finance._`
      );
    }

    // Action 2: GET_REPORT
    if (parsed.action === "GET_REPORT") {
      let txs: TransactionRecord[] = [];
      const txRes = await fetch(
        `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/transactions?select=amount,type,description,date&date=gte.${encodeURIComponent(startOfMonth)}`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        },
      );

      if (txRes.ok) {
        txs = (await txRes.json()) as TransactionRecord[];
      }

      let totalIncome = 0;
      let totalExpense = 0;

      for (const t of txs) {
        if (t.type === "INCOME") totalIncome += Number(t.amount || 0);
        if (t.type === "EXPENSE") totalExpense += Number(t.amount || 0);
      }

      const netProfit = totalIncome - totalExpense;

      return (
        `📊 *Ringkasan Keuangan Bulan Ini:*\n\n` +
        `💰 *Pemasukan:* ${formatRupiah(totalIncome)}\n` +
        `💸 *Pengeluaran:* ${formatRupiah(totalExpense)}\n` +
        `📈 *Laba/Rugi BersI:* ${formatRupiah(netProfit)}\n` +
        `📝 *Total Transaksi:* ${txs.length} catatan\n\n` +
        `_Buka dashboard web untuk melihat laporan lengkap & grafik arus kas._`
      );
    }

    // Action 3: CHAT
    return (
      parsed.reply ||
      "Halo! Saya bot Mution Finance. Anda bisa mencatat transaksi (contoh: *keluar 50rb bensin*) atau tanya *berapa pengeluaran bulan ini?*."
    );
  } catch (err: any) {
    logger.error({ err }, "Error processing AI financial message");
    return `❌ Terjadi kendala saat memproses pesan: ${err.message}`;
  }
}
