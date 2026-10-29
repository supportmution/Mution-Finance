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
        logger.info("New WhatsApp QR code generated. Visit /wa in browser to scan.");
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
        botState.lastUpdated = new Date().toISOString();

        const shouldReconnect =
          (lastDisconnect?.error as any)?.output?.statusCode !==
          DisconnectReason.loggedOut;

        logger.warn(
          { shouldReconnect, err: lastDisconnect?.error },
          "WhatsApp connection closed",
        );

        if (shouldReconnect) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            logger.info("Reconnecting WhatsApp bot...");
            void initWhatsAppBot();
          }, 5000);
        } else {
          logger.warn("WhatsApp logged out. Please rescan QR code.");
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

        if (!from || !cleanText) continue;

        // Basic ping test command
        if (cleanText.toLowerCase() === "!ping" || cleanText.toLowerCase() === "ping") {
          await sock.sendMessage(from, {
            text: "🏓 *Pong!*\n\nBot WhatsApp *Mution Finance* aktif dan terhubung ke server.\n\n_Ketik *!menu* untuk melihat bantuan._",
          });
          continue;
        }

        if (cleanText.toLowerCase() === "!menu" || cleanText.toLowerCase() === "!help") {
          await sock.sendMessage(from, {
            text:
              "🤖 *Mution Finance WA Bot*\n\n" +
              "Perintah saat ini:\n" +
              "• *!ping* - Cek status bot\n" +
              "• *!info* - Info koneksi bot\n\n" +
              "_(Fitur pencatatan keuangan otomatis dengan AI API Key sedang disiapkan)_",
          });
          continue;
        }

        if (cleanText.toLowerCase() === "!info") {
          await sock.sendMessage(from, {
            text: `ℹ️ *Status Bot:*\n• Status: Aktif\n• Nomor: +${botState.phoneNumber || "-"}\n• Server: Railway Node.js`,
          });
          continue;
        }
      }
    });
  } catch (err) {
    logger.error({ err }, "Failed to initialize WhatsApp bot");
  }
}
