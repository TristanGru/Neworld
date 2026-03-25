# AUTONOMOUS_IMPLEMENTATION_PRD.md

---

## 1. Title and One-Liner

**Loresmith** — A local-first, genre-adaptive desktop novel writing and world-building application with an Ollama-powered AI that understands and connects your fictional world.

---

## 2. Executive Summary

- Loresmith is a Mac + Windows desktop app built with Tauri (Rust) + React + TypeScript.
- All data is stored locally: SQLite for structured world-building data, Markdown files for prose.
- Writers manage characters, locations, factions, lore, timelines, items, and custom categories in a unified workspace.
- Prose and world-building are deeply linked: clicking any entity name in prose navigates to its profile.
- Entity names are auto-detected in prose; writers can also use @mentions to link manually.
- An Ollama-backed local LLM answers questions about the writer's specific world using RAG over their own data.
- The AI also surfaces missed connections and flags consistency conflicts across chapters.
- Genre-adaptive UI themes (Fantasy, Sci-Fi, Horror, Romance, Mystery/Noir, Historical, Contemporary, Custom) change the app's visual language per project.
- Projects are fully portable: one project = one folder on disk (SQLite DB + Markdown files).
- Distribution is free and open source (GitHub). No servers, no telemetry, no subscriptions.

---

## 3. Goals

| # | Goal | Measure |
|---|------|---------|
| G-01 | Writers can create and fully manage a novel project without leaving the app | All core flows completable end-to-end in the app |
| G-02 | Click any entity name in prose → navigate to profile in ≤ 200ms | Measured via UI interaction timing tests |
| G-03 | AI answers questions about the user's world with correct answers ≥ 80% of the time on seeded test worlds | Evaluated via acceptance test suite with a pre-built test world |
| G-04 | Project folder is portable: copy folder to another machine → open and work with no migration | Verified by copy-and-open acceptance test |
| G-05 | App launches in ≤ 3 seconds on minimum spec hardware | Measured on M1 Mac and mid-range Windows machine |
| G-06 | Ollama setup failure shows guided onboarding, not a crash | Acceptance test: launch without Ollama running |
| G-07 | Export to ePub, PDF, and .docx produces valid, readable files | Validated by opening exports in Calibre, Adobe, and Word |

---

## 4. Non-Goals

- No cloud sync, accounts, or remote storage of any kind.
- No real-time multiplayer or collaboration features.
- No mobile app (iOS or Android).
- No in-app AI model download manager (user installs Ollama separately).
- No built-in grammar/spell checker beyond OS-level.
- No publishing pipeline or submission management.
- No marketplace or plugin store (custom themes are user-created files, not a platform).
- No analytics, crash reporting, or any outbound telemetry.
- No web app version.

---

## 5. Assumptions & Decisions

### 5.1 Assumptions (A-###)

| ID | Assumption |
|----|-----------|
| A-001 | Users install Ollama independently. App detects its presence at `http://localhost:11434` on launch. |
| A-002 | Default Ollama model is `llama3` unless user configures another in settings. |
| A-003 | Local embedding model is `nomic-embed-text` via Ollama's embedding endpoint. |
| A-004 | Vector search uses `sqlite-vss` extension bundled with the app binary. |
| A-005 | Minimum hardware: 8GB RAM, Apple M1 or Intel Core i5 equivalent, macOS 12+ or Windows 10+. |
| A-006 | One project = one folder. SQLite file named `loresmith.db` + `/prose/` subdirectory of Markdown files. |
| A-007 | Genre theme is set at project creation and can be changed later in project settings. |
| A-008 | Auto-detection of entity names in prose is triggered on save/debounce (not keystroke). |
| A-009 | Version history uses a lightweight local journal of saves (not full git). Up to 50 snapshots per file. |
| A-010 | Export to ePub uses `pandoc`; export to PDF uses `pandoc` + `wkhtmltopdf`; export to .docx uses `pandoc`. Bundled with app. |
| A-011 | Corkboard scene view is a drag-and-drop card grid, not a visual canvas/spatial tool. |
| A-012 | Relationship graph uses a force-directed SVG layout rendered in-app (no external service). |
| A-013 | Custom world-building categories are defined per-project, stored in project DB. |
| A-014 | "Donate" CTA links to a Ko-fi or GitHub Sponsors URL, hardcoded in the app. |
| A-015 | App ships with 2 themes at v1 (Fantasy + Neutral/Default). Other themes unlocked in subsequent releases. |

### 5.2 Decisions (D-###)

| ID | Decision | Justification |
|----|----------|---------------|
| D-001 | **Tauri** (Rust backend, React/TS frontend) | Smallest binary, true native Mac+Win, better performance than Electron, strong file system access |
| D-002 | **React + TypeScript** | Largest ecosystem for UI components; TipTap is React-native; strong typing reduces agent errors |
| D-003 | **TipTap** as the prose editor | ProseMirror-based, extensible, supports custom marks for entity linking, active OSS community |
| D-004 | **SQLite** (via `rusqlite` in Tauri backend) for world data | Single-file, no server, portable, well-supported |
| D-005 | **sqlite-vss** for vector search | Keeps vector store inside same SQLite file; no separate process needed |
| D-006 | **Markdown files** for prose chapters | Human-readable, portable, diff-friendly, opens in any editor |
| D-007 | **Ollama** REST API for LLM + embeddings | Local, free, model-agnostic, simple HTTP interface, no API key required |
| D-008 | **Zustand** for frontend state | Lightweight, minimal boilerplate, works cleanly with React |
| D-009 | **Vite** as frontend bundler | Fast HMR, first-class Tauri support via `@tauri-apps/cli` |
| D-010 | **Vitest** for unit/integration tests; **Playwright** for e2e | Both integrate with Vite; Playwright supports Tauri windows |
| D-011 | **Tailwind CSS** for styling | Utility-first keeps genre theming simple via CSS variables/theme tokens |
| D-012 | **React Flow** for relationship graph | Purpose-built for node graphs, handles force layout, MIT licensed |
| D-013 | Prose stored as `.md` files in `/prose/<chapter-id>.md` | Flat structure avoids nesting complexity while keeping portability |
| D-014 | Entity detection uses a deterministic Aho-Corasick string matching pass on save | Avoids AI round-trip latency for linking; fast and predictable |
| D-015 | RAG index rebuilt incrementally on save (only changed documents re-embedded) | Avoids re-embedding entire corpus on every save |

### 5.3 Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Ollama not installed / not running on first launch | High | Detect on startup; show full onboarding screen with install link and retry button |
| Auto-detection false positives (common words matching entity names) | High | Minimum entity name length of 3 chars; user can mark a detection as "ignore" to persist suppression |
| sqlite-vss binary compatibility across OS/arch combinations | High | Bundle pre-compiled vss binaries for all 4 targets (mac-arm64, mac-x64, win-x64, win-arm64) in Tauri sidecar |
| RAG quality degrades on 100k+ word novels | Medium | Chunk prose at paragraph level (≤512 tokens per chunk); prioritize world-building entries over prose in context window |
| TipTap entity mark performance with thousands of detected names | Medium | Debounce detection to 1500ms after last keystroke; batch mark updates |
| Genre theme scope explosion | Medium | Ship Fantasy + Neutral at v1; theme = CSS token override file; document the token schema for community themes |
| Export quality (ePub/PDF/docx) | Medium | Bundle pandoc; write acceptance tests that open outputs and verify chapter count and headings |
| Version history storage bloat on very large projects | Low | Cap at 50 snapshots; oldest pruned automatically; warn user in settings when approaching cap |
| Windows path separator bugs in project folder logic | Low | All Tauri path operations use `tauri::api::path`; no manual string concatenation of paths |

