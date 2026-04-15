import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Link as LinkIcon, Unlink } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  onFocus?: () => void;
  singleLine?: boolean;
}

function Toolbar({ editor }: { editor: Editor }) {
  const Btn = ({
    active, disabled, onClick, title, children,
  }: { active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "h-6 w-6 flex items-center justify-center border border-gray-300 transition-colors shrink-0 text-[11px]",
        active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 hover:bg-gray-100",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
    }
  };

  return (
    <div className="flex items-center gap-0.5 flex-wrap px-1.5 py-1 border-b border-gray-200 bg-gray-50">
      <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
        <Bold className="h-3 w-3" />
      </Btn>
      <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
        <Italic className="h-3 w-3" />
      </Btn>
      <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
        <UnderlineIcon className="h-3 w-3" />
      </Btn>
      <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
        <Strikethrough className="h-3 w-3" />
      </Btn>
      <div className="w-px h-4 bg-gray-300 mx-0.5" />
      <Btn active={editor.isActive("link")} onClick={setLink} title="Add / edit link">
        <LinkIcon className="h-3 w-3" />
      </Btn>
      {editor.isActive("link") && (
        <Btn active={false} onClick={() => editor.chain().focus().unsetLink().run()} title="Remove link">
          <Unlink className="h-3 w-3" />
        </Btn>
      )}
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing…",
  className,
  minHeight = "80px",
  onFocus,
  singleLine = false,
}: RichTextEditorProps) {
  const isFocused = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        hardBreak: { keepMarks: true },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
    ],
    content: value || "",
    onUpdate({ editor }) {
      onChangeRef.current(editor.getHTML());
    },
    onFocus() {
      isFocused.current = true;
      onFocus?.();
    },
    onBlur() {
      isFocused.current = false;
    },
    editorProps: {
      attributes: {
        class: "rte-content focus:outline-none",
        style: `min-height:${minHeight};padding:8px 10px;`,
      },
      handleKeyDown(view, event) {
        if (singleLine && event.key === "Enter") {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
  });

  // Sync external value changes into the editor when not focused
  // (e.g. after a save/refetch brings back data from the server)
  useEffect(() => {
    if (!editor) return;
    if (isFocused.current) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={cn("border border-input bg-background overflow-hidden", className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
