import { Construct } from 'constructs';
import { Stack, aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Config, constants } from '../../lib/config';

export class Vpc extends Stack {
  constructor(scope: Construct, id: string, props: Config) {
    super(scope, id, props);

    new ec2.Vpc(this, 'Vpc', {
      vpcName: `${constants.projectName}-${props.envName}-vpc`,
      maxAzs: props.azCount,
    });
  }
}
