# ICA Schema — Oracle EBS Intelligence Hub v5.2

This directory contains the **ICA Context Studio schema and ontology** for the Oracle EBS Intelligence Hub v5.2.  
Schema fully derived from `bob ontology guide.txt` (Sections A–AE, ~12,098 lines).

---

## Directory Structure

```
ica-schema/
├── ebs-ontology.jsonld              # ★ v5.2 — JSON-LD / OWL 2 ontology (30+ classes, 52+ properties)
├── ebs-complete-ontology.jsonld     # ★ v5.2 — ICA Context Studio primary entity file (2008 lines)
├── ebs-knowledge-graph-schema.json  # v5.2 — 29 node types, 24 edge types, Data Connect mapping spec
├── ebs-context-config.csv           # ICA Context Studio configuration key/value pairs
├── 01-nodes.json                    # v5.2 — Node instances: roles, tabs, modules, reports, tables,
│                                    #         rules, RICE components, AME, WF, OAF, SOA, APEX, ADF,
│                                    #         Redwood, ModuleKnowledge, BusinessProcess, SQL patterns
├── 02-rules.json                    # v5.2 — 28 SQL code review rules (RULE_001–RULE_028) +
│                                    #         5 app workflow/technical rules (RULE_101–RULE_105)
├── 03-relationships.json            # v5.2 — 30 relationship types (REL_001–REL_030)
├── 04-sample-data.json              # Representative sample data for all 7 EBS modules + workflows
└── csv/
    ├── ebs_nodes.csv                # All 112+ nodes: modules, reports, tables, rules, roles, tabs
    ├── ebs_edges.csv                # Graph edges: 52+ module→report, report→table relationships
    ├── ebs_relationships.csv        # Oracle EBS table JOIN relationships (15 SQL join paths)
    ├── column_mapping_rules.csv     # 100 column mapping rules (Excel/DB → EBS columns)
    ├── natural_language_queries.csv # 115+ NL query intent mappings (chat → report/feature/tab)
    ├── approval_rules.csv           # 27 SQL rules: master RULE_nnn IDs + CSV-only APR-001..APR-011
    ├── approver_groups.csv          # 12 SQL Library categories
    ├── expense_templates.csv        # 15 Academy modules with topics
    ├── special_submitters.csv       # 3 Data Connect sources: Excel, Simulated DB, Live DB
    ├── operating_units.csv          # 3 sample Oracle EBS operating units
    └── test_scenarios.csv           # 35 end-to-end test scenarios across all 7 tabs
```

---

## ICA Context Studio — Upload Order

To build the full Oracle EBS knowledge graph in ICA Context Studio, import in this order:

| Step | File | Purpose |
|------|------|---------|
| 1 | `ebs-ontology.jsonld` | Upload JSON-LD/OWL ontology — defines all 30+ OWL classes and 52+ properties |
| 1 | `Oracle_EBS_Intelligence_Hub.jsonld` | **PRIMARY UPLOAD (v6.0)** - schema name `Oracle_EBS_Intelligence_Hub`, format domain-model-jsonld; 527 nodes (modules, processes, RICE, tables, reports, rules, roles, tabs, Academy, SQL categories, NL queries, column mappings, DASC, type definitions) with relationships. Regenerate with `python ica-schema/build_context_schema.py` |
| 2 | `ebs-complete-ontology.jsonld` | v5.2 base graph (72 nodes) used by the generator |
| 3 | `ebs-knowledge-graph-schema.json` | Schema — 29 node types, 24 edge types, Data Connect mapping spec |
| 4 | `csv/ebs_nodes.csv` | Node instances (modules, reports, tables, roles, etc.) |
| 5 | `csv/ebs_edges.csv` | Graph edges (module→report, report→table, etc.) |
| 6 | `csv/ebs_relationships.csv` | Oracle EBS table JOIN relationships |
| 7 | `csv/column_mapping_rules.csv` | Data Connect column mapping rules (100 rules) |
| 8 | `csv/natural_language_queries.csv` | NL intent→report/tab mappings (115+ entries) |
| 9 | `csv/approval_rules.csv` | SQL compliance rules |
| 10 | `ebs-context-config.csv` | Context configuration |

