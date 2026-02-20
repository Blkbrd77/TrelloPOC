# Power Automate Implementation Guide
## Trello Card Completion → Placker Enrichment → SharePoint PDF

**Version:** 1.2
**Status:** Ready to Implement
**Date:** February 2026

---

## Quick Start — Import the Flow Definition

Instead of clicking through every step manually, paste `PowerAutomate_Flow_Definition.json` directly into Power Automate's code view. This creates all 14 actions at once (11 original + 2 Select actions + 1 logo action added in v1.2).

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
    +------------------------------------------+
    |                                          |
    v                                          v
[ACTION 0] SharePoint - Get Logo        [ACTION 1] HTTP - GET Cards in List
  Fetches company logo as base64          Placker: all cards in Done list
  Runs in parallel with Action 1
    |                                          |
    +------------------------------------------+
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
    +----------------------------------+----------------------------------+
    |                                                                     |
    v                                                                     v
[ACTION 5] HTTP - GET Comments                         [ACTION 6] HTTP - GET Checklists
    |                                                                     |
    v                                                                     v
[ACTION 5b] Select - Format Comments                   [ACTION 6b] Select - Format Checklists
  Converts each comment object                           Converts each checklist object
  into one HTML <p> string.                              into one HTML <h3> block.
  Output: array of strings.                             Output: array of strings.
    |                                                                     |
    +----------------------------------+----------------------------------+
                                       |           (also waits for ACTION 0 logo)
                                       v
                          [ACTION 7] Compose - Build HTML Content
                            Title: TRELLO Completion (#225FAD)
                            Logo from ACTION 0, tables for layout.
                                       |
                                       v
                          [ACTION 8] Compose - Extract SharePoint URL
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

### ACTION 0 — SharePoint: Get Logo Image

**Connector:** SharePoint
**Action:** Get file content using path

> This action runs at the **start of the flow in parallel with Action 1** (both have no dependencies). Add it anywhere before Action 7 — Power Automate will run it alongside the other early actions automatically once you set its `runAfter` to empty in code view, or simply add it as an independent parallel branch.

Upload your company logo to SharePoint once (e.g. `/Shared Documents/Assets/company_logo.png`). This action retrieves it as base64-encoded content, which Action 7 embeds directly in the HTML `<img>` tag.

| Field | Value |
|---|---|
| Site Address | `https://hosemccann1.sharepoint.com/sites/HMCJOBS` |
| File Path | Path to your logo file, e.g. `/Shared Documents/Assets/company_logo.png` |

> **How it works in Action 7:** The response body contains a `$content` field with the base64 string. The HTML img tag is built as: `<img src="data:image/png;base64,` + `body('SharePoint_-_Get_Logo')?['$content']` + `" style="max-height:60px;"/>`. No separate base64 encoding step is needed — SharePoint connector returns file content already base64 encoded.

> **Action name:** Rename this action to `SharePoint - Get Logo` so it matches `body('SharePoint_-_Get_Logo')` in Action 7.

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

### ACTION 5 — HTTP: GET Comments

**Connector:** HTTP
**Action:** HTTP

| Field | Value |
|---|---|
| Method | `GET` |
| URI | Expression: `concat('https://placker.com/card/', outputs('Compose'), '/comment')` |
| Headers — Key | `X-API-Key` |
| Headers — Value | Your Placker API key |

**What this returns:** An array of comment objects. Each object has the comment text, the author (as a nested object with a name field), and a timestamp. Field names are confirmed after first test run — see Field Mapping section.

---

### ACTION 6 — HTTP: GET Checklists

**Connector:** HTTP
**Action:** HTTP

> Run this in parallel with Action 5 — click **Add a parallel branch** after Action 4.

| Field | Value |
|---|---|
| Method | `GET` |
| URI | Expression: `concat('https://placker.com/card/', outputs('Compose'), '/checklist')` |
| Headers — Key | `X-API-Key` |
| Headers — Value | Your Placker API key |

**What this returns:** An array of checklist objects. Each object has a `title` (the checklist name) and an `items` array. Each item in `items` has a `title` (the item text) and a `status` field (`complete` or `incomplete`). Field names are best guesses — confirm from Run History after first test.

---

### ACTION 5b — Select: Format Comments

**Connector:** Data Operation
**Action:** Select

> Add this immediately after Action 5 (GET Comments) — before the parallel branches merge back together.

**What Select does here:** It iterates over the array of comment objects returned by GET Comments and maps each one to a formatted HTML `<p>` string. The output is an array of strings — one string per comment — which Action 7 then collapses with `join()`.

| Field | Value |
|---|---|
| From | Expression: `body('HTTP_-_Get_Comments')` |
| Map | Switch to **Expression** tab and enter the expression below |

**Map expression:**
```
concat(
  '<p style="border-left:3px solid #225FAD;padding-left:8px;margin:8px 0;">',
  '<strong style="color:#225FAD;">', item()?['author']?['name'], '</strong>',
  ' &mdash; <em>', item()?['created'], '</em><br/>',
  item()?['content'],
  '</p>'
)
```

> **Field names to verify:** `author.name`, `created`, and `content` are best guesses. After the first test run, open Run History → expand GET Comments output and check the actual field names. Update this expression if they differ (e.g. `content` might be `text`, `created` might be `createdAt`).

**How to rename this action:** Click the `...` on the action → **Rename** → type `Select - Format Comments`. This name is what Action 7 references in `body('Select_-_Format_Comments')`.

---

### ACTION 6b — Select: Format Checklists

**Connector:** Data Operation
**Action:** Select

> Add this immediately after Action 6 (GET Checklists), on the parallel branch.

**What Select does here:** Iterates over the array of checklist objects and maps each to an HTML block containing the checklist title. The `items` array inside each checklist is serialized with `string()` as a POC fallback — this produces readable but unformatted output. See the **Upgrading Checklist Formatting** note below if you want per-item checkboxes.

| Field | Value |
|---|---|
| From | Expression: `body('HTTP_-_Get_Checklists')` |
| Map | Switch to **Expression** tab and enter the expression below |

**Map expression:**
```
concat(
  '<h3>', item()?['title'], '</h3>',
  '<p>', string(item()?['items']), '</p>'
)
```

> **Field names to verify:** `title` is the checklist name. `items` is the nested array of checklist items. Confirm both from Run History after first test run.

**How to rename this action:** Click `...` → **Rename** → `Select - Format Checklists`.

#### Upgrading Checklist Formatting (after field names confirmed)

The `string(item()?['items'])` expression dumps raw JSON for the items. To get proper checkboxes once you know the real field names, replace the entire Select action with a **Variable + Apply to each** loop:

1. **Initialize variable** — name: `varChecklistsHTML`, type: String, value: `''`
2. **Apply to each** (outer) — input: `body('HTTP_-_Get_Checklists')`
   - **Append to string variable** `varChecklistsHTML` with: `concat('<h3>', items('Apply_to_each')?['title'], '</h3>')`
   - **Apply to each** (inner) — input: `items('Apply_to_each')?['items']`
     - **Append to string variable** `varChecklistsHTML` with the expression below
3. In Action 7, replace `join(body('Select_-_Format_Checklists'), '')` with `variables('varChecklistsHTML')`

**Inner loop expression — Force all items as checked (&#9745;):**
```
@concat('<p style="margin:2px 0;">&#9745; ', items('Apply_to_each_1')?['title'], '</p>')
```

> **Why force-checked:** The Trello automation moves a card to Done **only when every checklist item is complete**. By the time this flow fires, all items are already checked. There is no need to inspect the status field — render all items with &#9745; unconditionally.

**Outer loop Append expression (styled checklist title):**
```
@concat('<h3 style="color:#225FAD;margin:10px 0 4px 0;">', items('Apply_to_each')?['title'], '</h3>')
```

---

### ACTION 7 — Compose: Build HTML Content

**Connector:** Data Operation
**Action:** Compose

**What this does:** Assembles the final HTML with a branded layout — `TRELLO Completion` title in `#225FAD`, company logo top-right (base64 from ACTION 0), a Job Details table, then Description, Comments, and Checklists sections with matching heading colors.

Paste the following into **Inputs** using the **Expression** tab:

```
concat(
  '<html><body style="font-family:Arial,sans-serif;margin:30px;color:#333;">',

  '<table width="100%" cellpadding="4" cellspacing="0" style="border-bottom:3px solid #225FAD;margin-bottom:16px;"><tr>',
  '<td><h1 style="color:#225FAD;margin:0;">TRELLO Completion</h1></td>',
  '<td align="right"><img src="data:image/png;base64,', body('SharePoint_-_Get_Logo')?['$content'], '" style="max-height:60px;"/></td>',
  '</tr></table>',

  '<h2 style="color:#225FAD;border-bottom:2px solid #225FAD;padding-bottom:4px;">Job Details</h2>',
  '<table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">',
  '<tr>',
  '<td width="180" style="font-weight:bold;color:#225FAD;background:#f0f4fb;border:1px solid #ddd;padding:6px 10px;">Card Title</td>',
  '<td style="border:1px solid #ddd;padding:6px 10px;">', first(body('Filter_array'))?['title'], '</td>',
  '</tr><tr>',
  '<td style="font-weight:bold;color:#225FAD;background:#f0f4fb;border:1px solid #ddd;padding:6px 10px;">Status</td>',
  '<td style="border:1px solid #ddd;padding:6px 10px;">', first(body('Filter_array'))?['status'], '</td>',
  '</tr><tr>',
  '<td style="font-weight:bold;color:#225FAD;background:#f0f4fb;border:1px solid #ddd;padding:6px 10px;">Date Completed</td>',
  '<td style="border:1px solid #ddd;padding:6px 10px;">', first(body('Filter_array'))?['endDates']?['actual'], '</td>',
  '</tr></table>',

  '<h2 style="color:#225FAD;border-bottom:2px solid #225FAD;padding-bottom:4px;">Description</h2>',
  '<p>', first(body('Filter_array'))?['description'], '</p>',

  '<h2 style="color:#225FAD;border-bottom:2px solid #225FAD;padding-bottom:4px;">Comments</h2>',
  join(body('Select_-_Format_Comments'), ''),

  '<h2 style="color:#225FAD;border-bottom:2px solid #225FAD;padding-bottom:4px;">Checklists</h2>',
  variables('varChecklistsHTML'),

  '</body></html>'
)
```

> **Requirements:** This expression requires `SharePoint_-_Get_Logo` (ACTION 0) to have succeeded, and `varChecklistsHTML` to be populated by the Apply to each loop. Do NOT also include `join(body('Select_-_Format_Checklists'),'')` — that combination produces `''` artifacts in the output.

**Why `join(body('Select_-_Format_Comments'), '')`:**
- `body('Select_-_Format_Comments')` is the array of strings output by Action 5b — e.g. `["<p>Jay...</p>", "<p>Jane...</p>"]`
- `join(array, '')` concatenates them with no separator → `"<p>Jay...</p><p>Jane...</p>"`
- The result slots directly into the HTML string

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

After running the flow once, open Run History and expand the outputs of **GET Comments** (Action 5) and **GET Checklists** (Action 6) to see the real field names. Then update the expressions in the two **Select** actions — not in the Compose.

**Where to make changes:**
- Comment field names → edit the **Map** expression in **Action 5b (Select - Format Comments)**
- Checklist field names → edit the **Map** expression in **Action 6b (Select - Format Checklists)**
- The Compose (Action 7) does not need to change when field names are updated

| Required Field | Expected API Field | Where to Update | Endpoint | Status |
|---|---|---|---|---|
| Comment text | `content` (may be `text`) | Action 5b Map: `item()?['content']` | `/card/{id}/comment` | Confirm after first run |
| Comment author | `author.name` | Action 5b Map: `item()?['author']?['name']` | `/card/{id}/comment` | Confirm after first run |
| Comment date | `created` (may be `createdAt`) | Action 5b Map: `item()?['created']` | `/card/{id}/comment` | Confirm after first run |
| Checklist name | `title` | Action 6b Map: `item()?['title']` | `/card/{id}/checklist` | Confirm after first run |
| Checklist item text | `title` (on each item) | Upgrade to loop — see Action 6b | `/card/{id}/checklist` | POC: serialized via string() |
| Checklist item state | `status` / `state` / `checked` | Upgrade to loop — see Action 6b | `/card/{id}/checklist` | Confirm field name |

---

## Testing Checklist

Before going live, test each stage:

- [ ] Action 0 (Get Logo) returns 200 — expand Run History output and confirm `$content` field is present and non-empty
- [ ] Trigger fires when a card is moved to Done in Trello
- [ ] Action 1 (GET Cards in List) returns 200 with card array from Placker
- [ ] Action 2 (Parse JSON) parses without schema errors (check `effort` / `startDates` / `endDates`)
- [ ] Action 3 (Filter Array) returns exactly 1 card matching the moved card's title
- [ ] Action 5 (GET Comments) returns 200 — expand output in Run History to confirm field names
- [ ] Action 6 (GET Checklists) returns 200 — expand output in Run History to confirm field names
- [ ] Action 5b (Select - Format Comments) output is an array of HTML strings, not objects — if it returns objects, the field names in the Map expression are wrong
- [ ] Action 6b (Select - Format Checklists) output is an array of HTML strings with checklist titles visible
- [ ] Action 7 (Compose) builds valid HTML — open the Outputs tab in Run History and copy the value into a browser to preview it
- [ ] Action 8 extracts a valid SharePoint URL from the description (no `%20` encoding issues)
- [ ] Action 9 creates the HTML file in OneDrive `/Temp`
- [ ] Action 10 converts to PDF successfully
- [ ] Action 11 saves PDF to correct SharePoint folder

---

## Troubleshooting

| Error | Likely Cause | Fix |
|---|---|---|
| Logo not appearing in PDF | `SharePoint_-_Get_Logo` failed or path wrong | Check REPLACE_WITH_LOGO_FILE_PATH is the correct SharePoint-relative path; confirm action returns 200 and `$content` is in Run History output |
| Logo appears broken in HTML preview but OK in PDF | Browser blocking base64 data URI from file:// origin | Expected — data URIs work correctly in the PDF converter; test by opening the HTML from a web server or directly in OneDrive |
| Parse JSON schema error on `effort` | Schema type mismatch | Use `PlackerParseJSON_Schema.json` — already has `anyOf` fix |
| `body('HTTP')?['body']` expression error | Selecting property from array | Use `body('HTTP')` only — no `?['body']` |
| Filter Array returns 0 results | Title case mismatch between Trello and Placker | Check exact card name in both systems |
| Select output is array of objects, not strings | Field name in Map expression is wrong or missing | Open Run History → GET Comments output → check actual field names → update Map in Action 5b or 6b |
| `join()` in Action 7 returns empty string | Select output is empty — GET returned no results | Check that the card actually has comments / checklists (`hasComments`/`hasChecklists` flags in GET Cards output) |
| `''` appears before checklist content in HTML | `join(body('Select_-_Format_Checklists'),'')` and `variables('varChecklistsHTML')` are both in the Compose | Use only one — remove the `join(body('Select_-_Format_Checklists'),'')` and replace with `variables('varChecklistsHTML')` (see Action 7 Option B) |
| Checkmarks not appearing on complete items | `status` field value is not `'complete'` in the Placker API | Use the diagnostic expression in the loop (see Upgrading Checklist Formatting) to print the actual status value, then update the `or()` condition |
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
