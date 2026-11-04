# Test Cases — Oracle EBS Intelligence Hub

**Version:** 6.0 | **Date:** July 2025 | **Total Test Cases:** 351

---

## Legend

| Status | Symbol | Meaning |
|---|---|---|
| Pass | ✅ | Test case passes |
| Fail | ❌ | Defect found |
| N/A | — | Not applicable |

| Priority | Code | Description |
|---|---|---|
| Critical | P1 | Portal cannot function without this |
| High | P2 | Core feature broken |
| Medium | P3 | Feature degraded |
| Low | P4 | Cosmetic / minor |

---

## Section 1 — Login & Role Selection (25 Tests)

| TC# | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| TC-001 | Landing page loads | Open oracle-ebs-intelligence-hub.html | Role selection cards visible, no console errors | P1 | ✅ |
| TC-002 | Employee card selectable | Click Employee card | Card highlighted, Next button appears | P1 | ✅ |
| TC-003 | Technical card selectable | Click Technical card | Card highlighted, Next button appears | P1 | ✅ |
| TC-004 | Employee correct password | Role=Employee, pwd=<employee password> | Main app loads, Employee tabs visible | P1 | ✅ |
| TC-005 | Technical correct password | Role=Technical, pwd=<technical password> | Main app loads, all 7 tabs visible | P1 | ✅ |
| TC-006 | Wrong password rejected | Enter wrong password | Error message shown, app does NOT load | P1 | ✅ |
| TC-007 | Empty password rejected | Click login with empty password | Error message shown | P1 | ✅ |
| TC-008 | Employee cannot see SQL Advisor | Login as Employee | SQL Advisor tab hidden | P1 | ✅ |
| TC-009 | Employee cannot see Academy | Login as Employee | Academy tab hidden | P1 | ✅ |
| TC-010 | Employee cannot see SQL Lab | Login as Employee | SQL Lab tab hidden | P1 | ✅ |
| TC-011 | Employee cannot see Doc Generator | Login as Employee | Doc Generator tab hidden | P1 | ✅ |
| TC-012 | Employee CAN see Data Connect | Login as Employee | Data Connect tab visible | P2 | ✅ |
| TC-013 | Technical sees all 7 tabs | Login as Technical | All 7 tab buttons visible | P1 | ✅ |
| TC-014 | User pill shows role | Login as either role | Top-right shows role name and badge | P3 | ✅ |
| TC-015 | Logout returns to landing | Click logout | Landing page shown, session cleared | P2 | ✅ |
| TC-016 | Password field masked | Check login form | Password input shows dots, not plain text | P2 | ✅ |
| TC-017 | Password NOT shown anywhere | Inspect page source and DOM | No credential displayed on screen | P1 | ✅ |
| TC-018 | Back button on role step | Click back on password step | Returns to role selection step | P3 | ✅ |
| TC-019 | Eye icon toggles password | Click eye icon in password field | Password toggled visible/hidden | P3 | ✅ |
| TC-020 | Enter key submits login | Press Enter in password field | Same as clicking login button | P3 | ✅ |
| TC-021 | Notification bell hidden from Employee | Login as Employee | Bell icon NOT visible in navbar | P2 | ✅ |
| TC-022 | Notification bell visible to Technical | Login as Technical | Bell icon visible in navbar | P2 | ✅ |
| TC-023 | Tab focus returns to Chat on login | Login as either role | Chat tab is active on first load | P2 | ✅ |
| TC-024 | Re-login after logout keeps correct role | Logout → login as different role | Correct tab set for new role | P2 | ✅ |
| TC-025 | No credentials in page source | View page source | No passwords visible in HTML | P1 | ✅ |

---

## Section 2 — EBS Reports Browser (40 Tests)

