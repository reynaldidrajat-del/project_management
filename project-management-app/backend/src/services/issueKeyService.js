const { query, pool } = require('../config/db');

/**
 * Issue Key Service
 *
 * Generates unique issue keys in the format {PROJECT_KEY}-{NUMBER} (e.g., PROJ-123).
 * Each project has its own auto-incrementing sequence.
 * Uses database-level locking (SELECT FOR UPDATE) for concurrency safety.
 */

// Regex pattern for valid issue keys: uppercase letters followed by dash and number
const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}-\d+$/;

/**
 * Validate that an issue key matches the expected format.
 * Format: {LETTERS}-{NUMBER} where LETTERS is 2-10 uppercase alphanumeric chars starting with a letter.
 * @param {string} key - The issue key to validate
 * @returns {boolean} True if valid format
 */
const validateIssueKey = (key) => {
  if (!key || typeof key !== 'string') {
    return false;
  }
  return ISSUE_KEY_PATTERN.test(key);
};

/**
 * Derive a project key from the project name.
 * Takes the first 2-4 uppercase letters from the project name.
 * If the name has multiple words, uses initials.
 * @param {string} projectName - The project name
 * @returns {string} Derived project key (2-4 uppercase letters)
 */
const deriveProjectKey = (projectName) => {
  if (!projectName || typeof projectName !== 'string') {
    return 'PROJ';
  }

  const cleaned = projectName.trim();
  if (!cleaned) {
    return 'PROJ';
  }

  // Split into words and filter out empty strings
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    // Multiple words: use initials (up to 4 characters)
    const initials = words
      .slice(0, 4)
      .map((word) => word[0].toUpperCase())
      .join('');
    return initials.length >= 2 ? initials : initials.padEnd(2, 'X');
  }

  // Single word: take first 3-4 uppercase characters
  const singleWord = words[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (singleWord.length >= 4) {
    return singleWord.substring(0, 4);
  }
  if (singleWord.length >= 2) {
    return singleWord;
  }
  return singleWord.padEnd(2, 'X');
};

/**
 * Get or derive the project key for a given project.
 * If the project already has a project_key set, returns it.
 * Otherwise derives one from the project name and saves it.
 * @param {number} projectId - The project ID
 * @returns {Promise<string>} The project key
 */
const getProjectKey = async (projectId) => {
  // First check if project already has a key
  const projectResult = await query(
    'SELECT id, name, project_key FROM projects WHERE id = $1',
    [projectId]
  );

  if (!projectResult.rows[0]) {
    throw new Error(`Project with ID ${projectId} not found.`);
  }

  const project = projectResult.rows[0];

  // If project already has a key, return it
  if (project.project_key) {
    return project.project_key;
  }

  // Derive a key from the project name
  let baseKey = deriveProjectKey(project.name);

  // Ensure uniqueness by checking existing keys
  let candidateKey = baseKey;
  let suffix = 1;

  while (true) {
    const existingResult = await query(
      'SELECT id FROM projects WHERE project_key = $1 AND id != $2',
      [candidateKey, projectId]
    );

    if (existingResult.rows.length === 0) {
      break;
    }

    // Key already taken, append a number
    suffix++;
    candidateKey = `${baseKey}${suffix}`;
  }

  // Save the derived key to the project
  await query(
    'UPDATE projects SET project_key = $1 WHERE id = $2',
    [candidateKey, projectId]
  );

  return candidateKey;
};

/**
 * Get the next sequence number for a project atomically.
 * Uses SELECT FOR UPDATE to prevent race conditions.
 * @param {number} projectId - The project ID
 * @param {object} [client] - Optional database client for transaction use
 * @returns {Promise<number>} The next sequence number
 */
