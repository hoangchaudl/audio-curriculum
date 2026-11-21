import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assignedEmails, buildFilename, draftFields, draftOf, namingTokens, parseRoute, validateDraft, workshopVideoId, type OpsContent } from './model';
import { translate } from './translations';
import { LanguageProvider } from './language';
import { NamingBuilder } from './NamingBuilder';
import { DetailPage, HomePage } from './pages';

const title = {
  id: 'title', type: 'naming', status: 'published', title: 'A Vietnamese Title', body: '',
  namingCode: 'TEST', namingPattern: '{title}_EP{episode}_{version}.{extension}', assignees: 'member@story.co',
  createdBy: 'admin', updatedBy: 'admin',
} satisfies OpsContent;
const content = (items: OpsContent[]) => ({ items, loaded: true, error: null });
afterEach(() => vi.unstubAllGlobals());

describe('workshops', () => {
  it('accepts common YouTube formats and rejects lookalike hosts and malformed IDs', () => {
    for (const url of ['https://youtu.be/dQw4w9WgXcQ?t=12', 'https://www.youtube.com/watch?si=x&v=dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'https://youtube.com/live/dQw4w9WgXcQ']) expect(workshopVideoId(url)).toBe('dQw4w9WgXcQ');
    for (const url of ['https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'https://youtu.be/short', 'https://youtube.com/playlist?list=123']) expect(workshopVideoId(url)).toBeNull();
  });
  it('requires a real video and keeps the existing draft flow', () => {
    const d = draftOf(); d.title = 'Workshop';
    expect(validateDraft('workshop', d)).toContain('Add at least one valid YouTube video link.');
    d.linksText = 'Recording | https://youtu.be/dQw4w9WgXcQ';
    expect(validateDraft('workshop', d)).toEqual([]);
    expect(draftFields('workshop', d)).toMatchObject({ type: 'workshop', links: [{ label: 'Recording', url: 'https://youtu.be/dQw4w9WgXcQ' }] });
    expect(parseRoute('#/workshops')).toEqual({ page: 'list', type: 'workshop' });
  });
  it('embeds only approved hosts and retains a YouTube fallback link', () => {
    const workshop: OpsContent = { ...title, type: 'workshop', links: [{ label: 'Recording', url: 'https://youtu.be/dQw4w9WgXcQ' }, { label: 'Other', url: 'https://evil.example/video' }] };
    const html = renderToStaticMarkup(<DetailPage id="title" uid="member" access="member" content={content([workshop])} />);
    expect(html).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(html.match(/<iframe/g)).toHaveLength(1);
    expect(html).toContain('Watch on YouTube');
    expect(html).not.toContain('>Publish<');
  });
});

describe('configurable naming', () => {
  it('extracts custom tokens once, preserves user-entered zeroes and repeats tokens', () => {
    expect(namingTokens('{title}_{character}_{episode}_{episode}')).toEqual(['title', 'character', 'episode']);
    expect(buildFilename('{title}_EP{episode}_{version}.{extension}', { title: 'TEST', episode: '003', version: 'V2', extension: 'wav' })).toBe('TEST_EP003_V2.wav');
    expect(buildFilename('{character}_{character}', { character: 'An' })).toBe('An_An');
  });
  it('rejects missing, inherited or unsafe values, unsafe templates and long output', () => {
    for (const values of [{}, { episode: '../bad' }, { episode: 'CON' }, { episode: 'bad.' }]) expect(buildFilename('EP{episode}', values)).toBeNull();
    expect(buildFilename('{constructor}', {})).toBeNull();
    expect(buildFilename('{__proto__}', {})).toBeNull();
    expect(buildFilename('../{episode}', { episode: '003' })).toBeNull();
    expect(buildFilename('{episode}/{title}', { episode: '003', title: 'TEST' })).toBeNull();
    expect(buildFilename('{broken', {})).toBeNull();
    expect(buildFilename('{a}_{b}_{c}', { a: 'a'.repeat(100), b: 'b'.repeat(100), c: 'c'.repeat(100) })).toBeNull();
  });
  it('validates title configuration and normalizes email assignments', () => {
    const d = draftOf(title); d.assignees = ' Member@Story.co \nmember@story.co\n other@story.co';
    expect(validateDraft('naming', d)).toEqual([]);
    expect(assignedEmails(d.assignees)).toEqual(['member@story.co', 'other@story.co']);
    expect(draftFields('naming', d)).toMatchObject({ namingCode: 'TEST', assignees: 'member@story.co\nother@story.co' });
    expect(validateDraft('naming', { ...d, namingPattern: '', assignees: 'invalid' })).toHaveLength(2);
    expect(draftOf({ ...title, namingPattern: '{title}_{character}' }).namingPattern).toBe('{title}_{character}');
    expect(parseRoute('#/naming')).toEqual({ page: 'naming' });
    expect(parseRoute('#/new/naming')).toEqual({ page: 'new', type: 'naming' });
  });
  it('shows only published titles assigned to the signed-in email', () => {
    const items: OpsContent[] = [title, { ...title, id: 'other', title: 'Other title', assignees: 'other@story.co' }, { ...title, id: 'draft', title: 'Draft title', status: 'draft' }];
    const html = renderToStaticMarkup(<NamingBuilder email="MEMBER@story.co" access="member" content={content(items)} />);
    expect(html).toContain(title.title);
    expect(html).not.toContain('Other title');
    expect(html).not.toContain('Draft title');
    expect(html).not.toContain('Manage title assignments');
    expect(html).not.toContain('Copy filename');
    const empty = renderToStaticMarkup(<NamingBuilder email="unassigned@story.co" access="member" content={content(items)} />);
    expect(empty).toContain('No titles are assigned');
  });
});

describe('Vietnamese interface', () => {
  it('translates text with parameters while preserving literal naming tokens and unknown content', () => {
    expect(translate('vi', 'Home')).toBe('Trang chủ');
    expect(translate('en', 'Home')).toBe('Home');
    expect(translate('vi', 'Nothing in {section} yet.', { section: 'Workshop' })).toBe('Chưa có nội dung trong Workshop.');
    expect(translate('vi', 'The value substituted for {title} in the filename.')).toContain('{title}');
    expect(translate('vi', 'My original document')).toBe('My original document');
  });
  it('renders Vietnamese navigation and empty states without changing document titles', () => {
    vi.stubGlobal('localStorage', { getItem: () => 'vi' });
    const home = renderToStaticMarkup(<LanguageProvider><HomePage access="member" content={content([])} /></LanguageProvider>);
    expect(home).toContain('Phân công tựa phim');
    expect(home).toContain('Mở công cụ tạo tên file');
    expect(home).toMatch(/Chào buổi (sáng|chiều|tối)/);
    expect(home).toContain('Liên kết nhanh');
    expect(home).toContain('6 mục');
    const naming = renderToStaticMarkup(<LanguageProvider><NamingBuilder email="member@story.co" access="member" content={content([title])} /></LanguageProvider>);
    expect(naming).toContain('Tựa phim phụ trách');
    expect(naming).toContain(title.title);
    expect(naming).toContain('{title}_EP{episode}_{version}.{extension}');
  });
});
