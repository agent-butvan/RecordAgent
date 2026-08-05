import React, { useState } from 'react';
import { Trash2, Sparkles, Check } from 'lucide-react';
import styles from './ModelCard.module.css';

export interface ModelItem {
  providerId: string;
  providerType: string;
  providerName?: string;
  id: string;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  description?: string;
  supportsReasoning?: boolean;
}

interface ModelCardProps {
  item: ModelItem;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTest: () => void;
  isTesting?: boolean;
  testResult?: { success: boolean; message: string };
}

const VENDOR_LOGOS: Record<string, string> = {
  gemini: '/vendors/gemini.png',
  deepseek: '/vendors/deepseek.png',
  openai: '/vendors/openai.png',
  dashscope: '/vendors/dashscope.png',
  anthropic: '/vendors/anthropic.png',
  ollama: '/vendors/ollama.png',
};

const VENDOR_DISPLAY_NAMES: Record<string, string> = {
  gemini: 'Google Gemini',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  dashscope: '通义千问 (DashScope)',
  anthropic: 'Anthropic Claude',
  ollama: 'Ollama',
};

export const ModelCard: React.FC<ModelCardProps> = ({
  item,
  isActive,
  onSelect,
  onDelete,
  onTest,
  isTesting = false,
  testResult
}) => {
  const [imgError, setImgError] = useState(false);

  const vendorKey = (item.providerType || item.providerId || '').toLowerCase();
  const logoPath = VENDOR_LOGOS[vendorKey];
  const vendorName = VENDOR_DISPLAY_NAMES[vendorKey] || item.providerName || vendorKey.toUpperCase();

  return (
    <div className={`${styles.card} ${isActive ? styles.cardActive : ''}`}>
      <div className={styles.leftSection}>
        {/* 厂商图标 */}
        <div className={styles.iconWrapper}>
          {!imgError && logoPath ? (
            <img
              src={logoPath}
              alt={vendorName}
              className={styles.vendorImg}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={styles.vendorFallback}>
              {vendorName ? vendorName.charAt(0).toUpperCase() : <Sparkles size={16} />}
            </div>
          )}
        </div>

        {/* 厂商 + 模型名称 */}
        <div className={styles.infoGroup}>
          <span className={styles.vendorText}>{vendorName}</span>
          <span className={styles.modelName}>{item.name}</span>
        </div>
      </div>

      {/* 右侧极其平实的激活与操作栏 */}
      <div className={styles.rightSection}>
        {testResult && (
          <span
            style={{
              fontSize: '11px',
              color: testResult.success ? '#059669' : '#dc2626',
              marginRight: '4px'
            }}
          >
            {testResult.success ? '连接正常' : '连接失败'}
          </span>
        )}

        <button className={styles.testBtn} onClick={onTest} disabled={isTesting}>
          {isTesting ? '测试中...' : '测试连接'}
        </button>

        {isActive ? (
          <span className={styles.activeTag}>
            <Check size={12} style={{ display: 'inline', marginRight: '4px' }} />
            当前激活
          </span>
        ) : (
          <button className={styles.selectBtn} onClick={onSelect}>
            设为当前
          </button>
        )}

        <button
          className={styles.deleteBtn}
          onClick={onDelete}
          title="删除模型"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};
