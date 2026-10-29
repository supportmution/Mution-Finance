import { type ReactNode, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { Activity, BarChart3, ChevronRight, CircleHelp, LayoutDashboard, LogOut, Menu, MessageSquare, ReceiptText, Settings, ShieldCheck } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import { LoginPage, OverviewPage, ReportsPage, SettingsPage, TransactionsPage } from "@/pages/finance";
import { WhatsAppBotPage } from "@/pages/whatsapp";

const queryClient = new QueryClient();

const navigation = [
  { href: "/", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/transactions", label: "Transaksi", icon: ReceiptText },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
  { href: "/whatsapp", label: "Bot WhatsApp", icon: MessageSquare },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, signOut, demoMode } = useAuth();
  const [first = "F", second = ""] = (user?.email || "Finance Workspace").split("@")[0].split(/[ ._-]/);
  return <div className="min-h-[100dvh] bg-background">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
      <Link href="/" className="mb-9 flex items-center gap-3 px-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-primary font-serif text-lg font-bold text-white shadow-sm">m</span>
        <span><b className="block font-serif text-[17px] leading-5 tracking-tight text-sidebar-foreground">mution</b><span className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">finance workspace</span></span>
      </Link>
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-[#9e8e7e]">Workspace</p>
      <nav className="space-y-1">{navigation.map(({ href, label, icon: Icon }) => {
        const active = location === href;
        return <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors ${active ? "bg-white text-[#9f5733] shadow-[0_2px_8px_rgba(69,48,27,.06)]" : "text-[#766c60] hover:bg-[#eee6db] hover:text-foreground"}`}>
          <Icon size={17} strokeWidth={active ? 2.2 : 1.8} /><span>{label}</span>{active && <ChevronRight size={14} className="ml-auto" />}
        </Link>;
      })}</nav>
      <div className="mt-auto">
        <div className="mb-3 rounded-2xl border border-[#e9ddce] bg-[#fbf7f1] p-3.5"><div className="flex gap-2.5"><span className="mt-0.5 text-[#b77a51]"><ShieldCheck size={16} /></span><div><p className="text-xs font-bold text-foreground">Data terpisah</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Finance workspace tidak terhubung ke data produk inti.</p></div></div></div>
        {demoMode && <div className="mb-3 flex items-center gap-2 rounded-lg bg-[#eaf4ed] px-3 py-2 text-[10px] font-semibold text-[#477154]"><span className="h-1.5 w-1.5 rounded-full bg-[#70a281]" />Mode demo · penyimpanan lokal</div>}
        <div className="flex items-center justify-between rounded-xl px-2 py-2"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8d8c6] text-xs font-bold uppercase text-[#80634a]">{first?.[0]}{second?.[0]}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-foreground">{user?.email?.split("@")[0] || "Finance team"}</p><p className="text-[10px] text-muted-foreground">{user?.email || "Mution internal"}</p></div></div><button data-testid="button-sign-out" title="Keluar" onClick={() => void signOut()} className="rounded-lg p-2 text-muted-foreground hover:bg-[#eee6db] hover:text-foreground"><LogOut size={15} /></button></div>
      </div>
    </aside>
    <div className="lg:pl-[248px]">
      <header className="sticky top-0 z-20 flex h-[62px] items-center justify-between border-b border-border/75 bg-background/90 px-4 backdrop-blur-md sm:px-7 lg:h-[70px] lg:px-9">
        <div className="flex items-center gap-3 lg:hidden"><Link href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-serif text-lg font-bold text-white">m</Link><div><p className="font-serif text-sm font-bold leading-4">mution</p><p className="text-[9px] font-bold uppercase tracking-[.13em] text-muted-foreground">finance</p></div></div>
        <div className="hidden items-center gap-2 text-[11px] text-muted-foreground lg:flex"><span>Workspace</span><span>/</span><span className="font-semibold text-foreground">{navigation.find(item => item.href === location)?.label || "Finance"}</span></div>
        <div className="ml-auto flex items-center gap-2"><span className="hidden items-center gap-1.5 rounded-full border border-[#e5eadf] bg-[#f4f8f1] px-2.5 py-1 text-[10px] font-semibold text-[#5c7d62] sm:flex"><Activity size={12} /> Finance workspace</span><button aria-label="Keluar" data-testid="button-mobile-sign-out" onClick={() => void signOut()} className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"><LogOut size={17} /></button></div>
      </header>
      <div className="mx-auto max-w-[1440px] px-4 py-7 pb-24 sm:px-7 sm:py-9 sm:pb-24 lg:px-10 lg:py-10">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-lg lg:hidden">{navigation.map(({ href, label, icon: Icon }) => {
        const active = location === href;
        return <Link key={href} href={href} data-testid={`mobile-link-${label.toLowerCase()}`} className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}><Icon size={18} strokeWidth={active ? 2.3 : 1.8} />{label}</Link>;
      })}</nav>
    </div>
  </div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ProtectedApp() {
  const { user, loading, demoMode } = useAuth();
  const [location, setLocation] = useLocation();
  useEffect(() => {
    if (!demoMode && !user && location !== "/login") setLocation("/login");
    if (user && location === "/login") setLocation("/");
  }, [demoMode, location, setLocation, user]);
  if (loading) return <div className="min-h-[100dvh] bg-background p-8"><div className="mx-auto max-w-5xl space-y-4"><div className="h-10 w-48 animate-pulse rounded-xl bg-muted" /><div className="grid gap-4 sm:grid-cols-4">{[1,2,3,4].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-white" />)}</div><div className="h-72 animate-pulse rounded-2xl bg-white" /></div></div>;
  if (!demoMode && !user && location !== "/login") return null;
  if (location === "/login") return <LoginPage />;
  return <Shell><RoutedErrorBoundary><Switch>
    <Route path="/" component={OverviewPage} />
    <Route path="/transactions" component={TransactionsPage} />
    <Route path="/reports" component={ReportsPage} />
    <Route path="/whatsapp" component={WhatsAppBotPage} />
    <Route path="/settings" component={SettingsPage} />
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary></Shell>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><AuthProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><ProtectedApp /></WouterRouter></AuthProvider><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
