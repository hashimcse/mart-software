// The launcher starts this process without a console. Persist its output so
// startup and scheduled-backup failures can still be diagnosed.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const log = fs.createWriteStream(path.join(root, '.local', 'api.log'), {flags:'a'});
const errors = fs.createWriteStream(path.join(root, '.local', 'api-error.log'), {flags:'a'});
process.stdout.write = log.write.bind(log);
process.stderr.write = errors.write.bind(errors);
process.chdir(path.join(root, 'backend'));
require(path.join(root, 'backend', 'dist', 'server.js'));
