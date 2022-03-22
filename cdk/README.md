# AWS CDK + TypeScript Sample Project

This is a sample project where you can deploy a simple VPC and a Fargate app with EFS as Storage.

This project is designed so you can configure and deploy stacks for each environment individually.

※ Deploying this project might result in some AWS Servece costs. You can use the destroy command to delete all deployed services.

## Useful commands

 * `npm run build`          compile typescript to js
 * `npm run watch`          watch for changes and compile
 * `cdk deploy CdkVpc-dev`  deploy the vpc stack to your AWS account
 * `cdk diff CdkVpc-dev`    compare deployed stack with current state
 * `cdk synth CdkVpc-dev`   emits the synthesized CloudFormation template

※ Check the `aws_cdk.ts` for all stacks that can be deployed.
