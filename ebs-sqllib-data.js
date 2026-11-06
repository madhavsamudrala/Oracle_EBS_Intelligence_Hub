/* ═══════════════════════════════════════════════════════════════════
   Oracle EBS SQL Library Data — Tab 5: SQL Generator & DBA Reference
   Version 1.0 | Oracle E-Business Suite compatible | All queries production-ready
   ═══════════════════════════════════════════════════════════════════ */
'use strict';
window.EBS_SQL_LIBRARY = {

/* ── CATEGORY INDEX ─────────────────────────────────────────────── */
categories: [

/* ══════════════════════════════════════════════════════════════════
   1. CONCURRENT PROGRAMS
   ══════════════════════════════════════════════════════════════════ */
{
  id:'concurrentPrograms', icon:'⚙️', label:'Concurrent Programs',
  desc:'Long-running queries, request details, responsibilities, request sets, performance analysis',
  subcategories:[
  {
    id:'longRunning', label:'Long Running & Failed Programs',
    queries:[
    {
      id:'cp_long_running',
      title:'Long Running Programs (> 30 min, grouped)',
      desc:'Groups all completed/running requests by program, shows avg/max runtime',
      tags:['concurrent','performance','DBA','monitoring'],
      sql:`/* ──────────────────────────────────────────────────────────
   Long Running Concurrent Programs — Grouped Summary
   Shows programs with average runtime > 30 minutes.
   Run as APPS user or with SELECT on FND tables.
   ────────────────────────────────────────────────────────── */
SELECT
    fcpv.user_concurrent_program_name         program_name,
    fcp.concurrent_program_name               short_name,
    fa.application_short_name                 application,
    COUNT(*)                                  total_runs,
    ROUND(AVG((fcr.actual_completion_date - fcr.actual_start_date) * 1440), 2)
                                              avg_runtime_mins,
    ROUND(MAX((fcr.actual_completion_date - fcr.actual_start_date) * 1440), 2)
                                              max_runtime_mins,
    ROUND(MIN((fcr.actual_completion_date - fcr.actual_start_date) * 1440), 2)
                                              min_runtime_mins,
    SUM(CASE WHEN fcr.status_code = 'E' THEN 1 ELSE 0 END)
                                              error_count,
    SUM(CASE WHEN fcr.status_code = 'C' THEN 1 ELSE 0 END)
                                              completed_count
FROM
    fnd_concurrent_requests        fcr,
    fnd_concurrent_programs        fcp,
    fnd_concurrent_programs_vl     fcpv,
    fnd_application                fa
WHERE
    fcr.concurrent_program_id  = fcp.concurrent_program_id
AND fcr.program_application_id = fcp.application_id
AND fcp.concurrent_program_id  = fcpv.concurrent_program_id
AND fcp.application_id         = fcpv.application_id
AND fcp.application_id         = fa.application_id
AND fcr.actual_start_date      IS NOT NULL
AND fcr.actual_completion_date IS NOT NULL
AND fcr.actual_start_date      >= SYSDATE - 90   -- last 90 days
AND (fcr.actual_completion_date - fcr.actual_start_date) * 1440 > 30
GROUP BY
    fcpv.user_concurrent_program_name,
    fcp.concurrent_program_name,
    fa.application_short_name
HAVING
    AVG((fcr.actual_completion_date - fcr.actual_start_date) * 1440) > 30
ORDER BY
    avg_runtime_mins DESC
FETCH FIRST 50 ROWS ONLY;`
    },
    {
      id:'cp_top10_today',
      title:'Top 10 Longest Running Requests Today',
      desc:'Requests started today ordered by elapsed time, shows current status',
      tags:['concurrent','monitoring','today','DBA'],
      sql:`/* ──────────────────────────────────────────────────────────
   Top 10 Longest Running Concurrent Requests — Today
   Shows requests started today with elapsed time in minutes.
   ────────────────────────────────────────────────────────── */
SELECT
    fcr.request_id,
    fcpv.user_concurrent_program_name          program_name,
    fu.user_name                               submitted_by,
    fcr.actual_start_date                      start_time,
    NVL(fcr.actual_completion_date, SYSDATE)   end_time,
    ROUND((NVL(fcr.actual_completion_date, SYSDATE)
           - fcr.actual_start_date) * 1440, 2) elapsed_mins,
    DECODE(fcr.status_code,
        'R', 'Running',
        'C', 'Completed',
        'E', 'Error',
        'G', 'Warning',
        'T', 'Terminated',
        'I', 'Inactive',
        'Q', 'Pending',
        fcr.status_code)                        status,
    DECODE(fcr.phase_code,
        'R', 'Running',
        'C', 'Completed',
        'P', 'Pending',
        'I', 'Inactive',
        fcr.phase_code)                         phase,
    fcr.logfile_name,
    fcr.outfile_name
FROM
    fnd_concurrent_requests    fcr,
    fnd_concurrent_programs_vl fcpv,
    fnd_user                   fu
WHERE
    fcr.concurrent_program_id  = fcpv.concurrent_program_id
AND fcr.program_application_id = fcpv.application_id
AND fcr.requested_by           = fu.user_id
AND TRUNC(fcr.actual_start_date) = TRUNC(SYSDATE)
AND fcr.actual_start_date      IS NOT NULL
ORDER BY
    elapsed_mins DESC
FETCH FIRST 10 ROWS ONLY;`
    },
    {
      id:'cp_failed_7days',
      title:'Failed Concurrent Requests — Last 7 Days',
      desc:'All errored/terminated requests in last 7 days with log file path',
      tags:['concurrent','errors','DBA','audit'],
      sql:`/* ──────────────────────────────────────────────────────────
   Failed Concurrent Requests — Last 7 Days
   Status E=Error, T=Terminated, G=Warning
   ────────────────────────────────────────────────────────── */
SELECT
    fcr.request_id,
    fcpv.user_concurrent_program_name    program_name,
    fa.application_short_name            application,
    fu.user_name                         submitted_by,
    fcr.requested_start_date             scheduled_start,
    fcr.actual_start_date                actual_start,
    fcr.actual_completion_date           completed_at,
    ROUND((fcr.actual_completion_date
         - fcr.actual_start_date)*1440,2) runtime_mins,
    DECODE(fcr.status_code,
        'E','Error','T','Terminated','G','Warning',
        fcr.status_code)                 status,
    fcr.completion_text                  error_message,
    fcr.logfile_name                     log_file,
    fcr.outfile_name                     output_file
FROM
    fnd_concurrent_requests    fcr,
    fnd_concurrent_programs_vl fcpv,
    fnd_application            fa,
    fnd_user                   fu
WHERE
    fcr.concurrent_program_id  = fcpv.concurrent_program_id
AND fcr.program_application_id = fcpv.application_id
AND fcpv.application_id        = fa.application_id
AND fcr.requested_by           = fu.user_id
AND fcr.status_code            IN ('E','T','G')
AND fcr.requested_start_date   >= SYSDATE - 7
ORDER BY
    fcr.actual_start_date DESC;`
    },
    {
      id:'cp_currently_running_1hr',
      title:'Programs Running > 1 Hour Right Now',
      desc:'Active requests that have been running for more than 60 minutes',
      tags:['concurrent','monitoring','realtime','DBA'],
      sql:`/* ──────────────────────────────────────────────────────────
   Concurrent Programs Currently Running > 1 Hour
   Use to identify runaway jobs that may need investigation.
   ────────────────────────────────────────────────────────── */
SELECT
    fcr.request_id,
    fcpv.user_concurrent_program_name       program_name,
    fa.application_short_name               application,
    fu.user_name                            submitted_by,
    fcr.actual_start_date                   start_time,
    ROUND((SYSDATE - fcr.actual_start_date) * 1440, 2)
                                            running_mins,
    ROUND((SYSDATE - fcr.actual_start_date) * 24,  2)
                                            running_hours,
    fcr.logfile_name
FROM
    fnd_concurrent_requests    fcr,
    fnd_concurrent_programs_vl fcpv,
    fnd_application            fa,
    fnd_user                   fu
WHERE
    fcr.concurrent_program_id  = fcpv.concurrent_program_id
AND fcr.program_application_id = fcpv.application_id
AND fcpv.application_id        = fa.application_id
AND fcr.requested_by           = fu.user_id
AND fcr.phase_code             = 'R'          -- Running phase
AND fcr.status_code            = 'R'          -- Running status
AND fcr.actual_start_date      IS NOT NULL
AND (SYSDATE - fcr.actual_start_date) * 1440  > 60
ORDER BY
    running_mins DESC;`
    }
    ]
  },
  {
    id:'requestDetails', label:'Request Details & Audit Trail',
    queries:[
    {
      id:'cp_by_request_id',
      title:'All Requests for a Specific Request ID (Parent + Children)',
      desc:'Shows a request and all its child requests with full hierarchy',
      tags:['concurrent','request_id','audit'],
      sql:`/* ──────────────────────────────────────────────────────────
   Concurrent Request + All Child Requests by Request ID
   Replace :p_request_id with the parent request ID.
   ────────────────────────────────────────────────────────── */
SELECT
    LPAD(' ', LEVEL*2) || fcr.request_id           request_id,
    LEVEL                                           hierarchy_level,
    fcr.parent_request_id,
    fcpv.user_concurrent_program_name               program_name,
    fu.user_name                                    submitted_by,
    fcr.actual_start_date                           start_time,
    fcr.actual_completion_date                      end_time,
    ROUND((NVL(fcr.actual_completion_date,SYSDATE)
          - fcr.actual_start_date)*1440,2)          elapsed_mins,
    DECODE(fcr.status_code,
        'R','Running','C','Completed','E','Error',
        'T','Terminated','Q','Pending',fcr.status_code) status,
    fcr.completion_text
FROM
    fnd_concurrent_requests    fcr,
    fnd_concurrent_programs_vl fcpv,
    fnd_user                   fu
WHERE
    fcr.concurrent_program_id  = fcpv.concurrent_program_id (+)
AND fcr.program_application_id = fcpv.application_id (+)
AND fcr.requested_by           = fu.user_id
START WITH
    fcr.request_id             = :p_request_id
CONNECT BY PRIOR
    fcr.request_id             = fcr.parent_request_id
ORDER SIBLINGS BY
    fcr.request_id;`
    },
    {
      id:'cp_full_audit',
      title:'Full Audit Trail of a Concurrent Request',
      desc:'Parameters, arguments, log path, output path for any request ID',
      tags:['concurrent','audit','parameters','request_id'],
      sql:`/* ──────────────────────────────────────────────────────────
   Complete Audit Trail for One Concurrent Request
   Includes parameters passed at submission time.
   Replace :p_request_id with your request ID.
   ────────────────────────────────────────────────────────── */
-- Main request details
SELECT
    fcr.request_id,
    fcpv.user_concurrent_program_name    program_name,
    fcp.concurrent_program_name          short_name,
    fa.application_short_name            application,
    fu.user_name                         submitted_by,
    frt.responsibility_name              responsibility,
    fcr.requested_start_date             scheduled_start,
    fcr.actual_start_date                actual_start,
    fcr.actual_completion_date           actual_end,
    ROUND((fcr.actual_completion_date
          - fcr.actual_start_date)*1440,2) runtime_mins,
    DECODE(fcr.phase_code,'R','Running','C','Completed',
                          'P','Pending','I','Inactive',fcr.phase_code) phase,
    DECODE(fcr.status_code,'C','Normal','E','Error','G','Warning',
                           'T','Terminated','H','On Hold',fcr.status_code) status,
    fcr.completion_text                  completion_message,
    fcr.argument_text                    all_parameters,
    fcr.logfile_name                     log_file_path,
    fcr.outfile_name                     output_file_path,
    fcr.number_of_arguments              param_count
FROM
    fnd_concurrent_requests    fcr,
    fnd_concurrent_programs    fcp,
    fnd_concurrent_programs_vl fcpv,
    fnd_application            fa,
    fnd_user                   fu,
    fnd_responsibility_tl      frt
WHERE
    fcr.concurrent_program_id  = fcp.concurrent_program_id
AND fcr.program_application_id = fcp.application_id
AND fcp.concurrent_program_id  = fcpv.concurrent_program_id
AND fcp.application_id         = fcpv.application_id
AND fcp.application_id         = fa.application_id
AND fcr.requested_by           = fu.user_id
AND fcr.responsibility_id      = frt.responsibility_id (+)
AND frt.language               = 'US'
AND fcr.request_id             = :p_request_id;`
    },
    {
      id:'cp_request_sets',
      title:'Request Sets and All Programs Included',
      desc:'Lists all request sets with every program in each set',
      tags:['concurrent','request_sets','setup'],
      sql:`/* ──────────────────────────────────────────────────────────
   Request Sets — All Sets with Member Programs
   Shows every program included in each request set.
   ────────────────────────────────────────────────────────── */
SELECT
    frsvl.user_request_set_name    request_set_name,
    frs.request_set_name           request_set_code,
    fa.application_short_name      set_application,
    frsg.stage_name                stage_name,
    frsg.sequence                  stage_seq,
    frsl.stage_function_sequence   program_seq,
    fcpv.user_concurrent_program_name program_name,
    fcp.concurrent_program_name    program_short_name,
    fa2.application_short_name     program_application
FROM
    fnd_request_sets               frs,
    fnd_request_sets_vl            frsvl,
    fnd_request_set_stages         frsg,
    fnd_request_set_stage_fns      frsl,
    fnd_concurrent_programs        fcp,
    fnd_concurrent_programs_vl     fcpv,
    fnd_application                fa,
    fnd_application                fa2
WHERE
    frs.request_set_id       = frsvl.request_set_id
AND frs.application_id       = frsvl.application_id
AND frs.request_set_id       = frsg.request_set_id
AND frs.application_id       = frsg.set_application_id
AND frsg.request_set_id      = frsl.request_set_id
AND frsg.set_application_id  = frsl.set_application_id
AND frsg.request_set_stage_id= frsl.request_set_stage_id
AND frsl.concurrent_program_id   = fcp.concurrent_program_id
AND frsl.program_application_id  = fcp.application_id
AND fcp.concurrent_program_id    = fcpv.concurrent_program_id
AND fcp.application_id           = fcpv.application_id
AND frs.application_id           = fa.application_id
AND fcp.application_id           = fa2.application_id
ORDER BY
    request_set_name, stage_seq, program_seq;`
    }
    ]
  },
  {
    id:'respAccess', label:'Responsibilities & Access',
    queries:[
    {
      id:'cp_resp_for_program',
      title:'Responsibilities Attached to a Concurrent Program',
      desc:'Find every responsibility that can run a given concurrent program',
      tags:['concurrent','security','responsibility','access'],
      sql:`/* ──────────────────────────────────────────────────────────
   Responsibilities Attached to a Concurrent Program
   Replace :p_program_name with the program short name.
   ────────────────────────────────────────────────────────── */
SELECT DISTINCT
    frtl.responsibility_name           responsibility,
    fa.application_short_name          resp_application,
    fcp.concurrent_program_name        program_short_name,
    fcpv.user_concurrent_program_name  program_name,
    fa2.application_short_name         program_application,
    fr.start_date,
    fr.end_date,
    CASE WHEN NVL(fr.end_date, SYSDATE+1) > SYSDATE
         THEN 'Active' ELSE 'Inactive' END   resp_status
FROM
    fnd_responsibility           fr,
    fnd_responsibility_tl        frtl,
    fnd_application              fa,
    fnd_concurrent_programs      fcp,
    fnd_concurrent_programs_vl   fcpv,
    fnd_application              fa2,
    fnd_request_group_units      frgu,
    fnd_request_groups           frg
WHERE
    fr.responsibility_id          = frtl.responsibility_id
AND fr.application_id             = frtl.application_id
AND frtl.language                 = 'US'
AND fr.application_id             = fa.application_id
AND fr.request_group_id           = frg.request_group_id (+)
AND fr.group_application_id       = frg.application_id (+)
AND frg.request_group_id          = frgu.request_group_id (+)
AND frgu.request_unit_type        = 'P'
AND frgu.request_unit_id          = fcp.concurrent_program_id (+)
AND fcp.application_id            = fa2.application_id (+)
AND fcp.concurrent_program_id     = fcpv.concurrent_program_id (+)
AND fcp.application_id            = fcpv.application_id (+)
AND UPPER(fcp.concurrent_program_name) LIKE UPPER('%' || :p_program_name || '%')
ORDER BY
    responsibility;`
    },
    {
      id:'cp_programs_for_resp',
      title:'All Concurrent Programs for a Responsibility',
      desc:'List every program accessible from a given responsibility name',
      tags:['concurrent','responsibility','access','security'],
      sql:`/* ──────────────────────────────────────────────────────────
   All Concurrent Programs for a Given Responsibility
   Replace :p_responsibility with responsibility name (partial OK).
   ────────────────────────────────────────────────────────── */
SELECT
    frtl.responsibility_name           responsibility,
    fcpv.user_concurrent_program_name  program_name,
    fcp.concurrent_program_name        program_short_name,
    fa.application_short_name          application,
    DECODE(frgu.request_unit_type,
        'P','Program','S','Program Set',
        'A','Application', frgu.request_unit_type) unit_type,
    fex.execution_file_name            executable_file,
    fex.execution_method_code          exec_method
FROM
    fnd_responsibility_tl          frtl,
    fnd_responsibility             fr,
    fnd_request_groups             frg,
    fnd_request_group_units        frgu,
    fnd_concurrent_programs        fcp,
    fnd_concurrent_programs_vl     fcpv,
    fnd_application                fa,
    fnd_executables                fex
WHERE
    frtl.responsibility_id      = fr.responsibility_id
AND frtl.application_id         = fr.application_id
AND frtl.language               = 'US'
AND fr.request_group_id         = frg.request_group_id
AND fr.group_application_id     = frg.application_id
AND frg.request_group_id        = frgu.request_group_id
AND frgu.request_unit_type      = 'P'
AND frgu.request_unit_id        = fcp.concurrent_program_id
AND frgu.unit_application_id    = fcp.application_id
AND fcp.concurrent_program_id   = fcpv.concurrent_program_id
AND fcp.application_id          = fcpv.application_id
AND fcp.application_id          = fa.application_id
AND fcp.executable_id           = fex.executable_id (+)
AND fcp.executable_application_id = fex.application_id (+)
AND UPPER(frtl.responsibility_name) LIKE UPPER('%' || :p_responsibility || '%')
ORDER BY
    program_name;`
    }
    ]
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   2. DDL / DML / TCL
   ══════════════════════════════════════════════════════════════════ */
{
  id:'ddlDml', icon:'🏗️', label:'DDL / DML / TCL',
  desc:'Table creation, ALTER, INSERT, UPDATE, MERGE, DELETE, SAVEPOINT, COMMIT patterns',
  subcategories:[
  {
    id:'ddl', label:'DDL — Table & Index Operations',
    queries:[
    {
      id:'ddl_create_table',
      title:'CREATE TABLE — Oracle EBS Style with Constraints',
      desc:'Full CREATE TABLE with all column types, NOT NULL, PK, FK, indexes, storage',
      tags:['DDL','DBA','CREATE','table'],
      sql:`/* ──────────────────────────────────────────────────────────
   CREATE TABLE — Oracle E-Business Suite Style
   Includes: column types, constraints, storage clause.
   Replace APPS with your schema name as needed.
   ────────────────────────────────────────────────────────── */
CREATE TABLE apps.xxcus_invoice_staging
(
    -- Primary key (sequence-generated)
    staging_id             NUMBER(15)      NOT NULL,

    -- Multi-org mandatory columns
    org_id                 NUMBER(15)      NOT NULL,
    set_of_books_id        NUMBER(15),

    -- Business key columns
    invoice_num            VARCHAR2(50)    NOT NULL,
    invoice_date           DATE            NOT NULL,
    vendor_id              NUMBER(15)      NOT NULL,
    vendor_site_id         NUMBER(15),
    invoice_type_lookup_code VARCHAR2(25)  DEFAULT 'STANDARD',
    invoice_amount         NUMBER(28,10)   NOT NULL,
    currency_code          VARCHAR2(15)    DEFAULT 'USD' NOT NULL,
    description            VARCHAR2(240),

    -- Processing control columns
    process_flag           VARCHAR2(1)     DEFAULT 'N' NOT NULL,
    process_date           DATE,
    error_message          VARCHAR2(2000),
    interface_run_id       NUMBER(15),

    -- WHO columns (Oracle EBS standard)
    created_by             NUMBER(15)      DEFAULT -1   NOT NULL,
    creation_date          DATE            DEFAULT SYSDATE NOT NULL,
    last_updated_by        NUMBER(15)      DEFAULT -1   NOT NULL,
    last_update_date       DATE            DEFAULT SYSDATE NOT NULL,
    last_update_login      NUMBER(15),
    request_id             NUMBER(15),
    program_id             NUMBER(15),
    program_application_id NUMBER(15),
    program_update_date    DATE,

    -- Primary key constraint
    CONSTRAINT xxcus_inv_stg_pk
        PRIMARY KEY (staging_id)
        USING INDEX TABLESPACE apps_ts_tx_idx,

    -- Check constraint
    CONSTRAINT xxcus_inv_stg_type_ck
        CHECK (invoice_type_lookup_code IN
               ('STANDARD','CREDIT','PREPAYMENT','MIXED','EXPENSE REPORT')),

    CONSTRAINT xxcus_inv_stg_flag_ck
        CHECK (process_flag IN ('Y','N','E'))
)
TABLESPACE apps_ts_tx_data
STORAGE (INITIAL 1M NEXT 1M PCTINCREASE 0)
PCTFREE 10
PCTUSED 40;

-- Unique index on business key (prevent duplicate invoices per vendor/org)
CREATE UNIQUE INDEX apps.xxcus_inv_stg_u1
    ON apps.xxcus_invoice_staging (org_id, vendor_id, invoice_num)
    TABLESPACE apps_ts_tx_idx;

-- Non-unique index on process_flag for ETL queries
CREATE INDEX apps.xxcus_inv_stg_n1
    ON apps.xxcus_invoice_staging (process_flag, process_date)
    TABLESPACE apps_ts_tx_idx;

-- Comment the table and key columns
COMMENT ON TABLE  apps.xxcus_invoice_staging IS
    'Custom AP Invoice Staging Table — Interface to AP_INVOICES_ALL via API';
COMMENT ON COLUMN apps.xxcus_invoice_staging.process_flag IS
    'N=New/Unprocessed, Y=Successfully Imported, E=Error';`
    },
    {
      id:'ddl_alter_table',
      title:'ALTER TABLE — Add/Modify/Drop Column & Constraint',
      desc:'Common ALTER TABLE patterns for modifying Oracle EBS custom tables',
      tags:['DDL','ALTER','column','constraint'],
      sql:`/* ──────────────────────────────────────────────────────────
   ALTER TABLE — Common Operations
   ────────────────────────────────────────────────────────── */

-- 1. Add a new column
ALTER TABLE apps.xxcus_invoice_staging
    ADD (exchange_rate NUMBER(28,10));

-- 2. Add multiple columns at once
ALTER TABLE apps.xxcus_invoice_staging
    ADD (
        batch_name          VARCHAR2(100),
        source_system       VARCHAR2(50)  DEFAULT 'LEGACY',
        validated_flag      VARCHAR2(1)   DEFAULT 'N'
    );

-- 3. Modify an existing column (increase size)
ALTER TABLE apps.xxcus_invoice_staging
    MODIFY (description VARCHAR2(500));

-- 4. Modify default value
ALTER TABLE apps.xxcus_invoice_staging
    MODIFY (currency_code DEFAULT 'USD');

-- 5. Add a NOT NULL constraint (table must have no NULLs first)
UPDATE apps.xxcus_invoice_staging
   SET validated_flag = 'N'
 WHERE validated_flag IS NULL;
COMMIT;
ALTER TABLE apps.xxcus_invoice_staging
    MODIFY (validated_flag NOT NULL);

-- 6. Add a foreign key constraint
ALTER TABLE apps.xxcus_invoice_staging
    ADD CONSTRAINT xxcus_inv_stg_org_fk
        FOREIGN KEY (org_id)
        REFERENCES hr_operating_units (organization_id)
        ENABLE NOVALIDATE;   -- NOVALIDATE skips checking existing rows

-- 7. Drop a column (mark unusable first for safety)
ALTER TABLE apps.xxcus_invoice_staging
    SET UNUSED COLUMN exchange_rate;
-- Then drop later during low-activity window:
ALTER TABLE apps.xxcus_invoice_staging
    DROP UNUSED COLUMNS;

-- 8. Rename a column (Oracle 9i+)
ALTER TABLE apps.xxcus_invoice_staging
    RENAME COLUMN source_system TO source_system_code;`
    },
    {
      id:'ddl_create_index',
      title:'CREATE INDEX — EBS Multi-Org Pattern with ORG_ID Leading',
      desc:'ORG_ID must be the leading column on all _ALL table indexes in Oracle EBS',
      tags:['DDL','index','performance','multi-org','DBA'],
      sql:`/* ──────────────────────────────────────────────────────────
   CREATE INDEX — Oracle EBS Multi-Org Best Practice
   ORG_ID MUST be the leading column on _ALL table indexes.
   Missing this causes full table scans across all orgs.
   ────────────────────────────────────────────────────────── */

-- Correct: ORG_ID leading (returns only rows for the queried org)
CREATE INDEX apps.xxcus_inv_stg_n2
    ON apps.xxcus_invoice_staging
       (org_id, vendor_id, invoice_date)
    TABLESPACE apps_ts_tx_idx
    PARALLEL 4
    NOLOGGING;
-- After rebuild, reset to NOPARALLEL/LOGGING for production
ALTER INDEX apps.xxcus_inv_stg_n2 NOPARALLEL LOGGING;

-- Function-based index (for UPPER() searches)
CREATE INDEX apps.xxcus_inv_stg_n3
    ON apps.xxcus_invoice_staging
       (UPPER(invoice_num))
    TABLESPACE apps_ts_tx_idx;

-- Bitmap index (only for low-cardinality columns in data warehouse schemas)
-- WARNING: do NOT use bitmap indexes on OLTP tables — causes lock contention
CREATE BITMAP INDEX apps.xxcus_inv_stg_b1
    ON apps.xxcus_invoice_staging (process_flag)
    TABLESPACE apps_ts_tx_idx;

-- Check index usage (enable monitoring first):
ALTER INDEX apps.xxcus_inv_stg_n2 MONITORING USAGE;
-- Run your application queries...
-- Then check:
SELECT index_name, monitoring, used, start_monitoring, end_monitoring
  FROM v$object_usage
 WHERE index_name = 'XXCUS_INV_STG_N2';
ALTER INDEX apps.xxcus_inv_stg_n2 NOMONITORING USAGE;`
    }
    ]
  },
  {
    id:'dml', label:'DML — INSERT / UPDATE / MERGE / DELETE',
    queries:[
    {
      id:'dml_insert_select',
      title:'INSERT INTO … SELECT (Copy Rows Between Tables)',
      desc:'Copy rows from one table to another with transformation logic',
      tags:['DML','INSERT','SELECT','ETL'],
      sql:`/* ──────────────────────────────────────────────────────────
   INSERT INTO … SELECT — Copy with Transformation
   Example: move processed rows from staging to archive table.
   ────────────────────────────────────────────────────────── */
INSERT INTO apps.xxcus_invoice_archive
    (staging_id, org_id, vendor_id, invoice_num, invoice_date,
     invoice_amount, currency_code, description,
     archive_date, archived_by,
     created_by, creation_date, last_updated_by, last_update_date)
SELECT
    staging_id,
    org_id,
    vendor_id,
    invoice_num,
    invoice_date,
    invoice_amount,
    currency_code,
    description,
    SYSDATE          AS archive_date,
    fnd_global.user_id() AS archived_by,
    created_by,
    creation_date,
    fnd_global.user_id(),
    SYSDATE
FROM
    apps.xxcus_invoice_staging
WHERE
    process_flag = 'Y'                      -- Only successfully processed rows
AND process_date < TRUNC(SYSDATE) - 30;     -- Older than 30 days

COMMIT;`
    },
    {
      id:'dml_merge',
      title:'MERGE (Upsert) — Staging to Target Table',
      desc:'Standard MERGE pattern used in Oracle EBS interface/conversion programs',
      tags:['DML','MERGE','upsert','ETL','interface'],
      sql:`/* ──────────────────────────────────────────────────────────
   MERGE (Upsert) Pattern — Oracle EBS Interface Programs
   Use MERGE when you need to INSERT new rows and UPDATE
   existing rows in one atomic statement.
   ────────────────────────────────────────────────────────── */
MERGE INTO apps.xxcus_supplier_master tgt
USING (
    -- Source: external data from staging table
    SELECT
        stg.vendor_number,
        stg.vendor_name,
        stg.tax_registration_num,
        stg.country,
        stg.phone,
        stg.email,
        stg.org_id
    FROM apps.xxcus_supplier_staging stg
    WHERE stg.process_flag = 'N'
) src
ON (
    tgt.vendor_number = src.vendor_number
AND tgt.org_id        = src.org_id
)
-- When a matching row already exists → UPDATE it
WHEN MATCHED THEN
    UPDATE SET
        tgt.vendor_name          = src.vendor_name,
        tgt.tax_registration_num = src.tax_registration_num,
        tgt.country              = src.country,
        tgt.phone                = src.phone,
        tgt.email                = src.email,
        tgt.last_updated_by      = fnd_global.user_id(),
        tgt.last_update_date     = SYSDATE,
        tgt.last_update_login    = fnd_global.login_id()
    WHERE
        -- Only update if data has actually changed (avoid unnecessary redo)
        NVL(tgt.vendor_name,'~')          <> NVL(src.vendor_name,'~')
     OR NVL(tgt.tax_registration_num,'~') <> NVL(src.tax_registration_num,'~')

-- When no matching row exists → INSERT it
WHEN NOT MATCHED THEN
    INSERT (
        vendor_master_id,
        vendor_number, vendor_name, tax_registration_num,
        country, phone, email, org_id,
        created_by, creation_date,
        last_updated_by, last_update_date, last_update_login
    )
    VALUES (
        xxcus_vendor_master_s.NEXTVAL,
        src.vendor_number, src.vendor_name, src.tax_registration_num,
        src.country, src.phone, src.email, src.org_id,
        fnd_global.user_id(), SYSDATE,
        fnd_global.user_id(), SYSDATE, fnd_global.login_id()
    );`
    }
    ]
  },
  {
    id:'tcl', label:'TCL — Transaction Control',
    queries:[
    {
      id:'tcl_savepoint',
      title:'SAVEPOINT / ROLLBACK TO SAVEPOINT Pattern',
      desc:'Partial rollback inside a PL/SQL block using savepoints',
      tags:['TCL','SAVEPOINT','ROLLBACK','transaction'],
      sql:`/* ──────────────────────────────────────────────────────────
   SAVEPOINT and ROLLBACK TO SAVEPOINT
   Use when you want to undo part of a transaction, not all.
   ────────────────────────────────────────────────────────── */
DECLARE
    v_err_msg  VARCHAR2(2000);
    v_count    NUMBER := 0;
BEGIN
    -- Step 1: Insert header record
    INSERT INTO apps.xxcus_batch_header
        (batch_id, batch_name, status, created_by, creation_date)
    VALUES
        (xxcus_batch_s.NEXTVAL, 'BATCH-2025-001', 'NEW',
         fnd_global.user_id(), SYSDATE);

    SAVEPOINT sp_after_header;   -- Mark a safe return point

    -- Step 2: Insert line records (may fail)
    FOR i IN 1..100 LOOP
        BEGIN
            INSERT INTO apps.xxcus_batch_lines
                (line_id, batch_id, line_num, amount, status)
            VALUES
                (xxcus_batch_line_s.NEXTVAL,
                 xxcus_batch_s.CURRVAL, i, i * 100, 'NEW');
            v_count := v_count + 1;

        EXCEPTION
            WHEN OTHERS THEN
                -- Roll back only the failed line, not the header
                ROLLBACK TO sp_after_header;
                v_err_msg := SQLERRM;
                DBMS_OUTPUT.PUT_LINE('Line ' || i || ' failed: ' || v_err_msg);
                EXIT;  -- Stop processing further lines
        END;
    END LOOP;

    -- Commit only if all lines inserted successfully
    IF v_count = 100 THEN
        COMMIT;
        DBMS_OUTPUT.PUT_LINE('Success: ' || v_count || ' lines committed.');
    ELSE
        ROLLBACK;  -- Roll back everything including the header
        DBMS_OUTPUT.PUT_LINE('Failed — full rollback executed.');
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE_APPLICATION_ERROR(-20001,
            'Transaction failed: ' || SQLERRM);
END;
/`
    }
    ]
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   3. PL/SQL OBJECTS
   ══════════════════════════════════════════════════════════════════ */
{
  id:'plsql', icon:'📦', label:'PL/SQL Objects',
  desc:'Procedures, functions, packages, triggers, cursors, exception handling — all Oracle EBS style',
  subcategories:[
  {
    id:'procedures', label:'Procedures & Functions',
    queries:[
    {
      id:'proc_ebs_template',
      title:'Stored Procedure — Oracle EBS Concurrent Program Template',
      desc:'Standard EBS procedure with ERRBUF, RETCODE, FND_LOG, MO_GLOBAL, exception handling',
      tags:['PL/SQL','procedure','concurrent','template','EBS'],
      sql:`/* ──────────────────────────────────────────────────────────
   Oracle EBS Concurrent Program Procedure Template
   This is the standard structure for ALL EBS custom programs.
   ERRBUF  = error message returned to Concurrent Manager
   RETCODE = '0' Normal, '1' Warning, '2' Error
   ────────────────────────────────────────────────────────── */
CREATE OR REPLACE PROCEDURE apps.xxap_process_invoices
(
    -- Standard concurrent program parameters (MUST be first two, MUST be IN OUT)
    errbuf          OUT  VARCHAR2,
    retcode         OUT  VARCHAR2,

    -- Custom parameters (match the concurrent program parameter definitions)
    p_org_id        IN   NUMBER,
    p_start_date    IN   VARCHAR2,    -- VARCHAR2 from CP, convert to DATE inside
    p_end_date      IN   VARCHAR2,
    p_batch_name    IN   VARCHAR2     DEFAULT NULL
)
IS
    -- ── Local type declarations ─────────────────────────────────
    TYPE t_invoice_tab IS TABLE OF apps.xxcus_invoice_staging%ROWTYPE
        INDEX BY PLS_INTEGER;

    -- ── Local variable declarations ─────────────────────────────
    l_invoice_tab      t_invoice_tab;
    l_start_date       DATE;
    l_end_date         DATE;
    l_success_count    NUMBER := 0;
    l_error_count      NUMBER := 0;
    l_request_id       NUMBER := fnd_global.conc_request_id();
    l_user_id          NUMBER := fnd_global.user_id();
    l_login_id         NUMBER := fnd_global.login_id();

    -- ── Constants ──────────────────────────────────────────────
    c_program_name     CONSTANT VARCHAR2(30) := 'XXAP_PROCESS_INVOICES';
    c_module           CONSTANT VARCHAR2(100):= 'oracle.apps.xxcus.ap.invoices';

    -- ── Cursor for unprocessed invoices ────────────────────────
    CURSOR c_invoices IS
        SELECT *
          FROM apps.xxcus_invoice_staging
         WHERE org_id        = p_org_id
           AND process_flag  = 'N'
           AND invoice_date  BETWEEN l_start_date AND l_end_date
         ORDER BY invoice_date;

BEGIN
    -- ── Step 1: Log program start ───────────────────────────────
    fnd_file.put_line(fnd_file.LOG,
        '*** ' || c_program_name || ' Started ***');
    fnd_file.put_line(fnd_file.LOG,
        'Run by: ' || fnd_global.user_name() ||
        ' | Org ID: ' || p_org_id ||
        ' | Request ID: ' || l_request_id);

    -- ── Step 2: Initialize multi-org context ────────────────────
    mo_global.init('AP');
    mo_global.set_policy_context('S', p_org_id);  -- 'S'=Single org

    -- ── Step 3: Convert parameter dates ─────────────────────────
    l_start_date := TO_DATE(p_start_date, 'YYYY/MM/DD HH24:MI:SS');
    l_end_date   := TO_DATE(p_end_date,   'YYYY/MM/DD HH24:MI:SS');

    fnd_file.put_line(fnd_file.LOG,
        'Date range: ' || TO_CHAR(l_start_date,'DD-MON-YYYY') ||
        ' to '         || TO_CHAR(l_end_date,  'DD-MON-YYYY'));

    -- ── Step 4: Process invoices ─────────────────────────────────
    FOR r_inv IN c_invoices LOOP
        BEGIN
            SAVEPOINT sp_one_invoice;

            -- Call AP standard API to create invoice
            -- (replace with actual ap_invoices_pkg call)
            fnd_file.put_line(fnd_file.LOG,
                'Processing: ' || r_inv.invoice_num);

            -- Mark as processed
            UPDATE apps.xxcus_invoice_staging
               SET process_flag     = 'Y',
                   process_date     = SYSDATE,
                   request_id       = l_request_id,
                   last_updated_by  = l_user_id,
                   last_update_date = SYSDATE,
                   last_update_login= l_login_id
             WHERE staging_id = r_inv.staging_id;

            l_success_count := l_success_count + 1;

        EXCEPTION
            WHEN OTHERS THEN
                ROLLBACK TO sp_one_invoice;
                l_error_count := l_error_count + 1;
                -- Update staging row with error message
                UPDATE apps.xxcus_invoice_staging
                   SET process_flag   = 'E',
                       error_message  = SUBSTR(SQLERRM, 1, 2000),
                       last_updated_by= l_user_id,
                       last_update_date = SYSDATE
                 WHERE staging_id = r_inv.staging_id;

                fnd_file.put_line(fnd_file.LOG,
                    'ERROR on ' || r_inv.invoice_num || ': ' || SQLERRM);
        END;
    END LOOP;

    COMMIT;

    -- ── Step 5: Write output summary ─────────────────────────────
    fnd_file.put_line(fnd_file.OUTPUT, 'PROCESSING SUMMARY');
    fnd_file.put_line(fnd_file.OUTPUT, '==================');
    fnd_file.put_line(fnd_file.OUTPUT, 'Org ID      : ' || p_org_id);
    fnd_file.put_line(fnd_file.OUTPUT, 'Successful  : ' || l_success_count);
    fnd_file.put_line(fnd_file.OUTPUT, 'Errors      : ' || l_error_count);

    -- ── Step 6: Set return code ───────────────────────────────────
    IF l_error_count > 0 AND l_success_count = 0 THEN
        retcode := '2';  -- Error
        errbuf  := 'All ' || l_error_count || ' invoices failed. Check log.';
    ELSIF l_error_count > 0 THEN
        retcode := '1';  -- Warning
        errbuf  := l_error_count || ' invoices failed, '
                   || l_success_count || ' succeeded.';
    ELSE
        retcode := '0';  -- Normal
        errbuf  := l_success_count || ' invoices processed successfully.';
    END IF;

    fnd_file.put_line(fnd_file.LOG,
        '*** ' || c_program_name || ' Ended. Retcode=' || retcode || ' ***');

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        retcode := '2';
        errbuf  := 'Unexpected error in ' || c_program_name
                   || ': ' || SQLERRM;
        fnd_file.put_line(fnd_file.LOG, errbuf);
END xxap_process_invoices;
/`
    }
    ]
  },
  {
    id:'packages', label:'Packages — Spec & Body',
    queries:[
    {
      id:'pkg_spec',
      title:'Package Specification (Header) — Oracle EBS Style',
      desc:'Full package spec with types, constants, public procedures and functions',
      tags:['PL/SQL','package','specification','EBS'],
      sql:`/* ──────────────────────────────────────────────────────────
   Package Specification — Oracle EBS Custom AP Utilities
   Contains: type definitions, constants, public API signatures.
   ────────────────────────────────────────────────────────── */
CREATE OR REPLACE PACKAGE apps.xxap_utils_pkg AS
/*
   Package  : XXAP_UTILS_PKG
   Purpose  : Custom Accounts Payable utility functions and procedures.
   Author   : EBS Dev Team
   Date     : 2025-01-01
   Version  : 1.0
*/

    -- ── Type Definitions ─────────────────────────────────────────
    TYPE t_number_tab  IS TABLE OF NUMBER        INDEX BY PLS_INTEGER;
    TYPE t_varchar_tab IS TABLE OF VARCHAR2(4000) INDEX BY PLS_INTEGER;

    TYPE r_invoice_rec IS RECORD (
        invoice_id      NUMBER,
        invoice_num     VARCHAR2(50),
        vendor_name     VARCHAR2(240),
        amount          NUMBER,
        status          VARCHAR2(25)
    );
    TYPE t_invoice_tab IS TABLE OF r_invoice_rec INDEX BY PLS_INTEGER;

    -- ── Constants ────────────────────────────────────────────────
    c_version     CONSTANT VARCHAR2(10)  := '1.0';
    c_package     CONSTANT VARCHAR2(30)  := 'XXAP_UTILS_PKG';
    c_max_rows    CONSTANT NUMBER        := 1000;

    -- ── Public Procedure/Function Signatures ─────────────────────

    -- Validate an invoice before import
    FUNCTION validate_invoice
    (
        p_org_id        IN NUMBER,
        p_vendor_id     IN NUMBER,
        p_invoice_num   IN VARCHAR2,
        p_invoice_amt   IN NUMBER,
        p_invoice_date  IN DATE,
        p_error_msg     OUT VARCHAR2
    )
    RETURN BOOLEAN;

    -- Get all unpaid invoices for a vendor
    FUNCTION get_vendor_open_invoices
    (
        p_vendor_id     IN NUMBER,
        p_org_id        IN NUMBER
    )
    RETURN t_invoice_tab;

    -- Process a batch of invoices
    PROCEDURE process_invoice_batch
    (
        errbuf          OUT VARCHAR2,
        retcode         OUT VARCHAR2,
        p_org_id        IN  NUMBER,
        p_batch_name    IN  VARCHAR2
    );

    -- Get current AP period status
    FUNCTION get_ap_period_status
    (
        p_org_id        IN NUMBER,
        p_period_name   IN VARCHAR2
    )
    RETURN VARCHAR2;

END xxap_utils_pkg;
/`
    },
    {
      id:'pkg_body',
      title:'Package Body — Implementation with Private Helpers',
      desc:'Full package body matching the spec above, with private helper procedures',
      tags:['PL/SQL','package','body','implementation'],
      sql:`/* ──────────────────────────────────────────────────────────
   Package Body — XXAP_UTILS_PKG
   ────────────────────────────────────────────────────────── */
CREATE OR REPLACE PACKAGE BODY apps.xxap_utils_pkg AS

    -- ── Private helper: write to FND log file ────────────────────
    PROCEDURE log_msg (p_msg IN VARCHAR2) IS
    BEGIN
        fnd_file.put_line(fnd_file.LOG,
            TO_CHAR(SYSDATE,'HH24:MI:SS') || ' | ' || p_msg);
    END log_msg;

    -- ── Private helper: check for duplicate invoice ───────────────
    FUNCTION invoice_exists
    (
        p_org_id       IN NUMBER,
        p_vendor_id    IN NUMBER,
        p_invoice_num  IN VARCHAR2
    )
    RETURN BOOLEAN IS
        l_count NUMBER;
    BEGIN
        SELECT COUNT(*)
          INTO l_count
          FROM ap_invoices_all
         WHERE org_id      = p_org_id
           AND vendor_id   = p_vendor_id
           AND invoice_num = p_invoice_num
           AND cancelled_date IS NULL;
        RETURN (l_count > 0);
    END invoice_exists;

    -- ── Public: validate_invoice ──────────────────────────────────
    FUNCTION validate_invoice
    (
        p_org_id        IN NUMBER,
        p_vendor_id     IN NUMBER,
        p_invoice_num   IN VARCHAR2,
        p_invoice_amt   IN NUMBER,
        p_invoice_date  IN DATE,
        p_error_msg     OUT VARCHAR2
    )
    RETURN BOOLEAN IS
        l_valid  BOOLEAN := TRUE;
        l_msg    VARCHAR2(2000) := NULL;
    BEGIN
        -- Check 1: Duplicate invoice
        IF invoice_exists(p_org_id, p_vendor_id, p_invoice_num) THEN
            l_msg  := 'Duplicate invoice: ' || p_invoice_num;
            l_valid := FALSE;
        END IF;

        -- Check 2: Amount must be positive for STANDARD invoices
        IF l_valid AND p_invoice_amt <= 0 THEN
            l_msg  := 'Invoice amount must be > 0. Got: ' || p_invoice_amt;
            l_valid := FALSE;
        END IF;

        -- Check 3: Invoice date cannot be in the future
        IF l_valid AND p_invoice_date > TRUNC(SYSDATE) + 1 THEN
            l_msg  := 'Invoice date cannot be in the future.';
            l_valid := FALSE;
        END IF;

        p_error_msg := l_msg;
        RETURN l_valid;

    EXCEPTION
        WHEN OTHERS THEN
            p_error_msg := 'Validation error: ' || SQLERRM;
            RETURN FALSE;
    END validate_invoice;

    -- ── Public: get_vendor_open_invoices ──────────────────────────
    FUNCTION get_vendor_open_invoices
    (
        p_vendor_id     IN NUMBER,
        p_org_id        IN NUMBER
    )
    RETURN t_invoice_tab IS
        l_result  t_invoice_tab;
        l_idx     PLS_INTEGER := 0;
    BEGIN
        FOR r IN (
            SELECT
                ai.invoice_id,
                ai.invoice_num,
                aps.vendor_name,
                ai.invoice_amount,
                ai.payment_status_flag
            FROM ap_invoices_all   ai
            JOIN ap_suppliers      aps ON aps.vendor_id = ai.vendor_id
            WHERE ai.vendor_id          = p_vendor_id
              AND ai.org_id             = p_org_id
              AND ai.payment_status_flag <> 'Y'
              AND ai.cancelled_date      IS NULL
            ORDER BY ai.invoice_date
        ) LOOP
            l_idx := l_idx + 1;
            l_result(l_idx).invoice_id  := r.invoice_id;
            l_result(l_idx).invoice_num := r.invoice_num;
            l_result(l_idx).vendor_name := r.vendor_name;
            l_result(l_idx).amount      := r.invoice_amount;
            l_result(l_idx).status      := r.payment_status_flag;
        END LOOP;
        RETURN l_result;
    END get_vendor_open_invoices;

    -- ── Public: process_invoice_batch ────────────────────────────
    PROCEDURE process_invoice_batch
    (
        errbuf       OUT VARCHAR2,
        retcode      OUT VARCHAR2,
        p_org_id     IN  NUMBER,
        p_batch_name IN  VARCHAR2
    ) IS
        l_count  NUMBER := 0;
    BEGIN
        log_msg('process_invoice_batch START. Batch=' || p_batch_name);
        mo_global.set_policy_context('S', p_org_id);

        UPDATE apps.xxcus_invoice_staging
           SET process_flag      = 'Y',
               process_date      = SYSDATE,
               last_updated_by   = fnd_global.user_id(),
               last_update_date  = SYSDATE
         WHERE org_id     = p_org_id
           AND batch_name = p_batch_name
           AND process_flag = 'N';

        l_count := SQL%ROWCOUNT;
        COMMIT;

        log_msg('Processed ' || l_count || ' rows.');
        retcode := '0';
        errbuf  := l_count || ' rows processed.';
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            retcode := '2';
            errbuf  := 'Error: ' || SQLERRM;
    END process_invoice_batch;

    -- ── Public: get_ap_period_status ─────────────────────────────
    FUNCTION get_ap_period_status
    (
        p_org_id      IN NUMBER,
        p_period_name IN VARCHAR2
    )
    RETURN VARCHAR2 IS
        l_status  VARCHAR2(15);
    BEGIN
        SELECT closing_status
          INTO l_status
          FROM ap_other_periods
         WHERE org_id      = p_org_id
           AND period_name = p_period_name;
        RETURN l_status;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN RETURN 'NOT_FOUND';
        WHEN OTHERS        THEN RETURN 'ERROR';
    END get_ap_period_status;

END xxap_utils_pkg;
/`
    }
    ]
  },
  {
    id:'triggers', label:'Triggers',
    queries:[
    {
      id:'trg_audit',
      title:'AFTER UPDATE Audit Trigger — Write to History Table',
      desc:'Captures old and new values on UPDATE to an AP-style custom table',
      tags:['trigger','audit','PL/SQL','DBA'],
      sql:`/* ──────────────────────────────────────────────────────────
   AFTER UPDATE Audit Trigger
   Captures before/after values to an audit history table.
   ────────────────────────────────────────────────────────── */
CREATE OR REPLACE TRIGGER apps.xxcus_inv_stg_aur
    AFTER UPDATE ON apps.xxcus_invoice_staging
    FOR EACH ROW
DECLARE
    PRAGMA AUTONOMOUS_TRANSACTION;  -- audit writes must not depend on caller tx
BEGIN
    -- Only log rows where key business columns changed
    IF (NVL(:OLD.invoice_amount,-99999) <> NVL(:NEW.invoice_amount,-99999))
    OR (NVL(:OLD.process_flag,'~')      <> NVL(:NEW.process_flag,'~'))
    OR (NVL(:OLD.vendor_id,-1)          <> NVL(:NEW.vendor_id,-1))
    THEN
        INSERT INTO apps.xxcus_inv_stg_audit
            (audit_id, staging_id, change_date, changed_by,
             old_amount,     new_amount,
             old_process_flag, new_process_flag,
             old_vendor_id,  new_vendor_id,
             change_type)
        VALUES
            (xxcus_inv_stg_audit_s.NEXTVAL,
             :NEW.staging_id,
             SYSDATE,
             fnd_global.user_id(),
             :OLD.invoice_amount,    :NEW.invoice_amount,
             :OLD.process_flag,      :NEW.process_flag,
             :OLD.vendor_id,         :NEW.vendor_id,
             'UPDATE');
        COMMIT;  -- autonomous transaction — commit independently
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Never let an audit trigger break the main transaction
        NULL;
END xxcus_inv_stg_aur;
/`
    },
    {
      id:'trg_compound',
      title:'COMPOUND Trigger — Avoids Mutating Table Error',
      desc:'Use compound trigger when the trigger needs to query its own table',
      tags:['trigger','compound','mutating','PL/SQL'],
      sql:`/* ──────────────────────────────────────────────────────────
   COMPOUND Trigger — Avoids ORA-04091 Mutating Table Error
   Use when your trigger logic needs to query the same table
   being modified (e.g. enforce a unique-like business rule).
   ────────────────────────────────────────────────────────── */
CREATE OR REPLACE TRIGGER apps.xxcus_inv_stg_compound
    FOR INSERT OR UPDATE ON apps.xxcus_invoice_staging
    COMPOUND TRIGGER

    -- ── Declaration section (shared across all timing points) ───
    TYPE t_key_tab IS TABLE OF VARCHAR2(200) INDEX BY PLS_INTEGER;
    g_keys  t_key_tab;
    g_idx   PLS_INTEGER := 0;

    -- ── BEFORE STATEMENT: initialize the collection ──────────────
    BEFORE STATEMENT IS
    BEGIN
        g_keys.DELETE;
        g_idx := 0;
    END BEFORE STATEMENT;

    -- ── BEFORE EACH ROW: capture the key being inserted/updated ──
    BEFORE EACH ROW IS
    BEGIN
        -- Build a composite key: org_id|vendor_id|invoice_num
        g_idx := g_idx + 1;
        g_keys(g_idx) :=    NVL(:NEW.org_id,-1)
                         || '|' || NVL(:NEW.vendor_id,-1)
                         || '|' || NVL(:NEW.invoice_num,'NULL');
    END BEFORE EACH ROW;

    -- ── AFTER STATEMENT: run validation once after all rows done ─
    AFTER STATEMENT IS
        l_count NUMBER;
    BEGIN
        FOR i IN 1..g_idx LOOP
            -- Check for duplicates using bulk approach
            SELECT COUNT(*)
              INTO l_count
              FROM apps.xxcus_invoice_staging s
             WHERE (TO_CHAR(s.org_id) || '|' ||
                    TO_CHAR(s.vendor_id) || '|' ||
                    s.invoice_num) = g_keys(i);

            IF l_count > 1 THEN
                RAISE_APPLICATION_ERROR(-20010,
                    'Duplicate invoice key detected: ' || g_keys(i));
            END IF;
        END LOOP;
    END AFTER STATEMENT;

END xxcus_inv_stg_compound;
/`
    }
    ]
  },
  {
    id:'cursors', label:'Cursors',
    queries:[
    {
      id:'cur_bulk_collect',
      title:'BULK COLLECT + FORALL — High-Performance Batch Processing',
      desc:'Process thousands of rows efficiently using bulk operations',
      tags:['cursor','BULK COLLECT','FORALL','performance','PL/SQL'],
      sql:`/* ──────────────────────────────────────────────────────────
   BULK COLLECT + FORALL — The Fastest Row-by-Row Alternative
   BULK COLLECT fetches all rows into a PL/SQL collection at once.
   FORALL executes DML for all collection elements in one call.
   20x-100x faster than row-by-row cursor FOR loop.
   ────────────────────────────────────────────────────────── */
DECLARE
    -- Nested table types for BULK COLLECT
    TYPE t_id_tab      IS TABLE OF NUMBER;
    TYPE t_status_tab  IS TABLE OF VARCHAR2(1);
    TYPE t_date_tab    IS TABLE OF DATE;

    l_staging_ids    t_id_tab;
    l_new_flags      t_status_tab;
    l_process_dates  t_date_tab;

    -- Explicit cursor for unprocessed rows
    CURSOR c_unprocessed IS
        SELECT staging_id
          FROM apps.xxcus_invoice_staging
         WHERE process_flag = 'N'
           AND creation_date < SYSDATE - 1;

    c_batch_size  CONSTANT PLS_INTEGER := 500;  -- Process 500 rows at a time
    l_processed   NUMBER := 0;
BEGIN
    OPEN c_unprocessed;

    LOOP
        -- Fetch 500 rows at a time into the collection
        FETCH c_unprocessed
            BULK COLLECT INTO l_staging_ids
            LIMIT c_batch_size;

        EXIT WHEN l_staging_ids.COUNT = 0;

        -- Prepare parallel collections for the FORALL update
        l_new_flags    := t_status_tab();
        l_process_dates:= t_date_tab();
        l_new_flags.EXTEND(l_staging_ids.COUNT);
        l_process_dates.EXTEND(l_staging_ids.COUNT);

        FOR i IN 1..l_staging_ids.COUNT LOOP
            l_new_flags(i)     := 'Y';
            l_process_dates(i) := SYSDATE;
        END LOOP;

        -- Single DML call for all 500 rows (vs 500 individual UPDATEs)
        FORALL i IN 1..l_staging_ids.COUNT
            SAVE EXCEPTIONS           -- Continue even if some rows fail
            UPDATE apps.xxcus_invoice_staging
               SET process_flag     = l_new_flags(i),
                   process_date     = l_process_dates(i),
                   last_update_date = SYSDATE
             WHERE staging_id       = l_staging_ids(i);

        l_processed := l_processed + l_staging_ids.COUNT;
        COMMIT;  -- Commit each batch to avoid large rollback segments

        EXIT WHEN l_staging_ids.COUNT < c_batch_size;  -- Last batch
    END LOOP;

    CLOSE c_unprocessed;
    DBMS_OUTPUT.PUT_LINE('Total rows processed: ' || l_processed);

EXCEPTION
    WHEN OTHERS THEN
        IF c_unprocessed%ISOPEN THEN CLOSE c_unprocessed; END IF;
        ROLLBACK;
        RAISE;
END;
/`
    }
    ]
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   4. DBA ACTIVITIES
   ══════════════════════════════════════════════════════════════════ */
{
  id:'dbaActivities', icon:'🔧', label:'DBA Activities',
  desc:'Sessions, locks, space, AWR, invalid objects, security, performance tuning',
  subcategories:[
  {
    id:'sessions', label:'Sessions & Lock Management',
    queries:[
    {
      id:'dba_blocking_sessions',
      title:'Find All Blocking Sessions with SQL Text',
      desc:'Shows every blocking session and what it is blocking, with the SQL being run',
      tags:['DBA','locks','blocking','performance','V$SESSION'],
      sql:`/* ──────────────────────────────────────────────────────────
   Blocking Sessions — Who Is Blocking Whom
   Includes: blocking SQL text, wait event, object being locked.
   Run as DBA or with SELECT on V$ views.
   ────────────────────────────────────────────────────────── */
SELECT
    blk.sid                              blocking_sid,
    blk.serial#                          blocking_serial,
    blk.username                         blocking_user,
    blk.osuser                           blocking_os_user,
    blk.machine                          blocking_machine,
    blk.program                          blocking_program,
    ROUND((SYSDATE - blk.logon_time)*1440,0)  blocking_session_mins,
    blk_sql.sql_text                     blocking_sql,
    -- Waiting sessions
    wt.sid                               waiting_sid,
    wt.serial#                           waiting_serial,
    wt.username                          waiting_user,
    wt.wait_class                        wait_class,
    wt.event                             wait_event,
    wt.seconds_in_wait                   waiting_secs,
    wt_sql.sql_text                      waiting_sql,
    -- Locked object details
    obj.object_name                      locked_object,
    obj.object_type                      object_type,
    DECODE(lo.locked_mode,
        0,'None',1,'Null',2,'Row-S (SS)',3,'Row-X (SX)',
        4,'Share',5,'S/Row-X (SSX)',6,'Exclusive',
        lo.locked_mode)                  lock_mode
FROM
    v$session          blk,
    v$session          wt,
    v$sql              blk_sql,
    v$sql              wt_sql,
    v$locked_object    lo,
    all_objects        obj
WHERE
    blk.sid            = wt.blocking_session
AND blk.sql_id         = blk_sql.sql_id (+)
AND blk.sql_child_number = blk_sql.child_number (+)
AND wt.sql_id          = wt_sql.sql_id (+)
AND wt.sql_child_number = wt_sql.child_number (+)
AND lo.session_id      = blk.sid (+)
AND lo.object_id       = obj.object_id (+)
AND wt.blocking_session IS NOT NULL
ORDER BY
    blocking_sid, waiting_secs DESC;`
    },
    {
      id:'dba_kill_session',
      title:'Kill a Database Session',
      desc:'Safely identify and kill a blocking or runaway Oracle session',
      tags:['DBA','kill','session','blocking'],
      sql:`/* ──────────────────────────────────────────────────────────
   Kill a Database Session
   Step 1: Identify the session (use blocking_sessions query above)
   Step 2: Kill using SID and SERIAL#
   IMMEDIATE: do not wait for the session to finish current call.
   ────────────────────────────────────────────────────────── */

-- Step 1: Get the SID and SERIAL# you want to kill
SELECT
    s.sid,
    s.serial#,
    s.username,
    s.osuser,
    s.machine,
    s.program,
    s.status,
    s.event,
    s.seconds_in_wait,
    s.sql_id,
    q.sql_text
FROM
    v$session s,
    v$sql     q
WHERE
    s.sql_id = q.sql_id (+)
AND s.sql_child_number = q.child_number (+)
AND s.status  = 'ACTIVE'
AND s.type    = 'USER'
ORDER BY s.seconds_in_wait DESC;

-- Step 2: Kill the session (replace 123 and 456 with actual values)
-- WARNING: This immediately terminates the session.
ALTER SYSTEM KILL SESSION '123,456' IMMEDIATE;

-- If the session is on a RAC instance (specify instance):
ALTER SYSTEM KILL SESSION '123,456,@2' IMMEDIATE;

-- If the session does not die (OS-level kill needed):
-- First get the OS PID:
SELECT spid FROM v$process
 WHERE addr = (SELECT paddr FROM v$session WHERE sid = 123);
-- Then on the server OS:
-- kill -9 <spid>   (Unix/Linux)
-- orakill <instance_name> <spid>   (Windows)`
    }
    ]
  },
  {
    id:'objectMgmt', label:'Object Management',
    queries:[
    {
      id:'dba_invalid_objects',
      title:'List All Invalid Objects & Recompile Script',
      desc:'Find all invalid PL/SQL objects in APPS schema and generate recompile commands',
      tags:['DBA','invalid objects','compile','APPS'],
      sql:`/* ──────────────────────────────────────────────────────────
   Invalid Objects in APPS Schema
   ────────────────────────────────────────────────────────── */
-- List all invalid objects
SELECT
    owner,
    object_name,
    object_type,
    status,
    last_ddl_time,
    -- Generate the recompile command
    'ALTER ' || object_type || ' ' || owner || '.' || object_name
    || CASE object_type
           WHEN 'PACKAGE BODY' THEN ' COMPILE BODY;'
           ELSE ' COMPILE;'
       END                  recompile_sql
FROM
    dba_objects
WHERE
    status     = 'INVALID'
AND owner      IN ('APPS','AR','AP','GL','PO','PA','HR')
ORDER BY
    object_type, object_name;

/* ── Recompile all invalids using DBMS_UTILITY ───────────────
   Run as SYS or DBA: */
EXEC DBMS_UTILITY.COMPILE_SCHEMA(schema=>'APPS', compile_all=>FALSE);

/* ── Alternatively, run the Oracle-supplied script: ─────────────
   @$ORACLE_HOME/rdbms/admin/utlrp.sql
   This recompiles ALL invalid objects in the database.
   Run during low-activity window (it can take 10-30 min).
   ─────────────────────────────────────────────────────────── */`
    }
    ]
  },
  {
    id:'spaceStorage', label:'Space & Storage',
    queries:[
    {
      id:'dba_tablespace_usage',
      title:'Tablespace Usage — Total, Used, Free, % Full',
      desc:'Complete tablespace space report with autoextend info and % utilisation',
      tags:['DBA','tablespace','space','storage'],
      sql:`/* ──────────────────────────────────────────────────────────
   Tablespace Usage Report
   Shows all tablespaces with used/free space and % full.
   ────────────────────────────────────────────────────────── */
SELECT
    df.tablespace_name,
    df.total_mb                                     total_mb,
    NVL(df.total_mb - fs.free_mb, df.total_mb)      used_mb,
    NVL(fs.free_mb, 0)                              free_mb,
    ROUND(NVL(df.total_mb - fs.free_mb, df.total_mb)
          / df.total_mb * 100, 2)                   pct_used,
    df.max_mb                                       max_extendable_mb,
    df.autoextend                                   autoextend_on
FROM
    (
        SELECT
            tablespace_name,
            ROUND(SUM(bytes)/1048576, 2)            total_mb,
            ROUND(SUM(DECODE(autoextensible,'YES',
                  maxbytes, bytes))/1048576, 2)      max_mb,
            MAX(autoextensible)                     autoextend
        FROM  dba_data_files
        GROUP BY tablespace_name
    ) df,
    (
        SELECT tablespace_name,
               ROUND(SUM(bytes)/1048576, 2)         free_mb
        FROM   dba_free_space
        GROUP BY tablespace_name
    ) fs
WHERE
    df.tablespace_name = fs.tablespace_name (+)
ORDER BY
    pct_used DESC;`
    }
    ]
  },
  {
    id:'perfAWR', label:'Performance & AWR',
    queries:[
    {
      id:'dba_top_sql_cpu',
      title:'Top SQL by CPU Time from V$SQL',
      desc:'Real-time top SQL statements consuming the most CPU in the shared pool',
      tags:['DBA','performance','CPU','V$SQL','AWR'],
      sql:`/* ──────────────────────────────────────────────────────────
   Top SQL by CPU Time — Real-Time from V$SQL
   ────────────────────────────────────────────────────────── */
SELECT
    RANK() OVER (ORDER BY cpu_time DESC)         rnk,
    sql_id,
    child_number,
    ROUND(cpu_time/1e6,2)                        cpu_secs,
    ROUND(elapsed_time/1e6,2)                    elapsed_secs,
    executions,
    ROUND(cpu_time/NULLIF(executions,0)/1e6,4)   cpu_per_exec_secs,
    buffer_gets,
    ROUND(buffer_gets/NULLIF(executions,0),0)    bufgets_per_exec,
    disk_reads,
    rows_processed,
    module,
    parsing_schema_name                          schema,
    SUBSTR(sql_text,1,120)                       sql_snippet
FROM
    v$sql
WHERE
    executions   > 0
AND cpu_time     > 0
AND parsing_schema_name NOT IN ('SYS','SYSTEM','DBSNMP','ORACLE_OCM')
ORDER BY
    cpu_time DESC
FETCH FIRST 20 ROWS ONLY;`
    },
    {
      id:'dba_wait_events',
      title:'Top Wait Events — Last Hour',
      desc:'Database wait event summary from AWR for the last 60 minutes',
      tags:['DBA','wait events','AWR','performance'],
      sql:`/* ──────────────────────────────────────────────────────────
   Top Wait Events — Last Hour from V$SYSTEM_EVENT
   ────────────────────────────────────────────────────────── */
SELECT
    event,
    wait_class,
    total_waits,
    total_timeouts,
    ROUND(time_waited_micro/1e6, 2)         time_waited_secs,
    ROUND(average_wait_micro/1000, 3)       avg_wait_ms,
    ROUND(time_waited_micro
          / SUM(time_waited_micro) OVER()
          * 100, 2)                         pct_total_wait
FROM
    v$system_event
WHERE
    wait_class <> 'Idle'
ORDER BY
    time_waited_micro DESC
FETCH FIRST 20 ROWS ONLY;`
    }
    ]
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   5. UNIX SHELL
   ══════════════════════════════════════════════════════════════════ */
{
  id:'unixShell', icon:'🐧', label:'Unix Shell / OS Commands',
  desc:'EBS file navigation, process management, log monitoring, startup/shutdown scripts',
  subcategories:[
  {
    id:'ebsFiles', label:'EBS File Locations & Navigation',
    queries:[
    {
      id:'unix_ebs_dirs',
      title:'Key EBS Directory Variables and Navigation',
      desc:'Essential UNIX paths for Oracle EBS application tier directories',
      tags:['Unix','shell','EBS','directories','APPL_TOP'],
      sql:`#!/bin/bash
# ──────────────────────────────────────────────────────────
#  Oracle E-Business Suite Key Directory Variables
#  Source the EBS environment file first to set these vars.
# ──────────────────────────────────────────────────────────

# Source the environment (run as oracle/applmgr OS user)
source /u01/oracle/VIS/EBSapps.env run       # Production
# OR
. /u01/install/APPS/EBSapps.env              # Alternate path

# Key application directories
echo "APPL_TOP       = $APPL_TOP"            # /u01/oracle/apps/apps_st/appl
echo "FND_TOP        = $FND_TOP"             # $APPL_TOP/fnd/12.0.0
echo "AU_TOP         = $AU_TOP"              # $APPL_TOP/au/12.0.0
echo "AD_TOP         = $AD_TOP"              # $APPL_TOP/ad/12.0.0
echo "AP_TOP         = $AP_TOP"             # $APPL_TOP/ap/12.0.0
echo "GL_TOP         = $GL_TOP"             # $APPL_TOP/gl/12.0.0
echo "JAVA_TOP       = $JAVA_TOP"           # $APPL_TOP/../javaTop
echo "COMMON_TOP     = $COMMON_TOP"         # $APPL_TOP/../comn

# Oracle home / database directories
echo "ORACLE_HOME    = $ORACLE_HOME"        # DB Oracle Home
echo "TWO_TASK       = $TWO_TASK"           # DB service name (TNS alias)
echo "FND_LOG_ROOT   = \$APPLCSF/log"      # Concurrent log files

# Navigate to key locations
cd $APPL_TOP                               # Application top
cd $FND_TOP/sql                            # FND SQL scripts
cd $FND_TOP/patch/115/sql                  # Patch SQL scripts
cd $COMMON_TOP/admin/log                   # Common log directory
cd $COMMON_TOP/admin/out                   # Concurrent output directory

# Find concurrent request log by request ID (replace 1234567)
REQ_ID=1234567
find $COMMON_TOP/admin/log -name "*$REQ_ID*" -type f 2>/dev/null
find $COMMON_TOP/admin/out -name "*$REQ_ID*" -type f 2>/dev/null

# Also from SQL — get the file paths directly:
# SELECT logfile_name, outfile_name FROM fnd_concurrent_requests
# WHERE request_id = 1234567;`
    }
    ]
  },
  {
    id:'processMonitor', label:'Process & Log Monitoring',
    queries:[
    {
      id:'unix_monitor_logs',
      title:'Live Log Monitoring — tail, grep, awk for EBS Logs',
      desc:'Monitor concurrent request logs, alert log, and application logs in real time',
      tags:['Unix','tail','grep','awk','logs','monitoring'],
      sql:`#!/bin/bash
# ──────────────────────────────────────────────────────────
#  EBS Log Monitoring Commands
# ──────────────────────────────────────────────────────────

# 1. Live monitor a concurrent request log (replace with actual path from SQL)
tail -f /u01/oracle/VIS/inst/apps/VIS_host/logs/appl/conc/log/l1234567.req

# 2. Monitor the Oracle Database alert log (most important DBA log)
tail -200f $ORACLE_BASE/diag/rdbms/vis/VIS/trace/alert_VIS.log
# Filter for errors only:
tail -f $ORACLE_BASE/diag/rdbms/vis/VIS/trace/alert_VIS.log | grep -E "ORA-|Error|error"

# 3. Find all ORA- errors in the last 1000 lines of the alert log
tail -1000 $ORACLE_BASE/diag/rdbms/vis/VIS/trace/alert_VIS.log | grep "ORA-"

# 4. Monitor Apache/OHS access log
tail -f $ORACLE_HOME/ohs/logs/access_log

# 5. Check all concurrent manager processes running right now
ps -ef | grep FNDLIBR | grep -v grep
ps -ef | grep TNS | grep -v grep

# 6. Count lines in a log file matching a pattern
grep -c "ORA-" /u01/oracle/VIS/inst/apps/VIS_host/logs/appl/conc/log/l1234567.req

# 7. Find the most recent log files (last 10 modified)
ls -lt $COMMON_TOP/admin/log | head -15

# 8. Check disk space on key mount points
df -h | grep -E "u01|u02|appl|data|archive"

# 9. Find large files (> 500MB) in APPL_TOP
find $APPL_TOP -size +500M -type f -exec ls -lh {} \\; 2>/dev/null

# 10. Archive old concurrent log files older than 30 days
find $COMMON_TOP/admin/log -name "*.req" -mtime +30 \\
     -exec gzip {} \\;
# Then move to archive:
find $COMMON_TOP/admin/log -name "*.req.gz" -mtime +30 \\
     -exec mv {} /archive/conc_logs/ \\;`
    }
    ]
  },
  {
    id:'ebsStartStop', label:'EBS Startup / Shutdown',
    queries:[
    {
      id:'unix_start_stop',
      title:'Start / Stop Oracle EBS Services (R12.2)',
      desc:'Complete EBS R12.2 startup and shutdown sequence — apps tier and DB tier',
      tags:['Unix','shell','startup','shutdown','EBS','R12.2'],
      sql:`#!/bin/bash
# ──────────────────────────────────────────────────────────
#  Oracle EBS R12.2 — Startup and Shutdown Sequence
#  Run as the applmgr OS user (NOT as root).
# ──────────────────────────────────────────────────────────

# Source the EBS environment first
source /u01/oracle/VIS/EBSapps.env run

# ═══════════════════════════════════════════
#  STARTUP SEQUENCE
# ═══════════════════════════════════════════

# Step 1: Start the Oracle Database (run as oracle OS user)
# sqlplus / as sysdba <<EOF
# startup;
# exit;
# EOF
# lsnrctl start LISTENER

# Step 2: Start Application Services (run as applmgr)
#  ── Start all EBS services ──
$ADMIN_SCRIPTS_HOME/adstrtal.sh apps/apps_password

# OR start services individually:
# Start Node Manager (WebLogic)
$ADMIN_SCRIPTS_HOME/adadminsrvctl.sh start

# Start Admin Server (WebLogic Admin Console)
$ADMIN_SCRIPTS_HOME/adwebctl.sh start

# Start Forms/HTTP Server (OHS/Apache)
$ADMIN_SCRIPTS_HOME/adapcctl.sh start

# Start Concurrent Managers
$FND_TOP/bin/startmgr.sh sysmgr="apps" mgrname="standard"
# OR via CONCSUB:
CONCSUB apps/apps_password SYSADMIN 'System Administrator' SYSADMIN \\
    WAIT=N FND FNDICM 0

# ═══════════════════════════════════════════
#  SHUTDOWN SEQUENCE
# ═══════════════════════════════════════════
# Step 1: Stop Application Services
$ADMIN_SCRIPTS_HOME/adstpall.sh apps/apps_password

# Step 2: Stop Concurrent Managers gracefully
$FND_TOP/bin/stopmgr.sh sysmgr="apps"

# Step 3: Check if all concurrent manager processes have stopped
ps -ef | grep FNDLIBR | grep -v grep

# ═══════════════════════════════════════════
#  CHECK STATUS
# ═══════════════════════════════════════════
# Check all EBS services status
$ADMIN_SCRIPTS_HOME/adstpall.sh status 2>&1 | grep -E "started|stopped|running"

# Check listener status
lsnrctl status

# Check if Admin Server is up (WebLogic)
ps -ef | grep weblogic | grep -v grep`
    }
    ]
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   6. MODULE-WISE SQL
   ══════════════════════════════════════════════════════════════════ */
{
  id:'moduleSQL', icon:'📊', label:'Module-wise SQL',
  desc:'Ready-to-run SQL for AP, GL, PO, HRMS, iExpense, AR, Payroll — real EBS tables',
  subcategories:[
  {
    id:'apSQL', label:'Accounts Payable (AP)',
    queries:[
    {
      id:'ap_invoice_payment_status',
      title:'AP Invoice with Payment Status, Aging & Hold Details',
      desc:'Full AP invoice status including paid amount, balance due, holds, and aging',
      tags:['AP','invoice','payment','aging','holds'],
      sql:`/* ──────────────────────────────────────────────────────────
   AP Invoice — Full Status with Payment, Holds, and Aging
   Replace :p_org_id with your operating unit ORG_ID.
   ────────────────────────────────────────────────────────── */
SELECT
    ai.invoice_id,
    ai.invoice_num,
    ai.invoice_date,
    ai.invoice_type_lookup_code        invoice_type,
    aps.vendor_name,
    apss.vendor_site_code              site,
    ai.invoice_amount,
    ai.amount_paid,
    ai.invoice_amount - NVL(ai.amount_paid,0)
                                       balance_due,
    ai.currency_code,
    ai.payment_status_flag             pay_status,  -- N=Not Paid,P=Partial,Y=Paid
    DECODE(ai.payment_status_flag,
        'Y','Fully Paid',
        'P','Partially Paid',
        'N','Unpaid',
        ai.payment_status_flag)        payment_status,
    TRUNC(SYSDATE) - TRUNC(ai.invoice_date)
                                       age_days,
    CASE
        WHEN TRUNC(SYSDATE) - TRUNC(ai.invoice_date) <= 30  THEN '0-30 days'
        WHEN TRUNC(SYSDATE) - TRUNC(ai.invoice_date) <= 60  THEN '31-60 days'
        WHEN TRUNC(SYSDATE) - TRUNC(ai.invoice_date) <= 90  THEN '61-90 days'
        WHEN TRUNC(SYSDATE) - TRUNC(ai.invoice_date) <= 120 THEN '91-120 days'
        ELSE 'Over 120 days'
    END                                aging_bucket,
    ai.description,
    ai.gl_date,
    ai.cancelled_date,
    -- Hold information
    (SELECT COUNT(*) FROM ap_holds_all ah
      WHERE ah.invoice_id     = ai.invoice_id
        AND ah.release_lookup_code IS NULL)
                                       active_holds_count,
    (SELECT LISTAGG(ah.hold_lookup_code,', ')
              WITHIN GROUP (ORDER BY ah.line_location_id)
       FROM ap_holds_all ah
      WHERE ah.invoice_id    = ai.invoice_id
        AND ah.release_lookup_code IS NULL)
                                       hold_reasons
FROM
    ap_invoices_all     ai
JOIN ap_suppliers       aps  ON aps.vendor_id      = ai.vendor_id
JOIN ap_supplier_sites_all apss
                        ON apss.vendor_site_id     = ai.vendor_site_id
WHERE
    ai.org_id          = :p_org_id
AND ai.cancelled_date  IS NULL
AND ai.invoice_date    >= ADD_MONTHS(TRUNC(SYSDATE,'MM'), -3)  -- Last 3 months
ORDER BY
    ai.invoice_date DESC;`
    },
    {
      id:'ap_3way_match',
      title:'AP Three-Way Match: PO → Receipt → Invoice',
      desc:'Matches AP invoices to PO lines and receipts showing matched quantities and amounts',
      tags:['AP','PO','receipt','3-way match','matching'],
      sql:`/* ──────────────────────────────────────────────────────────
   AP Three-Way Match: Purchase Order → Receipt → Invoice
   Shows matching status and any quantity/amount discrepancies.
   ────────────────────────────────────────────────────────── */
SELECT
    ai.invoice_num,
    ai.invoice_date,
    aps.vendor_name,
    ail.line_number                     inv_line,
    ail.amount                          inv_line_amount,
    ph.segment1                         po_number,
    pl.line_num                         po_line,
    pl.quantity                         po_qty,
    pl.unit_price                       po_unit_price,
    poll.quantity                       po_ship_qty,
    poll.quantity_received              qty_received,
    poll.quantity_billed                qty_billed,
    poll.amount_received                amt_received,
    poll.amount_billed                  amt_billed,
    rt.transaction_type                 receipt_txn_type,
    rt.quantity                         receipt_qty,
    rsh.receipt_num,
    rt.transaction_date                 receipt_date,
    DECODE(ail.match_status_flag,
        'A','Approved','T','Tested','N','Not Matched',
        ail.match_status_flag)          match_status
FROM
    ap_invoices_all           ai
JOIN ap_invoice_lines_all    ail  ON ail.invoice_id      = ai.invoice_id
JOIN ap_suppliers            aps  ON aps.vendor_id       = ai.vendor_id
JOIN po_line_locations_all   poll ON poll.line_location_id = ail.po_line_location_id
JOIN po_lines_all            pl   ON pl.po_line_id       = poll.po_line_id
JOIN po_headers_all          ph   ON ph.po_header_id     = pl.po_header_id
LEFT JOIN rcv_transactions   rt   ON rt.po_line_location_id = poll.line_location_id
                                 AND rt.transaction_type = 'RECEIVE'
LEFT JOIN rcv_shipment_headers rsh ON rsh.shipment_header_id = rt.shipment_header_id
WHERE
    ai.org_id               = :p_org_id
AND ai.invoice_date         >= ADD_MONTHS(SYSDATE,-3)
AND ai.cancelled_date       IS NULL
AND ail.line_type_lookup_code = 'ITEM'
ORDER BY
    ai.invoice_date DESC, ai.invoice_num;`
    }
    ]
  },
  {
    id:'glSQL', label:'General Ledger (GL)',
    queries:[
    {
      id:'gl_journal_detail',
      title:'GL Journal Entries — Full Detail with Debit/Credit',
      desc:'Journal lines with batch, category, account details, and entered/accounted amounts',
      tags:['GL','journals','debit','credit','accounting'],
      sql:`/* ──────────────────────────────────────────────────────────
   GL Journal Entries — Full Detail
   Replace :p_period_name and :p_ledger_id with your values.
   ────────────────────────────────────────────────────────── */
SELECT
    gjb.name                        batch_name,
    gjb.status                      batch_status,
    gjh.je_header_id,
    gjh.name                        journal_name,
    gjh.je_source                   source,
    gjh.je_category                 category,
    gjh.period_name,
    gjh.posted_date,
    gjh.effective_date,
    gjh.description                 journal_desc,
    gjh.running_total_dr            total_debit,
    gjh.running_total_cr            total_credit,
    -- Line detail
    gjl.je_line_num                 line_num,
    gjl.description                 line_desc,
    gjl.entered_dr,
    gjl.entered_cr,
    gjl.accounted_dr,
    gjl.accounted_cr,
    -- Account details
    gcc.concatenated_segments        account_code,
    -- Split the flexfield segments individually
    gcc.segment1                    company,
    gcc.segment2                    cost_center,
    gcc.segment3                    account,
    gcc.segment4                    sub_account,
    fav.flex_value_meaning           account_description
FROM
    gl_je_batches     gjb
JOIN gl_je_headers    gjh  ON gjh.je_batch_id   = gjb.je_batch_id
JOIN gl_je_lines      gjl  ON gjl.je_header_id  = gjh.je_header_id
JOIN gl_code_combinations gcc ON gcc.code_combination_id = gjl.code_combination_id
LEFT JOIN fnd_flex_values_vl fav
                      ON fav.flex_value        = gcc.segment3
                     AND fav.flex_value_set_id = (
                             SELECT flex_value_set_id
                               FROM fnd_id_flex_segments
                              WHERE id_flex_code     = 'GL#'
                                AND application_id   = 101
                                AND segment_num      = 3
                                AND id_flex_num       = :p_coa_id)
WHERE
    gjh.ledger_id      = :p_ledger_id
AND gjh.period_name    = :p_period_name
AND gjh.status         = 'P'                  -- Posted journals only
AND gcc.summary_flag   = 'N'                  -- Detail accounts only
ORDER BY
    gjb.name, gjh.name, gjl.je_line_num;`
    },
    {
      id:'gl_period_close_status',
      title:'GL Period Close Status — All Ledgers',
      desc:'Shows open/closed/permanently closed status for each period across all ledgers',
      tags:['GL','period close','month end','status'],
      sql:`/* ──────────────────────────────────────────────────────────
   GL Period Close Status — All Subledger Applications
   ────────────────────────────────────────────────────────── */
SELECT
    gps.period_name,
    gps.period_year,
    gps.period_num,
    gl.name                   ledger_name,
    gl.currency_code          ledger_currency,
    fa.application_short_name application,
    DECODE(gps.closing_status,
        'O','Open',
        'C','Closed',
        'P','Permanently Closed',
        'F','Future-Entry Only',
        'N','Never Opened',
        gps.closing_status)   period_status,
    gps.start_date,
    gps.end_date
FROM
    gl_period_statuses   gps
JOIN gl_ledgers          gl  ON gl.ledger_id        = gps.ledger_id
JOIN fnd_application     fa  ON fa.application_id   = gps.application_id
WHERE
    gps.period_year   >= TO_NUMBER(TO_CHAR(SYSDATE,'YYYY')) - 1
AND fa.application_short_name IN ('SQLGL','SQLAP','SQLPO','AR','PA')
ORDER BY
    gps.period_year DESC, gps.period_num DESC,
    fa.application_short_name, gl.name;`
    }
    ]
  },
  {
    id:'hrmsSQL', label:'HRMS',
    queries:[
    {
      id:'hrms_employee_dt',
      title:'Active Employee with Assignment, Job, Grade (DateTrack)',
      desc:'Correct DateTrack query — ALWAYS filter SYSDATE BETWEEN effective dates',
      tags:['HRMS','employee','assignment','DateTrack','date-effective'],
      sql:`/* ──────────────────────────────────────────────────────────
   Employee with Assignment, Job, Grade, Department
   *** CRITICAL: Always filter DateTrack tables with:
       SYSDATE BETWEEN effective_start_date AND effective_end_date
   Without this filter you get ALL historical versions of a row! ***
   ────────────────────────────────────────────────────────── */
SELECT
    ppf.employee_number,
    ppf.full_name,
    ppf.email_address,
    ppf.date_of_birth,
    ppf.sex,
    ppf.nationality,
    -- Assignment details (from date-tracked assignment table)
    paf.assignment_number,
    paf.assignment_type,         -- E=Employee, C=Contractor
    paf.primary_flag,            -- Y=Primary assignment
    DECODE(paf.primary_flag,'Y','Primary','Secondary') assignment_role,
    -- Job
    pj.name                      job_name,
    -- Position
    pp.name                      position_name,
    -- Grade
    pg.name                      grade_name,
    -- Department
    haou.name                    department,
    -- Location
    hl.location_code,
    hl.description               location_desc,
    -- Supervisor
    sup.full_name                supervisor_name,
    -- Pay
    ppb.pay_basis                pay_basis,
    ppe.proposed_salary_n        salary_amount,
    ppf.current_employee_flag,
    ppos.actual_termination_date termination_date
FROM
    per_people_f              ppf
JOIN per_assignments_f        paf  ON paf.person_id          = ppf.person_id
                                  AND SYSDATE BETWEEN paf.effective_start_date
                                                  AND paf.effective_end_date
                                  AND paf.primary_flag       = 'Y'
                                  AND paf.assignment_type    = 'E'
LEFT JOIN per_jobs             pj   ON pj.job_id             = paf.job_id
LEFT JOIN per_positions        pp   ON pp.position_id        = paf.position_id
LEFT JOIN per_grades           pg   ON pg.grade_id           = paf.grade_id
LEFT JOIN hr_all_organization_units haou
                               ON haou.organization_id       = paf.organization_id
LEFT JOIN hr_locations_all     hl   ON hl.location_id        = paf.location_id
LEFT JOIN per_people_f         sup  ON sup.person_id         = paf.supervisor_id
                                  AND SYSDATE BETWEEN sup.effective_start_date
                                                  AND sup.effective_end_date
LEFT JOIN per_pay_bases        ppb  ON ppb.pay_basis_id      = paf.pay_basis_id
LEFT JOIN pay_proposed_salaries ppe ON ppe.assignment_id     = paf.assignment_id
                                  AND SYSDATE BETWEEN ppe.date_from
                                                  AND NVL(ppe.date_to, SYSDATE)
LEFT JOIN per_periods_of_service ppos
                               ON ppos.person_id             = ppf.person_id
WHERE
    SYSDATE BETWEEN ppf.effective_start_date AND ppf.effective_end_date
AND ppf.current_employee_flag  = 'Y'
ORDER BY
    ppf.full_name;`
    },
    {
      id:'hrms_supervisor_hierarchy',
      title:'Supervisor Hierarchy — CONNECT BY PRIOR',
      desc:'Full manager chain from a given employee up to the top of the org using hierarchical query',
      tags:['HRMS','hierarchy','CONNECT BY','supervisor','org chart'],
      sql:`/* ──────────────────────────────────────────────────────────
   Supervisor Hierarchy — Top-Down and Bottom-Up
   Uses Oracle CONNECT BY for hierarchical traversal.
   Replace :p_top_person_id with the root manager's person_id.
   ────────────────────────────────────────────────────────── */
SELECT
    LEVEL                                               hierarchy_level,
    LPAD(' ', LEVEL * 4) || ppf.full_name               employee_name_indented,
    ppf.employee_number,
    paf.assignment_number,
    pj.name                                             job,
    haou.name                                           department,
    SYS_CONNECT_BY_PATH(ppf.full_name, ' > ')           full_path,
    CONNECT_BY_ISLEAF                                   is_leaf,
    CONNECT_BY_ROOT ppf.full_name                       top_manager
FROM
    per_people_f    ppf
JOIN per_assignments_f paf  ON paf.person_id = ppf.person_id
                           AND SYSDATE BETWEEN paf.effective_start_date
                                           AND paf.effective_end_date
                           AND paf.primary_flag    = 'Y'
                           AND paf.assignment_type = 'E'
LEFT JOIN per_jobs      pj  ON pj.job_id = paf.job_id
LEFT JOIN hr_all_organization_units haou
                        ON haou.organization_id = paf.organization_id
WHERE
    SYSDATE BETWEEN ppf.effective_start_date AND ppf.effective_end_date
AND ppf.current_employee_flag = 'Y'
START WITH
    ppf.person_id = :p_top_person_id             -- Start from this manager
CONNECT BY PRIOR
    ppf.person_id = paf.supervisor_id            -- Link child to supervisor
ORDER SIBLINGS BY
    ppf.full_name;`
    }
    ]
  },
  {
    id:'iexpSQL', label:'iExpense',
    queries:[
    {
      id:'iexp_approval_chain',
      title:'iExpense Report with Full Approval Chain & Status',
      desc:'Expense reports showing all workflow notification steps and approver decisions',
      tags:['iExpense','approval','workflow','WF_NOTIFICATIONS'],
      sql:`/* ──────────────────────────────────────────────────────────
   iExpense Report with Workflow Approval Chain
   Shows every approval step, approver name, and decision.
   ────────────────────────────────────────────────────────── */
SELECT
    aerh.report_header_id,
    aerh.report_number,
    aerh.report_date,
    aerh.description                  report_desc,
    emp.full_name                     submitted_by,
    aerh.total,
    aerh.currency_code,
    aerh.source,
    -- Workflow status
    DECODE(aerh.expense_status_code,
        'PENDING_MGRPAY' ,'Pending Manager Approval',
        'PENDING_PAYMENT','Pending Payment',
        'PAID'           ,'Paid',
        'CANCELLED'      ,'Cancelled',
        'HOLD'           ,'On Hold',
        aerh.expense_status_code)     report_status,
    -- Approval steps from workflow
    wn.from_user                      approver_username,
    wf_dir.display_name               approver_name,
    wn.status                         notification_status,
    wn.sent_date                      sent_to_approver,
    wn.responded_date                 approval_date,
    wn.result                         decision,           -- APPROVE/REJECT/NULL
    wna.text_value                    approver_comment
FROM
    ap_expense_report_headers_all  aerh
JOIN per_people_f                  emp
                         ON emp.person_id = aerh.employee_id
                        AND SYSDATE BETWEEN emp.effective_start_date
                                        AND emp.effective_end_date
-- Link to workflow notifications
LEFT JOIN wf_item_attribute_values wiav
                         ON wiav.item_type = 'AP_WEB_EXPENSE'
                        AND wiav.item_key  = TO_CHAR(aerh.report_header_id)
                        AND wiav.name      = 'EXPENSE_REPORT_ID'
LEFT JOIN wf_notifications         wn
                         ON wn.item_type   = 'AP_WEB_EXPENSE'
                        AND wn.item_key    = TO_CHAR(aerh.report_header_id)
LEFT JOIN wf_users                 wf_dir
                         ON wf_dir.name    = wn.recipient_role
LEFT JOIN wf_notification_attributes wna
                         ON wna.notification_id = wn.notification_id
                        AND wna.name            = 'WF_NOTE'
WHERE
    aerh.org_id       = :p_org_id
AND aerh.report_date  >= ADD_MONTHS(SYSDATE, -3)
ORDER BY
    aerh.report_date DESC, aerh.report_number, wn.sent_date;`
    }
    ]
  }
  ]
},

/* ══════════════════════════════════════════════════════════════════
   7. SQL LEARNING
   ══════════════════════════════════════════════════════════════════ */
{
  id:'learning', icon:'📚', label:'SQL Learning',
  desc:'Basic SQL, advanced analytics, Oracle-specific features, hierarchical queries',
  subcategories:[
  {
    id:'basicSQL', label:'Basic SQL',
    queries:[
    {
      id:'learn_aggregates',
      title:'Aggregate Functions — COUNT, SUM, AVG, MAX, MIN with HAVING',
      desc:'Complete example of GROUP BY with multiple aggregates, filtering with HAVING',
      tags:['SQL','learning','aggregate','GROUP BY','HAVING'],
      sql:`/* ──────────────────────────────────────────────────────────
   Aggregate Functions — GROUP BY, HAVING, ROLLUP
   Learn how Oracle aggregates work with a practical example.
   ────────────────────────────────────────────────────────── */

-- 1. Basic aggregate functions
SELECT
    vendor_id,
    COUNT(*)                          total_invoices,
    COUNT(DISTINCT invoice_num)       unique_invoices,
    SUM(invoice_amount)               total_amount,
    AVG(invoice_amount)               avg_amount,
    MAX(invoice_amount)               max_invoice,
    MIN(invoice_amount)               min_invoice,
    MAX(invoice_date)                 latest_invoice,
    MIN(invoice_date)                 earliest_invoice
FROM
    ap_invoices_all
WHERE
    org_id  = :p_org_id
AND invoice_date >= ADD_MONTHS(SYSDATE, -12)
GROUP BY
    vendor_id
HAVING
    SUM(invoice_amount) > 100000      -- Only vendors with > 100K total
ORDER BY
    total_amount DESC;

-- 2. ROLLUP — adds subtotals and grand total rows
SELECT
    TO_CHAR(invoice_date,'YYYY')   year,
    TO_CHAR(invoice_date,'MM')     month,
    invoice_type_lookup_code       inv_type,
    COUNT(*)                       count,
    SUM(invoice_amount)            total
FROM
    ap_invoices_all
WHERE
    org_id = :p_org_id
AND invoice_date >= ADD_MONTHS(SYSDATE,-12)
GROUP BY
    ROLLUP(TO_CHAR(invoice_date,'YYYY'),
           TO_CHAR(invoice_date,'MM'),
           invoice_type_lookup_code)
ORDER BY 1,2,3;`
    }
    ]
  },
  {
    id:'advancedSQL', label:'Advanced SQL',
    queries:[
    {
      id:'learn_analytics',
      title:'Analytical Functions — ROW_NUMBER, RANK, LAG, LEAD, RATIO_TO_REPORT',
      desc:'All major analytical (window) functions with practical Oracle EBS examples',
      tags:['SQL','learning','analytics','window functions','RANK','LAG'],
      sql:`/* ──────────────────────────────────────────────────────────
   Analytical (Window) Functions — Full Reference
   These are evaluated AFTER the GROUP BY and HAVING, making
   them much more powerful than subqueries for ranking/running totals.
   ────────────────────────────────────────────────────────── */
SELECT
    vendor_id,
    vendor_name,
    invoice_num,
    invoice_date,
    invoice_amount,

    -- ROW_NUMBER: unique sequential number within a partition
    ROW_NUMBER() OVER
        (PARTITION BY vendor_id ORDER BY invoice_date DESC)
                                         row_num_per_vendor,

    -- RANK: same rank for ties, skips next rank (1,1,3)
    RANK() OVER
        (ORDER BY invoice_amount DESC)   amount_rank,

    -- DENSE_RANK: same rank for ties, no skips (1,1,2)
    DENSE_RANK() OVER
        (PARTITION BY vendor_id ORDER BY invoice_amount DESC)
                                         dense_rank_per_vendor,

    -- LAG: get the PREVIOUS row's value in the same partition
    LAG(invoice_amount, 1, 0) OVER
        (PARTITION BY vendor_id ORDER BY invoice_date)
                                         prev_invoice_amount,

    -- LEAD: get the NEXT row's value
    LEAD(invoice_date, 1) OVER
        (PARTITION BY vendor_id ORDER BY invoice_date)
                                         next_invoice_date,

    -- Running total using SUM OVER
    SUM(invoice_amount) OVER
        (PARTITION BY vendor_id
         ORDER BY invoice_date
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
                                         running_total,

    -- RATIO_TO_REPORT: what % of the partition total is this row?
    ROUND(RATIO_TO_REPORT(invoice_amount) OVER
        (PARTITION BY vendor_id) * 100, 2)
                                         pct_of_vendor_total,

    -- NTILE: divide rows into N equal buckets (quartiles here)
    NTILE(4) OVER
        (ORDER BY invoice_amount DESC)   amount_quartile

FROM (
    SELECT
        ai.vendor_id, aps.vendor_name,
        ai.invoice_num, ai.invoice_date, ai.invoice_amount
    FROM ap_invoices_all ai
    JOIN ap_suppliers    aps ON aps.vendor_id = ai.vendor_id
    WHERE ai.org_id = :p_org_id
      AND ai.cancelled_date IS NULL
      AND ai.invoice_date >= ADD_MONTHS(SYSDATE,-12)
)
ORDER BY vendor_name, invoice_date;`
    },
    {
      id:'learn_cte',
      title:'WITH Clause (CTE) — Multiple Chained CTEs',
      desc:'Common Table Expressions — reusable named subqueries for readable complex SQL',
      tags:['SQL','learning','CTE','WITH','subquery'],
      sql:`/* ──────────────────────────────────────────────────────────
   WITH Clause — Common Table Expressions (CTEs)
   CTEs make complex queries readable and reusable.
   Each CTE can reference CTEs defined before it.
   ────────────────────────────────────────────────────────── */
WITH
/* CTE 1: Get invoice totals per vendor in last 12 months */
vendor_totals AS (
    SELECT
        ai.vendor_id,
        COUNT(*)               invoice_count,
        SUM(ai.invoice_amount) total_invoiced,
        AVG(ai.invoice_amount) avg_invoice,
        MAX(ai.invoice_date)   last_invoice_date
    FROM ap_invoices_all ai
    WHERE ai.org_id         = :p_org_id
      AND ai.invoice_date  >= ADD_MONTHS(SYSDATE, -12)
      AND ai.cancelled_date IS NULL
    GROUP BY ai.vendor_id
),
/* CTE 2: Get payment totals per vendor */
vendor_payments AS (
    SELECT
        ai.vendor_id,
        SUM(ai.amount_paid)    total_paid,
        COUNT(DISTINCT ac.check_id) payment_count
    FROM ap_invoices_all   ai
    JOIN ap_invoice_payments aip ON aip.invoice_id  = ai.invoice_id
    JOIN ap_checks_all       ac  ON ac.check_id     = aip.check_id
    WHERE ai.org_id = :p_org_id
    GROUP BY ai.vendor_id
),
/* CTE 3: Identify high-value vendors (total > 500K) */
high_value_vendors AS (
    SELECT vendor_id
      FROM vendor_totals
     WHERE total_invoiced > 500000
),
/* CTE 4: Final ranked result */
ranked_vendors AS (
    SELECT
        aps.vendor_name,
        vt.invoice_count,
        vt.total_invoiced,
        vt.avg_invoice,
        NVL(vp.total_paid, 0)               total_paid,
        vt.total_invoiced - NVL(vp.total_paid,0) outstanding,
        vt.last_invoice_date,
        RANK() OVER (ORDER BY vt.total_invoiced DESC) payment_rank
    FROM vendor_totals    vt
    JOIN ap_suppliers     aps ON aps.vendor_id = vt.vendor_id
    JOIN high_value_vendors hv ON hv.vendor_id = vt.vendor_id
    LEFT JOIN vendor_payments vp ON vp.vendor_id = vt.vendor_id
)
/* Final SELECT using the last CTE */
SELECT *
  FROM ranked_vendors
 WHERE payment_rank <= 10
 ORDER BY payment_rank;`
    },
    {
      id:'learn_pivot',
      title:'PIVOT and UNPIVOT — Cross-Tab Reports',
      desc:'Convert rows to columns (PIVOT) and columns to rows (UNPIVOT) in Oracle SQL',
      tags:['SQL','learning','PIVOT','UNPIVOT','crosstab'],
      sql:`/* ──────────────────────────────────────────────────────────
   PIVOT — Turn Row Values into Columns
   Use case: show invoice counts per month in a single row per vendor.
   ────────────────────────────────────────────────────────── */

-- First: what the raw data looks like (before PIVOT)
SELECT vendor_id,
       TO_CHAR(invoice_date,'MON') month_abbr,
       COUNT(*)                    invoice_count
  FROM ap_invoices_all
 WHERE org_id = :p_org_id
   AND invoice_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'
 GROUP BY vendor_id, TO_CHAR(invoice_date,'MON');

-- PIVOT version: each month becomes its own column
SELECT *
FROM (
    SELECT vendor_id,
           TO_CHAR(invoice_date,'MON') month_abbr,
           invoice_amount
      FROM ap_invoices_all
     WHERE org_id = :p_org_id
       AND invoice_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'
       AND cancelled_date IS NULL
)
PIVOT (
    SUM(invoice_amount)
    FOR month_abbr IN (
        'JAN' AS jan, 'FEB' AS feb, 'MAR' AS mar,
        'APR' AS apr, 'MAY' AS may, 'JUN' AS jun,
        'JUL' AS jul, 'AUG' AS aug, 'SEP' AS sep,
        'OCT' AS oct, 'NOV' AS nov, 'DEC' AS dec
    )
)
ORDER BY vendor_id;

/* ──────────────────────────────────────────────────────────
   UNPIVOT — Turn Columns Back to Rows
   Use case: normalize a pivot result for further processing.
   ────────────────────────────────────────────────────────── */
SELECT vendor_id, month_name, monthly_amount
FROM (
    SELECT vendor_id,
           jan, feb, mar, apr, may, jun,
           jul, aug, sep, oct, nov, dec
      FROM (...) -- your pivot result here
)
UNPIVOT (
    monthly_amount
    FOR month_name IN (
        jan AS 'JAN', feb AS 'FEB', mar AS 'MAR',
        apr AS 'APR', may AS 'MAY', jun AS 'JUN',
        jul AS 'JUL', aug AS 'AUG', sep AS 'SEP',
        oct AS 'OCT', nov AS 'NOV', dec AS 'DEC'
    )
)
ORDER BY vendor_id, month_name;`
    },
    {
      id:'learn_hierarchical',
      title:'CONNECT BY PRIOR — Hierarchical Queries with LEVEL',
      desc:'Oracle hierarchical query: tree traversal, depth, path, cycle detection',
      tags:['SQL','learning','CONNECT BY','hierarchy','tree','LEVEL'],
      sql:`/* ──────────────────────────────────────────────────────────
   Hierarchical Query — CONNECT BY PRIOR
   Classic Oracle syntax for tree structures (org charts, BOMs,
   account hierarchies, menu trees).
   ────────────────────────────────────────────────────────── */

-- Example: GL Account parent-child hierarchy
SELECT
    LEVEL                                        depth,
    LPAD(' ', LEVEL*3) || gcc.concatenated_segments
                                                 account_indented,
    gcc.segment3                                 account_code,
    fav.flex_value_meaning                       account_name,
    fav.summary_flag,
    SYS_CONNECT_BY_PATH(gcc.segment3, ' / ')     full_path,
    CONNECT_BY_ISLEAF                            is_leaf_node,
    CONNECT_BY_ROOT gcc.segment3                 root_account
FROM
    gl_code_combinations  gcc
JOIN fnd_flex_values_vl   fav
     ON fav.flex_value      = gcc.segment3
    AND fav.flex_value_set_id = :p_acct_value_set_id
-- Connect parent to child through the flex values hierarchy
START WITH
    fav.parent_flex_value_low IS NULL             -- Start at root nodes
CONNECT BY PRIOR
    gcc.segment3 = (
        SELECT pv.flex_value
          FROM fnd_flex_value_hierarchies pfh
          JOIN fnd_flex_values            pv
            ON pv.flex_value_id = pfh.parent_flex_value_low
         WHERE pfh.flex_value_set_id = :p_acct_value_set_id
           AND pfh.child_flex_value_low  <= gcc.segment3
           AND pfh.child_flex_value_high >= gcc.segment3
         FETCH FIRST 1 ROW ONLY
    )
NOCYCLE                                           -- Prevent infinite loops
ORDER SIBLINGS BY gcc.segment3;`
    }
    ]
  },
  {
    id:'oracleSpecific', label:'Oracle-Specific Features',
    queries:[
    {
      id:'learn_flashback',
      title:'FLASHBACK Query — AS OF TIMESTAMP and AS OF SCN',
      desc:'Query table data as it existed at a past point in time — no DBA restore needed',
      tags:['SQL','learning','FLASHBACK','timestamp','SCN','Oracle'],
      sql:`/* ──────────────────────────────────────────────────────────
   Oracle FLASHBACK Query
   See data as it was at a past point in time.
   Requires UNDO retention to cover the time period.
   Available without DBA privileges.
   ────────────────────────────────────────────────────────── */

-- Method 1: AS OF TIMESTAMP — human-friendly time reference
SELECT
    invoice_id,
    invoice_num,
    invoice_amount,
    payment_status_flag,
    last_update_date
FROM
    ap_invoices_all
    AS OF TIMESTAMP (SYSTIMESTAMP - INTERVAL '2' HOUR)  -- 2 hours ago
WHERE
    org_id     = :p_org_id
AND invoice_num = :p_invoice_num;

-- Method 2: AS OF SCN (System Change Number) — more precise
-- First get the SCN for a specific timestamp:
SELECT TIMESTAMP_TO_SCN(
    TO_TIMESTAMP('2025-06-15 14:30:00','YYYY-MM-DD HH24:MI:SS')
) scn_at_time FROM dual;

-- Then query using that SCN:
SELECT *
  FROM ap_invoices_all AS OF SCN 123456789
 WHERE invoice_id = :p_invoice_id;

-- Use case: recover accidentally deleted rows
-- Step 1: See what was there 1 hour ago
SELECT * FROM ap_invoices_all
    AS OF TIMESTAMP (SYSTIMESTAMP - INTERVAL '1' HOUR)
WHERE invoice_id = :p_invoice_id;

-- Step 2: Re-insert the deleted row from the flashback query
INSERT INTO ap_invoices_all
SELECT * FROM ap_invoices_all
    AS OF TIMESTAMP (SYSTIMESTAMP - INTERVAL '1' HOUR)
WHERE invoice_id = :p_invoice_id
  AND NOT EXISTS (SELECT 1 FROM ap_invoices_all
                   WHERE invoice_id = :p_invoice_id);
COMMIT;`
    },
    {
      id:'learn_rownum',
      title:'ROWNUM vs ROW_NUMBER() — The Famous Order Bug Explained',
      desc:'Why ROWNUM with ORDER BY gives wrong results and how to fix it correctly',
      tags:['SQL','learning','ROWNUM','ROW_NUMBER','pagination','Oracle'],
      sql:`/* ──────────────────────────────────────────────────────────
   ROWNUM vs ROW_NUMBER() — Understanding the Difference
   This is one of the most common Oracle SQL mistakes!
   ────────────────────────────────────────────────────────── */

-- ❌ WRONG: This does NOT return the top 5 by amount
-- ROWNUM is assigned BEFORE ORDER BY, so you get 5 random rows
-- then Oracle sorts those 5. The result is wrong.
SELECT *
  FROM ap_invoices_all
 WHERE org_id = :p_org_id
   AND ROWNUM <= 5
 ORDER BY invoice_amount DESC;  -- ORDER BY happens AFTER ROWNUM filter!

-- ✅ CORRECT Method 1: Wrap in subquery
SELECT *
  FROM (
      SELECT *
        FROM ap_invoices_all
       WHERE org_id = :p_org_id
       ORDER BY invoice_amount DESC  -- Sort FIRST in inner query
  )
 WHERE ROWNUM <= 5;                  -- THEN limit to 5

-- ✅ CORRECT Method 2: ROW_NUMBER() analytical function
SELECT *
  FROM (
      SELECT
          invoice_id, invoice_num, invoice_amount,
          ROW_NUMBER() OVER (ORDER BY invoice_amount DESC) rn
      FROM ap_invoices_all
      WHERE org_id = :p_org_id
  )
 WHERE rn <= 5;

-- ✅ CORRECT Method 3: FETCH FIRST (Oracle 12c+, cleanest syntax)
SELECT *
  FROM ap_invoices_all
 WHERE org_id = :p_org_id
 ORDER BY invoice_amount DESC
 FETCH FIRST 5 ROWS ONLY;

-- ✅ Pagination using OFFSET (Oracle 12c+)
SELECT *
  FROM ap_invoices_all
 WHERE org_id = :p_org_id
 ORDER BY invoice_amount DESC
 OFFSET 20 ROWS                  -- Skip first 20 rows (page 1)
 FETCH NEXT 10 ROWS ONLY;        -- Return rows 21-30 (page 2)`
    }
    ]
  }
  ]
}

/* ── End of categories ─────────────────────────────────────────── */
]  /* end categories array */
}; /* end window.EBS_SQL_LIBRARY */
