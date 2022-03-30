import BatchRepo from '../enums/BatchRepo';

interface BatchJobDef {
  name: string;
  image: BatchRepo;
  imageTag?: string;
  vcpu: number;
  memory: number;
  retryAttempts: number;
  timeoutSeconds: number;
  command: string[];
  environment: {
    [key: string]: string;
  };
}

export default BatchJobDef;
