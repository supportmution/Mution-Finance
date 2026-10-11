import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Budget,
  BudgetInput,
  AccessRole,
  CashFlowPoint,
  Category,
  CategoryInput,
  ExpenseSlice,
  FinanceAccess,
  FinanceDashboard,
  FinanceSettings,
  ProfitLossReport,
  Transaction,
  TransactionFilters,
  TransactionInput,
  TransactionPurpose,
  TransactionType,
} from "@/lib/finance-types";

const STORAGE_KEY = "mution-finance-demo-v1";
const financeKeys = {
  all: ["finance"] as const,
  dashboard: (month: string) => ["finance", "dashboard", month] as const,
  transactions: (filters: TransactionFilters) =>
    ["finance", "transactions", filters] as const,
  categories: (type?: TransactionType) =>
    ["finance", "categories", type ?? "ALL"] as const,
  budgets: (month: string) => ["finance", "budgets", month] as const,
  report: (month: string) => ["finance", "report", month] as const,
};

type DemoData = {
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  accessList: FinanceAccess[];
  settings: FinanceSettings;
};

function isoDay(day: number, offset = 0) {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth() + offset,
    day,
    10,
  ).toISOString();
}

const demoCategories: Category[] = [
  { id: "cat-revenue", name: "Pendapatan", type: "INCOME", color: "#45A987", cost_class: null },
  { id: "cat-server", name: "Server & Cloud", type: "EXPENSE", color: "#F39B62", cost_class: "DIRECT" },
  { id: "cat-ai", name: "AI & API", type: "EXPENSE", color: "#E9B95C", cost_class: "DIRECT" },
  { id: "cat-payroll", name: "Gaji & Tim", type: "EXPENSE", color: "#8E91D1", cost_class: "OPERATING" },
  { id: "cat-marketing", name: "Marketing", type: "EXPENSE", color: "#E78383", cost_class: "OPERATING" },
  { id: "cat-tools", name: "Langganan Tools", type: "EXPENSE", color: "#6DA6CE", cost_class: "OPERATING" },
];

function initialDemoData(): DemoData {
  const descriptions = [
    ["Pembayaran langganan Mution Pro", "INCOME", "cat-revenue", 12500000, 2, "Midtrans"],
    ["AWS — tagihan cloud", "EXPENSE", "cat-server", 2850000, 3, "Kartu kredit"],
    ["OpenAI API usage", "EXPENSE", "cat-ai", 1725000, 4, "Kartu kredit"],
    ["Gaji tim engineering", "EXPENSE", "cat-payroll", 8000000, 5, "BCA"],
    ["Pembayaran langganan Mution Pro", "INCOME", "cat-revenue", 8750000, 6, "Midtrans"],
    ["Kampanye iklan digital", "EXPENSE", "cat-marketing", 1250000, 7, "BCA"],
    ["GitHub & Linear", "EXPENSE", "cat-tools", 685000, 8, "Kartu kredit"],
  ] as const;

  const transactions = descriptions.map(
    ([description, type, categoryId, amount, day, paymentMethod], index) => ({
      id: `demo-${index + 1}`,
      date: isoDay(day),
      type,
      purpose: "OPERATING" as const,
      category_id: categoryId,
      amount,
      description,
      payment_method: paymentMethod,
      receipt_url: null,
      category:
        demoCategories.find((category) => category.id === categoryId) ?? null,
    }),
  ) as Transaction[];

  return {
    categories: demoCategories,
    transactions,
    budgets: [],
    settings: {
      opening_balance: 0,
      opening_date: `${currentMonth()}-01`,
    },
    accessList: [
      {
        email: "founder@mution.tech",
        role: "ADMIN",
        created_at: new Date().toISOString(),
      },
    ],
  };
}

function readDemoData(): DemoData {
  if (typeof localStorage === "undefined") return initialDemoData();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialDemoData();
    const parsed = JSON.parse(saved) as Partial<DemoData>;
    const initial = initialDemoData();
    return {
      categories: parsed.categories ?? initial.categories,
      transactions: (parsed.transactions ?? initial.transactions).map((row) => ({
        ...row,
        purpose: row.purpose ?? "OPERATING",
      })),
      budgets: parsed.budgets ?? initial.budgets,
      accessList: parsed.accessList ?? initial.accessList,
      settings: parsed.settings ?? initial.settings,
    };
  } catch {
    return initialDemoData();
  }
}

