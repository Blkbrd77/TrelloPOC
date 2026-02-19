# Placker API Setup & Postman Testing Guide

**Task:** Validate the Placker API to confirm it returns comments, checklist completion, and close date for Trello cards moved to "Done."

**OpenAPI Spec:** https://github.com/Blkbrd77/TrelloPOC/blob/main/openapi.yaml
**Full Docs:** https://placker.com/docs/api/index.html

## Confirmed API Endpoints (from openapi.yaml)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/me/notifications` | Auth check |
| GET | `/board` | List all boards |
| GET | `/board/{board}/list` | Lists on a board |
| GET | `/list/{list}/card` | Cards in a specific list |
| GET | `/card/{card}` | Full card detail |
| GET | `/card/{card}/comment` | Card comments |
| GET | `/card/{card}/checklist` | Card checklists + items |
| GET | `/webhook/{board}/example` | Example webhook payload |
| POST | `/webhook/{board}` | Create a webhook |

---

## Step 1: Generate Your Placker API Key

1. Log in to Placker (https://placker.com)
2. Navigate to your **Profile > Settings > API** (or look for an "API Keys" section)
3. Click **Generate API Key**
4. Copy the key — treat it like a password, do not share it

---

## Step 2: Import the Postman Collection

1. Open Postman
2. Click **Import** (top left)
3. Select the file: `Placker_API_Tests.postman_collection.json`
4. The collection "Placker API - POC Validation" will appear in your sidebar

---

## Step 3: Set Collection Variables

1. Click the collection name in the sidebar
2. Go to the **Variables** tab
3. Fill in:

| Variable | Value |
|---|---|
| `baseUrl` | Verify against the API docs — likely `https://placker.com/api/v1` |
| `apiKey` | Your key from Step 1 |
| `boardId` | Leave blank — populated after running Request 2 |
| `listId` | Leave blank — populated after running Request 3 |
| `cardId` | Leave blank — auto-populated by Request 4 tests |

4. Click **Save**

---

## Step 4: Run Requests in Order

### Request 1 — Auth Check (`GET /me/notifications`)
**Purpose:** Confirm the API key works and the base URL is correct.

- **Pass:** 200 OK
- **Fail (401):** API key wrong or auth header format incorrect — check the docs security section; it may be `X-API-Key: {{apiKey}}` instead of `Authorization: Bearer`
- **Fail (404):** Base URL is wrong — check the servers section of the docs

### Request 2 — List Boards (`GET /board`)
**Purpose:** Find the board ID for your Trello board.

- `boardId` is auto-set to the first result — override it if you have multiple boards
- All board IDs and names are logged to the Postman console

### Request 3 — Get Lists on Board (`GET /board/{board}/list`)
**Purpose:** Find the "Done" list ID.

- The script auto-detects a list named "Done" or containing "done"/"complete" and sets `listId`
- If not found, manually set `listId` from the console output

### Request 4 — Get Cards in Done List (`GET /list/{list}/card`)
**Purpose:** Retrieve cards from the Done list using the correct endpoint.

- Path is `/list/{list}/card` — not `/board/{board}/card` with a filter
- `cardId` is auto-set to the first card returned
- Console logs which enrichment fields (comments, checklists, dates) appear at the top level

### Request 5 — Get Card Detail (`GET /card/{card}`)
**Purpose:** Full card object + close date validation.

- Scans for close date across known field name candidates
- Reports whether comments/checklists are inline or via sub-endpoints

### Request 6 — Get Comments (`GET /card/{card}/comment`)
**Purpose:** Confirmed comments sub-endpoint from the openapi.yaml.

- Logs the full comment structure — document the field names for Power Automate mapping

### Request 7 — Get Checklists (`GET /card/{card}/checklist`)
**Purpose:** Confirmed checklists sub-endpoint from the openapi.yaml.

- Auto-sets `checklistId` from the first result
- Scans checklist items for completion state field names (`state`, `checked`, `complete`, etc.)

### Request 8 — Webhook Example (`GET /webhook/{board}/example`)
**Purpose:** See what the Power Automate trigger payload looks like before building the flow.

- Shows what data Placker sends when a card event fires
- Identifies the card ID field to use in follow-up API calls within the flow

---

## Step 5: Document Findings

After running the tests, complete this table for the Power Automate mapping:

| Required Field | API Field Name | Endpoint | Notes |
|---|---|---|---|
| Comments | `???` | `/cards/{id}` or `/cards/{id}/comments` | |
| Checklist completion | `???` | `/cards/{id}` | Note if items have `state: complete/incomplete` |
| Close date | `???` | `/cards/{id}` | Note exact field name (e.g., `closedDate`, `actualEndDate`) |

---

## Troubleshooting

### Wrong base URL
The API docs are at https://placker.com/docs/api/index.html — if requests fail with 404, check the actual base URL. It may be `https://app.placker.com/api/v1` or similar.

### Auth header format
If Bearer token auth fails, try:
- `X-API-Key: {{apiKey}}`
- `Api-Key: {{apiKey}}`
- `apiKey` as a query parameter: `?apiKey={{apiKey}}`

Check the Placker docs auth section for the correct format.

### Rate limiting
If you receive 429 responses, wait and retry. Add delays between requests in Postman if running as a collection runner.

---

## Next Steps (After API Validation)

Once the 3 fields are confirmed:

1. **Document the field names** in the table above
2. **Design the Power Automate flow:**
   - Trigger: HTTP webhook from Placker when a card moves to "Done"
   - Action 1: Call Placker API to get full card detail
   - Action 2: Extract comments, checklist completion %, close date
   - Action 3: Write to the matching customer folder in SharePoint
3. **Test the webhook** using Request 7 (to be added) or via Placker webhook settings
