#!/usr/bin/env node

import { runCli } from './router';

const result = runCli(process.argv.slice(2));
process.exitCode = result.exitCode;
