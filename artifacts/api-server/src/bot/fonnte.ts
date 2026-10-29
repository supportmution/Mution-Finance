import { logger } from "../lib/logger";
import { processFinancialMessageWithAI, getAIConfig } from "./ai";

export interface FonnteWebhookPayload {
  device?: string;
  sender?: string;
  message?: string;
  text?: string;
  member?: string;
  name?: string;
  location?: string;
  url?: string;
  filename?: string;
  extension?: string;
  timestamp?: number;
  inboxid?: string;
}

export function getFonnteToken(): string {
  return process.env.FONNTE_TOKEN?.trim() || "";
}

/**
 * Send WhatsApp message using Fonnte API
 */
export async function sendFonnteMessage(
  target: string,
  message: string,
): Promise<{ success: boolean; detail?: any }> {
  const token = getFonnteToken();

  if (!token) {
    logger.warn("FONNTE_TOKEN is not configured. Cannot send WhatsApp reply.");
    return { success: false, detail: "FONNTE_TOKEN not set in environment" };
  }

  try {
    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        target,
        message,
        typing: false,
        delay: "1",
      }),
    });

    const resJson = await response.json();
    logger.info({ target, resJson }, "Sent WhatsApp message via Fonnte");
    return { success: response.ok, detail: resJson };
  } catch (err: any) {
    logger.error({ err, target }, "Failed to send message via Fonnte");
    return { success: false, detail: err.message };
  }
}

/**
 * Check Fonnte device and token status
 */
export async function checkFonnteDeviceStatus(): Promise<{
  configured: boolean;
  status: string;
  name?: string;
  device?: string;
  quota?: string;
  detail?: any;
}> {
  const token = getFonnteToken();

  if (!token) {
    return {
      configured: false,
      status: "unconfigured",
      detail: "FONNTE_TOKEN is missing in environment variables",
    };
  }

  try {
    const res = await fetch("https://api.fonnte.com/device", {
      method: "POST",
      headers: {
        Authorization: token,
      },
    });

    if (!res.ok) {
      return {
        configured: true,
        status: "error",
        detail: `Fonnte API responded with status ${res.status}`,
      };
    }

    const data = (await res.json()) as any;
    return {
      configured: true,
      status: data.device_status || (data.status ? "connected" : "disconnected"),
      name: data.name || data.device_name,
      device: data.device || data.phone,
      quota: data.quota,
      detail: data,
    };
  } catch (err: any) {
    logger.error({ err }, "Error checking Fonnte device status");
    return {
      configured: true,
      status: "unreachable",
      detail: err.message,
    };
  }
}

/**
 * Handle incoming Fonnte Webhook message
 */
