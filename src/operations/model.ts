// Operations workspace data model. Pure (no Firebase), so it's unit-tested.
// Kept apart from the Curriculum types on purpose: Operations access never
// reads or changes the Curriculum Role enum.

export type OpsRole = 'member' | 'editor' | 'admin';
export type OpsAccess = OpsRole | 'none';

// operationsMembers/{lowercased email}. Admin-managed; see firestore.rules.
export interface OpsMember {
  id: string; // = email
  email: string;
  name?: string;
  role: OpsRole;
  active: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export type ContentType = 'sop' | 'checklist' | 'schedule' | 'resource';
export type ContentStatus = 'draft' | 'published' | 'archived';
export interface OpsLink { label: string; url: string }

// operationsContent/{id}: one model for every section, told apart by type.
export interface OpsContent {
  id: string;
  type: ContentType;
  status: ContentStatus;
  title: string;
  summary?: string;
  body: string; // Markdown
  category?: string;
  workflows?: string[];
  owner?: string;
  effectiveDate?: string; // YYYY-MM-DD
  links?: OpsLink[];
  items?: string[]; // checklist steps
  // A draft that will replace this published document when an admin publishes it.
  revisionOf?: string;
  createdBy: string;
  createdAt?: string;
  updatedBy: string;
  updatedAt?: string;
  publishedBy?: string;
  publishedAt?: string;
}

export const WORKFLOWS = ['Shared', 'WEBTOON', 'Audible'];
export const CHECKLIST_KINDS = ['Handoff', 'Delivery'];
export const RESOURCE_KINDS = ['Session templates', 'Reference', 'Shared folders', 'Tools'];

export const SECTIONS: Record<ContentType, { path: string; label: string; singular: string; blurb: string }> = {
  sop: { path: 'sops', label: 'SOPs & Standards', singular: 'SOP', blurb: 'Standard operating procedures and quality standards.' },
  checklist: { path: 'checklists', label: 'Handoff & Delivery', singular: 'checklist', blurb: 'Checklist templates for handoffs and deliveries.' },
  schedule: { path: 'schedule', label: 'Schedule', singular: 'schedule link', blurb: 'Links to the production schedules the team already uses.' },
  resource: { path: 'resources', label: 'Resources & Templates', singular: 'resource', blurb: 'Session templates, reference material, shared folders and tools.' },
};
export const TYPE_BY_PATH = Object.fromEntries(Object.entries(SECTIONS).map(([t, s]) => [s.path, t])) as Record<string, ContentType>;

// Mirrors firestore.rules opsRoleIs(): Curriculum admins administer
// Operations; everyone else needs an active membership with a valid role
// (read by verified email, since memberships are keyed by email).
export const opsAccessFor = (curriculumRole: string | undefined, member: Partial<OpsMember> | null): OpsAccess => {
  if (curriculumRole === 'admin') return 'admin';
  if (!member || member.active !== true) return 'none';
  return member.role === 'member' || member.role === 'editor' || member.role === 'admin' ? member.role : 'none';
};
export const canEdit = (a: OpsAccess) => a === 'editor' || a === 'admin';

// Links are typed one per line as "Label | https://..." (or a bare URL).
// Only http(s) links are kept, so a stored link can never run script.
export const isHttpUrl = (s: string) => /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(s.trim());
export const parseLinks = (text: string): { links: OpsLink[]; bad: string[] } => {
  const links: OpsLink[] = [];
  const bad: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bar = line.lastIndexOf('|');
    const url = (bar >= 0 ? line.slice(bar + 1) : line).trim();
    const label = (bar >= 0 ? line.slice(0, bar) : '').trim() || url;
    if (isHttpUrl(url)) links.push({ label: label.slice(0, 200), url });
    else bad.push(line);
  }
  return { links, bad };
};
export const linksToText = (links: OpsLink[] = []) => links.map(l => (l.label && l.label !== l.url ? `${l.label} | ${l.url}` : l.url)).join('\n');
export const parseItems = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);