---

## Schema Overview v5.2

| Category | Count | Description |
|----------|-------|-------------|
| Oracle Modules | 13 | AP, AR, GL, PO, HRMS, PAY, INV, OM, FA, CM, BEN, iEXP, FND |
| Business Processes | 4 | P2P, O2C, H2R, R2R (end-to-end with milestones + accounting entries) |
| EBS Reports | 26 | Pre-built reports across all modules |
| Oracle Tables | 40+ | Base tables with join keys and compliance rules |
| SQL Compliance Rules | 10 | COMP-001 to COMP-010 (node-level) |
| SQL Code Review Checks | 28 | RULE_001 to RULE_028 (detailed check rules) |
| App Workflow Rules | 5 | RULE_101 to RULE_105 (delete/security workflow) |
| SQL Patterns | 6 | AP, GL, HRMS, P2P, O2C, PAY query templates |
| User Roles | 2 | Employee (3 tabs) / Technical (7 tabs) |
| App Tabs | 7 | Chat, Reports, SQL Advisor, Academy, SQL Lab, Data Connect, Doc Generator |
| Academy Modules | 15 | Learning modules for all EBS areas + technical topics |
| SQL Categories | 12 | SQL Library categories with 500+ queries |
| **RICE Components** | **11** | **Reports, Interfaces, Conversions, Extensions (sample instances)** |
| **AME Configurations** | **2** | **AP Invoice Approval, PO Approval** |
| **Oracle Workflows** | **3** | **AP Invoice Approval, PO Approval, HR New Hire** |
| **OAF Components** | **1** | **AP Invoice Entry Page Extension** |
| **SOA Services** | **1** | **APInvoiceCompositeService (BPEL)** |
| **APEX Applications** | **1** | **AP Invoice Management Dashboard** |
| **ADF Applications** | **1** | **AP Invoice ADF App** |
| **Redwood Components** | **1** | **AP Invoice Redwood App (Oracle JET 14.0)** |
| **ModuleKnowledge Topics** | **15** | **AP-FUNC-001 through INTERVIEW-001** |
| Data Connect Sources | 3 | Excel upload, Simulated DB, Live DB (proxy) |
| Column Mapping Rules | 100 | Excel/DB header → EBS column fuzzy mappings |
| NL Query Mappings | 115+ | Chat intent → feature mappings |
| Relationship Types | 30 | REL_001–REL_030 |
| Node Types | 29 | All types across both ontology files |
| OWL Classes | 30+ | ebs-ontology.jsonld |
| Object Properties | 52+ | All object and datatype properties |

---

## Ontology — `ebs-ontology.jsonld` (OWL Definitions)

The JSON-LD ontology uses **OWL 2 Web Ontology Language** and is compatible with ICA Context Studio's knowledge graph import.

### Namespaces

| Prefix | URI |
|--------|-----|
| `ebs:` | `https://ibm.com/ica/oracle-ebs-intelligence-hub/ontology#` |
| `ebsbase:` | `http://ibm.com/oracle-ebs#` |
| `owl:` | `http://www.w3.org/2002/07/owl#` |
| `rdfs:` | `http://www.w3.org/2000/01/rdf-schema#` |
| `schema:` | `https://schema.org/` |
| `dcterms:` | `http://purl.org/dc/terms/` |
| `skos:` | `http://www.w3.org/2004/02/skos/core#` |

### OWL Classes (30+)

#### Core EBS Domain
| Class | rdfs:subClassOf | Description |
|-------|-----------------|-------------|
| `ebs:OracleModule` | `schema:SoftwareApplication` | 13 EBS modules (AP, AR, GL, PO, HRMS, PAY, INV, OM, FA, CM, BEN, iEXP, FND) |
| `ebs:BusinessProcess` | `schema:Action` | P2P, O2C, H2R, R2R end-to-end processes |
| `ebs:EBSReport` | `schema:Dataset` | 26 pre-built reports |
| `ebs:OracleTable` | `schema:Dataset` | EBS base tables (_ALL, DateTrack, etc.) |
| `ebs:BusinessRule` | — | SQL compliance/best practice rules |
| `ebs:ComplianceRule` | `ebs:BusinessRule` | 10 COMP-xxx rules + 28 RULE_xxx detailed checks |
| `ebs:SQLPattern` | `schema:SoftwareSourceCode` | 6 query templates with mandatory filters |
| `ebs:NLQuery` | `schema:SearchAction` | 115+ natural language chat query patterns |

