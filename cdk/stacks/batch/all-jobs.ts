/* eslint-disable @typescript-eslint/no-var-requires */
import { readdirSync } from 'fs';
import BatchJobDef from './models/BatchJobDef';

const jobs: BatchJobDef[] = [];

readdirSync(__dirname + '/jobs/').forEach(function (file) {
  jobs.push(require('./jobs/' + file).default);
});

export default jobs;
