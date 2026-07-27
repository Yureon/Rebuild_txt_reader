const fs = require('fs');
const path = require('path');

const APP_SHELL_SPLIT_CHECK_PASS = 'v569-app-shell-split-check-pass';

function readAppShellSource(root) {
  const projectRoot = root || path.join(__dirname, '..', '..');
  return [
    path.join(projectRoot, 'public/fragments/app-shell.html'),
    path.join(projectRoot, 'public/fragments/deferred-ui.html')
  ].map(file => fs.readFileSync(file, 'utf8')).join('\n');
}

function readAppStylesSource(root) {
  const projectRoot = root || path.join(__dirname, '..', '..');
  return [
    path.join(projectRoot, 'public/styles/app.css'),
    path.join(projectRoot, 'public/styles/deferred-ui.css')
  ].map(file => fs.readFileSync(file, 'utf8')).join('\n');
}

module.exports = { readAppShellSource, readAppStylesSource, APP_SHELL_SPLIT_CHECK_PASS };
