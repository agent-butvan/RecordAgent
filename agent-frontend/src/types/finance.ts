export type FinanceAccountType =
  | 'wechat_balance' | 'wechat_yield' | 'alipay_balance' | 'alipay_yuebao' | 'bank' | 'other'
  | 'wechat' | 'alipay' | 'cash';
export type FinanceTransactionType = 'income' | 'expense' | 'yield';
export type FinanceChartRange = 'today' | 'week' | 'month' | 'year';

export interface FinanceAccount {
  id: string;
  name: string;
  accountType: FinanceAccountType;
  currency: string;
  balance: number;
  interestEnabled: boolean;
  annualRatePercent: number;
  lastAccrualDate: string;
  version: number;
}

export interface FinanceTransaction {
  id: string;
  accountId: string;
  accountName: string;
  date: string;
  time: string;
  transactionType: FinanceTransactionType;
  category: string;
  note: string;
  amount: number;
  currency: string;
  source: 'manual' | 'automatic' | 'calendar';
  createdAt: string;
}

export interface FinanceOverview {
  totalAssets: number;
  monthIncome: number;
  monthExpense: number;
  monthYield: number;
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
}

export interface FinanceCategoryOptions {
  expense: string[];
  income: string[];
}

export interface FinanceExpenseCategory {
  category: string;
  amount: number;
}

export interface FinanceExpenseChartDay {
  date: string;
  total: number;
  income: number;
  categories: FinanceExpenseCategory[];
}

export interface FinanceExpenseChart {
  range: FinanceChartRange;
  from: string;
  to: string;
  totalExpense: number;
  totalIncome: number;
  days: FinanceExpenseChartDay[];
}

export interface CreateFinanceAccountInput {
  name: string;
  accountType: FinanceAccountType;
  currency: string;
  initialBalance: number;
  interestEnabled: boolean;
  annualRatePercent: number;
}

export interface CreateFinanceTransactionInput {
  accountId: string;
  transactionType: Exclude<FinanceTransactionType, 'yield'>;
  category: string;
  note: string;
  amount: number;
  date: string;
  time: string;
}
