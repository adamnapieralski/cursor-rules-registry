import * as assert from 'assert';
import * as path from 'path';
import { deriveRuleId, getRuleSource } from '../ruleId';

describe('ruleId helper', () => {
  it('getRuleSource for team', () => {
    assert.strictEqual(getRuleSource('Asset Foundations'), 'assetfoundations');
  });

  it('getRuleSource for user email', () => {
    assert.strictEqual(getRuleSource(undefined, 'john.doe@example.com'), 'johndoe');
  });

  it('deriveRuleId for team rule', () => {
    const fp = path.join('some', 'dir', 'foo-bar.mdc');
    const id = deriveRuleId(fp, 'Asset Foundations');
    assert.strictEqual(id, 'foo-bar.assetfoundations');
  });

  it('deriveRuleId for user rule', () => {
    const fp = '/abs/path/clock.mdc';
    const id = deriveRuleId(fp, undefined, 'alice.smith@company.com');
    assert.strictEqual(id, 'clock.alicesmith');
  });

  it('deriveRuleId without source', () => {
    const fp = 'only-file.mdc';
    assert.strictEqual(deriveRuleId(fp), 'only-file');
  });
}); 