function writeDemoData(data: DemoData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function normalizeTransaction(row: Record<string, unknown>): Transaction {
  const category = row.category as Record<string, unknown> | null;
  return {
    id: String(row.id),
    date: String(row.date),
    type: row.type as TransactionType,
    purpose: (row.purpose as TransactionPurpose) || "OPERATING",
    category_id: row.category_id ? String(row.category_id) : null,
    amount: Number(row.amount),
    description: String(row.description ?? ""),
    payment_method: row.payment_method ? String(row.payment_method) : null,
    receipt_url: row.receipt_url ? String(row.receipt_url) : null,
    category: category
      ? {
          id: String(category.id),
          name: String(category.name),
          color: String(category.color),
          cost_class: (category.cost_class as Category["cost_class"]) ?? null,
        }
      : null,
  };
}

function addMonths(month: string, amount: number) {
  const date = new Date(`${month}-01T00:00:00+07:00`);
  date.setMonth(date.getMonth() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function monthKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function rowsForMonth(rows: Transaction[], month: string) {
  return rows.filter((row) => monthKey(row.date) === month);
}

async function getAllTransactions(): Promise<Transaction[]> {
  if (!supabase) return readDemoData().transactions;
  const { data, error } = await supabase
    .from("transactions")
    .select("*, category:categories(id,name,color,cost_class)")
    .order("date", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map((row) =>
    normalizeTransaction(row as Record<string, unknown>),
  );
}

async function getFinanceSettings(): Promise<FinanceSettings> {
  if (!supabase) return readDemoData().settings;
  const { data, error } = await supabase
    .from("finance_settings")
    .select("opening_balance,opening_date")
    .eq("id", true)
    .single();
  if (error) throw error;
  return {
    opening_balance: Number(data.opening_balance),
    opening_date: String(data.opening_date),
  };
}

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: financeKeys.transactions(filters),
    queryFn: async () => {
      let rows = await getAllTransactions();
      if (filters.month) rows = rowsForMonth(rows, filters.month);
      if (filters.type && filters.type !== "ALL") {
        rows = rows.filter((row) => row.type === filters.type);
      }
      if (filters.purpose && filters.purpose !== "ALL") {
        rows = rows.filter((row) => row.purpose === filters.purpose);
      }
      if (filters.categoryId) {
        rows = rows.filter((row) => row.category_id === filters.categoryId);
      }
      if (filters.search?.trim()) {
        const needle = filters.search.trim().toLocaleLowerCase("id-ID");
        rows = rows.filter(
          (row) =>
            row.description.toLocaleLowerCase("id-ID").includes(needle) ||
            row.category?.name.toLocaleLowerCase("id-ID").includes(needle),
        );
      }
      return rows.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    },
    staleTime: 20_000,
  });
}

export function useCategories(type?: TransactionType) {
  return useQuery({
    queryKey: financeKeys.categories(type),
    queryFn: async (): Promise<Category[]> => {
      if (!supabase) {
        const categories = readDemoData().categories;
        return type
          ? categories.filter((category) => category.type === type)
          : categories;
      }
      let query = supabase.from("categories").select("*").order("name");
      if (type) query = query.eq("type", type);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Category[];
    },
    staleTime: 60_000,
  });
}

export function useFinanceDashboard(month = currentMonth()) {
  return useQuery({
    queryKey: financeKeys.dashboard(month),
    queryFn: async (): Promise<FinanceDashboard> => {
      const [allTransactions, categories, settings] = await Promise.all([
        getAllTransactions(),
        supabase
          ? supabase.from("categories").select("*")
          : Promise.resolve({ data: readDemoData().categories, error: null }),
        getFinanceSettings(),
      ]);
      if (categories.error) throw categories.error;
      const categoryRows = (categories.data ?? []) as Category[];
      const monthTransactions = rowsForMonth(allTransactions, month);
      const sum = (rows: Transaction[], type: TransactionType) =>
        rows
          .filter(
            (transaction) =>
              transaction.purpose === "OPERATING" &&
              transaction.type === type,
          )
          .reduce((total, transaction) => total + transaction.amount, 0);
      const expense = sum(monthTransactions, "EXPENSE");
      const income = sum(monthTransactions, "INCOME");

      const cashFlow: CashFlowPoint[] = Array.from({ length: 6 }, (_, index) => {
        const flowMonth = addMonths(month, index - 5);
        const rows = rowsForMonth(allTransactions, flowMonth);
        return {
          month: flowMonth,
          cashIn: rows
            .filter((transaction) => transaction.type === "INCOME")
            .reduce((total, transaction) => total + transaction.amount, 0),
          cashOut: rows
            .filter((transaction) => transaction.type === "EXPENSE")
            .reduce((total, transaction) => total + transaction.amount, 0),
        };
      });

      const breakdownAmounts = new Map<string, number>();
      monthTransactions
        .filter(
          (transaction) =>
            transaction.purpose === "OPERATING" &&
            transaction.type === "EXPENSE" &&
            transaction.category_id,
        )
        .forEach((transaction) => {
          if (!transaction.category_id) return;
          breakdownAmounts.set(
            transaction.category_id,
            (breakdownAmounts.get(transaction.category_id) ?? 0) +
              transaction.amount,
          );
        });
      const expenseBreakdown: ExpenseSlice[] = [...breakdownAmounts.entries()]
        .map(([categoryId, amount]) => {
          const category = categoryRows.find((item) => item.id === categoryId);
          return {
            categoryId,
            categoryName: category?.name ?? "Tanpa kategori",
            color: category?.color ?? "#D5D5D5",
            amount,
            percentage: expense ? (amount / expense) * 100 : 0,
          };
        })
        .sort((a, b) => b.amount - a.amount);

      const inMonth = (transaction: Transaction) =>
        monthKey(transaction.date) <= month &&
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(transaction.date)) >= settings.opening_date;
      const balanceRows = allTransactions.filter(inMonth);
      const cashBalance =
        month >= settings.opening_date.slice(0, 7)
          ? settings.opening_balance +
            balanceRows.reduce(
              (total, transaction) =>
                total +
                (transaction.type === "INCOME"
                  ? transaction.amount
                  : -transaction.amount),
              0,
            )
          : 0;
      const balanceSum = (purposes: TransactionPurpose[]) =>
        balanceRows
          .filter((transaction) => purposes.includes(transaction.purpose))
          .reduce((total, transaction) => total + transaction.amount, 0);
      const monthSum = (purpose: TransactionPurpose) =>
        monthTransactions
          .filter((transaction) => transaction.purpose === purpose)
          .reduce((total, transaction) => total + transaction.amount, 0);
      const loanBalance =
        balanceSum(["LOAN_RECEIVED"]) -
        balanceSum(["LOAN_PRINCIPAL_REPAYMENT"]);
      const financeCosts = monthSum("LOAN_INTEREST");
      const accumulatedOperatingIncome = balanceRows
        .filter(
          (transaction) =>
            transaction.purpose === "OPERATING" &&
            transaction.type === "INCOME",
        )
        .reduce((total, transaction) => total + transaction.amount, 0);
      const accumulatedOperatingCosts = balanceRows
        .filter(
          (transaction) =>
            transaction.purpose === "OPERATING" &&
            transaction.type === "EXPENSE",
        )
        .reduce((total, transaction) => total + transaction.amount, 0);
      const accumulatedFinanceCosts = balanceSum(["LOAN_INTEREST"]);
      const retainedEarnings =
        accumulatedOperatingIncome -
        accumulatedOperatingCosts -
        accumulatedFinanceCosts -
        balanceSum(["OWNER_WITHDRAWAL"]);

      return {
        month,
        income,
        expense,
        netProfit: income - expense - financeCosts,
        cashBalance,
        ownerCapital: monthSum("OWNER_CAPITAL"),
        ownerWithdrawals: monthSum("OWNER_WITHDRAWAL"),
        loanBalance,
        assetPurchases: monthSum("ASSET_PURCHASE"),
        retainedEarnings,
        cashFlow,
        expenseBreakdown,
        recentTransactions: allTransactions.slice(0, 5),
      };
    },
    staleTime: 20_000,
  });
}