| TC# | Test Case | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| TC-026 | All 26 reports listed in sidebar | Expand all module groups | 26 report links visible | P1 | ✅ |
| TC-027 | Welcome grid shows 16 cards | Go to Reports tab | 16 quick-launch cards visible | P2 | ✅ |
| TC-028 | Click report loads data | Click Invoice Register | Table renders with rows | P1 | ✅ |
| TC-029 | All AP reports load | Click each AP report | Each loads with data | P1 | ✅ |
| TC-030 | All AR reports load | Click each AR report | Each loads with data | P1 | ✅ |
| TC-031 | All GL reports load | Click each GL report | Each loads with data | P1 | ✅ |
| TC-032 | All iExpense reports load | Click each iExpense report | Each loads with data | P1 | ✅ |
| TC-033 | All HRMS reports load | Click each HRMS report | Each loads with data | P1 | ✅ |
| TC-034 | All PO reports load | Click each PO report | Each loads with data | P1 | ✅ |
| TC-035 | Year filter reduces rows | Select specific year | Table shows only that year's rows | P2 | ✅ |
| TC-036 | Month filter reduces rows | Select specific month | Table shows only that month's rows | P2 | ✅ |
| TC-037 | Search filter works | Type vendor name in search | Matching rows shown | P2 | ✅ |
| TC-038 | Reset filters restores all rows | Apply filter → click Reset | All rows restored | P2 | ✅ |
| TC-039 | Pagination works | Change to page 2 | Next set of rows shown | P2 | ✅ |
| TC-040 | Page size change works | Change to 50 rows/page | 50 rows per page shown | P3 | ✅ |
| TC-041 | SQL panel toggles | Click Show SQL | SQL panel appears | P2 | ✅ |
| TC-042 | SQL panel hides | Click Hide SQL | SQL panel disappears | P2 | ✅ |
| TC-043 | Copy SQL button works | Click Copy SQL | SQL copied to clipboard | P3 | ✅ |
| TC-044 | Load SQL to Advisor | Click Load in Advisor | SQL Advisor tab opens with SQL loaded | P2 | ✅ |
| TC-045 | Chart panel toggles | Click Show Chart | Chart renders | P2 | ✅ |
| TC-046 | Chart type — bar | Select Bar | Bar chart renders | P2 | ✅ |
| TC-047 | Chart type — line | Select Line | Line chart renders | P2 | ✅ |
| TC-048 | Chart type — pie | Select Pie | Pie chart renders | P2 | ✅ |
| TC-049 | Chart type — doughnut | Select Doughnut | Doughnut chart renders | P2 | ✅ |
| TC-050 | Download CSV | Click Download → CSV | .csv file downloaded | P2 | ✅ |
| TC-051 | Download Excel | Click Download → Excel | .xlsx file downloaded | P2 | ✅ |
| TC-052 | Download PDF | Click Download → PDF | PDF print dialog opens | P2 | ✅ |
| TC-053 | Back button works | Open report → click Back | Previous screen shown | P2 | ✅ |
| TC-054 | Home button works | Open report → click Home | Welcome screen shown | P2 | ✅ |
| TC-055 | Report title shown | Open any report | Report title visible in header | P3 | ✅ |
| TC-056 | Row count shown | Open any report | "X rows" count visible | P3 | ✅ |
| TC-057 | Module group collapse/expand | Click module group header | Group toggles open/closed | P3 | ✅ |
| TC-058 | Welcome cards link to reports | Click a welcome card | Correct report loads | P2 | ✅ |
| TC-059 | Date parameters filter | Enter date range in params | Report filtered to date range | P2 | ✅ |
| TC-060 | Org filter works | Select org in params | Report filtered by org | P2 | ✅ |
| TC-061 | Load SQL to Code Review | Click Load in Code Review | Code Review opens with SQL | P2 | ✅ |
| TC-062 | Report data persists on tab switch | Switch tab → return to Reports | Same report and data shown | P2 | ✅ |
| TC-063 | Concurrent Requests report loads | Click Concurrent Requests | Table renders | P1 | ✅ |
| TC-064 | Inventory Valuation report loads | Click Inventory Valuation | Table renders | P1 | ✅ |
| TC-065 | AP Aging report loads | Click AP Aging | Table renders with aging buckets | P1 | ✅ |

---

## Section 3 — Chat Assistant (20 Tests)

