import test from 'node:test';
import assert from 'node:assert/strict';
import {readStored} from '../src/lib/storage.js';
import {routeFromLocation} from '../src/lib/navigation.js';

test('persisted data validates both JSON syntax and shape',()=>{
  for (const value of ['{}','null','invalid','42']) assert.deepEqual(readStored('activity',[],Array.isArray,{getItem:()=>value}),[]);
  assert.deepEqual(readStored('activity',[],Array.isArray,{getItem:()=>'[{"id":"one"}]'}),[{id:'one'}]);
  assert.equal(readStored('step',3,value=>[0,2,3].includes(value),{getItem:()=> '99'}),3);
});
test('new page paths and legacy links resolve without treating anchors as routes',()=>{
  assert.equal(routeFromLocation({pathname:'/builder',hash:''}),'builder');
  assert.equal(routeFromLocation({pathname:'/',hash:'#/jobs'}),'jobs');
  assert.equal(routeFromLocation({pathname:'/builder',hash:'#main-content'}),'builder');
});