#### RICE Components
| Class | rdfs:subClassOf | Description |
|-------|-----------------|-------------|
| `ebs:RICEComponent` | `schema:SoftwareSourceCode` | Base class: R/I/C/E + AME/WF/OAF/SOA/APEX/ADF/Redwood |
| `ebs:EBSInterface` | `ebs:RICEComponent` | Inbound/Outbound/Bidirectional interfaces |
| `ebs:EBSConversion` | `ebs:RICEComponent` | One-time data migration components |
| `ebs:EBSExtension` | `ebs:RICEComponent` | DB triggers, custom packages, OAF/ADF extensions |
| `ebs:AMEConfiguration` | `schema:Action` | AME approval rules and hierarchies |
| `ebs:OracleWorkflow` | `schema:Action` | Oracle Workflow process definitions |
| `ebs:OAFComponent` | `ebs:RICEComponent` | OAF pages, regions, controllers, VO extensions |
| `ebs:SOAService` | `ebs:RICEComponent` | BPEL, Mediator, REST, SOAP services |
| `ebs:APEXApplication` | `ebs:RICEComponent` | APEX apps with EBS SSO integration |
| `ebs:ADFApplication` | `ebs:RICEComponent` | ADF apps with EO/VO/AM business components |
| `ebs:RedwoodComponent` | `ebs:RICEComponent` | Oracle JET + VBCS modern UI components |

#### Knowledge & Learning
| Class | rdfs:subClassOf | Description |
|-------|-----------------|-------------|
| `ebs:ModuleKnowledge` | `schema:LearningResource` | 15 topics: setup, functional, technical, troubleshooting |
| `ebs:AcademyModule` | `schema:Course` | 15 EBS Academy learning modules |
| `ebs:AcademyTopic` | `schema:LearningResource` | Topics within Academy modules |

#### Application & User
| Class | rdfs:subClassOf | Description |
|-------|-----------------|-------------|
| `ebs:UserRole` | `schema:Role` | Employee / Technical login roles |
| `ebs:AppTab` | — | 7 navigation tabs |
| `ebs:SQLQuery` | `schema:SoftwareSourceCode` | SQL Library queries (500+) |
| `ebs:SQLCategory` | — | SQL Library grouping categories (12) |
| `ebs:DataConnectSource` | `schema:DataFeed` | Excel/DB/Live DB import sources |
| `ebs:ColumnMapping` | `schema:PropertyValue` | Excel/DB column → EBS column mapping |
| `ebs:DeleteRequest` | `schema:Action` | Employee report delete requests |
| `ebs:RecycleBinEntry` | `schema:CreativeWork` | Deleted report snapshots |
| `ebs:Employee` | `schema:Person` | Oracle HRMS employee records |
| `ebs:Supplier` | `schema:Organization` | Oracle AP vendor/supplier records |
| `ebs:DocumentTemplate` | `schema:DigitalDocument` | Doc Generator templates |
| `ebs:OperatingUnit` | `schema:Organization` | Oracle EBS Multi-Org ORG_ID units |

---

## Complete Ontology — `ebs-complete-ontology.jsonld` (ICA Entity Instances)

The complete ontology (2008 lines) is the **primary ICA Context Studio upload file** containing all entity instances in ICA entity format using `ebs:Entity`, `ebs:Operation`, `ebs:BusinessProcess`, `ebs:RICEComponent`, and `ebs:ModuleKnowledge` types.

### Entities Covered

