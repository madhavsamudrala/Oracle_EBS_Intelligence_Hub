# Software Development Life Cycle (SDLC) — Oracle EBS Intelligence Hub

**Project:** Oracle EBS Intelligence Hub
**Technology Stack:** IBM BOB + ICA Context Studio + Agentic App + Oracle EBS R12
**Version:** 6.0 | **Date:** July 2025 | **Status:** Production Ready

---

## Table of Contents

1. [Project Vision & Objectives](#1-project-vision--objectives)
2. [Stakeholders & Roles](#2-stakeholders--roles)
3. [Phase 1 — Requirements Analysis](#3-phase-1--requirements-analysis)
4. [Phase 2 — System Design](#4-phase-2--system-design)
5. [Phase 3 — Development](#5-phase-3--development)
6. [Phase 4 — Testing](#6-phase-4--testing)
7. [Phase 5 — Deployment](#7-phase-5--deployment)
8. [Phase 6 — Maintenance & Enhancement](#8-phase-6--maintenance--enhancement)
9. [Risk Register](#9-risk-register)
10. [Project Timeline (Gantt)](#10-project-timeline-gantt)
11. [Quality Gates & Exit Criteria](#11-quality-gates--exit-criteria)
12. [Change Management Process](#12-change-management-process)

---

## 1. Project Vision & Objectives

### Vision Statement

> To deliver a zero-installation, browser-based Oracle EBS R12 intelligence portal that empowers Finance users, HR analysts, technical developers, functional consultants, and project managers to access data, analyse SQL, learn EBS, import real data, and generate documentation — all through a unified role-based interface backed by IBM BOB and ICA Context Studio.

### Business Objectives

| # | Objective | Target Metric |
|---|---|---|
| BO-1 | Self-service EBS reporting — no IT dependency | Business users run reports without tickets |
| BO-2 | SQL quality improvement — reduce production incidents | Developers use Advisor before deploying SQL |
| BO-3 | Faster document generation | Consultants produce TDD in < 5 minutes |
| BO-4 | Accelerate EBS onboarding | New team members self-learn via Academy |
| BO-5 | Enable data testing without live DB | QA teams use Data Connect with Excel exports |
| BO-6 | Reduce EBS support overhead | Academy AI assistant answers common questions |

### Technical Objectives

- Zero backend, zero installation — pure client-side SPA
- Role-based access (Employee / Technical) with different tab visibility
- No LLM or external API calls — all AI is rule-based keyword matching
- Data Connect supports Excel upload AND optional live Oracle DB via proxy
- Full test coverage with 315 test cases

---

## 2. Stakeholders & Roles

| Stakeholder | Role | Responsibilities |
|---|---|---|
| IBM ICA Team | Development | Architecture, coding, testing, documentation |
| Oracle EBS Functional Leads | Subject Matter Expert | Business rules, module knowledge, UAT |
| Finance Business Users | End User (Employee role) | Run reports, upload data, Chat assistant |
| EBS Developers / Consultants | End User (Technical role) | SQL tools, Academy, Doc Generator, SQL Lab |
| Project Managers | End User (Technical role) | Academy Module 15, reports, documentation |
| DBAs | End User (Technical role) | Academy Module 9, SQL Lab, Data Connect |
| IT Architects | Reviewer | Architecture validation, ICA Context Studio integration |

---

## 3. Phase 1 — Requirements Analysis

### Completed

| Requirement | Source | Status |
|---|---|---|
| 26 EBS reports across 7 modules | Business user interviews | ✅ Delivered |
| Self-service filtering by year/month/keyword | Finance user workshop | ✅ Delivered |
| SQL performance analysis | Developer feedback | ✅ Delivered |
| 27-check code review | EBS DBA requirements | ✅ Delivered |
| SQL formatter | Developer feedback | ✅ Delivered |
| Document generator | Consultant pain points | ✅ Delivered |
| Role-based login | Security review | ✅ Delivered v4.0 |
| Academy — 15 modules | L&D / onboarding requirement | ✅ Delivered v5.0 |
| SQL Lab — 500+ queries | Developer request | ✅ Delivered v5.0 |
| Data Connect — Excel import | QA + UAT team request | ✅ Delivered |
| Data Connect — live DB | Technical requirement | ✅ Delivered (proxy mode) |
| Delete / Recycle Bin | Governance requirement | ✅ Delivered v5.0 |
| Employee delete request workflow | RBAC requirement | ✅ Delivered v5.0 |
| Notification system | Workflow requirement | ✅ Delivered v5.0 |

---

## 4. Phase 2 — System Design

### Architecture Decisions

| Decision | Rationale |
|---|---|
| Pure client-side SPA | Zero infrastructure cost, instant deployment, works offline |
| No LLM / no external AI | No API keys, no cost, no network dependency, deterministic responses |
| Role-based login (in-memory) | No backend auth required; simple credential check sufficient for demo/prototype phase |
| In-memory state | Session-scoped — data resets on refresh, appropriate for demo data context |
| SheetJS for Excel | Full xlsx parsing in-browser, no server roundtrip |
| Chart.js | Lightweight, no D3 dependency, supports all chart types needed |
| Proxy pattern for live DB | Allows live Oracle DB connection without compromising browser security model |

### Design Patterns Used

- **Registry Pattern** — `IMPORTED_REPORTS`, `DELETED_REPORTS`, `RECYCLE_BIN`, `DELETE_REQUESTS`
- **Observer Pattern** — `_refreshNotifBadge()` called after any state change
- **Lazy Initialisation** — `initSqlLab()`, `initAcademy()`, `initDataConnect()` called on first tab open
- **Guard Clause** — `DELETED_REPORTS[key]` check in `loadReport()` blocks ghost reopens
- **Strategy Pattern** — `generateChatResponse()`, `generateAsstResponse()` swap strategies by keyword

---

## 5. Phase 3 — Development

### Version History

| Version | Date | Key Deliverables | Lines of JS |
|---|---|---|---|
| v1.0 | Jun 2024 | Initial release: Chat, 26 Reports, SQL Advisor, Doc Generator | ~2930 |
| v2.0 | Oct 2024 | Code Review (27 checks), SQL Formatter, SVG diagrams | ~4100 |
| v3.0 | Jan 2025 | IBM Carbon theme, Data Connect (Excel import), XLSX support | ~5500 |
| v4.0 | Mar 2025 | Oracle Blue theme, Role login (Employee/Technical), fiscal date fix | ~6800 |
| v5.0 | Jun 2025 | SQL Lab AI, Academy 15 modules, Delete/Recycle Bin, Notifications, security fixes | ~8350 |

### v5.0 — Key Bugs Fixed

| Bug | Root Cause | Fix |
|---|---|---|
| Login broken (zero functions loaded) | Orphaned text outside string literal caused JS parse error | Removed 5 dangling lines (ebs-reports.js ~7301-7305) |
| Delete not working | `window.confirm()` blocked on `file://` protocol | Replaced with custom `#deleteConfirmOverlay` HTML modal |
| Report reloads after delete | Built-in sidebar items stayed clickable | `DELETED_REPORTS` registry + `loadReport()` guard added |
| Passwords visible on login | `<code>` tags displayed credentials in HTML | Removed credential display from login HTML |
| SQL Lab not scrolling | `.sqllab-display` had `overflow: hidden` | Changed to `overflow-y: auto` |
| SQL Lab fuzzy matcher too loose | No stop-word filtering | `_SQL_STOP_WORDS` set + score threshold added |
| Wrong SQL for non-EBS queries | No domain scope check | `_isNonEBSPrompt()` + `_EBS_DOMAIN_TOKENS` gate added |

### v5.0 — New Academy Modules Added

Modules 9–15 added to `ebs-academy-data.js`:
- Module 9: DBA & System Admin (adop patching, cloning, performance tuning, RMAN)
- Module 10: EBS Architecture (three-tier, Multi-Org, ORG_ID)
- Module 11: SOA & Integration (SOA Suite, OIC, Open Interfaces, Business Events, REST/SOAP)
- Module 12: Oracle APEX & Modernisation (APEX foundation, EBS-to-APEX migration, Fusion roadmap)
- Module 13: Testing & QA (Unit/SIT/UAT/Regression, OATS, SQL validation)
- Module 14: Security & Access Control (Users, Responsibilities, Menus, Functions, Audit)
- Module 15: Project Manager Guide (OUM/AIM, CRP, Cutover, Hypercare, Team Roles)

---

## 6. Phase 4 — Testing

### Test Coverage (v5.0)

| Section | Test Cases | Status |
|---|---|---|
| Login & Role Selection | 25 | ✅ All pass |
| EBS Reports Browser | 40 | ✅ All pass |
| Chat Assistant | 20 | ✅ All pass |
| SQL Advisor | 25 | ✅ All pass |
| EBS Academy | 30 | ✅ All pass |
| SQL Lab | 25 | ✅ All pass |
| Data Connect | 30 | ✅ All pass |
| Delete & Recycle Bin | 25 | ✅ All pass |
| Document Generator | 20 | ✅ All pass |
| Navigation & General | 20 | ✅ All pass |
| **Total** | **315** | ✅ |

### Test Types Performed

| Type | Description |
|---|---|
| Unit / Function | Each function tested in isolation (e.g. `_dcDetectType`, `dcAutoMap`) |
| Integration | Full flows tested end-to-end (Login → Report → Download) |
| Regression | All previous test cases re-run after every version |
| Role-based | All features tested as Employee AND as Technical |
| Edge Cases | Empty inputs, wrong passwords, deleted reports, out-of-scope prompts |
| Browser | Tested in Chrome, Edge, Firefox, Safari |

---

## 7. Phase 5 — Deployment

### Deployment Options

| Option | Steps | Best For |
|---|---|---|
| **File:// (simplest)** | Double-click `oracle-ebs-intelligence-hub.html` | Local demo, development |
| **Python server** | `python -m http.server 8080` in repo dir | Local team access |
| **Node.js server** | `npx serve .` in repo dir | Local team access |
| **VS Code Live Server** | Right-click HTML → Open with Live Server | Active development |
| **GitHub Pages** | Push to `gh-pages` branch | Public / shared access |
| **Any static host** | Upload all files to web host | Production deployment |

### Files Required for Deployment

All files must be in the same directory:
```
oracle-ebs-intelligence-hub.html
ebs-reports.css
ebs-reports.js
ebs-reports-data.js
ebs-sqllib-data.js
ebs-academy-data.js
ebs-reports-additions.js
ebs-reports-additions.css
```

### Live DB Proxy (Optional)

For live Oracle DB connection, a proxy server is required:

**POST `/query`** — accepts `{ sql, host, port, sid, user, pass }`, returns `{ columns, rows }`

Can be implemented as:
- Node.js + `oracledb` npm package
- Python + `cx_Oracle` or `python-oracledb`
- Any language with Oracle JDBC driver

---

## 8. Phase 6 — Maintenance & Enhancement

### Current Status: Production Ready v5.0

### Next Phase Roadmap

| Phase | Feature | Status |
|---|---|---|
| 6.1 | **Context Studio** — saved mapping profiles, batch report mapping, AI-assisted column matching | 🔜 Planned |
| 6.2 | **MCP Exposure** — expose Hub data and functions as MCP tools for AI agents | 🔜 Planned |
| 6.3 | **ICA Agentic App Studio** — visual workflow builder for multi-step EBS analysis | 🔜 Planned |
| 6.4 | **Live DB Proxy Server** — Node.js/Python proxy packaged with the Hub | 🔜 Planned |

### How to Add a New Report

1. **`ebs-reports-data.js`** — Add entry to `window.REPORT_DATA`:
   ```javascript
   new_report_key: {
     title: 'Report Title',
     module: 'AP',
     sql: 'SELECT ... FROM ap_invoices_all WHERE org_id = :org_id',
     columns: ['Col1', 'Col2', 'Col3'],
     rows: [[val1, val2, val3], ...]
   }
   ```

2. **`oracle-ebs-intelligence-hub.html`** — Add sidebar link in the correct module group:
   ```html
   <a class="sidebar-report-link" onclick="loadReport('new_report_key', event)">
     New Report Name
   </a>
   ```

3. **`ebs-reports.js`** — Add chat intent in `generateChatResponse()`:
   ```javascript
   if (msg.includes('new keyword')) return showReportPreviewInChat('new_report_key');
   ```

### How to Add a New Academy Module

1. **`ebs-academy-data.js`** — Add module object to `EBS_ACADEMY_DATA.modules` array
2. **`ebs-reports.js`** — Add keyword handlers in `generateAsstResponse()` for the new module topics

### How to Add an SQL Library Query

1. **`ebs-sqllib-data.js`** — Add query object to the relevant category in `EBS_SQL_LIBRARY`:
   ```javascript
   { id: 'ap_new_query', title: 'Query Title', description: '...', tags: ['AP','Invoice'],
     sql: 'SELECT ...', module: 'AP' }
   ```

---

## 9. Risk Register

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| R-1 | Browser `file://` blocks clipboard API | Medium | Medium | Show manual copy fallback; recommend HTTP server |
| R-2 | CDN libraries unavailable | High | Low | Bundle libs locally for offline deployment |
| R-3 | Live DB proxy not configured | High | Medium | Simulated mode works without any proxy |
| R-4 | Excel with unusual encoding | Medium | Low | SheetJS handles most encodings; test with sample files |
| R-5 | JS parse error breaks all login | Critical | Low | Mitigated in v5.0 (root cause fixed); no dangling text outside strings |
| R-6 | Chart.js version mismatch | Medium | Low | Version pinned to 4.4.0 in CDN URL |
| R-7 | In-memory data lost on refresh | Medium | High | By design; next phase will add persistence via Context Studio |
| R-8 | window.confirm blocked on file:// | High | Medium | Fixed in v5.0 — custom modal used throughout |

---

## 10. Project Timeline

```
2024 Jun  ████ v1.0 — Initial release (Chat, Reports, SQL Advisor, Doc Gen)
2024 Oct  ████ v2.0 — Code Review, Formatter, SVG Diagrams
2025 Jan  ████ v3.0 — Data Connect, Excel import, IBM Carbon theme
2025 Mar  ████ v4.0 — Oracle Blue theme, Role login, fiscal date fix
2025 Jun  ████ v5.0 — SQL Lab AI, Academy 15 modules, Delete/Recycle Bin
          ────────────────────────────────────────────────────── CURRENT
2025 Q3   ░░░░ v6.1 — Context Studio
2025 Q3   ░░░░ v6.2 — MCP Exposure
2025 Q4   ░░░░ v6.3 — ICA Agentic App Studio
```

---

## 11. Quality Gates & Exit Criteria

| Gate | Criteria | v5.0 Status |
|---|---|---|
| QG-1: No JS parse errors | Console shows 0 errors on cold load | ✅ |
| QG-2: All tabs load | All 7 tabs render without error | ✅ |
| QG-3: All 26 reports load | Every report displays data | ✅ |
| QG-4: Both roles authenticate | Employee and Technical login work | ✅ |
| QG-5: Role visibility correct | Employee can't see Technical-only tabs | ✅ |
| QG-6: Delete/Restore cycle | Delete → missing from sidebar; Restore → back | ✅ |
| QG-7: Academy 15 modules | All 15 modules accessible | ✅ |
| QG-8: SQL Lab AI in-scope | EBS queries returned; non-EBS rejected | ✅ |
| QG-9: Data Connect push | Excel pushed to report; filters + download work | ✅ |
| QG-10: No passwords visible | Credentials not shown in UI or source | ✅ |

---

## 12. Change Management Process

### How to Request a Change

1. Raise an issue in the GitHub repository
2. Label as: `bug` / `enhancement` / `documentation` / `new-feature`
3. Assign to IBM ICA team member
4. Review in next sprint planning

### Change Classification

| Type | Examples | Effort |
|---|---|---|
| **Hotfix** | JS parse error, broken login, crash on load | Same day |
| **Bug Fix** | Wrong SQL returned, filter not working | 1–3 days |
| **Enhancement** | New report, new Academy module, new SQL query | 3–7 days |
| **New Feature** | New tab, new major workflow, DB proxy | 2–4 weeks |

### Versioning Convention

`vMAJOR.MINOR` — e.g. `v5.0`

- **MAJOR** increment: New tab, new major feature set, architectural change
- **MINOR** increment: Bug fixes, enhancements, new content additions

Cache-bust version in HTML: `ebs-reports.css?v=16` — increment on every release.

---

*SDLC Document v5.0 — Oracle EBS Intelligence Hub — IBM ICA*