export interface Draft {
  title: string; summary: string; body: string; category: string; workflows: string[];
  owner: string; effectiveDate: string; linksText: string; itemsText: string;
}

// Form validation; mirrors the size limits in firestore.rules.
export const validateDraft = (type: ContentType, d: Draft): string[] => {
  const errors: string[] = [];
  if (!d.title.trim()) errors.push('Add a title.');
  if (d.title.length > 200) errors.push('Keep the title under 200 characters.');
  if (d.summary.length > 500) errors.push('Keep the summary under 500 characters.');
  if (d.body.length > 100000) errors.push('The content is too long.');
  if (d.effectiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.effectiveDate)) errors.push('Effective date must be a date.');
  const { links, bad } = parseLinks(d.linksText);
  if (bad.length) errors.push(`These links need a full http(s) address: ${bad.join(', ')}`);
  if (links.length > 50) errors.push('Use 50 links or fewer.');
  const items = parseItems(d.itemsText);
  if (type === 'checklist' && items.length === 0) errors.push('Add at least one checklist item.');
  if (items.length > 200 || items.some(i => i.length > 500)) errors.push('Use up to 200 checklist items of 500 characters each.');
  if ((type === 'schedule' || type === 'resource') && links.length === 0) errors.push('Add at least one link.');
  return errors;
};

// The content fields a save writes (authorship/status are added by the caller).
export const draftFields = (type: ContentType, d: Draft) => {
  const fields: Record<string, unknown> = {
    type, title: d.title.trim(), summary: d.summary.trim(), body: d.body,
    category: d.category.trim(), workflows: d.workflows, owner: d.owner.trim(),
    effectiveDate: d.effectiveDate, links: parseLinks(d.linksText).links,
    items: type === 'checklist' ? parseItems(d.itemsText) : [],
  };
  return fields;
};

export const draftOf = (c?: OpsContent): Draft => ({
  title: c?.title ?? '', summary: c?.summary ?? '', body: c?.body ?? '', category: c?.category ?? '',
  workflows: c?.workflows ?? [], owner: c?.owner ?? '', effectiveDate: c?.effectiveDate ?? '',
  linksText: linksToText(c?.links), itemsText: (c?.items ?? []).join('\n'),
});

export const byUpdatedDesc = (a: OpsContent, b: OpsContent) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');

export const matchesFilters = (c: OpsContent, f: { q: string; category: string; workflow: string; status: string }) =>
  (!f.q || c.title.toLowerCase().includes(f.q.toLowerCase())) &&
  (!f.category || c.category === f.category) &&
  (!f.workflow || (c.workflows ?? []).includes(f.workflow)) &&
  (!f.status || c.status === f.status);

// Hash routes: #/, #/sops, #/sops/<id>, #/edit/<id>, #/new/<type>, #/access.
export type Route =
  | { page: 'home' } | { page: 'access' }
  | { page: 'list'; type: ContentType }
  | { page: 'detail'; type: ContentType; id: string }
  | { page: 'edit'; id: string }
  | { page: 'new'; type: ContentType };
export const parseRoute = (hash: string): Route => {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'access') return { page: 'access' };
  if (parts[0] === 'edit' && parts[1]) return { page: 'edit', id: parts[1] };
  if (parts[0] === 'new' && parts[1] && parts[1] in SECTIONS) return { page: 'new', type: parts[1] as ContentType };
  const type = TYPE_BY_PATH[parts[0]];
  if (type) return parts[1] ? { page: 'detail', type, id: parts[1] } : { page: 'list', type };
  return { page: 'home' };
};

// Personal checklist ticks live only in this browser. Stored as item
// indexes (no content), keyed by account + document version, so an edited
// checklist starts fresh and nothing protected is left in storage.
export const checklistKey = (uid: string, c: Pick<OpsContent, 'id' | 'updatedAt'>) => `opsChecklist:${uid}:${c.id}:${c.updatedAt ?? ''}`;
