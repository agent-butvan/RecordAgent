export type FinanceAccountType =
  | 'wechat_balance' | 'wechat_yield' | 'alipay_balance' | 'alipay_yuebao' | 'bank' | 'other'
  | 'wechat' | 'alipay' | 'cash';
export type FinanceTransactionType =
  | 'income' | 'expense' | 'yield' | 'transfer_out' | 'transfer_in'
  | 'adjustment_increase' | 'adjustment_decrease';
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
  source: 'manual' | 'automatic' | 'calendar' | 'adjustment';
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

export interface CreateFinanceBalanceAdjustmentInput {
  direction: 'increase' | 'decrease';
  amount: number;
  note: string;
}

export interface CreateFinanceTransactionInput {
  accountId: string;
  transactionType: 'income' | 'expense';
  category: string;
  note: string;
  amount: number;
  date: string;
  time: string;
}

export type UpdateFinanceTransactionInput = CreateFinanceTransactionInput;

export interface CreateFinanceTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note?: string;
  date: string;
  time: string;
}

export interface FinanceTransferResponse {
  fromTransaction: FinanceTransaction;
  toTransaction: FinanceTransaction;
}
