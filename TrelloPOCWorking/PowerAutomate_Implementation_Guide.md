# Power Automate Implementation Guide
## Trello Card Completion → Placker Enrichment → SharePoint PDF

**Version:** 1.0
**Status:** Ready to Implement
**Date:** February 2026

---

## Quick Start — Import the Flow Definition

Instead of clicking through every step manually, paste `PowerAutomate_Flow_Definition.json` directly into Power Automate's code view. This creates all 11 actions at once.

### Steps

1. In Power Automate, click **+ New flow** > **Automated cloud flow**.
2. Give the flow a name, skip the trigger picker, click **Create**.
3. In the flow editor, click **...** (top-right) > **Code View**.
4. Select all existing content and replace it with the full `definition` block from `PowerAutomate_Flow_Definition.json`.
5. Click **Save**. Power Automate will build all actions.
6. Each connector step (Trello, OneDrive, SharePoint) will show a banner — click **Sign in** on each to attach your account.
7. On the Trello trigger, open the action and set **Board** and **List** (Done) from the dropdowns — this replaces the `REPLACE_WITH_TRELLO_BOARD_ID` and `REPLACE_WITH_TRELLO_DONE_LIST_ID` placeholders.
8. In the two HTTP actions and the parallel HTTP action, replace `REPLACE_WITH_PLACKER_API_KEY` and `REPLACE_WITH_PLACKER_DONE_LIST_ID` with your real values.

> **Tip:** Search the code view JSON for every `REPLACE_WITH_` string to find all tokens that need substitution. They are also listed in the `_tokens` object at the top of `PowerAutomate_Flow_Definition.json`.

After these steps, proceed to **Testing Checklist** at the bottom of this guide.

---

## Overview

When a Trello card is moved to the **Done** list, this flow:
1. Retrieves all cards in the Done list from the Placker API
2. Matches the moved card by title
3. Calls Placker for that card's comments and checklists
4. Builds a PDF completion record
5. Saves the PDF to the SharePoint folder linked in the card's description

---

## Prerequisites

Before building the flow, confirm you have:

| Item | Where to get it |
|---|---|
| Placker API Key | Placker Profile > Settings > API |
| Power Automate Premium license | Required for the HTTP connector — Settings > View My Licenses |
| Trello board admin access | Needed to configure the trigger |
| SharePoint write access | Target document library with existing customer folders |
| Placker List ID for "Done" | Run Postman Request 3 from `Placker_API_Tests.postman_collection.json` |

---

## Flow Architecture

```
[TRIGGER] Trello - When a card is added to a list (Done)
    |
    v
[ACTION 1] HTTP - Call Placker: Get all cards in Done list
    |
    v
[ACTION 2] Parse JSON - Parse Placker card array
    |
    v
[ACTION 3] Filter Array - Match card by title to Trello trigger
    |
    v
[ACTION 4] Compose - Extract matched card's Placker ID
    |
    v
[ACTION 5] HTTP - Get Comments        [ACTION 6] HTTP - Get Checklists
    |                                       |
    +-------------------+-------------------+
                        |
                        v
             [ACTION 7] Compose - Build HTML content
                        |
                        v
             [ACTION 8] Compose - Extract SharePoint URL from description
                        |
                        v
             [ACTION 9] OneDrive - Create temp HTML file
                        |
                        v
             [ACTION 10] OneDrive - Convert HTML to PDF
                        |
                        v
             [ACTION 11] SharePoint - Save PDF to customer folder
```

---

## Step-by-Step Implementation

---

### TRIGGER — Trello: When a card is added to a list

1. Click **+ New flow** > **Automated cloud flow**
2. Search for **Trello** trigger
3. Select **When a card is added to a list**
4. Configure:
   - **Board:** Select your Trello board (e.g., COED Database)
   - **List:** Select your **Done** list

> The card **Name** from this trigger is used in Action 3 to match against Placker results.

---

