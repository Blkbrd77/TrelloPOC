# Power Automate Flow — Build Instructions

Based on your completed requirements. Follow each section in order. Where you see `[YOU FILL IN]`, that is a value only you know (SharePoint site, list name, column names, etc.).

---

## Part 1 — Fix the Trigger

**The Trello connector in Power Automate only offers two triggers:**
- "When a new card is added to a board"
- "When a new card is added to a list"

Neither is labelled "moved to list," but **"When a new card is added to a list" is the one to use.** The Trello API fires this event whenever a card arrives in a list — whether it was just created there or moved there from another list. Test it first (see below) to confirm it fires on a move before building the rest of the flow.

### Option A — Try the Trello Trigger First (Free, simplest)

1. Delete your current trigger.
2. Click **+ Add a trigger** → search **Trello**.
3. Select **"When a new card is added to a list"**.
4. Sign in with your Trello account.
5. Set:
   - **Board** → COED Database
   - **List** → Done
6. Save the flow, then move an existing test card into Done.
7. Check **My Flows → Run history** within 2 minutes to see if the flow fired.

> **If it fired on the move** → you're done with the trigger, continue to Part 2.
>
> **If it only fires for brand-new cards and not moves** → use Option B below.

---

### Option B — Scheduled Poll (Fallback, always works)

If the Trello trigger does not fire on card moves, replace the trigger with a scheduled poll of the Placker API.

1. Delete the Trello trigger.
2. Click **+ Add a trigger** → search **Schedule** → select **"Recurrence"**.
3. Set the interval to every **15 minutes** (or whatever frequency suits your team).
4. At the start of the flow, add an **HTTP** action to call:
   ```
   GET https://placker.com/api/v1/list/{listId}/card
   ```
   where `{listId}` is the Placker ID of your Done list (find this via Postman — call `GET /board/{boardId}/list` to see all lists and their IDs).
5. Add **Parse JSON** on the response to get the array of cards currently in Done.
6. Add a **SharePoint → Get items** action to fetch rows from a small tracking list (create a new SharePoint list called `Processed Cards` with one column: `CardId` as a single line of text).
7. Inside an **Apply to each** on the Placker cards array, add a **Condition**:
   - Filter the `Processed Cards` list for the current card ID.
   - **If 0 results** → this card is new to Done → process it (continue to Part 4 steps), then add its ID to `Processed Cards`.
   - **If 1+ results** → already processed → skip (add a **Terminate** with status Succeeded or just do nothing).

> This approach is 100% reliable regardless of connector limitations. The trade-off is it runs on a schedule rather than instantly — 15-minute lag is acceptable for most archiving workflows.

---

## Part 2 — Store the Placker API Key (POC Workaround — No Admin Required)

> **Context:** The production approach uses Azure Key Vault, which requires admin access to provision. For the POC, use one of the two options below. Both require zero admin privileges. Rotate the key once the POC is approved and Key Vault is available.

---

### Option A — Plain Text Environment Variable (Recommended for POC)

No Key Vault, no admin — just a text value scoped to your Power Platform environment.

1. Go to **Power Apps** (make.powerapps.com) → **Solutions** → open your solution.
2. Click **New → Environment Variable**.
   - **Display name:** `Placker API Key`
   - **Name:** `placker_api_key`
   - **Data type:** Text *(not Secret — Secret requires Key Vault)*
   - **Current value:** paste your Placker API key
3. Save.
4. In your flow's HTTP action, add a header:
   - **Key:** `Authorization` (or whatever header Placker expects — check Part 4)
   - **Value:** click the expression tab and enter:
     ```
     parameters('placker_api_key')
     ```

**Why this is good enough for a POC:**
- The key is not hardcoded inside the flow definition
- Changing or rotating the key only requires editing the Environment Variable — no touching the flow
- When Key Vault access is granted, you swap Data Type to Secret and re-enter the value; the flow expression stays identical

---

### Option B — Hardcode Directly in the Flow (Fastest, least effort)

Use this only if you want to prove the API call works before worrying about anything else.

1. In your HTTP action header value, paste the API key directly as a plain string.
2. Add a comment (description field on the action): `TODO: move to Environment Variable before production`.

**Limitation:** The key is visible to anyone who can view the flow definition. Acceptable only for a short-lived POC on a non-production board.

---

### When You Get Key Vault Access Later

