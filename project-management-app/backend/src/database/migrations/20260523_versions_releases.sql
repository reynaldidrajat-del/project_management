-- Migration: Versions/Releases Tables
-- Creates releases table and junction tables for issue version tracking
-- Requirements: 11.1, 11.2

-- ============================================================================
-- RELEASES TABLE
-- Stores version/release information for projects
-- ============================================================================
CREATE TABLE IF NOT EXISTS releases (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  start_date DATE,
  release_date DATE,
  status VARCHAR(30) DEFAULT 'unreleased' CHECK (status IN ('unreleased', 'released', 'archived')),
  released_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for releases table
CREATE INDEX IF NOT EXISTS idx_releases_project_id ON releases(project_id);
CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status);
CREATE INDEX IF NOT EXISTS idx_releases_release_date ON releases(release_date);

-- Unique constraint: release names must be unique per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_releases_unique_name ON releases(project_id, name);

-- ============================================================================
-- ISSUE FIX VERSIONS JUNCTION TABLE
-- Links issues to their fix versions (versions in which the issue is fixed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS issue_fix_versions (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  release_id INTEGER NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT issue_fix_versions_unique UNIQUE (issue_id, release_id)
);

-- Indexes for issue_fix_versions
CREATE INDEX IF NOT EXISTS idx_issue_fix_versions_issue_id ON issue_fix_versions(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_fix_versions_release_id ON issue_fix_versions(release_id);

-- ============================================================================
-- ISSUE AFFECTS VERSIONS JUNCTION TABLE
-- Links issues to versions they affect (versions where the bug/issue exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS issue_affects_versions (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  release_id INTEGER NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT issue_affects_versions_unique UNIQUE (issue_id, release_id)
);

-- Indexes for issue_affects_versions
CREATE INDEX IF NOT EXISTS idx_issue_affects_versions_issue_id ON issue_affects_versions(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_affects_versions_release_id ON issue_affects_versions(release_id);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATED_AT
-- ============================================================================
DO $$
BEGIN
  -- Create trigger for releases table
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_releases_updated_at'
  ) THEN
    CREATE TRIGGER trg_releases_updated_at
      BEFORE UPDATE ON releases
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;
