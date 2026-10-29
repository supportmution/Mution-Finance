import { Router, type Request, type Response } from "express";
import { getWhatsAppState, resetWhatsAppSession } from "../bot/wa";
import { handleFonnteWebhook, checkFonnteDeviceStatus } from "../bot/fonnte";
import { logger } from "../lib/logger";

const waRouter = Router();

// ==========================================
// FONNTE WHATSAPP GATEWAY WEBHOOK & STATUS
// ==========================================

// Webhook endpoint: paste this URL in Fonnte Dashboard -> Device -> Webhook URL
waRouter.post("/api/fonnte/webhook", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    logger.info({ payload }, "Received Fonnte Webhook POST");

    // Process asynchronously so Fonnte receives quick 200 OK
    void handleFonnteWebhook(payload);

    res.status(200).json({ status: true, message: "Webhook processed" });
  } catch (err: any) {
    logger.error({ err }, "Error handling Fonnte Webhook");
    res.status(500).json({ status: false, error: err.message });
  }
});

// Check Fonnte setup and device status
waRouter.get("/api/fonnte/status", async (_req: Request, res: Response) => {
  const fonnteStatus = await checkFonnteDeviceStatus();
  res.json(fonnteStatus);
});

// ==========================================
// LEGACY BAILEYS ROUTES (FOR STATUS/COMPAT)
// ==========================================

waRouter.get("/api/wa/status", async (_req: Request, res: Response) => {
  const state = getWhatsAppState();
  const fonnte = await checkFonnteDeviceStatus();

  res.json({
    status: fonnte.configured ? (fonnte.status === "connected" ? "connected" : "connecting") : state.status,
    phoneNumber: fonnte.device || state.phoneNumber,
    name: fonnte.name || state.name,
    lastUpdated: state.lastUpdated,
    hasQR: Boolean(state.qrImage),
    fonnte,
  });
});

waRouter.get("/api/wa/qr", (_req: Request, res: Response) => {
  const state = getWhatsAppState();
  res.json({
    status: state.status,
    qrImage: state.qrImage,
  });
});

waRouter.post("/api/wa/reset", async (_req: Request, res: Response) => {
  await resetWhatsAppSession();
  res.json({ success: true, message: "Session reset. Generating new QR." });
});

// Redirect /wa directly to the integrated Mution Finance dashboard page (/whatsapp)
waRouter.get("/wa", (_req: Request, res: Response) => {
  res.redirect("/whatsapp");
});

export default waRouter;