| TC# | Test Case | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| TC-066 | Chat tab loads | Click Chat tab | Chat interface shown | P1 | ✅ |
| TC-067 | Invoice query shows report | Type "show invoices" | Invoice Register preview shown | P1 | ✅ |
| TC-068 | Supplier query works | Type "list suppliers" | Supplier report shown | P1 | ✅ |
| TC-069 | AP Aging query works | Type "aging payables" | AP Aging shown | P2 | ✅ |
| TC-070 | GL journal query works | Type "journal entries" | GL Journals shown | P2 | ✅ |
| TC-071 | Employee query works | Type "employee list" | Employee report shown | P2 | ✅ |
| TC-072 | Unknown query gives fallback | Type "xyz123" | Helpful fallback suggestions shown | P2 | ✅ |
| TC-073 | Chat history scrolls | Send 10+ messages | History scrollable | P3 | ✅ |
| TC-074 | Clear chat works | Click Clear | Chat history cleared | P3 | ✅ |
| TC-075 | Quick query chips work | Click a chip | Query executes | P2 | ✅ |
| TC-076 | CSV upload in chat | Upload .csv in chat | Data loaded and matched to report | P2 | ✅ |
| TC-077 | Excel upload in chat | Upload .xlsx in chat | Data loaded and matched to report | P2 | ✅ |
| TC-078 | Report preview shows in chat | Ask for a report | Inline preview renders | P2 | ✅ |
| TC-079 | Download from chat preview | Click download in preview | File downloaded | P2 | ✅ |
| TC-080 | Navigate to report from chat | Click "View Full Report" | Reports tab opens with report | P2 | ✅ |
| TC-081 | Typing indicator shows | Send message | Typing animation shows briefly | P3 | ✅ |
| TC-082 | Enter key sends message | Press Enter | Same as Send button | P2 | ✅ |
| TC-083 | PO query works | Type "purchase orders" | PO Status shown | P2 | ✅ |
| TC-084 | Payroll query works | Type "payroll summary" | Payroll report shown | P2 | ✅ |
| TC-085 | AR query works | Type "accounts receivable aging" | AR Aging shown | P2 | ✅ |

---

## Section 4 — SQL Advisor (25 Tests)

| TC# | Test Case | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| TC-086 | SQL Advisor tab loads | Login as Technical, click SQL Advisor | Sub-tabs visible | P1 | ✅ |
| TC-087 | Performance Advisor sub-tab loads | Click Performance Advisor | Input textarea shown | P1 | ✅ |
| TC-088 | SQL analysis runs | Paste SQL, click Analyze | Results panel shown | P1 | ✅ |
| TC-089 | Missing ORG_ID detected | SQL without ORG_ID | Critical issue reported | P1 | ✅ |
| TC-090 | SELECT * detected | SQL with SELECT * | Issue reported | P1 | ✅ |
| TC-091 | Correlated subquery detected | SQL with SELECT (SELECT...) | Issue reported | P2 | ✅ |
| TC-092 | Cost estimate shown | Run analysis | Before/after cost values shown | P2 | ✅ |
| TC-093 | Optimised SQL generated | Run analysis | Optimised SQL shown | P2 | ✅ |
| TC-094 | Copy optimised SQL | Click copy | SQL copied to clipboard | P3 | ✅ |
| TC-095 | Code Review sub-tab loads | Click Code Review | Input textarea shown | P1 | ✅ |
| TC-096 | 27 checks run | Paste EBS SQL, click Review | At least 5 checks shown | P1 | ✅ |
| TC-097 | Score calculated | Run review | Score 0-100 shown | P2 | ✅ |
| TC-098 | Critical severity shown | Review SQL with ORG_ID missing | Critical badge shown | P1 | ✅ |
| TC-099 | Before/after shown | Click on an issue | Before/after code example shown | P2 | ✅ |
| TC-100 | EXECUTE IMMEDIATE detected | SQL with EXECUTE IMMEDIATE | Security issue flagged | P2 | ✅ |
| TC-101 | Formatter sub-tab loads | Click Code Formatter | Formatter inputs visible | P1 | ✅ |
| TC-102 | SELECT formatted | Paste SELECT, click Format | Formatted SQL shown | P1 | ✅ |
| TC-103 | PL/SQL formatted | Paste PL/SQL BEGIN block | Formatted output shown | P2 | ✅ |
| TC-104 | DML formatted | Paste INSERT/UPDATE | Formatted output shown | P2 | ✅ |
| TC-105 | UPPER casing | Select UPPER | Keywords in uppercase | P2 | ✅ |
| TC-106 | Formatter stats shown | Format SQL | Lines, keywords, tables count shown | P3 | ✅ |
| TC-107 | Send Formatter → Advisor | Click "Use in Advisor" | SQL loaded in Advisor | P2 | ✅ |
| TC-108 | Send Advisor → Formatter | Click "Send to Formatter" | SQL loaded in Formatter | P2 | ✅ |
| TC-109 | Sub-tabs isolated | Switch between sub-tabs | No panel bleed from other sub-tabs | P1 | ✅ |
| TC-110 | Sample SQL loads | Click Load Sample | Sample SQL populated in input | P3 | ✅ |

---

## Section 5 — EBS Academy (30 Tests)

