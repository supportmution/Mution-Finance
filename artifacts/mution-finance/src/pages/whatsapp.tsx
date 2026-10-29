import { useEffect, useState } from "react";
import {
  MessageSquare, Smartphone, CheckCircle2,
  RefreshCw, Bot, Sparkles, Terminal, KeyRound, Copy, Check, ExternalLink, Link2, AlertCircle
} from "lucide-react";

interface FonnteStatus {
  configured: boolean;
  status: string;
  name?: string;
  device?: string;
  quota?: string;
  detail?: any;
}

export function WhatsAppBotPage() {
  const [fonnteStatus, setFonnteStatus] = useState<FonnteStatus>({
    configured: false,
    status: "loading",
  });
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/fonnte/webhook`
      : "/api/fonnte/webhook";

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/fonnte/status");
      if (res.ok) {
        const data: FonnteStatus = await res.json();
        setFonnteStatus(data);
      }
    } catch (err) {
      console.error("Gagal mengambil status Fonnte", err);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchStatus();
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => {
      void fetchStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const isConnected =
    fonnteStatus.configured &&
    (fonnteStatus.status === "connected" ||
      fonnteStatus.status === "connect" ||
      Boolean(fonnteStatus.device));

  return (
    <main className="page-enter">
      {/* Page Title */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-primary">
            Integrasi WhatsApp
          </p>
          <h1 className="font-serif text-[30px] font-bold leading-tight tracking-[-.04em] text-foreground sm:text-[36px]">
            WhatsApp Gateway (Fonnte)
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Catat pengeluaran & pemasukan keuangan langsung lewat chat WhatsApp dengan dukungan AI & Fonnte Gateway yang stabil.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-[#fff0ed] hover:text-primary transition-colors shadow-sm"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-primary" : ""} />
            {refreshing ? "Memeriksa..." : "Segarkan Status"}
          </button>

          <span
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold ${
              isConnected
                ? "bg-[#eaf4ed] text-[#3e714f] border border-[#cbe4d2]"
                : fonnteStatus.configured
                ? "bg-[#fff6ee] text-[#b85f2e] border border-[#f5d9c2]"
                : "bg-[#f5f5f5] text-[#71717a] border border-[#e4e4e7]"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected
                  ? "bg-[#45a987]"
                  : fonnteStatus.configured
                  ? "bg-[#f39b62] animate-pulse"
                  : "bg-[#a1a1aa]"
              }`}
            />
            {isConnected
              ? "WhatsApp Terhubung"
              : fonnteStatus.configured
              ? "Token Terpasang (Cek Device)"
              : "Belum Dikonfigurasi"}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        {/* Kolom Kiri: Status Koneksi & Webhook Setup */}
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="border-b border-border px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-lg font-bold flex items-center gap-2">
                  <Smartphone size={18} className="text-primary" /> Status Gateway Fonnte
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Status koneksi nomor WhatsApp Anda via Fonnte Gateway.
                </p>
              </div>
            </div>

            <div className="p-6">
              {isConnected ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#3e714f]">
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-foreground">
                    WhatsApp Bot Aktif & Siap!
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Terhubung dengan nomor{" "}
                    <b className="text-foreground">+{fonnteStatus.device || "-"}</b>
                    {fonnteStatus.name ? ` (${fonnteStatus.name})` : ""}
                  </p>
                  {fonnteStatus.quota && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sisa Kuota Fonnte: <b>{fonnteStatus.quota}</b>
                    </p>
                  )}
                  <div className="mt-6 w-full rounded-xl border border-border bg-[#fbf8f4] p-4 text-left text-xs leading-relaxed text-muted-foreground">
                    <p className="font-semibold text-foreground mb-1">
                      💡 Cara Menguji Bot:
                    </p>
                    Kirim pesan teks <b>!ping</b> atau langsung catat transaksi seperti <b>keluar 50rb bensin BCA</b> ke nomor WhatsApp tersebut.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#eed9c5] bg-[#fff9f3] p-4 text-xs text-[#805335]">
                    <p className="font-bold mb-1.5 flex items-center gap-1.5">
                      <AlertCircle size={15} className="text-primary" /> Langkah Setup Fonnte (Mudah & Cepat):
                    </p>
                    <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                      <li>
                        Buka{" "}
                        <a
                          href="https://fonnte.com"
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold underline inline-flex items-center gap-0.5 text-primary"
                        >
                          Fonnte.com <ExternalLink size={11} />
                        </a>{" "}
                        dan buat akun gratis / masuk.
                      </li>
                      <li>
                        Di menu <b>Device</b>, klik <b>Add Device</b> dan scan QR code menggunakan nomor WhatsApp Anda.
                      </li>
                      <li>
                        Salin <b>API Token</b> dari device Anda di Fonnte, lalu tambahkan variabel <code className="bg-[#ffe8d9] px-1 py-0.5 rounded font-mono">FONNTE_TOKEN</code> di Dashboard <b>Railway</b>.
                      </li>
                      <li>
                        Di dashboard Fonnte, masukkan URL Webhook di bawah ini pada kolom <b>Webhook URL</b> device Anda.
                      </li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Card Webhook URL */}
          <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-serif text-lg font-bold flex items-center gap-2">
                <Link2 size={18} className="text-primary" /> Webhook URL Server Anda
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Tempelkan URL ini di pengaturan Device pada dashboard Fonnte Anda.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 rounded-xl border border-border bg-[#fbf8f4] px-3.5 py-2.5 font-mono text-xs text-foreground select-all"
                />
                <button
                  onClick={handleCopyWebhook}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs font-semibold text-foreground hover:bg-[#fff0ed] hover:text-primary transition-colors shadow-sm"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-[#3e714f]" /> Tersalin!
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Salin URL
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Setiap pesan WhatsApp yang masuk akan otomatis diteruskan ke URL ini untuk diproses oleh AI dan disimpan ke Supabase Mution Finance.
              </p>
            </div>
          </section>
        </div>

        {/* Kolom Kanan: Panduan, Perintah & Konfigurasi AI */}
        <div className="space-y-6">
          {/* Card Konfigurasi AI */}
          <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-serif text-lg font-bold flex items-center gap-2">
                <Bot size={18} className="text-primary" /> Pengaturan AI Assistant
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Konfigurasi provider AI yang digunakan bot (OpenAI, Gemini, OpenRouter, Groq, dll).
              </p>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="rounded-xl border border-border bg-[#fbf8f4] p-3.5 space-y-2">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <KeyRound size={14} className="text-primary" /> Environment Variables di Railway:
                </p>
                <div className="space-y-1.5 font-mono text-[11px] text-[#715039]">
                  <p><b className="text-foreground">FONNTE_TOKEN:</b> Token API dari dashboard Fonnte</p>
                  <p><b className="text-foreground">AI_API_KEY:</b> Kunci API penyedia AI Anda</p>
                  <p><b className="text-foreground">AI_BASE_URL:</b> Endpoint API (opsional, default: https://api.openai.com/v1)</p>
                  <p><b className="text-foreground">AI_MODEL_ID:</b> Model yang dipakai (opsional, default: gpt-4o-mini)</p>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Variabel di atas dimasukkan pada tab <b>Variables</b> di Railway Dashboard.
              </p>
            </div>
          </section>

          {/* Card Panduan Perintah */}
          <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-serif text-lg font-bold flex items-center gap-2">
                <Terminal size={18} className="text-primary" /> Contoh Format Pesan WhatsApp
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Kirim pesan berikut langsung ke WhatsApp atau grup Anda:
              </p>
            </div>
            <div className="divide-y divide-border/70 p-2 text-xs">
              <div className="p-3">
                <p className="font-bold text-foreground mb-1">🔴 Catat Pengeluaran:</p>
                <p className="text-muted-foreground italic">"keluar 50rb bensin BCA"</p>
                <p className="text-muted-foreground italic">"bayar server aws 350.000 pakai kartu kredit"</p>
              </div>

              <div className="p-3">
                <p className="font-bold text-foreground mb-1">🟢 Catat Pemasukan:</p>
                <p className="text-muted-foreground italic">"masuk 10jt pembayaran klien Midtrans"</p>
                <p className="text-muted-foreground italic">"dapat transfer 250rb"</p>
              </div>

              <div className="p-3">
                <p className="font-bold text-foreground mb-1">📊 Cek Laporan & Saldo:</p>
                <p className="text-muted-foreground italic">"berapa sisa saldo kita?"</p>
                <p className="text-muted-foreground italic">"ringkasan keuangan bulan ini"</p>
              </div>

              <div className="p-3">
                <p className="font-bold text-foreground mb-1">🏓 Perintah Cepat:</p>
                <p className="text-muted-foreground italic"><b>!ping</b> - Cek koneksi server</p>
                <p className="text-muted-foreground italic"><b>!menu</b> - Panduan lengkap bot</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
