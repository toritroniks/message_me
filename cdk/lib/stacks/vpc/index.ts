import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import { Config } from '../../config';

export class Vpc extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: Config) {
    super(scope, id, props);

    new ec2.Vpc(this, 'Vpc', {
      maxAzs: props.azCount,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });
  }
}
