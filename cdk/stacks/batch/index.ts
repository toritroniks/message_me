import { Construct } from 'constructs';
import * as aBatch from '@aws-cdk/aws-batch-alpha';
import {
  Stack,
  Duration,
  aws_batch as batch,
  aws_ecs as ecs,
  aws_ecr as ecr,
  aws_iam as iam,
  aws_ec2 as ec2,
  aws_secretsmanager as secretsmanager,
} from 'aws-cdk-lib';
import camelcase from 'camelcase';
import { Config, constants } from '../../lib/config';
import jobs from './all-jobs';
import BatchRepo from './enums/BatchRepo';
import BatchJobDef from './models/BatchJobDef';

export class Batch extends Stack {
  constructor(scope: Construct, id: string, props: Config) {
    super(scope, id, props);
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', {
      vpcName: `${constants.projectName}-${props.envName}-vpc`,
    });
    const batchSecurityGroup = this.prepareBatchSecurityGroup(props, vpc);
    const computeEnvironment = this.prepareComputeEnvironment(
      props,
      vpc,
      batchSecurityGroup
    );
    this.prepareJobQueue(props, computeEnvironment);
    this.prepareJobDefinitions(props, jobs);
  }

  private prepareBatchSecurityGroup(props: Config, vpc: ec2.IVpc) {
    const dbSg = ec2.SecurityGroup.fromLookupByName(
      this,
      'RdsSG',
      `${constants.projectName}-${props.envName}-db-sg`,
      vpc
    );
    const batchSecurityGroup = new ec2.SecurityGroup(this, 'BatchSG', {
      securityGroupName: `${constants.projectName}-${props.envName}-batch-sg`,
      vpc,
    });
    dbSg.connections.allowFrom(batchSecurityGroup, ec2.Port.tcp(3306));
    return batchSecurityGroup;
  }

  private prepareComputeEnvironment(
    props: Config,
    vpc: ec2.IVpc,
    sg: ec2.ISecurityGroup
  ) {
    return new aBatch.ComputeEnvironment(this, 'BatchComputeEnvironment', {
      computeEnvironmentName: this.computeEnvironmentName(props),
      computeResources: {
        type: aBatch.ComputeResourceType.FARGATE_SPOT,
        vpc,
        maxvCpus: 10,
        securityGroups: [sg],
      },
    });
  }

  private prepareJobQueue(props: Config, computeEnvironment: aBatch.IComputeEnvironment) {
    return new aBatch.JobQueue(this, 'JobQueue', {
      jobQueueName: `${constants.projectName}-${props.envName}-queue`,
      computeEnvironments: [
        {
          computeEnvironment,
          order: 1,
        },
      ],
    });
  }

  // eslint-disable-next-line max-lines-per-function
  private prepareJobDefinitions(props: Config, jobs: BatchJobDef[]) {
    const dbSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'DbSecret',
      `${constants.projectName}/${props.envName}/db`
    );
    const masterKeySecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'MasterKeySecret',
      `${constants.projectName}/${props.envName}/master_key`
    );
    const repos = this.getRepos();
    const execRole = this.createExecutionRole(props, Object.values(repos));
    jobs.forEach(job => {
      const jobDef = new aBatch.JobDefinition(
        this,
        `Batch${camelcase(job.name, { pascalCase: true })}`,
        {
          jobDefinitionName: `${constants.projectName}-${props.envName}-${job.name}`,
          platformCapabilities: [aBatch.PlatformCapabilities.FARGATE],
          retryAttempts: job.retryAttempts,
          timeout: Duration.seconds(job.timeoutSeconds),
          container: {
            image: new ecs.EcrImage(repos[job.image], job.imageTag ?? 'latest'),
            vcpus: job.vcpu,
            memoryLimitMiB: job.memory,
            command: job.command,
            executionRole: execRole,
            environment: job.environment,
          },
        }
      );
      const cfnJobDef = jobDef.node.defaultChild as batch.CfnJobDefinition;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cfnJobDef.containerProperties as any).secrets = [
        // cast to any needed because .secrets property is readonly
        { name: 'MYSQL_HOST', valueFrom: `${dbSecret.secretArn}:host::` },
        { name: 'MYSQL_PASSWORD', valueFrom: `${dbSecret.secretArn}:password::` },
        { name: 'MYSQL_PORT', valueFrom: `${dbSecret.secretArn}:port::` },
        { name: 'RAILS_MASTER_KEY', valueFrom: `${masterKeySecret.secretArn}` },
      ];
    });
  }

  // eslint-disable-next-line max-lines-per-function
  private createExecutionRole(props: Config, repos: ecr.IRepository[]) {
    return new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        TaskPolicies: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
              ],
              resources: repos.map(repo => repo.repositoryArn),
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ecr:GetAuthorizationToken'],
              resources: ['*'],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
              resources: [
                `arn:aws:secretsmanager:${props.env.region}:${props.env.account}:secret:${constants.projectName}/${props.envName}/*`,
              ],
            }),
          ],
        }),
      },
    });
  }

  private getRepos() {
    const repos: { [key: string]: ecr.IRepository } = {};
    for (const repoItem in BatchRepo) {
      const repoName = (BatchRepo as { [key: string]: string })[repoItem];
      repos[repoName] = ecr.Repository.fromRepositoryName(
        this,
        `${camelcase(repoName, { pascalCase: true })}Repo`,
        repoName
      );
    }
    return repos as { [key in BatchRepo]: ecr.IRepository };
  }

  private computeEnvironmentName(props: Config) {
    return `${constants.projectName}-${props.envName}-batch`;
  }
}
