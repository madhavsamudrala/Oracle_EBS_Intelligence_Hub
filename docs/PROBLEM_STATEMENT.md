# Problem Statement
## Oracle EBS Intelligence Hub v6.0

---

## Executive Summary

Oracle E-Business Suite (EBS) R12 is a deeply complex enterprise platform used by Cook County for financial management across Payables, Receivables, General Ledger, Purchasing, HRMS, and iExpense. Despite years of operation, users and technical teams face significant challenges in:

1. **Accessing report data** — Standard Oracle reports require deep functional knowledge to navigate and interpret
2. **Writing correct SQL** — EBS tables have intricate multi-org, DateTrack, and flag-based filtering rules that are easy to get wrong
3. **Knowledge retention** — EBS functional and technical knowledge is siloed in individuals, undocumented, and at risk of loss
4. **Data integration** — Connecting external data sources (Excel exports, CSV files) to EBS report structures requires manual effort
5. **AI assistance quality** — Generic AI models lack EBS domain knowledge and produce incorrect SQL or misleading answers

---

## Specific Pain Points

### Reporting Pain Points
| Pain Point | Impact |
|---|---|
| Report requests queue for IT team | Business users wait days for data |
| Standard Oracle UI is complex | Users cannot self-serve |
| No unified view across modules | AP/GL/HRMS data is siloed |
| CSV exports need manual cleanup | Wasted analyst time |

### SQL / Technical Pain Points
| Pain Point | Impact |
|---|---|
| Missing ORG_ID filter causes cross-org data leakage | Compliance risk |
| DateTrack joins on PER_ALL_PEOPLE_F done incorrectly | Incorrect headcount data |
| SELECT * on large tables times out | Performance outages |
| iExpense SOURCE filter omitted | Wrong expense data |
| No SQL quality gate before production | Data quality incidents |

### Knowledge Management Pain Points
| Pain Point | Impact |
|---|---|
| EBS expertise held by 2–3 people | Single point of failure |
| No structured learning path for new staff | Long onboarding time |
| Interview preparation done ad-hoc | Inconsistent hiring quality |
| RICE component documentation scattered | Development rework |

---

## Solution Approach

The **Oracle EBS Intelligence Hub** solves these problems through:

### Layer 1 — Semantic Knowledge Graph (ICA Context Studio)
A structured OWL ontology (v5.2+) captures the relationships between EBS modules, tables, reports, SQL patterns, compliance rules, and RICE components. This graph is the "knowledge backbone" that grounds all AI responses.

### Layer 2 — AI Chat Assistant (IBM BOB)
Natural language interface that maps user intent to the correct EBS report, applies the knowledge graph for context, and returns results with data, charts, and export options.

### Layer 3 — SQL Compliance Engine
28 rules (RULE_001–RULE_028) automatically detect common EBS SQL mistakes before they reach the database.

### Layer 4 — Data Connect
Allows business users to upload Excel/CSV data or paste SQL queries and map them to EBS report structures using 100 auto-mapping rules — no IT involvement required.

### Layer 5 — EBS Academy
15 structured learning modules covering functional, technical, SQL, AME/Workflow, and RICE topics — enabling self-service knowledge transfer.

---

## Success Metrics

| Metric | Baseline | Target |
|---|---|---|
| Time to first report | 2–3 days (IT queue) | < 30 seconds |
| SQL compliance issues in production | Untracked | 0 Critical per sprint |
| New staff onboarding time | 4–6 weeks | 2 weeks |
| Self-service report access | 5% of requests | 80% of requests |
| Data integration manual effort | 4–8 hours | < 15 minutes |

---

## Scope

**In scope (v6.0):**
- AP, AR, GL, PO, HRMS, iExpense, Inventory modules
- 26 pre-built EBS reports
- 500+ SQL queries in SQL Lab
- 28 compliance rules
- 15 Academy modules
- Data Connect (Excel, CSV, DB simulation, live proxy)
- ICA Context Studio integration (local + backend)
- FastAPI backend for live ICA enrichment

**Out of scope:**
- Direct Oracle DB write access
- Real-time EBS data feeds (requires middleware)
- Custom report builder (planned for v7.0)
- Mobile app
