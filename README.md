# Mart Software

Supermarket POS and store management application with sales, inventory, purchasing, customers, returns, cash shifts, reports, staff permissions, and database backup/restore.

The current application lives in [supermarket-pos](supermarket-pos). See its [setup guide](supermarket-pos/README.md), [deployment guide](supermarket-pos/docs/DEPLOYMENT.md), and [verification report](supermarket-pos/docs/VERIFICATION.md).

## Windows launch

Download/extract or clone the complete repository, then double-click `supermarket-pos/Supermarket POS.exe`. It starts a local database and opens the application in your browser. Node.js 22.12+ with npm and PostgreSQL 14+ are required; first setup needs internet access. Launcher source and build instructions are in [launcher](supermarket-pos/launcher).

This repository contains application source, migrations, tests, and the launcher. Live store data, credentials, backups, uploaded images, installed dependencies, and bundled runtimes are excluded. Keep separate backups of store data.

The phase 7 ZIP at the repository root is a historical archive; use the `supermarket-pos` folder for the current version.
