process.env.DATABASE_URL ??=
  "postgresql://bugnote_app:test@localhost:5432/bugnote";
process.env.INGEST_ALLOWED_ORIGINS ??= "https://test.example";
process.env.GOOGLE_OAUTH_CLIENT_ID ??=
  "000000000000-ci000000000000000000000000.apps.googleusercontent.com";
process.env.ADMIN_ALLOWED_EMAILS ??= "ci@example.com";
