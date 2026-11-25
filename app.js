'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const clean = v => String(v ?? '').trim();
  const dateDisplay=v=>clean(v).replace(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/,(_,y,m,d)=>`${y}/${m.padStart(2,'0')}/${d.padStart(2,'0')}`);
  const safeColor = v => /^#[\da-f]{6}$/i.test(v || '') ? v : '#8d9aa7';
  const STAGE_COLORS={qual:'#15983e',main:'#0074df',repechage:'#b52839',semifinal:'#7852b7',final:'#b88a24',survival:'#546b81',revival:'#b52839',quarterfinal:'#0074df',third:'#ad7041'};
  const stageColor=s=>safeColor(s.color||db.site.stageColors?.[s.id]||STAGE_COLORS[s.id]||'#0074df');
  const crownLabel=e=>e.edition===10?'KUSODEMASU OHMIKAMI':e.id==='unchampion'?'KING OF UNCHI':e.edition==null?'優勝':'UNCHI DAIMYOJIN';
  const crownJapanese=e=>e.edition===10?'糞出大御神':e.id==='unchampion'?'KING OF UNCHI':e.edition==null?'優勝':'ウンチ大明神';
  function goalText(r){const t=r.marblesTotal,l=r.marblesRemaining;return t!=null&&l!=null&&[1,2].includes(Number(t))&&Number(l)>=0&&Number(l)<=Number(t)?`${Number(t)-Number(l)}/${t}球ゴール`:'';}
  function displayStatus(stage,r){const status=clean(r.status);if(stage.id==='main'&&status==='記録あり')return goalText(r)||'結果不明';if(stage.id==='final'&&!clean(r.place)&&/決勝進出/.test(status)&&stage.entries?.some(x=>String(x.place)==='1'||x.status==='優勝'))return '敗退';return status==='記録あり'?'結果不明':status;}
  const clone = o => JSON.parse(JSON.stringify(o));
  const enc = encodeURIComponent;
  const fmt = {survival:'一斉勝ち抜け制',longrace:'超ロングレース',standard:'複数ステージ制',special:'SPECIAL',championship:'1vs1 トーナメント'};
  const CATEGORY_LABELS={survival:'一斉勝ち抜け制',longrace:'超ロングレース',standard:'4ブロック制',special:'SPECIAL'};
  const categoryKey=e=>e.category||(e.format==='championship'?'special':e.format);
  const categoryColor=e=>safeColor(db.site.categoryColors?.[categoryKey(e)]||'#0074df');
  const recorded=(e,id)=>e.championId===id||e.finalSeedIds?.includes(id)||e.stages.some(s=>(s.entries||[]).some(r=>r.playerId===id)||(s.matches||[]).some(m=>m.a===id||m.b===id));
  const confirmedAbsent=(e,id)=>e.absentPlayerIds?.includes(id)&&!recorded(e,id);
  const suffix = n => n >= 11 && n <= 13 ? 'th' : ({1:'st',2:'nd',3:'rd'}[n % 10] || 'th');
  let db = null;
  let eventSearch = '';
  let playerSearch = '';
  let playerSort = 'name';
  let renderedHash='';

  const player = id => db.players.find(x => x.id === id || x.legacyIds?.includes(id));
  const eventById = id => db.events.find(x => x.id === (id==='unchampoin'?'unchampion':id));
  const pname = id => player(id)?.name || (id ? '不明なプレイヤー' : '未登録');
  const pcolor = id => safeColor(player(id)?.color);
  const marbleMarkup=(p,classes='color-dot')=>`<span class="${classes} patterned-marble" aria-hidden="true" style="${window.MUWMarbles.style(p)}"></span>`;
  // Profile only: translate the entire marble, spin the surface independently.
  const rollingMarbleMarkup=p=>`<span class="marble big patterned-marble rolling-marble" aria-hidden="true" style="${window.MUWMarbles.style(p)};--marble-texture:url('${window.MUWMarbles.url(p,'texture')}');--marble-light:url('${window.MUWMarbles.url(p,'light')}')"><span class="rolling-marble-surface"></span><span class="rolling-marble-light"></span></span>`;
  const crownOrnament=()=>`<svg class="crown-ornament" viewBox="0 0 80 58" aria-hidden="true"><defs><linearGradient id="crown-gold" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff0b5"/><stop offset=".5" stop-color="#eac369"/><stop offset="1" stop-color="#b78a30"/></linearGradient></defs><path d="M9 15L25 30 40 8 55 30 71 15 64 46H16Z" fill="url(#crown-gold)" stroke="#a97b25" stroke-width="2" stroke-linejoin="round"/><path d="M16 41H64L63 49H17Z" fill="#c69b45" stroke="#a97b25" stroke-width="1.5"/><path d="M40 28l5 6-5 6-5-6z" fill="#fff6d9"/><g fill="#f4d68a" stroke="#ac7f29" stroke-width="1.5"><circle cx="9" cy="14" r="4"/><circle cx="40" cy="7" r="4"/><circle cx="71" cy="14" r="4"/></g></svg>`;
  const QUAL_OUTCOMES={'auto':'自動判定','unknown':'敗退 or 不参加','absent':'不参加','eliminated':'敗退'};
  // 手動指定は予選の記録・本戦出場・シードによる確定情報がない場合のみ適用する。
  function canSetQualOutcome(e,id){
    if(!e.stages?.some(s=>s.id==='qual')||e.finalSeedIds?.includes(id))return false;
    if(e.stages.some(s=>['qual','main','semifinal'].includes(s.id)&&((s.entries||[]).some(r=>r.playerId===id)||(s.matches||[]).some(m=>m.a===id||m.b===id))))return false;
    if(e.edition===5&&e.stages.some(s=>s.id==='final'&&(s.entries||[]).some(r=>r.playerId===id))&&!e.stages.some(s=>s.id==='repechage'&&(s.entries||[]).some(r=>r.playerId===id)))return false;
    return true;
  }
  function cleanQualOutcomes(e){
    e.qualOutcomes=Object.fromEntries(Object.entries(e.qualOutcomes||{}).filter(([id,value])=>player(id)&&['unknown','absent','eliminated'].includes(value)&&canSetQualOutcome(e,id)&&!confirmedAbsent(e,id)));
  }
  const longRaceEliminated=(e,id)=>e.edition===4&&e.longRaceOutcomes?.[id]==='eliminated'&&!recorded(e,id)&&!confirmedAbsent(e,id);
  function cleanLongRaceOutcomes(e){if(e.longRaceOutcomes)e.longRaceOutcomes=Object.fromEntries(Object.entries(e.longRaceOutcomes).filter(([id,v])=>e.edition===4&&player(id)&&v==='eliminated'&&!recorded(e,id)&&!confirmedAbsent(e,id)));}
  const ptitle = id => player(id)?.title || '';
  const eventTitle=(e,id)=>clean(e?.playerTitles?.[id]);
  const eventTitleMarkup=(e,id)=>eventTitle(e,id)?`<span class="event-player-title">${esc(eventTitle(e,id))}</span>`:'';
  const participantLink = id => id && player(id) ? `<a class="player-inline" href="#/player/${enc(id)}">${marbleMarkup(player(id))}<span class="player-label">${esc(pname(id))}</span></a>` : '<span class="muted">—</span>';
  const hasData = s => (s.entries?.length || 0) + (s.matches?.length || 0);
  const entryCount = e => e.stages.reduce((n,s)=>n+hasData(s),0);
  const bestStage = (ev, id) => {
    let result = null;
    for (let i = 0; i < ev.stages.length; i++) {
      const s = ev.stages[i];
      const count = (s.entries || []).filter(r => r.playerId === id).length + (s.matches || []).filter(m => m.a === id || m.b === id).length;
      if (count) result = s.title;
    }
    return result;
  };
  function appearances(id) { return db.events.filter(e => e.championId === id || e.stages.some(s => (s.entries||[]).some(x=>x.playerId===id)||(s.matches||[]).some(m=>m.a===id||m.b===id))); }
  const championshipCount = id => db.events.filter(e=>e.championId===id).length;
  const chip = (text, c='') => `<span class="chip ${c}">${esc(text)}</span>`;
  const empty = txt => `<div class="empty-state">${esc(txt)}</div>`;
  const isNumeric = v => /^(0|[1-9]\d*)$/.test(String(v??'').trim());
  const resultText = (stage, val) => {
    const raw=clean(val);
    if (!raw) return '—';
    return stage.rankingMode==='worst' && isNumeric(raw) ? `ワースト${raw}位` : isNumeric(raw) ? `${raw}位` : raw;
  };
  const isDrop=val=>clean(val).toUpperCase()==='DROP';
  const rankMarkup=(stage,val)=>stage.rankingMode==='worst'&&isNumeric(val)?`<span class="worst-prefix">ワースト</span><span class="worst-number">${esc(val)}<small>位</small></span>`:esc(resultText(stage,val));
  const statusBadge = text => {
    const s=clean(text);
    if (!s) return '';
    const cls=/不明|推定|候補/.test(s)?'':/通過|勝利|復活|進出|優勝|完走/.test(s)?'success':/敗退|失格|棄権/.test(s)?'fail':/シード|アドバンテージ/.test(s)?'adv':'';
    return `<span class="pill ${cls}">${esc(s)}</span>`;
  };
  function load(){
    const initial=window.MUW_ARCHIVE_DATA;
    if(!initial||!Array.isArray(initial.players)||!Array.isArray(initial.events)){$('app').innerHTML='<div class="notice warn">記録を読み込めませんでした。</div>';return;}
    db=clone(initial);normalize();render();
  }
  function normalize(){
    if(!db||!Array.isArray(db.players)||!Array.isArray(db.events))throw Error('データ形式が正しくありません');
    window.MUWUpgradeArchive?.(db);
    db.site||={title:'MARBLE UNCHI WARRIOR',subtitle:'RECORD ARCHIVE',introduction:''};
    db.site.stageColors={...STAGE_COLORS,...(db.site.stageColors||{})};
    db.players.forEach(p=>{p.name||='名称未設定';p.title||='';p.color=safeColor(p.color);const m=window.MUWMarbles.config(p);p.marblePattern=m.pattern;p.marbleNumber=m.number;p.marbleSecondary=m.secondary;p.marbleEffectColor=m.effect;p.marbleEffectType=m.effectType;p.marbleFlagCode=m.flag;p.marbleCustomKind=m.custom;});
    db.events.forEach(e=>{if(!e.playerTitles||typeof e.playerTitles!=='object'||Array.isArray(e.playerTitles)){e.playerTitles={};if(e.id==='11th'){const original=window.MUW_ARCHIVE_DATA.events.find(v=>v.id==='11th')?.playerTitles||{"player-obs11-019":"知力、体力、時のウン","player-obs11-021":"大便黒天","player-obs11-029":"真鯖のサイ\"ソク\"王","player-obs11-020":"運否天賦のギャンブラー","player-obs11-003":"U(NCHI) & R","player-obs11-026":"みちのくダークプープⅡ"};for(const [id,title] of Object.entries(original)){const p=player(id);if(p){e.playerTitles[p.id]=title;if(p.title===title)p.title='';}}}}e.stages||=[];e.format||='standard';e.prize||='ウンチ大明神';e.championId||='';e.description||='';e.notes||='';e.stages.forEach(st=>{st.kind||='entries';st.entries||=[];st.matches||=[];st.description||='';st.rankingMode||='normal'})});
    db.events.forEach(e=>{if(e.id==='unchampion')e.prize='KING OF UNCHI';cleanQualOutcomes(e);cleanLongRaceOutcomes(e);});
  }
  const routeParts = () => (location.hash.slice(2)||'').split('/').map(x=>decodeURIComponent(x)).filter(Boolean);
  function setActiveNav(route){document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===(route||'home')));}
  // Motion: set initial opacity synchronously, before the new DOM can paint.
  const MOTION={exit:170,enter:480,stagger:65,distance:18,rightDistance:28};
  let revealObserver=null,routeSequence=0,routeExit=null,routeProgress=null;
  const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animatePage(route){
    revealObserver?.disconnect();revealObserver=null;
    if(reduceMotion()||!Element.prototype.animate)return;
    const app=$('app');
    const selectors=route==='tournament'?'.breadcrumbs,.edition-nav,.key-visual,.detail-head > div:first-child,.champion-panel,.stage-jumps,.stage-card,.tournament-remarks':route==='player'?'.breadcrumbs,.profile-kicker,.profile-hero,.section-head,.history-card':route==='players'?'.directory-heading,.section-head,.player-card':'.hero,.section-head,.event-card,.timeline-nav';
    const nodes=[...app.querySelectorAll(selectors)];
    nodes.forEach(el=>el.classList.add('reveal-pending'));
    const reveal=els=>els.forEach((el,i)=>{
      const right=el.matches('.history-card,.champion-panel,.profile-hero');
      const from=right?`translateX(${MOTION.rightDistance}px)`:`translateY(${MOTION.distance}px)`;
      const anim=el.animate([{opacity:0,transform:from},{opacity:1,transform:'none'}],{duration:MOTION.enter,delay:Math.min(i,5)*MOTION.stagger,easing:'cubic-bezier(.18,.85,.25,1)',fill:'backwards'});
      if(el.matches('.profile-hero')){
        const marble=el.querySelector('.marble.big');
        if(marble){
          const distance=Math.min(240,Math.max(100,window.innerWidth*.18));
          const timing={duration:820,delay:Math.min(i,5)*MOTION.stagger+30,easing:'cubic-bezier(.16,.78,.22,1)',fill:'backwards'};
          marble.animate([{opacity:0,transform:`translateX(-${distance}px)`},{opacity:1,offset:.25},{opacity:1,transform:'translateX(0)'}],timing);
          marble.querySelector('.rolling-marble-surface')?.animate([{transform:'rotate(-360deg)'},{transform:'rotate(0deg)'}],timing);
        }
      }
      el.classList.remove('reveal-pending');
    });
    if(!('IntersectionObserver' in window)){reveal(nodes);return;}
    revealObserver=new IntersectionObserver(entries=>{
      const ready=entries.filter(x=>x.isIntersecting).map(x=>x.target).sort((a,b)=>nodes.indexOf(a)-nodes.indexOf(b));
      for(const el of ready)revealObserver?.unobserve(el);
      reveal(ready);
    },{threshold:0,rootMargin:'0px 0px 60px 0px'});
    nodes.forEach(el=>revealObserver.observe(el));
  }
  async function navigate(){
    if(location.hash===renderedHash)return;
    const seq=++routeSequence,app=$('app');
    // Repeated navigation must continue from the current visual state, not
    // reset to full opacity while a previous exit is already in progress.
    const startOpacity=getComputedStyle(app).opacity,startTransform=getComputedStyle(app).transform;
    routeExit?.cancel();routeProgress?.cancel();
    if(!reduceMotion()&&Element.prototype.animate){
      app.classList.add('route-leaving');
      routeExit=app.animate([{opacity:Number(startOpacity),transform:startTransform},{opacity:0,transform:'translateX(-10px)'}],{duration:MOTION.exit,easing:'cubic-bezier(.4,0,.8,.5)',fill:'forwards'});
      routeProgress=$('route-progress').animate([{transform:'scaleX(0)',opacity:1},{transform:'scaleX(.7)',opacity:1,offset:.5},{transform:'scaleX(1)',opacity:0}],{duration:MOTION.exit+MOTION.enter,fill:'none',easing:'ease-out'});
      try{await routeExit.finished;}catch(err){return;}
    }
    if(seq!==routeSequence)return;
    // Hide the replacement until render() has armed every reveal animation.
    app.style.opacity='0';
    routeExit?.cancel();routeExit=null;
    window.scrollTo({top:0,left:0,behavior:'instant'});
    try{render();}finally{app.style.removeProperty('opacity');app.classList.remove('route-leaving');}
  }
  function render(){
    if(!db)return;
    const parts=routeParts(), route=parts[0]||'home';
    setActiveNav(route==='players'?route:route==='player'?'players':'home');
    document.title = `${route==='player'?pname(parts[1]):route==='tournament'?eventById(parts[1])?.shortName||'大会':route==='players'?'プレイヤー':'大会一覧'} | MUW ARCHIVE`;
    let markup = '';
    if(route==='tournament')markup=renderTournament(parts[1]);
    else if(route==='player')markup=renderPlayer(player(parts[1])?.id||parts[1]);
    else if(route==='players')markup=renderPlayers();
    else markup=renderHome();
    $('app').innerHTML=markup;
    renderedHash=location.hash;
    $('app').querySelectorAll('img[data-key-visual]').forEach(img=>{const hide=()=>{const figure=img.closest('.key-visual'),grid=figure?.parentElement;figure?.remove();if(grid?.matches('.key-visual-grid')&&!grid.children.length)grid.remove();};img.addEventListener('error',hide,{once:true});if(img.complete&&!img.naturalWidth)hide();});
    alignRaceRows();
    animatePage(route);
  }
  function alignRaceRows(){
    // One shared set of track heights for the entire stage, including rows
    // that do not contain badges or times. Re-measure after resizing/font load.
    document.querySelectorAll('.archive-sets-grid,.archive-blocks-grid').forEach(grid=>{
      const main=grid.classList.contains('archive-blocks-grid');
      const keys=['--race-name-track','--race-badge-track','--race-bottom-track'];
      keys.forEach(k=>grid.style.removeProperty(k));
      const people=[...grid.querySelectorAll(main?'.archive-block-person':'.archive-set-person')];
      const height=(sel)=>Math.ceil(Math.max(0,...people.map(el=>el.querySelector(sel)?.getBoundingClientRect().height||0)));
      grid.style.setProperty('--race-name-track',Math.max(24,height('.race-name-line'))+'px');
      grid.style.setProperty('--race-badge-track',Math.max(18,height('.race-top-line'))+'px');
      grid.style.setProperty('--race-bottom-track',Math.max(16,height('.race-bottom-line'))+'px');
    });
  }
  window.addEventListener('resize',alignRaceRows);
  if(document.fonts){document.fonts.ready.then(alignRaceRows);document.fonts.addEventListener?.('loadingdone',alignRaceRows);}
  function updateHistory(){
    const rows=(Array.isArray(db.site.updates)?db.site.updates:[]).filter(x=>clean(x.text)).slice().sort((a,b)=>dateDisplay(b.date).localeCompare(dateDisplay(a.date)));
    if(!rows.length)return '';
    const row=x=>`<div class="update-row"><time>${esc(dateDisplay(x.date))}</time><span>${esc(x.text)}</span></div>`;
    return `<section class="update-history" aria-label="更新履歴"><h2>更新履歴 <small>NEWS</small></h2><div class="update-content">${row(rows[0])}${rows.length>1?`<details><summary>過去の更新履歴（${rows.length-1}件）</summary>${rows.slice(1).map(row).join('')}</details>`:''}</div></section>`;
  }
  function renderHome(){
    const eds=db.events.filter(x=>x.edition!==null&&x.edition!==undefined).sort((a,b)=>(b.edition||0)-(a.edition||0));
    const ship=db.events.filter(x=>x.edition===null||x.edition===undefined);
    const filtered=eds.filter(e=>(e.name+' '+e.shortName+' '+(e.description||'')+' '+(e.listDescription||'')+' '+(e.catchphrase||'')).toLowerCase().includes(eventSearch));
    return `<section class="hero">
      <div class="hero-main"><h1>MARBLE UNCHI WARRIORS<br><span>RECORD ARCHIVE</span></h1><p>真鯖で不定開催中の企画『MARBLE UNCHI WARRIOR』歴代大会の記録を閲覧できるサイトです</p></div>
    </section>
    ${updateHistory()}
    <div class="section-head"><h2 class="section-title">大会一覧 <span class="kicker">TOURNAMENT HISTORY</span></h2><div class="toolbar"><label class="search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"></circle><path d="m15 15 6 6"></path></svg><input id="event-search" placeholder="大会を検索" value="${esc(eventSearch)}" aria-label="大会を検索"></label></div></div>
    <div class="event-grid" id="events-container">${filtered.map(e=>eventCard(e)).join('')||empty('該当する大会がありません')}</div>
    ${ship.length?`<div class="section-head"><h2 class="section-title">特別大会 <span class="kicker">SPECIAL EVENT</span></h2></div><div class="event-grid">${ship.map(e=>eventCard(e,true)).join('')}</div>`:''}
    <div class="section-head"><h2 class="section-title">歴代大会をたどる <span class="kicker">EDITION INDEX</span></h2></div><div class="timeline-nav">${[...eds].reverse().map(e=>`<a href="#/tournament/${enc(e.id)}">${String(e.edition)}</a>`).join('')}</div>`;
  }
  const shipName=e=>e.id==='unchampion'?'<span class="ship-word">UNCHAMPION</span> <span class="ship-word">SHIP</span>':esc(e.shortName||e.name);
  const visualPaths=e=>[e.keyVisual,e.keyVisual2].map(value=>clean(value)).filter(p=>p&&!/^(?:[a-z]+:|\/\/)/i.test(p));
  const keyVisualMarkup=e=>{const paths=visualPaths(e);return paths.length?`<div class="key-visual-grid">${paths.map((p,i)=>`<figure class="key-visual"><img data-key-visual src="${esc(p)}" alt="${esc(e.shortName||e.name)} キービジュアル ${i+1}" width="1920" height="1080"></figure>`).join('')}</div>`:'';};
  function eventCard(e,featured=false){
    const name=e.championId?pname(e.championId):'記録未登録';
    return `<a class="event-card ${featured?'featured':''}" data-type="${esc(e.format)}" style="--category-color:${categoryColor(e)}" href="#/tournament/${enc(e.id)}"><span class="event-stripe"></span><div class="event-card-inner"><div class="event-card-top"><span class="event-edition">${e.edition==null?shipName(e):String(e.edition)+'<small>'+esc(suffix(e.edition))+'</small>'}</span><span class="event-list-date">${esc(dateDisplay(e.date))}</span></div><div class="event-card-summary"><span class="chip category-chip">${esc(CATEGORY_LABELS[categoryKey(e)]||'SPECIAL')}</span>${e.catchphrase?`<p class="event-card-catchphrase">${esc(e.catchphrase)}</p>`:''}${e.listDescription?`<p class="event-card-desc">${esc(e.listDescription)}</p>`:''}</div><div class="event-card-bottom"><div class="winner-info"><span class="micro-label">${crownJapanese(e)}</span><strong class="winner-name">${e.championId?`${marbleMarkup(player(e.championId))}`:''}${esc(name)}</strong></div><span class="round-arrow">↗</span></div></div></a>`;
  }
  function tournamentNav(e){
    const editions=db.events.filter(x=>x.edition!=null).sort((a,b)=>a.edition-b.edition);
    const i=editions.findIndex(x=>x.id===e.id);
    const prev=i>=0?editions[i-1]:editions.find(x=>x.edition===8);
    const next=i>=0?editions[i+1]:editions.find(x=>x.edition===9);
    const link=(target,dir)=>target?`<a class="edition-nav-link ${dir.toLowerCase()}" href="#/tournament/${enc(target.id)}"><span>${dir==='PREV'?'← PREV':'NEXT →'}</span><strong>${esc(target.shortName||target.name)}</strong></a>`:`<span class="edition-nav-link unavailable" aria-disabled="true"><span>${dir==='PREV'?'← PREV':'NEXT →'}</span><strong>—</strong></span>`;
    return `<nav class="edition-nav" aria-label="前後の大会">${link(prev,'PREV')}<a class="edition-nav-index" href="#/">大会一覧</a>${link(next,'NEXT')}</nav>`;
  }
  const stageTitle=s=>s.id==='survival'?'総合結果':s.title;
  const visibleStages=e=>e.stages.filter(s=>!(e.edition>=1&&e.edition<=3&&s.id==='revival'&&e.stages.some(x=>x.id==='survival')));
  function renderTournament(id){
    const e=eventById(id);if(!e)return `<div class="notice">大会が見つかりません。<a href="#/">大会一覧へ戻る</a></div>`;
    return `<div class="breadcrumbs"><a href="#/">大会一覧</a><span>/</span><span>${esc(e.shortName||e.name)}</span></div>
      ${tournamentNav(e)}
      ${keyVisualMarkup(e)}
      <section class="detail-head v6-head"><div><h1 class="detail-title">${e.id==='unchampion'?shipName(e):esc(e.name)}</h1>${e.catchphrase?`<p class="detail-catchphrase">${esc(e.catchphrase)}</p>`:''}<div class="event-facts"><div><small>開催日</small><strong>${esc(dateDisplay(e.date)||'不明')}</strong></div><div class="participant-fact"><small>総参加者</small><strong>${e.participantCount!=null?`<span class="participant-number">${esc(e.participantCount)}</span><span class="participant-unit">名</span>`:'不明'}</strong></div></div></div><div class="champion-panel">${e.championId?crownOrnament():''}<span class="micro-label">${e.edition===10?'<span><b class="crown-initial">K</b>USODEMASU</span> <span><b class="crown-initial">O</b>HMIKAMI</span>':e.id==='unchampion'?'<span><b class="crown-initial">K</b>ING OF</span> <span><b class="crown-initial">U</b>NCHI</span>':e.edition==null?'<span>WINNER</span>':'<span><b class="crown-initial">U</b>NCHI</span> <span><b class="crown-initial">D</b>AIMYOJIN</span>'}</span><strong>${e.championId?participantLink(e.championId):'未登録'}</strong></div></section>
      ${e.stages.length?`<div class="stage-jumps">${e.id==='unchampion'?'<a style="--stage-color:#0074df" href="#stage-ship-bracket" data-stage-jump="ship-bracket">トーナメント表</a><a style="--stage-color:#b88a24" href="#stage-ship-standings" data-stage-jump="ship-standings">最終順位</a>':''}${visibleStages(e).map(s=>`<a style="--stage-color:${stageColor(s)}" href="#stage-${enc(s.id)}" data-stage-jump="${esc(s.id)}">${esc(stageTitle(s))}</a>`).join('')}</div>`:''}
      ${e.id==='unchampion'?renderShipExtras(e):''}
      <div class="stage-stack">${visibleStages(e).map((s,i)=>stageCard(s,i,e)).join('')}</div>
      <section class="tournament-remarks"><h2>備考</h2><p>${esc(clean(e.remarks)?e.remarks:'(執筆中)')}</p></section>
      ${tournamentNav(e)}
      <div class="section-head"><a href="#/">大会一覧に戻る</a></div>`;
  }
  function renderShipExtras(e){
    const rounds=['quarterfinal','semifinal','final'].map(id=>e.stages.find(s=>s.id===id)?.matches||[]);
    const order=(matches,ids)=>{const rest=[...matches],out=[];for(const id of ids){const i=rest.findIndex(m=>m.a===id||m.b===id);if(i>=0)out.push(...rest.splice(i,1));}return out.concat(rest);};
    const [rawQf,rawSf,final]=rounds;
    const sf=final[0]?order(rawSf,[final[0].a,final[0].b]):rawSf;
    const qf=order(rawQf,sf.flatMap(m=>[m.a,m.b]));
    const aligned=qf.length===4&&sf.length===2&&final.length===1&&sf.every((m,i)=>[m.a,m.b].every(id=>qf.slice(i*2,i*2+2).some(q=>q.winnerId===id)))&&[final[0].a,final[0].b].every(id=>sf.some(m=>m.winnerId===id));
    const card=(m,i,round)=>`<div class="ship-bracket-match ${round}" style="--match-row:${round==='qf'?i*2+1:round==='sf'?i*4+1:1};--match-span:${round==='qf'?2:round==='sf'?4:8}">${['a','b'].map(k=>{const id=m[k],score=clean(m[k==='a'?'scoreA':'scoreB']),win=!!id&&m.winnerId===id;return `<div class="ship-bracket-side ${win?'win':''}">${participantLink(id)}<strong>${score!==''?esc(score)+(round==='final'?'球':''):'—'}</strong></div>`;}).join('')}</div>`;
    const rankIds=Array.isArray(e.overallStandings)?[...new Set(e.overallStandings)].filter(id=>player(id)):[];
    const third=e.stages.find(s=>s.id==='third')?.matches?.[0];
    return `<div class="ship-extras"><section class="stage-card ship-summary-card" id="stage-ship-bracket" style="--stage-color:${stageColor({id:'quarterfinal'})}"><div class="stage-card-header"><h2 class="stage-card-title">トーナメント表 <small class="ship-section-kicker">TOURNAMENT BRACKET</small></h2></div><div class="stage-card-body">${aligned?`<div class="ship-bracket-scroll" tabindex="0" aria-label="トーナメント表（横スクロール可）"><div class="ship-bracket-labels"><span>QUARTERFINAL / 準々決勝</span><span>SEMIFINAL / 準決勝</span><span>FINAL / 決勝</span></div><div class="ship-bracket-chart"><svg class="ship-bracket-connectors" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M30 12.5 H32.5 V37.5 H30 M32.5 25 H35 M30 62.5 H32.5 V87.5 H30 M32.5 75 H35 M65 25 H67.5 V75 H65 M67.5 50 H70" fill="none" stroke="#a5b1bc" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>${qf.map((m,i)=>card(m,i,'qf')).join('')}${sf.map((m,i)=>card(m,i,'sf')).join('')}${final.map((m,i)=>card(m,i,'final')).join('')}</div></div>`:'<p class="soft-note">対戦結果を確認してください。勝ち上がりの情報が揃うとトーナメント表が表示されます。</p>'}${third?`<div class="ship-third-summary"><strong>3位決定戦</strong><span>${participantLink(third.winnerId)} WIN</span><span class="soft-note">${participantLink(third.a===third.winnerId?third.b:third.a)} LOSE</span></div>`:''}</div></section>${rankIds.length?`<section class="stage-card ship-summary-card" id="stage-ship-standings" style="--stage-color:${stageColor({id:'final'})}"><div class="stage-card-header"><h2 class="stage-card-title">最終順位 <small class="ship-section-kicker">FINAL STANDINGS</small></h2></div><div class="stage-card-body"><ol class="ship-standings">${rankIds.map((id,i)=>`<li class="ship-standing-row ${i===0?'is-champion':''}"><span class="ship-standing-rank">${i+1}</span><div class="ship-standing-main">${participantLink(id)}${ptitle(id)?`<div class="ship-player-title">${esc(ptitle(id))}</div>`:''}${i===0?'<span class="ship-king-label">KING OF UNCHI</span>':''}</div></li>`).join('')}</ol></div></section>`:''}</div>`;
  }
  function stageCard(s,index,e){
    const rows=s.entries||[],matches=s.matches||[];
    return `<section class="stage-card" id="stage-${esc(s.id)}" style="--stage-color:${stageColor(s)}"><div class="stage-card-header"><div><div class="stage-card-title"><span class="stage-index">${String(index+1).padStart(2,'0')}</span>${esc(stageTitle(s))}</div>${s.description?`<p class="stage-card-desc">${esc(s.description)}</p>`:''}</div></div><div class="stage-card-body">${s.kind==='matches'?renderMatches(matches,(e.edition===10&&s.id==='semifinal')||(e.id==='unchampion'&&s.id==='quarterfinal'),e.id==='unchampion'&&s.id==='final'?e.championId:'',e,s):renderStageEntries(s,rows,e)}</div></section>`;
  }
  function standout(row,label,kind='',e=null){
    return `<div class="standout ${kind}"><div><span class="standout-label">${esc(label)}</span><strong>${participantLink(row.playerId)}</strong>${eventTitleMarkup(e,row.playerId)}</div>${row.time?`<strong class="standout-time">${esc(row.time)}</strong>`:''}</div>`;
  }
  function renderStageEntries(stage, rows,e){
    if(!rows.length)return empty('NO DATA');
    if(stage.id==='survival'&&e.edition>=1&&e.edition<=3){
      const winner=rows.find(r=>r.playerId===e.championId&&String(r.place)==='1');
      const revival=e.stages.find(x=>x.id==='revival');
      const cut={1:13,2:25,3:24}[e.edition];
      const note=e.edition===3?'<p class="rank-estimate-note">補完順位は記録のある39名を基準に算出（総参加者40名・1名の記録不明）</p>':'';
      return note+(winner?`<div style="--stage-color:${stageColor({id:'final'})}">${standout(winner,crownJapanese(e),'winner survival-champion')}</div>`:'')+renderEntries(stage,rows.filter(r=>r!==winner),revival?{stage:revival,cut}:null);
    }
    if(stage.id==='qual' && rows.length===1 && /予選最速/.test(rows[0].status||''))return standout(rows[0],'予選最速プレイヤー','fastest');
    if(stage.id==='qual' && rows.some(x=>/^(SET|ROUND)\s*\d+$/i.test(clean(x.group))))return renderQualSets(stage,rows);
    if(stage.id==='main' && rows.some(x=>blockKey(x.group)))return renderMainBlocks(stage,rows);
    const winner=stage.id==='repechage'||stage.id==='revival'?rows.find(r=>String(r.place)==='1'||/復活|進出/.test(r.status||'')):['final','survival'].includes(stage.id)?rows.find(r=>r.playerId===e.championId&&String(r.place)==='1')||rows.find(r=>String(r.place)==='1'):null;
    if(winner){const rest=rows.filter(r=>r!==winner);return standout(winner,stage.id==='repechage'?'敗者復活者':stage.id==='revival'?'勝者復活者':crownJapanese(e),'winner',stage.id==='final'&&e.edition>=5?e:null)+(rest.length?renderEntries(stage,rest,null,e):'');}
    return renderEntries(stage,rows,null,e);
  }
  const position=(row)=>isNumeric(row.place)?Number(row.place):9999;
  const isFastestQual=row=>/予選最速/.test(row.status||'');
  function renderQualSets(stage,rows){
    const isRound=rows.some(x=>/^ROUND\s*\d+$/i.test(clean(x.group)));
    const prefix=isRound?'ROUND':'SET';
    const labels=isRound?[...new Set(rows.map(x=>clean(x.group).match(/^ROUND\s*(\d+)$/i)?.[1]).filter(Boolean))].map(Number).sort((a,b)=>a-b):[1,2,3,4];
    const cards=labels.map(i=>{
      const group=rows.filter(x=>new RegExp('^'+prefix+'\\s*'+i+'$','i').test(clean(x.group))).sort((a,b)=>position(a)-position(b));
      return `<article class="archive-set ${isRound?'round-card':''}" style="--round-cols:${isRound?Math.ceil(group.length/5):1}"><header class="archive-set-header"><span>${prefix} <b>${i}</b></span><small>${group.length?group.filter(r=>/通過/.test(r.status||'')).length+'名通過':'未記録'}</small></header>
        <div class="archive-set-rows">${group.length?group.map(r=>{
          const extra=/位候補|位最速/.test(r.status||'');
          const fastest=isFastestQual(r);
          const winner=/位最速通過/.test(r.status||'');
          const className=fastest?'is-fastest':winner?'is-extra-winner':extra?'is-extra':'';
          const status=fastest?'予選最速':winner?`${r.place||'n+1'}位通過`:extra?'候補':/通過/.test(r.status||'')?'通過':r.status||'';
          return `<div class="archive-set-person ${className}"><div class="race-name-line qual-name-line"><span class="archive-place">${r.place?esc(r.place)+'位':'—'}</span><div class="archive-set-name">${participantLink(r.playerId)}</div></div><div class="race-bottom-line qual-bottom-line">${status&&status!=='通過'?`<span class="archive-set-badge">${esc(status)}</span>`:''}${r.time?`<small class="archive-set-clock">${esc(r.time)}</small>`:''}</div></div>`;
        }).join(''):empty('NO DATA')}</div>
      </article>`;
    }).join('');
    const others=rows.filter(x=>!new RegExp('^'+prefix+'\\s*\\d+$','i').test(clean(x.group)));
    const hasBadges=rows.some(r=>clean(r.status)&&r.status!=='通過');
    const hasTimes=rows.some(r=>clean(r.time));
    return `<div class="archive-sets-grid ${isRound?'round-layout':''} ${hasBadges?'':'race-no-badges'} ${hasTimes?'':'race-no-times'}" style="--archive-set-cols:${labels.length}">${cards}</div>${others.length?`<div class="archive-extra-rows"><h4>その他の予選記録</h4>${renderEntries(stage,others)}</div>`:''}`;
  }
  const BLOCKS=['U','N','C','H','I'];
  const BLOCK_COLORS={U:'#c92938',N:'#2476bc',C:'#209c83',H:'#ca8529',I:'#8060bb'};
  const OTHER_BLOCK_COLORS=['#c92938','#267aba','#1b967a','#c88a28','#7655ad','#556b83','#bb5f90'];
  function blockKey(group){
    const value=clean(group).toUpperCase();
    const match=value.match(/^(?:BLOCK\s*)?([A-Z0-9]{1,5})(?:\s*(?:BLOCK|ブロック))?$/);
    return match?match[1]:'';
  }
  function marbleGauge(row){
    if(Number.isInteger(row.recordedChecks) && (row.marblesTotal==null || row.marblesRemaining==null)){
      const n=row.recordedChecks;
      return `<div class="archive-gauges" aria-label="原記録のゴールチェック ${n}/2">${[0,1].map(i=>`<span class="archive-gauge ${i<n?'finished':'remaining'}"></span>`).join('')}</div><small class="archive-gauge-label">ゴールチェック ${n}/2</small>`;
    }
    const total=Number(row.marblesTotal),left=Number(row.marblesRemaining);
    const known=(total===1||total===2) && row.marblesRemaining!==null && row.marblesRemaining!==undefined && Number.isFinite(left) && left>=0&&left<=total;
    if(!known)return `<div class="archive-gauges no-result"><span></span><span></span></div><small class="archive-gauge-label">玉数未記録</small>`;
    // Two progress slots, identical in meaning to the OBS overlay.
    // A fastest qualifier gets the first slot as ADV and has only 1 actual marble.
    const completed=2-left;
    const cells=Array.from({length:2},(_,i)=>{
      const cls=total===1&&i===0?'advantage':i<completed?'finished':'remaining';
      return `<span class="archive-gauge ${cls}"></span>`;
    }).join('');
    return `<div class="archive-gauges" aria-label="残り${left}玉・初期${total}玉">${cells}</div><small class="archive-gauge-label">${total-left}/${total}球ゴール</small>`;
  }
  function renderMainBlocks(stage,rows){
    const present=[...new Set(rows.map(x=>blockKey(x.group)).filter(Boolean))];
    const standard=present.every(k=>BLOCKS.includes(k));
    const blocks=standard?BLOCKS:[...present].sort((a,b)=>a.localeCompare(b,'ja',{numeric:true}));
    const colors=Object.fromEntries(blocks.map((k,i)=>[k,safeColor(stage.blockColors?.[k]||BLOCK_COLORS[k]||OTHER_BLOCK_COLORS[i%OTHER_BLOCK_COLORS.length])]));
    const cards=blocks.map(k=>{
      const group=rows.filter(r=>blockKey(r.group)===k);
      return `<article class="archive-block" style="--group-color:${colors[k]}"><header class="archive-block-header"><strong>${esc(/^\d+(ST|ND|RD|TH)$/.test(k)?k.toLowerCase():k)}</strong><span>BLOCK</span><small>${group.length}名</small></header><div class="archive-block-rows">${group.length?group.map((r,i)=>{
        const finalist=!/不明|推定|候補/.test(r.status||'')&&/決勝進出|FINALIST|準決勝進出/.test(r.status||'');
        const left=Number(r.marblesRemaining),total=Number(r.marblesTotal||2);
        const reach=!finalist&&r.marblesRemaining!==null&&r.marblesRemaining!==undefined&&left===1;
        return `<div class="archive-block-person ${finalist?'is-finalist':reach?'is-reach':''}"><div class="race-top-line main-top-line"><div class="race-left-badges">${finalist?`<span class="archive-block-final-tag">${/準決勝/.test(r.status)?'SEMIFINALIST':'FINALIST'}</span>`:/通過不明/.test(r.status||'')?'<small class="uncertain-result">通過未確定</small>':''}</div><div class="race-right-badges">${r.seed?'<span class="race-badge seed">SEED</span>':''}${r.advantage||Number(r.marblesTotal)===1?'<span class="race-badge adv">ADV.</span>':''}</div></div><div class="race-name-line archive-block-person-line"><span class="archive-block-num">${String(i+1).padStart(2,'0')}</span><div class="archive-block-person-name">${participantLink(r.playerId)}</div></div><div class="race-bottom-line main-gauge-line">${marbleGauge(r)}</div></div>`;
      }).join(''):empty('このブロックの記録は未登録です')}</div></article>`;
    });
    const others=rows.filter(r=>!blockKey(r.group));
    const grid=(list,n)=>`<div class="archive-blocks-grid" style="--archive-block-cols:${n}">${list.join('')}</div>`;
    return `<div class="gauge-legend">色付き：ゴール済み　／　斜線：アドバンテージ</div>${blocks.length===7?grid(cards,4):grid(cards,Math.min(blocks.length,5))}${others.length?`<div class="archive-extra-rows"><h4>その他の本戦記録</h4>${renderEntries(stage,others)}</div>`:''}`;
  }
  function renderEntries(stage,rows,inlineRevival=null,e=null){
    if(!rows.length)return empty('このステージの結果はまだ登録されていません。');
    const blockOrder={U:0,N:1,C:2,H:3,I:4};
    const groupOrder=g=>{
      const text=clean(g).toUpperCase();
      const set=text.match(/^SET\s*(\d+)/);
      if(set)return [0,Number(set[1]),text];
      const block=text.match(/^([UNCHI])\s*BLOCK/);
      if(block)return [1,blockOrder[block[1]],text];
      return [2,0,text];
    };
    const numericPlace=x=>isNumeric(x.place)?Number(x.place):9999;
    const sorted=[...rows].sort((a,b)=>{
      // The overall final should be ranked 1st, 2nd, ... even if finalists came
      // from different blocks. SET results and group entries keep stage order.
      if(stage.rankingMode==='worst'){const ra=numericPlace(a),rb=numericPlace(b);if(ra!==rb)return ra-rb;const race=r=>Number(clean(r.group).match(/第(\d+)/)?.[1]||0);return race(b)-race(a);}
      if(stage.id==='final')return numericPlace(a)-numericPlace(b);
      const ag=groupOrder(a.group),bg=groupOrder(b.group);
      if(ag[0]!==bg[0])return ag[0]-bg[0];
      if(ag[1]!==bg[1])return ag[1]-bg[1];
      const g=ag[2].localeCompare(bg[2],'ja');
      if(g!==0)return g;
      return numericPlace(a)-numericPlace(b);
    });
    const final=stage.id==='final',revivalResult=['repechage','revival'].includes(stage.id);
    const tableStatus=x=>{const v=displayStatus(stage,x);if((final||revivalResult)&&(/敗退|完走|決勝進出/.test(v)||/^\d+位$/.test(v)))return '';return v;};
    const cols=[
      ['順位',x=>final||clean(x.place),x=>`<strong class="rank-main${final&&isDrop(x.place)?' rank-drop':''}">${final&&isDrop(x.place)?'DROP':rankMarkup(stage,x.place)}</strong>`],
      ['プレイヤー',()=>true,x=>participantLink(x.playerId)],
      [stage.rankingMode==='worst'?'勝ち抜けレース':'セット / ブロック',x=>!final&&clean(x.group),x=>esc(x.group||'—')],
      ['',x=>final&&eventTitle(e,x.playerId),x=>eventTitleMarkup(e,x.playerId)],
      ['タイム',x=>clean(x.time),x=>esc(x.time||'—')],
      ['結果',x=>tableStatus(x)&&!['決勝進出','勝ち抜け'].includes(tableStatus(x))&&!/^\d+位$/.test(tableStatus(x))&&!tableStatus(x).startsWith('決勝進出（'),x=>statusBadge(tableStatus(x))||'']
    ].filter(c=>rows.some(c[1]));
    const rowHTML=x=>`<tr>${cols.map(c=>`<td>${c[2](x)}</td>`).join('')}</tr>`;
    let body=sorted.map(rowHTML).join('');
    if(inlineRevival){
      const {stage:revival,cut}=inlineRevival;
      // Results are ranked from worst 1 upward (reverse chronological order).
      // Insert between races after and before the recorded revival boundary.
      const race=r=>Number(clean(r.group).match(/第(\d+)レース$/)?.[1]||0);
      const after=sorted.filter(r=>race(r)>cut),before=sorted.filter(r=>race(r)<=cut);
      const entries=revival.entries||[];
      const winnerCell=`<div class="inline-revival-winners">${entries.length?entries.map(r=>`<div>${participantLink(r.playerId)}<small>${/疑問|\?/.test(r.status||'')?'復活（記録に疑問符）':'復活'}</small></div>`).join(''):'NO DATA'}</div>`;
      const banner=`<tr class="inline-revival" style="--revival-color:${stageColor(revival)}">${cols.map(c=>`<td>${c[0]==='順位'?`<div class="revival-row-label"><strong>勝者復活戦</strong><small>第${cut}レース後</small></div>`:c[0]==='プレイヤー'?winnerCell:''}</td>`).join('')}</tr>`;
      body=after.map(rowHTML).join('')+banner+before.map(rowHTML).join('');
    }
    return `<div class="data-table-wrap"><table class="data-table compact-table"><thead><tr>${cols.map(c=>`<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function renderMatches(matches,four=false,kingId='',e=null,stage=null){
    if(!matches.length)return empty('NO DATA');
    const ship=e?.id==='unchampion',goals=ship&&stage?.id==='final',qf=ship&&stage?.id==='quarterfinal';
    return `<div class="matches ${four?'matches-four':''} ${ship?'ship-matches':''} ${goals?'ship-final-matches':''} ${qf?'ship-quarterfinal-matches':''}">${matches.map((m,i)=>`<div class="match-card"><div class="match-top"><span>${esc(m.label||'MATCH '+String(i+1).padStart(2,'0'))}</span></div>${['a','b'].map(k=>{
      const win=m.winnerId===m[k]&&!!m.winnerId,score=clean(m[k==='a'?'scoreA':'scoreB']),verdict=win?(kingId===m[k]?'KING OF UNCHI':'WIN'):m.winnerId?'LOSE':'—';
      const title=ship?clean(ptitle(m[k])):'';
      const scoreMarkup=goals?`<div class="ship-goal-gauge">${marbleGauge({marblesTotal:2,marblesRemaining:/^[012]$/.test(score)?2-Number(score):null})}</div>`:ship&&score!==''?`<strong class="ship-score">${esc(score)}</strong>`:'';
      return `<div class="match-side ${win?'win':m.winnerId?'loss':''}"><div class="match-person">${title?`<div class="ship-player-title">${esc(title)}</div>`:''}${participantLink(m[k])}</div>${scoreMarkup}<strong class="match-verdict">${verdict}</strong></div>`;
    }).join('<div class="match-divider"></div>')}</div>`).join('')}</div>`;
  }
  // Directory sort: preserve the chronological order of the former champions.
  const DIRECTORY_SORTS={name:'名前順',performance:'総合成績順',participation:'参加順'};
  const byPlayerName=(a,b)=>a.name.localeCompare(b.name,'ja',{numeric:true,sensitivity:'base'})||a.id.localeCompare(b.id);
  function firstRecordedDate(id){
    const dates=db.events.filter(e=>recorded(e,id)||longRaceEliminated(e,id)||e.qualOutcomes?.[id]==='eliminated').map(e=>dateDisplay(e.date)).filter(d=>/^\d{4}\/\d{2}\/\d{2}$/.test(d));
    return dates.sort()[0]||'9999/99/99';
  }
  function performanceKey(id){
    const stats=progressStats(id);
    const places=stats.finals.flatMap(e=>(e.stages.find(s=>s.id==='final')?.entries||[]).filter(r=>r.playerId===id&&isNumeric(r.place)&&Number(r.place)>0).map(r=>Number(r.place)));
    const legacy=db.events.filter(e=>e.edition>=1&&e.edition<=4).flatMap(e=>e.stages.filter(s=>s.id==='survival'||s.id==='final').flatMap(s=>(s.entries||[]).filter(r=>r.playerId===id&&isNumeric(r.place)&&Number(r.place)>0).map(r=>Number(r.place))));
    return [-stats.finals.length,Math.min(Infinity,...places),-stats.semis.filter(e=>e.edition!=null).length,-stats.mains.length,Math.min(Infinity,...legacy)];
  }
  function sortDirectory(players){
    if(playerSort==='participation'){
      const dates=new Map(players.map(p=>[p.id,firstRecordedDate(p.id)]));
      return players.sort((a,b)=>dates.get(a.id).localeCompare(dates.get(b.id))||byPlayerName(a,b));
    }
    if(playerSort==='performance'){
      const keys=new Map(players.map(p=>[p.id,performanceKey(p.id)]));
      return players.sort((a,b)=>{const x=keys.get(a.id),y=keys.get(b.id);for(let i=0;i<x.length;i++){if(x[i]!==y[i])return x[i]<y[i]?-1:1;}return byPlayerName(a,b);});
    }
    return players.sort(byPlayerName);
  }
  function playerDirectory(){
    const found=[...db.players].filter(p=>(p.name+' '+p.title+' '+(p.aliases||'')).toLowerCase().includes(playerSearch));
    const crowns=new Map();
    db.events.filter(e=>e.edition!=null&&e.championId).sort((a,b)=>a.edition-b.edition).forEach(e=>{if(!crowns.has(e.championId))crowns.set(e.championId,[]);crowns.get(e.championId).push(e.edition);});
    const kings=found.filter(p=>crowns.has(p.id)).sort((a,b)=>crowns.get(a.id)[0]-crowns.get(b.id)[0]);
    const rest=sortDirectory(found.filter(p=>!crowns.has(p.id)));
    return `${kings.length?`<div class="section-head"><h2 class="section-title">歴代ウンチ大明神</h2></div><div class="player-grid crown-directory">${kings.map(p=>playerCard(p,crowns.get(p.id))).join('')}</div>`:''}<div class="section-head directory-sort-heading"><h2 class="section-title">登録プレイヤー</h2><label class="directory-sort"><span>並び順</span><select id="player-sort" class="input" aria-label="登録プレイヤーの並び順">${Object.entries(DIRECTORY_SORTS).map(([key,label])=>`<option value="${key}" ${playerSort===key?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="player-grid regular-directory">${rest.map(p=>playerCard(p)).join('')||empty(found.length?'該当するその他のプレイヤーはいません':'該当するプレイヤーがいません')}</div>`;
  }
  function renderPlayers(){
    return `<div class="page-heading directory-heading"><div class="eyebrow">WARRIOR DIRECTORY</div><div class="heading-row"><div><h1>プレイヤー一覧</h1><p>各プレイヤーの成績を閲覧できます</p></div><div class="directory-count"><strong>${db.players.length}</strong><span>WARRIORS</span></div></div><div class="directory-toolbar"><label class="search-box"><svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"></circle><path d="m15 15 6 6"></path></svg><input id="player-search" value="${esc(playerSearch)}" placeholder="名前・肩書きで検索"></label></div></div><div id="players-container">${playerDirectory()}</div>`;
  }
  function progressStats(id){
    const events=[...db.events].sort((a,b)=>(a.edition??99)-(b.edition??99));
    const entered=(e,key)=>e.stages.some(s=>s.id===key&&((s.entries||[]).some(r=>r.playerId===id)||(s.matches||[]).some(m=>m.a===id||m.b===id)));
    const isStageEvent=e=>e.edition>=5;
    const finals=events.filter(e=>isStageEvent(e)&&(entered(e,'final')||e.championId===id));
    const semis=events.filter(e=>isStageEvent(e)&&entered(e,'semifinal'));
    const mains=events.filter(e=>e.edition>=5&&(entered(e,'main')||(e.edition===5&&entered(e,'final')&&!entered(e,'repechage')&&e.stages.find(s=>s.id==='repechage')?.entries.some(r=>String(r.place)==='1'))));
    return {finals,semis,mains};
  }
  function progressMetrics(id,details=false){
    const st=progressStats(id);
    const item=(list,label,key)=>`<div class="progress-stat" style="--stat-color:${stageColor({id:key})}"><span>${label}</span><strong>${list.length}<small>回</small></strong>${details&&key==='final'&&list.length?`<div class="progress-editions">${list.map(e=>`<a href="#/tournament/${enc(e.id)}">${esc(e.shortName||e.name)}</a>`).join('')}</div>`:''}</div>`;
    return item(st.finals,'決勝進出','final')+(st.semis.length?item(st.semis,'準決勝進出','semifinal'):'')+item(st.mains,'本戦進出','main');
  }
  function playerCard(p,crowns=[]){
    return `<a class="player-card ${crowns.length?'former-crown':''}" href="#/player/${enc(p.id)}"><div class="player-card-top">${marbleMarkup(p,'marble')}<div style="min-width:0"><h3>${esc(p.name)}</h3>${clean(p.title)?`<span class="title-text">${esc(p.title)}</span>`:''}</div></div>${crowns.length?`<div class="directory-crown-label">${crowns.map(n=>`${n}代目`).join('・')} ウンチ大明神</div>`:''}<div class="player-metrics">${progressMetrics(p.id)}</div></a>`;
  }
  function renderPlayer(id){
    const p=player(id);if(!p)return `<div class="notice">プレイヤーが見つかりません。<a href="#/players">一覧に戻る</a></div>`;
    const history=appearances(id).sort((a,b)=>(b.edition||0)-(a.edition||0));
    const allEvents=[...db.events].sort((a,b)=>(b.edition||0)-(a.edition||0));
    const crowns=allEvents.filter(e=>e.edition!=null&&e.championId===id).sort((a,b)=>a.edition-b.edition);
    const kingEvent=allEvents.find(e=>e.id==='unchampion'&&e.championId===id);


    return `<div class="breadcrumbs"><a href="#/players">プレイヤー一覧</a><span>/</span><span>${esc(p.name)}</span></div>
      <div class="eyebrow profile-kicker">WARRIOR PROFILE</div><div class="profile-hero">${rollingMarbleMarkup(p)}<div class="profile-identity">${p.title?`<div class="profile-title">${esc(p.title)}</div>`:''}<h1>${esc(p.name)}</h1>${crowns.length||kingEvent?`<div class="profile-crowns">${crowns.map(e=>`<a href="#/tournament/${enc(e.id)}">${e.edition}代目ウンチ大明神${e.edition===10?' / 糞出大御神':''}</a>`).join('')}${kingEvent?`<a class="king-of-unchi" href="#/tournament/${enc(kingEvent.id)}">KING OF UNCHI</a>`:''}</div>`:''}${p.aliases?`<span class="soft-note">別名：${esc(p.aliases)}</span>`:''}</div><div class="profile-stats">${progressMetrics(id,true)}</div></div>
      <div class="section-head"><h2 class="section-title">歴代成績 <span class="kicker">TOURNAMENT HISTORY</span></h2></div>
      <div class="history-list">${allEvents.map(ev=>historyCard(ev,id)).join('')}</div>
      ${p.note?`<div class="section-head"><h2 class="section-title">プロフィールメモ</h2></div><div class="notice" style="white-space:pre-wrap">${esc(p.note)}</div>`:''}`;
  }
  function historyCard(e,id){
    const priority={final:100,survival:100,third:85,semifinal:80,quarterfinal:70,repechage:60,main:50,revival:40,qual:10};
    const stages=e.stages.map((s,i)=>({s,i,rows:(s.entries||[]).filter(x=>x.playerId===id),matches:(s.matches||[]).filter(x=>x.a===id||x.b===id)})).filter(x=>x.rows.length||x.matches.length);
    const isWinner=e.championId===id;
    const absent=confirmedAbsent(e,id);
    if(isWinner&&!stages.some(x=>['final','survival'].includes(x.s.id))){
      const s=e.stages.find(x=>['final','survival'].includes(x.id))||{id:'final',title:'決勝',rankingMode:'normal'};
      stages.push({s,i:e.stages.length,rows:[{place:'1',status:'優勝'}],matches:[]});
    }
    // Supplement only missing qualifying records. A recorded main entrant
    // qualified unless seeded. A final-only seed does not imply participation
    // in qualifying. Inferences are display-only, not database entries.
    const actualStages=new Set(stages.map(x=>x.s.id));
    const mainEntry=stages.find(x=>x.s.id==='main');
    const finalEntry=stages.find(x=>x.s.id==='final');
    const reviveEntry=stages.find(x=>x.s.id==='repechage');
    const qualStage=e.stages.find(x=>x.id==='qual')||{id:'qual',title:'予選'};
    const supplement=(stage,text,reason)=>stages.push({s:stage,i:-1,rows:[],matches:[],supplement:{text,reason}});
    const finalSeed=e.finalSeedIds?.includes(id);
    if(absent){
      supplement({id:'overall-unknown',title:'結果',color:'#7b8794'},'不参加','不参加が確認されています');
    }else if(finalSeed){
      if(!actualStages.has('qual'))supplement(qualStage,'免除(シード)','決勝シードのため予選免除');
      if(!mainEntry)supplement(e.stages.find(x=>x.id==='main')||{id:'main',title:'本戦'},'免除(シード)','決勝シードのため本戦免除');
    }else if(e.edition>=5&&!actualStages.has('qual')){
      // 5th has no main roster, but its four non-revival finalists are known
      // to be block winners under the recorded rules.
      const known5thRevival=e.stages.find(x=>x.id==='repechage')?.entries?.some(r=>String(r.place)==='1');
      const mainFromFinal=e.edition===5&&finalEntry&&!reviveEntry&&known5thRevival;
      if(mainFromFinal&&!mainEntry){supplement(e.stages.find(x=>x.id==='main')||{id:'main',title:'本戦'},'通過','5thの決勝進出経路から補完');}
      if(mainEntry||mainFromFinal){
        const historicalSeed=mainFromFinal&&db.events.some(ev=>ev.edition>=1&&ev.edition<5&&ev.championId===id);
        const seeded=mainEntry?.rows.some(r=>r.seed)||historicalSeed;
        supplement(qualStage,seeded?'免除(シード)':'通過',seeded?'本戦シードの記録に基づく':'本戦出場の記録から補完（セット・順位は不明）');
      }else if(e.qualOutcomes?.[id]&&canSetQualOutcome(e,id)){
        const outcome=e.qualOutcomes[id];
        supplement(outcome==='absent'?{...qualStage,color:'#7b8794'}:qualStage,QUAL_OUTCOMES[outcome],'手動で指定された予選結果');
      }else if(reviveEntry){
        supplement(qualStage,'敗退 or 途中参戦','敗者復活の記録はあるが予選・本戦の出場記録なし');
      }else if(!stages.length){
        supplement(qualStage,'敗退 or 不参加','予選・本戦以降の記録が残っていない可能性もあります');
      }else if(finalEntry){
        supplement(qualStage,'結果不明','決勝進出経路・予選出場の記録がないため確定できません');
      }else{
        supplement(qualStage,'結果不明','予選の記録なし');
      }
    }
    if(!stages.length){
      const early=e.edition>=1&&e.edition<=3;
      const long=e.edition===4;
      supplement({id:'overall-unknown',title:early||long?'総合結果':'結果',color:'#7b8794'},early?'不参加':long?(longRaceEliminated(e,id)?'敗退':'敗退 or 不参加'):'記録不明',early?'記録なしを不参加として表示する指定に基づく':longRaceEliminated(e,id)?'手動指定：出場・敗退確認済み':'順位・出場記録なし');
    }
    stages.sort((a,b)=>(priority[b.s.id]??(20+b.i))-(priority[a.s.id]??(20+a.i))||b.i-a.i);
    function entryResult(s,r){
      const status=displayStatus(s,r),place=clean(r.place),group=clean(r.group),time=clean(r.time);
      const crown=isWinner&&['final','survival'].includes(s.id)&&place==='1';
      const promoted=/準?決勝進出|FINALIST/.test(status)&&!/不明|推定|候補/.test(status);
      let result='',extras=[],small=false;
      if(crown)result=crownJapanese(e);
      else if(s.id==='qual'){
        const pass=/通過|予選最速/.test(status);
        const candidate=/候補/.test(status)&&!pass;
        result=/シード|予選免除/.test(status)?'免除(シード)':pass?'通過':candidate?`${place?place+'位':''}敗退`:/敗退/.test(status)?'敗退':status||'結果不明';
        if(candidate)small=true;
        if(group||(!candidate&&place))extras.push([group,!candidate&&place?`${place}位`:''].filter(Boolean).join('・'));
        if(/予選最速/.test(status))extras.push('予選最速');
        if(time)extras.push(time);
      }else if(s.id==='main'){
        const goals=goalText(r),n=goals?goals.split('/')[0]:null;
        result=promoted?'通過':/不明|推定/.test(status)&&!goals?'結果不明':'敗退';
        if(group||n!==null)extras.push([group,n!==null?`${n}球ゴール`:''].filter(Boolean).join(' '));
      }else if(s.id==='final'){
        result=isDrop(place)?'DROP':place?resultText(s,place):e.edition===4?(/敗退/.test(status)?'敗退':'結果不明'):e.championId?'敗退':'結果不明';
        if(e.edition===4&&!place&&/敗退/.test(status))small=true;
      }else if(s.id==='repechage'){
        if(place&&Number(place)>=2){result=`${place}位`;small=true;}
        else result=promoted||place==='1'||/復活/.test(status)?'復活':place?resultText(s,place):status||'結果不明';
      }else{
        result=place?(s.id==='survival'?rankMarkup(s,place):resultText(s,place)):s.rankingMode==='worst'?'—':(s.id==='survival'?esc(status||'結果不明'):status||'結果不明');
        if(group&&group!=='最終残留')extras.push(group);
      }
      if(time&&s.id!=='qual')extras.push(time);
      if(s.id==='survival'&&crown)extras=[];
      const markup=s.id==='survival'&&!crown?result:esc(result);
      return `<div class="history-result ${small?'history-small-result':''}"><strong class="history-result-main ${crown?'history-crown':''}">${markup}</strong>${extras.length?`<span class="history-result-meta">${extras.map(esc).join('<span class="history-sep"> / </span>')}</span>`:''}${r.seed||r.advantage?`<span class="history-flags">${r.seed?'<span class="race-badge seed">SEED</span>':''}${r.advantage?'<span class="race-badge adv">ADV.</span>':''}</span>`:''}</div>`;
    }
    function matchResult(m){const other=m.a===id?m.b:m.a;const own=clean(m.a===id?m.scoreA:m.scoreB),opp=clean(m.a===id?m.scoreB:m.scoreA);const finalMatch=e.id==='unchampion'&&e.stages.find(s=>s.id==='final')?.matches.includes(m);const score=e.id==='unchampion'&&own!==''&&opp!==''?(finalMatch?` / ${own}/2球ゴール`:` / ${own} - ${opp}`):'';return `<div class="history-result"><strong class="history-result-main">${m.winnerId===id?(e.id==='unchampion'&&isWinner&&e.stages.find(s=>s.id==='final')?.matches.includes(m)?'KING OF UNCHI':'WIN'):m.winnerId?'LOSE':'—'}</strong><span class="history-result-meta">vs ${esc(pname(other))}${esc(score)}</span></div>`;}
    const sections=stages.map(({s,rows,matches,supplement},i)=>{
      if(supplement){return `<section class="history-stage history-secondary history-minor history-inferred" style="--history-color:${stageColor(s)}"><div class="history-stage-label">${esc(stageTitle(s))}</div><div class="history-stage-results"><div class="history-result history-small-result"><strong class="history-result-main">${esc(supplement.text)}</strong></div></div></section>`;}
      let sorted=[...rows].sort((a,b)=>position(a)-position(b));
      if(s.id==='qual')sorted.sort((a,b)=>Number(/通過|予選最速/.test(b.status||''))-Number(/通過|予選最速/.test(a.status||''))||position(a)-position(b));
      if(s.id==='survival'&&sorted.some(r=>isNumeric(r.place)))sorted=sorted.filter(r=>isNumeric(r.place));
      const longLoss=e.edition===4&&s.id==='final'&&sorted.length>0&&sorted.every(r=>!clean(r.place)&&/敗退/.test(r.status||''));
      const minor=longLoss||(s.id==='repechage'&&sorted.length>0&&sorted.every(r=>Number(r.place)>=2))||(s.id==='qual'&&sorted.length>0&&sorted.every(r=>/候補/.test(r.status||'')&&!/通過/.test(r.status||'')));
      const gold=s.id==='survival'&&isWinner;
      return `<section class="history-stage ${i===0?'history-primary':'history-secondary'} ${minor?'history-minor':''}" style="--history-color:${longLoss?'#7b8794':stageColor(gold?{id:'final'}:s)}"><div class="history-stage-label">${esc(stageTitle(s))}</div><div class="history-stage-results">${sorted.map(r=>entryResult(s,r)).join('')}${matches.map(matchResult).join('')}</div></section>`;
    });
    return `<article class="history-card history-v7 ${stages.every(x=>x.supplement)?'history-compact-card':''}"><a class="history-edition ${e.edition==null?'special-edition':''}" href="#/tournament/${enc(e.id)}">${e.id==='unchampion'?shipName(e):esc(e.shortName||e.name)}<small>${esc(dateDisplay(e.date))}</small><span class="history-edition-link">大会詳細 →</span></a><div class="history-body">${sections.join('')||'<span class="soft-note">詳細未登録</span>'}</div></article>`;
  }

  function onClick(event){
    if(event.target.closest('#page-top-button')){event.preventDefault();window.scrollTo({top:0,left:0,behavior:'smooth'});return;}
    const t=event.target.closest('[data-stage-jump]');if(t){event.preventDefault();document.getElementById('stage-'+t.dataset.stageJump)?.scrollIntoView({behavior:'smooth',block:'start'});}
  }
  function onChange(event){
    if(event.target.id==='player-sort'){
      playerSort=Object.hasOwn(DIRECTORY_SORTS,event.target.value)?event.target.value:'name';
      const grid=document.querySelector('.regular-directory');
      if(grid){const cards=[...grid.querySelectorAll('.player-card')],byHref=new Map(cards.map(c=>[c.getAttribute('href'),c]));const sorted=sortDirectory(cards.map(c=>player(decodeURIComponent(c.getAttribute('href').split('/').pop()))).filter(Boolean));for(const p of sorted){const card=byHref.get('#/player/'+enc(p.id));if(card)grid.append(card);}}
      return;
    }
  }
  function onInput(event){
    if(event.target.id==='event-search'){
      eventSearch=event.target.value.toLowerCase();
      const box=$('events-container');if(box)box.innerHTML=db.events.filter(x=>x.edition!=null).sort((a,b)=>b.edition-a.edition).filter(x=>(x.name+' '+x.shortName+' '+(x.description||'')+' '+(x.listDescription||'')+' '+(x.catchphrase||'')).toLowerCase().includes(eventSearch)).map(e=>eventCard(e)).join('')||empty('該当する大会がありません');
    }
    if(event.target.id==='player-search'){
      playerSearch=event.target.value.toLowerCase();
      const box=$('players-container');if(box)box.innerHTML=playerDirectory();
    }
  }
  window.addEventListener('hashchange',navigate);
  document.addEventListener('click',onClick);
  document.addEventListener('change',onChange);
  document.addEventListener('input',onInput);
  load();
})();
