(function storyReview(){
  "use strict";

  const STORE="mms.story-review.v1";
  const $=id=>document.getElementById(id);
  const medical=globalThis.MMSIbnRushdQuest;
  const vistula=globalThis.MMSVistulaAshesQuest;
  const annual=globalThis.MMSAnnualQuest1205;
  const drafts=globalThis.MMSPlannedStoryDrafts;
  const Engine=globalThis.MMSNarrativeEngine;
  const annualSections=["prologue","henry","andronikos","selymbria_search","gilles","coffer","recipient","ending"];
  const config={
    medical:{title:["Рукописи Ібн Рушда","Ibn Rushd's Manuscripts"],description:["П'ять розділів про загублені записи, людей, які їх берегли, та ціну медичного знання.","Five chapters about lost writings, the people who protected them, and the price of medical knowledge."],image:"assets/locations/cordoba_great_mosque.jpg",chapterCount:medical.chapters.length},
    vistula:{title:["Попіл на Віслі","Ashes on the Vistula"],description:["Зникнення Гелени Радош повертає до давньої пожежі й вироку, який змінив долю її родини.","Helena Radosz's disappearance leads back to an old fire and the verdict that changed her family's fate."],image:vistula.BACKGROUNDS.familyWork,chapterCount:vistula.chapters.length},
    annual:{title:["Після Адріанополя","After Adrianople"],description:["Зникла скринька з іменами полонених може врятувати людей або стати чиїмось товаром.","A missing coffer of prisoners' names may save lives or become someone's merchandise."],image:annual.ASSETS.locations.selymbria,chapterCount:annualSections.length}
  };
  for(const [key,draft] of Object.entries(drafts.stories)){
    config[key]={title:[draft.title.uk,draft.title.en],description:[draft.summary.uk,draft.summary.en],image:draft.chapters[0]?.image||"",chapterCount:draft.chapters.length,draft:true};
  }
  const words={
    uk:{back:"← Історії",restart:"З початку",history:"Перечитати",hideHistory:"Сховати",previous:"← Назад",continue:"Продовжити",next:"Наступний розділ →",finish:"Повернутися до історій",open:"Читати історію",chapter:"Розділ",prologue:"Передісторія",coffer:"Скринька",recipient:"Вибір адресата",ending:"Наслідки",simulated:"Для перегляду сюжету цю ігрову дію потрібно змоделювати. Це не результат бою чи перевірки персонажа в основній грі.",win:"Напад відбито",lose:"Загін відступив",recover:"Скриньку знайдено",chooseRecipient:"Кому передати список полонених?",reviewMode:"Режим читання: ресурси й характеристики умовно достатні для перегляду варіантів вибору.",draftStatus:"Квест ще в розробці",draftArt:"Ілюстрація ще в розробці",draftIntro:"Це сценарна заготовка для перегляду, а не доступне завдання в грі."},
    en:{back:"← Stories",restart:"Restart",history:"Backlog",hideHistory:"Hide",previous:"← Back",continue:"Continue",next:"Next chapter →",finish:"Back to stories",open:"Read story",chapter:"Chapter",prologue:"Prologue",coffer:"The coffer",recipient:"Choose a recipient",ending:"Consequences",simulated:"This game action is simulated for story review. It is not a combat or skill-check result in the main game.",win:"Attack repelled",lose:"The party retreats",recover:"Coffer recovered",chooseRecipient:"Who receives the prisoner list?",reviewMode:"Reading mode: resources and attributes are assumed sufficient to inspect the choices.",draftStatus:"Quest still in development",draftArt:"Illustration still in development",draftIntro:"This is a scenario draft for review, not an available quest in the game."}
  };
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
  function storyCopy(text){
    if(state.story!=="fourRoads")return `<p>${esc(text)}</p>`;
    const value=String(text||"");
    const quotes=state.lang==="en"?/(?<![A-Za-z])'([^']+)'/g:/«([^»]+)»/g;
    const blocks=[];
    let cursor=0,match;
    const narration=part=>{for(const paragraph of part.split(/\n\s*\n/)){const trimmed=paragraph.trim();if(trimmed)blocks.push(`<p>${esc(trimmed)}</p>`);}};
    while((match=quotes.exec(value))){
      if(match.index<cursor)continue;
      const before=value.slice(cursor,match.index);
      // Quoted clue terms are not spoken lines.
      if(/(?:слова|вирази|words|phrases)\s*$/i.test(before)&&match[1].split(/\s+/).length<=3)continue;
      narration(before);
      const tail=value.slice(quotes.lastIndex);
      const attribution=tail.match(/^([,.!?]?)\s*([—-]\s*[^.!?]+[.!?]?)/);
      const punctuation=attribution?attribution[1]:(tail.match(/^[,.!?]/)?.[0]||"");
      const spoken=state.lang==="en"?`'${match[1]}'`:`«${match[1]}»`;
      blocks.push(`<blockquote class="story-dialogue">${esc(spoken+punctuation)}${attribution?`<span class="story-attribution">${esc(attribution[2])}</span>`:""}</blockquote>`);
      cursor=quotes.lastIndex+(attribution?attribution[0].length:punctuation.length);
    }
    narration(value.slice(cursor));
    return `<div class="story-copy">${blocks.join("")}</div>`;
  }
  const asset=path=>path?"../"+String(path).replace(/^\/+/,""):"";
  const label=value=>value&&typeof value==="object"?(state.lang==="en"?value.en:value.uk):String(value||"");
  const t=key=>words[state.lang][key];
  const safeState=()=>({version:1,storyRevision:state.story==="fourRoads"?2:null,lang:state.lang,story:state.story,section:state.section,quest:state.quest,screen:state.screen,snapshot:state.snapshot,ending:state.ending});
  function load(){try{const parsed=JSON.parse(localStorage.getItem(STORE)||"null");if(parsed&&parsed.version===1&&config[parsed.story]){
    if(parsed.story==="fourRoads"&&parsed.storyRevision!==2){parsed.section=0;parsed.snapshot=null;parsed.quest={choices:{}};}
    return parsed;
  }}catch(_error){}return {version:1,lang:"uk",story:null,section:0,quest:{},screen:"library",snapshot:null,ending:null};}
  let state=load(),engine=null;
  function save(){try{localStorage.setItem(STORE,JSON.stringify(safeState()));}catch(_error){}}
  function freshQuest(story){return config[story]?.draft?{choices:{}}:story==="medical"?medical.defaultState():story==="vistula"?vistula.defaultState():annual.defaultState();}
  function selectStory(story){state.story=story;state.section=0;state.quest=freshQuest(story);state.snapshot=null;state.ending=null;state.screen="reader";startSection();}
  function resumeStory(){state.screen="reader";startSection(state.snapshot||null);}
  function resetStory(){if(!state.story)return;selectStory(state.story);}
  function sectionName(index){
    if(config[state.story]?.draft)return label(drafts.stories[state.story].chapters[index]?.title);
    if(state.story==="medical")return label(medical.chapters[index]?.title);
    if(state.story==="vistula")return label(vistula.chapters[index]?.title);
    const names={prologue:t("prologue"),coffer:t("coffer"),recipient:t("recipient"),ending:t("ending")};
    return names[annualSections[index]]||label(annual.chapters[Math.min(index-1,annual.chapters.length-1)]?.title);
  }
  function gameContext(){
    const q=state.quest;
    const common={hero:state.lang==="en"?"traveller":"мандрівнику",gold:10000,honey:10,linen:10,tools:10,cityReputation:20,reputation:20,agility:12,healingMedicine:3,strongParty:true};
    if(state.story==="medical")return {...common,mariaChoice:q.choices?.toledo_commentary||"",sevilleChoice:q.choices?.seville_casebook||"",cellarChoice:q.choices?.cordoba_regimen||"",saidFate:q.choices?.said_fate||"",vouchedMaria:q.choices?.toledo_commentary==="vouched_copyist",broughtSupplies:q.choices?.seville_casebook==="brought_supplies",sparedSaid:q.choices?.said_fate==="mercy"};
    if(state.story==="vistula")return {...common,evidenceCount:q.evidence?.length||0,witnessAlive:q.witnessAlive!==false,orderBookRecovered:Boolean(q.orderBookRecovered),milenaTrust:q.milenaTrust||0,hasHelenaLetter:q.evidence?.includes("helena_letter")||false};
    if(config[state.story]?.draft)return {...common,draftChoices:q.choices||{}};
    return common;
  }
  function makeGraph(){
    const ctx=gameContext();
    if(config[state.story]?.draft)return drafts.graphFor(state.story,state.section,state.lang,ctx);
    if(state.story==="medical")return medical.graphFor(state.section,state.lang,ctx);
    if(state.story==="vistula")return vistula.graphFor(state.section,state.lang,ctx,state.quest);
    const scene=annualSections[state.section];
    if(scene==="prologue")return annual.prologueGraph(state.lang);
    if(scene==="ending")return annual.sceneGraph((state.ending||"henry")+"_end",state.lang,ctx,state.quest);
    return annual.sceneGraph(scene,state.lang,ctx,state.quest);
  }
  function effects(effect){
    if(!effect||!effect.type)return;
    const q=state.quest;
    switch(effect.type){
      case "quest_accept":q.accepted=true;break;
      case "evidence_add":if(effect.id&&!q.evidence.includes(effect.id))q.evidence.push(effect.id);break;
      case "fragment":if(effect.id){if(!q.fragments.includes(effect.id))q.fragments.push(effect.id);q.choices[effect.id]=effect.choice||"found";}break;
      case "quest_choice":if(effect.id)q.choices[effect.id]=effect.value;break;
      case "milena_trust":q.milenaTrust=Math.max(-4,Math.min(5,(q.milenaTrust||0)+(effect.amount||0)));break;
      case "milena_truth":q.choices.milenaTruth=effect.scope;break;
      case "witness_stabilized":q.witnessStabilized=!effect.unstable;q.choices.witnessTreatment=effect.method;break;
      case "ambush_prepare":q.choices.ambushPriority=effect.priority;break;
      case "milena_rescued":q.milenaDetained=false;q.choices.milenaRescue=effect.method;break;
      case "helena_found":q.helenaFound=true;break;
      case "finale":q.ending=effect.ending;break;
      case "ending":q.ending=effect.ending;break;
      case "prologue_seen":q.prologueSeen=true;break;
      case "stage_set":q.stage=effect.stage;break;
      case "draft_choice":if(effect.id)q.choices[effect.id]=effect.value;break;
      default:break;
    }
    save();
  }
  function startSection(saved=null){
    if(!state.story)return render();
    state.screen="reader";state.snapshot=saved;
    if(state.story==="annual"&&["coffer","recipient"].includes(annualSections[state.section])){engine=null;save();return render();}
    const graph=makeGraph();
    if(!graph||!Engine.validate(graph).ok){showError("Помилка сценарію: " +(graph?Engine.validate(graph).errors.join(" "):"сцену не знайдено"));return;}
    engine=new Engine({context:gameContext(),localize:(_key,_params,fallback)=>fallback||_key,applyEffect:effects,onChange:(_presentation,snapshot)=>{state.snapshot=snapshot;save();render();},onComplete:snapshot=>{state.snapshot=snapshot;save();render();}});
    try{engine.start(graph,saved);}catch(error){showError(error.message);}
  }
  function nextSection(){
    if(!state.story)return;
    if((state.story==="medical"&&state.section===0||state.story==="annual"&&state.section===1)&&!state.quest.accepted){state.snapshot=null;startSection();return;}
    if(state.section>=config[state.story].chapterCount-1){state.screen="library";state.story=null;state.snapshot=null;engine=null;save();render();return;}
    if(state.story==="vistula"&&state.section===3){state.screen="ambush";save();render();return;}
    state.section++;state.snapshot=null;startSection();
  }
  function simulateAmbush(victory){
    const q=state.quest,priority=q.choices.ambushPriority;
    q.ambushWon=victory;q.witnessAlive=priority==="split"?victory:priority==="witness"?(victory||q.witnessStabilized):q.witnessStabilized&&victory;
    q.orderBookRecovered=victory&&(priority==="split"||priority==="book");q.milenaDetained=true;
    if(q.witnessAlive&&!q.evidence.includes("tomas_testimony"))q.evidence.push("tomas_testimony");
    if(q.orderBookRecovered&&!q.evidence.includes("guard_order_book"))q.evidence.push("guard_order_book");
    state.section=4;state.snapshot=null;startSection();
  }
  function chapterJump(index){
    if(index<0||index>=config[state.story].chapterCount)return;
    state.section=index;state.snapshot=null;
    // Shortcuts are for reading a chapter in isolation; do not alter game saves.
    if(state.story==="vistula"&&index>0){const q=state.quest;q.evidence=[...new Set([...q.evidence,"double_ledger","stanislaw_name","burned_invoice","helena_letter","kazimir_reply","tomas_testimony","guard_order_book"])];q.witnessAlive=true;q.orderBookRecovered=true;q.milenaTrust=Math.max(3,q.milenaTrust||0);q.ending=q.ending||"full_truth";}
    if(state.story==="medical"&&index>0){const q=state.quest;q.choices.toledo_commentary=q.choices.toledo_commentary||"paid_copyist";q.choices.seville_casebook=q.choices.seville_casebook||"brought_supplies";q.choices.cordoba_regimen=q.choices.cordoba_regimen||"careful_excavation";q.choices.said_fate=q.choices.said_fate||"mercy";}
    if(state.story==="annual"&&index===7)state.ending=state.ending||"henry";
    startSection();
  }
  function showError(message){$("scene").innerHTML=`<div class="story-text"><h2>Не вдалося відкрити сцену</h2><p>${esc(message)}</p></div>`;}
  function renderLibrary(){
    const lang=state.lang;
    const card=([id,item])=>`<article class="story-card${item.draft?" is-draft":""}">${item.image?`<img src="${esc(asset(item.image))}" alt="" loading="lazy">`:`<div class="draft-cover" aria-hidden="true">✒</div>`}<div class="card-copy"><span class="kicker">${item.draft?esc(t("draftStatus")):esc(item.chapterCount+" "+(lang==="en"?"parts":"частин"))}</span><h2>${esc(item.title[lang==="en"?1:0])}</h2><p>${esc(item.description[lang==="en"?1:0])}</p>${state.story===id?`<button class="primary" type="button" data-resume="true">${lang==="en"?"Continue reading":"Продовжити читання"}</button><button class="quiet-button" type="button" data-story="${id}">${lang==="en"?"Start again":"Почати спочатку"}</button>`:`<button class="primary" type="button" data-story="${id}">${esc(t("open"))}</button>`}</div></article>`;
    const ready=Object.entries(config).filter(([_id,item])=>!item.draft).map(card).join("");
    const planned=Object.entries(config).filter(([_id,item])=>item.draft).map(card).join("");
    $("library").innerHTML=`<h2 class="library-heading">${lang==="en"?"Playable stories":"Доступні сюжети"}</h2><div class="library-grid">${ready}</div><h2 class="library-heading">${esc(t("draftStatus"))}</h2><p class="library-note">${esc(t("draftIntro"))}</p><div class="library-grid">${planned}</div>`;
  }
  function draftArt(sceneImage=""){
    const chapter=drafts.stories[state.story].chapters[state.section];
    const image=sceneImage||chapter.image;
    if(image)return `<div class="art"><img class="scene-image" src="${esc(asset(image))}" alt="${esc(label(chapter.title))}" onerror="this.hidden=true"></div>`;
    return `<div class="art draft-art"><div class="draft-art-content"><span class="kicker">${esc(t("draftArt"))}</span><p>${esc(label(chapter.artBrief))}</p></div></div>`;
  }
  function renderNavigation(){const list=$("chapterList");list.innerHTML=Array.from({length:config[state.story].chapterCount},(_x,index)=>`<button type="button" class="chapter-button ${index===state.section?"active":""}" data-chapter="${index}" ${index===state.section?'aria-current="step"':''}>${index+1}. ${esc(sectionName(index))}</button>`).join("");$("progress").textContent=`${state.section+1} / ${config[state.story].chapterCount}`;}
  function renderScene(){
    if(state.screen==="ambush"){
      $("scene").innerHTML=`<div class="art"><img class="scene-image" src="${esc(asset(vistula.BACKGROUNDS.ambush))}" alt=""><span class="place">Тинецьке абатство</span></div><div class="story-text"><span class="kicker">${esc(sectionName(3))}</span><h2>${state.lang==="en"?"Attack at the abbey":"Напад на абатство"}</h2><div class="interlude">${esc(t("simulated"))}</div><div class="choices"><button type="button" data-battle="win">${esc(t("win"))}</button><button type="button" data-battle="lose">${esc(t("lose"))}</button></div></div>`;return;
    }
    const special=state.story==="annual"?annualSections[state.section]:"";
    if(special==="coffer"||special==="recipient"){
      const coffer=special==="coffer",bg=coffer?annual.ASSETS.locations.selymbria:annual.ASSETS.locations.adrianople;
      const title=coffer?t("coffer"):t("recipient");
      const description=coffer?t("simulated"):t("chooseRecipient");
      const choices=coffer?`<button type="button" data-coffer="yes">${esc(t("recover"))}</button>`:["henry","eirene","matteo"].map(id=>`<button type="button" data-recipient="${id}">${esc(({henry:["Генріх Фландрський","Henry of Flanders"],eirene:["Ірина Дукиня","Eirene Doukaina"],matteo:["Маттео Контаріні","Matteo Contarini"]})[id][state.lang==="en"?1:0])}</button>`).join("");
      $("scene").innerHTML=`<div class="art"><img class="scene-image" src="${esc(asset(bg))}" alt=""></div><div class="story-text"><span class="kicker">${esc(config.annual.title[state.lang==="en"?1:0])}</span><h2>${esc(title)}</h2><div class="interlude">${esc(description)}</div><div class="choices">${choices}</div></div>`;return;
    }
    if(engine?.completed){
      const last=engine.history[engine.history.length-1];
      const declined=(state.story==="medical"&&state.section===0||state.story==="annual"&&state.section===1)&&!state.quest.accepted;
      $("scene").innerHTML=`${config[state.story].draft?draftArt(engine.graph.nodes[last?.nodeId]?.background):`<div class="art"><img class="scene-image" src="${esc(asset(engine.graph.nodes[last?.nodeId]?.background||config[state.story].image))}" alt=""></div>`}<div class="story-text"><span class="kicker">${esc(config[state.story].draft?t("draftStatus"):config[state.story].title[state.lang==="en"?1:0])}</span><h2>${esc(sectionName(state.section))}</h2><div class="interlude">${esc(config[state.story].draft?t("draftIntro"):declined?(state.lang==="en"?"You have not accepted this task yet. Return to the conversation to continue the story.":"Ти ще не прийняв це доручення. Повернися до розмови, щоб продовжити історію."):t("reviewMode"))}</div><div class="choices"><button type="button" class="primary" data-next="true">${esc(declined?(state.lang==="en"?"Repeat conversation":"Повторити розмову"):state.section===config[state.story].chapterCount-1?t("finish"):t("next"))}</button></div></div>`;return;
    }
    const p=engine?.presentation();if(!p)return;
    const portrait=p.portrait?`<img class="portrait" src="${esc(asset(p.portrait))}" alt="" onerror="this.hidden=true">`:"";
    const buttons=p.choices.length?p.choices.map(choice=>`<button type="button" data-choice="${esc(choice.id)}" ${choice.disabled?"disabled":""}>${esc(choice.text)}${choice.hint?`<small>${esc(choice.hint)}</small>`:""}</button>`).join(""):`<button type="button" class="primary" data-advance="true">${esc(p.continueLabel||t("continue"))}</button>`;
    $("scene").innerHTML=`${config[state.story].draft?draftArt(p.background):`<div class="art"><img class="scene-image" src="${esc(asset(p.background||config[state.story].image))}" alt="" onerror="this.hidden=true">${portrait}${p.direction?.place?`<span class="place">${esc(p.direction.place)}</span>`:""}</div>`}<div class="story-text">${config[state.story].draft?`<span class="speaker">${esc(t("draftStatus"))}</span>`:p.speaker?`<span class="speaker">${esc(p.speaker)}</span>`:`<span class="kicker">${esc(sectionName(state.section))}</span>`}<h2>${esc(p.title||sectionName(state.section))}</h2>${storyCopy(p.text)}<div class="choices">${buttons}</div></div>`;
  }
  function renderHistory(){const opened=!$("history").hidden;$("historyButton").textContent=opened?t("hideHistory"):t("history");$("historyButton").setAttribute("aria-expanded",String(opened));if(!opened)return;$("history").innerHTML=(engine?.history||state.snapshot?.history||[]).map(item=>`<p>${item.speaker?`<strong>${esc(item.speaker)}</strong><br>`:""}${esc(item.text)}</p>`).join("")||`<p>${state.lang==="en"?"No earlier text in this chapter.":"У цьому розділі ще немає попередніх реплік."}</p>`;}
  function render(){
    const reading=Boolean(state.story&&state.screen!=="library");$("library").hidden=reading;$("reader").hidden=!reading;
    $("languageButton").textContent=state.lang==="en"?"УКР":"EN";
    $("libraryButton").textContent=t("back");$("restartButton").textContent=t("restart");$("backButton").textContent=t("previous");
    if(!reading){renderLibrary();return;}
    renderNavigation();renderScene();renderHistory();$("backButton").disabled=!engine||!engine.trail.length;
  }
  $("library").addEventListener("click",event=>{if(event.target.closest("[data-resume]")){resumeStory();return;}const story=event.target.closest("[data-story]")?.dataset.story;if(story)selectStory(story);});
  $("chapterList").addEventListener("click",event=>{const index=event.target.closest("[data-chapter]")?.dataset.chapter;if(index!==undefined)chapterJump(Number(index));});
  $("scene").addEventListener("click",event=>{
    const target=event.target.closest("button");if(!target)return;
    try{
      if(target.dataset.choice){engine.choose(target.dataset.choice);return;}
      if(target.dataset.advance){engine.advance();return;}
      if(target.dataset.next){nextSection();return;}
      if(target.dataset.battle){simulateAmbush(target.dataset.battle==="win");return;}
      if(target.dataset.coffer){state.quest.cofferRecovered=true;state.section++;startSection();return;}
      if(target.dataset.recipient){state.ending=target.dataset.recipient;state.section++;startSection();}
    }catch(error){showError(error.message);}
  });
  $("languageButton").addEventListener("click",()=>{state.lang=state.lang==="uk"?"en":"uk";document.documentElement.lang=state.lang;const saved=engine&&!engine.completed?engine.snapshot():null;if(state.story)startSection(saved);else{save();render();}});
  $("libraryButton").addEventListener("click",()=>{state.screen="library";save();render();});
  $("restartButton").addEventListener("click",resetStory);
  $("backButton").addEventListener("click",()=>{if(engine)engine.back();});
  $("historyButton").addEventListener("click",()=>{$("history").hidden=!$("history").hidden;renderHistory();});
  document.documentElement.lang=state.lang;
  if(state.story&&state.screen!=="library")startSection(state.snapshot||null);else render();
})();
