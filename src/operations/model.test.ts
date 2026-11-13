import { describe, expect, it } from 'vitest';
import { Draft, OpsContent, checklistKey, draftFields, matchesFilters, opsAccessFor, parseLinks, parseRoute, validateDraft } from './model';

const draft = (over: Partial<Draft> = {}): Draft => ({
  title: 'T', summary: '', body: '', category: '', workflows: [], owner: '', effectiveDate: '', linksText: '', itemsText: '', ...over,
});

describe('opsAccessFor', () => {
  it('Curriculum admins administer Operations without a membership', () => {
    expect(opsAccessFor('admin', null)).toBe('admin');
  });
  it('a trainee (sound_designer) without membership has no access', () => {
    expect(opsAccessFor('sound_designer', null)).toBe('none');
  });
  it('an authorized sound designer gets exactly the granted role', () => {
    expect(opsAccessFor('sound_designer', { role: 'member', active: true })).toBe('member');
    expect(opsAccessFor('sound_designer', { role: 'editor', active: true })).toBe('editor');
  });
  it('an Operations-only account (no Training Program role) gets its granted role', () => {
    expect(opsAccessFor(undefined, { role: 'editor', active: true })).toBe('editor');
    expect(opsAccessFor(undefined, null)).toBe('none');
  });
  it('revoked or invalid memberships give no access (so content is cleared)', () => {
    expect(opsAccessFor('sound_designer', { role: 'editor', active: false })).toBe('none');
    expect(opsAccessFor('reviewer', { role: 'owner' as never, active: true })).toBe('none');
  });
});

describe('parseLinks', () => {
  it('reads "Label | url" and bare urls, rejecting non-http links', () => {
    const { links, bad } = parseLinks('Schedule | https://docs.example.com/s\nhttps://a.example.org\njavascript:alert(1)\nLabel | ftp://x.y');
    expect(links).toEqual([
      { label: 'Schedule', url: 'https://docs.example.com/s' },
      { label: 'https://a.example.org', url: 'https://a.example.org' },
    ]);
    expect(bad).toHaveLength(2);
  });
});

describe('validateDraft', () => {
  it('requires a title, checklist items and links where needed', () => {
    expect(validateDraft('sop', draft({ title: ' ' }))).toContain('Add a title.');
    expect(validateDraft('checklist', draft())).toContain('Add at least one checklist item.');
    expect(validateDraft('schedule', draft())).toContain('Add at least one link.');
    expect(validateDraft('schedule', draft({ linksText: 'Prod | https://x.example.com' }))).toEqual([]);
  });
  it('drops checklist items from non-checklists', () => {
    expect(draftFields('sop', draft({ itemsText: 'a\nb' })).items).toEqual([]);
    expect(draftFields('checklist', draft({ itemsText: ' a \n\nb' })).items).toEqual(['a', 'b']);
  });
});

describe('routes and filters', () => {
  it('parses hash routes', () => {
    expect(parseRoute('')).toEqual({ page: 'home' });
    expect(parseRoute('#/sops')).toEqual({ page: 'list', type: 'sop' });
    expect(parseRoute('#/checklists/abc')).toEqual({ page: 'detail', type: 'checklist', id: 'abc' });
    expect(parseRoute('#/edit/x%2Fy')).toEqual({ page: 'edit', id: 'x/y' });
    expect(parseRoute('#/new/resource')).toEqual({ page: 'new', type: 'resource' });
    expect(parseRoute('#/new/bogus')).toEqual({ page: 'home' });
    expect(parseRoute('#/module/lesson-1')).toEqual({ page: 'home' });
  });
  it('filters by title, category and workflow', () => {
    const c = { title: 'Mix Handoff', category: 'Mixing', workflows: ['WEBTOON'], status: 'published' } as OpsContent;
    const f = { q: '', category: '', workflow: '', status: '' };
    expect(matchesFilters(c, { ...f, q: 'handoff' })).toBe(true);
    expect(matchesFilters(c, { ...f, workflow: 'Audible' })).toBe(false);
    expect(matchesFilters(c, { ...f, category: 'Mixing', workflow: 'WEBTOON' })).toBe(true);
  });
  it('checklist ticks are per account and per version', () => {
    expect(checklistKey('u1', { id: 'c', updatedAt: 'v1' })).not.toBe(checklistKey('u2', { id: 'c', updatedAt: 'v1' }));
    expect(checklistKey('u1', { id: 'c', updatedAt: 'v1' })).not.toBe(checklistKey('u1', { id: 'c', updatedAt: 'v2' }));
  });
});
