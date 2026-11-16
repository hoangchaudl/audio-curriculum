Sound designer sections (2–10 and 13) of the Audio Team Naming, Folder & Delivery Standard, updated October 2026. CR means Audio Creative and MM means Audio Mix.

## 2. Key terms

Fields used in Audio file names are defined below.

| Term | Code | Definition |
| --- | --- | --- |
| Type + number | `Ep90`, `Tr1` | Product type and number (section 10). |
| TitleCode | e.g. `PAMA` | Title code from the title code list. |
| Language tag | `EN`, `JP`, `DA` | Audible only. Goes right after TitleCode. |
| Audio Creative | `CR` | Creative audio exported by the Sound Designer. |
| Audio Mix | `MM` | Final mix exported by the Audio Engineer. |
| Initial | e.g. `C` | Sessions: the assigned session owner. |
| FirstName | e.g. `Chau` | Exports: whoever exported the file. |
| Version | `v1`, `v2` | Required for exports; optional same-day session revision suffix. |
| Date | MMDD, e.g. `0126` | Sessions only: the day it was opened or last worked. |
| Sync-cut, Framelock | – | Working video from Animation, kept in `1. VIDEO`. |
| Title code list | – | Separate list of title codes, same as the studio convention's catalog. |

## 3. General naming rules

These rules apply to Audio filenames and episode session-folder names. Structural folder names, such as `1. WORK` and `1-10`, follow the folder template.

| Rule | Correct | Incorrect |
| --- | --- | --- |
| `_` separates fields | `Ep90_PAMA_CR_v1_Chau` | `Ep90-PAMA-CR-v1-Chau` |
| Latin letters, digits and `_` only; no spaces, no Vietnamese diacritics | `Ep90_PAMA_CR_v1_Chau` | `Ep 90_PAMA`, `Châu`, `(new)` |
| TitleCode exactly as in the title code list, including letter case | `PAMA` | `pama`, `Pama` |
| Type and number first, joined | `Ep90` | `Ep 90`, `EP90`, `PAMA_Ep90` |
| Version = lowercase v + whole number | `v2` | `V2`, `v1.2`, `v2b` |
| No leading zeros in number or version | `Ep9`, `v3` | `Ep009`, `v03` |
| No status words | `…_MM_v3_Duy` | `final`, `FIN`, `new`, `approved` |

Whose name goes in: sessions take the Initial of the session owner; exports take the FirstName of whoever exported, without diacritics (`Chau`, not `Châu`).

## 4. File naming

Fields appear in the order below. Square brackets mark the optional same-day session version suffix; do not type the brackets.

### Name structure

| Client | File | Pattern |
| --- | --- | --- |
| Webtoon and others | Session folder | `<Type><Number>_<TitleCode>` |
| Webtoon and others | Session | `<Type><Number>_<TitleCode>_<Stage>_<Initial>_<Date>[_<Version>]` |
| Webtoon and others | Export | `<Type><Number>_<TitleCode>_<Stage>_<Version>_<FirstName>` |
| Audible | Session folder | `<Type><Number>_<TitleCode>_<Lang>` |
| Audible | Session | `<Type><Number>_<TitleCode>_<Lang>_<Stage>_<Initial>_<Date>[_<Version>]` |
| Audible | Export | `<Type><Number>_<TitleCode>_<Lang>_<Stage>_<Version>_<FirstName>` |

| Field | Definition | Example | Condition |
| --- | --- | --- | --- |
| Type + number | Product type + episode or item number | `Ep31`, `Tr2`, `Bu1` | Always |
| TitleCode | Title code from the title code list | `PAMA` | Always |
| Lang | Language tag | `EN`, `JP`, `DA` | Audible only |
| Stage | Audio stage | `CR` (Audio Creative), `MM` (Audio Mix) | Sessions and exports |
| Initial | Initial of the session owner | `C` | Sessions only |
| Date | Day the session was opened or last worked, MMDD | `0126` | Sessions only |
| Version | Export version or same-day session revision | `v1`, `v2` | Exports always; sessions only for a same-day revision |
| FirstName | Whoever exported the file, no diacritics | `Chau` | Exports only |

### Name examples

Every field is named the same way for both clients; the only difference is that Audible adds the language tag right after the TitleCode.