export function useProfitLossReport(month = currentMonth()) {
  return useQuery({
    queryKey: financeKeys.report(month),
    queryFn: async (): Promise<ProfitLossReport> => {
      const [transactions, categories] = await Promise.all([
        getAllTransactions(),
        supabase
          ? supabase.from("categories").select("*")
          : Promise.resolve({ data: readDemoData().categories, error: null }),
      ]);
      if (categories.error) throw categories.error;
      const categoryRows = (categories.data ?? []) as Category[];
      const rows = rowsForMonth(transactions, month);
      const revenue = rows
        .filter((row) => row.purpose === "OPERATING" && row.type === "INCOME")
        .reduce((sum, row) => sum + row.amount, 0);
      const expenseRows = rows.filter(
        (row) => row.purpose === "OPERATING" && row.type === "EXPENSE",
      );
      const directCosts = expenseRows
        .filter(
          (row) =>
            row.category_id &&
            categoryRows.find((category) => category.id === row.category_id)
              ?.cost_class === "DIRECT",
        )
        .reduce((sum, row) => sum + row.amount, 0);
      const operatingExpenses = expenseRows
        .filter((row) => {
          const costClass = categoryRows.find(
            (category) => category.id === row.category_id,
          )?.cost_class;
          return costClass !== "DIRECT";
        })
        .reduce((sum, row) => sum + row.amount, 0);
      const financeCosts = rows
        .filter((row) => row.purpose === "LOAN_INTEREST")
        .reduce((sum, row) => sum + row.amount, 0);
      const operatingProfit = revenue - directCosts - operatingExpenses;
      return {
        month,
        revenue,
        directCosts,
        grossProfit: revenue - directCosts,
        operatingExpenses,
        operatingProfit,
        financeCosts,
        netProfit: operatingProfit - financeCosts,
      };
    },
    staleTime: 20_000,
  });
}

