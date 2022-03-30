import { StackProps, Environment } from 'aws-cdk-lib';
import configDev from './configDev';
import configPrd from './configPrd';

export interface Config extends StackProps {
  readonly env: Environment;
  readonly envName: EnvName;
  readonly azCount: number;
}

export type EnvName = 'dev' | 'prd';

const configs: { [k in EnvName]: Config } = {
  dev: configDev,
  prd: configPrd,
};

export default configs;

export { constants } from './constants';
