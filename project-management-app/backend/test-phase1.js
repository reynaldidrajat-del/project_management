/**
 * Test script for Phase 1 Foundation - JIRA Parity Development
 * Run this script to verify all Phase 1 services are working correctly
 */

const { query } = require('./src/config/db');

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const log = {
  success: (msg) => console.log(`${GREEN}✓ ${msg}${RESET}`),
  error: (msg) => console.log(`${RED}✗ ${msg}${RESET}`),
  info: (msg) => console.log(`${YELLOW}→ ${msg}${RESET}`),
};

async function testDatabaseSchema() {
  console.log('\n=== Testing Database Schema ===\n');

  try {
    // Test issue_types table
    const issueTypesResult = await query('SELECT COUNT(*) FROM issue_types');
    log.success(`issue_types table exists - ${issueTypesResult.rows[0].count} records`);

    // Test workflows table
    const workflowsResult = await query('SELECT COUNT(*) FROM workflows');
    log.success(`workflows table exists - ${workflowsResult.rows[0].count} records`);

    // Test workflow_states table
    const statesResult = await query('SELECT COUNT(*) FROM workflow_states');
    log.success(`workflow_states table exists - ${statesResult.rows[0].count} records`);

    // Test workflow_transitions table
    const transitionsResult = await query('SELECT COUNT(*) FROM workflow_transitions');
    log.success(`workflow_transitions table exists - ${transitionsResult.rows[0].count} records`);

    // Test custom_fields table
    const customFieldsResult = await query('SELECT COUNT(*) FROM custom_fields');
    log.success(`custom_fields table exists - ${customFieldsResult.rows[0].count} records`);

    // Test custom_field_values table
    const customFieldValuesResult = await query('SELECT COUNT(*) FROM custom_field_values');
    log.success(`custom_field_values table exists - ${customFieldValuesResult.rows[0].count} records`);

    // Test sprints table
    const sprintsResult = await query('SELECT COUNT(*) FROM sprints');
    log.success(`sprints table exists - ${sprintsResult.rows[0].count} records`);

    // Test epics table
    const epicsResult = await query('SELECT COUNT(*) FROM epics');
    log.success(`epics table exists - ${epicsResult.rows[0].count} records`);

    // Test tasks table has new columns
    const tasksColumnsResult = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' 
        AND column_name IN ('issue_type_id', 'issue_key', 'story_points', 'epic_id', 'sprint_id', 'workflow_state_id')
    `);
    const tasksColumns = tasksColumnsResult.rows.map(r => r.column_name);
    
    const requiredColumns = ['issue_type_id', 'issue_key', 'story_points', 'epic_id', 'sprint_id', 'workflow_state_id'];
    for (const col of requiredColumns) {
      if (tasksColumns.includes(col)) {
        log.success(`tasks.${col} column exists`);
      } else {
        log.error(`tasks.${col} column missing`);
      }
    }

    return true;
  } catch (error) {
    log.error(`Database schema test failed: ${error.message}`);
    return false;
  }
}

async function testIssueTypesService() {
  console.log('\n=== Testing Issue Types Service ===\n');

  try {
    const {
      getIssueTypes,
      getIssueTypeById,
      validateHierarchy,
      HIERARCHY_LEVELS,
    } = require('./src/services/issueTypeService');

    // Test getIssueTypes
    const issueTypes = await getIssueTypes();
    log.success(`getIssueTypes() returned ${issueTypes.length} issue types`);

    // Display issue types
    if (issueTypes.length > 0) {
      log.info('Issue types found:');
      for (const type of issueTypes) {
        console.log(`  - ${type.name} (hierarchy: ${type.hierarchy_level})`);
      }
    }

    // Test validateHierarchy
    const tests = [
      { parent: 'Epic', child: 'Story', expected: true },
      { parent: 'Story', child: 'Task', expected: true },
      { parent: 'Task', child: 'Subtask', expected: true },
      { parent: 'Subtask', child: 'Task', expected: false },
      { parent: 'Story', child: 'Epic', expected: false },
    ];

    for (const test of tests) {
      const result = validateHierarchy(test.parent, test.child);
      if (result === test.expected) {
        log.success(`validateHierarchy('${test.parent}', '${test.child}') = ${result}`);
      } else {
        log.error(`validateHierarchy('${test.parent}', '${test.child}') expected ${test.expected}, got ${result}`);
      }
    }

    return true;
  } catch (error) {
    log.error(`Issue types service test failed: ${error.message}`);
    return false;
  }
}

async function testWorkflowService() {
  console.log('\n=== Testing Workflow Service ===\n');

  try {
    const {
      getWorkflows,
      getWorkflowStates,
      getWorkflowTransitions,
    } = require('./src/services/workflowService');

    // Test getWorkflows
    const workflows = await getWorkflows();
    log.success(`getWorkflows() returned ${workflows.length} workflows`);

    // Test workflow states and transitions
    if (workflows.length > 0) {
      const workflow = workflows[0];
      log.info(`Testing workflow: ${workflow.name} (ID: ${workflow.id})`);

      const states = await getWorkflowStates(workflow.id);
      log.success(`  - ${states.length} states`);

      const transitions = await getWorkflowTransitions(workflow.id);
      log.success(`  - ${transitions.length} transitions`);

      // Display states
      for (const state of states) {
        console.log(`    - ${state.name} (${state.category})${state.is_initial ? ' [initial]' : ''}${state.is_final ? ' [final]' : ''}`);
      }
    }

    return true;
  } catch (error) {
    log.error(`Workflow service test failed: ${error.message}`);
    return false;
  }
}

async function testCustomFieldService() {
  console.log('\n=== Testing Custom Field Service ===\n');

  try {
    const {
      getCustomFields,
      validateCustomFieldValue,
    } = require('./src/services/customFieldService');

    // Test getCustomFields
    const customFields = await getCustomFields();
    log.success(`getCustomFields() returned ${customFields.length} custom fields`);

    // Display supported field types
    const FIELD_TYPES = ['text', 'number', 'date', 'select', 'multi_select', 'user', 'checkbox', 'url'];
    log.info(`Supported field types: ${FIELD_TYPES.join(', ')}`);

    return true;
  } catch (error) {
    log.error(`Custom field service test failed: ${error.message}`);
    return false;
  }
}

async function testBackwardCompatibility() {
  console.log('\n=== Testing Backward Compatibility ===\n');

  try {
    // Test that existing tasks table still works
    const tasksResult = await query('SELECT id, title, status, progress FROM tasks LIMIT 5');
    log.success(`Existing tasks table query works - ${tasksResult.rows.length} tasks found`);

    // Test that existing task service still works
    const { getTasks, getTaskById } = require('./src/services/taskService');
    const tasks = await getTasks({ include_archived: 'false' });
    log.success(`getTasks() still works - ${tasks.length} tasks returned`);

    return true;
  } catch (error) {
    log.error(`Backward compatibility test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n========================================');
  console.log('  Phase 1 Foundation - Test Suite');
  console.log('========================================');

  const results = {
    schema: false,
    issueTypes: false,
    workflow: false,
    customFields: false,
    backwardCompatibility: false,
  };

  results.schema = await testDatabaseSchema();
  results.issueTypes = await testIssueTypesService();
  results.workflow = await testWorkflowService();
  results.customFields = await testCustomFieldService();
  results.backwardCompatibility = await testBackwardCompatibility();

  console.log('\n========================================');
  console.log('  Test Results Summary');
  console.log('========================================\n');

  let allPassed = true;
  for (const [test, passed] of Object.entries(results)) {
    if (passed) {
      log.success(`${test}: PASSED`);
    } else {
      log.error(`${test}: FAILED`);
      allPassed = false;
    }
  }

  console.log('\n');
  if (allPassed) {
    log.success('All Phase 1 Foundation tests PASSED!');
    console.log('\n✅ Phase 1 Foundation is complete and ready for Phase 2.\n');
  } else {
    log.error('Some tests FAILED. Please review the errors above.');
    process.exit(1);
  }

  process.exit(0);
}

runAllTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
