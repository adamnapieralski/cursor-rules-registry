import * as assert from 'assert';
import { getRulePreview, getContentSnippets } from '../mdcParser';

describe('mdcParser utilities', () => {
  it('getRulePreview returns first 3 lines by default', () => {
    const content = `Line1\nLine2\nLine3\nLine4`;
    assert.strictEqual(getRulePreview(content), 'Line1\nLine2\nLine3');
  });

  it('getRulePreview with custom lines', () => {
    const content = `A\nB\nC`;
    assert.strictEqual(getRulePreview(content, 2), 'A\nB');
  });

  it('getContentSnippets returns snippets containing search term', () => {
    const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla sit amet lorem.';
    const snippets = getContentSnippets(content, 'amet', 1);
    assert.ok(snippets.length === 1 && snippets[0].includes('amet'));
  });
}); 