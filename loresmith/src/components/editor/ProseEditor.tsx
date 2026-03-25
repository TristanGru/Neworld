import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, Mark } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import Mention from '@tiptap/extension-mention';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { ipc } from '../../lib/ipc';
import type { Chapter } from '../../types';
import VersionHistoryPanel from './VersionHistoryPanel';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

const AUTOSAVE_INTERVAL = 30000;
const DETECT_DEBOUNCE = 1500;

// Custom EntityMark extension
const EntityMark = Mark.create({
  name: 'entityMark',
  addAttributes() {
    return {
      entityId: { default: null },
      entityName: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-entity-id]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', {
      ...HTMLAttributes,
      'data-entity-id': HTMLAttributes.entityId,
      class: 'entity-mark',
      title: HTMLAttributes.entityName,
    }, 0];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('entityMarkClick'),
        props: {
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement;
            if (target.classList.contains('entity-mark')) {
              const entityId = target.getAttribute('data-entity-id');
              if (entityId) {
                const { setActiveEntity } = useUIStore.getState();
                setActiveEntity(entityId);
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});

interface Props {
  chapter: Chapter;
}

export default function ProseEditor({ chapter }: Props) {
  const project = useProjectStore((s) => s.activeProject);
  const folderPath = useProjectStore((s) => s.folderPath);
  const entities = useProjectStore((s) => s.entities);
  const updateChapter = useProjectStore((s) => s.updateChapter);
  const addToast = useUIStore((s) => s.addToast);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [wordCount, setWordCount] = useState(chapter.word_count);

  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      EntityMark,
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: {
          items: ({ query }: { query: string }) => {
            return entities
              .filter((e) => e.name.toLowerCase().startsWith(query.toLowerCase()))
              .slice(0, 10);
          },
          render: () => {
            let component: any;
            let popup: any;
            return {
              onStart: (props: any) => {
                component = document.createElement('div');
                component.className = 'mention-autocomplete';
                document.body.appendChild(component);
                const list = document.createElement('div');
                component.appendChild(list);

                if (props.items.length === 0) {
                  component.style.display = 'none';
                  return;
                }

                renderMentionList(list, props);
                popup = tippy(document.body, {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate: (props: any) => {
                if (!component) return;
                const list = component.querySelector('div');
                if (list) renderMentionList(list, props);
                if (popup) popup[0].setProps({ getReferenceClientRect: props.clientRect });
              },
              onKeyDown: ({ event }: any) => {
                if (event.key === 'Escape') {
                  if (popup) popup[0].hide();
                  return true;
                }
                return false;
              },
              onExit: () => {
                if (popup) { popup[0].destroy(); popup = null; }
                if (component) { component.remove(); component = null; }
              },
            };
          },
          command: ({ editor, range, props }: any) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent(props.name + ' ')
              .run();
          },
        },
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      const wc = text.trim().split(/\s+/).filter(Boolean).length;
      setWordCount(wc);
      contentRef.current = editor.storage.markdown?.getMarkdown?.() ?? editor.getHTML();

      // Debounced entity detection
      if (detectRef.current) clearTimeout(detectRef.current);
      detectRef.current = setTimeout(() => {
        runEntityDetection(editor, text);
      }, DETECT_DEBOUNCE);

      // Schedule autosave
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
      autosaveRef.current = setTimeout(() => {
        saveContent(editor.getHTML());
      }, AUTOSAVE_INTERVAL);
    },
  });

  async function runEntityDetection(ed: any, text: string) {
    if (!project) return;
    try {
      const matches = await ipc.detectEntities(project.id, text);
      // Apply entity marks based on positions
      // We need to apply marks at the detected positions
      // This is simplified - in a full implementation we'd map character positions to ProseMirror positions
      applyEntityMarks(ed, matches);
    } catch (e) {
      // Silent fail per error handling strategy
    }
  }

  function applyEntityMarks(ed: any, matches: any[]) {
    if (!ed || matches.length === 0) return;

    const { doc } = ed.state;
    const tr = ed.state.tr;
    let modified = false;

    // Remove all existing entity marks first
    doc.descendants((node: any, pos: number) => {
      if (node.isText) {
        const marks = node.marks.filter((m: any) => m.type.name === 'entityMark');
        if (marks.length > 0) {
          marks.forEach((mark: any) => {
            tr.removeMark(pos, pos + node.nodeSize, mark.type);
            modified = true;
          });
        }
      }
    });

    // Apply new marks - map text positions to doc positions
    let textOffset = 0;
    doc.descendants((node: any, pos: number) => {
      if (node.isText) {
        const nodeText = node.text || '';
        const nodeStart = textOffset;
        const nodeEnd = textOffset + nodeText.length;

        for (const match of matches) {
          if (match.start >= nodeStart && match.end <= nodeEnd) {
            const from = pos + (match.start - nodeStart);
            const to = pos + (match.end - nodeStart);
            const markType = ed.schema.marks.entityMark;
            if (markType) {
              tr.addMark(from, to, markType.create({
                entityId: match.entity_id,
                entityName: match.name,
              }));
              modified = true;
            }
          }
        }
        textOffset += nodeText.length;
      }
      if (node.type.name === 'paragraph') {
        textOffset += 1; // account for newline
      }
    });

    if (modified) {
      ed.view.dispatch(tr);
    }
  }

  async function saveContent(content?: string) {
    if (!project || !folderPath) return;
    const html = content ?? editor?.getHTML() ?? '';
    setSaving(true);
    try {
      const result = await ipc.saveChapter(chapter.id, html, folderPath);
      updateChapter(chapter.id, { word_count: result.word_count });
      setWordCount(result.word_count);
    } catch (e: any) {
      addToast('Failed to save chapter', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Load content when chapter changes
  useEffect(() => {
    if (!editor || !folderPath) return;
    setLoading(true);
    ipc.getChapterContent(chapter.id, folderPath)
      .then((content) => {
        editor.commands.setContent(content || '');
        setWordCount(chapter.word_count);
      })
      .catch(() => {
        editor.commands.setContent('');
      })
      .finally(() => setLoading(false));

    return () => {
      // Save on chapter change
      if (editor && !loading) {
        saveContent(editor.getHTML());
      }
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
      if (detectRef.current) clearTimeout(detectRef.current);
    };
  }, [chapter.id, editor]);

  function renderMentionList(container: HTMLElement, props: any) {
    container.innerHTML = '';
    props.items.forEach((item: any, index: number) => {
      const el = document.createElement('div');
      el.className = `mention-item${props.selectedIndex === index ? ' is-selected' : ''}`;
      el.innerHTML = `<span>${item.name}</span>`;
      el.addEventListener('click', () => props.command(item));
      container.appendChild(el);
    });
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-4 py-2 border-b text-sm"
        style={{ background: 'var(--color-bg-panel)', borderColor: 'var(--color-border)' }}
      >
        <span className="font-semibold flex-1" style={{ color: 'var(--color-text)' }}>
          {chapter.title}
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>
          {wordCount.toLocaleString()} words
        </span>
        {saving && <span style={{ color: 'var(--color-text-muted)' }}>Saving...</span>}
        <button
          onClick={() => saveContent()}
          className="px-3 py-1 rounded text-xs font-medium"
          style={{ background: 'var(--color-primary)', color: 'white' }}
        >
          Save
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-3 py-1 rounded text-xs"
          style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
        >
          History
        </button>

        {/* Format buttons */}
        <div className="flex gap-1 ml-2">
          {[
            { label: 'B', action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
            { label: 'I', action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
            { label: 'U', action: () => editor?.chain().focus().toggleUnderline().run(), active: editor?.isActive('underline') },
          ].map(({ label, action, active }) => (
            <button
              key={label}
              onClick={action}
              className="w-7 h-7 rounded text-xs font-bold"
              style={{
                background: active ? 'var(--color-primary)' : 'transparent',
                color: active ? 'white' : 'var(--color-text-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span style={{ color: 'var(--color-text-muted)' }}>Loading...</span>
          </div>
        ) : (
          <EditorContent
            editor={editor}
            className="h-full"
            style={{ fontFamily: 'var(--font-prose)' }}
          />
        )}
      </div>

      {showHistory && (
        <VersionHistoryPanel
          chapterId={chapter.id}
          onRestore={(content) => {
            editor?.commands.setContent(content);
            addToast('Snapshot loaded. Save to apply.', 'info');
          }}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
