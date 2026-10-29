import { useEffect, useState } from "react";
import {
  MessageSquare, QrCode, Smartphone, CheckCircle2,
  RefreshCw, Bot, Sparkles, ShieldCheck, Terminal
} from "lucide-react";

interface WAStatus {
  status: "disconnected" | "connecting" | "connected";
  phoneNumber: string | null;
  name: string | null;
  lastUpdated: string;
  hasQR: boolean;
}

export function WhatsAppBotPage() {
  const [statusData, setStatusData] = useState<WAStatus>({
    status: "connecting",
    phoneNumber: null,
    name: null,
    lastUpdated: "",
    hasQR: false,
  });
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/wa/status");
      if (res.ok) {
        const data: WAStatus = await res.json();
        setStatusData(data);

        if (data.status !== "connected") {
          const qrRes = await fetch("/api/wa/qr");
          if (qrRes.ok) {
            const qrData = await qrRes.json();
            setQrImage(qrData.qrImage || null);
          }
        } else {
          setQrImage(null);
        }
      }
    } catch (err) {
      console.error("Gagal mengambil status WhatsApp", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => {
      void fetchStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = statusData.status === "connected";

  return (
    <main className="page-enter">
      {/* Page Title */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-primary">
            Integrasi
          </p>
          <h1 className="font-serif text-[30px] font-bold leading-tight tracking-[-.04em] text-foreground sm:text-[36px]">
            Bot WhatsApp
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hubungkan WhatsApp untuk mencatat pengeluaran, pemasukan, dan melihat saldo secara instan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold ${
              isConnected
                ? "bg-[#eaf4ed] text-[#3e714f] border border-[#cbe4d2]"
                : "bg-[#fff6ee] text-[#b85f2e] border border-[#f5d9c2]"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-[#45a987]" : "bg-[#f39b62] animate-pulse"
              }`}
            />
            {isConnected ? "WhatsApp Terhubung" : "Menunggu Sambungan"}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        {/* Kolom Kiri: Status & QR Code */}
        <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-serif text-lg font-bold">Koneksi Perangkat</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Tautkan akun WhatsApp Anda menggunakan pemindai QR Code.
            </p>
          </div>

          <div className="p-6">
            {isConnected ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#3e714f]">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="font-serif text-2xl font-bold text-foreground">
                  Bot Aktif & Siap Digunakan!
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Terhubung dengan nomor{" "}
                  <b className="text-foreground">+{statusData.phoneNumber || "-"}</b>
                </p>
                <div className="mt-6 rounded-xl border border-border bg-[#fbf8f4] p-4 text-left text-xs leading-relaxed text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">
                    💡 Cara Menguji Bot:
                  </p>
                  Kirim pesan teks <b>!ping</b> ke nomor WhatsApp Anda sendiri. Bot akan langsung merespon.
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="mb-4 rounded-2xl border border-border bg-[#f8f5f0] p-4 shadow-inner">
                  {qrImage ? (
                    <img
                      src={qrImage}
                      alt="QR Code WhatsApp"
                      className="h-[260px] w-[260px] rounded-xl object-contain shadow-sm"
                    />
                  ) : (
                    <div className="flex h-[260px] w-[260px] flex-col items-center justify-center rounded-xl bg-white text-muted-foreground">
                      <RefreshCw className="h-8 w-8 animate-spin text-primary mb-2" />
                      <p className="text-xs">Menyiapkan QR Code...</p>
                    </div>
                  )}
                </div>

                <div className="w-full rounded-xl border border-[#eed9c5] bg-[#fff9f3] p-4 text-left text-xs text-[#805335]">
                  <p className="font-bold mb-1 flex items-center gap-1.5">
                    <Smartphone size={14} /> Langkah Tautkan WhatsApp:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Buka WhatsApp di HP Anda.</li>
                    <li>
                      Pilih menu <b>Perangkat Tertaut (Linked Devices)</b>.
                    </li>
                    <li>
                      Klik <b>Tautkan Perangkat</b> dan arahkan kamera ke QR di atas.
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Kolom Kanan: Panduan & Perintah Bot */}
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-serif text-lg font-bold flex items-center gap-2">
                <Terminal size={18} className="text-primary" /> Perintah Bot
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Perintah yang dapat Anda kirimkan ke chat WhatsApp.
              </p>
            </div>
            <div className="divide-y divide-border/70 p-2">
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-primary bg-[#fff2e8] px-2 py-1 rounded-md">
                    !ping
                  </span>
                  <span className="text-[11px] text-muted-foreground">Cek Status</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Memastikan bot aktif dan merespon dari server Railway.
                </p>
              </div>

              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-primary bg-[#fff2e8] px-2 py-1 rounded-md">
                    !menu
                  </span>
                  <span className="text-[11px] text-muted-foreground">Bantuan</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Menampilkan ringkasan menu dan format pesan.
                </p>
              </div>

              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#45a987] bg-[#ebf7f2] px-2 py-1 rounded-md">
                    Natural Chat (AI)
                  </span>
                  <span className="text-[11px] text-[#45a987] font-semibold">Segera Aktif</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Catat transaksi bahasa santai: <i>"keluar 50rb bensin BCA"</i> atau cek ringkasan: <i>"berapa sisa saldo kita?"</i>
                </p>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-[#f8f5f0] p-5 shadow-sm">
            <div className="flex gap-3">
              <Sparkles size={18} className="mt-0.5 text-primary shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Koneksi Aman & Privat
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Bot berjalan langsung di server Railway pribadi Mution.tech dan terhubung ke database Supabase Anda tanpa perantara pihak ketiga.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
