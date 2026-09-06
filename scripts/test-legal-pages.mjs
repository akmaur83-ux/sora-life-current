import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import { LEGAL_DEFAULTS } from '../src/lib/legalPageDefaults.js';
import { LEGAL_PAGES, legalKey, defaultLegalPage, normalizeLegalPage, validateLegalPage, hasLegalContent } from '../src/lib/legalPages.js';
const read = p => fs.readFileSync(new URL(p, import.meta.url),'utf8');
let passed=0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function component(file, name, deps={}) {
  const {code}=transformSync(read(file),{configFile:false,babelrc:false,presets:[['@babel/preset-react',{runtime:'classic'}]],plugins:[()=>({visitor:{
    ImportDeclaration(p){p.remove()}, ExportDefaultDeclaration(p){p.replaceWith(p.node.declaration)}, ExportNamedDeclaration(p){if(p.node.declaration)p.replaceWith(p.node.declaration);else p.remove()}
  }})]});
  const scope={React,...React,...deps};return new Function(...Object.keys(scope),code+';return '+name)(...Object.values(scope));
}
const Link=({to,children,...rest})=>React.createElement('a',{href:to,...rest},children);
const Panel=component('../src/components/creator/CreatorTermsPanel.jsx','CreatorTermsPanel');
const Content=component('../src/components/LegalPageContent.jsx','LegalPageContent',{Link,Icon:()=>null,CreatorTermsPanel:Panel,LEGAL_PAGES,hasLegalContent,telHref:p=>'tel:'+p.replace(/[^+0-9]/g,'')});
const render=(id,page)=>renderToStaticMarkup(React.createElement(Content,{id,page}));
test('five isolated settings keys; no shared write can erase another page',()=>{
  assert.equal(new Set(LEGAL_PAGES.map(p=>legalKey(p.id))).size,5);
  assert.deepEqual(LEGAL_PAGES.map(p=>p.id),['privacy','terms','returns','contact','grievance']);
});
test('existing policy sections and contact FAQ copy are seeded',()=>{
  for(const [id,headings] of Object.entries({privacy:['What an account stores','What an order records','Payments','On this device'],terms:['Prices and totals','Placing an order','Your account','Creator Program'],returns:['Raising a request','Order status']})) {
    for(const heading of headings) assert.ok(LEGAL_DEFAULTS[id].body.includes('# '+heading));
    assert.ok(render(id,defaultLegalPage(id)).includes(headings[0]));
  }
  assert.equal(LEGAL_DEFAULTS.contact.faqs.length,5);
});
test('legacy owner prose and confirmed business details survive seeding',()=>{
  const legacy={policies:{privacy:'Existing owner policy'},legalName:'Published business',email:'support@example.com',phone:'+91 98765 43210',address:'Published address',hours:'Published hours'};
  assert.ok(defaultLegalPage('privacy',legacy).body.includes('Existing owner policy'));
  const contact=defaultLegalPage('contact',legacy); for(const key of ['legalName','email','phone','address','hours']) assert.equal(contact[key],legacy[key]);
});
test('saved empty records never resurrect fallback text',()=>{
  for(const id of ['privacy','terms','returns','grievance']) {
    const page=normalizeLegalPage(id,{});assert.equal(hasLegalContent(id,page),false);
    const html=render(id,page);assert.match(html,/<h1/);assert.match(html,/Information for this page will be available soon/);
    assert.doesNotMatch(html,/What an account stores|Prices and totals|Order status/);
  }
  assert.equal(hasLegalContent('contact',normalizeLegalPage('contact',{})),false);
});
test('existing React markdown renderer handles headings and lists without executing HTML',()=>{
  const html=render('privacy',normalizeLegalPage('privacy',{body:'# Heading\n\n- One\n- Two\n\n1. First\n\n<script>alert(1)</script>'}));
  assert.match(html,/<ul/);assert.match(html,/<ol/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('structured links validate addresses and phones; all text remains escaped',()=>{
  const page=normalizeLegalPage('grievance',{officerName:'<img onerror=alert(1)>',officerEmail:'javascript:bad',officerPhone:'bad',address:'Line one\nLine two'});
  const html=render('grievance',page);assert.doesNotMatch(html,/href="(?:javascript|tel:bad)/);assert.match(html,/&lt;img/);
  assert.throws(()=>validateLegalPage('contact',{email:'bad'}),/valid support email/);
  assert.throws(()=>validateLegalPage('grievance',{officerPhone:'bad'}),/valid grievance officer phone/);
});
test('draft placeholders are blocked; markdown links are ordinary text',()=>{
  assert.throws(()=>validateLegalPage('privacy',{body:'Contact [SUPPORT EMAIL]'}),/square-bracket/);
  assert.throws(()=>validateLegalPage('grievance',{officerName:'[FULL NAME]'}),/square-bracket/);
  assert.equal(validateLegalPage('privacy',{body:'[Contact](/contact)'}).body,'[Contact](/contact)');
});
test('save serialization preserves body, fields and timestamp through readback/render',()=>{
  for(const id of ['privacy','terms','returns','contact','grievance']) {
    const form={...defaultLegalPage(id),body:'# Saved heading\n\nSaved content',intro:'Saved introduction',officerName:'QA officer'};
    const saved={...validateLegalPage(id,form),updated_at:'2026-09-06T09:00:00.000Z'};
    const readback=normalizeLegalPage(id,JSON.parse(JSON.stringify(saved)));
    assert.equal(readback.updated_at,saved.updated_at);
    if(id!=='contact') assert.ok(render(id,readback).includes(id==='grievance'?'QA officer':'Saved content'));
  }
});
test('SQL is idempotent, copies legacy data, and adds only a narrow read policy',()=>{
  const sql=read('../supabase/migrations/0027_legal_pages.sql');
  assert.match(sql,/on conflict\(key\) do nothing/i);assert.match(sql,/legacy->'policies'/);
  assert.match(sql,/for select to anon, authenticated/);assert.doesNotMatch(sql,/drop policy.*site_settings public read|alter table|creator_terms|create table|for (insert|update|delete)/i);
  for(const page of LEGAL_PAGES) assert.ok(sql.includes("'"+legalKey(page.id)+"'"));
});
test('public routes and footer links exist independently of protected admin routes',()=>{
  const app=read('../src/App.jsx');const publicRoutes=app.slice(app.indexOf('<Route element={<Layout />}>'));
  for(const page of LEGAL_PAGES) assert.ok(publicRoutes.includes('path="/'+page.id+'"'));
  const footer=read('../src/components/Footer.jsx');for(const page of LEGAL_PAGES)assert.ok(footer.includes('to="/'+page.id+'"'));
});
test('admin saves only the chosen record, reads it back and provides fresh-tab previews',()=>{
  const admin=read('../src/admin/pages/LegalPages.jsx');
  assert.match(admin,/adminSetSetting\(legalKey\(spec.id\), next\)/);assert.match(admin,/adminGetSetting\(legalKey\(spec.id\)\)/);
  assert.match(admin,/updated_at: new Date\(\).toISOString\(\)/);assert.match(admin,/target="_blank" rel="noopener noreferrer"/);
  assert.match(admin,/missing.includes\(spec.id\)/);
});
console.log('\n'+passed+' passed, 0 failed');