| TC# | Test Case | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| TC-111 | Academy tab loads | Login as Technical, click Academy | Module tree + welcome shown | P1 | ✅ |
| TC-112 | All 15 modules listed | Check module tree | 15 module groups visible | P1 | ✅ |
| TC-113 | Module 1 (AP) loads | Click AP module | Topics listed | P1 | ✅ |
| TC-114 | Module 9 (DBA) loads | Click DBA module | Topics listed | P1 | ✅ |
| TC-115 | Module 10 (Architecture) loads | Click Architecture | Topics listed | P1 | ✅ |
| TC-116 | Module 11 (SOA) loads | Click SOA Integration | Topics listed | P1 | ✅ |
| TC-117 | Module 12 (APEX) loads | Click APEX/Modernisation | Topics listed | P1 | ✅ |
| TC-118 | Module 13 (Testing) loads | Click Testing & QA | Topics listed | P1 | ✅ |
| TC-119 | Module 14 (Security) loads | Click Security | Topics listed | P1 | ✅ |
| TC-120 | Module 15 (PM) loads | Click Project Manager | Topics listed | P1 | ✅ |
| TC-121 | Topic content loads | Click a topic | Text content displayed | P1 | ✅ |
| TC-122 | Flowchart renders | Click a topic with flow | SVG diagram rendered | P2 | ✅ |
| TC-123 | SQL example shown | Click AP → Invoice topic | SQL block shown in topic | P2 | ✅ |
| TC-124 | Copy SQL in Academy | Click copy on SQL block | SQL copied | P3 | ✅ |
| TC-125 | Send Academy SQL to Advisor | Click "Send to Advisor" | SQL Advisor opens with SQL | P2 | ✅ |
| TC-126 | Search narrows modules | Type "invoice" in search | AP, iExpense modules highlighted | P2 | ✅ |
| TC-127 | AI assistant opens | Click AI button | Assistant panel slides in | P2 | ✅ |
| TC-128 | AI answers AP question | Ask "what is 3-way match?" | AP-related response | P2 | ✅ |
| TC-129 | AI answers DBA question | Ask "how to apply patch" | DBA patching response | P2 | ✅ |
| TC-130 | AI answers SOA question | Ask "what is OIC?" | Integration response | P2 | ✅ |
| TC-131 | AI answers security question | Ask "how to create responsibility" | Security/access response | P2 | ✅ |
| TC-132 | AI answers PM question | Ask "what is CRP?" | Project management response | P2 | ✅ |
| TC-133 | AI answers GL question | Ask "what is period close?" | GL period close response | P2 | ✅ |
| TC-134 | AI history persists | Ask 3 questions | All 3 shown in conversation | P3 | ✅ |
| TC-135 | AI close button works | Click close | Panel slides out | P3 | ✅ |
| TC-136 | Module collapse/expand | Click module group header | Toggles open/closed | P3 | ✅ |
| TC-137 | Back to module list | Click back in topic | Module list shown | P3 | ✅ |
| TC-138 | P2P flowchart renders | Load AP → P2P topic | P2P flow SVG shown | P2 | ✅ |
| TC-139 | O2C flowchart renders | Load AR → O2C topic | O2C flow SVG shown | P2 | ✅ |
| TC-140 | Hire-to-retire flowchart | Load HRMS → topic | Flow SVG shown | P2 | ✅ |

---

## Section 6 — SQL Lab (25 Tests)

