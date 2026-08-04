import React, { useState } from 'react';
import { Sparkles, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { saveModelConfig } from '../../services/api';
import styles from './ModelInitModal.module.css';

interface ModelInitModalProps {
  vendors: string[];
  onSuccess: () => void;
}

// 推荐默认模型名称映射
const DEFAULT_MODEL_NAMES: Record<string, string> = {
  gemini: 'gemini-3.6-flash',
  openai: 'gpt-4o',
  deepseek: 'deepseek-chat',
  dashscope: 'qwen-max',
  anthropic: 'claude-3-5-sonnet-20241022',
  ollama: 'llama3:latest',
};

export const ModelInitModal: React.FC<ModelInitModalProps> = ({ vendors, onSuccess }) => {
  const [selectedVendor, setSelectedVendor] = useState<string>(() => vendors[0] || 'gemini');
  const [modelName, setModelName] = useState<string>(() => DEFAULT_MODEL_NAMES[vendors[0]] || 'gemini-3.6-flash');
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 切换 Vendor 时智能填充推荐的 Model Name
  const handleVendorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setSelectedVendor(v);
    if (DEFAULT_MODEL_NAMES[v]) {
      setModelName(DEFAULT_MODEL_NAMES[v]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor) {
      setErrorMsg('请选择模型厂商 Vendor');
      return;
    }
    if (!modelName.trim()) {
      setErrorMsg('请填写模型名称 Model Name');
      return;
    }
    if (selectedVendor !== 'ollama' && !apiKey.trim()) {
      setErrorMsg('请填写 API Key 密匙');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await saveModelConfig({
      vendor: selectedVendor,
      modelName: modelName.trim(),
      apiKey: apiKey.trim(),
    });

    setIsSubmitting(false);

    if (res.success) {
      onSuccess();
    } else {
      setErrorMsg(res.message || '保存配置失败，请检查后端网络连接');
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <Sparkles size={24} />
          </div>
          <h2 className={styles.title}>初始化模型设置</h2>
          <p className={styles.subtitle}>
            请完成初始模型厂商与 API Key 设置以开启 Agent 体验
          </p>
        </div>

        {errorMsg && (
          <div className={styles.errorAlert}>
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* 厂商 Vendor 选择 */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>模型厂商 Vendor</label>
            <select
              className={styles.select}
              value={selectedVendor}
              onChange={handleVendorChange}
            >
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v.toUpperCase()} ({v})
                </option>
              ))}
            </select>
          </div>

          {/* 模型名称 Model Name */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>模型名称 Model Name</label>
            <input
              className={styles.input}
              placeholder="例如 gemini-3.6-flash 或 gpt-4o"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            />
          </div>

          {/* API Key */}
          {selectedVendor !== 'ollama' && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>API Key 密匙</label>
              <div className={styles.inputWrapper}>
                <input
                  className={styles.input}
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="请输入您的 API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          {/* 提交按钮 */}
          <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
            {isSubmitting ? '保存中...' : '保存配置并开启体验'}
            {!isSubmitting && <ArrowRight size={15} />}
          </button>
        </form>
      </div>
    </div>
  );
};
