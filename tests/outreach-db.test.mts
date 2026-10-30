import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { addContact, addContactCapped, getContact, listContacts, updateContact, deleteContact, normalizeProfileUrl, createExtensionToken, revokeExtensionToken, recordAISpend } from "../lib/outreach/contacts-db";
import { deleteAll, exportAll, type Db } from "../lib/db";

async function fresh() {
 const pg=new PGlite();
 await pg.exec(`create table "user" (id text primary key); insert into "user" values ('a'),('b');`);
 await pg.exec(readFileSync(new URL('../scripts/migrations/001_vertical1.sql',import.meta.url),'utf8'));
 await pg.exec(readFileSync(new URL('../scripts/migrations/002_outreach.sql',import.meta.url),'utf8'));
 const db: Db={query:async <R=Record<string,unknown>,>(sql:string,params?:unknown[])=>({rows:(await pg.query(sql,params)).rows as R[]})};
 return {pg,db};
}
const input={name:'Alice',bridge:'public_work',goal:'job',intent:'learn_role',tier:'tier_1'} as const;
test('migration 002 can be applied twice',async()=>{const {pg}=await fresh(); await pg.exec(readFileSync(new URL('../scripts/migrations/002_outreach.sql',import.meta.url),'utf8')); await pg.close();});
test('contacts are user scoped, editable and deletable',async()=>{const {pg,db}=await fresh(); const a=await addContact(db,'a',{...input,profileUrl:'https://www.linkedin.com/in/Alice?utm_source=x'}); assert.equal(a.profileUrl,'https://www.linkedin.com/in/alice/'); assert.equal(a.status,'to_contact'); assert.equal(await getContact(db,'b',a.id),null); assert.equal(await updateContact(db,'b',a.id,{name:'wrong'}),null); assert.equal(await deleteContact(db,'b',a.id),false); assert.equal((await listContacts(db,'a')).length,1); assert.equal((await updateContact(db,'a',a.id,{name:'Alice B',noteUsed:true}))?.name,'Alice B'); assert.equal(await deleteContact(db,'a',a.id),true); await pg.close();});
test('only LinkedIn profile URLs are accepted',()=>{assert.throws(()=>normalizeProfileUrl('https://evil.com/in/alice')); assert.throws(()=>normalizeProfileUrl('https://www.linkedin.com/feed/')); assert.throws(()=>normalizeProfileUrl('http://www.linkedin.com/in/alice'));});
test('extension tokens are hashed, scoped, revocable and never exported',async()=>{const {pg,db}=await fresh(); const t=await createExtensionToken(db,'a','secret-123'); const r=await pg.query<{token_hash:string}>('select token_hash from ext_tokens where id=$1',[t.id]); assert.notEqual(r.rows[0].token_hash,'secret-123'); assert.equal((r.rows[0].token_hash).length,64); assert.equal(await revokeExtensionToken(db,'b',t.id),null); assert.ok((await revokeExtensionToken(db,'a',t.id))?.revokedAt); const data=await exportAll(db,'a'); assert.equal(JSON.stringify(data).includes(r.rows[0].token_hash),false); await pg.close();});
test('delete removes outreach records without touching another user',async()=>{const {pg,db}=await fresh(); await addContact(db,'a',input); await addContact(db,'b',input); await createExtensionToken(db,'a','random'); await deleteAll(db,'a'); assert.equal((await listContacts(db,'a')).length,0); assert.equal((await listContacts(db,'b')).length,1); await pg.close();});
test('daily outreach cap is durable and scoped',async()=>{const {pg,db}=await fresh(); for(let i=0;i<60;i++) assert.equal(await recordAISpend(db,'a'),true); assert.equal(await recordAISpend(db,'a'),false); assert.equal(await recordAISpend(db,'b'),true); await pg.close();});


test('monthly contact quota is atomic, survives deletion, resets next month and is user scoped', async () => {
 const {pg,db}=await fresh();
 await pg.query("insert into lynkr_user_outreach (user_id,monthly_new_contacts_limit) values ('a',5)");
 const results=await Promise.all(Array.from({length:12},()=>addContactCapped(db,'a',input)));
 const accepted=results.filter(x=>x!==null);
 assert.equal(accepted.length,5);
 assert.equal((await listContacts(db,'a')).length,5);
 await deleteContact(db,'a',accepted[0]!.id);
 assert.equal(await addContactCapped(db,'a',input),null);
 assert.ok(await addContactCapped(db,'b',input));
 await pg.query("update lynkr_user_outreach set contacts_count_month=contacts_count_month - interval '1 month' where user_id='a'");
 assert.ok(await addContactCapped(db,'a',input));
 const quota=await pg.query<{n:number}>("select last_monthly_contacts_count as n from lynkr_user_outreach where user_id='a'");
 assert.equal(quota.rows[0].n,1);
 await pg.close();
});
test('failed contact insertion does not spend quota', async () => {
 const {pg,db}=await fresh();
 await assert.rejects(()=>addContactCapped(db,'a',{...input,name:'Alice',bridge:'invalid' as typeof input.bridge}));
 assert.equal((await pg.query("select * from lynkr_user_outreach where user_id='a'")).rows.length,0);
 await pg.close();
});
