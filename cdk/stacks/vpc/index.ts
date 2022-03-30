import { Construct } from 'constructs';
import { Stack, Tags, aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Config, constants } from '../../lib/config';

export class Vpc extends Stack {
  constructor(scope: Construct, id: string, props: Config) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: props.azCount,
    });

    Tags.of(vpc).add('Name', `${constants.projectName}-${props.envName}-vpc`);
  }
}
