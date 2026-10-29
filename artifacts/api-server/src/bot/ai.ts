import { logger } from "../lib/logger";

interface CategoryRecord {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  cost_class: string | null;
}

interface TransactionRecord {
  id: string;
  amount: number | string;
  type: "INCOME" | "EXPENSE";
  description: string;
  date: string;
  payment_method: string | null;
  category_id: string;
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

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const categoryList = categories
      .map((c: CategoryRecord) => `- ${c.name} (ID: ${c.id}, Jenis: ${c.type})`)
      .join("\n");

    const now = new Date();
    const currentDate = now.toISOString().slice(0, 10);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 2. Fetch real transactions from Supabase for live context
    let recentTransactions: TransactionRecord[] = [];
    try {
      const txRes = await fetch(
        `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/transactions?select=id,date,type,amount,description,payment_method,category_id&order=date.desc&limit=100`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        },
      );
      if (txRes.ok) {
        recentTransactions = (await txRes.json()) as TransactionRecord[];
      }
    } catch (txErr) {
      logger.warn({ txErr }, "Unable to fetch transactions from Supabase");
    }

    // Compute key financial metrics from live database
    let totalIncomeAll = 0;
    let totalExpenseAll = 0;
    let totalIncomeThisMonth = 0;
    let totalExpenseThisMonth = 0;

    for (const t of recentTransactions) {
      const amt = Number(t.amount || 0);
      const tDate = new Date(t.date);
      if (t.type === "INCOME") {
        totalIncomeAll += amt;
        if (tDate >= startOfMonth) totalIncomeThisMonth += amt;
      } else {
        totalExpenseAll += amt;
        if (tDate >= startOfMonth) totalExpenseThisMonth += amt;
      }
    }

    const currentBalance = totalIncomeAll - totalExpenseAll;
    const netProfitThisMonth = totalIncomeThisMonth - totalExpenseThisMonth;

    const transactionLines = recentTransactions
      .slice(0, 60)
      .map((t, idx) => {
        const catName = categoryMap.get(t.category_id) || "Umum";
        const dt = t.date
          ? new Date(t.date).toISOString().replace("T", " ").slice(0, 16)
          : "-";
        return `${idx + 1}. [${dt}] ${t.type} | Rp ${Number(t.amount).toLocaleString("id-ID")} | Kategori: ${catName} | Ket: ${t.description}${t.payment_method ? ` | Metode: ${t.payment_method}` : ""}`;
      })
      .join("\n");

    const systemPrompt = `You are Mution Finance AI Assistant, an intelligent, flexible, and accurate financial companion for Mution.tech via WhatsApp.
Current Date: ${currentDate} (WIB / GMT+7).
Currency: Indonesian Rupiah (IDR).

RINGKASAN KEUANGAN DARI DATABASE:
• Saldo Saat Ini: ${formatRupiah(currentBalance)}
• Total Pemasukan Bulan Ini: ${formatRupiah(totalIncomeThisMonth)}
• Total Pengeluaran Bulan Ini: ${formatRupiah(totalExpenseThisMonth)}
• Laba Bersih Bulan Ini: ${formatRupiah(netProfitThisMonth)}
• Total Catatan Transaksi: ${recentTransactions.length} transaksi

DAFTAR TRANSAKSI TERBARU DARI DATABASE:
${transactionLines || "(Belum ada transaksi di database)"}

DAFTAR KATEGORI TERSEDIA:
${categoryList || "Umum"}

TUGAS ANDA:
1. Jika pengguna ingin MENCATAT transaksi baru (misal: "keluar 50rb bensin", "masuk 10jt DP klien", "tadi bayar server aws 350.000", "beli makan siang 35rb"):
Kembalikan JSON:
{
  "action": "RECORD_TRANSACTION",
  "type": "EXPENSE" atau "INCOME",
  "amount": number (integer Rupiah),
  "category_id": "ID kategori dari daftar di atas jika cocok, atau null",
  "category_name": "Nama kategori terdekat",
  "description": "Deskripsi bersih transaksi",
  "payment_method": "BCA / Mandiri / Cash / Kartu Kredit / dll jika disebutkan, atau null"
}

2. Jika pengguna BERTANYA tentang data keuangan, riwayat, tanggal transaksi, saldo, perbandingan, pengeluaran terbesar, pemasukan terakhir, atau apapun seputar uang (misal: "pemasukan terakhir tgl berapa?", "kemarin kita ada beli apa?", "berapa sisa saldo kita?", "pengeluaran terbesar bulan ini apa?", "total keluar buat bensin berapa?", "siapa aja yg transfer?", "minggu ini ada pengeluaran apa?"):
Analisis data transaksi database riil di atas, lalu jawab secara akurat, lugas, dan ramah dalam bahasa Indonesia. Sebutkan tanggal spesifik, nominal, dan keterangannya sesuai data di atas.
Kembalikan JSON:
{
  "action": "ANSWER_QUESTION",
  "reply": "Jawaban lengkap dan akurat dalam bahasa Indonesia. Gunakan format WhatsApp (*tebal* untuk angka dan tanggal) agar nyaman dibaca."
}

3. Jika pengguna menyapa, berterima kasih, atau bertanya hal umum:
Kembalikan JSON:
{
  "action": "CHAT",
  "reply": "Jawaban ramah dalam bahasa Indonesia sebagai asisten bot Mution Finance."
}

Kembalikan HANYA format JSON valid tanpa format markdown backticks.`;

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
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error({ status: response.status, errText }, "AI API call failed");
      return `❌ Gagal menghubungi provider AI (${response.status}): ${errText.slice(0, 120)}`;
    }

    const rawText = await response.text();
    let rawContent = "";

    // Handle both direct JSON completion and SSE stream (data: {...}) responses
    if (rawText.trim().startsWith("data:")) {
      const lines = rawText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:") && !trimmed.includes("[DONE]")) {
          const jsonStr = trimmed.replace(/^data:\s*/, "").trim();
          try {
            const chunk = JSON.parse(jsonStr);
            const delta =
              chunk.choices?.[0]?.delta?.content ||
              chunk.choices?.[0]?.message?.content ||
              "";
            rawContent += delta;
          } catch {}
        }
      }
    } else {
      try {
        const resJson = JSON.parse(rawText);
        rawContent = resJson.choices?.[0]?.message?.content?.trim() || "";
      } catch {
        rawContent = rawText.trim();
      }
    }

    // Smart JSON extractor (handles markdown blocks, extra text before/after JSON)
    let parsed: any = null;
    const cleanCandidate = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    try {
      parsed = JSON.parse(cleanCandidate);
    } catch {
      const firstBrace = cleanCandidate.indexOf("{");
      const lastBrace = cleanCandidate.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsed = JSON.parse(cleanCandidate.slice(firstBrace, lastBrace + 1));
        } catch {}
      }
    }

    if (!parsed) {
      return rawContent || "⚠️ Maaf, AI tidak memberikan respon yang sesuai.";
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

    // Action 2: ANSWER_QUESTION / CHAT / Custom Response
    if (parsed.reply) {
      return parsed.reply;
    }

    // Fallback Action: GET_REPORT
    if (parsed.action === "GET_REPORT") {
      return (
        `📊 *Ringkasan Keuangan Saat Ini:*\n\n` +
        `💳 *Saldo Keseluruhan:* ${formatRupiah(currentBalance)}\n` +
        `💰 *Pemasukan Bulan Ini:* ${formatRupiah(totalIncomeThisMonth)}\n` +
        `💸 *Pengeluaran Bulan Ini:* ${formatRupiah(totalExpenseThisMonth)}\n` +
        `📈 *Laba/Rugi Bersih:* ${formatRupiah(netProfitThisMonth)}\n` +
        `📝 *Total Transaksi:* ${recentTransactions.length} catatan\n\n` +
        `_Buka dashboard web untuk melihat laporan lengkap & grafik arus kas._`
      );
    }

    return (
      parsed.reply ||
      "Halo! Saya asisten Mution Finance. Anda bisa bertanya tentang keuangan atau mencatat transaksi (contoh: *keluar 50rb bensin*)."
    );
  } catch (err: any) {
    logger.error({ err }, "Error processing AI financial message");
    return `❌ Terjadi kendala saat memproses pesan: ${err.message}`;
  }
}