export function useFinanceSettings() {
  return useQuery({
    queryKey: ["finance", "settings"],
    queryFn: getFinanceSettings,
    staleTime: 60_000,
  });
}

export function useUpdateFinanceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: FinanceSettings) => {
      if (!supabase) {
        const demo = readDemoData();
        demo.settings = input;
        writeDemoData(demo);
        return input;
      }
      const { data, error } = await supabase
        .from("finance_settings")
        .upsert({ id: true, ...input }, { onConflict: "id" })
        .select("opening_balance,opening_date")
        .single();
      if (error) throw error;
      return {
        opening_balance: Number(data.opening_balance),
        opening_date: String(data.opening_date),
      };
    },
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useBudgets(month = currentMonth()) {
  return useQuery({
    queryKey: financeKeys.budgets(month),
    queryFn: async (): Promise<Budget[]> => {
      if (!supabase) {
        const demo = readDemoData();
        return demo.budgets
          .filter((budget) => budget.month_year.slice(0, 7) === month)
          .map((budget) => ({
            ...budget,
            category:
              demo.categories.find(
                (category) => category.id === budget.category_id,
              ) ?? null,
          }));
      }
      const { data, error } = await supabase
        .from("budgets")
        .select("*, category:categories(id,name,color)")
        .eq("month_year", `${month}-01`)
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        limit_amount: Number(row.limit_amount),
      })) as Budget[];
    },
  });
}

export function useAccessList(enabled = true) {
  return useQuery({
    queryKey: ["finance", "access-list"],
    enabled,
    queryFn: async (): Promise<FinanceAccess[]> => {
      if (!supabase) return readDemoData().accessList;
      const { data, error } = await supabase.rpc("finance_list_allowed_emails");
      if (error) throw error;
      return (data ?? []) as FinanceAccess[];
    },
    staleTime: 30_000,
  });
}

function invalidateFinance(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: financeKeys.all });
}

