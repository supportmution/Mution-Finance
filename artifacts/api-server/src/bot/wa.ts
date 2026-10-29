import path from "path";
import fs from "fs";
import pino from "pino";
import QRCode from "qrcode";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  Browsers,
  type WASocket,
  type ConnectionState,
  type WAMessageKey,
  type GroupMetadata,
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

// In-memory message store & retry counter to resolve Signal Protocol Bad MAC retry loops
const messageStore = new Map<string, any>();
const retryMap = new Map<string, number>();
const groupMetadataCache = new Map<string, GroupMetadata>();

const msgRetryCounterCache = {
  get: (key: string) => retryMap.get(key),
  set: (key: string, value: number) => {
    retryMap.set(key, value);
  },
  del: (key: string) => {
    retryMap.delete(key);
  },
};

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

    messageStore.clear();
    retryMap.clear();
    groupMetadataCache.clear();

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
    const baileysLogger = pino({ level: "silent" });
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    botState.status = "connecting";
    botState.lastUpdated = new Date().toISOString();

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      logger: baileysLogger as any,
      browser: Browsers.ubuntu("Chrome"), // Official standard browser signature
      printQRInTerminal: false,
      syncFullHistory: false, // Prevents Bad MAC errors from old history sync
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: false,
      defaultQueryTimeoutMs: 60000,
      msgRetryCounterCache: msgRetryCounterCache as any,
      cachedGroupMetadata: async (jid: string) => {
        if (groupMetadataCache.has(jid)) {
          return groupMetadataCache.get(jid);
        }
        try {
          const meta = await sock.groupMetadata(jid);
          groupMetadataCache.set(jid, meta);
          return meta;
        } catch {
          return undefined;
        }
      },
      getMessage: async (key: WAMessageKey) => {
        if (key.id && messageStore.has(key.id)) {
          return messageStore.get(key.id);
        }
        return undefined;
      },
    });

    waSocket = sock;

    sock.ev.on("creds.update", saveCreds);

    // Keep group metadata updated
    sock.ev.on("groups.update", async (updates) => {
      for (const update of updates) {
        if (update.id) {
          try {
            const meta = await sock.groupMetadata(update.id);
            groupMetadataCache.set(update.id, meta);
          } catch {}
        }
      }
    });

    sock.ev.on("group-participants.update", async (update) => {
      if (update.id) {
        try {
          const meta = await sock.groupMetadata(update.id);
          groupMetadataCache.set(update.id, meta);
        } catch {}
      }
    });

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
          reconnectTimer = setTimeout(() => {
            logger.info("Reconnecting WhatsApp bot...");
            void initWhatsAppBot();
          }, 4000);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      // Store all messages in messageStore for Signal Protocol decryption retries
      for (const msg of messages) {
        if (msg.key?.id && msg.message) {
          messageStore.set(msg.key.id, msg.message);
          if (messageStore.size > 300) {
            const firstKey = messageStore.keys().next().value;
            if (firstKey) messageStore.delete(firstKey);
          }
        }
      }

      if (type !== "notify" && type !== "append") return;

      for (const msg of messages) {
        if (!msg.message) continue;

        const from = msg.key.remoteJid;
        if (!from || from.endsWith("@broadcast")) continue;

        const isGroup = from.endsWith("@g.us");

        // If sent from the bot itself, skip to prevent infinite reply loop
        if (msg.key.fromMe) {
          const myJid = sock.user?.id ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : null;
          if (isGroup || from !== myJid) {
            continue;
          }
        }

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          "";

        const cleanText = text.trim();
        if (!cleanText) continue;

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

        logger.info(
          { from, text: cleanText, isGroup, fromMe: msg.key.fromMe },
          "Received incoming WhatsApp message",
        );

        const lowerText = cleanText.toLowerCase();

        // Command: !ping / ping
        if (lowerText === "!ping" || lowerText === "ping") {
          await sock.sendMessage(
            from,
            {
              text: "🏓 *Pong!*\n\nBot WhatsApp *Mution Finance* aktif dan terhubung ke server.\n\n_Ketik *!menu* untuk melihat panduan._",
            },
            { quoted: msg },
          );
          continue;
        }

        // Command: !menu / !help / menu
        if (lowerText === "!menu" || lowerText === "!help" || (!isGroup && lowerText === "menu")) {
          const aiConfig = getAIConfig();
          const aiStatus = aiConfig.isConfigured
            ? `✅ Aktif (${aiConfig.modelId})`
            : "⚠️ Belum disetel di Railway";

          await sock.sendMessage(
            from,
            {
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
                "   • *!info* - Info bot & server" +
                (isGroup ? "\n\n_💡 Di dalam grup, gunakan *!ping*, *!menu*, atau awalan transaksi *keluar/masuk/bayar*._" : ""),
            },
            { quoted: msg },
          );
          continue;
        }

        // Command: !info
        if (lowerText === "!info") {
          const aiConfig = getAIConfig();
          await sock.sendMessage(
            from,
            {
              text:
                `ℹ️ *Info Bot Mution Finance:*\n` +
                `• Status: Aktif & Terhubung ✅\n` +
                `• Nomor Bot: +${botState.phoneNumber || "-"}\n` +
                `• Tipe Obrolan: ${isGroup ? "Grup WhatsApp" : "Chat Pribadi"}\n` +
                `• AI Base URL: ${aiConfig.baseUrl}\n` +
                `• AI Model: ${aiConfig.modelId}\n` +
                `• AI Key: ${aiConfig.isConfigured ? "Tersedia ✅" : "Belum diatur ⚠️"}`,
            },
            { quoted: msg },
          );
          continue;
        }

        // Check if message is intended for AI:
        // In private chat: all non-command messages are processed by AI
        // In group: process if it has prefix or financial transaction keywords
        let messageForAI = cleanText;
        let shouldProcessAI = !isGroup;

        if (isGroup) {
          const prefixes = ["!ai ", "!catat ", "/catat ", "/ai ", "!uang "];
          const matchedPrefix = prefixes.find((p) => lowerText.startsWith(p));
          if (matchedPrefix) {
            shouldProcessAI = true;
            messageForAI = cleanText.slice(matchedPrefix.length).trim();
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
            if (financialKeywords.some((kw) => lowerText.startsWith(kw) || lowerText.includes(kw))) {
              shouldProcessAI = true;
            }
          }
        }

        if (!shouldProcessAI || !messageForAI) {
          continue;
        }

        // Process message through AI
        try {
          const aiReply = await processFinancialMessageWithAI(messageForAI);
          await sock.sendMessage(from, { text: aiReply }, { quoted: msg });
        } catch (err: any) {
          logger.error({ err }, "Failed to send AI response to WA");
          await sock.sendMessage(
            from,
            {
              text: `❌ Gagal memproses pesan: ${err.message}`,
            },
            { quoted: msg },
          );
        }
      }
    });
  } catch (err) {
    logger.error({ err }, "Failed to initialize WhatsApp bot");
  }
}
