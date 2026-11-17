// Native scroll, bounded smoothing after input, zero idle loop or pointer input.
// The native document remains the timeline; sticky is progressive enhancement.
const track=document.querySelector('#lentil-journey');
if(track){
 const root=document.documentElement,stage=track.querySelector('.journey-stage'),grain=stage.querySelector('.journey-grain'),cup=stage.querySelector('.journey-cup');
 const steps=[...track.querySelectorAll('[data-journey-step]')],reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
 const mix=(a,b,t)=>a+(b-a)*t;
 const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};
 const softer=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
 let centers=[],frame=0,active=false,watcher,resizeObserver,enabled=false;
 let stageHeight=0,grainTop=0,cupTop=0,cupHeight=0,cupWidth=0;
 let renderedProgress=NaN,lastFrameTime=0,snapNext=true;
 function measure(){
  if(!enabled)return;
  centers=steps.map(step=>{const rect=step.getBoundingClientRect();return scrollY+rect.top+rect.height*.5;});
  stageHeight=stage.offsetHeight;grainTop=grain.offsetTop;cupTop=cup.offsetTop;cupHeight=cup.offsetHeight;cupWidth=cup.offsetWidth;
  snapNext=true;
  requestRender();
 }
 function render(timestamp){
  frame=0;if(!enabled)return;
  const mobile=innerWidth<=700,focusY=scrollY+innerHeight*(mobile?.72:.5);
  let index=centers.findIndex(center=>center>focusY);if(index<0)index=centers.length-1;
  const lower=Math.max(0,index-1),distance=centers[Math.min(lower+1,centers.length-1)]-centers[lower]||innerHeight*.85;
  const target=clamp(lower+(focusY-centers[lower])/distance,-.6,4.65);
  // Brief, bounded catch-up softens coarse wheel deltas without hijacking scroll.
  // At rest this stops completely; reverse scroll follows the same poses.
  const elapsed=lastFrameTime?clamp(timestamp-lastFrameTime,1,40):16;
  lastFrameTime=timestamp;
  if(snapNext||!Number.isFinite(renderedProgress)){renderedProgress=target;snapNext=false;}
  else renderedProgress+=(target-renderedProgress)*(1-Math.exp(-elapsed/65));
  const moving=Math.abs(target-renderedProgress)>.00015;
  if(!moving)renderedProgress=target;
  const progress=renderedProgress;
  // Overlapping, long texture transitions and subtle shape changes replace cuts.
  const cooking=softer(.05,1.5,progress),drying=softer(1.35,2.85,progress);
  const recipe=softer(2.35,2.95,progress)*(1-softer(3.02,3.48,progress));
  const approach=softer(2.92,3.52,progress),cupIn=softer(3.02,3.5,progress);
  const drop=clamp((progress-3.52)/.54),gravity=.12*drop+.88*drop*drop,close=softer(4.13,4.32,progress);
  // First recede / rise to the release point. Then a downward accelerating arc.
  // The lid parks to the right, leaving the mouth clear, and the front rim masks
  // the seed before its opacity changes. Both desktop and mobile fall downward.
  const releaseX=mobile?-20:-34,releaseY=-(mobile?stageHeight*.30:Math.min(155,stageHeight*.18));
  const targetY=cupTop+cupHeight*.39-grainTop;
  const driftX=Math.sin(progress*1.5)*12,driftY=Math.sin(progress*1.8)*7;
  const grainX=drop>0?releaseX*(1-drop):mix(driftX,releaseX,approach);
  const grainY=drop>0?mix(releaseY,targetY,gravity):mix(driftY,releaseY,approach);
  const macroScale=mix(1,.3,softer(2.85,3.52,progress));
  const impact=Math.sin(Math.PI*clamp((progress-4.04)/.17))*2.2;
  const lidSide=Math.min(cupWidth*.62,innerWidth*.5-cupWidth*.35-18);
  const variables={
   '--grain-x':`${grainX.toFixed(2)}px`,'--grain-y':`${grainY.toFixed(2)}px`,
   '--grain-scale':(macroScale*mix(1,.82,drop)).toFixed(4),
   '--grain-shape-x':(1+cooking*.035-drying*.045).toFixed(4),
   '--grain-shape-y':(1+cooking*.10-drying*.13).toFixed(4),
   '--grain-rotation':`${(mix(-12,10,cooking)-drying*7+drop*58).toFixed(2)}deg`,
   '--grain-opacity':(1-softer(4.075,4.12,progress)).toFixed(4),
   '--cooked':cooking.toFixed(4),'--dried':drying.toFixed(4),
   '--water':(smooth(-.4,.1,progress)*(1-smooth(.5,.9,progress))).toFixed(4),
   '--water-rotation':`${progress*14}deg`,'--steam':(cooking*(1-smooth(1.35,1.8,progress))).toFixed(4),
   '--steam-y':`${-smooth(.6,1.6,progress)*25}px`,'--dry':(drying*(1-smooth(2.65,3.1,progress))).toFixed(4),
   '--ingredients':recipe.toFixed(4),'--ingredients-scale':mix(.78,1.02,smooth(2.6,3.5,progress)).toFixed(4),
   '--cup':cupIn.toFixed(4),'--cup-y':`${((1-cupIn)*55+impact).toFixed(2)}px`,
   '--lid-x':`${mix(lidSide,0,close).toFixed(2)}px`,'--lid-y':`${mix(mobile?-28:-110,0,close).toFixed(2)}px`,'--lid-rotation':`${mix(mobile?16:24,0,close).toFixed(2)}deg`,'--lid-opacity':cupIn.toFixed(4),
   '--halo-scale':mix(1,1.06,cupIn).toFixed(4),'--halo-opacity':mix(.72,.4,cupIn).toFixed(4),'--rail':clamp(progress/4.32).toFixed(4)
  };
  for(const [property,value]of Object.entries(variables))stage.style.setProperty(property,value);
  for(let i=0;i<steps.length;i++){
   const distance=Math.abs(progress-i),copy=steps[i].querySelector('.journey-copy');
   copy.style.setProperty('--copy-opacity',mobile?'1':mix(.3,1,1-smooth(.25,1.2,distance)).toFixed(3));
   copy.style.setProperty('--copy-y',mobile?'0px':`${clamp((centers[i]-focusY)/innerHeight,-1,1)*12}px`);
  }
  track.dataset.progress=progress.toFixed(3);track.dataset.step=String(Math.round(clamp(progress,0,4)));
  track.dataset.motion=moving?'moving':'settled';
  if(moving&&active)frame=requestAnimationFrame(render);else lastFrameTime=0;
 }
 function requestRender(){if(enabled&&!frame)frame=requestAnimationFrame(render);}
 function setActive(value){
  if(!value&&frame){cancelAnimationFrame(frame);frame=0;lastFrameTime=0;}
  if(active===value)return;active=value;
  if(active){window.addEventListener('scroll',requestRender,{passive:true});measure();}
  else window.removeEventListener('scroll',requestRender);
 }
 function configure(){
  enabled=!reduced.matches&&'IntersectionObserver'in window;
  root.classList.toggle('journey-ready',enabled);
  watcher?.disconnect();resizeObserver?.disconnect();setActive(false);
  if(!enabled){steps.forEach(step=>{const copy=step.querySelector('.journey-copy');copy.style.removeProperty('--copy-opacity');copy.style.removeProperty('--copy-y');});return;}
  watcher=new IntersectionObserver(entries=>setActive(entries[0].isIntersecting),{rootMargin:'200px 0px'});watcher.observe(track);
  resizeObserver=new ResizeObserver(measure);resizeObserver.observe(track);measure();
 }
 reduced.addEventListener('change',configure);
 window.addEventListener('resize',measure,{passive:true});
 window.visualViewport?.addEventListener('resize',measure,{passive:true});
 window.addEventListener('pageshow',()=>{configure();measure();});
 window.addEventListener('pagehide',()=>{watcher?.disconnect();resizeObserver?.disconnect();setActive(false);});
 document.fonts.ready.then(measure);configure();
}
