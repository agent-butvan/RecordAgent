/** 子 Agent 在主 Agent SSE 流中报告的实时进度。 */
export interface SubagentProgressDto {
  source: string;
  agentId: string;
  eventType: 'start' | 'text' | 'tool' | 'end';
  content: string;
}

/** 后台子 Agent 任务的可展示状态。 */
export interface TaskDto {
  taskId: string;
  status: string;
  result: string;
  error: string;
}

/** 项目文件树节点（后端只读接口返回）。 */
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileTreeNode[];
}