| TC# | Test Case | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| TC-141 | SQL Lab loads | Login as Technical, click SQL Lab | Category tree + welcome shown | P1 | ✅ |
| TC-142 | Category tree shows 12 categories | Check tree | 12 module categories visible | P1 | ✅ |
| TC-143 | Click category shows queries | Click AP category | AP queries listed | P1 | ✅ |
| TC-144 | Click query loads SQL | Click a query | SQL displayed in result panel | P1 | ✅ |
| TC-145 | Search library works | Type "invoice" in search | Matching queries shown | P2 | ✅ |
| TC-146 | AI prompt — AP invoice | Type "show unpaid invoices" | AP invoice SQL returned | P1 | ✅ |
| TC-147 | AI prompt — supplier | Type "list all suppliers" | Supplier SQL returned | P1 | ✅ |
| TC-148 | AI prompt — GL journal | Type "journal entries for current period" | GL SQL returned | P2 | ✅ |
| TC-149 | AI prompt — employee | Type "employee headcount by department" | HRMS SQL returned | P2 | ✅ |
| TC-150 | AI prompt — PO | Type "open purchase orders" | PO SQL returned | P2 | ✅ |
| TC-151 | Out-of-scope — Python | Type "write a Python function" | Rejection message shown | P1 | ✅ |
| TC-152 | Out-of-scope — weather | Type "what is the weather today" | Rejection message shown | P1 | ✅ |
| TC-153 | Out-of-scope — general coding | Type "sort an array in Java" | Rejection message shown | P1 | ✅ |
| TC-154 | Copy SQL Lab query | Click Copy SQL | SQL copied | P3 | ✅ |
| TC-155 | Send to Advisor | Click Send to Advisor | SQL Advisor opens with query | P2 | ✅ |
| TC-156 | Send to Formatter | Click Send to Formatter | Formatter opens with query | P2 | ✅ |
| TC-157 | Category collapse/expand | Click category header | Toggles | P3 | ✅ |
| TC-158 | Tags shown on result | Run AI prompt | Tags like [AP] [Invoice] shown | P3 | ✅ |
| TC-159 | Back to welcome | Click back in result | Welcome/prompt shown | P3 | ✅ |
| TC-160 | SQL syntax highlighted | View any query | SQL keywords coloured | P3 | ✅ |
| TC-161 | Stop words filtered | Type "show me the invoices" | "show","me","the" filtered, not scored | P2 | ✅ |
| TC-162 | Threshold enforced | Type "give" (single stop word) | Rejection message, not wrong SQL | P2 | ✅ |
| TC-163 | AR query via AI | Type "customer aging buckets" | AR SQL returned | P2 | ✅ |
| TC-164 | iExpense query via AI | Type "expense reports pending approval" | iExpense SQL returned | P2 | ✅ |
| TC-165 | 500+ queries accessible | Count queries in tree | At least 500 total queries | P2 | ✅ |

---

## Section 7 — Data Connect (30 Tests)

| TC# | Test Case | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| TC-166 | Data Connect tab loads | Click Data Connect | Welcome screen shown | P1 | ✅ |
| TC-167 | Excel source button | Click Excel button | Excel upload panel shown | P1 | ✅ |
| TC-168 | DB source button | Click Database button | DB panel shown | P1 | ✅ |
| TC-169 | Drag & drop Excel | Drag .xlsx to drop zone | File loaded | P2 | ✅ |
| TC-170 | File picker Excel | Click choose file, select .xlsx | File loaded | P1 | ✅ |
| TC-171 | CSV file loads | Select .csv file | File loaded and parsed | P1 | ✅ |
| TC-172 | File badge shown | After file loads | Filename, cols, rows shown | P2 | ✅ |
| TC-173 | Headers extracted | Load Excel file | Row 1 becomes column headers | P1 | ✅ |
| TC-174 | Header row configurable | Change header row to 2 | Row 2 used as headers | P2 | ✅ |
| TC-175 | Type detection — number | Load file with amounts | Amount col detected as 'number' | P2 | ✅ |
| TC-176 | Type detection — date | Load file with dates | Date col detected as 'date' | P2 | ✅ |
| TC-177 | Type detection — text | Load file with names | Text col detected as 'text' | P2 | ✅ |
| TC-178 | Target report dropdown | After file loads | All 26 reports in dropdown | P2 | ✅ |
| TC-179 | Auto-map works | Select target, click Auto-Map | Matching columns mapped | P2 | ✅ |
| TC-180 | Manual map works | Change a mapping dropdown | Mapping saved | P2 | ✅ |
| TC-181 | UPPER transform | Set transform to UPPER | Values uppercased in preview | P3 | ✅ |
| TC-182 | Date format transform | Set transform to Format Date | Dates normalised to YYYY-MM-DD | P3 | ✅ |
| TC-183 | Number format transform | Set transform to Format Number | Numbers formatted with commas | P3 | ✅ |
| TC-184 | Preview shows mapped data | Click Apply Mapping | Preview grid shown | P1 | ✅ |
| TC-185 | Data profile bar shown | In preview | Null%, unique, sample per column | P3 | ✅ |
| TC-186 | Preview pagination works | > 50 rows | Next/prev page buttons | P3 | ✅ |
| TC-187 | Push to Reports | Click Push to Reports | Report in sidebar now shows imported data | P1 | ✅ |
| TC-188 | Filters work on pushed data | Filter pushed report | Filters apply to new data | P2 | ✅ |
| TC-189 | Download works on pushed data | Download pushed report | File has new data | P2 | ✅ |
| TC-190 | Clear mapping | Click Clear Mapping | All mappings reset | P3 | ✅ |
| TC-191 | Clear file | Click X on badge | File removed, welcome shown | P3 | ✅ |
| TC-192 | DB Simulated — ap_invoices_all | Paste SQL with ap_invoices_all | Invoice Register data loaded | P2 | ✅ |
| TC-193 | DB Simulated — per_all_people_f | Paste SQL with per_all_people_f | Employee data loaded | P2 | ✅ |
| TC-194 | Test Connection — no proxy | Click Test Connection without proxy URL | Error "No proxy configured" shown | P2 | ✅ |
| TC-195 | Mapping guide opens | Click "How Mapping Works" | Guide modal shown | P3 | ✅ |