| File | Webtoon and others | Audible |
| --- | --- | --- |
| Session folder | `Ep90_PAMA` | `Ep90_PAMA_EN` |
| Session Creative | `Ep90_PAMA_CR_C_0126` | `Ep90_PAMA_EN_CR_C_0126` |
| Session Mix | `Ep90_PAMA_MM_D_0126` | `Ep90_PAMA_EN_MM_D_0126` |
| Session, same-day revision | `Ep90_PAMA_CR_C_0126_v2` | `Ep90_PAMA_EN_CR_C_0126_v2` |
| Audio Creative | `Ep90_PAMA_CR_v1_Chau` | `Ep90_PAMA_EN_CR_v1_Chau` |
| Audio Mix | `Ep90_PAMA_MM_v1_Duy` | `Ep90_PAMA_EN_MM_v1_Duy` |
| Trailer, Audio Creative | `Tr1_PAMA_CR_v1_Chau` | `Tr1_PAMA_EN_CR_v1_Chau` |
| Other languages | – | `Ep90_PAMA_JP_CR_v1_Chau`, `Ep90_PAMA_DA_MM_v1_Duy` |

PAMA (Paranoid Mage) is an example only; always copy the title code from the title code list.

## 5. Versioning

CR and MM have separate version counters for each title and item, and for each Audible language. Every new export uses the next number, regardless of who exports it. Never overwrite an exported version.

| Rule | Correct | Incorrect |
| --- | --- | --- |
| Every new export = next version, including revisions after external feedback | Export `CR_v1`, revise, export `CR_v2` | Re-export over `CR_v1` |
| Next version = highest existing for the same title, item, stage and language + 1; changing exporter does not reset it | `CR_v3_Chau` exists → next CR is `v4_Duy`; MM counts separately | Restarting CR at `v1` because the exporter changed |
| Audible: each language counts on its own | `EN_CR_v3`, `JP_CR_v1` | Bumping JP to `v3` to match EN |
| Significant same-day revision of a session: duplicate and add a version tag | `Ep90_PAMA_CR_C_0126_v2` | Overwriting `…_0126` |
| New date only when work resumes on a later day | `0126` → `0127` next day | New date for each save |

Review rounds (R1, R2) never go in names; track them in the tracker.

## 6. Pro Tools sessions

One session copy per working day, named with the date (MMDD); only the 2 newest stay in the session folder.

### Daily routine

- **New working day:** open the latest session, File > Save As with today's date. Keep working on the copy; retain the previous day's session checkpoint.
- **Significant revision on the same day:** Save As with a version tag (`_v2`) before you start, never overwrite.
- **More than 2 sessions in the folder:** move the oldest into `zARC`.

### Handoff to the Audio Engineer

Hand off an organized session ready for mixing:

- The voice timeline is synced to the framelock and dialogue levels are balanced.
- Character tracks use the correct character names.
- Music uses stems.
- Unused muted clips outside the episode Start and End are removed. Preserve required fades and tails.

Keep session audio in `Audio Files`. Use the reference video already in `1. VIDEO` and confirm the session opens without missing media; no separate video package is needed for this shared-drive handoff.

### Where to save, by OS

Pro Tools behaves differently on Drive-mounted volumes.

| OS | Rule |
| --- | --- |
| Mac | Work directly inside the drive-mounted `3. SESSION` folder. |
| Windows | Save and work locally first, then copy into `3. SESSION` once ready to hand off to the Audio Engineer. |

### Session folder contents

```
3. SESSION\a. Episode\1-10\Ep10_PAMA\
  Audio Files\
  Session File Backups\
  Ep10_PAMA_CR_C_0126.ptx
  Ep10_PAMA_CR_C_0127.ptx
  zARC\
    Ep10_PAMA_CR_C_0120.ptx
    Ep10_PAMA_CR_C_0119.ptx
    Ep10_PAMA_CR_C_0118.ptx
```

New episodes start from the Template Session Folder inside each batch folder.

## 7. Audio drive folder structure

Work happens in `1. WORK`. Internally approved exports are copied automatically to `2. DELIVERY` for other departments to collect. The Audio Lead operates the copy script in `0. ADMIN`.

