import { Router, type Request, type Response } from "express";
import { getWhatsAppState, resetWhatsAppSession } from "../bot/wa";

const waRouter = Router();

waRouter.get("/api/wa/status", (_req: Request, res: Response) => {
  const state = getWhatsAppState();
  res.json({
    status: state.status,
    phoneNumber: state.phoneNumber,
    name: state.name,
    lastUpdated: state.lastUpdated,
    hasQR: Boolean(state.qrImage),
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