### ACTION 1 — HTTP: Get all cards in Done list

**Connector:** HTTP
**Action:** HTTP

| Field | Value |
|---|---|
| Method | `GET` |
| URI | `https://placker.com/list/YOUR_LIST_ID/card` |
| Headers — Key | `X-API-Key` |
| Headers — Value | Your Placker API key |

> Replace `YOUR_LIST_ID` with the Placker list ID for your Done list.
> To find it: run Postman Request 3 from `Placker_API_Tests.postman_collection.json`.

---

### ACTION 2 — Parse JSON: Parse Placker card array

**Connector:** Data Operation
**Action:** Parse JSON

| Field | Value |
|---|---|
| Content | Expression: `body('HTTP')` |
| Schema | Paste contents of `PlackerParseJSON_Schema.json` (in this repo) |

> **Important:** Use `body('HTTP')` — do NOT add `?['body']`. The HTTP action already unwraps the response body.

**Known schema fix included in `PlackerParseJSON_Schema.json`:**
The `effort` field alternates between an empty array `[]` and an object `{"planned": 1440}`. The schema uses `anyOf` to accept both. The `startDates` and `endDates` schemas also accept an optional `planned` field alongside `actual`.

---

### ACTION 3 — Filter Array: Match card by title

**Connector:** Data Operation
**Action:** Filter array

| Field | Value |
|---|---|
| From | Expression: `body('Parse_JSON')` |
| Condition — Left | Expression: `item()?['title']` |
| Condition — Middle | `is equal to` |
| Condition — Right | Dynamic content: **Name** (from the Trello trigger) |

> This narrows the full Placker card list down to the single card that triggered the flow.

---

### ACTION 4 — Compose: Extract matched card's Placker ID

**Connector:** Data Operation
**Action:** Compose

| Field | Value |
|---|---|
| Inputs | Expression: `first(body('Filter_array'))?['id']` |

> This stores the Placker card ID (integer) used to call the comments and checklists endpoints.

---

### ACTION 5 — HTTP: Get card comments

**Connector:** HTTP
**Action:** HTTP

| Field | Value |
|---|---|
| Method | `GET` |
| URI | Expression: `concat('https://placker.com/card/', outputs('Compose'), '/comment')` |
| Headers — Key | `X-API-Key` |
| Headers — Value | Your Placker API key |

---

### ACTION 6 — HTTP: Get card checklists

**Connector:** HTTP
**Action:** HTTP

> Run this in parallel with Action 5 — click **Add a parallel branch** after Action 4.

| Field | Value |
|---|---|
| Method | `GET` |
| URI | Expression: `concat('https://placker.com/card/', outputs('Compose'), '/checklist')` |
| Headers — Key | `X-API-Key` |
| Headers — Value | Your Placker API key |

---

### ACTION 7 — Compose: Build HTML content for PDF

**Connector:** Data Operation
**Action:** Compose

Paste the following into **Inputs** using the **Expression** tab:

```
concat(
  '<html><body>',
  '<h1>', first(body('Filter_array'))?['title'], '</h1>',
  '<hr/>',
  '<p><strong>Status:</strong> ', first(body('Filter_array'))?['status'], '</p>',
  '<p><strong>Completed:</strong> ', first(body('Filter_array'))?['endDates']?['actual'], '</p>',
  '<h2>Description</h2>',
  '<p>', first(body('Filter_array'))?['description'], '</p>',
  '<h2>Comments</h2>',
  '<p>', string(body('HTTP_-_Get_Comments')), '</p>',
  '<h2>Checklists</h2>',
  '<p>', string(body('HTTP_-_Get_Checklists')), '</p>',
  '</body></html>'
)
```

> **Note:** Once you run a test and see the shape of the comments and checklists responses, update the field references here (e.g., replace `string(body('HTTP_-_Get_Comments'))` with formatted fields like `item()?['text']`). See the **Field Mapping** section below.

---

### ACTION 8 — Compose: Extract SharePoint URL from description

