import React, { useState } from 'react';
import {
  CheckCircle2,
  Trash2,
  Brain,
  Zap,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Button } from '../common/Button';
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
  ollama: 'Ollama (Local)',
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
  const [showMask, setShowMask] = useState(true);

  const vendorKey = (item.providerType || item.providerId || '').toLowerCase();
  const logoPath = VENDOR_LOGOS[vendorKey];
  const vendorName = VENDOR_DISPLAY_NAMES[vendorKey] || item.providerName || vendorKey.toUpperCase();

  const formattedApiKey = item.apiKey
    ? showMask
      ? `${item.apiKey.substring(0, 4)}...${item.apiKey.substring(Math.max(0, item.apiKey.length - 4))}`
      : item.apiKey
    : '未填写';

  return (
    <div className={`${styles.card} ${isActive ? styles.cardActive : ''}`}>
      <div className={styles.cardMain}>
        {/* Vendor Icon Image */}
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
              {vendorName ? vendorName.charAt(0).toUpperCase() : <Sparkles size={20} />}
            </div>
          )}
        </div>

        {/* Core Info: Vendor & Model Name */}
        <div className={styles.infoCol}>
          <div className={styles.vendorMetaRow}>
            <span className={styles.vendorBadge}>{vendorName}</span>
            {item.supportsReasoning && (
              <span className={styles.reasoningBadge}>
                <Brain size={11} /> 推理
              </span>
            )}
          </div>

          <div className={styles.modelTitleRow}>
            <span className={styles.modelName} title={item.name}>
              {item.name}
            </span>
            {item.id !== item.name && (
              <span className={styles.modelIdTag}>({item.id})</span>
            )}
          </div>

          {item.description && (
            <div className={styles.desc} title={item.description}>
              {item.description}
            </div>
          )}
        </div>

        {/* Actions & Status */}
        <div className={styles.actionsGroup}>
          {isActive ? (
            <div className={styles.activeBadge}>
              <CheckCircle2 size={15} />
              <span>当前激活</span>
            </div>
          ) : (
            <button className={styles.activateBtn} onClick={onSelect}>
              设为当前
            </button>
          )}

          <button
            className={`${styles.iconActionBtn} ${styles.deleteBtn}`}
            onClick={onDelete}
            title="删除模型"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Footer bar for Key & Connection test */}
      <div className={styles.cardFooter}>
        <div className={styles.keyInfo}>
          <span>API Key:</span>
          {vendorKey !== 'ollama' ? (
            <>
              <code className={styles.keyText}>{formattedApiKey}</code>
              <button
                className={styles.iconActionBtn}
                style={{ width: '22px', height: '22px' }}
                onClick={() => setShowMask(!showMask)}
                title={showMask ? '显示完整的 API Key' : '隐藏 API Key'}
              >
                {showMask ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            </>
          ) : (
            <span style={{ color: '#94a3b8' }}>Ollama 本地 API (无需密钥)</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {testResult && (
            <span
              className={`${styles.testResultText} ${
                testResult.success ? styles.testSuccess : styles.testFail
              }`}
            >
              {testResult.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {testResult.message}
            </span>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={onTest}
            disabled={isTesting}
            icon={isTesting ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
          >
            测试连接
          </Button>
        </div>
      </div>
    </div>
  );
};