---

## Section 8 — Delete & Recycle Bin (25 Tests)

| TC# | Test Case | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| TC-196 | Delete button visible — Employee | Login as Employee, open report | Delete button visible | P1 | ✅ |
| TC-197 | Employee delete → request form | Click Delete as Employee | Delete request modal opens | P1 | ✅ |
| TC-198 | Request form has reason dropdown | Open request form | Reason dropdown present | P2 | ✅ |
| TC-199 | Request form has notes field | Open request form | Notes textarea present | P2 | ✅ |
| TC-200 | Submit request — notification increments | Submit delete request | Technical bell badge +1 | P2 | ✅ |
| TC-201 | Report still accessible after request | Submit request | Report NOT deleted yet | P1 | ✅ |
| TC-202 | Delete button visible — Technical | Login as Technical, open report | Delete button visible | P1 | ✅ |
| TC-203 | Technical delete → confirm modal | Click Delete as Technical | Custom confirm modal opens | P1 | ✅ |
| TC-204 | Custom modal not window.confirm | Click Delete as Technical | Custom HTML modal, not browser dialog | P1 | ✅ |
| TC-205 | Confirm OK deletes report | Click OK in confirm | Report removed from sidebar | P1 | ✅ |
| TC-206 | Cancel does NOT delete | Click Cancel in confirm | Report still in sidebar | P1 | ✅ |
| TC-207 | Deleted report removed from sidebar | After delete | Sidebar link hidden | P1 | ✅ |
| TC-208 | Deleted report cannot reopen | Try to click deleted report | Nothing loads / welcome shown | P1 | ✅ |
| TC-209 | Deleted report blocked in Chat | Ask for deleted report in chat | "Report not available" message | P1 | ✅ |
| TC-210 | Notification badge shows count | Delete 2 reports | Badge shows 2 | P2 | ✅ |
| TC-211 | Notification panel opens | Click bell | Slide panel opens | P2 | ✅ |
| TC-212 | Recycle bin section shows | Open notification panel | Recycle Bin section visible | P2 | ✅ |
| TC-213 | Deleted report in recycle bin | After delete | Report entry in Recycle Bin | P2 | ✅ |
| TC-214 | Restore from recycle bin | Click Restore | Report re-appears in sidebar | P1 | ✅ |
| TC-215 | Restored report is accessible | After restore | Report loads with data | P1 | ✅ |
| TC-216 | Restored report removed from bin | After restore | Entry removed from Recycle Bin | P2 | ✅ |
| TC-217 | Pending requests section shows | Submit employee request | Pending Requests section shows item | P2 | ✅ |
| TC-218 | Approve request deletes report | Click Approve | Report deleted | P2 | ✅ |
| TC-219 | Reject request leaves report | Click Reject | Report NOT deleted | P2 | ✅ |
| TC-220 | Clear all requests | Click Clear All | Pending requests cleared | P3 | ✅ |

---

## Section 9 — Document Generator (20 Tests)

