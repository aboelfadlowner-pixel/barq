// نجم أبو الفضل — أدوات مشتركة للاختبارات (متصفح، قاعدة بيانات محلية، نتايج)
const path = require('path');
const { chromium } = require('playwright');

const APP = 'file://' + path.resolve(__dirname, '../index.html');
const SB = 'https://ojvbydnvywbsgyhqftap.supabase.co/**';
const DB_URL = process.env.NAJM_TEST_DB || 'postgres://postgres:pw@127.0.0.1:5432/postgres';

// ---- tiny test runner: test(name, fn) … then run()
const T = [];
const test = (name, fn) => T.push({ name, fn });
async function run(title) {
  let fail = 0;
  console.log(`\n▶ ${title}`);
  for (const t of T) {
    try { await t.fn(); console.log(`  ✔ ${t.name}`); }
    catch (e) { fail++; console.log(`  ✖ ${t.name}\n      ${String(e.message || e).split('\n')[0]}`); }
  }
  console.log(fail ? `  ${fail} failed` : '  all passed');
  process.exitCode = fail ? 1 : 0;
  return fail;
}
const eq = (a, b, msg = '') => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error(`${msg} expected ${B} got ${A}`); };
const ok = (v, msg = 'expected true') => { if (!v) throw new Error(msg); };

// ---- browser: the app from disk; Supabase blocked (demo) or answered by a local database (integration)
async function browser() { return chromium.launch(); }
async function openApp(b, { query = '?demo=1', supabase = null, viewport = { width: 1280, height: 900 } } = {}) {
  const ctx = await b.newContext({ viewport });
  const errors = [];
  await ctx.route('**/xlsx.full.min.js', r => r.fulfill({ path: require.resolve('xlsx/dist/xlsx.full.min.js'), contentType: 'application/javascript' }));
  await ctx.route('https://fonts.googleapis.com/**', r => r.abort());
  await ctx.route(SB, supabase || (r => r.abort()));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(APP + query);
  await page.waitForTimeout(2000);
  await page.evaluate(() => typeof closeModal === 'function' && closeModal());
  page.errors = errors;
  return page;
}

// ---- local Postgres built from db/ (same order as production)
const DB_FILES = [
  ...require('fs').readdirSync(path.resolve(__dirname, '../db/migrations')).filter(f => f.endsWith('.sql')).sort().map(f => 'migrations/' + f),
  'functions/auth.sql', 'functions/close.sql', 'functions/employees.sql', 'functions/scoring.sql', 'functions/save.sql',
  'functions/league.sql', 'functions/votes.sql', 'functions/payouts.sql',
  'policies/rls.sql', 'policies/storage.sql',
  'seed/defaults.sql',
].map(f => path.resolve(__dirname, '../db', f));
const SUPABASE_STUB = `
do $$ begin create role anon; exception when others then null; end $$;
do $$ begin create role authenticated; exception when others then null; end $$;
create schema if not exists storage;
create table if not exists storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects(id serial, bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema public to anon, authenticated;`;
async function freshDb(name, { employees = false } = {}) {
  const { Client } = require('pg');
  const fs = require('fs');
  const admin = new Client({ connectionString: DB_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${name}`);
  await admin.query(`create database ${name}`);
  await admin.end();
  const db = new Client({ connectionString: DB_URL.replace(/\/[^/]*$/, '/' + name) });
  await db.connect();
  await db.query(SUPABASE_STUB);
  for (const f of DB_FILES) await db.query(fs.readFileSync(f, 'utf8'));
  if (employees) await db.query(fs.readFileSync(path.resolve(__dirname, '../db/seed/employees.sql'), 'utf8'));
  // Supabase gives anon read access to tables by default; RLS decides what is visible
  await db.query('grant select on all tables in schema public to anon, authenticated');
  return db;
}
// run SQL as the public (anon) role, like the browser does through Supabase
async function asAnon(db, sql, params) {
  await db.query('begin');
  try { await db.query('set local role anon'); const r = await db.query(sql, params); await db.query('commit'); return r.rows; }
  catch (e) { await db.query('rollback'); throw e; }
}
const today = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10); // Africa/Cairo

module.exports = { test, run, eq, ok, browser, openApp, freshDb, asAnon, today, APP };
