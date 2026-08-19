'use client';

import { useRef } from 'react';
import {
  AlignIcon,
  BoldIcon,
  BulletListIcon,
  FontSizeIcon,
  IndentIcon,
  ItalicIcon,
  LineHeightIcon,
  OrderedListIcon,
  OutdentIcon,
  QuoteIcon,
  RedoIcon,
  StrikethroughIcon,
  UnderlineIcon,
  UndoIcon,
} from '../editor-icons';

interface RichTextEditorProps {
  onChange: (html: string) => void;
  placeholder?: string;
}

type Command = { cmd: string; value?: string };

/**
 * Lightweight contentEditable editor matching the Figma toolbar. Uses
 * document.execCommand — deprecated but universally supported, and it keeps the
 * assignment free of a heavy editor dependency for what is a basic format bar.
 */
export function RichTextEditor({ onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const run = ({ cmd, value }: Command) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    onChange(editorRef.current?.innerHTML ?? '');
  };

  const tools: Array<{ icon: typeof BoldIcon; label: string; command: Command } | 'divider'> = [
    { icon: UndoIcon, label: 'Undo', command: { cmd: 'undo' } },
    { icon: RedoIcon, label: 'Redo', command: { cmd: 'redo' } },
    'divider',
    { icon: FontSizeIcon, label: 'Increase font size', command: { cmd: 'fontSize', value: '5' } },
    'divider',
    { icon: BoldIcon, label: 'Bold', command: { cmd: 'bold' } },
    { icon: ItalicIcon, label: 'Italic', command: { cmd: 'italic' } },
    { icon: UnderlineIcon, label: 'Underline', command: { cmd: 'underline' } },
    'divider',
    { icon: AlignIcon, label: 'Align left', command: { cmd: 'justifyLeft' } },
    { icon: LineHeightIcon, label: 'Align center', command: { cmd: 'justifyCenter' } },
    'divider',
    { icon: OrderedListIcon, label: 'Numbered list', command: { cmd: 'insertOrderedList' } },
    { icon: BulletListIcon, label: 'Bulleted list', command: { cmd: 'insertUnorderedList' } },
    { icon: IndentIcon, label: 'Indent', command: { cmd: 'indent' } },
    { icon: OutdentIcon, label: 'Outdent', command: { cmd: 'outdent' } },
    { icon: QuoteIcon, label: 'Quote', command: { cmd: 'formatBlock', value: 'blockquote' } },
    { icon: AlignIcon, label: 'Justify', command: { cmd: 'justifyFull' } },
    { icon: StrikethroughIcon, label: 'Strikethrough', command: { cmd: 'strikeThrough' } },
  ];

  return (
    <div className="rounded-lg bg-field p-3">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => onChange(editorRef.current?.innerHTML ?? '')}
        className="compose-body min-h-[260px] w-full text-[13px] leading-relaxed text-ink outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-0.5 rounded-full bg-white px-3 py-1.5">
        {tools.map((tool, i) =>
          tool === 'divider' ? (
            <span key={`d${i}`} className="mx-1 h-4 w-px bg-line" />
          ) : (
            <button
              key={tool.label}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              // onMouseDown prevents the editor losing its selection on click.
              onMouseDown={(e) => {
                e.preventDefault();
                run(tool.command);
              }}
              className="rounded p-1.5 text-ink-muted transition-colors hover:bg-line-soft hover:text-ink"
            >
              <tool.icon className="h-[15px] w-[15px]" />
            </button>
          )
        )}
      </div>
    </div>
  );
}