---

## 6. Users, Personas, and Core Use Cases

### Personas

| Persona | Description |
|---------|-------------|
| **Maya** (Hobbyist) | Writes fantasy novels as a weekend passion. Wants a beautiful, low-friction tool. Not technical. |
| **Dev** (Aspiring novelist) | Serious about craft, building a complex world with hundreds of characters and factions. Needs powerful organization. |
| **Sasha** (Professional author) | Published, working on series book 3. Needs consistency checking and fast recall of world details. |

### Primary Flows (U-###)

| ID | Flow |
|----|------|
| U-001 | User launches app for the first time → Ollama onboarding check → create new project → select genre → see genre-themed dashboard |
| U-002 | User creates a new character entry → fills structured fields (name, aliases, traits, faction, notes) → saves |
| U-003 | User writes prose in chapter editor → entity names auto-detected and underlined → clicks name → profile panel slides in |
| U-004 | User types `@El` in prose editor → autocomplete dropdown shows matching entities → selects one → creates manual link |
| U-005 | User opens relationship graph → sees all entities as nodes → drags to explore → clicks node → navigates to profile |
| U-006 | User opens AI panel → types "What color are Elara's eyes?" → AI responds using RAG over character profile |
| U-007 | User opens AI panel → AI proactively shows: "Kael appears in Ch. 1 and Ch. 7 but not Ch. 2-6 — is this intentional?" |
| U-008 | User opens corkboard → sees all scenes as cards → drags to reorder → double-clicks card → opens prose editor |
| U-009 | User exports project → selects format (ePub / PDF / docx) → file saved to user-chosen location |
| U-010 | User opens version history for a chapter → sees list of snapshots → restores a prior version |
| U-011 | User creates a custom world-building category "Languages" → defines custom fields → creates entries |

---

## 7. Requirements

### 7.1 Functional Requirements (FR-###)

| ID | Priority | Requirement |
|----|----------|-------------|
| FR-001 | P0 | App must detect Ollama at `http://localhost:11434` on launch and display an onboarding screen with install instructions if not found |
| FR-002 | P0 | User must be able to create a new project by specifying a name, genre, and save location |
| FR-003 | P0 | Each project must be stored as a single portable folder containing `loresmith.db` and `/prose/` |
| FR-004 | P0 | App must provide a rich-text prose editor (TipTap) per chapter with autosave every 30 seconds |
| FR-005 | P0 | App must support these world-building entity categories: Characters, Locations, Lore/Magic Systems, Timeline Events, Factions/Organizations, Items/Artifacts |
| FR-006 | P0 | Each entity category must have a structured default template adapted to its type |
| FR-007 | P0 | Users must be able to add free-form notes to any entity entry in addition to structured fields |
| FR-008 | P0 | Entity names in prose must be auto-detected on save and rendered as clickable underlined marks |
| FR-009 | P0 | Clicking an entity mark in prose must open the entity profile in a side panel within 200ms |
| FR-010 | P0 | User must be able to type `@` in prose to trigger an autocomplete dropdown of all entity names |
| FR-011 | P0 | App must maintain a SQLite-backed vector index of all world-building entries and prose chunks |
| FR-012 | P0 | AI chat panel must answer natural-language questions about the user's world using RAG retrieval |
| FR-013 | P0 | AI must surface connection suggestions (e.g., "Character A hasn't appeared since Ch. 3") in AI panel |
| FR-014 | P0 | Chapter prose must be autosaved to disk as `.md` files in `/prose/` every 30 seconds and on close |
| FR-015 | P0 | App must support creating, reordering, and deleting chapters and scenes |
| FR-016 | P1 | Corkboard view must display all scenes as drag-and-drop cards that can be reordered |
| FR-017 | P1 | Relationship graph must display all entities as nodes with edges for explicitly linked relationships |
| FR-018 | P1 | App must detect timeline/location conflicts (e.g., same character in two places at same time) and surface them in a Conflicts panel |
| FR-019 | P1 | App must store up to 50 version history snapshots per chapter file with restore capability |
| FR-020 | P1 | App must export the full manuscript to ePub, PDF, and .docx formats via bundled pandoc |
| FR-021 | P1 | Genre-adaptive UI theme must apply to the project workspace (Fantasy and Neutral at v1) |
| FR-022 | P1 | Users must be able to create custom world-building categories with user-defined fields |
| FR-023 | P1 | Users must be able to open an existing project folder from any location on disk |
| FR-024 | P1 | App must display a sidebar of related entities while the user is writing in a chapter |
| FR-025 | P2 | Users must be able to create and save custom UI themes as JSON token files |
| FR-026 | P2 | AI panel must allow the user to configure which Ollama model to use in settings |
| FR-027 | P2 | App must display a donate CTA (link to Ko-fi/GitHub Sponsors) in the About screen |

### 7.2 Non-Functional Requirements (NFR-###)

| ID | Requirement |
|----|-------------|
| NFR-001 | App must launch to a usable state in ≤ 3 seconds on minimum spec hardware |
| NFR-002 | Entity name detection pass must complete in ≤ 500ms for chapters up to 10,000 words |
| NFR-003 | AI RAG response must return within 30 seconds on minimum spec hardware with llama3 |
| NFR-004 | All data must remain on-device; no network calls except to local Ollama endpoint |
| NFR-005 | App binary must be ≤ 100MB (excluding Ollama and bundled pandoc) |
| NFR-006 | App must not crash or lose data if Ollama becomes unavailable mid-session |
| NFR-007 | Vector re-indexing of a changed document must complete in ≤ 5 seconds |
| NFR-008 | Project folder must be fully functional after being copied to another machine with Loresmith installed |
| NFR-009 | App must support macOS 12+ (arm64 + x64) and Windows 10+ (x64) |
| NFR-010 | All Tauri IPC commands must validate input types before processing |

### 7.3 Out of Scope Requirements

- Any form of cloud storage, sync, or remote backup
- Collaboration or multiplayer features
- Mobile platforms
- Grammar/spell checking engine
- In-app Ollama model management (download, delete models)
- Plugin/extension marketplace
- Analytics or crash reporting
- AI-assisted prose autocomplete (AI answers questions only; does not write prose)

---

## 8. Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| App launch time | ≤ 3s | Playwright e2e timer from process start to interactive state |
| Entity click → profile open | ≤ 200ms | UI timing test in Playwright |
| AI answer accuracy on test world | ≥ 80% correct on 20-question suite | Manual evaluation with seeded test project |
| Export validity | 100% of exports open without error | Acceptance tests open outputs in reader apps |
| Portability | Project opens after folder copy | Acceptance test: copy project folder, open on same machine with fresh app state |
| Conflict detection | ≥ 1 conflict surfaced in test scenario | Seeded test world with known conflict |
| Version history restore | Correct content restored 100% | Acceptance test: write, save, overwrite, restore |