export async function handleFonnteWebhook(
  payload: FonnteWebhookPayload,
): Promise<{ reply?: string; status: string }> {
  const rawMessage = (payload.message || payload.text || "").trim();
  const sender = (payload.sender || "").trim();
  const name = payload.name || "User";
  const member = payload.member || "";

  if (!sender || !rawMessage) {
    return { status: "ignored_empty" };
  }

  // Prevent bot self-reply loop
  const botSignatures = [
    "🏓 *Pong!*",
    "🤖 *Mution Finance",
    "✅ *Transaksi Berhasil",
    "📊 *Ringkasan Keuangan",
    "ℹ️ *Info Bot",
    "❌ Gagal",
    "⚠️ *",
  ];
  if (botSignatures.some((sig) => rawMessage.startsWith(sig))) {
    return { status: "ignored_self" };
  }

  const isGroup = sender.includes("@g.us") || sender.includes("-");
  const lowerText = rawMessage.toLowerCase();

  logger.info(
    { sender, name, isGroup, member, message: rawMessage },
    "Received Fonnte WhatsApp Webhook message",
  );

  // Command: !ping / ping
  if (lowerText === "!ping" || lowerText === "ping") {
    const replyText =
      "🏓 *Pong!*\n\n" +
      "Bot WhatsApp *Mution Finance* aktif dan terhubung ke server.\n\n" +
      "_Ketik *!menu* untuk melihat panduan penggunaan._";

    await sendFonnteMessage(sender, replyText);
    return { reply: replyText, status: "replied_ping" };
  }

  // Command: !menu / !help / menu
  if (
    lowerText === "!menu" ||
    lowerText === "!help" ||
    (!isGroup && lowerText === "menu")
  ) {
    const aiConfig = getAIConfig();
    const aiStatus = aiConfig.isConfigured
      ? `✅ Aktif (${aiConfig.modelId})`
      : "⚠️ Belum disetel di Railway";

    const replyText =
      "🤖 *Mution Finance AI Bot*\n\n" +
      `• Status AI: ${aiStatus}\n\n` +
      "Cara Menggunakan:\n" +
      "1. *Catat Pengeluaran:*\n" +
      '   _"keluar 50rb bensin BCA"_\n' +
      '   _"bayar server aws 350.000"_\n\n' +
      "2. *Catat Pemasukan:*\n" +
      '   _"masuk 10jt pembayaran klien"_\n' +
      '   _"dapat transfer 250rb dari teman"_\n\n' +
      "3. *Cek Keuangan:*\n" +
      '   _"berapa sisa saldo kita?"_\n' +
      '   _"laporan pengeluaran bulan ini"_\n\n' +
      "4. *Perintah Dasar:*\n" +
      "   • *!ping* - Cek status bot\n" +
      "   • *!info* - Info server & AI" +
      (isGroup
        ? "\n\n_💡 Di dalam grup, gunakan *!ping*, *!menu*, atau ketik langsung transaksi keuangan._"
        : "");

    await sendFonnteMessage(sender, replyText);
    return { reply: replyText, status: "replied_menu" };
  }

  // Command: !info
  if (lowerText === "!info") {
    const aiConfig = getAIConfig();
    const replyText =
      `ℹ️ *Info Bot Mution Finance:*\n` +
      `• Status: Aktif & Terhubung (Fonnte Gateway) ✅\n` +
      `• Tipe Obrolan: ${isGroup ? "Grup WhatsApp" : "Chat Pribadi"}\n` +
      `• AI Base URL: ${aiConfig.baseUrl}\n` +
      `• AI Model: ${aiConfig.modelId}\n` +
      `• AI Key: ${aiConfig.isConfigured ? "Tersedia ✅" : "Belum diatur ⚠️"}`;

    await sendFonnteMessage(sender, replyText);
    return { reply: replyText, status: "replied_info" };
  }

  // Check if message should be processed by AI
  let messageForAI = rawMessage;
  let shouldProcessAI = !isGroup;

  if (isGroup) {
    const prefixes = ["!ai ", "!catat ", "/catat ", "/ai ", "!uang "];
    const matchedPrefix = prefixes.find((p) => lowerText.startsWith(p));
    if (matchedPrefix) {
      shouldProcessAI = true;
      messageForAI = rawMessage.slice(matchedPrefix.length).trim();
    } else {
      const financialKeywords = [
        "keluar ",
        "masuk ",
        "bayar ",
        "beli ",
        "dapat ",
        "terima ",
        "sisa saldo",
        "laporan ",
        "rekap ",
        "total pengeluaran",
        "total pemasukan",
      ];
      if (
        financialKeywords.some(
          (kw) => lowerText.startsWith(kw) || lowerText.includes(kw),
        )
      ) {
        shouldProcessAI = true;
      }
    }
  }

  if (!shouldProcessAI || !messageForAI) {
    return { status: "ignored_not_applicable" };
  }

  // Process through AI
  try {
    const aiReply = await processFinancialMessageWithAI(messageForAI);
    await sendFonnteMessage(sender, aiReply);
    return { reply: aiReply, status: "replied_ai" };
  } catch (err: any) {
    logger.error({ err }, "Failed to process AI message via Fonnte");
    const errorReply = `❌ Gagal memproses pesan: ${err.message}`;
    await sendFonnteMessage(sender, errorReply);
    return { reply: errorReply, status: "error" };
  }
}
