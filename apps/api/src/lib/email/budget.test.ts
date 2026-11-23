import { describe,expect,it } from 'vitest';
import { SqliteClient } from '../../db/sqlite-client.js';
import { openDatabase,migrate } from '../../db/database.js';
import { reserveSendBudget } from './budget.js';
const at = new Date('2026-11-23T12:00:00Z');
function fixture() {const raw=openDatabase(':memory:');migrate(raw);return new SqliteClient(raw);}
describe('persistent email attempt allocation',()=>{
  it('fails closed without an explicit positive budget',async()=>{const db=fixture();try{expect(await reserveSendBudget(db,0,0,at)).toBe(false);expect(await reserveSendBudget(db,101,3000,at)).toBe(false);}finally{await db.close();}});
  it('serializes concurrent reservations and counts attempts conservatively',async()=>{const db=fixture();try{const r=await Promise.all(Array.from({length:8},()=>reserveSendBudget(db,2,3,at)));expect(r.filter(Boolean)).toHaveLength(2);expect(await reserveSendBudget(db,2,3,new Date('2026-11-24T00:00:00Z'))).toBe(true);expect(await reserveSendBudget(db,2,3,new Date('2026-11-25T00:00:00Z'))).toBe(false);expect(await reserveSendBudget(db,2,3,new Date('2026-12-01T00:00:00Z'))).toBe(true);}finally{await db.close();}});
});
