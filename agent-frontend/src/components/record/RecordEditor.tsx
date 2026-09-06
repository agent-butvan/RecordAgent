import { useEffect, useState } from 'react';
import { FileArrowUpIcon, PaperclipIcon } from '@phosphor-icons/react';
import { attachmentContentUrl, fetchRecordAttachments, uploadRecordAttachment } from '../../services/recordApi';
import type { RecordEntry, RecordTab, RecordType, SaveRecordInput } from '../../types/record';
import { WritingEditorPage } from '../common/WritingEditorPage';
import styles from './RecordEditor.module.css';

interface Props {
  date: string;
  entry?: RecordEntry | null;
  initialType?: RecordType;
  initialTabId?: string;
  tabs: RecordTab[];
  saving: boolean;
  onSave: (input: SaveRecordInput) => Promise<void>;
  onBack: () => void;
}

function textToHtml(text: string) {
  const escaped = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return escaped.split('\n').map((line) => `<p>${line || '<br>'}</p>`).join('');
}

function typeForSystemTab(tab?: RecordTab): RecordType | null {
  if (tab?.systemKey === 'weekly_review') return 'weekly_review';
  if (tab?.systemKey === 'journal') return 'journal';
  if (tab?.systemKey === 'reading') return 'reading';
  if (tab?.systemKey === 'knowledge' || tab?.systemKey === 'interview') return 'learning';
  if (tab?.systemKey === 'quick') return 'quick';
  return null;
}

/** 使用全项目统一写作界面，为资料记录补充分类、标签和附件能力。 */
export function RecordEditor({ date, entry, initialType = 'quick', initialTabId, tabs, saving, onSave, onBack }: Props) {
  const [type, setType] = useState<RecordType>(entry?.type ?? initialType);
  const [recordDate, setRecordDate] = useState(entry?.recordDate ?? date);
  const [tabId, setTabId] = useState(entry?.tabId ?? initialTabId ?? '');
  const [tags, setTags] = useState(entry?.tags.join('，') ?? '');
  const [attachments, setAttachments] = useState<Awaited<ReturnType<typeof fetchRecordAttachments>>>([]);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  useEffect(() => { if (entry) void fetchRecordAttachments(entry.id).then(setAttachments).catch(() => setAttachmentError('附件加载失败')); }, [entry]);

  const tabName = tabs.find((tab) => tab.id === tabId)?.name ?? '全部';
  return <WritingEditorPage backLabel="记录" identity={entry ? '编辑资料' : '新增资料'} detail={`${recordDate} · ${tabName}`}
    initialTitle={entry?.title ?? ''} initialBody={entry?.contentText ?? ''} saving={saving} error={attachmentError}
    bodyPlaceholder="开始整理知识、问题与思考……" onBack={onBack}
    meta={<div className={styles.metaControls}>
      <select value={tabId} onChange={(event) => { const nextId = event.target.value; setTabId(nextId); const nextType = typeForSystemTab(tabs.find((tab) => tab.id === nextId)); if (nextType) setType(nextType); }} aria-label="所属 Tab">
        <option value="" disabled>选择分类</option>{tabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.name}</option>)}
      </select>
      <input type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} aria-label="记录日期" />
    </div>}
    footer={<div className={styles.details}>
      <input className={styles.tagsInput} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="添加标签，用逗号分隔" aria-label="记录标签" />
      {entry && <div className={styles.attachments}>{attachments.map((attachment) => <a key={attachment.id} href={attachmentContentUrl(entry.id, attachment.id)} target="_blank" rel="noreferrer">
        {attachment.mediaType.startsWith('image/') ? <img src={attachmentContentUrl(entry.id, attachment.id)} alt={attachment.originalName} /> : <PaperclipIcon size={13} />}<span>{attachment.originalName}</span>
      </a>)}<label><FileArrowUpIcon size={13} />{uploading ? '上传中…' : '添加附件'}<input type="file" disabled={uploading} onChange={async (event) => {
        const file = event.target.files?.[0]; if (!file) return; setUploading(true); setAttachmentError(null);
        try { const uploaded = await uploadRecordAttachment(entry.id, file); setAttachments((items) => [...items, uploaded]); }
        catch (reason) { setAttachmentError(reason instanceof Error ? reason.message : '附件上传失败'); }
        finally { setUploading(false); event.target.value = ''; }
      }} /></label></div>}
    </div>}
    onSave={({ title, body }) => onSave({ recordDate, type, title, contentHtml: textToHtml(body), contentText: body,
      tags: tags.split(/[，,]/).map((item) => item.trim()).filter(Boolean), tabId: tabId || undefined })} />;
}
