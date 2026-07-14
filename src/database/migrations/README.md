# Database migrations

Incremental production migrations will live here from Phase 2 onward. Use ordered names such as `002_create_auth_indexes.sql`; never edit an already-applied migration. The canonical bootstrap schema for a new Phase 1 database is `../schema.sql`, followed by the scripts in `../seeds/`.

Every migration must be reviewed for lock duration, rollback strategy, foreign-key ordering, and compatibility with MySQL 8.0 before deployment.
