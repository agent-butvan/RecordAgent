import React from 'react';
import { ToolApprovalCard, type ToolApprovalCardProps } from './ToolApprovalCard';

export type PermissionRequestCardProps = ToolApprovalCardProps;

/** 在一张卡片中展示并审核工具调用（向后兼容封装，实际使用 ToolApprovalCard） */
export const PermissionRequestCard: React.FC<PermissionRequestCardProps> = (props) => {
  return <ToolApprovalCard {...props} />;
};

export default PermissionRequestCard;

