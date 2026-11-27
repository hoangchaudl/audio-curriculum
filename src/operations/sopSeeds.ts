// Starter SOP drafts from the Miro "[Audio] Master Board" frame "03 · SOPs & HOW-TOs".
// The board only has the six titles (the cards are empty), so the steps below are a
// first draft built from the board's naming rules and pipeline: edit before publishing.
import type { OpsContent } from './model';

export interface SopSeed { title: string; summary: string; body: string; workflows: string[] }

export const SOP_SEEDS: SopSeed[] = [
  {
    title: '[Audio] Pro Tools Workflow',
    summary: 'From the episode folder to a synced, leveled session ready for Creative.',
    workflows: ['Shared'],
    body: `## Step 1: Open the episode folder
- Go to **Title Drive → b SESSION → z EP # TITLE NAME**
- E.g. **a Dickheads → b SESSION → z EP # DICKHEADS**

## Step 2: Open the template
- Double-click **EP # TITLE.ptxt** to open the template in Pro Tools
- E.g. **EP # STAR CATCHER.ptxt**

## Step 3: Save the session
- Add the episode number in front of **#** and save it in the **b SESSION** Drive folder (Mac) & in Local (Windows)
- Click **Create**

## Step 4: Download the files
- Download the Framelock video from **FrameIO Framelock** → save into **Title Working Drive → a TITLE → a VIDEO** (Mac) / Local (Windows)
- Download the **AAF / Voice Timeline** from the Drive Pod folder

## Step 5: Import the audio
**If it's an AAF:**
- Drag the whole file into Pro Tools → click **OK**
- Uncheck **Import Clip Gain** and **Import Volume Automation** on the left panel
- Make sure **Main Playlist Options** is set to **Import - Replace Existing Playlists**

![Session Data and Main Playlist Options](/sop/pro-tools/aaf-session-data.png)

- Scroll down and change **Timecode Mapping Options** to **Map start timecode to**
- Edit to **01:00:00:00**

![Timecode Mapping Options](/sop/pro-tools/aaf-timecode.png)

- Go to **Tracks** on the right panel
- Uncheck the **V1** video track on the top
- Select **all audio tracks** below and click **OK**

![Tracks: V1 off, all audio tracks to New Track](/sop/pro-tools/aaf-tracks.png)

→ Audio automatically maps to 01:00:00:00 on the session.

**If it's a Voice Timeline:**
- Unzip the file
- Drag all audio files into the designated tracks in the session (if not created yet, create a new track, drag that audio into it, and rename the track based on the character name on the audio files)

## Step 6: Import the Track Preset
Import the matching character Track Preset for the downloaded Voice Timeline:
- Windows: \`C:\\Users\\[Your Username]\\Documents\\Pro Tools\\Track Presets/Title Name\`
- Mac: \`/Users/[Your Username]/Documents/Pro Tools/Track Presets/Title Name\`

## Step 7: Duplicate playlist for backup
Create a duplicate playlist for all character lines. First select all character tracks.

**Mac**
1. Shift + OPT + click the red box name **wave** below and choose **playlists**
2. Select all audio clips while holding CMD + OPT + drag the audio clips down to the playlist line
3. Shift + OPT + click the red box name **play** below and choose **wave** → back to normal

**Windows**
1. Shift + ALT + click the red box name **Wave** below and choose **Playlist**
2. Select all audio clips while holding WIN + ALT + drag the audio clips down to the playlist line
3. Shift + ALT + click the red box name **play** below and choose **wave** → back to normal

![Click the wave box on the track](/sop/pro-tools/playlist-track.png)

![Choose playlists](/sop/pro-tools/playlist-menu.png)

## Step 8: Import the Framelock video
- Drag the video from File Explorer / Finder into the working session
- Change **Destination** → Main Video Track / New Track
- Change **Location** → **Spot**
- Check **Import audio from file**
- Click **OK**

![Video Import Options](/sop/pro-tools/video-import.png)

- Map Start Timecode to **01:00:00:00** → click **OK**

![Spot Dialog](/sop/pro-tools/spot-dialog.png)

- **Put marker START at 01:00:00:00 at the beginning and marker END at the end of the video**

## Step 9: Sync and level
- Select all character audio tracks and group them together
- Sync the Voice Timeline / AAF with the Framelock dialog line (final pacing)
- Level dialogue with iZotope RX → set up a shortcut for fast leveling
- AudioSuite → iZotope → RX 11 Mouth De-click → set parameters as in the photo below → can save it as a preset for later access → render for each line of the character (optional)

![RX Mouth De-click: Sensitivity 6.5, Click widening 2.5](/sop/pro-tools/rx-mouth-declick.png)

→ Start doing Creative for the episode.`,

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

  },
];

export const seedFields = (s: SopSeed): Partial<OpsContent> => ({
  type: 'sop', title: s.title, summary: s.summary, body: s.body,
  category: '', workflows: s.workflows, owner: '', effectiveDate: '', links: [], items: [],
});