| TC# | Test Case | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| TC-221 | Doc Generator loads | Click Doc Generator | Form shown | P1 | ✅ |
| TC-222 | Sample data loads | Click Load Sample | All form fields populated | P2 | ✅ |
| TC-223 | Technical doc generates | Fill form, select Technical, click Generate | Technical doc shown | P1 | ✅ |
| TC-224 | Functional doc generates | Select Functional, click Generate | Functional doc shown | P1 | ✅ |
| TC-225 | Both docs generate | Select Both, click Generate | Combined doc shown | P2 | ✅ |
| TC-226 | Process flow SVG renders | Generate doc | Process Flow SVG visible | P2 | ✅ |
| TC-227 | Data flow SVG renders | Generate doc | Data Flow SVG visible | P2 | ✅ |
| TC-228 | ER diagram SVG renders | Generate doc | ER Diagram SVG visible | P2 | ✅ |
| TC-229 | PL/SQL flow SVG renders | Generate doc | PL/SQL Flow SVG visible | P2 | ✅ |
| TC-230 | Add parameter row | Click Add Parameter | New row appears | P2 | ✅ |
| TC-231 | Remove parameter row | Click Remove on row | Row removed | P2 | ✅ |
| TC-232 | Parameters in output | Add 2 params, generate | Both params in output table | P2 | ✅ |
| TC-233 | Tables in output | Add source tables, generate | Tables section in doc | P2 | ✅ |
| TC-234 | Value sets in output | Add value sets, generate | Value sets section in doc | P2 | ✅ |
| TC-235 | Download as HTML | Click Download | HTML file downloaded | P2 | ✅ |
| TC-236 | Module selector populates | Choose AP in module | AP appears in doc | P3 | ✅ |
| TC-237 | Author/version in header | Fill author/version | Shown in cover page | P3 | ✅ |
| TC-238 | Clear form | Click Clear | All fields reset | P3 | ✅ |
| TC-239 | Business rules in output | Enter business rules, generate | Rules section in doc | P2 | ✅ |
| TC-240 | Error handling in output | Enter error handling, generate | Error section in doc | P2 | ✅ |

---

## Section 10 — Navigation & General (20 Tests)

| TC# | Test Case | Steps | Expected | Priority | Status |
|---|---|---|---|---|---|
| TC-241 | All tabs switch correctly | Click each tab | Correct content shown | P1 | ✅ |
| TC-242 | No tab bleed | Switch between all tabs | No content from other tabs visible | P1 | ✅ |
| TC-243 | Toast shows on success | Push data to report | Green success toast appears | P2 | ✅ |
| TC-244 | Toast shows on warning | Try invalid action | Yellow warning toast | P2 | ✅ |
| TC-245 | Toast auto-dismisses | Wait 3 seconds | Toast fades out | P3 | ✅ |
| TC-246 | Tooltips on icon buttons | Hover icon buttons | Tooltip text shown | P3 | ✅ |
| TC-247 | Mobile — reports readable | Open on phone | Table readable, horizontal scroll | P2 | ✅ |
| TC-248 | Mobile — login works | Open on phone | Login flow works | P2 | ✅ |
| TC-249 | No console errors on load | Open DevTools console | No red errors on load | P1 | ✅ |
| TC-250 | No console errors on tab switch | Switch all tabs | No errors | P1 | ✅ |
| TC-251 | Back stack works across tabs | Navigate Chat→Reports→SQL | Back returns in correct order | P2 | ✅ |
| TC-252 | IBM Plex fonts load | Check Network tab | Font files loaded | P3 | ✅ |
| TC-253 | Chart.js loads | Check Network tab | chart.umd.min.js loaded | P2 | ✅ |
| TC-254 | SheetJS loads | Check Network tab | xlsx.full.min.js loaded | P2 | ✅ |
| TC-255 | FileSaver loads | Check Network tab | FileSaver.min.js loaded | P2 | ✅ |
| TC-256 | App works on file:// protocol | Open directly from filesystem | App loads and functions | P2 | ✅ |
| TC-257 | App works served via HTTP | Serve via python -m http.server | App loads and functions | P2 | ✅ |
| TC-258 | Oracle Blue theme applied | Check primary colour | #0572CE buttons and accents | P3 | ✅ |
| TC-259 | REPORT_DATA loaded | Open DevTools → window.REPORT_DATA | Object with 26 keys | P1 | ✅ |
| TC-260 | EBS_SQL_LIBRARY loaded | window.EBS_SQL_LIBRARY in console | Object with categories + queries | P1 | ✅ |

---

## Section 11 — Ontology & Knowledge Graph (v5.2 — 20 Tests)