| Category | Instances |
|----------|-----------|
| Oracle Modules | 13 (AP, AR, GL, PO, HRMS, PAY, INV, OM, FA, CM, BEN, iEXP, FND) |
| Business Processes | 4 (P2P, O2C, H2R, R2R) with full accounting entries and milestones |
| Operations | 3 (CreateAPInvoice, ProcessP2PCycle, ProcessPeriodClose) |
| Compliance Rules | 10 (COMP-001 to COMP-010) with detailed violation impact |
| SQL Patterns | 6 (AP, GL, HRMS, P2P, O2C, PAY) with template SQL |
| RICE Reports | 3 (Invoice Register RDF, Payment Register BIP, Trial Balance XML) |
| RICE Interfaces | 3 (AP Invoice, GL Journal, HR Employee) |
| RICE Conversions | 3 (Supplier Master, GL Opening Balances, AP Open Invoices) |
| RICE Extensions | 2 (AP Invoice Trigger, XXCUST_AP_UTILS_PKG) |
| AME Configurations | 2 (AP Invoice Approval, PO Approval) |
| Oracle Workflows | 3 (AP Invoice Approval, PO Approval, HR New Hire) |
| OAF Components | 1 (AP Invoice Entry Page Extension) |
| SOA Services | 1 (APInvoiceCompositeService BPEL) |
| APEX Applications | 1 (AP Invoice Management Dashboard) |
| ADF Applications | 1 (AP Invoice ADF App 12.2.1.4) |
| Redwood Components | 1 (AP Invoice Redwood App JET 14.0) |
| ModuleKnowledge Topics | 15 (AP-FUNC-001 → INTERVIEW-001) |
| Upload Strategy | 1 (ICA Context Studio 5-tier upload guide) |

---

## RICE Taxonomy

Oracle EBS customisations follow the RICE framework:

| Category | Code | Types | Key Tables / APIs |
|----------|------|-------|-------------------|
| **Reports** | R | RDF, BIP/XML Publisher, OAF Report, Discoverer, PLSQL | ap_invoices_all, gl_je_headers |
| **Interfaces** | I | Open Interface, API-Based, SOA, REST API, File-Based | ap_invoices_interface, gl_interface, HR_PERSON_API |
| **Conversions** | C | INITIAL_LOAD, OPEN_BALANCES, MASTER_DATA, DELTA_LOAD | xxcust_*_stg staging tables |
| **Extensions** | E | DB Trigger, Custom Package, OAF, ADF, Redwood, WF | AP_INVOICES_ALL, XXCUST_AP_UTILS_PKG |

Additional technology layers:
- **AME** — Approval Management Engine (conditions, rules, hierarchies)
- **Oracle Workflow** — Approval routing and notification (APINVOICE, POAPPRV, HRSSA)
- **OAF** — Oracle Application Framework page/region extensions
- **SOA** — Oracle SOA Suite BPEL composites and REST services
- **APEX** — Oracle APEX applications with EBS SSO
- **ADF** — Oracle ADF 12.2.1.4 with WebLogic deployment
- **Redwood** — Oracle JET 14.0 / VBCS 23.2 modern UI

---

## SQL Compliance Rules

### Node-level Rules (COMP-001 to COMP-010)

| Rule | Severity | Description |
|------|----------|-------------|
| COMP-001 | CRITICAL | ORG_ID required on all _ALL multi-org tables |
| COMP-002 | CRITICAL | DateTrack filter mandatory on all HRMS/PAY/BEN _F tables |
| COMP-003 | CRITICAL | GL uses ledger_id NOT org_id |
| COMP-004 | MAJOR | Cancelled invoice filter: AND cancelled_date IS NULL |
| COMP-005 | MAJOR | Reversal distribution filter: AND reversal_flag != 'Y' |
| COMP-006 | MAJOR | Primary assignment filter: AND primary_flag = 'Y' |
| COMP-007 | CRITICAL | Bind variables required — no hardcoded literals |
| COMP-008 | MAJOR | No SELECT * in production SQL |
| COMP-009 | MAJOR | No functions on indexed columns (TRUNC/TO_CHAR) |
| COMP-010 | CRITICAL | HRMS tables use business_group_id NOT org_id |

### Detailed Code Review Checks (RULE_001 to RULE_028)

