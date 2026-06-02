-- BugNote isolated database + role on the shared Emma Postgres engine.
-- Run as the postgres superuser.

CREATE ROLE bugnote_app WITH LOGIN PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';

CREATE DATABASE bugnote OWNER bugnote_app;

-- Isolation hardening: ensure the BugNote role cannot reach ResearchOne's db.
-- The role is never GRANTed anything on researchone; this is belt-and-suspenders.
REVOKE ALL ON DATABASE researchone FROM bugnote_app;

-- Optional, stronger (touches researchone grants — do deliberately):
-- REVOKE CONNECT ON DATABASE researchone FROM PUBLIC;
-- GRANT  CONNECT ON DATABASE researchone TO <your_researchone_role>;

-- Application tables are created by drizzle migrations run AS bugnote_app
-- against the bugnote database. No extensions required.