| TC# | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| TC-261 | ebs-ontology.jsonld valid JSON-LD | Open file in browser/validator | No parse errors, valid JSON | P1 | ✅ |
| TC-262 | ebs-complete-ontology.jsonld valid JSON | Open ica-schema/ebs-complete-ontology.jsonld | No parse errors, 2008 lines | P1 | ✅ |
| TC-263 | 30+ OWL classes in ontology | Search @type owl:Class | 30+ distinct class definitions | P2 | ✅ |
| TC-264 | RICE classes present | Search RICEComponent, EBSInterface, EBSConversion | All 11 RICE class definitions found | P1 | ✅ |
| TC-265 | AMEConfiguration class present | Search AMEConfiguration | OWL class definition found | P1 | ✅ |
| TC-266 | OracleWorkflow class present | Search OracleWorkflow | OWL class definition found | P1 | ✅ |
| TC-267 | ModuleKnowledge class present | Search ModuleKnowledge | OWL class with rdfs:subClassOf schema:LearningResource | P1 | ✅ |
| TC-268 | 13 module entities in complete ontology | Count Entity type with moduleCode | 13 modules (AP, AR, GL, PO, HRMS, PAY, INV, OM, FA, CM, BEN, iEXP, FND) | P1 | ✅ |
| TC-269 | 4 business process entities | Search BusinessProcess type | P2P, O2C, H2R, R2R with milestones | P1 | ✅ |
| TC-270 | RICE component instances present | Search RICEComponent type | 11 instances (3 RPT, 3 INT, 3 CONV, 2 EXT) | P2 | ✅ |
| TC-271 | AME config instances present | Search ameId | AME-AP-001 and AME-PO-001 found | P2 | ✅ |
| TC-272 | Workflow instances present | Search workflowId | WF-AP-001, WF-PO-001, WF-HR-001 found | P2 | ✅ |
| TC-273 | 15 ModuleKnowledge topics | Search knowledgeId | AP-FUNC-001 through INTERVIEW-001 (15 topics) | P1 | ✅ |
| TC-274 | 02-rules.json has 28 SQL rules | Count RULE_0xx entries | RULE_001 through RULE_028 present | P1 | ✅ |
| TC-275 | ORG_ID rule correct | Check RULE_001 | rule_name contains ORG_ID, severity Critical | P1 | ✅ |
| TC-276 | FND_GLOBAL rule present | Check RULE_027 | API context rule found | P2 | ✅ |
| TC-277 | 30 relationships defined | Count relationship_id in 03-relationships.json | REL_001 through REL_030 | P1 | ✅ |
| TC-278 | RICE relationship present | Check REL_020 | MODULE_HAS_RICE_COMPONENT defined | P1 | ✅ |
| TC-279 | AME→Workflow relationship | Check REL_021 | AME_CONFIG_GOVERNS_WORKFLOW defined | P2 | ✅ |
| TC-280 | Knowledge graph schema v5.2 | Check schema_version | "5.2" in ebs-knowledge-graph-schema.json | P1 | ✅ |

---

## Section 12 — Data Connect Mapping (v5.2 — 11 Tests)

| TC# | Test Case | Steps | Expected Result | Priority | Status |
|---|---|---|---|---|---|
| TC-281 | Excel headers fuzzy-matched | Upload Excel with VENDOR_NAME column | Mapped to vendor_name in AP report | P1 | ✅ |
| TC-282 | Normalisation strips separators | Header "Invoice Number" → normalise | Returns "invoicenumber" | P1 | ✅ |
| TC-283 | Exact match has confidence 1.0 | Upload column exactly matching target | Mapping confidence = 1.0 | P1 | ✅ |
| TC-284 | Partial match works | Upload "Inv Num" | Fuzzy matches to INVOICE_NUM (confidence ≥ 0.7) | P2 | ✅ |
| TC-285 | Unmatched column shown | Upload column with no EBS match | Shown as "No match" in mapping table | P2 | ✅ |
| TC-286 | Date transform applied | Select date_fmt transform on date column | 01/15/2024 → 2024-01-15 | P2 | ✅ |
| TC-287 | Number transform applied | Select num_fmt transform | 15000 → 15,000.00 | P3 | ✅ |
| TC-288 | DB Simulated column match | Select simulated DB, query AP invoices | INVOICE_NUM, VENDOR_NAME mapped correctly | P1 | ✅ |
| TC-289 | 100 column mapping rules in CSV | Open ica-schema/csv/column_mapping_rules.csv | 100 rows of mapping rules | P2 | ✅ |
| TC-290 | Live DB proxy contract | POST /query with SQL+credentials | Returns {columns:[], rows:[]} JSON | P2 | ✅ |
| TC-291 | Data pushed to REPORT_DATA | After mapping + push | window.REPORT_DATA[key].rows updated | P1 | ✅ |

---

*Test Cases v5.2 — Oracle EBS Intelligence Hub — IBM ICA*