**Connector:** Data Operation
**Action:** Compose

The card description contains a SharePoint link in markdown format:
`[Link Text](https://hosemccann1.sharepoint.com/... "‌")`

Paste the following into **Inputs** using the **Expression** tab to extract the URL:

```
substring(
  first(body('Filter_array'))?['description'],
  add(indexOf(first(body('Filter_array'))?['description'], ']('), 2),
  sub(
    indexOf(first(body('Filter_array'))?['description'], ' "'),
    add(indexOf(first(body('Filter_array'))?['description'], ']('), 2)
  )
)
```

> This grabs everything between `](` and the space before the closing title quote.

---

### ACTION 9 — OneDrive for Business: Create temp HTML file

**Connector:** OneDrive for Business
**Action:** Create file

| Field | Value |
|---|---|
| Folder Path | `/Temp` |
| File Name | Expression: `concat(first(body('Filter_array'))?['title'], '.html')` |
| File Content | Dynamic content: **Outputs** from Action 7 (Build HTML content) |

> If the `/Temp` folder doesn't exist in your OneDrive, create it manually first.

---

### ACTION 10 — OneDrive for Business: Convert file to PDF

**Connector:** OneDrive for Business
**Action:** Convert file

| Field | Value |
|---|---|
| File | Dynamic content: **Id** from Action 9 (Create file) |
| Target type | `PDF` |

---

### ACTION 11 — SharePoint: Save PDF to customer folder

**Connector:** SharePoint
**Action:** Create file

| Field | Value |
|---|---|
| Site Address | `https://hosemccann1.sharepoint.com/sites/HMCJOBS` |
| Folder Path | `/Shared Documents/FRC-ITAR/68+/Engineering/COED Word and Access Files` |
| File Name | Expression: `concat(first(body('Filter_array'))?['title'], '.pdf')` |
| File Content | Dynamic content: **File Content** from Action 10 (Convert file) |

> The Folder Path above is hardcoded as a fallback. Ideally, replace it with a dynamic value derived from `outputs('Compose_-_Extract_SharePoint_URL')` once you confirm the URL extraction is working correctly.

---

## Field Mapping (Update After First Test Run)

After running the flow once, open the run history and inspect the outputs of Actions 5 and 6. Update the HTML template in Action 7 with the correct field names.

| Required Field | Expected API Field | Endpoint | Status |
|---|---|---|---|
| Comment text | `???` | `/card/{id}/comment` | Confirm after first run |
| Comment author | `???` | `/card/{id}/comment` | Confirm after first run |
| Comment date | `???` | `/card/{id}/comment` | Confirm after first run |
| Checklist name | `???` | `/card/{id}/checklist` | Confirm after first run |
| Checklist item text | `???` | `/card/{id}/checklist` | Confirm after first run |
| Checklist item state | `state` / `checked` / `complete` | `/card/{id}/checklist` | Confirm field name |

---

## Testing Checklist

Before going live, test each stage:

- [ ] Trigger fires when a card is moved to Done in Trello
- [ ] Action 1 returns 200 with card array from Placker
- [ ] Action 2 parses without schema errors (check `effort` / `startDates` / `endDates`)
- [ ] Action 3 returns exactly 1 card matching the moved card's title
- [ ] Actions 5 & 6 return 200 for comments and checklists
- [ ] Action 7 builds valid HTML (check Compose output in run history)
- [ ] Action 8 extracts a valid SharePoint URL from the description
- [ ] Action 9 creates the HTML file in OneDrive `/Temp`
- [ ] Action 10 converts to PDF successfully
- [ ] Action 11 saves PDF to correct SharePoint folder

---

## Troubleshooting

