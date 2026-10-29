import app from "./app";
import { logger } from "./lib/logger";
import { initWhatsAppBot } from "./bot/wa";

const rawPort = process.env["PORT"] || "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start WhatsApp Bot
  if (process.env.ENABLE_BAILEYS === "true") {
    logger.info("Starting legacy Baileys WhatsApp bot...");
    void initWhatsAppBot();
  } else {
    logger.info(
      "WhatsApp Gateway active via Fonnte Webhook. Endpoint: POST /api/fonnte/webhook",
    );
  }
});
