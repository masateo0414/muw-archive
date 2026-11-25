'use strict';
// Marble World風のマーブルをSVGで描画する。画像ファイル・サーバー不要。
(function(root){
 const patterns=[
  ['Standard','単色'],['Polkadots','水玉'],['Star','星'],['Polkastars','星柄'],['Stripes','細い斜線'],['Circles','円'],['Big Stripes','太い斜線'],
  ['Number','数字'],['Lava','溶岩'],['Blackhole','グラデーション'],['Sand','砂'],['Transparent','ガラス'],['Zigzag','ジグザグ'],['Stone','レンガ'],['Ice','氷'],['Cross','バツ'],['Flag','国旗'],['Custom','固有物']
 ];
 const effectKinds=[['Aura','オーラ'],['Fire','炎'],['Smoke','煙'],['Party','紙吹雪'],['Orb','オーブ'],['Leaf','葉っぱ'],['Snow','雪結晶']];
 const customKinds=[['Moon','月'],['Earth','地球'],['Dice','サイコロ'],['Watermelon','スイカ']];
 const color=(s,f='#8899aa')=>/^#[0-9a-f]{6}$/i.test(s||'')?s:f;
 const optionalColor=s=>/^#[0-9a-f]{6}$/i.test(s||'')?s:'';
 const kind=s=>/^Number [0-9]$/.test(s||'')?'Number':patterns.some(([k])=>k===s)?s:'Standard';
 const digit=(v,f=0)=>/^[0-9]$/.test(String(v??''))?Number(v):f;
 const number=p=>/^Number [0-9]$/.test(p?.marblePattern||'')?Number(p.marblePattern.slice(-1)):digit(p?.marbleNumber);
 const flagCode=v=>String(v||'').trim().toUpperCase().replace(/[^A-Z]/g,'').slice(0,2)||'JP';
 const customKind=v=>customKinds.some(([k])=>k===v)?v:'Moon';
 const effectKind=v=>effectKinds.some(([k])=>k===v)?v:'Aura';
 const config=p=>({
  pattern:kind(p?.marblePattern),
  main:color(p?.color),
  secondary:color(p?.marbleSecondary,'#ffffff'),
  number:number(p),
  effect:optionalColor(p?.marbleEffectColor),
  effectType:effectKind(p?.marbleEffectType),
  flag:flagCode(p?.marbleFlagCode),
  custom:customKind(p?.marbleCustomKind)
 });
 const needsSecond=p=>!['Standard','Sand','Stone','Ice','Flag','Custom'].includes(p);
 const colorLabels=p=>p==='Blackhole'?['中央の色','グラデーションの色']
  :p==='Transparent'?['ガラスの色','中身の色']
  :p==='Flag'?['ベースの色','']
  :p==='Custom'?['本体の基調色','']
  :p==='Stone'?['石の色','']
  :p==='Ice'?['氷の色','']
  :['メインの色',({'Polkadots':'水玉の色','Star':'星の色','Polkastars':'星の色','Stripes':'線の色','Circles':'円の色','Big Stripes':'線の色','Lava':'うねうねの色','Zigzag':'線の色','Cross':'バツの色'}[p]||'数字の色')];
 function star(x,y,r){return Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,q=i%2?r*.43:r;return `${(x+Math.cos(a)*q).toFixed(2)},${(y+Math.sin(a)*q).toFixed(2)}`}).join(' ')}
 function clamp(v,min=0,max=255){return Math.max(min,Math.min(max,v));}
 function shift(hex,delta){
  const h=color(hex).slice(1);const nums=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
  return '#'+nums.map(n=>clamp(n+delta).toString(16).padStart(2,'0')).join('');
 }
 function alpha(hex,a){
  const h=color(hex).slice(1);const nums=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
  return `rgba(${nums[0]},${nums[1]},${nums[2]},${a})`;
 }
 function meridian(k){
  // Orthographic projection of a sphere's meridian; converge at both poles.
  const edge=(offset,reverse=false)=>Array.from({length:49},(_,i)=>{
   const t=(reverse?48-i:i)*Math.PI/48;
   return `${(50+(k+offset)*Math.sin(t)).toFixed(2)} ${(50-49*Math.cos(t)).toFixed(2)}`;
  });
  return `<path d="M${edge(-5.5).join(' L')} L${edge(5.5,true).join(' L')} Z"/>`;
 }
 function effectSvg(type,col){
  const c=color(col||'#ffd54a');
  const c2=shift(c,48), c3=shift(c,-42);
  if(type==='Fire')return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140"><g><path d="M70 132 C46 132 24 117 24 86 C24 60 41 44 57 29 C55 48 65 59 76 52 C88 44 88 27 86 10 C107 24 118 44 118 67 C118 89 106 103 92 114 C84 121 78 132 70 132 Z" fill="${alpha(c,.55)}"/><path d="M70 123 C52 123 37 111 37 87 C37 67 49 55 60 43 C59 57 67 65 76 60 C84 55 85 42 84 28 C100 39 108 55 108 74 C108 92 98 103 88 110 C82 115 76 123 70 123 Z" fill="${alpha(c2,.82)}"/><path d="M70 113 C57 113 46 103 46 86 C46 72 54 63 62 54 C61 65 67 70 74 67 C81 63 81 53 80 43 C92 52 99 64 99 77 C99 90 92 98 85 103 C80 107 76 113 70 113 Z" fill="${alpha('#fff3b0',.88)}"/></g></svg>`;
  if(type==='Smoke')return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140"><defs><filter id="b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4.8"/></filter></defs><g fill="${alpha(c,.34)}" filter="url(#b)"><circle cx="30" cy="39" r="15"/><circle cx="41" cy="27" r="12"/><circle cx="24" cy="57" r="13"/><circle cx="108" cy="27" r="13"/><circle cx="119" cy="40" r="16"/><circle cx="113" cy="59" r="12"/><circle cx="27" cy="106" r="16"/><circle cx="43" cy="117" r="12"/><circle cx="104" cy="112" r="15"/><circle cx="118" cy="98" r="13"/><circle cx="70" cy="14" r="11"/><circle cx="68" cy="126" r="11"/></g><circle cx="70" cy="70" r="54" fill="none" stroke="${alpha(c,.14)}" stroke-width="4" filter="url(#b)"/></svg>`;
  if(type==='Party'){
   const cols=[c,'#ff6b6b','#ffd166','#4cc9f0','#8ac926','#c77dff'];
   const pieces=[[24,24,14],[39,15,-20],[107,24,34],[118,44,14],[20,94,28],[34,119,-18],[108,112,16],[122,90,-26],[71,14,10],[69,126,-10],[16,62,-32],[125,64,27]];
   return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">${pieces.map((p,i)=>`<rect x="${p[0]}" y="${p[1]}" width="7" height="18" rx="1.2" fill="${cols[i%cols.length]}" transform="rotate(${p[2]} ${p[0]} ${p[1]})"/>`).join('')}</svg>`;
  }
  if(type==='Orb'){
   const cols=['#ff7ac8','#75d9ff','#ffe16a'];
   const orbs=[[28,38,10],[112,45,10],[48,114,10]];
   return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140"><defs><filter id="o" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.9"/></filter></defs>${orbs.map(([x,y,r],i)=>`<g filter="url(#o)"><circle cx="${x}" cy="${y}" r="${r}" fill="${cols[i%cols.length]}"/><circle cx="${x-r/3}" cy="${y-r/3}" r="${(r*.38).toFixed(2)}" fill="rgba(255,255,255,.55)"/></g>`).join('')}</svg>`;
  }
  if(type==='Leaf')return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140"><g transform="translate(0 1)"><path d="M28 39 C25 25 34 16 49 16 C53 29 48 44 34 49 C30 47 28 43 28 39 Z" fill="${alpha(c,.95)}"/><path d="M36 27 C41 32 41 39 36 45" fill="none" stroke="${alpha(c3,.7)}" stroke-width="2.2" stroke-linecap="round"/><path d="M43 24 C50 16 63 17 71 26 C67 39 55 49 42 47 C37 42 37 31 43 24 Z" fill="${alpha(c2,.92)}"/><path d="M50 25 C53 31 52 38 47 44" fill="none" stroke="${alpha(c3,.65)}" stroke-width="2.2" stroke-linecap="round"/></g></svg>`;
  if(type==='Snow')return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140"><g stroke="${alpha(c,.96)}" stroke-width="3.2" stroke-linecap="round" fill="none" transform="translate(0 3)"><path d="M46 15 L46 47"/><path d="M30 31 L62 31"/><path d="M35 20 L57 42"/><path d="M57 20 L35 42"/><path d="M46 15 l-5 5"/><path d="M46 15 l5 5"/><path d="M46 47 l-5 -5"/><path d="M46 47 l5 -5"/><path d="M30 31 l6 -3"/><path d="M30 31 l6 3"/><path d="M62 31 l-6 -3"/><path d="M62 31 l-6 3"/></g><circle cx="88" cy="24" r="3" fill="${alpha(c,.8)}"/><circle cx="100" cy="17" r="2.2" fill="${alpha(c,.6)}"/><g stroke="${alpha(c,.96)}" stroke-width="3.2" stroke-linecap="round" fill="none" transform="translate(112 112) scale(.60) translate(-46 -31)"><path d="M46 15 L46 47"/><path d="M30 31 L62 31"/><path d="M35 20 L57 42"/><path d="M57 20 L35 42"/><path d="M46 15 l-5 5"/><path d="M46 15 l5 5"/><path d="M46 47 l-5 -5"/><path d="M46 47 l5 -5"/><path d="M30 31 l6 -3"/><path d="M30 31 l6 3"/><path d="M62 31 l-6 -3"/><path d="M62 31 l-6 3"/></g></svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140"><circle cx="70" cy="70" r="58" fill="none" stroke="${alpha(c,.72)}" stroke-width="6"/><circle cx="70" cy="70" r="64" fill="none" stroke="${alpha(c,.28)}" stroke-width="4"/><circle cx="70" cy="70" r="52" fill="none" stroke="${alpha(c,.18)}" stroke-width="3"/></svg>`;
 }
function effectData(type,col){
  return `url('data:image/svg+xml,${encodeURIComponent(effectSvg(type,col))}') center/contain no-repeat`;
 }
 function customArt(kind,main){
  if(kind==='Moon')return `
    <circle cx="50" cy="50" r="49" fill="#c9ced6"/>
    <circle cx="36" cy="34" r="8" fill="#b5bbc4" opacity=".8"/>
    <circle cx="63" cy="38" r="6" fill="#b5bbc4" opacity=".85"/>
    <circle cx="57" cy="63" r="10" fill="#b5bbc4" opacity=".78"/>
    <circle cx="33" cy="61" r="5" fill="#b5bbc4" opacity=".76"/>
    <circle cx="72" cy="57" r="4" fill="#d8dde6" opacity=".55"/>`;
  if(kind==='Earth')return `
    <circle cx="50" cy="50" r="49" fill="#1e79d7"/>
    <path d="M18 35c5-8 15-10 21-6 3 2 10 1 13 7 2 4-2 8-7 8-5 0-8 4-11 8-5 6-16 4-20-2-3-4 0-11 4-15z" fill="#52b36b"/>
    <path d="M54 24c8-5 20 1 23 9 2 5-3 9-7 10-5 1-9 4-10 10-1 6-11 9-16 5-6-5-5-16 0-21 3-3 7-11 10-13z" fill="#4fb164"/>
    <path d="M25 69c5-3 10-2 14 1 3 2 8 2 9 6 1 4-4 8-10 8-7 0-13-4-15-9-1-2-1-4 2-6z" fill="#5fbe73"/>`;
  if(kind==='Dice')return `
    <circle cx="50" cy="50" r="49" fill="#f8fafc"/>
    <rect x="22" y="22" width="56" height="56" rx="12" fill="#ffffff" stroke="#d6dbe3" stroke-width="2"/>
    ${[[35,35],[65,35],[35,65],[65,65],[50,50]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="4.6" fill="#111827"/>`).join('')}`;
  if(kind==='Watermelon')return `<circle cx="50" cy="50" r="49" fill="#73bb42"/><g fill="#386e28">${[-39,-22,0,22,39].map(meridian).join('')}</g>`;
  return `<circle cx="50" cy="50" r="49" fill="${main}"/>`;
 }
 const cache=new Map();
 function svg(p,layer='all'){
  const {pattern,main,secondary,number,effect,effectType,flag,custom}=config(p);
  let base=`<circle cx="50" cy="50" r="49" fill="${main}"/>`,ink='';
  const dots=Array.from({length:5},(_,y)=>Array.from({length:5},(_,x)=>[x*25-1+(y%2)*12.5,y*24+2])).flat();
  if(pattern==='Polkadots')ink=dots.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="6.4" fill="${secondary}"/>`).join('');
  if(pattern==='Star')ink=`<polygon points="${star(50,50,34)}" fill="${secondary}"/>`;
  if(pattern==='Polkastars')ink=dots.map(([x,y])=>`<polygon points="${star(x,y,9.7)}" fill="${secondary}"/>`).join('');
  if(pattern==='Stripes'||pattern==='Big Stripes'){
   const ys=pattern==='Stripes'?[12,31,50,69,88]:[29,71];const w=pattern==='Stripes'?5:23;
   ink=`<g transform="rotate(-32 50 50)">${ys.map(y=>`<rect x="-30" y="${y-w/2}" width="160" height="${w}" fill="${secondary}"/>`).join('')}</g>`;
  }
  if(pattern==='Circles')ink=`<circle cx="50" cy="50" r="28" fill="none" stroke="${secondary}" stroke-width="5"/>`;
  if(pattern==='Number')ink=`<text x="50" y="52" dominant-baseline="central" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="65" fill="${secondary}">${number}</text>`;
  if(pattern==='Lava')ink=`<g fill="none" stroke="${secondary}" stroke-linecap="round" stroke-linejoin="round">
    <path stroke-width="6.5" d="M-12 12 C5 -2 18 -4 28 10 S48 33 58 18 S80 -3 95 12 S109 29 118 18"/>
    <path stroke-width="6.5" d="M-12 34 C4 19 18 18 28 31 S48 55 59 42 S81 18 95 32 S109 49 118 38"/>
    <path stroke-width="6.5" d="M-12 56 C4 41 18 40 28 53 S48 77 59 64 S81 40 95 54 S109 71 118 60"/>
    <path stroke-width="6.5" d="M-12 78 C4 63 18 62 28 75 S48 99 59 86 S81 62 95 76 S109 93 118 82"/>
    <path stroke-width="6.5" d="M-12 100 C5 84 18 85 28 97 S47 112 59 108 S82 84 96 97 S108 108 118 100"/>
  </g>`;
  if(pattern==='Blackhole')base=`<circle cx="50" cy="50" r="49" fill="url(#hole)"/>`;
  if(pattern==='Sand'){
   let seed=813;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
   ink=Array.from({length:420},()=>{const x=(rand()*100).toFixed(1),y=(rand()*100).toFixed(1),r=(.38+rand()*1.2).toFixed(2),light=rand()>.45;return `<circle cx="${x}" cy="${y}" r="${r}" fill="${light?'#fff':'#17191d'}" opacity="${light?.29:.22}"/>`}).join('');
  }
  if(pattern==='Transparent'){
   base=`<circle cx="50" cy="50" r="48" fill="${main}" fill-opacity=".35"/><circle cx="50" cy="50" r="46" fill="url(#glass)"/>`;
   ink=`<g transform="rotate(-16 50 50)" fill="${secondary}" opacity=".95"><path d="M58 7 C53 15 54 24 59 32 C67 44 72 56 66 66 C61 75 54 82 49 89 C45 94 42 97 39 95 C41 87 41 79 35 68 C29 56 29 46 34 36 C39 27 46 21 52 13 C54 10 56 8 58 7 Z"/></g>`;
  }
  if(pattern==='Zigzag')ink=`<g fill="none" stroke="${secondary}" stroke-width="7" stroke-linejoin="round" transform="rotate(-20 50 50)">${[8,36,64,92].map(y=>`<path d="M-10 ${y} l15 -10 15 10 15 -10 15 10 15 -10 15 10 15 -10 15 10"/>`).join('')}</g>`;
  if(pattern==='Stone'){
   const s1=shift(main,-28),s2=shift(main,25);
   ink=`<g fill="none"><path d="M10 27 H90" stroke="${alpha(s1,.48)}" stroke-width="4"/><path d="M7 50 H93" stroke="${alpha(s1,.5)}" stroke-width="4"/><path d="M10 73 H90" stroke="${alpha(s1,.48)}" stroke-width="4"/><path d="M18 4 V27 M47 4 V27 M76 4 V27 M4 27 V50 M33 27 V50 M62 27 V50 M90 27 V50 M18 50 V73 M47 50 V73 M76 50 V73 M4 73 V96 M33 73 V96 M62 73 V96 M90 73 V96" stroke="${alpha(s2,.45)}" stroke-width="3"/><path d="M10 25 H90 M7 48 H93 M10 71 H90" stroke="${alpha('#000000',.15)}" stroke-width="1.6"/></g>`;
  }
  if(pattern==='Ice'){
   const iceLight=shift(main,55);
   // 固定配置で不規則に重ねる。再描画時に模様が変わらないようにする。
   ink=`<g><path d="M16 30 L39 18 L60 28 L47 46 L22 47 Z" fill="${alpha(iceLight,.28)}"/><path d="M55 16 L82 21 L88 41 L67 50 L49 33 Z" fill="${alpha('#ffffff',.22)}"/><path d="M32 58 L56 46 L74 59 L61 78 L35 77 Z" fill="${alpha(iceLight,.24)}"/><path d="M58 62 L82 54 L90 72 L78 89 L54 86 Z" fill="${alpha('#ffffff',.18)}"/><path d="M8 55 L29 39 L52 47 L45 70 L19 76 Z" fill="${alpha('#ffffff',.22)}"/><path d="M38 20 L64 11 L81 32 L69 59 L44 47 Z" fill="${alpha(iceLight,.25)}"/></g>`;
  }
  if(pattern==='Cross')ink=`<g fill="none" stroke="${secondary}" stroke-width="13" stroke-linecap="round"><path d="M22 22 L78 78"/><path d="M78 22 L22 78"/></g>`;
  if(pattern==='Flag')ink='';
  if(pattern==='Custom'){
   base=customArt(custom,main);ink='';
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><clipPath id="edge"><circle cx="50" cy="50" r="49"/></clipPath><radialGradient id="shade" cx="33%" cy="25%" r="77%"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset=".48" stop-color="#fff" stop-opacity="0"/><stop offset=".79" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></radialGradient><radialGradient id="glint" cx="29%" cy="22%" r="25%"><stop stop-color="#fff" stop-opacity=".87"/><stop offset=".36" stop-color="#fff" stop-opacity=".43"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><radialGradient id="hole"><stop offset="0" stop-color="${main}"/><stop offset=".35" stop-color="${main}"/><stop offset="1" stop-color="${secondary}"/></radialGradient><radialGradient id="glass"><stop stop-color="#fff" stop-opacity=".14"/><stop offset=".7" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="${main}" stop-opacity=".7"/></radialGradient></defs><g clip-path="url(#edge)">${layer==='light'?'':base+ink}${layer==='texture'?'':`<circle cx="50" cy="50" r="49" fill="url(#shade)" opacity="${pattern==='Blackhole'?'.58':'1'}"/><circle cx="50" cy="50" r="49" fill="url(#glint)"/><path d="M13 64 Q29 95 67 91" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>`}</g>${layer==='texture'?'':'<circle cx="50" cy="50" r="48.5" fill="none" stroke="#000" stroke-opacity=".18"/>'}</svg>`;
 }
 function url(p,layer='all'){const c=config(p),key=JSON.stringify([c,layer]);if(!cache.has(key)){if(cache.size>512)cache.clear();cache.set(key,'data:image/svg+xml,'+encodeURIComponent(svg(p,layer)));}return cache.get(key);}
 function visualProps(p){
  const c=config(p), flag=c.pattern==='Flag'&&/^[A-Z]{2}$/.test(c.flag)?`url('https://flagcdn.com/w160/${c.flag.toLowerCase()}.png')`:'none';
  return {
   '--marble-image':`url('${url(p)}')`,
   '--marble-flag':flag,
   '--marble-flag-inset':c.pattern==='Flag'?'17%':'30%',
   '--marble-flag-radius':c.pattern==='Flag'?'50%':'0',
   '--marble-aura':c.effect?effectData(c.effectType,c.effect):'none',
   '--marble-effect-inset':c.effect&&c.effectType==='Fire'?'-24%':'-8%',
   '--marble-effect-mask':c.effect&&c.effectType==='Fire'?'radial-gradient(circle closest-side, transparent 0 67.4%, #000 68%)':'none'
  };
 }
 function style(p){return Object.entries(visualProps(p)).map(([key,value])=>`${key}:${value}`).join(';');}
 function apply(el,p){for(const [key,value] of Object.entries(visualProps(p)))el.style.setProperty(key,value);}
 root.MUWMarbles={patterns,effectKinds,customKinds,config,kind,number,needsSecond,colorLabels,flagCode,customKind,effectKind,svg,url,style,apply};
})(window);