```
AUDIO DEPARTMENT  (episode assets are batched; Stems is a separate branch)
├─ 0. ADMIN (read-only)
│  ├─ 1. Documents
│  ├─ 2. Scripts
│  └─ 3. Logs
├─ 1. WORK  (access by client group)
│  └─ <Partner>  (AUDIBLE, MYTHIC, WEBTOON)
│     └─ <Title>
│        ├─ 1. VIDEO  (I. Sync-cut, II. Framelock)
│        ├─ 2. VOICE TIMELINE
│        ├─ 3. SESSION  (Ep10_PAMA, zARC)
│        ├─ 4. AUDIO CREATIVE  → copied to 2. DELIVERY
│        ├─ 5. AUDIO MIX  (final mixes by format/language; Stems)  → copied to 2. DELIVERY
│        └─ 6. RESOURCE
├─ 2. DELIVERY  (latest version only)
│  └─ <Partner>\<Title>
│     ├─ 1. Audio Creative
│     ├─ 2. Final Mix
│     ├─ 3. Stems (when present)
│     └─ History  (older versions, moved by script)
├─ 3. TRAINING
└─ 4. ARCHIVE
```

| Root | Subfolders | What goes here | Access |
| --- | --- | --- | --- |
| `0. ADMIN` | `1. Documents` | Audio sheets and docs: sound designer onboarding, audio production process, this standard | Read-only for the audio team; only Audio Lead and Production Manager edit |
| `0. ADMIN` | `2. Scripts` | Automation sheet that moves older versions to History and copies `4.` and `5.` exports to `2. DELIVERY` | Read-only; Audio Lead and Production Manager edit |
| `0. ADMIN` | `3. Logs` | Automation logs, to check for script errors | Read-only; Audio Lead and Production Manager edit |
| `1. WORK` | `AUDIBLE`, `MYTHIC`, `WEBTOON` | Main working folder: one folder per title, six folders inside (below) | Per client group: only sound designers working on that client |
| `2. DELIVERY` | `AUDIBLE`, `WEBTOON` | Internally approved CR and MM exports for collection and external feedback; stems in `3. Stems` when present. Superseded versions move to History. | Other departments collect here |
| `3. TRAINING` | – | Training materials | Audio team |
| `4. ARCHIVE` | – | Trailer archive and past backups uploaded by the team | Audio team |

Inside each title folder in `1. WORK`, every title gets the same six folders from the template; Webtoon titles split them by format, Audible titles by language.

### How folders 1 to 5 split

| Partner | Split by | Subfolders |
| --- | --- | --- |
| Webtoon and others | Format | `a. Episode`, `b. Trailer`, `c. Short Animation`, `d. Bumper` |
| Audible | Language | `EN`, `JP`, `DA` (one folder per language in production) |

### Inside the title folder

- `1. VIDEO\<format or language>\<batch>` holds `I. Sync-cut` and `II. Framelock`.
- Episode assets in folders 1–5 are grouped in batches of 10 (`1-10`, `11-20`) inside each format or language folder. Stems under `5. AUDIO MIX` and `6. RESOURCE` are separate, unbatched branches. Each session batch holds one folder per episode and a Template Session Folder.
- `5. AUDIO MIX\<format or language>\<batch>` holds final stereo mixes. `5. AUDIO MIX\Stems` holds stems when provided; the script copies these to `2. DELIVERY\<Partner>\<Title>\3. Stems`.
- `6. RESOURCE` holds `a. Mixing Note`, `b. Intro Outro`, `c. Voice Preset`, `d. Music & SFX`, `e. Others`.
- Tentative: `2. VOICE TIMELINE` takes the voice timeline from the Story Producer's delivery folder / shared drive. No Audio folder is linked to a POD drive.

### Folder rules

| Rule | Correct | Incorrect |
| --- | --- | --- |
| Two zones: `1. WORK` for the audio team, `2. DELIVERY` for other departments to collect from | Story Producer, Animator collects the Audio Mix from `2. DELIVERY` | Story Producer waits for the file on Slack, or gets a copy by email |
| Paths come from the template, the partner and the title | `Ep10_PAMA_CR_v1_Chau.wav` is in `1. WORK\WEBTOON\Paranoid Mage\4. AUDIO CREATIVE\a. Episode\1-10` | Self-made `WIP`, `Old`, `Final` folders |
| Split episode assets in folders 1–5 by format (Webtoon) or language (Audible); Stems is a separate branch | `4. AUDIO CREATIVE\JP` for an Audible title | `4. AUDIO CREATIVE\a. Episode` for an Audible title |
| Export only to `4.` and `5.`; the script copies to `2. DELIVERY` | Export to `5. AUDIO MIX`; the script copies the mix to `2. DELIVERY\WEBTOON\Paranoid Mage\2. Final Mix` | Export to the desktop, then drag into `2. DELIVERY` |
| One source file in WORK and one script-managed copy in DELIVERY | Mix source in `5. AUDIO MIX`; script-managed copy in the title's `Delivery\2. Final Mix` folder | Extra copies in a POD drive, a personal folder or a chat |
| DELIVERY shows the latest export for each item, stage and language; superseded versions move to History automatically | `2. DELIVERY\WEBTOON\Paranoid Mage\2. Final Mix` holds `Ep90_PAMA_MM_v3_Duy`; `v2` is in the title's History folder | All older versions piled into one folder |
| Keep the 2 newest sessions outside; older ones go to `zARC` | `0126`, `0127` outside; `0120` in `zARC` | Six sessions piled in one folder |
| No manual title folders: copy the template | New title → copy the template into `1. WORK\<Partner>` | Self-made `Ep_31` or `New Title` folders |
| Folders that hold files are never renamed | Title misspelled: keep the folder, tell the Audio Lead | Renaming a title folder after work started |
| Batch episode assets in folders 1–5; keep Stems and `6. RESOURCE` separate | `4. AUDIO CREATIVE\a. Episode\11-20\Ep12_PAMA_CR_v1_Chau.wav` | All episodes loose in one folder, or batching only `3. SESSION` |
| Access by group, never by person | Add a sound designer to `audible-audio@` | Share `1. WORK\AUDIBLE` with one email |