---

## 9. System Architecture

### 9.1 High-Level Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tauri Shell (Rust)                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  React + TypeScript (Vite)                 │  │
│  │                                                           │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐  │  │
│  │  │ TipTap   │  │ World-Build  │  │   AI Chat Panel    │  │  │
│  │  │ Prose    │  │ Entity       │  │   (RAG queries)    │  │  │
│  │  │ Editor   │  │ Manager      │  │                    │  │  │
│  │  └────┬─────┘  └──────┬───────┘  └────────┬───────────┘  │  │
│  │       │               │                    │              │  │
│  │       └───────────────┴────────────────────┘              │  │
│  │                        │ Tauri IPC (invoke)                │  │
│  └────────────────────────┼───────────────────────────────────┘  │
│                           │                                       │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │                   Rust Command Layer                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ File System  │  │ SQLite       │  │ Ollama HTTP     │  │  │
│  │  │ Commands     │  │ Commands     │  │ Client          │  │  │
│  │  │ (prose I/O)  │  │ (world data) │  │ (LLM + embed)   │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │  │
│  └─────────┼────────────────┼───────────────────┼────────────┘  │
└────────────┼────────────────┼───────────────────┼────────────────┘
             │                │                   │
    ┌────────▼────────┐  ┌────▼────────────┐  ┌──▼──────────────┐
    │ /prose/*.md     │  │ loresmith.db    │  │ Ollama          │
    │ (chapter files) │  │ (SQLite + vss)  │  │ localhost:11434 │
    └─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 9.2 Component Responsibilities

| Component | Purpose | Inputs | Outputs | Dependencies |
|-----------|---------|--------|---------|-------------|
| **TipTap Editor** | Rich-text prose editing with entity marks | Keystrokes, @mention triggers | Markdown text, entity mark positions | TipTap extensions, Zustand |
| **Entity Manager** | CRUD for all world-building entities | Form data, category schema | Entity records | SQLite Commands, Zustand |
| **AI Chat Panel** | RAG query interface + proactive suggestions | User query string | LLM response text | Ollama HTTP Client, SQLite (vss) |
| **Corkboard** | Scene drag-and-drop reorder | Scene list from DB | Updated scene order | React Flow, SQLite Commands |
| **Relationship Graph** | Visual entity relationship explorer | Entity + relationship records | SVG node graph | React Flow |
| **Rust Command Layer** | All side-effectful operations exposed to frontend | Tauri `invoke()` calls | Serialized JSON responses | rusqlite, tokio, reqwest |
| **Ollama HTTP Client** | LLM completion + embedding requests | Prompt strings, text chunks | Completion text, embedding vectors | reqwest (async) |
| **SQLite + sqlite-vss** | Structured world data + vector embeddings | Entity records, embedding vectors | Query results, nearest-neighbor search | rusqlite, sqlite-vss |
| **File System Commands** | Prose file read/write/snapshot | Chapter ID, Markdown content | Written files, snapshot list | Tauri fs API |

### 9.3 Runtime Model

**User writes prose:**
1. TipTap editor keystroke → Zustand local state update
2. Debounce timer (1500ms) fires → `invoke("detect_entities")` → Rust scans prose with Aho-Corasick against entity name list → returns positions
3. TipTap applies entity marks at returned positions
4. Autosave timer (30s) fires → `invoke("save_chapter")` → Rust writes `.md` file → triggers incremental re-embedding

**AI query:**
1. User submits query in AI panel → `invoke("ai_query", { query })` 
2. Rust embeds query via Ollama `/api/embeddings`
3. sqlite-vss nearest-neighbor search over world-building entries + prose chunks (top 8)
4. Rust constructs prompt: system context + retrieved chunks + user query
5. Ollama `/api/generate` streams response
6. Rust streams tokens back to frontend via Tauri event emitter

**Background jobs (no queue, Tokio tasks):**
- Incremental re-embedding: triggered after each chapter save, processes only changed documents
- Conflict detection: triggered after each entity or timeline event save, runs deterministic rule set

### 9.4 Error Handling Strategy

| Error Class | Handling |
|-------------|---------|
| Ollama unreachable | Show persistent banner in AI panel; disable AI features; show retry button |
| SQLite write failure | Surface modal error; do not discard in-memory state; offer manual save to alternate location |
| Prose file write failure | Retry 3 times with 500ms backoff; if all fail, alert user with path and error |
| Entity detection timeout (> 500ms) | Log warning; skip mark update for this cycle; try again on next save |
| Embedding failure | Skip re-index for that document; mark as "pending re-index" in DB; retry on next save |
| Export (pandoc) failure | Show error dialog with stderr output; keep project data intact |
| Invalid IPC input | Tauri command returns structured error `{ code, message }`; frontend shows toast notification |

---

## 10. Tech Stack

### 10.1 Selected Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop shell | Tauri | 2.x |
| Backend language | Rust | stable (1.76+) |
| Frontend framework | React | 18.x |
| Frontend language | TypeScript | 5.x |
| Bundler | Vite | 5.x |
| Prose editor | TipTap | 2.x |
| State management | Zustand | 4.x |
| UI styling | Tailwind CSS | 3.x |
| Node graph / corkboard | React Flow | 11.x |
| DB | SQLite via rusqlite | latest |
| Vector search | sqlite-vss | 0.1.x (bundled sidecar) |
| LLM + embeddings | Ollama REST API | any local version |
| Export | pandoc (bundled sidecar) | 3.x |
| Unit/integration tests | Vitest | 1.x |
| E2E tests | Playwright | 1.x |
| Linting | ESLint + Clippy (Rust) | — |
| Formatting | Prettier + rustfmt | — |

### 10.2 Why This Stack

- **Tauri over Electron**: 10-20x smaller binary, native OS APIs, Rust safety guarantees for file I/O and DB ops.
- **TipTap**: Only mature ProseMirror wrapper with first-class custom mark support needed for entity linking.
- **sqlite-vss**: Keeps vector store co-located with world data in one file; no separate vector DB process.
- **Ollama**: Only local LLM runner with a stable REST API, model-agnostic, and free.
- **Zustand over Redux**: Minimal boilerplate; sufficient for this app's state complexity.
- **React Flow**: Best-in-class force-directed graph for React; handles hundreds of nodes performantly.

### 10.3 Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Electron | Binary ~150MB+, slower startup, higher RAM usage |
| Slate.js | Less maintained than TipTap; no built-in mark extensions |
| Qdrant / Chroma | Requires separate process; adds installation complexity |
| LM Studio SDK | Ollama has broader model support and simpler REST interface |
| Redux Toolkit | Overkill for this app's state shape; Zustand is sufficient |
| Lexical (Meta) | Younger ecosystem; fewer community extensions |

---

## 11. Data Design

### 11.1 Entities and Schemas

#### Table: `projects`
| Field | Type | Required | Constraints |
|-------|------|----------|------------|
| id | TEXT (UUID) | Yes | PRIMARY KEY |
| name | TEXT | Yes | NOT NULL, max 200 chars |
| genre | TEXT | Yes | One of: fantasy, sci-fi, horror, romance, mystery, historical, contemporary, custom |
| theme_token_file | TEXT | No | Path to custom theme JSON; NULL uses built-in genre theme |
| created_at | INTEGER | Yes | Unix timestamp |
| updated_at | INTEGER | Yes | Unix timestamp |

#### Table: `entity_categories`
| Field | Type | Required | Constraints |
|-------|------|----------|------------|
| id | TEXT (UUID) | Yes | PRIMARY KEY |
| project_id | TEXT | Yes | FK → projects.id |
| name | TEXT | Yes | NOT NULL, max 100 chars |
| icon | TEXT | No | Emoji or icon key string |
| is_builtin | INTEGER | Yes | 0 or 1; built-in categories cannot be deleted |
| field_schema | TEXT (JSON) | Yes | JSON array of field definitions |
| sort_order | INTEGER | Yes | Display order |

#### Table: `entities`
| Field | Type | Required | Constraints |
|-------|------|----------|------------|
| id | TEXT (UUID) | Yes | PRIMARY KEY |
| project_id | TEXT | Yes | FK → projects.id |
| category_id | TEXT | Yes | FK → entity_categories.id |
| name | TEXT | Yes | NOT NULL, max 200 chars |
| aliases | TEXT (JSON) | No | JSON array of strings |
| structured_data | TEXT (JSON) | Yes | JSON object matching category field_schema |
| notes | TEXT | No | Free-form Markdown |
| created_at | INTEGER | Yes | Unix timestamp |
| updated_at | INTEGER | Yes | Unix timestamp |

**Indexes:** `(project_id)`, `(category_id)`, `(project_id, name)`

#### Table: `relationships`
| Field | Type | Required | Constraints |
|-------|------|----------|------------|
| id | TEXT (UUID) | Yes | PRIMARY KEY |
| project_id | TEXT | Yes | FK → projects.id |
| from_entity_id | TEXT | Yes | FK → entities.id |
| to_entity_id | TEXT | Yes | FK → entities.id |
| label | TEXT | No | e.g. "ally of", "located in" |
| created_at | INTEGER | Yes | Unix timestamp |

**Indexes:** `(project_id)`, `(from_entity_id)`, `(to_entity_id)`

#### Table: `chapters`
| Field | Type | Required | Constraints |
|-------|------|----------|------------|
| id | TEXT (UUID) | Yes | PRIMARY KEY |
| project_id | TEXT | Yes | FK → projects.id |
| title | TEXT | Yes | NOT NULL, max 300 chars |
| sort_order | INTEGER | Yes | Determines chapter sequence |
| prose_file | TEXT | Yes | Relative path e.g. `prose/<id>.md` |
| word_count | INTEGER | No | Cached; updated on save |
| created_at | INTEGER | Yes | Unix timestamp |
| updated_at | INTEGER | Yes | Unix timestamp |

#### Table: `scenes`
| Field | Type | Required | Constraints |
|-------|------|----------|------------|
| id | TEXT (UUID) | Yes | PRIMARY KEY |
| chapter_id | TEXT | Yes | FK → chapters.id |
| project_id | TEXT | Yes | FK → projects.id |
| title | TEXT | Yes | NOT NULL |
| summary | TEXT | No | Short description shown on corkboard card |
| sort_order | INTEGER | Yes | Within-chapter scene order |
| pov_entity_id | TEXT | No | FK → entities.id (POV character) |
| timeline_position | TEXT | No | ISO date string or narrative label |

#### Table: `timeline_events`
| Field | Type | Required | Constraints |
|-------|------|----------|------------|
| id | TEXT (UUID) | Yes | PRIMARY KEY |
| project_id | TEXT | Yes | FK → projects.id |
| title | TEXT | Yes | NOT NULL |
| description | TEXT | No | — |
| event_date | TEXT | No | Narrative or ISO date |
| entity_ids | TEXT (JSON) | No | JSON array of participating entity IDs |
| location_entity_id | TEXT | No | FK → entities.id (must be Location category) |

#### Table: `version_snapshots`
| Field | Type | Required | Constraints |
|-------|------|----------|------------|
| id | TEXT (UUID) | Yes | PRIMARY KEY |
| chapter_id | TEXT | Yes | FK → chapters.id |
| content | TEXT | Yes | Full Markdown content at snapshot time |
| created_at | INTEGER | Yes | Unix timestamp |

**Constraints:** Max 50 rows per `chapter_id`. On insert of 51st, delete oldest.

#### Table: `embeddings` (virtual, sqlite-vss)
| Field | Type | Notes |
|-------|------|-------|
| rowid | INTEGER | Maps to `embedding_documents.id` |
| embedding | vector(768) | nomic-embed-text output dimension |

#### Table: `embedding_documents`
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER | PRIMARY KEY autoincrement |
| project_id | TEXT | FK → projects.id |
| source_type | TEXT | `entity` or `prose` |
| source_id | TEXT | entity UUID or chapter UUID |
| chunk_index | INTEGER | For prose chunks |
| content | TEXT | The embedded text |
| updated_at | INTEGER | For incremental re-index detection |

### 11.2 Migrations and Seeding Plan

- Migrations run automatically on project open via embedded SQL migration runner (simple versioned SQL files).
- Migration `001_initial.sql`: Creates all tables above.
- Migration `002_vss.sql`: Loads sqlite-vss extension and creates virtual table.
- **Seed data (built-in categories):** On new project creation, insert 6 built-in entity categories (Characters, Locations, Lore/Magic Systems, Timeline Events, Factions/Organizations, Items/Artifacts) with their default `field_schema` per genre.

### 11.3 Example Records

**Entity (Character):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "project_id": "proj-uuid",
  "category_id": "cat-characters-uuid",
  "name": "Elara Voss",
  "aliases": ["The Pale Witch", "Elara of Ashford"],
  "structured_data": {
    "age": "34",
    "eye_color": "silver",
    "faction": "faction-uuid-of-silver-court",
    "status": "alive",
    "first_appearance": "Chapter 1"
  },
  "notes": "Elara is motivated by revenge against the Conclave...",
  "created_at": 1712000000,
  "updated_at": 1712001000
}
```

**Chapter:**
```json
{
  "id": "chap-uuid",
  "project_id": "proj-uuid",
  "title": "The Breaking of the Gate",
  "sort_order": 3,
  "prose_file": "prose/chap-uuid.md",
  "word_count": 4721,
  "created_at": 1712000000,
  "updated_at": 1712005000
}
```

---

## 12. API and Interface Contracts

All API surface is Tauri IPC commands (`invoke`). No HTTP server. No REST API exposed externally.

### 12.1 Authentication & Authorization Model

No authentication. All data is local. The OS file system permissions are the only access control. No user accounts, no roles.

### 12.2 Rate Limiting / Abuse Prevention

- Ollama calls: debounced at UI layer. No concurrent AI requests; queue of 1 (cancel previous if new arrives).
- Entity detection: debounced to 1500ms after last keystroke per chapter.
- Re-embedding: max 1 concurrent embedding job; new saves queue behind the running job.

### 12.3 Pagination / Filtering / Sorting

- Entity lists: filtered by `category_id` and `project_id`; sorted by `name` ASC by default; client-side pagination (virtual list) for large collections.
- Chapter list: sorted by `sort_order` ASC.
- Scene list: sorted by `sort_order` ASC within chapter.

---

### Tauri IPC Command Contracts

#### `create_project`
- **Input:** `{ name: string, genre: string, save_path: string }`
- **Output:** `{ id: string, name: string, genre: string, created_at: number }`
- **Errors:** `PATH_NOT_WRITABLE`, `NAME_EMPTY`, `GENRE_INVALID`
- **Side effects:** Creates folder at `save_path/<slug-name>/`, creates `loresmith.db`, runs migrations, seeds built-in categories, creates `/prose/` subdirectory

#### `open_project`
- **Input:** `{ folder_path: string }`
- **Output:** `{ project: Project, chapters: Chapter[], entity_counts: Record<string, number> }`
- **Errors:** `NOT_A_LORESMITH_PROJECT`, `DB_MIGRATION_FAILED`

#### `save_chapter`
- **Input:** `{ chapter_id: string, content: string }`
- **Output:** `{ word_count: number, snapshot_created: boolean }`
- **Side effects:** Writes `.md` file, creates version snapshot, triggers incremental re-embed

#### `detect_entities`
- **Input:** `{ project_id: string, prose: string }`
- **Output:** `{ matches: Array<{ entity_id: string, name: string, start: number, end: number }> }`
- **Validation:** `prose` max 100,000 chars

#### `create_entity`
- **Input:** `{ project_id: string, category_id: string, name: string, aliases: string[], structured_data: object, notes: string }`
- **Output:** `{ id: string, ...entity fields }`
- **Errors:** `NAME_EMPTY`, `NAME_TOO_LONG`, `CATEGORY_NOT_FOUND`

#### `update_entity`
- **Input:** `{ id: string, name?: string, aliases?: string[], structured_data?: object, notes?: string }`
- **Output:** Updated entity object
- **Side effects:** Triggers re-embedding of entity document

#### `delete_entity`
- **Input:** `{ id: string }`
- **Output:** `{ deleted: true }`
- **Side effects:** Removes entity, removes its embedding document, removes relationships where entity is from or to

#### `get_entities`
- **Input:** `{ project_id: string, category_id?: string, search?: string }`
- **Output:** `Array<Entity>`

#### `create_relationship`
- **Input:** `{ project_id: string, from_entity_id: string, to_entity_id: string, label?: string }`
- **Output:** Relationship object
- **Errors:** `SELF_RELATIONSHIP` (from === to)

#### `ai_query`
- **Input:** `{ project_id: string, query: string }`
- **Output:** Stream of `{ token: string }` via Tauri event `ai_token_<project_id>`, followed by `ai_done_<project_id>`
- **Errors:** `OLLAMA_UNREACHABLE`, `EMBEDDING_FAILED`

#### `check_ollama`
- **Input:** `{}`
- **Output:** `{ available: boolean, models: string[] }`

#### `get_conflicts`
- **Input:** `{ project_id: string }`
- **Output:** `Array<{ type: string, description: string, entity_ids: string[], scene_ids: string[] }>`

#### `export_project`
- **Input:** `{ project_id: string, format: "epub" | "pdf" | "docx", output_path: string }`
- **Output:** `{ success: true, output_path: string }`
- **Errors:** `PANDOC_NOT_FOUND`, `EXPORT_FAILED`
- **Side effects:** Invokes bundled pandoc sidecar

#### `get_version_snapshots`
- **Input:** `{ chapter_id: string }`
- **Output:** `Array<{ id: string, created_at: number, word_count: number }>`

#### `restore_snapshot`
- **Input:** `{ snapshot_id: string }`
- **Output:** `{ content: string }`
- **Side effects:** Does NOT automatically overwrite current prose; frontend must call `save_chapter` after user confirms

#### `create_custom_category`
- **Input:** `{ project_id: string, name: string, icon?: string, field_schema: FieldDef[] }`
- **Output:** Created category object

#### `reorder_chapters`
- **Input:** `{ project_id: string, chapter_ids: string[] }`
- **Output:** `{ updated: number }`

#### `reorder_scenes`
- **Input:** `{ chapter_id: string, scene_ids: string[] }`
- **Output:** `{ updated: number }`

---

## 13. Business Logic Rules

| ID | Rule |
|----|------|
| BL-001 | An entity name must be ≥ 3 characters to qualify for auto-detection in prose |
| BL-002 | Entity name matching in prose is case-insensitive; stored with original casing |
| BL-003 | All entity aliases are included in the Aho-Corasick match dictionary alongside the primary name |
| BL-004 | A "suppressed detection" is stored per (project_id, entity_id, prose_position_hash); suppressed detections are never re-surfaced |
| BL-005 | Version snapshots are created on every `save_chapter` call IF content differs from the most recent snapshot |
| BL-006 | Maximum 50 snapshots per chapter; on insert of the 51st, the snapshot with the oldest `created_at` is deleted |
| BL-007 | Conflict detection rule: if two timeline events share the same `event_date` and both include the same `entity_id` and different `location_entity_id` values, a conflict of type `LOCATION_CONFLICT` is raised |
| BL-008 | Conflict detection rule: if a scene's `pov_entity_id` references an entity whose status is "deceased" and the scene's `timeline_position` is after the entity's death event, a conflict of type `DEAD_CHARACTER_ACTIVE` is raised |
| BL-009 | RAG context window: top 8 nearest-neighbor chunks retrieved; world-building entity chunks are weighted 2x versus prose chunks in ranking |
| BL-010 | AI system prompt must include: project name, genre, instruction to only answer based on provided context, and instruction to say "I don't know" if context is insufficient |
| BL-011 | Re-embedding is incremental: only documents whose `updated_at` is newer than their embedding's `updated_at` are re-embedded |
| BL-012 | Deleting a built-in category is forbidden; the `delete_category` command must return `BUILTIN_CATEGORY_PROTECTED` |
| BL-013 | `@mention` autocomplete triggers on `@` character followed by ≥ 1 additional character; results are filtered by prefix match on entity name |
| BL-014 | On `delete_entity`, all prose marks referencing that entity ID must be removed from all chapter prose files on next open (lazy cleanup on chapter load) |
| BL-015 | Export compiles chapters in `sort_order` ASC; scenes within chapters in `sort_order` ASC |

---

## 14. Edge Cases

| ID | Edge Case | Related FR | Handling |
|----|-----------|-----------|---------|
| EC-001 | User renames an entity after prose marks are applied | FR-008 | Old marks remain valid (stored by entity ID not name); name update propagates to mark tooltip on next detection pass |
| EC-002 | Two entities share the same name | FR-008 | Detection matches both; ambiguity is surfaced in mark tooltip with "which entity?" picker |
| EC-003 | Ollama goes offline mid-session | FR-012 | AI panel shows "Ollama disconnected" banner; prose editor remains fully functional |
| EC-004 | Project folder is moved while app is open | FR-003 | Rust file watcher detects missing path; shows dialog to relocate project folder |
| EC-005 | Chapter prose file deleted externally | FR-004 | On next autosave, file is recreated with in-memory content; warning toast shown |
| EC-006 | sqlite-vss not supported on user's OS/arch | FR-011 | App detects missing extension at startup; AI features disabled with explanation; prose/world-building still function |
| EC-007 | User creates a custom category with no fields | FR-022 | Allowed; category exists with only the free-form notes section |
| EC-008 | Pandoc not found in sidecar path | FR-020 | Export returns `PANDOC_NOT_FOUND` error; dialog explains issue |
| EC-009 | Chapter with 0 words | FR-004 | Allowed; word count = 0; no prose chunks generated for embedding |
| EC-010 | User restores snapshot then immediately closes without saving | FR-019 | Restoration only loads content into editor state; nothing is written to disk until `save_chapter` is called |
| EC-011 | Entity has 0 structured fields (custom category) | FR-022 | Entity profile shows only name, aliases, and notes; no structured fields panel rendered |
| EC-012 | Project name contains characters invalid for folder names | FR-002 | Slug is sanitized (`/[^a-z0-9-]/g` replaced with `-`); display name stored separately in DB |
| EC-013 | 50-snapshot cap hit on active chapter | FR-019 | Oldest snapshot silently deleted; no user-facing warning unless they open version history panel |
| EC-014 | User opens a non-Loresmith folder | FR-023 | `NOT_A_LORESMITH_PROJECT` error shown; folder not added to recent projects |
| EC-015 | Genre set to "custom" with no theme file | FR-021 | Falls back to Neutral theme; no crash |

---

## 15. Observability

### 15.1 Logging

All logs written to a rotating local log file at the OS app data directory (`~/.local/share/loresmith/loresmith.log` on Linux, `~/Library/Application Support/loresmith/` on Mac, `%APPDATA%\loresmith\` on Windows).

| Event | Level | Structured Fields |
|-------|-------|-----------------|
| App launch | INFO | `version`, `platform`, `ollama_available` |
| Project open | INFO | `project_id`, `chapter_count`, `entity_count` |
| Chapter save | DEBUG | `chapter_id`, `word_count`, `snapshot_created`, `duration_ms` |
| Entity detection | DEBUG | `chapter_id`, `match_count`, `duration_ms` |
| AI query sent | INFO | `project_id`, `query_length` (no query text logged) |
| AI response received | INFO | `project_id`, `response_length`, `duration_ms` |
| Embedding job | DEBUG | `project_id`, `documents_embedded`, `duration_ms` |
| Export | INFO | `project_id`, `format`, `success`, `duration_ms` |
| Error | ERROR | `command`, `error_code`, `message` |
| Ollama unreachable | WARN | `endpoint`, `attempt` |

### 15.2 Metrics

Tracked in-memory per session; written to log on app close.

| Metric | Type |
|--------|------|
| `chapters_saved_count` | Counter |
| `ai_queries_count` | Counter |
| `ai_query_duration_ms` | Histogram (log on each query) |
| `entity_detection_duration_ms` | Histogram |
| `embedding_jobs_count` | Counter |
| `export_success_count` | Counter |
| `export_failure_count` | Counter |

### 15.3 Tracing

Not applicable for v1 (single-user local app).

### 15.4 Alerts

Not applicable (no remote infrastructure). App surfaces critical issues via in-app banners and dialogs.

---

## 16. Security and Privacy

| Concern | Approach |
|---------|---------|
| **No outbound network** | All network calls are to `localhost:11434` (Ollama). Tauri CSP must whitelist only `localhost:11434`; block all other origins |
| **No PII exfiltration** | No telemetry, analytics, or crash reporting. No data ever leaves the machine |
| **Input validation** | All Tauri IPC command inputs validated in Rust before DB access; max lengths enforced; types checked |
| **SQL injection** | All SQLite queries use `rusqlite` parameterized queries; no string interpolation in SQL |
| **Path traversal** | All file paths resolved through `tauri::api::path`; validate that resolved path is within project folder |
| **Arbitrary file writes** | `save_chapter` validates that target path matches `<project_folder>/prose/<chapter_id>.md` pattern |
| **Dependency security** | Rust dependencies audited via `cargo audit`; npm dependencies via `npm audit`; run in CI |
| **sqlite-vss sidecar** | Bundled binary hash verified at startup against hardcoded SHA-256 checksum |
| **pandoc sidecar** | Same: hardcoded SHA-256 checksum verified before invocation |
| **User data ownership** | All data in a user-chosen folder; user can delete, backup, or move freely |

---

## 17. Repository Blueprint

### 17.1 Folder Structure (TREE)

```
/loresmith
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── docs/
│   ├── architecture.md
│   ├── theme-schema.md
│   └── custom-categories.md
├── src-tauri/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── sidecars/
│   │   ├── pandoc-<platform>
│   │   └── sqlite-vss-<platform>.so/.dll
│   └── src/
│       ├── main.rs
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── project.rs
│       │   ├── entity.rs
│       │   ├── chapter.rs
│       │   ├── scene.rs
│       │   ├── ai.rs
│       │   ├── export.rs
│       │   └── snapshot.rs
│       ├── db/
│       │   ├── mod.rs
│       │   ├── migrations.rs
│       │   ├── schema.rs
│       │   └── migrations/
│       │       ├── 001_initial.sql
│       │       └── 002_vss.sql
│       ├── entity_detection/
│       │   └── mod.rs
│       ├── ollama/
│       │   └── mod.rs
│       ├── rag/
│       │   └── mod.rs
│       ├── conflict_detection/
│       │   └── mod.rs
│       └── errors.rs
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── MainContent.tsx
│   │   ├── editor/
│   │   │   ├── ProseEditor.tsx
│   │   │   ├── EntityMark.tsx
│   │   │   ├── MentionAutocomplete.tsx
│   │   │   └── EntitySidebar.tsx
│   │   ├── worldbuilding/
│   │   │   ├── EntityManager.tsx
│   │   │   ├── EntityProfile.tsx
│   │   │   ├── EntityForm.tsx
│   │   │   └── CategoryManager.tsx
│   │   ├── ai/
│   │   │   ├── AiPanel.tsx
│   │   │   ├── AiMessage.tsx
│   │   │   └── OllamaOnboarding.tsx
│   │   ├── graph/
│   │   │   └── RelationshipGraph.tsx
│   │   ├── corkboard/
│   │   │   ├── Corkboard.tsx
│   │   │   └── SceneCard.tsx
│   │   ├── timeline/
│   │   │   └── TimelineView.tsx
│   │   ├── conflicts/
│   │   │   └── ConflictsPanel.tsx
│   │   ├── export/
│   │   │   └── ExportDialog.tsx
│   │   └── common/
│   │       ├── Toast.tsx
│   │       ├── Modal.tsx
│   │       └── Button.tsx
│   ├── hooks/
│   │   ├── useProject.ts
│   │   ├── useEntities.ts
│   │   ├── useChapter.ts
│   │   └── useAi.ts
│   ├── store/
│   │   ├── projectStore.ts
│   │   ├── entityStore.ts
│   │   ├── chapterStore.ts
│   │   └── uiStore.ts
│   ├── themes/
│   │   ├── fantasy.json
│   │   └── neutral.json
│   ├── lib/
│   │   ├── ipc.ts
│   │   └── utils.ts
│   └── types/
│       └── index.ts
├── tests/
│   ├── unit/
│   │   ├── entity-detection.test.ts
│   │   ├── conflict-detection.test.ts
│   │   └── rag.test.rs
│   ├── integration/
│   │   ├── db.test.rs
│   │   └── ollama-client.test.rs
│   └── e2e/
│       ├── create-project.spec.ts
│       ├── entity-linking.spec.ts
│       ├── ai-query.spec.ts
│       ├── export.spec.ts
│       └── version-history.spec.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── vitest.config.ts
├── playwright.config.ts
└── README.md
```

### 17.2 File Responsibilities

| File / Folder | Purpose |
|--------------|---------|
| `src-tauri/src/commands/` | Each file exposes Tauri `#[tauri::command]` functions for one domain |
| `src-tauri/src/db/migrations.rs` | Runs versioned SQL migrations on project open |
| `src-tauri/src/entity_detection/mod.rs` | Aho-Corasick automaton builder and prose scanner |
| `src-tauri/src/ollama/mod.rs` | HTTP client for Ollama `/api/generate` and `/api/embeddings` |
| `src-tauri/src/rag/mod.rs` | Chunk splitter, embedding job runner, sqlite-vss query logic |
| `src-tauri/src/conflict_detection/mod.rs` | Deterministic conflict rules engine |
| `src-tauri/src/errors.rs` | Centralized error enum with serializable codes |
| `src/store/` | Zustand stores; one per domain |
| `src/lib/ipc.ts` | Typed wrappers around `invoke()` for all Tauri commands |
| `src/themes/` | JSON token files for genre UI themes |
| `src/components/editor/ProseEditor.tsx` | TipTap instance with entity mark extension and @mention extension |
| `tests/e2e/` | Playwright specs that launch the app and test full user flows |
| `docs/theme-schema.md` | Documents JSON token schema for community custom themes |

### 17.3 Environment Variables

```env
# .env.example

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama3
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Sidecar paths (resolved at build time by Tauri; override for dev)
PANDOC_SIDECAR_PATH=./src-tauri/sidecars/pandoc
SQLITE_VSS_PATH=./src-tauri/sidecars/sqlite-vss.so

# App
LORESMITH_LOG_LEVEL=info
LORESMITH_MAX_SNAPSHOTS=50
LORESMITH_AUTOSAVE_INTERVAL_MS=30000
LORESMITH_DETECT_DEBOUNCE_MS=1500
LORESMITH_RAG_TOP_K=8

# Donate link (Implementation-required addition)
LORESMITH_DONATE_URL=https://ko-fi.com/loresmith
```

### 17.4 Commands and Scripts

| Command | Script |
|---------|--------|
| Install all dependencies | `npm install` |
| Run in development | `npm run tauri dev` |
| Build production binary | `npm run tauri build` |
| Run frontend unit tests | `npm run test` (Vitest) |
| Run Rust unit tests | `cargo test --manifest-path src-tauri/Cargo.toml` |
| Run e2e tests | `npm run test:e2e` (Playwright) |
| Lint frontend | `npm run lint` (ESLint) |
| Format frontend | `npm run format` (Prettier) |
| Lint Rust | `cargo clippy --manifest-path src-tauri/Cargo.toml` |
| Format Rust | `cargo fmt --manifest-path src-tauri/Cargo.toml` |
| Audit Rust deps | `cargo audit --manifest-path src-tauri/Cargo.toml` |
| Audit npm deps | `npm audit` |

---

## 18. Testing Plan

### 18.1 Test Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Rust unit | `cargo test` | DB queries, entity detection, conflict rules, RAG chunking, Ollama client mocks |
| TS unit | Vitest | IPC type wrappers, theme token resolution, store reducers, utility functions |
| Integration | `cargo test` with test DB | Migration runner, full save/restore cycle, embedding pipeline with mock Ollama |
| E2E | Playwright | Full user flows from app launch through all P0 features |

### 18.2 Minimum Test Coverage Requirements

- Rust: 80% line coverage on `commands/`, `entity_detection/`, `conflict_detection/`, `rag/`
- TypeScript: 70% line coverage on `store/`, `lib/`
- E2E: All P0 functional requirements must have a corresponding acceptance test

### 18.3 Acceptance Tests (AT-###)

| ID | FR | Steps | Pass Criteria |
|----|----|----|--------------|
| AT-001 | FR-001 | Launch app without Ollama running → observe UI | Onboarding screen shown; prose editor still accessible |
| AT-002 | FR-002 | Click "New Project" → enter name "Ember Rising" → select "Fantasy" → choose save path → confirm | Project folder created at path; `loresmith.db` present; `/prose/` folder present; Fantasy theme applied |
| AT-003 | FR-004 | Open chapter editor → type 500 words → wait 31 seconds | `.md` file in `/prose/` contains the typed content |
| AT-004 | FR-008 | Create entity "Elara Voss" → open chapter editor → type "Elara Voss walked into the hall" → save | "Elara Voss" is underlined/marked in the editor |
| AT-005 | FR-009 | With AT-004 state: click "Elara Voss" mark in prose | Entity profile panel opens within 200ms showing Elara Voss's profile |
| AT-006 | FR-010 | In prose editor: type `@Elar` | Autocomplete dropdown appears showing "Elara Voss" |
| AT-007 | FR-012 | With a project containing Elara Voss character profile: open AI panel → ask "What are Elara's known aliases?" | AI response includes information from the entity's aliases field |
| AT-008 | FR-016 | Create 3 scenes in a chapter → open corkboard → drag scene 3 to position 1 → close and reopen | Scene order is persisted correctly |
| AT-009 | FR-017 | Create two characters → create a relationship "ally of" between them → open graph | Both characters appear as nodes; "ally of" edge connects them |
| AT-010 | FR-018 | Create character "Kael" → create two timeline events on same date, both with Kael, at different locations → open Conflicts panel | `LOCATION_CONFLICT` conflict appears referencing Kael |
| AT-011 | FR-019 | Open chapter → write version A → save → overwrite with version B → save → open version history → restore version A | Editor content reflects version A text |
| AT-012 | FR-020 | Complete project with 2 chapters → click Export → select ePub → confirm | ePub file written to disk; opens in Calibre without errors; contains 2 chapters |
| AT-013 | FR-021 | Open Fantasy-genre project | App chrome and entity profile templates reflect Fantasy theme tokens |
| AT-014 | FR-022 | Click "Add Category" → name "Languages" → add field "Script Type" (text) → save → create entry "High Elvish" | "Languages" category appears in sidebar; "High Elvish" entry saved with "Script Type" field |
| AT-015 | FR-003 | Copy project folder to a new location → open Loresmith → open copied folder | Project opens fully; all entities, chapters, and AI index function correctly |

---

## 19. Implementation Plan

### Phase 1: Scaffold & Foundations

**Goals:** Working Tauri + React app skeleton; SQLite connection; project create/open; basic navigation.

**Deliverables:**
- Tauri project initialized with React + TypeScript + Vite
- Tailwind CSS + theme token system wired
- SQLite connection pool in Rust with migration runner
- `001_initial.sql` migration (all tables except VSS)
- `create_project` and `open_project` IPC commands
- New Project wizard UI (name, genre, save path)
- Recent projects screen
- Basic sidebar navigation (Chapters, World-Building, AI, Corkboard, Graph)
- Zustand stores initialized
- ESLint, Prettier, Clippy, rustfmt configured

**Tests:** Unit tests for migration runner; `create_project` / `open_project` Rust unit tests; Playwright: app launches, new project wizard completes.

**Exit criteria:** Can create a new project, see it open, and navigate between empty panels.

---

### Phase 2: Core Data + Core Workflows

**Goals:** Full world-building CRUD; prose editor with autosave; chapter management; entity detection.

**Deliverables:**
- TipTap prose editor with Markdown serialization
- Autosave (30s) and manual save to `.md` file
- Chapter CRUD + reorder (`reorder_chapters`)
- Scene CRUD + reorder (`reorder_scenes`)
- Entity CRUD for all 6 built-in categories with structured templates
- `create_entity`, `update_entity`, `delete_entity`, `get_entities` commands
- Entity profile view with structured fields + notes
- Aho-Corasick entity detection on save (`detect_entities`)
- TipTap `EntityMark` extension: underline marks + click handler
- Entity profile side panel (opens on mark click)
- `@mention` autocomplete extension in TipTap

**Tests:** Rust unit tests for Aho-Corasick detection; entity CRUD DB tests; Playwright: create entity, write prose, click mark, verify panel opens.

**Exit criteria:** AT-002, AT-003, AT-004, AT-005, AT-006 pass.

---

### Phase 3: AI, Graph, Corkboard, Export, Version History

**Goals:** All remaining P0 and P1 features.

**Deliverables:**
- `002_vss.sql` migration; sqlite-vss extension loaded
- Ollama HTTP client (`ollama/mod.rs`)
- RAG embedding pipeline (`rag/mod.rs`): chunk, embed, store, incremental update
- `ai_query` command with streaming via Tauri events
- AI chat panel UI with streaming response display
- `check_ollama` command + Ollama onboarding screen
- Proactive AI suggestions (connection and conflict hints)
- Relationship graph UI (React Flow)
- `create_relationship` / `get_relationships` commands
- Corkboard view (React Flow card grid, drag-to-reorder)
- Conflict detection engine + Conflicts panel
- Version snapshot system (`save_chapter` snapshots, `get_version_snapshots`, `restore_snapshot`)
- Export dialog + `export_project` command with bundled pandoc
- Genre theme tokens: Fantasy + Neutral applied via CSS variables

**Tests:** Rust integration tests for RAG pipeline with mock Ollama; conflict detection unit tests; Playwright: AT-007 through AT-014.

**Exit criteria:** All P0 and P1 acceptance tests pass.

---

### Phase 4: Edge Cases + Security + Performance

**Goals:** All EC-### cases handled; security rules enforced; performance targets met.

**Deliverables:**
- Entity rename → mark preservation logic (BL-001 to BL-004)
- Ambiguous entity name picker in prose mark tooltip (EC-002)
- Ollama mid-session disconnect handling (EC-003)
- Project folder relocation detection (EC-004)
- sqlite-vss not available graceful degradation (EC-006)
- Path traversal guard in all file-writing commands
- SQL parameterization audit pass
- All Tauri IPC input validation complete
- sidecar SHA-256 verification for pandoc and sqlite-vss
- Tauri CSP configured to whitelist only `localhost:11434`
- Performance profiling: entity detection ≤ 500ms, app launch ≤ 3s
- `cargo audit` and `npm audit` pass with no high/critical issues

**Tests:** Unit tests for each EC; Playwright: EC-003 (kill Ollama mid-session), EC-004 (move project folder); performance timing assertions in Playwright.

**Exit criteria:** All edge cases have tests; security audit passes; NFR-001, NFR-002, NFR-003 validated.

---

### Phase 5: Observability + Polish + Final QA

**Goals:** Logging complete; UI polish; custom categories P2 feature; full acceptance test suite green.

**Deliverables:**
- Structured logging to local rotating log file (all events from Section 15.1)
- In-memory session metrics written to log on close
- Custom world-building categories UI (`create_custom_category`, `CategoryManager.tsx`)
- Ollama model selector in settings (`FR-026`)
- Donate CTA in About screen (`FR-027`)
- Toast notification system for all error codes
- `docs/theme-schema.md` written
- `docs/custom-categories.md` written
- `README.md` with install, usage, and Ollama setup instructions
- Full AT-001 through AT-015 green
- `cargo audit` + `npm audit` clean

**Tests:** Full e2e suite run; manual smoke test on Mac (arm64) and Windows (x64) release builds.

**Exit criteria:** Final checklist below fully satisfied; release binaries produce.

---

## 20. Final Checklist

- [ ] All P0 functional requirements (FR-001 to FR-015) are implemented and acceptance tests pass
- [ ] All P1 functional requirements (FR-016 to FR-024) are implemented and acceptance tests pass
- [ ] All P2 functional requirements (FR-025 to FR-027) are implemented
- [ ] All 15 acceptance tests (AT-001 to AT-015) pass on Mac arm64
- [ ] All 15 acceptance tests pass on Windows x64
- [ ] App launch time ≤ 3s on minimum spec hardware (NFR-001)
- [ ] Entity detection ≤ 500ms for 10,000-word chapters (NFR-002)
- [ ] All network calls are exclusively to `localhost:11434`; Tauri CSP verified
- [ ] All IPC commands validate input in Rust before DB access
- [ ] All SQLite queries use parameterized statements
- [ ] sidecar SHA-256 checksums verified at startup
- [ ] `cargo audit` returns no high or critical vulnerabilities
- [ ] `npm audit` returns no high or critical vulnerabilities
- [ ] Project folder portability test passes (AT-015)
- [ ] Ollama onboarding shown when Ollama is not running (AT-001)
- [ ] All 50-snapshot cap logic tested
- [ ] Structured logging writes to correct OS path for Mac and Windows
- [ ] ePub, PDF, and .docx exports open without errors in Calibre / Adobe / Word
- [ ] Fantasy and Neutral themes applied correctly per project genre
- [ ] `README.md` includes complete install, Ollama setup, and usage instructions
- [ ] `docs/theme-schema.md` and `docs/custom-categories.md` exist and are complete
- [ ] Release binaries built for: mac-arm64, mac-x64, win-x64
- [ ] GitHub repository is public with MIT or Apache-2.0 license file

---

## 21. Open Questions

| # | Question |
|---|---------|
| OQ-001 | Which specific Ollama models should be listed as "recommended" in the onboarding screen? (Assumed `llama3` as default, but a curated list of 2–3 options would improve UX.) |
| OQ-002 | Should the relationship graph edges be directional (arrows) or undirected? (Assumed directional: `from_entity → to_entity`.) |
| OQ-003 | What is the target donation platform URL? (Assumed Ko-fi placeholder; real URL needed before release.) |
| OQ-004 | Should genre templates differ only in field labels/defaults, or also in which fields are shown? (Assumed structural differences: e.g. Fantasy Characters have a "Magic Affinity" field; Sci-Fi Characters have a "Species" field.) |
