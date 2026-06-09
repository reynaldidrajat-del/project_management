/**
 * Script to run all JIRA parity migration files.
 */

const fs = require('fs');
const path = require('path');
const { pool, query } = require('./src/config/db');

const MIGRATIONS_DIR = path.join(__dirname, 'src', 'database', 'migrations');

// JIRA parity migration files in dependency order.
const JIRA_PARITY_MIGRATIONS = [
  '20260601_jira_parity_foundation.sql',
  '20260524_workflows_tables.sql',
  '20260523_jira_parity_issue_types.sql',
  '20260601_issue_key_sequences.sql',
  '20260523_sprints_table.sql',
  '20260523_jira_parity_epics.sql',
  '20260523_jira_parity_custom_fields.sql',
  '20260523_tasks_issue_management.sql',
  '20260523_versions_releases.sql',
  '20260524_roadmaps_automation_tables.sql',
  '20260523_components_issue_components.sql',
  '20260523_issue_links.sql',
  '20260523_issue_watchers.sql',
  '20260523_time_tracking.sql',
  '20260601_backlog_order.sql',
  '20260601_jira_parity_seed.sql',
  '20260602_phase4_reporting_templates.sql',
  '20260603_phase6_performance_security.sql',
];

async function runMigration(filename) {
  console.log(`Running migration: ${filename}`);

  const filePath = path.join(MIGRATIONS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`  Missing file: ${filePath}`);
    return false;
  }

  const sql = fs.readFileSync(filePath, 'utf8');

  try {
    await query(sql);
    console.log('  Success');
    return true;
  } catch (error) {
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

async function runAllMigrations() {
  console.log('\n========================================');
  console.log('  Running JIRA Parity Migrations');
  console.log('========================================\n');

  let success = 0;
  let failed = 0;

  for (const migration of JIRA_PARITY_MIGRATIONS) {
    const result = await runMigration(migration);

    if (result) {
      success += 1;
    } else {
      failed += 1;
    }
  }

  console.log('\n========================================');
  console.log(`  Migrations Complete: ${success} success, ${failed} failed`);
  console.log('========================================\n');

  return failed;
}

runAllMigrations()
  .then(async (failed) => {
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(async (error) => {
    console.error('Migration failed:', error);
    await pool.end();
    process.exit(1);
  });
