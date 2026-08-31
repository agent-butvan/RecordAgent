import React from 'react';
import styles from './RightSidePanel.module.css';

interface PanelErrorBoundaryProps {
  children: React.ReactNode;
}

interface PanelErrorBoundaryState {
  error: Error | null;
}

/**
 * 右侧面板内容错误边界。
 *
 * <p>面板内任何渲染/运行时异常（包括 WebKit DOM 异常）都会被捕获，
 * 以中文提示 + 重试入口呈现，避免原始英文报错直接暴露给用户。</p>
 */
export class PanelErrorBoundary extends React.Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  state: PanelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error };
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className={styles.boundaryError} role="alert">
          <p className={styles.boundaryErrorTitle}>面板内容加载失败</p>
          <p className={styles.boundaryErrorText}>
            遇到异常，已停止渲染该区域。可点击重试重新加载。
          </p>
          <button type="button" className={styles.boundaryRetry} onClick={this.handleRetry}>
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