## 8. Handoff flow

Internal approval happens before export. The script copies CR and MM exports to Delivery, where Animator collects the audio to combine with video for external feedback. After revisions are internally approved, bounce a new version; the script moves the superseded Delivery file to History.

### In: what Audio collects

| File | Collect from | Save to (in `1. WORK\<Partner>\<Title>`) | Used by |
| --- | --- | --- | --- |
| Sync-cut | Story Producer drive `\<Title>\1. Sync-cut` | `1. VIDEO\<format or language>\<batch>\I. Sync-cut` | Sound Designer |
| Framelock | Animator drive `DELIVERY\<Partner>\<Title>\<Type>\<Item>` (latest version only) | `1. VIDEO\<format or language>\<batch>\II. Framelock` | Sound Designer, Audio Engineer |
| Voice timeline (AAF) | Story Producer delivery folder / shared drive (tentative) | `2. VOICE TIMELINE\<format or language>\<batch>` | Sound Designer |

### Out: what Audio delivers

| File | Export to (in `1. WORK\<Partner>\<Title>`) | Copied by script to | Used by |
| --- | --- | --- | --- |
| Audio Creative (CR) | `4. AUDIO CREATIVE\<format or language>\<batch>` | `2. DELIVERY\<Partner>\<Title>\1. Audio Creative` | Animator combines with video for external feedback; Story Producer collects |
| Audio Mix (MM) | `5. AUDIO MIX\<format or language>\<batch>` | `2. DELIVERY\<Partner>\<Title>\2. Final Mix` | Animator, Story Producer, Rita, Jimmy, Minh Vũ |
| Stems | `5. AUDIO MIX\Stems` | `2. DELIVERY\<Partner>\<Title>\3. Stems` (when provided) | Delivery, partner |

### Final mix format

Final mixes are stereo, 24-bit, 48 kHz, -14 LUFS, -1 dBTP.

### Rules

- Before you start or conform, check the framelock in the Animator drive's DELIVERY: it only holds the latest version, older ones move to History.
- Never export straight to `2. DELIVERY` and never copy into it by hand: that creates duplicates.
- Name the file correctly before export; renaming after the copy leaves the old name in Delivery.
- If a file is missing from Delivery, check its name and export folder, then notify the Audio Lead. The Audio Lead checks the script, scheduled runs, access and logs, resolves the failure, and confirms delivery.
- Each title in Delivery has three sibling folders: `1. Audio Creative` for CR, `2. Final Mix` for MM, and `3. Stems` for stems. Only the latest export for each item, stage and language remains in its delivery folder; superseded files move to the title's History folder. Example: `2. DELIVERY\WEBTOON\Star Catcher\3. Stems`.

## 9. Access control and responsibilities

Access is granted by group, never by person: sound designers see only the clients they work on, and other departments only see `2. DELIVERY`.

### Groups

| Group | Members | Example |
| --- | --- | --- |
| `audio@` | Everyone on the Audio team | `audio@` |
| `<partner>-audio@` | Sound designers and audio engineers working on that partner's titles | `audible-audio@`, `webtoon-audio@` |
| `<partner>@` | Studio partner group: animators, Story Producers, Art Editors, Sound Designers on that partner | `audible@` |
| `production@` | Rita, Jimmy (Viewer on `2. DELIVERY`); automation execution account is confirmed separately | `production@` |

