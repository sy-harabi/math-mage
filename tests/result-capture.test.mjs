import test from 'node:test';
import assert from 'node:assert/strict';
import { createResultCapture, resultCaptureFilename, downloadResultCapture } from '../src/result-capture.js';

function captureMock({encode=true,clickError=false}={}) {
  const calls=[],links=[],revoked=[];
  const context=new Proxy({}, {get:(target,key)=>target[key]??((...args)=>calls.push([key,...args]))});
  const canvas={getContext:()=>context,toBlob(callback,type){calls.push(['toBlob',type]);callback(encode?new Blob(['png'],{type}):null);}};
  const doc={body:{append(link){calls.push(['append',link]);}},createElement(tag){
    if(tag==='canvas')return canvas;
    const link={click(){calls.push(['click',this.download,this.href]);if(clickError)throw Error('download blocked');},remove(){calls.push(['remove']);}};
    links.push(link);return link;
  }};
  const urlAPI={createObjectURL(blob){assert.equal(blob.type,'image/png');return 'blob:result-test';},revokeObjectURL(url){revoked.push(url);}};
  return {canvas,doc,urlAPI,calls,links,revoked};
}

test('both end states capture the final arena, exact time, kills and level without mutating the source',()=>{
  const scene={width:960,height:600};
  for(const outcome of ['victory','death']){
    const result={outcome,elapsedSeconds:83.45,kills:37,level:8},snapshot=structuredClone(result);
    const mock=captureMock(),canvas=createResultCapture(scene,result,()=>mock.canvas);
    assert.deepEqual([canvas.width,canvas.height],[960,600]);
    assert.deepEqual(mock.calls[0],['drawImage',scene,0,0]);
    const labels=mock.calls.filter(call=>call[0]==='fillText').map(call=>call[1]);
    assert.ok(labels.includes('01:23.45'));assert.ok(labels.includes('처치 37마리 · 캐릭터 Lv8'));
    assert.ok(labels.includes(outcome==='victory'?'슬라임 군주 격파!':'GAME OVER'));
    assert.ok(labels.includes('아브라칼큘러스!'));
    assert.deepEqual(result,snapshot);assert.deepEqual(scene,{width:960,height:600});
  }
});

test('PNG download uses the result filename and cleans up its link and URL',async()=>{
  for(const outcome of ['victory','death']){
    const mock=captureMock(),result={outcome,elapsedSeconds:83.45,kills:37,level:8};
    await downloadResultCapture({width:960,height:600},result,mock.doc,mock.urlAPI);
    assert.deepEqual(mock.calls.find(call=>call[0]==='toBlob'),['toBlob','image/png']);
    assert.equal(mock.links[0].download,`abracalculus-${outcome==='victory'?'clear':'game-over'}-01m23s45.png`);
    assert.equal(mock.links[0].href,'blob:result-test');assert.ok(mock.calls.some(call=>call[0]==='remove'));
    await new Promise(resolve=>setTimeout(resolve,1050));
    assert.deepEqual(mock.revoked,['blob:result-test']);
  }
});

test('failed PNG encoding creates no download, and a blocked click still cleans up',async()=>{
  const result={outcome:'death',elapsedSeconds:0,kills:0,level:1},scene={width:960,height:600};
  const failed=captureMock({encode:false});
  await assert.rejects(downloadResultCapture(scene,result,failed.doc,failed.urlAPI),/PNG/);
  assert.equal(failed.links.length,0);
  const blocked=captureMock({clickError:true});
  await assert.rejects(downloadResultCapture(scene,result,blocked.doc,blocked.urlAPI),/download blocked/);
  assert.ok(blocked.calls.some(call=>call[0]==='remove'));
  await new Promise(resolve=>setTimeout(resolve,1050));assert.deepEqual(blocked.revoked,['blob:result-test']);
  assert.equal(resultCaptureFilename(result),'abracalculus-game-over-00m00s00.png');
});
