/* ---------- ŚNIEG I ZAWIEJA ---------- */
(function(){
  var c=document.getElementById('snieg'), x=c.getContext('2d');
  var btn=document.getElementById('snow-toggle');
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W,H,dpr,flakes=[],running=false,raf=0,t=0;
  var level=0.55;          // 0..1 – gęstość (rośnie, gdy w Zamościu pada)
  var baseWind=0.6;        // stały wiatr
  var gust=0,gustTarget=0,nextGust=4;

  var on=!reduce;
  try{var s=localStorage.getItem('snieg'); if(s!==null) on=(s==='1');}catch(e){}

  function size(){
    dpr=Math.min(window.devicePixelRatio||1,2);
    W=c.width=innerWidth*dpr; H=c.height=innerHeight*dpr;
    c.style.width=innerWidth+'px'; c.style.height=innerHeight+'px';
    var target=Math.round((innerWidth*innerHeight)/ (innerWidth<700?5200:3600) * level);
    while(flakes.length<target) flakes.push(make(true));
    if(flakes.length>target) flakes.length=target;
  }
  function make(anywhere){
    var z=Math.random();                         // głębia: 0 daleko, 1 blisko
    return {x:Math.random()*W*1.4-W*0.2, y:anywhere?Math.random()*H:-10*dpr,
      r:(0.8+z*2.6)*dpr, z:z, vy:(0.5+z*1.6)*dpr, ph:Math.random()*6.28, sw:0.4+Math.random()*1.2,
      a:0.35+z*0.6};
  }
  function frame(){
    t+=1/60;
    if(t>nextGust){ gustTarget=(Math.random()*5+2.5)*level; nextGust=t+3+Math.random()*7; setTimeout(function(){gustTarget=0;},1600+Math.random()*2200); }
    gust+=(gustTarget-gust)*0.02;
    var wind=(baseWind+gust)*dpr;
    x.clearRect(0,0,W,H);
    x.fillStyle='#fff';
    for(var i=0;i<flakes.length;i++){
      var f=flakes[i];
      f.ph+=0.02*f.sw;
      f.y+=f.vy*(1+gust*0.15);
      f.x+=wind*(0.4+f.z)+Math.sin(f.ph)*0.5*dpr;
      if(f.y>H+10||f.x>W+40||f.x<-W*0.3){ var n=make(false); if(Math.random()<0.5&&wind>1){n.x=-20*dpr;n.y=Math.random()*H;} flakes[i]=n; continue; }
      x.globalAlpha=f.a;
      x.beginPath(); x.arc(f.x,f.y,f.r,0,6.283); x.fill();
      if(gust>1.5&&f.z>0.6){ x.globalAlpha=f.a*0.25; x.fillRect(f.x-wind*3,f.y-f.r*0.4,wind*3,f.r*0.8); }
    }
    x.globalAlpha=1;
    raf=requestAnimationFrame(frame);
  }
  function start(){ if(running||!on) return; running=true; c.style.display='block'; raf=requestAnimationFrame(frame); }
  function stop(){ running=false; cancelAnimationFrame(raf); x&&x.clearRect(0,0,W,H); }
  function label(){ btn.textContent=on?'❄ Śnieg: wł.':'❄ Śnieg: wył.'; btn.setAttribute('aria-pressed',on?'true':'false'); }
  btn.addEventListener('click',function(){ on=!on; try{localStorage.setItem('snieg',on?'1':'0');}catch(e){} label(); on?start():(stop(),c.style.display='none'); });
  addEventListener('resize',size);
  document.addEventListener('visibilitychange',function(){ document.hidden?stop():start(); });
  size(); label(); if(on) start(); else c.style.display='none';

  window.zimaUstaw=function(newLevel,windKmh){
    level=Math.max(0.35,Math.min(1,newLevel));
    baseWind=0.4+Math.min(windKmh||0,60)/14;
    size();
  };
})();
