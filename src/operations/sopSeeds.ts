// Starter SOP drafts from the Miro "[Audio] Master Board" frame "03 · SOPs & HOW-TOs".
// The board only has the six titles (the cards are empty), so the steps below are a
// first draft built from the board's naming rules and pipeline: edit before publishing.
import type { OpsContent } from './model';

export interface SopNode { text: string; decision?: boolean; no?: string }
export interface SopSeed { title: string; summary: string; body: string; workflows: string[]; nodes: SopNode[] }

const W = 220, H = 70, GAP = 60;
let seq = 0;
const base = (type: string, x: number, y: number, w: number, h: number) => ({
  id: `sop${++seq}`, type, x, y, width: w, height: h, angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent',
  fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [], frameId: null,
  roundness: null, seed: seq * 7919, version: 1, versionNonce: seq * 104729, isDeleted: false, boundElements: null,
  updated: 1, link: null, locked: false,
});
const label = (text: string, x: number, y: number, w: number, h: number, size = 16) => ({
  ...base('text', x, y, w, h), text, originalText: text, fontSize: size, fontFamily: 5, textAlign: 'center',
  verticalAlign: 'middle', containerId: null, autoResize: false, lineHeight: 1.25,
});
const arrow = (x: number, y: number, dx: number, dy: number) => ({
  ...base('arrow', x, y, Math.abs(dx), Math.abs(dy)), points: [[0, 0], [dx, dy]], lastCommittedPoint: null,
  startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: 'arrow', elbowed: false,
});

// A top-to-bottom flowchart; a node with `no` gets a side branch to the right.
export const buildDiagram = (nodes: SopNode[]): string => {
  const els: unknown[] = [];
  nodes.forEach((n, i) => {
    const y = i * (H + GAP);
    const d = !!n.decision;
    els.push({ ...base(d ? 'diamond' : 'rectangle', 0, y, W, H), backgroundColor: d ? '#ffec99' : '#a5d8ff', roundness: d ? null : { type: 3 } });
    els.push(label(n.text, 10, y + 8, W - 20, H - 16, d ? 13 : 15));
    if (i < nodes.length - 1) els.push(arrow(W / 2, y + H, 0, GAP));
    if (n.no) {
      els.push(arrow(W, y + H / 2, GAP, 0));
      els.push(label('No', W + 12, y + H / 2 - 24, 40, 20, 14));
      els.push({ ...base('rectangle', W + GAP, y, W, H), backgroundColor: '#ffc9c9', roundness: { type: 3 } });
      els.push(label(n.no, W + GAP + 10, y + 8, W - 20, H - 16, 15));
    }
  });
  return JSON.stringify({ elements: els });
};

