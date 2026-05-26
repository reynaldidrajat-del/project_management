const { query } = require('../config/db');
const { logActivity } = require('./activityService');

// ============================================================================
// VERSION/RELEASE CRUD
// ============================================================================

// Mengambil daftar version/release untuk sebuah project, opsional filter by status.
const getVersions = async (projectId, status) => {
  const conditions = ['r.project_id = $1'];
  const values = [projectId];

  if (status) {
    values.push(status);
    conditions.push(`r.status = $${values.length}`);
  }

  const whereClause = conditions.join(' AND ');

  const result = await query(
    `
      SELECT
        r.id,
        r.project_id,
        r.name,
        r.description,
        to_char(r.start_date, 'YYYY-MM-DD') AS start_date,
        to_char(r.release_date, 'YYYY-MM-DD') AS release_date,
        r.status,
        r.released_at,
        r.created_at,
        r.updated_at,
        COALESCE(fix_count.total, 0)::INTEGER AS issue_count,
        COALESCE(fix_count.done, 0)::INTEGER AS done_count
      FROM releases r
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::INTEGER AS total,
          COUNT(*) FILTER (WHERE t.status = 'Done')::INTEGER AS done
        FROM issue_fix_versions ifv
        INNER JOIN tasks t ON t.id = ifv.issue_id
        WHERE ifv.release_id = r.id
      ) fix_count ON TRUE
      WHERE ${whereClause}
      ORDER BY r.release_date ASC NULLS LAST, r.name ASC
    `,
    values,
  );

  return result.rows;
};

// Mengambil detail satu version berdasarkan id, termasuk progress.
const getVersionById = async (id) => {
  const result = await query(
    `
      SELECT
        r.id,
        r.project_id,
        r.name,
        r.description,
        to_char(r.start_date, 'YYYY-MM-DD') AS start_date,
        to_char(r.release_date, 'YYYY-MM-DD') AS release_date,
        r.status,
        r.released_at,
        r.created_at,
        r.updated_at,
        COALESCE(fix_count.total, 0)::INTEGER AS issue_count,
        COALESCE(fix_count.done, 0)::INTEGER AS done_count
      FROM releases r
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::INTEGER AS total,
          COUNT(*) FILTER (WHERE t.status = 'Done')::INTEGER AS done
        FROM issue_fix_versions ifv
        INNER JOIN tasks t ON t.id = ifv.issue_id
        WHERE ifv.release_id = r.id
      ) fix_count ON TRUE
      WHERE r.id = $1
    `,
    [id],
  );

  if (!result.rows[0]) {
    return null;
  }

  const version = result.rows[0];
  version.progress = version.issue_count > 0
    ? Math.round((version.done_count / version.issue_count) * 100)
    : 0;

  return version;
};