export function useAddFinanceAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; role: AccessRole }) => {
      const email = input.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Masukkan email yang valid.");
      }
      if (!supabase) {
        const demo = readDemoData();
        const existing = demo.accessList.find((item) => item.email === email);
        if (existing) existing.role = input.role;
        else {
          demo.accessList.push({
            email,
            role: input.role,
            created_at: new Date().toISOString(),
          });
        }
        writeDemoData(demo);
        return email;
      }
      const { error } = await supabase.rpc("finance_add_allowed_email", {
        p_email: email,
        p_role: input.role,
      });
      if (error) throw error;
      return email;
    },
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useRemoveFinanceAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      if (!supabase) {
        const demo = readDemoData();
        demo.accessList = demo.accessList.filter(
          (item) => item.email !== email.toLowerCase(),
        );
        writeDemoData(demo);
        return email;
      }
      const { error } = await supabase.rpc("finance_remove_allowed_email", {
        p_email: email.toLowerCase(),
      });
      if (error) throw error;
      return email;
    },
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      if (!supabase) {
        const demo = readDemoData();
        const category = demo.categories.find(
          (item) => item.id === input.category_id,
        );
        const transaction: Transaction = {
          ...input,
          id: crypto.randomUUID(),
          amount: Number(input.amount),
          payment_method: input.payment_method ?? null,
          receipt_url: input.receipt_url ?? null,
          category: category
            ? {
                id: category.id,
                name: category.name,
                color: category.color,
                cost_class: category.cost_class,
              }
            : null,
        };
        demo.transactions.unshift(transaction);
        writeDemoData(demo);
        return transaction;
      }
      const { data, error } = await supabase
        .from("transactions")
        .insert({ ...input, amount: Number(input.amount) })
        .select("*, category:categories(id,name,color,cost_class)")
        .single();
      if (error) throw error;
      return normalizeTransaction(data as Record<string, unknown>);
    },
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { id: string; data: TransactionInput }) => {
      if (!supabase) {
        const demo = readDemoData();
        const index = demo.transactions.findIndex(
          (item) => item.id === variables.id,
        );
        if (index < 0) throw new Error("Transaksi tidak ditemukan.");
        const category = demo.categories.find(
          (item) => item.id === variables.data.category_id,
        );
        demo.transactions[index] = {
          ...demo.transactions[index],
          ...variables.data,
          amount: Number(variables.data.amount),
          category: category
            ? {
                id: category.id,
                name: category.name,
                color: category.color,
                cost_class: category.cost_class,
              }
            : null,
        };
        writeDemoData(demo);
        return demo.transactions[index];
      }
      const { data, error } = await supabase
        .from("transactions")
        .update({ ...variables.data, amount: Number(variables.data.amount) })
        .eq("id", variables.id)
        .select("*, category:categories(id,name,color,cost_class)")
        .single();
      if (error) throw error;
      return normalizeTransaction(data as Record<string, unknown>);
    },
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) {
        const demo = readDemoData();
        demo.transactions = demo.transactions.filter((item) => item.id !== id);
        writeDemoData(demo);
        return id;
      }
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CategoryInput) => {
      if (!supabase) {
        const demo = readDemoData();
        const category = { ...input, id: crypto.randomUUID() };
        demo.categories.push(category);
        writeDemoData(demo);
        return category;
      }
      const { data, error } = await supabase
        .from("categories")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { id: string; data: CategoryInput }) => {
      if (!supabase) {
        const demo = readDemoData();
        const index = demo.categories.findIndex(
          (item) => item.id === variables.id,
        );
        if (index < 0) throw new Error("Kategori tidak ditemukan.");
        demo.categories[index] = { ...demo.categories[index], ...variables.data };
        writeDemoData(demo);
        return demo.categories[index];
      }
      const { data, error } = await supabase
        .from("categories")
        .update(variables.data)
        .eq("id", variables.id)
        .select()
        .single();
      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) {
        const demo = readDemoData();
        if (demo.transactions.some((item) => item.category_id === id)) {
          throw new Error("Kategori masih digunakan oleh transaksi.");
        }
        demo.categories = demo.categories.filter((item) => item.id !== id);
        writeDemoData(demo);
        return id;
      }
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => invalidateFinance(queryClient),
  });
}

export function useSaveBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BudgetInput) => {
      if (!supabase) {
        const demo = readDemoData();
        const existing = demo.budgets.find(
          (item) =>
            item.month_year.slice(0, 7) === input.month_year.slice(0, 7) &&
            item.category_id === input.category_id,
        );
        if (existing) {
          existing.limit_amount = Number(input.limit_amount);
        } else {
          demo.budgets.push({
            ...input,
            id: crypto.randomUUID(),
            limit_amount: Number(input.limit_amount),
            category: null,
          });
        }
        writeDemoData(demo);
        return input;
      }
      const { data, error } = await supabase
        .from("budgets")
        .upsert(
          { ...input, month_year: `${input.month_year.slice(0, 7)}-01` },
          { onConflict: "month_year,category_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as Budget;
    },
    onSuccess: () => invalidateFinance(queryClient),
  });
}