1. Edit the Environment Variable → change **Data type** to **Secret**.
2. Re-enter the API key value (it will now be stored in Key Vault).
3. The flow expression `parameters('placker_api_key')` does not need to change.

---

## Part 3 — Set Up a Shared Service Account (Optional but Recommended)

A shared account means the flow keeps running if you leave the org.

### Steps

1. Work with your IT/M365 admin to create a mailbox such as `automation@yourorg.com`.
2. License it with at least **Microsoft 365 Business Basic** (needed for Power Automate).
3. Grant the account:
   - **Member** access to the Teams chat group used for notifications.
   - **Contribute** access to the SharePoint site the flow writes to.
   - **Member** access to the Trello board (so the Trello connector sign-in works).
4. In Power Automate, open your flow → **Edit** → click the Trello trigger connection → **Change connection** → sign in as the service account.
5. Do the same for every SharePoint and Teams action in the flow — each connection should use the service account.

---

## Part 4 — Full Flow Structure

Build the following actions in order after the trigger.

---

### Step 1 — Get Card ID from Trigger

The Trello trigger gives you the card. Extract the **Card ID** using:

- In an action that accepts dynamic content, select the Trello trigger output: **Card ID**
- Store in a variable for reuse:
  - Action: **Initialize variable**
  - Name: `varCardId`
  - Type: String
  - Value: `triggerBody()?['id']` *(or pick "Card ID" from dynamic content)*

---

### Step 2 — Call Placker: Get Card Details

Action: **HTTP**

| Field | Value |
|---|---|
| Method | GET |
| URI | `https://placker.com/api/v1/card/@{variables('varCardId')}` |
| Headers | `X-API-Key` = `parameters('placker_api_key')` |

After this action, add: **Parse JSON**
- Content: `body('HTTP_GetCard')`
- Schema: generate from a sample Placker card response (paste one from Postman → Generate from sample)

Key fields you will use downstream:
- `title` → card name
- `endDates.actual` → completion date
- `description` → card description

---

### Step 3 — Call Placker: Get Comments

Action: **HTTP**

| Field | Value |
|---|---|
| Method | GET |
| URI | `https://placker.com/api/v1/card/@{variables('varCardId')}/comment` |
| Headers | `X-API-Key` = `parameters('placker_api_key')` |

After: **Parse JSON** on the response body.

---

### Step 4 — Call Placker: Get Checklists

Action: **HTTP**

| Field | Value |
|---|---|
| Method | GET |
| URI | `https://placker.com/api/v1/card/@{variables('varCardId')}/checklist` |
| Headers | `X-API-Key` = `parameters('placker_api_key')` |

After: **Parse JSON** on the response body.

---

### Step 5 — Look Up the SharePoint Record

Action: **SharePoint → Get items**

| Field | Value |
|---|---|
| Site Address | `[YOU FILL IN]` |
| List Name | `[YOU FILL IN]` |
| Filter Query | `Title eq '@{body('Parse_Card')?['title']}'` *(adjust column name to match yours)* |

This returns a collection. Next, check how many results came back:

Action: **Initialize variable**
- Name: `varMatchCount`
- Type: Integer
- Value: `length(body('Get_items')?['value'])`

---

### Step 6 — Branch on Match Count

Add a **Condition**:

```
varMatchCount is equal to 0
```

**If yes (no match found):**
- Action: **Microsoft Teams → Post message in a chat or channel**
  - Post as: User or Flow bot
  - Post in: Group chat → `[YOU FILL IN — your Teams chat group]`
  - Message: `⚠️ Flow error: No SharePoint match found for card "@{body('Parse_Card')?['title']}". Card ID: @{variables('varCardId')}`
- Action: **Terminate** → Status: Failed, Message: "No SharePoint match"

**If no (at least one match):**
- Add a nested **Condition**:
  ```
  varMatchCount is greater than 1
  ```
  - **If yes (multiple matches):**
    - Teams message: `⚠️ Flow error: Multiple SharePoint matches found for card "@{body('Parse_Card')?['title']}".`
    - Terminate → Failed
  - **If no (exactly one match — the happy path):**
    - Continue to Step 7.

---

### Step 7 — Update the SharePoint Record

Action: **SharePoint → Update item**

| Field | Value |
|---|---|
| Site Address | `[YOU FILL IN]` |
| List Name | `[YOU FILL IN]` |
| Id | `first(body('Get_items')?['value'])?['ID']` |
| `[YOUR card title column]` | `body('Parse_Card')?['title']` |
| `[YOUR close date column]` | `body('Parse_Card')?['endDates']?['actual']` |
| `[YOUR description column]` | `body('Parse_Card')?['description']` |

