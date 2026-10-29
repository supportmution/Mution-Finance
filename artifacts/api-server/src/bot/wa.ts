import path from "path";
import fs from "fs";
import pino from "pino";
import QRCode from "qrcode";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
  type ConnectionState,
} from "@whiskeysockets/baileys";
import { logger } from "../lib/logger";
import { processFinancialMessageWithAI, getAIConfig } from "./ai";

export interface WhatsAppBotState {
  status: "disconnected" | "connecting" | "connected";
  qrCode: string | null;
  qrImage: string | null;
  phoneNumber: string | null;
  name: string | null;
  lastUpdated: string;
}

const botState: WhatsAppBotState = {
  status: "disconnected",
  qrCode: null,
  qrImage: null,
  phoneNumber: null,
  name: null,
  lastUpdated: new Date().toISOString(),
};

let waSocket: WASocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

export function getWhatsAppState(): WhatsAppBotState {
  return { ...botState };
}

export function getWhatsAppSocket(): WASocket | null {
  return waSocket;
}

export async function resetWhatsAppSession() {
  const sessionDir =
    process.env.WA_SESSION_PATH ||
    path.resolve(process.cwd(), "wa_session");

  try {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (waSocket) {
      try {
        await waSocket.logout();
      } catch {}
      try {
        waSocket.end(undefined);
      } catch {}
      waSocket = null;
    }

    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    botState.status = "disconnected";
    botState.qrCode = null;
    botState.qrImage = null;
    botState.phoneNumber = null;
    botState.name = null;
    botState.lastUpdated = new Date().toISOString();

    setTimeout(() => {
      void initWhatsAppBot();
    }, 1500);
  } catch (err) {
    logger.error({ err }, "Failed to reset WhatsApp session");
  }
}

export async function initWhatsAppBot() {
  const sessionDir =
    process.env.WA_SESSION_PATH ||
    path.resolve(process.cwd(), "wa_session");

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  logger.info({ sessionDir }, "Starting WhatsApp bot with session directory");

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    botState.status = "connecting";
    botState.lastUpdated = new Date().toISOString();

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }) as any,
      browser: ["Mution Finance", "Chrome", "1.0.0"],
      printQRInTerminal: false,
      syncFullHistory: false, // Prevents Bad MAC errors from old history
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      defaultQueryTimeoutMs: 60000,
    });

    waSocket = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        botState.qrCode = qr;
        try {
          botState.qrImage = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
        } catch (err) {
          logger.error({ err }, "Failed to convert QR to DataURL");
        }
        botState.status = "disconnected";
        botState.lastUpdated = new Date().toISOString();
        logger.info("New WhatsApp QR code generated. Visit /whatsapp in browser to scan.");
      }

      if (connection === "open") {
        botState.status = "connected";
        botState.qrCode = null;
        botState.qrImage = null;
        botState.phoneNumber = sock.user?.id ? sock.user.id.split(":")[0].replace(/[^0-9]/g, "") : null;
        botState.name = sock.user?.name || "Mution User";
        botState.lastUpdated = new Date().toISOString();

        logger.info(
          { phone: botState.phoneNumber, name: botState.name },
          "WhatsApp Bot successfully connected!",
        );
      }

      if (connection === "close") {
        botState.status = "disconnected";
        botState.qrCode = null;
        botState.qrImage = null;
        botState.phoneNumber = null;
        botState.name = null;
        botState.lastUpdated = new Date().toISOString();

        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        logger.warn(
          { statusCode, isLoggedOut, err: lastDisconnect?.error },
          "WhatsApp connection closed",
        );

        if (reconnectTimer) clearTimeout(reconnectTimer);

        if (isLoggedOut) {
          // User unlinked/logged out from phone: clean session and spin up fresh QR automatically
          logger.info("User logged out from phone. Cleaning session and generating fresh QR code...");
          try {
            if (fs.existsSync(sessionDir)) {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            }
          } catch (cleanErr) {
            logger.error({ cleanErr }, "Error cleaning session dir");
          }
          reconnectTimer = setTimeout(() => {
            void initWhatsAppBot();
          }, 1500);
        } else {
          // Reconnect on temporary network drop
          reconnectTimer = setTimeout(() => {
            logger.info("Reconnecting WhatsApp bot...");
            void initWhatsAppBot();
          }, 4000);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        if (!msg.message) continue;

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          "";

        const cleanText = text.trim();
        const from = msg.key.remoteJid;

        // Skip empty or broadcast messages (like WhatsApp stories)
        if (!from || from.endsWith("@broadcast") || !cleanText) continue;

        // Prevent self-reply loop: if message starts with bot signature, skip
        const botSignatures = [
          "🏓 *Pong!*",
          "🤖 *Mution Finance",
          "✅ *Transaksi Berhasil",
          "📊 *Ringkasan Keuangan",
          "ℹ️ *Info Bot",
          "❌ Gagal",
          "⚠️ *",
        ];
        if (botSignatures.some((sig) => cleanText.startsWith(sig))) {
          continue;
        }

        // Command: !ping
        if (cleanText.toLowerCase() === "!ping" || cleanText.toLowerCase() === "ping") {
          await sock.sendMessage(from, {
            text: "🏓 *Pong!*\n\nBot WhatsApp *Mution Finance* aktif dan terhubung ke server.\n\n_Ketik *!menu* untuk melihat panduan._",
          });
          continue;
        }

        // Command: !menu / !help
        if (cleanText.toLowerCase() === "!menu" || cleanText.toLowerCase() === "!help") {
          const aiConfig = getAIConfig();
          const aiStatus = aiConfig.isConfigured
            ? `✅ Aktif (${aiConfig.modelId})`
            : "⚠️ Belum disetel di Railway";

          await sock.sendMessage(from, {
            text:
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
              "   • *!ping* - Cek koneksi server\n" +
              "   • *!info* - Info bot & server",
          });
          continue;
        }

        // Command: !info
        if (cleanText.toLowerCase() === "!info") {
          const aiConfig = getAIConfig();
          await sock.sendMessage(from, {
            text:
              `ℹ️ *Info Bot Mution Finance:*\n` +
              `• Status: Aktif & Terhubung\n` +
              `• Nomor: +${botState.phoneNumber || "-"}\n` +
              `• AI Provider: ${aiConfig.baseUrl}\n` +
              `• AI Model: ${aiConfig.modelId}\n` +
              `• AI Key: ${aiConfig.isConfigured ? "Tersedia ✅" : "Belum diatur ⚠️"}`,
          });
          continue;
        }

        // Process message through AI
        try {
          const aiReply = await processFinancialMessageWithAI(cleanText);
          await sock.sendMessage(from, { text: aiReply });
        } catch (err: any) {
          logger.error({ err }, "Failed to send AI response to WA");
          await sock.sendMessage(from, {
            text: `❌ Gagal memproses pesan: ${err.message}`,
          });
        }
      }
    });
  } catch (err) {
    logger.error({ err }, "Failed to initialize WhatsApp bot");
  }
}