// Membuat version/release baru.
const createVersion = async (data, context = {}) => {
  if (!data.name) {
    throw new Error('Nama version wajib diisi.');
  }

  if (!data.project_id) {
    throw new Error('Project ID wajib diisi.');
  }

  const validStatuses = ['unreleased', 'released', 'archived'];
  const status = data.status || 'unreleased';

  if (!validStatuses.includes(status)) {
    throw new Error('Status version tidak valid. Gunakan: unreleased, released, atau archived.');
  }

  const result = await query(
    `
      INSERT INTO releases (project_id, name, description, start_date, release_date, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      data.project_id,
      data.name,
      data.description || null,
      data.start_date || null,
      data.release_date || null,
      status,
    ],
  );

  const version = await getVersionById(result.rows[0].id);

  await logActivity({
    actor_user_id: context.actor_user_id,
    project_id: data.project_id,
    action: 'version.create',
    object_type: 'release',
    object_id: version.id,
    description: `Version "${version.name}" dibuat.`,
    metadata: { version_name: version.name, status },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return version;
};

// Memperbarui version/release.
const updateVersion = async (id, data, context = {}) => {
  const existing = await getVersionById(id);

  if (!existing) {
    throw new Error('Version tidak ditemukan.');
  }

  if (data.name !== undefined && !data.name) {
    throw new Error('Nama version wajib diisi.');
  }

  if (data.status) {
    const validStatuses = ['unreleased', 'released', 'archived'];
    if (!validStatuses.includes(data.status)) {
      throw new Error('Status version tidak valid. Gunakan: unreleased, released, atau archived.');
    }
  }

  const result = await query(
    `
      UPDATE releases
      SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        start_date = COALESCE($3, start_date),
        release_date = COALESCE($4, release_date),
        status = COALESCE($5, status)
      WHERE id = $6
      RETURNING id
    `,
    [
      data.name || null,
      data.description !== undefined ? data.description : null,
      data.start_date !== undefined ? data.start_date : null,
      data.release_date !== undefined ? data.release_date : null,
      data.status || null,
      id,
    ],
  );

  if (!result.rows[0]) {
    throw new Error('Version tidak ditemukan.');
  }

  const version = await getVersionById(id);

  await logActivity({
    actor_user_id: context.actor_user_id,
    project_id: existing.project_id,
    action: 'version.update',
    object_type: 'release',
    object_id: version.id,
    description: `Version "${version.name}" diperbarui.`,
    metadata: { changed_fields: Object.keys(data || {}) },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return version;
};

// Menghapus version. Tidak boleh dihapus jika ada issue yang terkait.
const deleteVersion = async (id, context = {}) => {
  const existing = await getVersionById(id);

  if (!existing) {
    throw new Error('Version tidak ditemukan.');
  }

  // Cek apakah ada issue yang terkait (fix_versions atau affects_versions)
  const assignedIssues = await query(
    `
      SELECT COUNT(*)::INTEGER AS total
      FROM (
        SELECT issue_id FROM issue_fix_versions WHERE release_id = $1
        UNION
        SELECT issue_id FROM issue_affects_versions WHERE release_id = $1
      ) combined
    `,
    [id],
  );

  if (assignedIssues.rows[0].total > 0) {
    throw new Error(
      `Tidak dapat menghapus version "${existing.name}" karena masih memiliki ${assignedIssues.rows[0].total} issue terkait.`
    );
  }

  await query('DELETE FROM releases WHERE id = $1', [id]);

  await logActivity({
    actor_user_id: context.actor_user_id,
    project_id: existing.project_id,
    action: 'version.delete',
    object_type: 'release',
    object_id: Number(id),
    description: `Version "${existing.name}" dihapus.`,
    metadata: { deleted_version_id: Number(id), version_name: existing.name },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return { id: Number(id), name: existing.name };
};

// ============================================================================
// VERSION LIFECYCLE
// ============================================================================

// Menandai version sebagai released.
const releaseVersion = async (id, context = {}) => {
  const existing = await getVersionById(id);

  if (!existing) {
    throw new Error('Version tidak ditemukan.');
  }

  if (existing.status === 'released') {
    throw new Error('Version sudah dalam status released.');
  }

  await query(
    `
      UPDATE releases
      SET status = 'released', released_at = NOW()
      WHERE id = $1
    `,
    [id],
  );

  const version = await getVersionById(id);

  await logActivity({
    actor_user_id: context.actor_user_id,
    project_id: existing.project_id,
    action: 'version.release',
    object_type: 'release',
    object_id: version.id,
    description: `Version "${version.name}" dirilis.`,
    metadata: { version_name: version.name },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return version;
};

// Mengarsipkan version.
const archiveVersion = async (id, context = {}) => {
  const existing = await getVersionById(id);

  if (!existing) {
    throw new Error('Version tidak ditemukan.');
  }

  if (existing.status === 'archived') {
    throw new Error('Version sudah dalam status archived.');
  }

  await query(
    `
      UPDATE releases
      SET status = 'archived'
      WHERE id = $1
    `,
    [id],
  );

  const version = await getVersionById(id);

  await logActivity({
    actor_user_id: context.actor_user_id,
    project_id: existing.project_id,
    action: 'version.archive',
    object_type: 'release',
    object_id: version.id,
    description: `Version "${version.name}" diarsipkan.`,
    metadata: { version_name: version.name },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return version;
};

// ============================================================================
// VERSION PROGRESS
// ============================================================================

// Menghitung progress version berdasarkan issue yang fix_version-nya mengarah ke version ini.
const getVersionProgress = async (id) => {
  const result = await query(
    `
      SELECT
        COUNT(*)::INTEGER AS total,
        COUNT(*) FILTER (WHERE t.status = 'Done')::INTEGER AS done
      FROM issue_fix_versions ifv
      INNER JOIN tasks t ON t.id = ifv.issue_id
      WHERE ifv.release_id = $1
    `,
    [id],
  );

  const { total, done } = result.rows[0];
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    version_id: Number(id),
    total_issues: total,
    completed_issues: done,
    progress,
  };
};

// ============================================================================
// ISSUE-VERSION RELATIONSHIPS
// ============================================================================

// Mengambil issues berdasarkan version, bisa filter by type (fix atau affects).
const getIssuesByVersion = async (versionId, type = 'fix') => {
  const table = type === 'affects' ? 'issue_affects_versions' : 'issue_fix_versions';

  const result = await query(
    `
      SELECT
        t.id,
        t.title,
        t.status,
        t.priority,
        t.issue_key,
        t.story_points,
        t.assignee_id,
        u.name AS assignee_name
      FROM ${table} iv
      INNER JOIN tasks t ON t.id = iv.issue_id
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE iv.release_id = $1
      ORDER BY t.created_at DESC
    `,
    [versionId],
  );

  return result.rows;
};

// Menambahkan version ke fix_versions issue (junction table + TEXT[] array).
const assignFixVersion = async (issueId, versionName) => {
  // Cari release berdasarkan nama
  const releaseResult = await query(
    `SELECT id, project_id FROM releases WHERE name = $1 LIMIT 1`,
    [versionName],
  );

  if (!releaseResult.rows[0]) {
    throw new Error(`Version "${versionName}" tidak ditemukan.`);
  }

  const releaseId = releaseResult.rows[0].id;

  // Insert ke junction table (ignore jika sudah ada)
  await query(
    `
      INSERT INTO issue_fix_versions (issue_id, release_id)
      VALUES ($1, $2)
      ON CONFLICT (issue_id, release_id) DO NOTHING
    `,
    [issueId, releaseId],
  );

  // Sync TEXT[] array di tasks table
  await query(
    `
      UPDATE tasks
      SET fix_versions = array_append(
        COALESCE(fix_versions, '{}'),
        $1
      )
      WHERE id = $2
        AND NOT ($1 = ANY(COALESCE(fix_versions, '{}')))
    `,
    [versionName, issueId],
  );

  return { issue_id: Number(issueId), version_name: versionName, type: 'fix' };
};

// Menambahkan version ke affects_versions issue (junction table + TEXT[] array).
const assignAffectsVersion = async (issueId, versionName) => {
  // Cari release berdasarkan nama
  const releaseResult = await query(
    `SELECT id, project_id FROM releases WHERE name = $1 LIMIT 1`,
    [versionName],
  );

  if (!releaseResult.rows[0]) {
    throw new Error(`Version "${versionName}" tidak ditemukan.`);
  }

  const releaseId = releaseResult.rows[0].id;

  // Insert ke junction table (ignore jika sudah ada)
  await query(
    `
      INSERT INTO issue_affects_versions (issue_id, release_id)
      VALUES ($1, $2)
      ON CONFLICT (issue_id, release_id) DO NOTHING
    `,
    [issueId, releaseId],
  );

  // Sync TEXT[] array di tasks table
  await query(
    `
      UPDATE tasks
      SET affects_versions = array_append(
        COALESCE(affects_versions, '{}'),
        $1
      )
      WHERE id = $2
        AND NOT ($1 = ANY(COALESCE(affects_versions, '{}')))
    `,
    [versionName, issueId],
  );

  return { issue_id: Number(issueId), version_name: versionName, type: 'affects' };
};

// Menghapus version dari fix_versions issue (junction table + TEXT[] array).
const removeFixVersion = async (issueId, versionName) => {
  // Cari release berdasarkan nama
  const releaseResult = await query(
    `SELECT id FROM releases WHERE name = $1 LIMIT 1`,
    [versionName],
  );

  if (releaseResult.rows[0]) {
    await query(
      `DELETE FROM issue_fix_versions WHERE issue_id = $1 AND release_id = $2`,
      [issueId, releaseResult.rows[0].id],
    );
  }

  // Remove dari TEXT[] array di tasks table
  await query(
    `
      UPDATE tasks
      SET fix_versions = array_remove(COALESCE(fix_versions, '{}'), $1)
      WHERE id = $2
    `,
    [versionName, issueId],
  );

  return { issue_id: Number(issueId), version_name: versionName, type: 'fix' };
};

// Menghapus version dari affects_versions issue (junction table + TEXT[] array).
const removeAffectsVersion = async (issueId, versionName) => {
  // Cari release berdasarkan nama
  const releaseResult = await query(
    `SELECT id FROM releases WHERE name = $1 LIMIT 1`,
    [versionName],
  );

  if (releaseResult.rows[0]) {
    await query(
      `DELETE FROM issue_affects_versions WHERE issue_id = $1 AND release_id = $2`,
      [issueId, releaseResult.rows[0].id],
    );
  }

  // Remove dari TEXT[] array di tasks table
  await query(
    `
      UPDATE tasks
      SET affects_versions = array_remove(COALESCE(affects_versions, '{}'), $1)
      WHERE id = $2
    `,
    [versionName, issueId],
  );

  return { issue_id: Number(issueId), version_name: versionName, type: 'affects' };
};

module.exports = {
  archiveVersion,
  assignAffectsVersion,
  assignFixVersion,
  createVersion,
  deleteVersion,
  getIssuesByVersion,
  getVersionById,
  getVersionProgress,
  getVersions,
  releaseVersion,
  removeAffectsVersion,
  removeFixVersion,
  updateVersion,
};