export const SOP_SEEDS: SopSeed[] = [
  {
    title: 'Pro Tools Workflow SOP',
    summary: 'From opening the session to a named, delivered export.',
    workflows: ['Shared'],
    body: `## When to use
Every time you start, continue or deliver a Pro Tools session.

## Steps
1. Open the session from the shared episode folder (never from a local copy of someone else's work).
2. Name the session \`<Type><Number>_<TitleCode>_<Lang>_<Stage>_<Initial>_<MMDD>[_v2]\`. The date goes on sessions only.
3. Check the video/picture version matches the latest locked picture.
4. Work and save often. Save a new version (\`_v2\`) instead of overwriting after major changes.
5. Export as \`.wav\` named \`<Type><Number>_<TitleCode>_<Lang>_<Stage>_<Version>_<FirstName>\`.
6. Never overwrite an export. Bump the version.
7. Copy the export to the shared drive and post the handoff.

## Rules
- Underscores, Latin letters and digits only.
- No "final", "new" or status words in filenames.
- Language comes immediately after the title code.`,
    nodes: [
      { text: 'Open session from shared episode folder' }, { text: 'Name session per pattern' },
      { text: 'Picture matches latest lock?', decision: true, no: 'Re-pace first (see Picture re-pace)' },
      { text: 'Work and save versions' }, { text: 'Export .wav with next version' }, { text: 'Copy to shared drive and hand off' },
    ],
  },
  {
    title: 'Google Drive Setup Guide (Mac & Windows)',
    summary: 'Install Google Drive for desktop and get the shared drive available offline.',
    workflows: ['Shared'],
    body: `## When to use
First day on the team, or after a new laptop.

## Mac
1. Install **Google Drive for desktop** and sign in with your work account.
2. Open Drive preferences, then Google Drive, and choose **Mirror files** for the audio shared drive folders you work in.
3. Confirm the drive appears in Finder under Locations.

## Windows
1. Install **Google Drive for desktop** and sign in with your work account.
2. Under Preferences, set the same folders to **Mirror files**.
3. Confirm the drive appears as a letter in File Explorer.

## Check
Create a test file in the shared drive and confirm a teammate can see it.`,
    nodes: [
      { text: 'Install Drive for desktop' }, { text: 'Sign in with work account' }, { text: 'Mirror the audio shared folders' },
      { text: 'Drive visible in Finder / Explorer?', decision: true, no: 'Restart Drive, then ask Ops' }, { text: 'Test file seen by a teammate' },
    ],
  },
  {
    title: 'Local to Shared Drive sync',
    summary: 'How work done locally gets onto the shared drive safely.',
    workflows: ['Shared'],
    body: `## When to use
After finishing a session or export that lives on your local disk.

## Steps
1. Work locally while recording or mixing; large sessions run faster off the network.
2. Before syncing, close Pro Tools and confirm the session name follows the naming pattern.
3. Copy the session folder and exports to the episode's shared folder (copy, don't drag-move).
4. Never overwrite a teammate's newer file. If one exists, keep both and bump your version.
5. Wait for Drive to finish uploading, then check the files open from the shared drive.
6. Only then clear space locally.`,
    nodes: [
      { text: 'Close Pro Tools' }, { text: 'Check names follow pattern' }, { text: 'Copy to episode shared folder' },
      { text: 'Newer file already there?', decision: true, no: 'Keep both, bump your version' }, { text: 'Wait for upload to finish' }, { text: 'Verify opens from shared drive' },
    ],
  },
  {
    title: 'Picture re-pace procedure',
    summary: 'What to do when the picture changes after audio work has started.',
    workflows: ['WEBTOON', 'Audible'],
    body: `## When to use
The video team delivers a new picture lock and audio is already in progress (the "picture changed" loop).

## Steps
1. Get the new locked picture and a change list from the video team.
2. Save the current session as a new version before touching it.
3. Import the new picture and conform the session to it.
4. Re-check sync on dialogue, key effects and music hits; fix drift.
5. Re-export with a new version number; never overwrite.
6. Tell the producer which version replaces which.

## Escalate
If the change is large enough to threaten the deadline, use the escalation decision tree.`,
    nodes: [
      { text: 'New picture lock received' }, { text: 'Save session as new version' }, { text: 'Import picture and conform' },
      { text: 'Sync holds everywhere?', decision: true, no: 'Fix drift, then re-check' }, { text: 'Export next version' }, { text: 'Tell producer what replaces what' },
    ],
  },
  {
    title: 'Session templates',
    summary: 'Which template to start from and how to set a new session up.',
    workflows: ['Shared'],
    body: `## When to use
Starting any new episode session.

## Steps
1. Pick the template for the type: **CR** (creative) or **MM** (mix/master).
2. Copy the template into the episode folder; never edit the template itself.
3. Rename the copy per the session pattern.
4. Confirm sample rate, tracks and routing match the template notes.
5. Report template problems to the editor so the master template is fixed once.`,
    nodes: [
      { text: 'Choose CR or MM template' }, { text: 'Copy into episode folder' }, { text: 'Rename per session pattern' },
      { text: 'Settings match template notes?', decision: true, no: 'Report problem to editor' }, { text: 'Start work' },
    ],
  },
  {
    title: 'Escalation decision trees',
    summary: 'Who to tell, and when, if something threatens delivery.',
    workflows: ['Shared'],
    body: `## When to use
A blocker, late asset or quality problem you can't resolve yourself.

## Steps
1. Try the relevant SOP first.
2. If it is still blocked, post in the team channel with the episode, the problem and the deadline.
3. If there is no answer or it affects the deadline, message the producer directly.
4. If the delivery date will move, the producer informs the client contact.
5. Write down the outcome so the SOP can be improved.

Fill in the real names and response times for your team.`,
    nodes: [
      { text: 'Blocked or at risk?' }, { text: 'SOP solves it?', decision: true, no: 'Post in team channel' },
      { text: 'Answer within agreed time?', decision: true, no: 'Message producer directly' },
      { text: 'Delivery date moves?', decision: true, no: 'Carry on, log outcome' }, { text: 'Producer informs client' },
    ],
  },
];

export const seedFields = (s: SopSeed): Partial<OpsContent> => ({
  type: 'sop', title: s.title, summary: s.summary, body: s.body, diagram: buildDiagram(s.nodes),
  category: '', workflows: s.workflows, owner: '', effectiveDate: '', links: [], items: [],
});
