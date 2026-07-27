#!/usr/bin/env node
'use strict';

const { launchNodeServer } = require('./server/node-launcher');

if (require.main === module) launchNodeServer();

module.exports = { launchNodeServer };
