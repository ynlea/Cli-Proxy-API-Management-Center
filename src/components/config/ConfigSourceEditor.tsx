import { useMemo, type Ref } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { tags } from '@lezer/highlight';

type ConfigSourceEditorProps = {
  value: string;
  onChange: (value: string) => void;
  editorRef?: Ref<ReactCodeMirrorRef>;
  theme: 'light' | 'dark';
  editable: boolean;
  placeholder: string;
};

export default function ConfigSourceEditor({
  value,
  onChange,
  editorRef,
  theme,
  editable,
  placeholder,
}: ConfigSourceEditorProps) {
  const editorTheme = useMemo(
    () =>
      EditorView.theme(
        {
          '&': {
            height: '100%',
            color: 'var(--editor-text)',
            backgroundColor: 'var(--editor-bg)',
          },
          '&.cm-focused': {
            outline: 'none',
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: 'var(--editor-font)',
            lineHeight: '1.72',
            letterSpacing: '0.01em',
          },
          '.cm-content, .cm-gutter': {
            fontFamily: 'var(--editor-font)',
            fontFeatureSettings: '"liga" 1, "calt" 1, "zero" 1',
          },
          '.cm-content': {
            padding: '20px 0 28px',
            caretColor: 'var(--editor-caret)',
          },
          '.cm-line': {
            padding: '0 24px 0 20px',
          },
          '.cm-placeholder': {
            color: 'var(--editor-placeholder)',
            fontStyle: 'italic',
          },
          '.cm-gutters': {
            minWidth: '68px',
            borderRight: '1px solid var(--editor-gutter-border)',
            backgroundColor: 'var(--editor-gutter-bg)',
            color: 'var(--editor-gutter-text)',
          },
          '.cm-gutterElement': {
            padding: '0 14px 0 18px',
          },
          '.cm-lineNumbers .cm-gutterElement': {
            minWidth: '46px',
            fontSize: '12px',
            fontWeight: '600',
          },
          '.cm-activeLine': {
            backgroundColor: 'var(--editor-line-active)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'var(--editor-gutter-active)',
          },
          '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
            backgroundColor: 'var(--editor-selection)',
          },
          '.cm-cursor, .cm-dropCursor': {
            borderLeftColor: 'var(--editor-caret)',
          },
          '.cm-selectionMatch': {
            backgroundColor: 'var(--editor-selection-match)',
            borderRadius: '4px',
          },
          '.cm-searchMatch': {
            backgroundColor: 'var(--editor-search-match)',
            outline: '1px solid var(--editor-search-outline)',
            borderRadius: '4px',
          },
          '.cm-searchMatch.cm-searchMatch-selected, .cm-searchMatch-selected': {
            backgroundColor: 'var(--editor-search-selected)',
          },
          '.cm-panels': {
            backgroundColor: 'var(--editor-panel-bg)',
            color: 'var(--editor-text)',
            borderBottom: '1px solid var(--editor-panel-border)',
          },
          '.cm-panels-top': {
            borderBottom: '1px solid var(--editor-panel-border)',
          },
          '.cm-search': {
            padding: '10px 12px',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
          },
          '.cm-search .cm-textfield': {
            minHeight: '34px',
            padding: '0 12px',
            borderRadius: '10px',
            border: '1px solid var(--editor-gutter-border)',
            backgroundColor: 'var(--editor-input-bg)',
            color: 'var(--editor-text)',
          },
          '.cm-search label': {
            color: 'var(--editor-text-muted)',
          },
          '.cm-button': {
            borderRadius: '10px',
            border: '1px solid var(--editor-gutter-border)',
            backgroundColor: 'var(--editor-input-bg)',
            color: 'var(--editor-text)',
            backgroundImage: 'none',
          },
          '.cm-button:hover': {
            backgroundColor: 'var(--editor-button-hover)',
          },
          '.cm-tooltip': {
            border: '1px solid var(--editor-gutter-border)',
            borderRadius: '12px',
            backgroundColor: 'var(--editor-panel-bg)',
            color: 'var(--editor-text)',
            boxShadow: '0 14px 30px rgba(12, 20, 32, 0.12)',
          },
          '.cm-tooltip .cm-tooltip-arrow:before': {
            borderTopColor: 'var(--editor-panel-bg)',
            borderBottomColor: 'var(--editor-panel-bg)',
          },
          '.cm-foldPlaceholder': {
            border: '1px solid var(--editor-gutter-border)',
            borderRadius: '999px',
            backgroundColor: 'var(--editor-input-bg)',
            color: 'var(--editor-text-muted)',
          },
        },
        { dark: theme === 'dark' }
      ),
    [theme]
  );

  const syntaxTheme = useMemo(
    () =>
      syntaxHighlighting(
        HighlightStyle.define([
          { tag: [tags.propertyName, tags.attributeName], color: 'var(--editor-token-key)', fontWeight: '700' },
          { tag: [tags.string, tags.special(tags.string)], color: 'var(--editor-token-string)' },
          { tag: [tags.number, tags.integer, tags.float], color: 'var(--editor-token-number)' },
          { tag: [tags.bool, tags.null, tags.atom], color: 'var(--editor-token-atom)', fontWeight: '700' },
          { tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword], color: 'var(--editor-token-keyword)', fontWeight: '700' },
          { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--editor-token-comment)', fontStyle: 'italic' },
          { tag: [tags.punctuation, tags.separator], color: 'var(--editor-token-punctuation)' },
          { tag: [tags.squareBracket, tags.brace], color: 'var(--editor-token-bracket)' },
          { tag: [tags.url, tags.link], color: 'var(--editor-token-link)', textDecoration: 'underline' },
        ])
      ),
    []
  );

  const extensions = useMemo(
    () => [
      yaml(),
      search(),
      highlightSelectionMatches(),
      EditorState.tabSize.of(2),
      indentUnit.of('  '),
      syntaxTheme,
      editorTheme,
      keymap.of(searchKeymap),
    ],
    [editorTheme, syntaxTheme]
  );

  return (
    <CodeMirror
      ref={editorRef}
      value={value}
      onChange={onChange}
      extensions={extensions}
      editable={editable}
      placeholder={placeholder}
      height="100%"
      style={{ height: '100%' }}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
        foldGutter: true,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
        rectangularSelection: true,
        crosshairCursor: false,
        highlightSelectionMatches: true,
        closeBracketsKeymap: true,
        searchKeymap: true,
        foldKeymap: true,
        completionKeymap: false,
        lintKeymap: true,
      }}
    />
  );
}
