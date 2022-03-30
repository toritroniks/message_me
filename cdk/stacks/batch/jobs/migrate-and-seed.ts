import { basename } from 'path';
import BatchJobDef from '../models/BatchJobDef';
import BatchRepo from '../enums/BatchRepo';

const jobDef: BatchJobDef = {
  name: basename(__filename, '.ts'),
  image: BatchRepo.RAILS_BATCH,
  vcpu: 1,
  memory: 2048,
  retryAttempts: 1,
  timeoutSeconds: 300,
  command: ['rails', 'db:migrate', 'db:seed'],
  environment: {
    RAILS_ENV: 'production',
  },
};

export default jobDef;
