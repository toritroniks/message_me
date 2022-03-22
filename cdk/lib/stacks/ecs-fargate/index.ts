import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';
import * as efs from '@aws-cdk/aws-efs';
import * as iam from '@aws-cdk/aws-iam';
import { Config } from '../../config';

export class EcsFargate extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: Config) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcName: 'CdkVpc-dev/Vpc' });

    const ecsCluster = new ecs.Cluster(this, 'EcsCluster', {
      clusterName: 'CdkCluster',
      vpc: vpc,
    });

    const fileSystem = prepareEFS(this, vpc);

    const taskDef = prepareFargateTask(this, fileSystem);

    prepareECSContainer(this, taskDef);

    const albFargateService = prepareFargateService(this, ecsCluster, taskDef);

    // Allow access to EFS from Fargate ECS
    fileSystem.connections.allowDefaultPortFrom(albFargateService.service.connections);
  }
}

function prepareEFS(scope: cdk.Construct, vpc: ec2.IVpc) {
  return new efs.FileSystem(scope, 'MyEfsFileSystem', {
    fileSystemName: 'CdkEfs',
    vpc: vpc,
    encrypted: true,
    lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS,
    performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
    throughputMode: efs.ThroughputMode.BURSTING,
  });
}

function prepareFargateTask(scope: cdk.Construct, fileSystem: efs.FileSystem) {
  const taskRole = new iam.Role(scope, 'TaskRole', {
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    inlinePolicies: {
      TaskPolicies: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'ssmmessages:CreateControlChannel',
              'ssmmessages:CreateDataChannel',
              'ssmmessages:OpenControlChannel',
              'ssmmessages:OpenDataChannel',
            ],
            resources: ['*'],
          }),
        ],
      }),
    },
  });
  return new ecs.FargateTaskDefinition(scope, 'MyTaskDefinition', {
    memoryLimitMiB: 512,
    cpu: 256,
    taskRole: taskRole,
    volumes: [
      {
        name: 'efs',
        efsVolumeConfiguration: {
          fileSystemId: fileSystem.fileSystemId,
          transitEncryption: 'ENABLED',
        },
      },
    ],
  });
}

function prepareECSContainer(scope: cdk.Construct, taskDef: ecs.FargateTaskDefinition) {
  const containerDef = new ecs.ContainerDefinition(scope, 'MyContainerDefinition', {
    image: ecs.ContainerImage.fromRegistry('coderaiser/cloudcmd'),
    taskDefinition: taskDef,
    portMappings: [{ containerPort: 8000 }],
    readonlyRootFilesystem: false,
  });

  containerDef.addMountPoints({
    sourceVolume: 'efs',
    containerPath: '/data',
    readOnly: false,
  });
}

function prepareFargateService(
  scope: cdk.Construct,
  ecsCluster: ecs.Cluster,
  taskDef: ecs.FargateTaskDefinition
) {
  const albFargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
    scope,
    'Service01',
    {
      cluster: ecsCluster,
      taskDefinition: taskDef,
      desiredCount: 2,
      assignPublicIp: true,
    }
  );

  albFargateService.targetGroup.setAttribute(
    'deregistration_delay.timeout_seconds',
    '30'
  );

  // Override Platform version (until Latest = 1.4.0)
  const albFargateServiceResource = albFargateService.service.node.findChild(
    'Service'
  ) as ecs.CfnService;
  albFargateServiceResource.addPropertyOverride('PlatformVersion', '1.4.0');
  albFargateServiceResource.enableExecuteCommand = true;
  return albFargateService;
}
