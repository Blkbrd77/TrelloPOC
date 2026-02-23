# SharePoint share link ("Copy link") → folder path for Power Automate

_Date: 2026-02-23_

## Problem
Trello card descriptions often contain a SharePoint **"Copy link"** URL (a sharing link), for example:

- `https://org2200.sharepoint.com/:f:/s/ORGSales/...?...`

However, the SharePoint connector action **Create file** requires a **folder path** (e.g. `/Shared Documents/...`) and cannot use the sharing URL directly.

## Goal
Convert:

- SharePoint sharing URL (from Trello) → SharePoint **folder path** usable in Power Automate `Create file` `folderPath`.

## Preferred (fully dynamic) approach: resolve via Microsoft Graph
This is the most reliable automated approach.

### High-level steps
1. **Extract** the sharing URL from the Trello card description (string parsing).
2. **Encode** the sharing URL into a Graph `shareId`.
3. Call Microsoft Graph:
   - `GET https://graph.microsoft.com/v1.0/shares/u!{shareId}/driveItem`
4. Build a connector-friendly folder path from the response (parent path + item name).
5. Use the resulting path as the SharePoint `Create file` **folderPath**.

### What IT must provide (if Graph is not available in the environment)
If the **"HTTP with Microsoft Graph"** action/connector is not available, use the generic **HTTP** action with **Azure AD OAuth**.

Request an Azure AD app registration with:
- Microsoft Graph **Application permissions**:
  - `Sites.Read.All`
  - `Files.Read.All`
- **Admin consent** granted
- Provide to the flow owner:
  - Tenant ID
  - Client ID
  - Client secret (or certificate)

In Power Automate HTTP action settings:
- Authentication: **Active Directory OAuth**
- Audience: `https://graph.microsoft.com`
- Tenant: `{tenantId}`
- Client ID / secret: from the app registration

## Power Automate notes
- The SharePoint action **"Send an HTTP request to SharePoint"** cannot call Graph; it only supports `/_api/...` relative SharePoint REST endpoints.
- If you see `Access token is empty`, the HTTP action is not authenticated.

## Alternate approaches (when Graph is blocked)

### 1) Train users to paste a folder path (best non-Graph option)
Instead of a share link, store a path in Trello (description or custom field), e.g.: 

- Server-relative: `/sites/ORGSales/Shared Documents/6-Q-1019 Log Book/Test Customer Folder`
- Library-relative (often works with SharePoint connector folderPath): `/Shared Documents/6-Q-1019 Log Book/Test Customer Folder`

Then the flow uses the value directly as `Create file` → `folderPath`.

### 2) Mapping table (SharePoint List / Excel)
Maintain a lookup table:

- `TrelloCardId` (or another stable key) → `FolderPath`

Flow:
1. Read card id
2. Query the list/table
3. Use mapped `FolderPath`

Pros: no Graph.
Cons: requires ongoing maintenance.

### 3) IT-hosted resolver service
IT can host an internal resolver (Azure Function, Azure Automation Runbook, on-prem service) that:
- Accepts the share link
- Resolves it to a folder path using approved methods
- Returns the folder path to the flow

Pros: keeps Graph complexity/permissions out of the flow maker’s environment.
Cons: requires IT build + operations.

### 4) Fixed base folder + derived subfolder
If folder naming is predictable:
- Use a fixed base: `/Shared Documents/6-Q-1019 Log Book/`
- Append a deterministic subfolder value (e.g., customer ID)

Pros: no Graph, minimal infra.
Cons: brittle if names vary; still must ensure folder exists.

### 5) Custom Trello Power-Up / integration
A custom Power-Up (or external integration) can:
- Read the share link from a Trello custom field
- Resolve it externally (Graph/SharePoint API)
- Write the resolved path back into Trello

Pros: Trello remains the single source of truth for the folder path.
Cons: development + still needs API access somewhere.