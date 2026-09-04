import { useEffect, useRef, useState } from 'react';
import { Bold, FileUp, Heading2, Italic, List, Paperclip, Quote, Save, X } from 'lucide-react';
import type { RecordEntry, RecordType, SaveRecordInput } from '../../types/record';
import { attachmentContentUrl, fetchRecordAttachments, uploadRecordAttachment } from '../../services/recordApi';
import { RECORD_TYPES } from './recordTypes';
import styles from './RecordEditor.module.css';

interface Props {
  date: string;
  entry?: RecordEntry | null;
  initialType?: RecordType;
  compact?: boolean;
  saving: boolean;
  onSave: (input: SaveRecordInput) => Promise<void>;
  onClose?: () => void;
}

function sanitizeHtml(html: string) {
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  documentNode.querySelectorAll('script,style,iframe,object,embed').forEach((node) => node.remove());
  documentNode.body.querySelectorAll('*').forEach((node) => Array.from(node.attributes).forEach((attribute) => {
    if (attribute.name.startsWith('on') || /javascript:/i.test(attribute.value)) node.removeAttribute(attribute.name);
  }));
  return documentNode.body.innerHTML;
}

/** 飞书风格轻量富文本编辑器；快速入口与完整编辑共用同一保存模型。 */
export function RecordEditor({ date, entry, initialType = 'quick', compact = false, saving, onSave, onClose }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(entry?.title ?? '');
  const [type, setType] = useState<RecordType>(entry?.type ?? initialType);
  const [recordDate, setRecordDate] = useState(entry?.recordDate ?? date);
  const [tags, setTags] = useState(entry?.tags.join('，') ?? '');
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<Awaited<ReturnType<typeof fetchRecordAttachments>>>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(entry?.contentHtml ?? '');
  }, [entry]);
  useEffect(() => { if (compact) setRecordDate(date); }, [compact, date]);

  useEffect(() => { if (entry) void fetchRecordAttachments(entry.id).then(setAttachments).catch(() => setError('附件加载失败')); }, [entry]);

  const format = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const submit = async () => {
    const contentHtml = sanitizeHtml(editorRef.current?.innerHTML ?? '');
    const contentText = editorRef.current?.innerText.trim() ?? '';
    if (!title.trim() && !contentText) { setError('写下一点内容后再保存'); return; }
    setError('');
    try {
      await onSave({ recordDate, type, title: title.trim() || undefined, contentHtml, contentText,
        tags: tags.split(/[，,]/).map((item) => item.trim()).filter(Boolean) });
      if (compact) {
        if (editorRef.current) editorRef.current.innerHTML = '';
        setTitle(''); setTags(''); setType('quick');
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败，请重试'); }
  };

  return (
    <section className={`${styles.editorShell} ${compact ? styles.compact : ''}`} aria-label={compact ? '快速写随记' : '编辑记录'}>
      <div className={styles.editorHeader}>
        <select value={type} onChange={(event) => setType(event.target.value as RecordType)} aria-label="记录类型">
          {RECORD_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <input type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} aria-label="记录日期" />
        {onClose && <button type="button" onClick={onClose} aria-label="关闭编辑器"><X size={16} /></button>}
      </div>
      {!compact && <input className={styles.titleInput} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题（可选）" />}
      <div className={styles.toolbar} aria-label="正文格式">
        <button type="button" onMouseDown={(event) => { event.preventDefault(); format('bold'); }} title="粗体"><Bold size={15} /></button>
        <button type="button" onMouseDown={(event) => { event.preventDefault(); format('italic'); }} title="斜体"><Italic size={15} /></button>
        <button type="button" onMouseDown={(event) => { event.preventDefault(); format('formatBlock', 'h2'); }} title="标题"><Heading2 size={15} /></button>
        <button type="button" onMouseDown={(event) => { event.preventDefault(); format('insertUnorderedList'); }} title="列表"><List size={15} /></button>
        <button type="button" onMouseDown={(event) => { event.preventDefault(); format('formatBlock', 'blockquote'); }} title="引用"><Quote size={15} /></button>
      </div>
      <div ref={editorRef} className={styles.content} contentEditable suppressContentEditableWarning data-placeholder={compact ? '记下此刻的想法…' : '开始写作…'} />
      {!compact && entry && <div className={styles.attachments}>
        {attachments.map((attachment) => <a key={attachment.id} className={attachment.mediaType.startsWith('image/') ? styles.imageAttachment : ''} href={attachmentContentUrl(entry.id, attachment.id)} target="_blank" rel="noreferrer">
          {attachment.mediaType.startsWith('image/') ? <img src={attachmentContentUrl(entry.id, attachment.id)} alt={attachment.originalName} /> : <Paperclip size={13} />}
          <span>{attachment.originalName}</span>
        </a>)}
        <label><FileUp size={13} />{uploading ? '上传中…' : '添加图片或附件'}<input type="file" disabled={uploading} onChange={async (event) => {
          const file = event.target.files?.[0]; if (!file) return; setUploading(true);
          try { const uploaded = await uploadRecordAttachment(entry.id, file); setAttachments((items) => [...items, uploaded]); }
          catch (reason) { setError(reason instanceof Error ? reason.message : '附件上传失败'); }
          finally { setUploading(false); event.target.value = ''; }
        }} /></label>
      </div>}
      {!compact && <input className={styles.tagsInput} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="添加标签，用逗号分隔" />}
      <div className={styles.footer}>
        <span>{error || (compact ? '默认保存为随记，可稍后整理' : entry ? '支持图片、PDF 与普通附件' : '保存后可添加图片和附件')}</span>
        <button type="button" className={styles.saveButton} disabled={saving} onClick={() => void submit()}>
          <Save size={14} />{saving ? '保存中…' : '保存'}
        </button>
      </div>
    </section>
  );
}
