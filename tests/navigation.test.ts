// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from 'vitest';
import { MarkdownEditor } from '../src/editor';
import { DocumentNavigation } from '../src/navigation';

describe('literal find and replace', () => {
  let editor: MarkdownEditor, navigation: DocumentNavigation;
  const input = (id: string, value: string) => { const el = document.getElementById(id) as HTMLInputElement; el.value = value; el.dispatchEvent(new Event('input')); };
  const click = (id: string) => document.getElementById(id)!.click();
  beforeEach(() => {
    document.body.innerHTML = '<textarea id="markdownEditor"></textarea><div id="previewContainer"></div><div id="previewViewport"></div>';
    editor = new MarkdownEditor('markdownEditor');
    navigation = new DocumentNavigation(editor, () => {}, () => {}, () => {});
  });
  it('starts Previous at the last result and wraps in both directions', () => {
    editor.setContent('one two one'); navigation.openFind();
    (document.getElementById('findText') as HTMLInputElement).value = 'one';
    click('findPrevious'); expect(editor.getSelection()).toEqual({ start: 8, end: 11 });
    click('findNext'); expect(editor.getSelection()).toEqual({ start: 0, end: 3 });
  });
  it('wraps after replacing the final match and preserves one-step undo', () => {
    editor.setContent('cat cat'); navigation.openFind(); input('findText', 'cat'); input('replaceText', 'dog');
    click('findPrevious'); click('replaceOne');
    expect(editor.getContent()).toBe('cat dog'); expect(editor.getSelection()).toEqual({ start: 0, end: 3 });
    editor.undo(); expect(editor.getContent()).toBe('cat cat');
  });
  it('preserves source offsets after Unicode characters and treats patterns/replacements literally', () => {
    editor.setContent('İ before a.b A.B'); navigation.openFind(); input('findText', 'a.b'); input('replaceText', '$&'); click('replaceAll');
    expect(editor.getContent()).toBe('İ before $& $&');
    editor.undo(); expect(editor.getContent()).toBe('İ before a.b A.B');
  });
  it('keeps empty and no-match replacements harmless', () => {
    editor.setContent('unchanged'); navigation.openFind(); click('replaceAll'); input('findText', 'absent'); click('replaceOne');
    expect(editor.getContent()).toBe('unchanged');
  });
});
