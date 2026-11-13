# StoryCo Audio Operations

A separate workspace at **`/operations/`**, next to the Audio Training Program (`/`).
It shares the Firebase project and sign-in session, nothing else: its own entry
(`operations/index.html` → `src/operations/`), navigation, state, listeners,
access checks and Firestore collections. The Training Program never downloads it.

Pages (hash routes, so refresh and back/forward work): Home `#/`, SOPs & Standards
`#/sops`, Handoff & Delivery `#/checklists`, Schedule `#/schedule`, Resources &
Templates `#/resources`, Access `#/access` (admins).

## Access model

| Who | Operations access |
| --- | --- |
| Training Program `admin` | Operations admin, automatically |
| Anyone else | Only with an active `operationsMembers/{email}` membership |

Membership roles: `member` reads published content; `editor` also creates and edits
drafts; `admin` also publishes, archives, edits live content and manages access.
No other Training Program role (trainee, engineer, reviewer, leadership) grants
anything, and a membership never changes or adds Training Program access.

A membership counts only when the person is signed in with that **verified** email.
No Training Program account is needed: Operations-only staff create an account on the
`/operations/` sign-in page (name, email, password) and verify their email. Such an
account has no `users/{uid}` profile, so it reads nothing in the Training Program
(which shows its usual "No invite" screen). Memberships are keyed by lowercased email
(not uid) so admins can grant access before the account exists, without reading the
private user roster - the same verified-email check invites use.

Content lives in `operationsContent/{id}` (`type`: sop / checklist / schedule /
resource, `status`: draft / published / archived). Editors can never change a
published or archived document; to update one they create a revision draft
("Propose changes"), which an admin publishes over the original in one atomic write.

### Granting access (admin)

1. Open `/operations/#/access` (Training Program admins see **Access** in the sidebar).
2. Enter the person's email, an optional name, and a role. **Grant access**.
   The person then signs in at `/operations/` - or uses **Create an account** there -
   and verifies their email. Granting first or signing up first both work.
3. Change a role with the dropdown; **Revoke** removes access immediately (open
   sessions lose it live); **Restore** gives it back.

The first Operations admins are Training Program admins; they can grant `admin` to others.

## Release steps (not done by this change)

Run from a machine with Editor/Owner access to the Firebase project, after review:

1. `npm ci && npm run lint && npm test && npm run test:rules && npm run build`
2. `firebase deploy --only firestore:rules` - adds the `operationsMembers` and
   `operationsContent` rules; existing Training Program rules are unchanged.
3. No index deploy needed: Operations queries are single-field (`status ==
   'published'`), which Firestore indexes automatically. `firestore.indexes.json` is unchanged.
4. `firebase deploy --only hosting` - ships `dist/operations/` plus the new
   `/operations` rewrite (placed before the catch-all).
5. Sign in at `/operations/` as a Training Program admin and grant the first memberships.

Rollback: redeploy the previous hosting release; the extra rules are inert without the page.

## Local testing

`npm run test:rules` runs the Operations rules tests (`tests/operations.rules.test.mjs`)
with the existing ones against the emulator (demo project, fake accounts).

To click through the app locally without touching real data, put
`VITE_FIREBASE_EMULATORS=true` in `.env.local` (gitignored), start the Auth and
Firestore emulators under `--project demo-audio-curriculum`, and create test
accounts there. With the variable unset (every real build), `src/firebase.ts`
behaves exactly as before.

## Not in this phase

Episode-specific tracking and reporting, shared checklist completion records, file
uploads, a calendar, a link from the Training Program to Operations, and changes to
the Training Program invite flow. (Trainees and other Training Program users granted
Operations access keep their Training Program access as before.)
