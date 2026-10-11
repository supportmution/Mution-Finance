import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, CreditCard, Download,
  FileText, Filter, LayoutDashboard, LogOut, Menu, MoreHorizontal, Pencil,
  Plus, Search, Settings2, Trash2, TrendingDown, TrendingUp, Wallet, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useAccessList, useAddFinanceAccess, useBudgets, useCategories, useCreateCategory, useCreateTransaction,
  useDeleteCategory, useDeleteTransaction, useFinanceDashboard,
  useFinanceSettings, useProfitLossReport, useRemoveFinanceAccess, useSaveBudget, useTransactions, useUpdateCategory,
  useUpdateFinanceSettings, useUpdateTransaction,
} from "@/lib/finance-data";
import type { AccessRole, Category, CategoryInput, FinanceSettings, Transaction, TransactionInput, TransactionPurpose, TransactionType } from "@/lib/finance-types";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const currentMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date());
const monthLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
const rupiah = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const dateLabel = (date: string) => new Date(date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" });
const dateInputValue = (date: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
const normalizeRupiahDigits = (value: string) => value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
const formatRupiahInput = (value: string) => normalizeRupiahDigits(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
type TransactionFormKind = "OPERATING_INCOME" | "OPERATING_EXPENSE" | Exclude<TransactionPurpose, "OPERATING">;
const transactionKindOptions: { value: TransactionFormKind; label: string; purpose: TransactionPurpose; type: TransactionType }[] = [
  { value: "OPERATING_INCOME", label: "Pemasukan usaha", purpose: "OPERATING", type: "INCOME" },
  { value: "OPERATING_EXPENSE", label: "Pengeluaran usaha", purpose: "OPERATING", type: "EXPENSE" },
  { value: "OWNER_CAPITAL", label: "Setoran modal pemilik", purpose: "OWNER_CAPITAL", type: "INCOME" },
  { value: "OWNER_WITHDRAWAL", label: "Penarikan pemilik", purpose: "OWNER_WITHDRAWAL", type: "EXPENSE" },
  { value: "LOAN_RECEIVED", label: "Pinjaman diterima", purpose: "LOAN_RECEIVED", type: "INCOME" },
  { value: "LOAN_PRINCIPAL_REPAYMENT", label: "Bayar pokok pinjaman", purpose: "LOAN_PRINCIPAL_REPAYMENT", type: "EXPENSE" },
  { value: "LOAN_INTEREST", label: "Bayar bunga pinjaman", purpose: "LOAN_INTEREST", type: "EXPENSE" },
  { value: "ASSET_PURCHASE", label: "Beli aset / investasi", purpose: "ASSET_PURCHASE", type: "EXPENSE" },
];
const transactionPurposeLabel = (purpose: TransactionPurpose) =>
  transactionKindOptions.find((option) => option.purpose === purpose)?.label ?? "Transaksi usaha";
const donutGradient = (slices: { color: string; percentage: number }[]) => {
  let offset = 0;
  const stops = slices.map(({ color, percentage }) => {
    const start = offset;
    offset += percentage * 3.6;
    return `${color} ${start}deg ${offset}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
};

function monthStep(month: string, step: number) {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() + step);
  return date.toISOString().slice(0, 7);
}

function PageTitle({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-primary">{eyebrow}</p><h1 className="font-serif text-[30px] font-bold leading-tight tracking-[-.04em] text-foreground sm:text-[36px]">{title}</h1>{subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}</div>{actions}</div>;
}

function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-2 shadow-sm">
    <button data-testid="button-month-previous" aria-label="Previous month" onClick={() => onChange(monthStep(month, -1))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><ChevronLeft size={16} /></button>
    <span className="min-w-[124px] text-center text-sm font-semibold capitalize text-foreground">{monthLabel(month)}</span>
    <button data-testid="button-month-next" aria-label="Next month" onClick={() => onChange(monthStep(month, 1))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><ChevronRight size={16} /></button>
  </div>;
}

function LoadingRows() { return <div className="space-y-3 p-5">{[1, 2, 3, 4].map((x) => <div key={x} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div>; }
function QueryError({ retry }: { retry: () => void }) { return <div className="p-8 text-center"><p className="font-semibold">Data belum bisa dimuat</p><p className="mt-1 text-sm text-muted-foreground">Periksa koneksi Supabase dan pastikan migrasi database sudah dijalankan.</p><button onClick={retry} className="mt-4 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold">Coba lagi</button></div>; }
function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) { return <div className="flex min-h-[210px] flex-col items-center justify-center px-6 text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary"><FileText size={20} /></div><h3 className="font-semibold">{title}</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>{action && <div className="mt-4">{action}</div>}</div>; }

type RupiahInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur" | "type" | "inputMode"
> & {
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: (value: string) => void;
  testId?: string;
};

function RupiahInput({ value, onValueChange, onBlur, testId, className = "form-input", placeholder = "0", disabled, ...inputProps }: RupiahInputProps) {
  const [displayValue, setDisplayValue] = useState(() => formatRupiahInput(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const rawValueRef = useRef(value);

  useEffect(() => {
    rawValueRef.current = value;
    setDisplayValue(formatRupiahInput(value));
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.currentTarget.value;
    const cursor = event.currentTarget.selectionStart ?? inputValue.length;
    const digitsBeforeCursor = normalizeRupiahDigits(
      inputValue.slice(0, cursor),
    ).length;
    const nextRawValue = normalizeRupiahDigits(inputValue);
    const nextDisplayValue = formatRupiahInput(nextRawValue);
    rawValueRef.current = nextRawValue;
    setDisplayValue(nextDisplayValue);
    onValueChange(nextRawValue);

    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input || document.activeElement !== input) return;
      let nextCursor = 0;
      if (digitsBeforeCursor > 0) {
        let digitCount = 0;
        nextCursor = nextDisplayValue.length;
        for (let index = 0; index < nextDisplayValue.length; index += 1) {
          if (/\d/.test(nextDisplayValue[index])) digitCount += 1;
          if (digitCount >= digitsBeforeCursor) {
            nextCursor = index + 1;
            break;
          }
        }
      }
      input.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <input
      {...inputProps}
      ref={inputRef}
      data-testid={testId}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={displayValue}
      onChange={handleChange}
      onBlur={() => onBlur?.(rawValueRef.current)}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
}

function BudgetInput({ categoryId, month, value, onCommit, disabled }: { categoryId: string; month: string; value: number; onCommit: (categoryId: string, rawValue: string) => void; disabled: boolean }) {
  const [rawValue, setRawValue] = useState(value > 0 ? String(Math.round(value)) : "");
  useEffect(() => {
    setRawValue(value > 0 ? String(Math.round(value)) : "");
  }, [month, value]);

  return (
    <div className="relative w-[150px]">
      <span className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 text-[10px] text-muted-foreground">Rp</span>
      <RupiahInput
        testId={`input-budget-${categoryId}`}
        value={rawValue}
        onValueChange={setRawValue}
        onBlur={(nextValue) => {
          if (nextValue) onCommit(categoryId, nextValue);
          else setRawValue(value > 0 ? String(Math.round(value)) : "");
        }}
        disabled={disabled}
        placeholder="Atur batas"
        className="form-input h-8 pl-7 pr-2 text-xs disabled:bg-muted"
      />
    </div>
  );
}

function MetricCard({ label, value, hint, icon: Icon, tone = "default" }: { label: string; value: number; hint: string; icon: typeof Wallet; tone?: "default" | "orange" | "green" | "red" }) {
  const styles = { default: "bg-white", orange: "bg-[#fff6ef]", green: "bg-[#f1f8f4]", red: "bg-[#fff4f1]" };
  return <div className={`rounded-2xl border border-border/80 p-5 shadow-[0_2px_10px_rgba(79,52,27,.025)] ${styles[tone]}`}>
    <div className="flex items-center justify-between"><span className="text-[13px] font-medium text-muted-foreground">{label}</span><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-primary"><Icon size={17} /></span></div>
    <p className="mt-5 font-serif text-[25px] font-bold tracking-[-.04em] text-foreground">{rupiah(value)}</p><p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
  </div>;
}

function TransactionRows({ rows, onEdit, onDelete }: { rows: Transaction[]; onEdit?: (t: Transaction) => void; onDelete?: (t: Transaction) => void }) {
  if (!rows.length) return <EmptyState title="Belum ada transaksi" text="Catatan yang dibuat akan muncul di sini." />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left"><thead><tr className="border-b border-border bg-[#fcfaf7] text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground"><th className="px-5 py-3.5">Detail</th><th className="px-4 py-3.5">Jenis transaksi</th><th className="px-4 py-3.5">Tanggal</th><th className="px-4 py-3.5 text-right">Jumlah</th>{onEdit && <th className="w-[90px] px-4 py-3.5"></th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} data-testid={`row-transaction-${row.id}`} className="border-b border-border/70 last:border-0 hover:bg-[#fffdfa]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${row.type === "INCOME" ? "bg-[#edf6f0] text-[#428365]" : "bg-[#fff2e9] text-primary"}`}>{row.type === "INCOME" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span><div><p className="text-sm font-semibold">{row.description}</p><p className="mt-0.5 text-xs text-muted-foreground">{row.payment_method || "—"}</p></div></div></td><td className="px-4 py-4"><span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><i className="h-2 w-2 rounded-full" style={{ background: row.category?.color || "#d6c8b8" }} />{row.purpose === "OPERATING" ? row.category?.name || "Tanpa kategori" : transactionPurposeLabel(row.purpose)}</span></td><td className="px-4 py-4 text-sm text-muted-foreground">{dateLabel(row.date)}</td><td className={`px-4 py-4 text-right font-mono text-sm font-semibold ${row.type === "INCOME" ? "text-[#39795b]" : "text-foreground"}`}>{row.type === "INCOME" ? "+" : "−"}{rupiah(row.amount)}</td>{onEdit && <td className="px-4 py-4 text-right"><button data-testid={`button-edit-${row.id}`} onClick={() => onEdit(row)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit transaksi"><Pencil size={15} /></button><button data-testid={`button-delete-${row.id}`} onClick={() => onDelete?.(row)} className="rounded-lg p-2 text-muted-foreground hover:bg-[#fff0ed] hover:text-destructive" aria-label="Hapus transaksi"><Trash2 size={15} /></button></td>}</tr>)}</tbody></table></div>;
}

function DialogFrame({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2b211b]/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[26px] border border-border bg-white p-6 shadow-2xl sm:rounded-[26px]"><div className="mb-6 flex items-start justify-between"><div><h2 className="font-serif text-2xl font-bold tracking-[-.035em]">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div><button aria-label="Tutup" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button></div>{children}</section></div>;
}

type TxValues = { date: string; kind: TransactionFormKind; category_id: string; amount: string; description: string; payment_method: string; receipt_url: string };
function TransactionForm({ categories, initial, onCancel, onSubmit, busy, error }: { categories: Category[]; initial?: Transaction; onCancel: () => void; onSubmit: (input: TransactionInput) => void; busy: boolean; error?: string }) {
  const initialKind: TransactionFormKind = initial
    ? initial.purpose === "OPERATING"
      ? initial.type === "INCOME" ? "OPERATING_INCOME" : "OPERATING_EXPENSE"
      : initial.purpose
    : "OPERATING_EXPENSE";
  const form = useForm<TxValues>({ defaultValues: { date: initial ? dateInputValue(initial.date) : dateInputValue(new Date().toISOString()), kind: initialKind, category_id: initial?.category_id || "", amount: initial ? String(Math.round(initial.amount)) : "", description: initial?.description || "", payment_method: initial?.payment_method || "", receipt_url: initial?.receipt_url || "" } });
  const kind = form.watch("kind");
  const selectedKind = transactionKindOptions.find((option) => option.value === kind) ?? transactionKindOptions[1];
  const options = categories.filter((item) => item.type === selectedKind.type);
  const submit = form.handleSubmit((values) => onSubmit({
    date: new Date(`${values.date}T12:00:00+07:00`).toISOString(),
    type: selectedKind.type,
    purpose: selectedKind.purpose,
    category_id: selectedKind.purpose === "OPERATING" ? values.category_id : null,
    amount: Number(values.amount),
    description: values.description,
    payment_method: values.payment_method || null,
    receipt_url: values.receipt_url || null,
  }));
  return <Form {...form}><form onSubmit={submit} className="space-y-4">
    <div className="grid grid-cols-2 gap-3"><FormField control={form.control} name="kind" render={({ field }) => <FormItem><FormLabel>Jenis transaksi</FormLabel><FormControl><select data-testid="select-transaction-type" {...field} onChange={(event) => { field.onChange(event); form.setValue("category_id", ""); }} className="form-input">{transactionKindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormControl></FormItem>} /><FormField control={form.control} name="date" rules={{ required: "Tanggal wajib diisi" }} render={({ field }) => <FormItem><FormLabel>Tanggal</FormLabel><FormControl><input data-testid="input-transaction-date" type="date" {...field} className="form-input" /></FormControl><FormMessage /></FormItem>} /></div>
    <FormField control={form.control} name="description" rules={{ required: "Deskripsi wajib diisi" }} render={({ field }) => <FormItem><FormLabel>Deskripsi</FormLabel><FormControl><input data-testid="input-transaction-description" placeholder="Contoh: Tagihan AWS" {...field} className="form-input" /></FormControl><FormMessage /></FormItem>} />
    <div className="grid grid-cols-2 gap-3">{selectedKind.purpose === "OPERATING" ? <FormField control={form.control} name="category_id" rules={{ required: "Pilih kategori" }} render={({ field }) => <FormItem><FormLabel>Kategori</FormLabel><FormControl><select data-testid="select-transaction-category" {...field} className="form-input"><option value="">Pilih kategori</option>{options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FormControl><FormMessage /></FormItem>} /> : <div className="flex min-h-[72px] items-center rounded-xl border border-dashed border-border px-3 text-xs leading-relaxed text-muted-foreground">Transaksi ini tidak memengaruhi laba operasional, jadi tidak memerlukan kategori biaya atau pendapatan.</div>}<FormField control={form.control} name="amount" rules={{ required: "Jumlah wajib diisi", validate: (v) => Number(v) > 0 || "Jumlah harus lebih dari 0" }} render={({ field }) => <FormItem><FormLabel>Jumlah (Rp)</FormLabel><FormControl><RupiahInput testId="input-transaction-amount" value={field.value} onValueChange={field.onChange} onBlur={() => field.onBlur()} placeholder="0" /></FormControl><FormMessage /></FormItem>} /></div>
    <FormField control={form.control} name="payment_method" render={({ field }) => <FormItem><FormLabel>Akun / sumber dana <span className="font-normal text-muted-foreground">· opsional</span></FormLabel><FormControl><input data-testid="input-payment-method" {...field} placeholder="BCA, kas, pemberi pinjaman…" className="form-input" /></FormControl><FormMessage /></FormItem>} />
    {error && <p className="rounded-lg bg-[#fff2ef] px-3 py-2 text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted">Batal</button><button data-testid="button-save-transaction" disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60">{busy ? "Menyimpan…" : "Simpan transaksi"}</button></div>
  </form></Form>;
}

export function OverviewPage() {
  const [month, setMonth] = useState(currentMonth);
  const dashboard = useFinanceDashboard(month);
  const [loc, setLoc] = useLocation();
  const data = dashboard.data;
  return <main className="page-enter"><PageTitle eyebrow="Ringkasan keuangan" title="Selamat datang kembali" subtitle="Semua arus kas Mution, dalam satu pandangan." actions={<MonthPicker month={month} onChange={setMonth} />} />
    {dashboard.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(i => <div className="h-36 animate-pulse rounded-2xl bg-white" key={i} />)}</div> : dashboard.isError ? <div className="rounded-2xl border bg-white"><QueryError retry={() => void dashboard.refetch()} /></div> : data && <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Pemasukan usaha" value={data.income} hint="Bulan ini" icon={TrendingUp} tone="green" /><MetricCard label="Biaya usaha" value={data.expense} hint="Bulan ini" icon={TrendingDown} tone="orange" /><MetricCard label="Laba bersih" value={data.netProfit} hint="Termasuk biaya bunga pinjaman" icon={BarChart3} tone={data.netProfit >= 0 ? "default" : "red"} /><MetricCard label="Saldo kas" value={data.cashBalance} hint={`Per akhir ${monthLabel(month)} · dari saldo awal`} icon={Wallet} /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label="Setoran modal" value={data.ownerCapital} hint="Bulan ini · bukan pendapatan" icon={TrendingUp} tone="green" /><MetricCard label="Penarikan pemilik" value={data.ownerWithdrawals} hint="Bulan ini · bukan biaya usaha" icon={TrendingDown} tone="orange" /><MetricCard label="Utang pinjaman tercatat" value={data.loanBalance} hint="Pinjaman masuk dikurangi pokok dibayar sejak tanggal awal" icon={CreditCard} /><MetricCard label="Pembelian aset / investasi" value={data.assetPurchases} hint="Bulan ini · arus kas keluar" icon={Wallet} /><MetricCard label="Laba ditahan" value={data.retainedEarnings} hint="Laba terkumpul dikurangi penarikan" icon={BarChart3} tone={data.retainedEarnings >= 0 ? "green" : "red"} /></div>
      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-border bg-white"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-serif text-lg font-bold tracking-tight">Arus kas</h2><p className="mt-0.5 text-xs text-muted-foreground">Semua uang masuk dan keluar · 6 bulan terakhir</p></div><button onClick={() => setLoc("/reports")} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Lihat laporan <ArrowRight size={14} /></button></div>
          <div className="px-5 pb-4 pt-7">{data.cashFlow.length ? <div className="flex h-[190px] items-end justify-between gap-3">{data.cashFlow.map((point) => { const max = Math.max(...data.cashFlow.map(p => Math.max(p.cashIn, p.cashOut)), 1); const im = point.cashIn ? Math.max(7, point.cashIn / max * 145) : 0; const ex = point.cashOut ? Math.max(7, point.cashOut / max * 145) : 0; return <div key={point.month} className="flex flex-1 flex-col items-center gap-3"><div className="flex h-[150px] w-full items-end justify-center gap-1.5"><div title={`Uang masuk ${rupiah(point.cashIn)}`} className="w-[min(24px,38%)] rounded-t-md bg-[#df9066]" style={{ height: `${im}px` }} /><div title={`Uang keluar ${rupiah(point.cashOut)}`} className="w-[min(24px,38%)] rounded-t-md bg-[#e9ded0]" style={{ height: `${ex}px` }} /></div><span className="text-[10px] font-medium text-muted-foreground">{new Date(`${point.month}-01`).toLocaleDateString("id-ID", { month: "short" })}</span></div>; })}</div> : <EmptyState title="Belum ada arus kas" text="Transaksi bulanan akan membentuk tren di sini." />}
          <div className="mt-4 flex justify-center gap-5 border-t border-border pt-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#df9066]" />Uang masuk</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#e9ded0]" />Uang keluar</span></div></div>
        </section>
        <section className="rounded-2xl border border-border bg-white"><div className="border-b border-border px-5 py-4"><h2 className="font-serif text-lg font-bold tracking-tight">Pengeluaran per kategori</h2><p className="mt-0.5 text-xs text-muted-foreground">Distribusi bulan ini</p></div>{data.expenseBreakdown.length ? <div className="grid gap-6 p-5 sm:grid-cols-[minmax(132px,.8fr)_minmax(0,1.2fr)]"><div className="flex items-center justify-center"><div role="img" aria-label="Donut pengeluaran berdasarkan kategori" className="relative h-36 w-36 rounded-full" style={{ background: donutGradient(data.expenseBreakdown) }}><div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white text-center"><span className="text-[10px] font-medium text-muted-foreground">Total biaya</span><b className="mt-1 max-w-[92px] truncate font-mono text-sm text-foreground">{rupiah(data.expense)}</b></div></div></div><div className="flex flex-col justify-center gap-3">{data.expenseBreakdown.map((item) => <div key={item.categoryId} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} /><span className="truncate font-medium">{item.categoryName}</span></span><span className="shrink-0 text-right"><b className="font-mono">{Math.round(item.percentage)}%</b><span className="ml-2 text-muted-foreground">{rupiah(item.amount)}</span></span></div>)}</div></div> : <EmptyState title="Belum ada pengeluaran" text="Data kategori akan muncul setelah transaksi dicatat." />}</section>
      </div>
      <section className="overflow-hidden rounded-2xl border border-border bg-white"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-serif text-lg font-bold tracking-tight">Transaksi terbaru</h2><p className="mt-0.5 text-xs text-muted-foreground">Aktivitas keuangan terbaru</p></div><button onClick={() => setLoc("/transactions")} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Semua transaksi <ArrowRight size={14} /></button></div><TransactionRows rows={data.recentTransactions} /></section>
    </div>}
    <div className="mt-7 flex items-center gap-2 text-xs text-muted-foreground"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f7eee5] text-[#a77752]"><Check size={12} /></span>Data keuangan disimpan terpisah dari sistem produk Mution.</div>
  </main>;
}

export function TransactionsPage() {
  const [month, setMonth] = useState(currentMonth);
  const [kindFilter, setKindFilter] = useState<TransactionFormKind | "ALL">("ALL");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Transaction | null | "new">(null);
  const [error, setError] = useState("");
  const selectedFilter = transactionKindOptions.find((option) => option.value === kindFilter);
  const transactions = useTransactions({ month, type: selectedFilter?.type ?? "ALL", purpose: selectedFilter?.purpose ?? "ALL", categoryId, search });
  const categories = useCategories();
  const create = useCreateTransaction(); const update = useUpdateTransaction(); const remove = useDeleteTransaction();
  const save = (input: TransactionInput) => { setError(""); const mutation = editing && editing !== "new" ? update.mutateAsync({ id: editing.id, data: input }) : create.mutateAsync(input); void mutation.then(() => setEditing(null)).catch((e: Error) => setError(e.message)); };
  const deleteRow = (row: Transaction) => { if (window.confirm(`Hapus transaksi “${row.description}”? Tindakan ini tidak dapat dibatalkan.`)) remove.mutate(row.id); };
  return <main className="page-enter"><PageTitle eyebrow="Buku besar" title="Transaksi" subtitle="Catat dan telusuri setiap rupiah yang bergerak." actions={<button data-testid="button-new-transaction" onClick={() => { setError(""); setEditing("new"); }} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#c96735]"><Plus size={17} />Tambah transaksi</button>} />
    <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_2px_10px_rgba(79,52,27,.025)]"><div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:flex-wrap sm:items-center"><div className="relative min-w-[200px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-search-transactions" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari transaksi atau kategori…" className="form-input pl-9" /></div><MonthPicker month={month} onChange={setMonth} /><div className="flex gap-2"><select data-testid="filter-transaction-type" value={kindFilter} onChange={e => setKindFilter(e.target.value as TransactionFormKind | "ALL")} className="form-input w-auto min-w-[180px]"><option value="ALL">Semua jenis</option>{transactionKindOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><select data-testid="filter-transaction-category" value={categoryId} onChange={e => setCategoryId(e.target.value)} className="form-input w-auto min-w-[145px]"><option value="">Semua kategori</option>{(categories.data || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>
      {transactions.isLoading ? <LoadingRows /> : transactions.isError ? <QueryError retry={() => void transactions.refetch()} /> : <><TransactionRows rows={transactions.data || []} onEdit={r => { setError(""); setEditing(r); }} onDelete={deleteRow} />{transactions.data?.length ? <div className="flex justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground"><span>{transactions.data.length} transaksi</span><span>Arus kas bersih: <b className="font-mono text-foreground">{rupiah(transactions.data.reduce((sum, row) => sum + (row.type === "INCOME" ? row.amount : -row.amount), 0))}</b></span></div> : null}</>}
    </section>
    {(editing !== null) && <DialogFrame title={editing === "new" ? "Transaksi baru" : "Edit transaksi"} subtitle="Lengkapi detail pencatatan keuangan." onClose={() => setEditing(null)}><TransactionForm categories={categories.data || []} initial={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onSubmit={save} busy={create.isPending || update.isPending} error={error} /></DialogFrame>}
    {(remove.isError) && <div role="alert" className="mt-4 flex justify-between rounded-xl border border-[#f0c3b7] bg-[#fff5f1] px-4 py-3 text-sm text-destructive">{(remove.error as Error).message}<button onClick={() => remove.reset()}><X size={16} /></button></div>}
  </main>;
}

export function ReportsPage() {
  const [month, setMonth] = useState(currentMonth);
  const report = useProfitLossReport(month);
  const r = report.data;
  const exportCsv = () => { if (!r) return; const csv = [["Mution Finance · Laporan Laba Rugi", monthLabel(month)], ["Pos", "Jumlah (IDR)"], ["Pendapatan usaha", r.revenue], ["Biaya langsung", r.directCosts], ["Laba kotor", r.grossProfit], ["Biaya operasional", r.operatingExpenses], ["Laba operasional", r.operatingProfit], ["Bunga pinjaman", r.financeCosts], ["Laba bersih", r.netProfit]].map(row => row.join(",")).join("\n"); const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `mution-laba-rugi-${month}.csv`; a.click(); URL.revokeObjectURL(url); };
  const lines = r ? [{ label: "Pendapatan usaha", value: r.revenue, kind: "main" }, { label: "Biaya langsung", value: -r.directCosts, kind: "sub" }, { label: "Laba kotor", value: r.grossProfit, kind: "total" }, { label: "Biaya operasional", value: -r.operatingExpenses, kind: "sub" }, { label: "Laba operasional", value: r.operatingProfit, kind: "total" }, { label: "Bunga pinjaman", value: -r.financeCosts, kind: "sub" }, { label: "Laba bersih", value: r.netProfit, kind: "final" }] : [];
  return <main className="page-enter"><PageTitle eyebrow="Analisis" title="Laporan laba rugi" subtitle="Ringkasan performa finansial Mution berdasarkan periode." actions={<div className="flex gap-2"><MonthPicker month={month} onChange={setMonth} /><button data-testid="button-export-csv" onClick={exportCsv} disabled={!r} className="flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"><Download size={16} />Ekspor CSV</button></div>} />
     {report.isLoading ? <div className="h-[360px] animate-pulse rounded-2xl bg-white" /> : report.isError ? <div className="rounded-2xl border bg-white"><QueryError retry={() => void report.refetch()} /></div> : r && <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]"><section className="overflow-hidden rounded-2xl border border-border bg-white"><div className="border-b border-border bg-[#fcfaf7] px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary">Profit & loss</p><h2 className="mt-1 font-serif text-2xl font-bold capitalize tracking-tight">{monthLabel(month)}</h2><p className="mt-1 text-sm text-muted-foreground">Metode pencatatan berbasis kas · Rupiah Indonesia</p></div><div className="px-6 py-3">{lines.map((line) => <div key={line.label} className={`flex items-center justify-between border-b border-border/80 py-5 last:border-0 ${line.kind === "total" ? "mt-1 border-t-2 border-t-[#eee1d4]" : ""}`}><span className={`${line.kind === "sub" ? "pl-4 text-muted-foreground" : "font-semibold"} ${line.kind === "final" ? "font-serif text-lg font-bold" : "text-sm"}`}>{line.label}</span><span className={`${line.kind === "sub" ? "text-muted-foreground" : "font-semibold"} font-mono ${line.kind === "final" ? `text-xl ${line.value >= 0 ? "text-[#39795b]" : "text-destructive"}` : "text-sm"}`}>{line.value < 0 ? `(${rupiah(Math.abs(line.value))})` : rupiah(line.value)}</span></div>)}</div><div className="mx-6 mb-6 rounded-xl bg-[#f8f4ee] px-4 py-3 text-xs leading-relaxed text-muted-foreground">Modal pemilik, penarikan pemilik, pokok pinjaman, dan pembelian aset tidak dihitung sebagai pendapatan atau biaya usaha. Bunga pinjaman mengurangi laba bersih.</div></section>
      <aside className="space-y-5"><div className={`rounded-2xl p-6 ${r.netProfit >= 0 ? "bg-[#eaf4ed]" : "bg-[#fff0eb]"}`}><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Laba bersih</p><p className={`mt-3 font-serif text-[32px] font-bold tracking-[-.04em] ${r.netProfit >= 0 ? "text-[#326c4f]" : "text-destructive"}`}>{rupiah(r.netProfit)}</p></div><span className="rounded-xl bg-white/70 p-3 text-primary"><BarChart3 size={20} /></span></div><p className="mt-3 text-sm text-muted-foreground">{r.netProfit >= 0 ? "Perusahaan mencatatkan surplus untuk periode ini." : "Pengeluaran melebihi pemasukan pada periode ini."}</p></div><div className="rounded-2xl border border-border bg-white p-5"><h3 className="font-serif text-lg font-bold">Struktur pendapatan</h3><p className="mt-1 text-xs text-muted-foreground">Kontribusi tiap lapisan hasil</p><div className="mt-6 space-y-5">{[{name:"Laba kotor", amount:r.grossProfit, base:r.revenue, color:"#e3946a"},{name:"Laba bersih", amount:r.netProfit, base:r.revenue, color:"#78a687"}].map(item => <div key={item.name}><div className="mb-2 flex justify-between text-sm"><span>{item.name}</span><span className="font-mono text-xs">{item.base ? `${Math.round(item.amount / item.base * 100)}%` : "—"}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${item.base ? Math.max(0, Math.min(100, item.amount / item.base * 100)) : 0}%`, background: item.color }} /></div><p className="mt-1.5 text-right font-mono text-[11px] text-muted-foreground">{rupiah(item.amount)}</p></div>)}</div></div><div className="flex gap-3 rounded-2xl border border-[#eed9c5] bg-[#fff9f3] p-4"><CircleHelp className="mt-0.5 shrink-0 text-primary" size={17} /><p className="text-xs leading-relaxed text-muted-foreground"><b className="text-foreground">Perlu bantuan membaca laporan?</b><br />Biaya langsung berkaitan dengan layanan, sedangkan biaya operasional mendukung kegiatan tim.</p></div></aside>
    </div>}
  </main>;
}

type CategoryValues = { name: string; type: TransactionType; color: string; cost_class: "DIRECT" | "OPERATING" };
function CategoryEditor({ initial, onCancel, onSave, busy, error }: { initial?: Category; onCancel: () => void; onSave: (x: CategoryInput) => void; busy: boolean; error?: string }) {
  const form = useForm<CategoryValues>({ defaultValues: { name: initial?.name || "", type: initial?.type || "EXPENSE", color: initial?.color || "#E78359", cost_class: initial?.cost_class || "OPERATING" } });
  return <Form {...form}><form onSubmit={form.handleSubmit(v => onSave({ ...v, cost_class: v.type === "INCOME" ? null : v.cost_class }))} className="space-y-4">
    <FormField control={form.control} name="name" rules={{ required: "Nama kategori wajib diisi" }} render={({ field }) => <FormItem><FormLabel>Nama kategori</FormLabel><FormControl><input data-testid="input-category-name" {...field} placeholder="Mis. Infrastruktur" className="form-input" /></FormControl><FormMessage /></FormItem>} />
    <div className="grid grid-cols-2 gap-3"><FormField control={form.control} name="type" render={({ field }) => <FormItem><FormLabel>Jenis</FormLabel><FormControl><select data-testid="select-category-type" {...field} className="form-input"><option value="EXPENSE">Pengeluaran</option><option value="INCOME">Pemasukan</option></select></FormControl></FormItem>} /><FormField control={form.control} name="color" render={({ field }) => <FormItem><FormLabel>Warna</FormLabel><FormControl><div className="flex h-10 items-center gap-2 rounded-xl border border-input px-2"><input aria-label="Pilih warna kategori" type="color" {...field} className="h-7 w-8 cursor-pointer border-0 bg-transparent p-0" /><span className="font-mono text-xs text-muted-foreground">{field.value}</span></div></FormControl></FormItem>} /></div>
    <FormField control={form.control} name="cost_class" render={({ field }) => <FormItem><FormLabel>Klasifikasi biaya</FormLabel><FormControl><select {...field} disabled={form.watch("type") === "INCOME"} className="form-input"><option value="DIRECT">Biaya langsung</option><option value="OPERATING">Biaya operasional</option></select></FormControl><FormMessage /></FormItem>} />
    {error && <p className="rounded-lg bg-[#fff2ef] px-3 py-2 text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted">Batal</button><button disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Menyimpan…" : "Simpan kategori"}</button></div>
  </form></Form>;
}

export function SettingsPage() {
  const { isAdmin, demoMode, updatePassword } = useAuth();
  const [month, setMonth] = useState(currentMonth); const [editor, setEditor] = useState<Category | "new" | null>(null); const [formError, setFormError] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const categories = useCategories(); const budgets = useBudgets(month); const transactions = useTransactions({ month });
  const financeSettings = useFinanceSettings(); const updateFinanceSettings = useUpdateFinanceSettings();
  const create = useCreateCategory(); const update = useUpdateCategory(); const remove = useDeleteCategory(); const saveBudget = useSaveBudget();
  const accessList = useAccessList(isAdmin); const addAccess = useAddFinanceAccess(); const removeAccess = useRemoveFinanceAccess();
  const accessForm = useForm<{ email: string; role: AccessRole }>({ defaultValues: { email: "", role: "MEMBER" } });
  const passwordForm = useForm<{ password: string; confirmation: string }>({ defaultValues: { password: "", confirmation: "" } });
  const [accessError, setAccessError] = useState(""); const [passwordMessage, setPasswordMessage] = useState(""); const [passwordError, setPasswordError] = useState("");
  useEffect(() => {
    if (!financeSettings.data) return;
    setOpeningBalance(String(financeSettings.data.opening_balance));
    setOpeningDate(financeSettings.data.opening_date);
  }, [financeSettings.data]);
  const saveCategory = (v: CategoryInput) => { setFormError(""); const call = editor && editor !== "new" ? update.mutateAsync({ id: editor.id, data: v }) : create.mutateAsync(v); void call.then(() => setEditor(null)).catch((e: Error) => setFormError(e.message)); };
  const saveOpeningBalance = () => {
    const amount = Number(openingBalance || 0);
    if (!openingDate || !Number.isFinite(amount) || amount < 0) return;
    updateFinanceSettings.mutate({ opening_balance: amount, opening_date: openingDate });
  };
  const grantAccess = async (values: { email: string; role: AccessRole }) => {
    setAccessError("");
    try {
      await addAccess.mutateAsync(values);
      accessForm.reset({ email: "", role: "MEMBER" });
    } catch (error) {
      setAccessError((error as Error).message);
    }
  };
  const revokeAccess = (email: string) => {
    if (window.confirm(`Hapus akses finance untuk ${email}?`)) {
      setAccessError("");
      removeAccess.mutate(email, { onError: (error) => setAccessError(error.message) });
    }
  };
  const savePassword = async (values: { password: string; confirmation: string }) => {
    setPasswordError(""); setPasswordMessage("");
    try {
      await updatePassword(values.password);
      passwordForm.reset();
      setPasswordMessage("Kata sandi berhasil diperbarui.");
    } catch (error) {
      setPasswordError((error as Error).message);
    }
  };
  const expenseCats = (categories.data || []).filter(c => c.type === "EXPENSE");
  const spent = useMemo(() => { const map = new Map<string, number>(); (transactions.data || []).filter(t => t.purpose === "OPERATING" && t.type === "EXPENSE" && t.category_id).forEach(t => map.set(t.category_id!, (map.get(t.category_id!) || 0) + t.amount)); return map; }, [transactions.data]);
  const budgetMap = new Map((budgets.data || []).map(b => [b.category_id, b]));
  const budgetChange = (categoryId: string, value: string) => { const amount = Number(value); if (amount > 0) saveBudget.mutate({ month_year: `${month}-01`, category_id: categoryId, limit_amount: amount }); };
  return <main className="page-enter"><PageTitle eyebrow="Preferensi" title="Pengaturan" subtitle="Atur kategori dan batas pengeluaran bulanan." actions={<MonthPicker month={month} onChange={setMonth} />} />
    {!isAdmin && <div className="mb-5 rounded-xl border border-[#eed9c5] bg-[#fff9f3] px-4 py-3 text-sm text-muted-foreground">Mode hanya lihat. Owner perlu memberi akun ini peran ADMIN di daftar akses Supabase untuk mengubah saldo awal, kategori, dan anggaran.</div>}
    <section className="mb-5 overflow-hidden rounded-2xl border border-border bg-white">
      <div className="border-b border-border px-5 py-4"><h2 className="font-serif text-lg font-bold">Saldo awal kas</h2><p className="mt-1 text-xs text-muted-foreground">Saldo gabungan kas dan rekening pada awal hari tanggal mulai pencatatan. Transaksi sebelum tanggal itu tidak masuk perhitungan saldo.</p></div>
      {financeSettings.isLoading ? <LoadingRows /> : financeSettings.isError ? <QueryError retry={() => void financeSettings.refetch()} /> : <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-[220px]"><FormLabel htmlFor="opening-balance">Jumlah saldo awal (Rp)</FormLabel>{isAdmin ? <RupiahInput id="opening-balance" value={openingBalance} onValueChange={setOpeningBalance} placeholder="0" className="form-input mt-1.5" /> : <p className="mt-2 text-sm font-semibold">{rupiah(financeSettings.data?.opening_balance ?? 0)}</p>}</div>
        <div className="w-full sm:max-w-[220px]"><FormLabel htmlFor="opening-date">Tanggal mulai</FormLabel>{isAdmin ? <input id="opening-date" data-testid="input-opening-date" type="date" value={openingDate} onChange={event => setOpeningDate(event.target.value)} className="form-input mt-1.5" /> : <p className="mt-2 text-sm font-semibold">{dateLabel(`${financeSettings.data?.opening_date ?? openingDate}T12:00:00+07:00`)}</p>}</div>
        {isAdmin && <button data-testid="button-save-opening-balance" onClick={saveOpeningBalance} disabled={updateFinanceSettings.isPending || !openingDate} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">{updateFinanceSettings.isPending ? "Menyimpan…" : "Simpan saldo awal"}</button>}
        {updateFinanceSettings.isError && <p role="alert" className="text-sm text-destructive">{(updateFinanceSettings.error as Error).message}</p>}
        {updateFinanceSettings.isSuccess && <p role="status" className="text-sm text-[#39795b]">Saldo awal berhasil disimpan.</p>}
      </div>}
    </section>
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <section className="overflow-hidden rounded-2xl border border-border bg-white"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-serif text-lg font-bold">Kategori</h2><p className="mt-1 text-xs text-muted-foreground">Kelompokkan pemasukan dan pengeluaran.</p></div>{isAdmin && <button data-testid="button-new-category" onClick={() => { setFormError(""); setEditor("new"); }} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white"><Plus size={15} />Kategori</button>}</div>
         {categories.isLoading ? <LoadingRows /> : categories.isError ? <QueryError retry={() => void categories.refetch()} /> : !categories.data?.length ? <EmptyState title="Belum ada kategori" text="Tambahkan kategori untuk mengelompokkan transaksi." /> : <div className="divide-y divide-border/70">{categories.data.map(c => <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className="h-9 w-9 shrink-0 rounded-xl" style={{ background: `${c.color}25`, border: `1px solid ${c.color}45` }}><i className="m-auto block h-2.5 w-2.5 translate-y-[13px] rounded-full" style={{ background: c.color }} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{c.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{c.type === "INCOME" ? "Pemasukan" : c.cost_class === "DIRECT" ? "Biaya langsung" : "Biaya operasional"}</p></div></div>{isAdmin && <div className="flex shrink-0 items-center gap-1"><button aria-label={`Edit ${c.name}`} onClick={() => { setFormError(""); setEditor(c); }} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><Pencil size={15} /></button><button aria-label={`Hapus ${c.name}`} onClick={() => { if (window.confirm(`Hapus kategori “${c.name}”?`)) remove.mutate(c.id); }} className="rounded-lg p-2 text-muted-foreground hover:bg-[#fff0ed] hover:text-destructive"><Trash2 size={15} /></button></div>}</div>)}</div>}
        {remove.isError && <p className="mx-5 mb-4 rounded-lg bg-[#fff2ef] p-3 text-xs text-destructive">{(remove.error as Error).message}</p>}
      </section>
      <section className="overflow-hidden rounded-2xl border border-border bg-white"><div className="border-b border-border px-5 py-4"><h2 className="font-serif text-lg font-bold">Anggaran bulanan</h2><p className="mt-1 text-xs text-muted-foreground">Tetapkan batas untuk pengeluaran per kategori.</p></div>
        {budgets.isLoading || categories.isLoading ? <LoadingRows /> : budgets.isError ? <QueryError retry={() => void budgets.refetch()} /> : expenseCats.length ? <div className="divide-y divide-border/70">{expenseCats.map(c => { const b = budgetMap.get(c.id); const used = spent.get(c.id) || 0; const limit = b?.limit_amount || 0; const pct = limit ? Math.min(100, used / limit * 100) : 0; return <div key={c.id} className="px-5 py-4"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} /><span className="text-sm font-semibold">{c.name}</span></div><span className="text-[11px] text-muted-foreground">{rupiah(used)}{limit ? ` / ${rupiah(limit)}` : " terpakai"}</span></div><div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${pct >= 90 ? "bg-[#d37458]" : "bg-[#83aa8f]"}`} style={{ width: `${pct}%` }} /></div><BudgetInput key={`${c.id}-${month}-${b?.limit_amount || 0}`} categoryId={c.id} month={month} value={b?.limit_amount || 0} onCommit={budgetChange} disabled={!isAdmin} /></div></div>; })}</div> : <EmptyState title="Tambahkan kategori biaya" text="Kategori pengeluaran diperlukan sebelum anggaran dapat disusun." />}
        {saveBudget.isError && <p className="mx-5 mb-4 rounded-lg bg-[#fff2ef] p-3 text-xs text-destructive">{(saveBudget.error as Error).message}</p>}{saveBudget.isSuccess && <p className="mx-5 mb-4 text-xs text-[#39795b]">Anggaran berhasil disimpan.</p>}
      </section>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      {isAdmin && <section className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="border-b border-border px-5 py-4"><h2 className="font-serif text-lg font-bold">Akses tim</h2><p className="mt-1 text-xs text-muted-foreground">Kelola founder dan anggota yang diizinkan mengakses data finance.</p></div>
        <div className="space-y-4 p-5">
          <Form {...accessForm}><form onSubmit={accessForm.handleSubmit(grantAccess)} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:items-end">
            <FormField control={accessForm.control} name="email" rules={{ required: "Email wajib diisi", pattern: { value: /^\S+@\S+\.\S+$/, message: "Masukkan email yang valid" } }} render={({ field }) => <FormItem><FormLabel>Email anggota</FormLabel><FormControl><input data-testid="input-access-email" type="email" autoComplete="off" placeholder="nama@perusahaan.com" {...field} className="form-input h-10" /></FormControl><FormMessage /></FormItem>} />
            <FormField control={accessForm.control} name="role" render={({ field }) => <FormItem><FormLabel>Peran</FormLabel><FormControl><select data-testid="select-access-role" {...field} className="form-input h-10"><option value="MEMBER">Anggota</option><option value="ADMIN">Admin</option></select></FormControl></FormItem>} />
            <button data-testid="button-grant-access" disabled={addAccess.isPending} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">{addAccess.isPending ? "Menyimpan…" : "Simpan akses"}</button>
          </form></Form>
          <p className="text-xs leading-relaxed text-muted-foreground">Email `@mution.tech` dapat masuk sebagai anggota. Email lain harus ditambahkan di sini. Setelah memberi akses, undang atau buat akun email tersebut di Supabase Auth.</p>
          {accessError && <p role="alert" className="rounded-lg bg-[#fff2ef] px-3 py-2 text-sm text-destructive">{accessError}</p>}
          {accessList.isLoading ? <LoadingRows /> : accessList.isError ? <QueryError retry={() => void accessList.refetch()} /> : accessList.data?.length ? <div className="divide-y divide-border/70 rounded-xl border border-border">{accessList.data.map((entry) => <div key={entry.email} className="flex items-center justify-between gap-3 px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{entry.email}</p><p className="mt-0.5 text-[10px] text-muted-foreground">Ditambahkan {dateLabel(entry.created_at)}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${entry.role === "ADMIN" ? "bg-[#fff1e6] text-[#a75c32]" : "bg-muted text-muted-foreground"}`}>{entry.role === "ADMIN" ? "Admin" : "Anggota"}</span><button data-testid={`button-revoke-${entry.email}`} onClick={() => revokeAccess(entry.email)} aria-label={`Hapus akses ${entry.email}`} className="rounded-lg p-2 text-muted-foreground hover:bg-[#fff0ed] hover:text-destructive"><Trash2 size={14} /></button></div></div>)}</div> : <EmptyState title="Belum ada akses tambahan" text="Akun anggota @mution.tech tetap dapat masuk sebagai anggota." />}
        </div>
      </section>}
      {!demoMode && <section className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="border-b border-border px-5 py-4"><h2 className="font-serif text-lg font-bold">Keamanan akun</h2><p className="mt-1 text-xs text-muted-foreground">Perbarui kata sandi Supabase Auth untuk akun yang sedang digunakan.</p></div>
        <div className="p-5"><Form {...passwordForm}><form onSubmit={passwordForm.handleSubmit(savePassword)} className="space-y-4">
          <FormField control={passwordForm.control} name="password" rules={{ required: "Kata sandi wajib diisi", minLength: { value: 8, message: "Gunakan minimal 8 karakter" } }} render={({ field }) => <FormItem><FormLabel>Kata sandi baru</FormLabel><FormControl><input data-testid="input-new-password" type="password" autoComplete="new-password" {...field} className="form-input h-10" /></FormControl><FormMessage /></FormItem>} />
          <FormField control={passwordForm.control} name="confirmation" rules={{ required: "Ulangi kata sandi", validate: (value) => value === passwordForm.getValues("password") || "Kata sandi belum sama" }} render={({ field }) => <FormItem><FormLabel>Konfirmasi kata sandi</FormLabel><FormControl><input data-testid="input-confirm-password" type="password" autoComplete="new-password" {...field} className="form-input h-10" /></FormControl><FormMessage /></FormItem>} />
          {passwordError && <p role="alert" className="rounded-lg bg-[#fff2ef] px-3 py-2 text-sm text-destructive">{passwordError}</p>}{passwordMessage && <p role="status" className="rounded-lg bg-[#edf6f0] px-3 py-2 text-sm text-[#39795b]">{passwordMessage}</p>}
          <button data-testid="button-update-password" className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-muted">Perbarui kata sandi</button>
        </form></Form></div>
      </section>}
    </div>
    <div className="mt-5 rounded-2xl border border-border bg-[#f8f4ee] p-5"><div className="flex gap-3"><Settings2 size={18} className="mt-0.5 text-primary" /><div><h3 className="text-sm font-semibold">Ruang kerja finance yang terpisah</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Data keuangan ini dikelola terpisah dari sistem produk inti Mution. Hanya gunakan kategori yang membantu tim membaca arus uang dengan konsisten.</p></div></div></div>
     {isAdmin && editor !== null && <DialogFrame title={editor === "new" ? "Kategori baru" : "Edit kategori"} subtitle="Atur nama, jenis, dan klasifikasi biaya." onClose={() => setEditor(null)}><CategoryEditor initial={editor === "new" ? undefined : editor} onCancel={() => setEditor(null)} onSave={saveCategory} busy={create.isPending || update.isPending} error={formError} /></DialogFrame>}
  </main>;
}

export function LoginPage() {
  const { signIn, sendPasswordReset, demoMode } = useAuth(); const [, setLocation] = useLocation(); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const form = useForm<{ email: string; password: string }>({ defaultValues: { email: "", password: "" } });
  const submit = async (values: { email: string; password: string }) => { setLoading(true); setError(""); setNotice(""); try { await signIn(values.email, values.password); setLocation("/"); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } };
  return <div className="min-h-[100dvh] bg-[#fbf8f3]"><div className="grid min-h-[100dvh] lg:grid-cols-[1.05fr_.95fr]"><section className="relative hidden overflow-hidden bg-[#f1e8dc] p-12 lg:flex lg:flex-col lg:justify-between"><div className="absolute -right-24 top-20 h-[450px] w-[450px] rounded-full border border-[#dfc9b4]/60" /><div className="absolute -right-2 top-44 h-[310px] w-[310px] rounded-full border border-[#dfc9b4]/70" /><div className="absolute bottom-[-170px] left-[-120px] h-[440px] w-[440px] rounded-full bg-[#e5d6c5]/55" /><Link href="/" className="relative z-10 flex items-center gap-3 text-foreground"><span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-primary font-serif text-lg font-bold text-white">m</span><span><b className="block font-serif text-[17px] leading-5">mution</b><span className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">finance workspace</span></span></Link><div className="relative z-10 max-w-lg pb-8"><p className="mb-4 text-[11px] font-bold uppercase tracking-[.18em] text-[#b56b45]">A clearer view of what moves</p><h1 className="font-serif text-5xl font-bold leading-[1.08] tracking-[-.055em]">Every rupiah,<br />in its right place.</h1><p className="mt-5 max-w-sm text-[15px] leading-7 text-[#725f4e]">A thoughtful finance space for the people building Mution. Focused, private, and easy to trust.</p><div className="mt-9 flex items-center gap-3 text-xs text-[#735f4d]"><span className="flex -space-x-2"><i className="h-7 w-7 rounded-full border-2 border-[#f1e8dc] bg-[#d99b76]" /><i className="h-7 w-7 rounded-full border-2 border-[#f1e8dc] bg-[#91aa93]" /><i className="h-7 w-7 rounded-full border-2 border-[#f1e8dc] bg-[#c5a285]" /></span>Built for a small team with a clear view.</div></div><p className="relative z-10 text-[11px] text-[#917c69]">Mution Technologies · Internal workspace</p></section>
    <section className="flex items-center justify-center px-6 py-12"><div className="w-full max-w-[390px] page-enter"><Link href="/" className="mb-12 flex items-center gap-3 lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-primary font-serif text-lg font-bold text-white">m</span><span className="font-serif text-lg font-bold">mution <span className="font-sans text-xs font-medium text-muted-foreground">finance</span></span></Link><p className="text-[11px] font-bold uppercase tracking-[.16em] text-primary">Selamat datang</p><h2 className="mt-2 font-serif text-[32px] font-bold tracking-[-.05em]">Masuk ke workspace</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Gunakan akun Mution.tech untuk mengakses ruang kerja finance.</p>
      {demoMode && <div className="mt-5 rounded-xl border border-[#d9e8dc] bg-[#f1f7f2] px-4 py-3 text-xs leading-relaxed text-[#486b53]"><b>Mode demo aktif</b><br />Supabase belum dikonfigurasi. Data contoh tersimpan lokal di perangkat ini.</div>}
      <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="mt-7 space-y-4"><FormField control={form.control} name="email" rules={{ required: "Email wajib diisi", pattern: { value: /^\S+@\S+\.\S+$/, message: "Masukkan email yang valid" } }} render={({ field }) => <FormItem><FormLabel>Email kerja</FormLabel><FormControl><input data-testid="input-login-email" type="email" autoComplete="email" placeholder="nama@mution.tech" {...field} className="form-input h-11" /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="password" rules={{ required: "Kata sandi wajib diisi" }} render={({ field }) => <FormItem><div className="flex justify-between"><FormLabel>Kata sandi</FormLabel><button type="button" onClick={async () => { const email = form.getValues("email"); if (!email) { setError("Masukkan email terlebih dahulu."); return; } try { await sendPasswordReset(email); setNotice("Tautan pemulihan telah dikirim ke email Anda."); setError(""); } catch (e) { setError((e as Error).message); } }} className="text-xs font-semibold text-primary hover:underline">Lupa kata sandi?</button></div><FormControl><input data-testid="input-login-password" type="password" autoComplete="current-password" placeholder="Masukkan kata sandi" {...field} className="form-input h-11" /></FormControl><FormMessage /></FormItem>} />{error && <div role="alert" className="rounded-xl border border-[#f1c8bc] bg-[#fff3ee] px-3 py-2.5 text-sm text-destructive">{error}</div>}{notice && <div className="rounded-xl border border-[#d9e8dc] bg-[#f1f7f2] px-3 py-2.5 text-sm text-[#39795b]">{notice}</div>}<button data-testid="button-login-submit" disabled={loading} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white shadow-sm hover:bg-[#c96735] disabled:opacity-60">{loading ? "Memverifikasi…" : "Masuk"}<ArrowRight size={16} /></button></form></Form>
      <p className="mt-7 text-center text-xs leading-5 text-muted-foreground">Akses terbatas untuk anggota yang diotorisasi.<br />Butuh akses? Hubungi owner workspace.</p><div className="mt-10 flex items-center justify-center gap-2 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-[#77a888]" />Data finance terisolasi dari sistem produk inti</div>
    </div></section></div></div>;
}
