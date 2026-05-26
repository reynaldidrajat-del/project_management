/**
 * Script to run all JIRA parity migration files
 */

const fs = require('fs');
const path = require('path');
const { query } = require('./src/config/db');

const MIGRATIONS_DIR = path.join(__dirname, 'src', 'database', 'migrations');

// JIRA parity migration files in order
const JIRA_PARITY_MIGRATIONS = [
  '20260523_jira_parity_issue_types.sql',
  '20260523_sprints_table.sql',
  '20260523_jira_parity_epics.sql',
  '20260523_jira_parity_custom_fields.sql',
  '20260524_workflows_tables.sql',
  '20260601_jira_parity_seed.sql',
];

async function runMigration(filename) {
  console.log(`Running migration: ${filename}`);
  
  const filePath = path.join(MIGRATIONS_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  File not found: ${filePath}`);
    return false;
  }
  
  const sql = fs.readFileSync(filePath, 'utf8');
  
  try {
    await query(sql);
    console.log(`  ✅ Success`);
    return true;
  } catch (error) {
    // Check if it's a "relation already exists" error
    if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
      console.log(`  ⚠️  Already exists, skipping`);
      return true;
    }
    console.log(`  ❌ Error: ${error.message}`);
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
      success++;
    } else {
      failed++;
    }
  }

  console.log('\n========================================');
  console.log(`  Migrations Complete: ${success} success, ${failed} failed`);
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAllMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
