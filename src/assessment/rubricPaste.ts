// Turns a rubric table pasted from Word, Google Docs/Sheets or a web page
// into criteria. Expected columns, left to right:
//   Criterion | [learning outcome / ILO] | [weighting] | 5 score descriptions
// A first row whose weighting isn't a number (or that starts with
// "criteria") is the header; its last five cells name the score bands.

export interface PastedCriterion { title: string; outcome?: string; weight?: number; levels: string[] }
export interface PastedRubric { criteria: PastedCriterion[]; bands?: string[] }

const clean = (s: string) => s.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const asWeight = (s: string) => {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*%?$/);
  return m ? Number(m[1]) : undefined;
};

// Tab-separated text (Sheets/Excel). Cells with line breaks come quoted.
export const tsvRows = (text: string): string[][] => {
  const rows: string[][] = [[]];
  let cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === '\t') { rows[rows.length - 1].push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      rows[rows.length - 1].push(cell); cell = ''; rows.push([]);
    } else cell += ch;
  }
  rows[rows.length - 1].push(cell);
  return rows.filter(r => r.some(c => c.trim()));
};

// The first <table> in pasted HTML (Word, Docs, web pages), row by row.
export const htmlTableRows = (html: string): string[][] => {
  const table = new DOMParser().parseFromString(html, 'text/html').querySelector('table');
  if (!table) return [];
  return [...table.querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('td, th')].map(td => {
    // Keep paragraph breaks inside a cell.
    td.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    td.querySelectorAll('p, li, div').forEach(p => p.append('\n'));
    return (td.textContent ?? '');
  })).filter(r => r.some(c => c.trim()));
};

export const parseRubricRows = (raw: string[][]): PastedRubric | null => {
  const rows = raw.map(r => r.map(clean)).filter(r => r.length >= 6);
  if (!rows.length) return null;
  // Column layout from the widest row: 8 = with ILO and weighting, 7 = weighting only, 6 = neither.
  const width = Math.max(...rows.map(r => r.length));
  const hasOutcome = width >= 8;
  const hasWeight = width >= 7;
  const weightCol = hasOutcome ? 2 : 1;
  const isHeader = (r: string[]) => /^(assessment\s+)?criteri/i.test(r[0]) || (hasWeight && asWeight(r[weightCol]) === undefined && !/\d/.test(r[weightCol]));
  const header = isHeader(rows[0]) ? rows[0] : null;
  const body = header ? rows.slice(1) : rows;
  const criteria = body.filter(r => r[0]).map(r => ({
    title: r[0],
    ...(hasOutcome && r[1] ? { outcome: r[1] } : {}),
    ...(hasWeight && asWeight(r[weightCol]) !== undefined ? { weight: asWeight(r[weightCol]) } : {}),
    levels: r.slice(-5),
  }));
  if (!criteria.length) return null;
  return { criteria, ...(header ? { bands: header.slice(-5) } : {}) };
};