28 detailed rules covering additional patterns: Void Cheque filter, MO_GLOBAL context, DateTrack historical queries, FINALLY CLOSED PO filter, AR Complete Flag, AR Payment Schedule Status, GL Actual Flag, Inventory organization_id, BULK COLLECT performance, PL/SQL transaction control, WHO columns in custom tables, FND_GLOBAL context for APIs, EXISTS vs IN, LIKE leading wildcard, NOT IN with NULLs, ROWNUM with ORDER BY, FND_LOOKUPS VL view, Missing SQL comment header, and more.

---

## ModuleKnowledge Topics

| ID | Module | Topic | Category | Difficulty |
|----|--------|-------|----------|------------|
| AP-FUNC-001 | AP | AP Functional Setup | SETUP | INTERMEDIATE |
| AP-FUNC-002 | AP | AP Invoice Processing End-to-End | FUNCTIONAL | INTERMEDIATE |
| GL-FUNC-001 | GL | GL Complete Functional Setup | SETUP | ADVANCED |
| AR-FUNC-001 | AR | AR Complete Functional Setup | SETUP | INTERMEDIATE |
| P2P-PROC-001 | PO | Procure-to-Pay Complete Process | FUNCTIONAL | ADVANCED |
| O2C-PROC-001 | OM | Order-to-Cash Complete Process | FUNCTIONAL | ADVANCED |
| HRMS-FUNC-001 | HRMS | HRMS Complete Setup and Processing | FUNCTIONAL | ADVANCED |
| PAY-FUNC-001 | PAY | Oracle Payroll Complete Setup | FUNCTIONAL | EXPERT |
| BEN-FUNC-001 | BEN | Oracle Benefits Complete Setup | FUNCTIONAL | ADVANCED |
| CM-FUNC-001 | CM | Oracle Cash Management Complete Setup | FUNCTIONAL | ADVANCED |
| iEXP-FUNC-001 | iEXP | Oracle iExpense Complete Setup | FUNCTIONAL | INTERMEDIATE |
| FA-FUNC-001 | FA | Oracle Fixed Assets Complete Setup | FUNCTIONAL | ADVANCED |
| PLSQL-ADV-001 | TECH | Advanced PL/SQL Patterns for Oracle EBS | TECHNICAL | EXPERT |
| TROUBLE-001 | TECH | Oracle EBS Complete Troubleshooting Guide | TROUBLESHOOTING | EXPERT |
| INTERVIEW-001 | ALL | Complete Oracle EBS Interview Questions | LEARNING | ALL_LEVELS |

---

## Key Relationships (v5.2 — 30 total)

| Relationship | From → To | Cardinality |
|-------------|-----------|-------------|
| `MODULE_HAS_REPORT` | OracleModule → EBSReport | 1:N |
| `REPORT_USES_TABLE` | EBSReport → OracleTable | N:M |
| `TABLE_HAS_RULE` | OracleTable → BusinessRule | N:M |
| `ROLE_CAN_ACCESS_TAB` | UserRole → AppTab | N:M |
| `TAB_HOSTS_FEATURE` | AppTab → EBSReport/Module/SQL | 1:N |
| `BUSINESS_PROCESS_HAS_MODULE` | BusinessProcess → OracleModule | N:M |
| `COMPLIANCE_RULE_APPLIES_TO_MODULE` | ComplianceRule → OracleModule | N:M |
| `SQL_PATTERN_FOR_MODULE` | SQLPattern → OracleModule | N:1 |
| `DATACONNECT_COLUMN_MAPS_TO_EBS_COLUMN` | ColumnMapping → EBSReport | N:1 |
| **`MODULE_HAS_RICE_COMPONENT`** | OracleModule → RICEComponent | 1:N |
| **`AME_CONFIG_GOVERNS_WORKFLOW`** | AMEConfiguration → OracleWorkflow | 1:1 |
| **`MODULE_HAS_AME_CONFIG`** | OracleModule → AMEConfiguration | 1:N |
| **`MODULE_HAS_WORKFLOW`** | OracleModule → OracleWorkflow | 1:N |
| **`MODULE_HAS_KNOWLEDGE_TOPIC`** | OracleModule → ModuleKnowledge | 1:N |
| **`KNOWLEDGE_TOPIC_FOR_PROCESS`** | ModuleKnowledge → BusinessProcess | N:M |
| **`RICE_COMPONENT_USES_TABLE`** | RICEComponent → OracleTable | N:M |
| **`OAF_EXTENDS_MODULE`** | OAFComponent → OracleModule | N:1 |
| **`SOA_INTEGRATES_MODULE`** | SOAService → OracleModule | N:M |
| **`APEX_APP_QUERIES_MODULE`** | APEXApplication → OracleModule | N:M |
| **`REDWOOD_CALLS_SOA`** | RedwoodComponent → SOAService | N:M |

