import { formatRunTime } from './speedrun.js?v=1.8.1';

/** Composite the frozen arena and result into a self-contained PNG-sized canvas. */
export function createResultCapture(scene,result,createCanvas=()=>document.createElement('canvas')) {
  const canvas=createCanvas();
  canvas.width=scene.width;canvas.height=scene.height;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('캡처를 만들 수 없습니다.');
  const {width:w,height:h}=canvas,victory=result.outcome==='victory';
  const accent=victory?'#ffdf79':'#ffbac5';
  ctx.drawImage(scene,0,0);
  ctx.fillStyle='#050a1bd9';ctx.fillRect(0,0,w,h);
  const panelW=Math.min(650,w-48),left=(w-panelW)/2,top=(h-340)/2;
  ctx.fillStyle='#0c152a';ctx.strokeStyle='#507a97';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(left,top,panelW,340,12);ctx.fill();ctx.stroke();
  ctx.textAlign='center';ctx.textBaseline='middle';
  const text=(value,y,size,color)=>{
    ctx.font=`600 ${size}px system-ui,sans-serif`;ctx.fillStyle=color;
    ctx.fillText(value,w/2,y,panelW-40);
  };
  text('아브라칼큘러스!',top+35,18,'#68efff');
  text(victory?'슬라임 군주 격파!':'GAME OVER',top+84,30,victory?'#d9faff':'#ff9caa');
  text(victory?'스피드런 클리어 기록':'최종 생존 기록',top+126,13,'#8fa7bf');
  text(formatRunTime(result.elapsedSeconds),top+181,54,accent);
  text(`처치 ${result.kills}마리 · 캐릭터 Lv${result.level}`,top+239,18,'#c6d8ef');
  text('미분하고, 적분하고, 살아남아라.',top+298,12,'#8fa7bf');
  return canvas;
}

export function resultCaptureFilename(result) {
  const time=formatRunTime(result.elapsedSeconds).replace(':','m').replace('.','s');
  return `abracalculus-${result.outcome==='victory'?'clear':'game-over'}-${time}.png`;
}

/** A user click downloads a PNG locally; the game sends nothing to a server. */
export async function downloadResultCapture(scene,result,doc=document,urlAPI=URL) {
  const canvas=createResultCapture(scene,result,()=>doc.createElement('canvas'));
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(
    value=>value?resolve(value):reject(new Error('PNG 저장에 실패했습니다.')),'image/png'));
  const url=urlAPI.createObjectURL(blob),link=doc.createElement('a');
  try {
    link.href=url;link.download=resultCaptureFilename(result);
    doc.body.append(link);link.click();
  } finally {
    link.remove();
    // Leave enough time for the browser to start reading the download URL.
    setTimeout(()=>urlAPI.revokeObjectURL(url),1000);
  }
}
