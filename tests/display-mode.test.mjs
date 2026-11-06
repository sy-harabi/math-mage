import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/display-mode.js', import.meta.url), 'utf8');

function createBrowser(url, {
  userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  maxTouchPoints=0, width=1920, height=1080, viewportWidth=1280,
  orientation='landscape-primary', coarse=false
}={}) {
  const classes=new Set();
  const handlers={};
  const state={url:new URL(url)};
  const buttons=['auto','mobile','pc'].map(value=>({
    dataset:{debugUi:value},attributes:{},classes:new Set(),
    setAttribute(name, value){this.attributes[name]=value},
    classList:{toggle(name, on){buttons.find(b=>b.dataset.debugUi===value).classes[on?'add':'delete'](name)}}
  }));
  const root={classList:{
    toggle(name, enabled){if(enabled)classes.add(name);else classes.delete(name)},
    contains(name){return classes.has(name)}
  }};
  const doc={
    documentElement:root,
    querySelectorAll(selector){return selector==='[data-debug-ui]'?buttons:[]},
    addEventListener(event,callback){handlers[event]=callback}
  };
  const screen={
    width, height,
    orientation:{type:orientation,addEventListener(event,callback){handlers['orientation:'+event]=callback}}
  };
  const win={
    location:{get search(){return state.url.search},get href(){return state.url.href}},
    history:{replaceState(_state,_title,newUrl){state.url=new URL(newUrl)}},
    matchMedia(query){return {matches:
      query.includes('any-pointer')?coarse:
      query.includes('max-width')?viewportWidth<=1000:
      query.includes('orientation: portrait')?screen.orientation.type.startsWith('portrait'):false
    }},
    addEventListener(event,callback){handlers[event]=callback}
  };
  const navigator={userAgent,maxTouchPoints,userAgentData:{mobile:false}};
  runInNewContext(source,{window:win,document:doc,navigator,screen,URL,URLSearchParams});
  return {classes,buttons,win,state,screen,handlers};
}

test('debug mobile override works even on a non-touch desktop',()=>{
  const browser=createBrowser('https://example.test/?debug=1&ui=mobile');
  assert.equal(browser.classes.has('mobile-layout'),true);
  assert.equal(browser.win.mathMageDisplay.getMode(),'mobile');
  assert.equal(browser.buttons[1].attributes['aria-pressed'],'true');
});

test('debug PC override wins over S23 touch detection',()=>{
  const browser=createBrowser('https://example.test/?debug=1&ui=pc',{
    userAgent:'Mozilla/5.0 (Linux; Android 16; SM-S911N) Mobile Safari/537.36',
    maxTouchPoints:5,width:873,height:393,viewportWidth:873,coarse:true
  });
  assert.equal(browser.classes.has('mobile-layout'),false);
});

test('debug panel switches modes live, keeps URL in sync, and can restore auto',()=>{
  const browser=createBrowser('https://example.test/?debug=1');
  browser.win.mathMageDisplay.setMode('mobile');
  assert.equal(browser.classes.has('mobile-layout'),true);
  assert.equal(browser.state.url.searchParams.get('ui'),'mobile');
  browser.win.mathMageDisplay.setMode('pc');
  assert.equal(browser.classes.has('mobile-layout'),false);
  assert.equal(browser.buttons[2].attributes['aria-pressed'],'true');
  browser.win.mathMageDisplay.setMode('auto');
  assert.equal(browser.state.url.searchParams.has('ui'),false);
  assert.equal(browser.buttons[0].attributes['aria-pressed'],'true');
});

test('override is restricted to debug mode',()=>{
  const browser=createBrowser('https://example.test/?ui=mobile');
  assert.equal(browser.classes.has('mobile-layout'),false);
  browser.win.mathMageDisplay.setMode('mobile');
  assert.equal(browser.classes.has('mobile-layout'),false);
  assert.equal(browser.state.url.searchParams.get('ui'),'mobile');
});

test('device rotation updates portrait layout class without returning to PC mode',()=>{
  const browser=createBrowser('https://example.test/?debug=1&ui=mobile',{
    width:393,height:873,orientation:'portrait-primary'
  });
  assert.equal(browser.classes.has('mobile-portrait'),true);
  browser.screen.orientation.type='landscape-primary';
  browser.handlers['orientation:change']();
  assert.equal(browser.classes.has('mobile-portrait'),false);
  assert.equal(browser.classes.has('mobile-layout'),true);
});

test('auto still recognizes normal S23 browsers and keeps desktop PCs unchanged',()=>{
  const phone=createBrowser('https://example.test/?debug=1',{
    userAgent:'Mozilla/5.0 (Linux; Android 16; SM-S911N) Mobile Safari/537.36',
    maxTouchPoints:5,width:873,height:393,viewportWidth:873,coarse:true
  });
  const desktop=createBrowser('https://example.test/?debug=1');
  assert.equal(phone.classes.has('mobile-layout'),true);
  assert.equal(desktop.classes.has('mobile-layout'),false);
});
