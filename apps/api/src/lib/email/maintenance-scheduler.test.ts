import { afterEach,describe,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({open:vi.fn(),prune:vi.fn(async()=>({outboxRows:0,recoveryRows:0}))}));
vi.mock('../../db/index.js',()=>({openDb:mocks.open}));
vi.mock('./maintenance.js',()=>({pruneEmailData:mocks.prune}));
import handler,{config} from '../../../netlify/functions/email-maintenance.js';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();vi.restoreAllMocks();});
describe('periodic retention',()=>{
 it('has daily cron and remains inert until enabled',async()=>{vi.stubEnv('EMAIL_MAINTENANCE_ENABLED','false');expect(config.schedule).toBe('17 3 * * *');await handler();expect(mocks.open).not.toHaveBeenCalled();});
 it('runs maintenance only, never migrations or delivery, and closes connection',async()=>{vi.stubEnv('EMAIL_MAINTENANCE_ENABLED','true');vi.stubEnv('DATABASE_DIALECT','postgres');const close=vi.fn();mocks.open.mockResolvedValue({db:{close}});vi.spyOn(console,'info').mockImplementation(()=>{});await handler();expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({EMAIL_ENABLED:false,DB_AUTO_MIGRATE:false}),expect.any(Object));expect(mocks.prune).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();});
});
