import test from 'node:test';
import assert from 'node:assert/strict';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from '@tiptap/markdown';

function extractEditorHeadings(editor) {
  if (!editor) return [];
  const items = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const label = node.textContent.trim();
      if (label) {
        items.push({
          id: `${pos}-${label}`,
          level: node.attrs.level || 1,
          label,
          pos,
        });
      }
    }
  });
  return items;
}

test('Tiptap Markdown 双向解析：初始化 Markdown 内容并能完整导出', () => {
  const initialMarkdown = `## 二级标题

这是第一段正文内容。

### 三级小结

- 列表项一
- 列表项二

> 重要引用提示`;

  const editor = new Editor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Markdown,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: initialMarkdown,
    contentType: 'markdown',
  });

  const exportedMarkdown = editor.getMarkdown();
  assert.match(exportedMarkdown, /## 二级标题/);
  assert.match(exportedMarkdown, /### 三级小结/);
  assert.match(exportedMarkdown, /这是第一段正文内容/);
  assert.match(exportedMarkdown, /> 重要引用提示/);

  const headings = extractEditorHeadings(editor);
  assert.equal(headings.length, 2);
  assert.equal(headings[0].level, 2);
  assert.equal(headings[0].label, '二级标题');
  assert.equal(headings[1].level, 3);
  assert.equal(headings[1].label, '三级小结');

  editor.destroy();
});

test('Tiptap TaskList 待办项 Markdown 解析', () => {
  const taskMarkdown = `- [ ] 待办事项 1
- [x] 已完成事项 2`;

  const editor = new Editor({
    extensions: [
      StarterKit,
      Markdown,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: taskMarkdown,
    contentType: 'markdown',
  });

  const exported = editor.getMarkdown();
  assert.match(exported, /\[ \] 待办事项 1/);
  assert.match(exported, /\[x\] 已完成事项 2/);

  editor.destroy();
});
