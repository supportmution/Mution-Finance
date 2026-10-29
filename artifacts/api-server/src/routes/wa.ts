import { Router, type Request, type Response } from "express";
import { getWhatsAppState } from "../bot/wa";

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

waRouter.get("/wa", (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mution Finance — WhatsApp Bot Connection</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #F8FAFC; color: #1E293B; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: white; border-radius: 16px; padding: 32px; max-width: 460px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06); text-align: center; border: 1px solid #E2E8F0; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
    .badge-connected { background: #DCFCE7; color: #15803D; }
    .badge-disconnected { background: #FEF3C7; color: #B45309; }
    .badge-connecting { background: #E0E7FF; color: #4338CA; }
    h1 { font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 8px; }
    p.desc { font-size: 14px; color: #64748B; margin-bottom: 24px; line-height: 1.5; }
    .qr-container { background: #F1F5F9; border-radius: 12px; padding: 20px; display: inline-block; margin-bottom: 20px; min-height: 280px; min-width: 280px; display: flex; align-items: center; justify-content: center; }
    .qr-container img { width: 280px; height: 280px; border-radius: 8px; }
    .steps { text-align: left; background: #F8FAFC; border-radius: 12px; padding: 16px 20px; margin-top: 16px; border: 1px solid #E2E8F0; font-size: 13px; color: #475569; }
    .steps ol { padding-left: 20px; }
    .steps li { margin-bottom: 6px; }
    .btn { display: inline-block; margin-top: 16px; padding: 10px 20px; background: #F39B62; color: white; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: currentColor; display: inline-block; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
  </style>
</head>
<body>
  <div class="card">
    <div id="badge-box">
      <span class="badge badge-connecting"><span class="pulse"></span> Memeriksa Status...</span>
    </div>
    <h1>Mution Finance WA Bot</h1>
    <p class="desc">Hubungkan WhatsApp Anda untuk mencatat transaksi dan cek saldo secara otomatis.</p>
    
    <div id="content-box">
      <div class="qr-container">
        <p style="color: #64748B;">Memuat QR Code...</p>
      </div>
    </div>

    <div class="steps">
      <p style="font-weight: 600; margin-bottom: 6px; color: #1E293B;">Cara Menghubungkan:</p>
      <ol>
        <li>Buka <b>WhatsApp</b> di HP Anda.</li>
        <li>Buka <b>Pengaturan / Titik Tiga</b> &gt; <b>Perangkat Tertaut</b>.</li>
        <li>Pilih <b>Tautkan Perangkat</b> lalu scan QR Code di atas.</li>
      </ol>
    </div>
  </div>

  <script>
    async function updateStatus() {
      try {
        const res = await fetch('/api/wa/status');
        const data = await res.json();
        const badgeBox = document.getElementById('badge-box');
        const contentBox = document.getElementById('content-box');

        if (data.status === 'connected') {
          badgeBox.innerHTML = '<span class="badge badge-connected"><span class="pulse"></span> WhatsApp Terhubung</span>';
          contentBox.innerHTML = '<div style="padding: 30px 20px;"><div style="font-size: 48px; margin-bottom: 12px;">✅</div><h3 style="font-size: 18px; color: #0F172A; margin-bottom: 6px;">Bot Siap Digunakan!</h3><p style="font-size: 14px; color: #64748B;">Terhubung sebagai <b>+' + (data.phoneNumber || '') + '</b></p><p style="margin-top: 12px; font-size: 13px; color: #10B981; font-weight: 500;">Silakan chat "!ping" ke WhatsApp Anda sendiri untuk tes.</p></div>';
        } else {
          badgeBox.innerHTML = '<span class="badge badge-disconnected"><span class="pulse"></span> Menunggu Scan QR</span>';
          const qrRes = await fetch('/api/wa/qr');
          const qrData = await qrRes.json();
          if (qrData.qrImage) {
            contentBox.innerHTML = '<div class="qr-container"><img src="' + qrData.qrImage + '" alt="QR Code" /></div>';
          } else {
            contentBox.innerHTML = '<div class="qr-container"><p style="color: #64748B;">Menyiapkan QR Code baru...</p></div>';
          }
        }
      } catch (err) {
        console.error("Gagal memeriksa status WA", err);
      }
    }

    updateStatus();
    setInterval(updateStatus, 3000);
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

export default waRouter;