| Error | Likely Cause | Fix |
|---|---|---|
| Parse JSON schema error on `effort` | Schema type mismatch | Use `PlackerParseJSON_Schema.json` — already has `anyOf` fix |
| `body('HTTP')?['body']` expression error | Selecting property from array | Use `body('HTTP')` only — no `?['body']` |
| Filter Array returns 0 results | Title case mismatch between Trello and Placker | Check exact card name in both systems |
| Convert file fails | OneDrive `/Temp` folder missing | Create the folder manually in OneDrive |
| SharePoint Create file fails | Folder path has URL-encoded characters | Decode `%20` to spaces in the folder path |

---

## Related Files in This Repo

| File | Purpose |
|---|---|
| `PowerAutomate_Flow_Definition.json` | **Importable flow definition** — paste into Power Automate code view to create all 11 actions at once |
| `PlackerParseJSON_Schema.json` | Corrected JSON schema for the Parse JSON action |
| `PlackerOutput` | Sample Placker API response used to build and test the schema |
| `Placker_API_Tests.postman_collection.json` | Postman collection to validate API endpoints |
| `Placker_API_Setup_Guide.md` | Guide for getting your Placker API key and testing in Postman |
| `Power_Automate_Flow_Design.md` | High-level flow design document |
| `PAError` | Record of Parse JSON schema error and resolution |
| `NewError` | Record of `body('HTTP')?['body']` expression error and resolution |

---

## Working from Mobile (iPhone)

### Option A — Claude Code via Browser (No Setup Required)

Claude Code has a web interface accessible from any mobile browser:

1. Open Safari or Chrome on iPhone
2. Go to **claude.ai** and sign in
3. Claude Code is available through the web interface
4. You can ask questions, review this guide, and get help updating the flow

> **Limitation:** The web interface does not have direct access to your local file system or this git repo. It cannot commit files to GitHub on your behalf from mobile.

---

### Option B — SSH into your Mac from iPhone (Full Terminal Access)

This gives you full terminal access to your Mac, including Claude Code CLI and git. Best option if you want to commit files to this repo from your phone.

#### Step 1 — Enable SSH on your Mac (do this before you leave)

1. Open **System Settings** > **General** > **Sharing**
2. Enable **Remote Login**
3. Note your Mac's local IP address — open Terminal and run:
   ```
   ipconfig getifaddr en0
   ```
   Example output: `192.168.1.45`

#### Step 2 — Install an SSH client on iPhone

**Termius** is the recommended free option:
- Download **Termius** from the App Store (free tier is sufficient)
- Alternatives: **Blink Shell** (paid), **SSH Files**

#### Step 3 — Connect to your Mac

In Termius:
1. Tap **+** > **New Host**
2. Enter:
   - **Hostname:** Your Mac's IP address (e.g., `192.168.1.45`)
   - **Username:** Your Mac username (e.g., `jaysamples`)
   - **Password:** Your Mac login password
3. Tap **Save** then tap the host to connect

> **Note:** Your phone and Mac must be on the **same Wi-Fi network**. If you need access from outside your home network, set up a VPN or use a service like **Tailscale** (free, easy setup) to create a secure tunnel between your phone and Mac.

#### Step 4 — Run Claude Code from the SSH session

Once connected, you can run Claude Code exactly as you do on desktop:

```bash
cd /Users/jaysamples/devproj/TrelloPOC
claude
```

#### Step 5 — Optional: Remote access from outside your home network (Tailscale)

If you need to connect from work or another network:

1. Install **Tailscale** on your Mac: https://tailscale.com/download
2. Install **Tailscale** on your iPhone from the App Store
3. Sign in to the same Tailscale account on both devices
4. Tailscale assigns your Mac a stable IP (e.g., `100.x.x.x`)
5. Use that IP in Termius instead of your local IP

Tailscale is free for personal use and works across any network without port forwarding.

---

### Recommended Setup for Tomorrow

| Goal | Method |
|---|---|
| Read this guide at work | Open GitHub repo in mobile browser |
| Ask Claude questions while implementing | claude.ai in mobile browser |
| Commit files from phone to this repo | SSH into Mac via Termius (Option B) |