const getNextSequence = async (projectId, client = null) => {
  const execQuery = client ? client.query.bind(client) : query;

  // Try to increment existing sequence with row-level lock
  const updateResult = await execQuery(
    `UPDATE project_key_sequences
     SET current_sequence = current_sequence + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE project_id = $1
     RETURNING current_sequence`,
    [projectId]
  );

  if (updateResult.rows.length > 0) {
    return updateResult.rows[0].current_sequence;
  }

  // No sequence exists yet - determine starting sequence from existing issues
  const maxResult = await execQuery(
    `SELECT COALESCE(MAX(
       CASE 
         WHEN issue_key ~ '^[A-Z][A-Z0-9]+-[0-9]+$'
         THEN CAST(split_part(issue_key, '-', 2) AS INTEGER)
         ELSE 0
       END
     ), 0) AS max_seq
     FROM tasks
     WHERE project_id = $1 AND issue_key IS NOT NULL`,
    [projectId]
  );

  const startSequence = (maxResult.rows[0]?.max_seq || 0) + 1;

  // Insert new sequence row (handle race condition with ON CONFLICT)
  const insertResult = await execQuery(
    `INSERT INTO project_key_sequences (project_id, current_sequence)
     VALUES ($1, $2)
     ON CONFLICT (project_id)
     DO UPDATE SET current_sequence = project_key_sequences.current_sequence + 1,
                   updated_at = CURRENT_TIMESTAMP
     RETURNING current_sequence`,
    [projectId, startSequence]
  );

  return insertResult.rows[0].current_sequence;
};

/**
 * Generate the next unique issue key for a project.
 * This is the main entry point for issue key generation.
 * Uses a database transaction with row-level locking for concurrency safety.
 * @param {number} projectId - The project ID
 * @returns {Promise<string>} The generated issue key (e.g., 'PROJ-123')
 */
const generateIssueKey = async (projectId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock the sequence row for this project to prevent concurrent duplicates
    const lockResult = await client.query(
      `SELECT current_sequence FROM project_key_sequences
       WHERE project_id = $1
       FOR UPDATE`,
      [projectId]
    );

    // Get the project key
    const projectKey = await getProjectKey(projectId);

    // Get next sequence number (within the transaction)
    const sequence = await getNextSequence(projectId, client);

    // Format the issue key
    const issueKey = `${projectKey}-${sequence}`;

    await client.query('COMMIT');

    return issueKey;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Format an issue key from a project key and sequence number.
 * Pure function, no database access.
 * @param {string} projectKey - The project key (e.g., 'PROJ')
 * @param {number} sequence - The sequence number
 * @returns {string} The formatted issue key (e.g., 'PROJ-123')
 */
const formatIssueKey = (projectKey, sequence) => {
  if (!projectKey || typeof projectKey !== 'string') {
    throw new Error('Project key is required.');
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('Sequence must be a positive integer.');
  }
  return `${projectKey.toUpperCase()}-${sequence}`;
};

/**
 * Parse an issue key into its components.
 * @param {string} issueKey - The issue key (e.g., 'PROJ-123')
 * @returns {{ projectKey: string, sequence: number } | null} Parsed components or null if invalid
 */
const parseIssueKey = (issueKey) => {
  if (!validateIssueKey(issueKey)) {
    return null;
  }

  const lastDashIndex = issueKey.lastIndexOf('-');
  const projectKey = issueKey.substring(0, lastDashIndex);
  const sequence = parseInt(issueKey.substring(lastDashIndex + 1), 10);

  return { projectKey, sequence };
};

/**
 * Set a specific project key for a project.
 * Validates uniqueness before setting.
 * @param {number} projectId - The project ID
 * @param {string} projectKey - The desired project key
 * @returns {Promise<string>} The set project key
 */
const setProjectKey = async (projectId, projectKey) => {
  if (!projectKey || typeof projectKey !== 'string') {
    throw new Error('Project key is required.');
  }

  const normalizedKey = projectKey.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (normalizedKey.length < 2 || normalizedKey.length > 10) {
    throw new Error('Project key must be 2-10 alphanumeric characters.');
  }

  if (!/^[A-Z]/.test(normalizedKey)) {
    throw new Error('Project key must start with a letter.');
  }

  // Check uniqueness
  const existingResult = await query(
    'SELECT id FROM projects WHERE project_key = $1 AND id != $2',
    [normalizedKey, projectId]
  );

  if (existingResult.rows.length > 0) {
    throw new Error(`Project key "${normalizedKey}" is already in use.`);
  }

  await query(
    'UPDATE projects SET project_key = $1 WHERE id = $2',
    [normalizedKey, projectId]
  );

  return normalizedKey;
};

module.exports = {
  deriveProjectKey,
  formatIssueKey,
  generateIssueKey,
  getNextSequence,
  getProjectKey,
  parseIssueKey,
  setProjectKey,
  validateIssueKey,
};
