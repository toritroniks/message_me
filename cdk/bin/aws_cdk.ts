#!/usr/bin/env node
import 'source-map-support/register';
import { App as CdkApp } from 'aws-cdk-lib';
import configs, { EnvName } from '../lib/config';
import { Vpc } from '../stacks/vpc';
import { App } from '../stacks/app';
import { Batch } from '../stacks/batch';

const app = new CdkApp();

function buildEnvStacks(env: EnvName) {
  new Vpc(app, `Vpc-${env}`, configs[env]);
  new App(app, `App-${env}`, configs[env]);
  new Batch(app, `Batch-${env}`, configs[env]);
}

buildEnvStacks('dev');
buildEnvStacks('prd');
