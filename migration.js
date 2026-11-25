'use strict';
// Preserve links and references when upgrading older archive data.
(function(root){
 const categoryColors={survival:'#546b81',longrace:'#b88a24',standard:'#0074df',special:'#a04483'};
 const listDescriptions={
 '1st':'全5エリアを繰り返し走る初代大会', '2nd':'47名で競う一斉勝ち抜けレース', '3rd':'全6エリアのコースで最後の1人が決まる', '4th':'70名が挑んだ特設の超ロングレース', '5th':'予選・4ブロックの本戦・敗者復活・決勝を初採用', '6th':'歴代王者の1玉アドバンテージを導入した5ブロック戦', '7th':'予選最速者にアドバンテージを与える5ブロック戦', '8th':'歴代王者がシード参戦する5ブロック戦', '9th':'UNCHAMPION SHIP王者が決勝から参戦', '10th':'7ブロックと1対1の準決勝で糞出大御神を争う特別大会', '11th':'予選4セット・本戦5ブロックから王者を決める大会', 'unchampion':'初代から8代目までの王者による対戦トーナメント'};
 const slogans={ '7th':'季節は巡り、始まる春と新たなるウンチ','8th':'駆けろウンチのミルキーウェイ！','9th':'ウンチの香、秋風と共に。','10th':'『糞出大御神 -クソデマスオオミカミ-』は、誰だ','11th':'WELCOME BACK UNCHI WARRIORS!!' };
 function upgrade(data){
  if(!data||!Array.isArray(data.players)||!Array.isArray(data.events))return data;
  const used=new Set(data.players.map(p=>p.id)); const mapping={};
  for(const p of data.players){const m=/^player-(?:obs11|hist)-(\d+)$/.exec(p.id);if(!m)continue;let n=Number(m[1]);let next=`player-${String(n).padStart(3,'0')}`;while(used.has(next)){next=`player-${String(++n).padStart(3,'0')}`;}used.add(next);mapping[p.id]=next;p.legacyIds=[...new Set([...(p.legacyIds||[]),p.id])];p.id=next;}
  const remap=id=>mapping[id]||id;
  data.site||={};data.site.introduction='真鯖で不定開催中の企画『MARBLE UNCHI WARRIOR』歴代大会の記録を閲覧できるサイトです';
  for(const e of data.events){
   if(e.id==='unchampoin')e.id='unchampion';
   for(const key of ['name','shortName','prize','description','notes'])if(typeof e[key]==='string')e[key]=e[key].replace(/UNCHAMPOIN/g,'UNCHAMPION');
   e.catchphrase??=slogans[e.id]||'';e.keyVisual??='';
   e.championId=remap(e.championId);
   if(e.longRaceOutcomes)e.longRaceOutcomes=Object.fromEntries(Object.entries(e.longRaceOutcomes).map(([k,v])=>[remap(k),v]));
   if(e.qualOutcomes)e.qualOutcomes=Object.fromEntries(Object.entries(e.qualOutcomes).map(([k,v])=>[remap(k),v]));
   if(e.playerTitles)e.playerTitles=Object.fromEntries(Object.entries(e.playerTitles).map(([k,v])=>[remap(k),v]));
   if(Array.isArray(e.finalSeedIds))e.finalSeedIds=e.finalSeedIds.map(remap);
   for(const s of e.stages||[]){for(const r of s.entries||[])r.playerId=remap(r.playerId);for(const m of s.matches||[])for(const k of ['a','b','winnerId'])m[k]=remap(m[k]);}
  }
  if(!data.archiveV12Migrated){
   const y=data.players.find(p=>p.name==='YuAi');
   if(y)for(const edition of [9,10]){const e=data.events.find(x=>x.edition===edition);if(!e)continue;e.finalSeedIds=[...new Set([...(e.finalSeedIds||[]),y.id])];const final=e.stages.find(s=>s.id==='final');if(edition===10&&final&&!final.entries.some(r=>r.playerId===y.id)){final.entries.push({playerId:y.id,place:'',group:'',time:'',status:'決勝シード',note:'主催者による追加情報（決勝シード・順位不明）',source:'owner_confirmation'});e.notes=[e.notes,'YuAiは決勝シード（主催者確認）。元の準決勝勝者4名の記録も保持。YuAiの決勝順位は不明。'].filter(Boolean).join('\n');}}
   data.archiveV12Migrated=true;
  }
  data.site.categoryColors={...categoryColors,...(data.site.categoryColors||{})};
  for(const e of data.events){
   e.listDescription??=listDescriptions[e.id]||e.description||'';
   e.remarks??='';
   e.category??=e.format==='championship'?'special':Object.hasOwn(categoryColors,e.format)?e.format:'standard';
   if(!Object.hasOwn(categoryColors,e.category))e.category='standard';
   e.absentPlayerIds=Array.isArray(e.absentPlayerIds)?[...new Set(e.absentPlayerIds.map(remap))]:[];
  }
  if(!data.archiveV13Migrated){
   const y=data.players.find(p=>p.name==='YuAi'),e=data.events.find(v=>v.edition===10);
   if(y&&e){
    e.finalSeedIds=(e.finalSeedIds||[]).filter(id=>id!==y.id);
    for(const s of e.stages||[])s.entries=(s.entries||[]).filter(r=>!(r.playerId===y.id&&s.id==='final'&&r.status==='決勝シード'));
    e.absentPlayerIds=[...new Set([...e.absentPlayerIds,y.id])];
    e.notes=(e.notes||'').split('\n').filter(line=>!line.includes('YuAiは決勝シード（主催者確認）')).join('\n');
   }
   data.archiveV13Migrated=true;
  }
  if(!data.archiveV29Migrated){
   const e=data.events.find(e=>e.id==='11th');
   const ids=new Set(data.players.filter(p=>['リョージン','だいたち'].includes(p.name)).map(p=>p.id));
   for(const r of e?.stages.find(s=>s.id==='final')?.entries||[])if(ids.has(r.playerId)&&!String(r.place??'').trim())r.place='DROP';
   data.archiveV29Migrated=true;
  }
  return data;
 }
 root.MUWUpgradeArchive=upgrade;
})(typeof window==='undefined'?globalThis:window);
