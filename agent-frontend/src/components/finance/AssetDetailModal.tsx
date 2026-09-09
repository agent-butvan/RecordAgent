import React from 'react';
import { PlusIcon, SparkleIcon, WalletIcon } from '@phosphor-icons/react';
import type { FinanceAccount, FinanceAccountType } from '../../types/finance';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { AccountTypeIcon } from './AccountTypeIcon';
import styles from './AssetDetailModal.module.css';

const ACCOUNT_LABELS: Record<FinanceAccountType, string> = {
  wechat_balance: '微信余额',
  wechat_yield: '微信零钱通',
  alipay_balance: '支付宝余额',
  alipay_yuebao: '支付宝余额宝',
  bank: '银行卡',
  other: '其他',
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
};

function money(value: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
}

interface AssetDetailModalProps {
  open: boolean;
  accounts: FinanceAccount[];
  totalAssets: number;
  onClose: () => void;
  onAddAccount?: () => void;
}

/** 全部资产详情概览弹窗：展示所有账户余额明细、资金占比与生息状态。 */
export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  open,
  accounts,
  totalAssets,
  onClose,
  onAddAccount,
}) => {
  const yieldAccountCount = accounts.filter((item) => item.interestEnabled).length;

  return (
    <Modal open={open} title="全部资产概览" onClose={onClose} width={540} centered>
      <div className={styles.container}>
        {/* 顶部总览卡片 */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryMain}>
            <span className={styles.summaryLabel}>净资产总额</span>
            <strong className={styles.summaryAmount}>{money(totalAssets)}</strong>
          </div>
          <div className={styles.summaryMeta}>
            <span>账户总数：<b>{accounts.length} 个</b></span>
            {yieldAccountCount > 0 && (
              <span>生息账户：<b>{yieldAccountCount} 个</b></span>
            )}
          </div>
        </div>

        {/* 账户列表 */}
        <div className={styles.list}>
          {accounts.length ? (
            accounts.map((account) => {
              const ratio = totalAssets > 0 ? Math.max(0, Math.min(100, (account.balance / totalAssets) * 100)) : 0;
              return (
                <article key={account.id} className={styles.accountCard}>
                  <div className={styles.accountHeader}>
                    <div className={styles.accountIdentity}>
                      <AccountTypeIcon type={account.accountType} size={22} variant="tile" />
                      <div className={styles.nameBlock}>
                        <strong>{account.name}</strong>
                        <div className={styles.tagRow}>
                          <span className={styles.typeTag}>{ACCOUNT_LABELS[account.accountType] ?? '账户'}</span>
                          {account.interestEnabled && (
                            <span className={styles.yieldTag}>
                              <SparkleIcon size={11} weight="fill" />
                              年化 {account.annualRatePercent}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={styles.balanceBlock}>
                      <strong className={styles.balanceAmount}>{money(account.balance)}</strong>
                      <span className={styles.ratioText}>占比 {ratio.toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* 资产占比进度条 */}
                  <div className={styles.progressTrack} title={`占总资产 ${ratio.toFixed(1)}%`}>
                    <div className={styles.progressBar} style={{ width: `${ratio}%` }} />
                  </div>
                </article>
              );
            })
          ) : (
            <div className={styles.emptyState}>
              <WalletIcon size={28} />
              <p>暂无资产账户</p>
            </div>
          )}
        </div>

        {/* 底部动作条 */}
        <div className={styles.footer}>
          {onAddAccount && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<PlusIcon size={13} weight="bold" />}
              onClick={() => {
                onClose();
                onAddAccount();
              }}
            >
              添加新账户
            </Button>
          )}
          <Button type="button" variant="primary" size="sm" onClick={onClose}>
            完成
          </Button>
        </div>
      </div>
    </Modal>
  );
};