---

## Data Connect Mapping — `column_mapping_rules.csv`

The `column_mapping_rules.csv` file documents 100 pre-defined fuzzy column mapping rules used by [`dcAutoMap()`](../ebs-reports.js:7918) in the Data Connect tab.

### How Mapping Works

```
1. Load Excel/CSV file → SheetJS parses headers + rows
2. User selects target EBS report → _dcGetTargetColumns() returns report column list
3. dcAutoMap() runs for each incoming header:
     normalise(str) = str.toLowerCase().replace(/[\s_\/\-\.#]/g, '')
     match if:  tn === norm  (exact)
             OR tn.includes(norm)  (target contains source)
             OR norm.includes(tn)  (source contains target)
4. Column type auto-detected by _dcDetectType() — samples 50 rows
5. User reviews mapping table, adjusts manual overrides
6. Select optional transform per column: TRIM / UPPER / lower / Title / Format Date / Format Number
7. dcApplyMapping() builds preview rows with transforms applied
8. dcPushToReports() swaps window.REPORT_DATA[key].rows in memory
```

### DB / Live DB Mapping

When using DB Simulated or Live Oracle DB, incoming columns are actual **Oracle EBS column names** from the query result set. These match EBS report columns directly via the same `dcAutoMap()` fuzzy logic — e.g. `VENDOR_NAME` and `vendor_name` both normalise to `vendorname`.

### Live DB Proxy Contract

```http
POST /query
Content-Type: application/json

{
  "sql":  "SELECT vendor_name, invoice_num FROM ap_invoices_all WHERE org_id = 101",
  "host": "db.example.com",
  "port": "1521",
  "sid":  "EBSPROD",
  "user": "apps",
  "pass": "secret"
}

Response:
{
  "columns": ["VENDOR_NAME", "INVOICE_NUM"],
  "rows": [["ABC Corp", "INV-001"], ["XYZ Ltd", "INV-002"]]
}
```

> **Note:** Live Oracle DB requires a Node.js/Python proxy server with `oracledb` or `cx_Oracle`. See `docs/TECHNICAL_DESIGN.md` Section 9 for the full proxy implementation guide.

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| **5.2** | **2025-07** | **Added RICE component nodes (11), AME/WF nodes (5), OAF/SOA/APEX/ADF/Redwood nodes (5), 15 ModuleKnowledge topic nodes; added RULE_016–RULE_028 (13 new SQL review rules); added REL_020–REL_030 (11 new relationship types); added 11 new node types and 11 new edge types to knowledge-graph-schema.json; schema v5.2** |
| 5.1 | 2025-06 | Added RICE taxonomy OWL classes (RICEComponent, EBSInterface, EBSConversion, EBSExtension, AMEConfiguration, OracleWorkflow, OAFComponent, SOAService, APEXApplication, ADFApplication, RedwoodComponent, ModuleKnowledge); updated ebs-complete-ontology.jsonld to full entity format; added RULE_001–RULE_015 |
| 5.0 | 2025-06 | Complete rewrite — EBS Intelligence Hub v5.0 (7 tabs, 26 reports, 15 academy modules, 500+ SQL queries); added `ebs-ontology.jsonld` (19 OWL classes), `column_mapping_rules.csv` (100 rules) |
| 2.0 | 2023 | iExpense Approval Assistant — **superseded** |
