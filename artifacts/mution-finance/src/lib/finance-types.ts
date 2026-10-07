export type TransactionType = "INCOME" | "EXPENSE";
export type CostClass = "DIRECT" | "OPERATING" | null;

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  cost_class: CostClass;
};

export type Transaction = {
  id: string;
  date: string;
  type: TransactionType;
  category_id: string;
  amount: number;
  description: string;
  payment_method: string | null;
  receipt_url: string | null;
  category: Pick<Category, "id" | "name" | "color" | "cost_class"> | null;
};

export type Budget = {
  id: string;
  month_year: string;
  category_id: string;
  limit_amount: number;
  category: Pick<Category, "id" | "name" | "color"> | null;
};

export type TransactionFilters = {
  month?: string;
  type?: TransactionType | "ALL";
  categoryId?: string;
  search?: string;
};

export type TransactionInput = {
  date: string;
  type: TransactionType;
  category_id: string;
  amount: number;
  description: string;
  payment_method?: string | null;
  receipt_url?: string | null;
};

export type CategoryInput = {
  name: string;
  type: TransactionType;
  color: string;
  cost_class: CostClass;
};

export type BudgetInput = {
  month_year: string;
  category_id: string;
  limit_amount: number;
};

export type AccessRole = "ADMIN" | "MEMBER";

export type FinanceAccess = {
  email: string;
  role: AccessRole;
  created_at: string;
};

export type CashFlowPoint = {
  month: string;
  income: number;
  expense: number;
};

export type ExpenseSlice = {
  categoryId: string;
  categoryName: string;
  color: string;
  amount: number;
  percentage: number;
};

export type FinanceDashboard = {
  month: string;
  income: number;
  expense: number;
  netProfit: number;
  cashBalance: number;
  cashFlow: CashFlowPoint[];
  expenseBreakdown: ExpenseSlice[];
  recentTransactions: Transaction[];
};

export type ProfitLossReport = {
  month: string;
  revenue: number;
  directCosts: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
};
