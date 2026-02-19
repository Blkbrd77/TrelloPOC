# Power Automate Flow — Requirements & Field Mapping

Fill in each blank below. Once complete, this document will drive the full flow build.

---

## 1. Placker API — Confirmed Field Names

*(From your Postman results — open the Console tab for each request)*

### Card Detail (`GET /card/{card}`)

| Required Data | Exact API Field Name | Example Value Seen |
|---|---|---|
| Card title / name | "title": | "SPIKE: Deep Dive FRC and OPC COED databases.", |
| Close / completion date |"endDates": {
        "planned": "2025-08-04T23:30:00+02:00",
        "actual": "2026-02-19T21:13:51+01:00" | "actual": "2026-02-19T21:13:51+01:00" |
| Card description | "description": | "**OUTCOME:** As a database designer, I want to understand the current database schema, reports, entry methods, and source data so that I can make informed decisions about improvements and integrations.\n\nQuestions:\n\n1. Where does the Group Information come from?\n   1. Cable Number (1-10-1)-1EL-R(1-8-2)\n   2. Group CJ1-SH1-X\n2. On Drawing 154B-WPC-410-304, SHEET-3, ZONE 22-C there is a reference for A26, I can’t find the reference anywhere else in the drawing?\n3. How often are cable types wired differently?\n   1. K10053893-515 (CAT6 LSZH)\n   2. K10053893-523 (CAT6 LSZH)\n   3. SWE\n   4. LSC5OSW\n\n**ACCEPTANCE CRITERIA:**\n\n- Schema diagrams for CABLE1 and CABLE2 are documented.\n- Entry methods (forms, imports, manual edits) are identified.\n- Source data origins (manual, vendor, system-generated) are listed.\n- Reports and queries are cataloged with purpose and usage.\n\n**Definition of Done**\n\n- A shared document or wiki page contains the above.\n- Reviewed and validated by at least one engineer or stakeholder.", |
| Card ID | "id": | 57175087, |

### Comments (`GET /card/{card}/comment`)

| Required Data | Exact API Field Name | Example Value Seen |
|---|---|---|
| Comment text/body | "content": | "See completion artifact at: [Database Documentation - Miro](https://miro.com/app/board/uXjVJYY-XBQ=/ \"‌\")\n\nWill validate with Scott when first POC is ready.", |
| Comment author | "author":| "author": {
            "id": 1075386,
            "name": "Jay Samples" |
| Comment date | "created":  | "2025-08-01T20:37:21+02:00", |

### Checklists (`GET /card/{card}/checklist`)

| Required Data | Exact API Field Name | Example Value Seen |
|---|---|---|
| Checklist name | "title": | "TEST FOR POC", |
| Item name/text | "items": [
            {
                "id":
                "title":| |
| Item completion state | "status": | "COMPLETED", |

### ~~Webhook Payload (`GET /webhook/{board}/example`)~~

~~| Required Data | Exact Field Name in Payload | Notes |
|---|---|---|
| Card ID (used in follow-up calls) | ________________________ | |
| Event type (to detect "moved to Done") | ________________________ | |
| List name in payload | ________________________ | |~~

---
## 2. I will handle the SharePoint Info please me instructions on how to configure in Power Automate
##  ~~2. SharePoint — Destination~~

| Question | Your Answer |
|---|---|
~~SharePoint site URL | ________________________~~
~~List or Document Library name | ________________________~~
~~How is it organized? (by customer folder / by row / other) | ________________________~~ 

### ~~SharePoint Column Names to Write To~~

*(List every column in SharePoint that the flow needs to populate)*

| Column Name in SharePoint | Data Source | Notes |
|---|---|---|
| ________________________ | Card title | |
| ________________________ | Close date | |
| ________________________ | Comments | Plain text or multi-line? |
| ________________________ | Checklist completion % | Calculated or raw? |
| ________________________ | ________________________ | |
| ________________________ | ________________________ | |

---

## 3. Trigger — How the Flow Starts

| Question | Your Answer |
|---|---|
| Trigger type | Power Automate |
| If webhook: what event fires it? (e.g., card moved to list) | Need assistance here, currently using "When a new card is added to a board (v3) (Preview)" |
| If scheduled: how often? | Trying to set up to fire when a card is moved into a list|
| Should the flow filter to a specific board? | Yes — Board ID: "COED Database" |
| Should the flow filter to a specific list name? | Yes — List name: "Done" |

---

## 4. SharePoint — Matching Logic

*(How does the flow know which SharePoint row/folder to update?)*

| Question | Your Answer |
|---|---|
| What field on the card matches a SharePoint record? | Parse Title for SharePoint Link |
| Is it a lookup by card name, card ID, a custom field? | card title |
| What happens if no match is found? | Flag error - send Teams message |
| What happens if multiple matches are found? | Flag error - send Teams message |

---

## 5. Comments — Handling

| Question | Your Answer |
|---|---|
| Write all comments or only the most recent? | All |
| Format: concatenated into one field, or one row per comment? | One row per comment |
| Include author and date with each comment? | Yes |

---

## 6. Checklist — Handling

| Question | Your Answer |
|---|---|
| Write checklist as a completion % (e.g., 4/5 = 80%)? |  No, Butler automation will move cards once checklists are 100% complete |
| Write full item list with status? | Yes  /  No |
| Which checklists — all on the card, or a specific one? | All |

---

## 7. Error Handling & Notifications

| Question | Your Answer |
|---|---|
| Who should be notified if the flow fails? | Teams Chat Group |
| Notification method |Teams message |
| Should failed runs be logged somewhere? | Yes — Power Automate runs |

---

## 8. Placker Credentials in Power Automate

| Question | Your Answer |
|---|---|
| How will the API key be stored? | Most Secure Means |
| Is there a shared service account for the flow? | No, runs under my account, provide instructions to set up shared service |

---

## Notes / Anything Else

```
Don't want to share Sharepoint location with you, will handle filling in details, just need the how to set up automation




```
