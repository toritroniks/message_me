import { Construct } from 'constructs';
import {
  Stack,
  Duration,
  RemovalPolicy,
  aws_rds as rds,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_ecr as ecr,
  aws_elasticache as elasticache,
  aws_secretsmanager as secretsmanager,
  aws_ecs_patterns as ecs_patterns,
} from 'aws-cdk-lib';
import { Config, constants } from '../../lib/config';

export class App extends Stack {
  constructor(scope: Construct, id: string, props: Config) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', {
      vpcName: `${constants.projectName}-${props.envName}-vpc`,
    });

    const dbSecret = this.prepareDbSecret(props);

    const servicePattern = this.prepareEcs(props, vpc, dbSecret);

    this.prepareRds(props, vpc, dbSecret, [
      servicePattern.service.connections.securityGroups[0],
    ]);

    this.prepareRedis(props, vpc, [servicePattern.service.connections.securityGroups[0]]);
  }

  private prepareDbSecret(props: Config) {
    return new secretsmanager.Secret(this, `AppDBSecret`, {
      secretName: `${constants.projectName}/${props.envName}/db`,
      description: `CDK generated DB secret`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'message_me',
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 16,
      },
    });
  }

  private prepareEcs(props: Config, vpc: ec2.IVpc, dbSecret: secretsmanager.ISecret) {
    const containerDef = this.prepareContainer(props, dbSecret);
    const servicePattern = this.prepareService(containerDef.taskDefinition, vpc, props);
    return servicePattern;
  }

  private prepareContainer(props: Config, dbSecret: secretsmanager.ISecret) {
    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef');
    const containerDef = new ecs.ContainerDefinition(this, 'AppContainerDef', {
      containerName: 'message_me',
      image: ecs.ContainerImage.fromEcrRepository(
        ecr.Repository.fromRepositoryName(this, 'AppRepo', 'message_me')
      ),
      secrets: {
        MYSQL_HOST: ecs.Secret.fromSecretsManager(dbSecret, 'host'),
        MYSQL_PORT: ecs.Secret.fromSecretsManager(dbSecret, 'port'),
        MYSQL_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        RAILS_MASTER_KEY: ecs.Secret.fromSecretsManager(
          secretsmanager.Secret.fromSecretNameV2(
            this,
            'RailsMasterKeySecret',
            `${constants.projectName}/${props.envName}/master_key`
          )
        ),
      },
      environment: {
        RAILS_ENV: 'production',
        RAILS_SERVE_STATIC_FILES: 'true',
        REDIS_URL: `redis://${constants.projectName}-${props.envName}-redis.ogbste.0001.use2.cache.amazonaws.com:6379`,
      },
      portMappings: [{ containerPort: 3000 }],
      taskDefinition: taskDef,
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: constants.projectName,
      }),
    });
    return containerDef;
  }

  private prepareService(
    taskDef: ecs.FargateTaskDefinition,
    vpc: ec2.IVpc,
    props: Config
  ) {
    const ecsCluster = new ecs.Cluster(this, 'MessageMeCluster', {
      clusterName: `${constants.projectName}-${props.envName}-cluster`,
      vpc: vpc,
    });

    const albFargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      'MessageMeService',
      {
        serviceName: `${constants.projectName}-${props.envName}-service`,
        cluster: ecsCluster,
        taskDefinition: taskDef,
        desiredCount: 2,
        healthCheckGracePeriod: Duration.seconds(180),
      }
    );
    albFargateService.targetGroup.configureHealthCheck({ path: '/login' });
    return albFargateService;
  }

  private prepareRds(
    props: Config,
    vpc: ec2.IVpc,
    dbSecret: secretsmanager.ISecret,
    allowedSGs: ec2.ISecurityGroup[]
  ) {
    const db = new rds.ServerlessCluster(this, 'AppDB', {
      vpc,
      clusterIdentifier: `${constants.projectName}-${props.envName}`,
      defaultDatabaseName: constants.dbName,
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_2_07_1,
      }),
      enableDataApi: true,
      scaling: {
        minCapacity: rds.AuroraCapacityUnit.ACU_1,
        maxCapacity: rds.AuroraCapacityUnit.ACU_16,
      },
      removalPolicy: RemovalPolicy.DESTROY,
      credentials: rds.Credentials.fromSecret(dbSecret),
      securityGroups: [
        new ec2.SecurityGroup(this, 'RdsSG', {
          securityGroupName: `${constants.projectName}-${props.envName}-db-sg`,
          vpc,
        }),
      ],
    });

    // allow access to the RDS from the allowedSGs
    allowedSGs.forEach(sg => {
      db.connections.allowFrom(sg, ec2.Port.tcp(3306));
    });
  }

  private prepareRedis(props: Config, vpc: ec2.IVpc, allowedSGs: ec2.ISecurityGroup[]) {
    // Redis Security Group setting
    const redisSg = new ec2.SecurityGroup(this, 'RedisSG', {
      securityGroupName: `${constants.projectName}-${props.envName}-redis-sg`,
      vpc,
    });
    // allow access to the Redis from the allowedSGs
    allowedSGs.forEach(sg => {
      redisSg.connections.allowFrom(sg, ec2.Port.tcp(6379));
    });

    // Private Subnet Group for the Redis cluster
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      cacheSubnetGroupName: `${constants.projectName}-${props.envName}-private-subnets`,
      description: 'Private Subnets',
      subnetIds: vpc.privateSubnets.map(s => s.subnetId),
    });

    // Redis Cluster
    const redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      clusterName: `${constants.projectName}-${props.envName}-redis`,
      engine: 'redis',
      cacheNodeType: 'cache.m5.large',
      numCacheNodes: 1,
      cacheSubnetGroupName: subnetGroup.ref,
      vpcSecurityGroupIds: [redisSg.securityGroupId],
    });
    return redisCluster;
  }
}