Add a row for each SharePoint column you want to populate. Leave comment and checklist columns for the loops below.

---

### Step 8 — Write Comments (One Row Per Comment)

Action: **Apply to each**
- Select output: the `value` array from Parse JSON on comments

Inside the loop:

Action: **SharePoint → Create item** *(or your preferred write action)*

| Field | Value |
|---|---|
| Site Address | `[YOU FILL IN]` |
| List Name | `[YOU FILL IN — your comments list or same list]` |
| `[YOUR comment body column]` | `items('Apply_to_each')?['content']` |
| `[YOUR comment author column]` | `items('Apply_to_each')?['author']?['name']` |
| `[YOUR comment date column]` | `items('Apply_to_each')?['created']` |
| `[YOUR card reference column]` | `variables('varCardId')` *(to link back to card)* |

---

### Step 9 — Write Checklist Items

Action: **Apply to each** (outer loop — each checklist)
- Input: array from Parse JSON on checklists

Inside outer loop, add **Apply to each** (inner loop — each item in the checklist):
- Input: `items('Outer_loop')?['items']`

Inside inner loop:

Action: **SharePoint → Create item** *(or append to a field)*

| Field | Value |
|---|---|
| `[YOUR checklist name column]` | `items('Outer_loop')?['title']` |
| `[YOUR item text column]` | `items('Inner_loop')?['title']` |
| `[YOUR item status column]` | `items('Inner_loop')?['status']` |
| `[YOUR card reference column]` | `variables('varCardId')` |

---

### Step 10 — Configure Error Notification (Run-Level)

This catches failures anywhere in the flow.

1. After the last action in the flow, add a **Parallel branch**.
2. In the new branch, add: **Microsoft Teams → Post message in a chat or channel**
3. Click the `...` on this Teams action → **Configure run after** → check **has failed** and **has timed out** only (uncheck succeeded and skipped).
4. Message:
   ```
   ❌ Power Automate flow failed.
   Flow: Placker → SharePoint Sync
   Time: @{utcNow()}
   Card ID: @{variables('varCardId')}
   Check Power Automate run history for details.
   ```

Power Automate automatically logs all run details (inputs, outputs, error messages) in the run history — no additional logging action needed.

---

## Part 5 — Connecting SharePoint in Power Automate

You will configure your own SharePoint details. Here is how to set up the connection:

1. In any SharePoint action, click **Sign in**.
2. Use the **service account** (`automation@yourorg.com`) if you set one up, otherwise your own account.
3. Once signed in, the **Site Address** dropdown will show all SharePoint sites your account can access — pick yours.
4. The **List Name** dropdown will then populate with every list in that site — pick yours.
5. Column names will auto-populate in the action fields once the list is selected.

> Power Automate caches the connection. If you later switch to the service account, go to **Data → Connections** in Power Automate and delete the old connection, then re-add with the service account.

---

## Part 6 — Testing the Flow

1. Move a real card to Done on the COED Database board.
2. Go to **My Flows** → open your flow → **Run history**.
3. Click the most recent run to see each action's inputs and outputs.
4. If an HTTP action fails, expand it to see the status code and response body — this tells you exactly what Placker returned.

**Common issues:**
| Symptom | Fix |
|---|---|
| Trigger doesn't fire | Check the Trello connection is signed into the right account and board/list are selected |
| HTTP 401 from Placker | API key is wrong or the `X-API-Key` header name is misspelled |
| SharePoint "Get items" returns 0 | The filter query column name doesn't match the internal SharePoint column name (check in list settings) |
| Loop writes duplicates | The flow ran twice — check if two trigger events fired |

---

## Summary Checklist

- [ ] Trigger replaced with Trello "When a card is moved to a list" → Done list
- [ ] Placker API key stored as Environment Variable (Secret)
- [ ] Service account created and connected (optional)
- [ ] Card details HTTP call configured
- [ ] Comments HTTP call configured
- [ ] Checklists HTTP call configured
- [ ] SharePoint Get items + match count condition configured
- [ ] Teams error messages configured for 0 matches and 2+ matches
- [ ] SharePoint Update item configured with your column names
- [ ] Comments loop configured (one row per comment)
- [ ] Checklists nested loop configured
- [ ] Run-level error Teams notification configured
- [ ] Flow tested end-to-end with a real card