### Permissions

Permissions use Google Drive's roles: sound designers are Content manager where they work, everyone collecting files is Viewer, and only the Audio Lead and Production Manager are Manager.

| Person | `0. ADMIN` | `1. WORK\<Partner>` | `2. DELIVERY\<Partner>` | `3. TRAINING` | `4. ARCHIVE` |
| --- | --- | --- | --- | --- | --- |
| Audio Lead, Production Manager | Manager | Manager | Manager | Manager | Manager |
| Sound designer / audio engineer on that partner (`<partner>-audio@`) | Viewer | Content manager | Viewer | Viewer | Content manager |
| Audio team member not on that partner | Viewer | No access | No access | Viewer | Content manager |
| Other departments collecting files (`<partner>@`), Rita, Jimmy | No access | No access | Viewer | No access | No access |
| Copy script account | Viewer* | Viewer | Content manager | No access | No access |

Drive note: Manager can only be given at shared-drive level, so the Audio Lead and Production Manager are the only drive members. Everyone else is added per folder through their group; anyone added at drive level would see every partner's folder.

`0. ADMIN` is read-only for the audio team. The Audio Lead and Production Manager manage it; the automation execution account also needs write access to its configured log destination.

### Responsibilities

| Asset | Owner | Handover |
| --- | --- | --- |
| Title code list | Production Manager (studio catalog) | Audio only reads it; nothing to hand over |
| Audio drive structure and title template | Audio Lead | Give the successor manager access to the drive |
| `<partner>-audio@` membership | Audio Lead | Add or remove people when assigning work; give the successor group-manager rights |
| Copy script (`0. ADMIN\2. Scripts`) | Audio Lead | Hand over script access, configuration, failure handling and maintenance notes; verify a copy run. |
| Script scheduled runs | Audio Lead | Confirm the execution account, trigger ownership and authorization; verify a scheduled run after handover. |
| `0. ADMIN\3. Logs` | Audio Lead | Audio Lead investigates delivery failures and confirms recovery; hand over access to the configured logs. |
| This standard | Audio Lead | Transfer doc ownership to the successor |

## 10. TitleCode, type codes and language tags

TitleCode comes from the title code list, type codes from the table below, and language tags apply to Audible only.

### TitleCode

Use the 4-letter code from the title code list exactly as written (e.g. Paranoid Mage → `PAMA`); never make one up. How codes are built is covered in the studio Naming & Folder Convention, section IV.1 Title Codes.

### Type codes

| Type | Code | Example |
| --- | --- | --- |
| Episode | `Ep` | `Ep10` |
| Trailer | `Tr` | `Tr1` |
| Bumper | `Bu` | `Bu1` |
| Pilot Episode (Option 1) | `PiAEp` | `PiAEp10` |
| Pilot Episode (Option 2) | `PiBEp` | `PiBEp10` |
| Sample | `Sa` | `Sa1` |

### Language tags (Audible only)

| Language | Tag | Example |
| --- | --- | --- |
| English | `EN` | `Ep90_PAMA_EN_CR_v1_Chau` |
| Japanese | `JP` | `Ep90_PAMA_JP_CR_v1_Chau` |
| Descriptive Audio | `DA` | `Ep90_PAMA_DA_CR_v1_Chau` |

The tag sits right after the TitleCode, in every Audible session, folder and export name.

## 13. Checklist and FAQ

### Export and delivery check

- [ ] Internal approval complete; reference framelock checked
- [ ] TitleCode and Audible tag match the catalog
- [ ] Correct stage: CR or MM
- [ ] Next version for this item, stage and language, regardless of exporter
- [ ] FirstName last; naming rules in section 3 followed
- [ ] Final MM: stereo, 24-bit, 48 kHz, -14 LUFS, -1 dBTP
- [ ] Exported to the correct WORK folder in `4.` or `5.`; exported file checked for sync, cutoffs and audible errors
- [ ] Latest file appears in Delivery; superseded Delivery version is in History

### FAQ

| Question | Answer |
| --- | --- |
| Can I shorten a title myself? | No. Use the TitleCode from the title code list; ask the Audio Lead if it's missing. |
| Why a language tag if Audible folders are already split by language? | Files travel: once copied to Delivery or sent to the partner, the name is the only thing that says which language it is. |
| Why not rely on Drive version history? | A filename version remains identifiable when the file travels outside Drive. Do not rely on Drive history alone to identify released exports. |
