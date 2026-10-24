(function initNarrativeEngine(root,factory){
  const Engine=factory();
  if(typeof module==="object"&&module.exports)module.exports=Engine;
  root.MMSNarrativeEngine=Engine;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const safeObject=value=>value&&typeof value==="object"&&!Array.isArray(value)?value:{};

  function readPath(source,path){
    if(path===undefined||path===null||path==="")return undefined;
    return String(path).split(".").reduce((value,key)=>value===undefined||value===null?undefined:value[key],source);
  }

  function compare(actual,operator,expected){
    switch(operator||"truthy"){
      case "truthy":return Boolean(actual);
      case "falsy":return !actual;
      case "eq":case "===":return actual===expected;
      case "neq":case "!==":return actual!==expected;
      case "gt":case ">":return Number(actual)>Number(expected);
      case "gte":case ">=":return Number(actual)>=Number(expected);
      case "lt":case "<":return Number(actual)<Number(expected);
      case "lte":case "<=":return Number(actual)<=Number(expected);
      case "includes":return Array.isArray(actual)?actual.includes(expected):String(actual||"").includes(String(expected));
      case "in":return Array.isArray(expected)&&expected.includes(actual);
      default:return false;
    }
  }

  function evaluateCondition(condition,scope){
    if(condition===undefined||condition===null)return true;
    if(typeof condition==="boolean")return condition;
    if(Array.isArray(condition))return condition.every(entry=>evaluateCondition(entry,scope));
    if(typeof condition!=="object")return false;
    if(Array.isArray(condition.all))return condition.all.every(entry=>evaluateCondition(entry,scope));
    if(Array.isArray(condition.any))return condition.any.some(entry=>evaluateCondition(entry,scope));
    if(own(condition,"not"))return !evaluateCondition(condition.not,scope);
    if(own(condition,"path"))return compare(readPath(scope,condition.path),condition.op,condition.value);
    return false;
  }

  function resolveValue(specification,scope){
    if(!specification||typeof specification!=="object"||Array.isArray(specification))return specification;
    if(own(specification,"value"))return clone(specification.value);
    if(own(specification,"path")){
      const current=readPath(scope,specification.path);
      if(own(specification,"add"))return Number(current||0)+Number(specification.add||0);
      return clone(current);
    }
    return clone(specification);
  }

  class NarrativeEngine{
    constructor(options={}){
      this.localize=typeof options.localize==="function"?options.localize:key=>String(key||"");
      this.effectHandler=typeof options.applyEffect==="function"?options.applyEffect:()=>{};
      this.context=safeObject(options.context);
      this.graph=null;
      this.currentId="";
      this.variables={};
      this.history=[];
      this.trail=[];
      this.seenNodes=new Set();
      this.completed=false;
      this.onChange=typeof options.onChange==="function"?options.onChange:()=>{};
      this.onComplete=typeof options.onComplete==="function"?options.onComplete:()=>{};
    }

    static validate(graph){
      const errors=[],warnings=[],safe=safeObject(graph),nodes=safeObject(safe.nodes),ids=Object.keys(nodes);
      if(!safe.id)warnings.push("Scene has no stable id.");
      if(!safe.start||!own(nodes,safe.start))errors.push("The start node does not exist.");
      ids.forEach(id=>{
        const node=safeObject(nodes[id]),routes=[Array.isArray(node.choices)&&node.choices.length>0,Boolean(node.next),Boolean(node.end)].filter(Boolean).length;
        if(routes!==1)errors.push(`Node '${id}' must have exactly one route: choices, next or end.`);
        if(node.next&&!own(nodes,node.next))errors.push(`Node '${id}' points to missing node '${node.next}'.`);
        const choiceIds=new Set();
        (node.choices||[]).forEach((choice,index)=>{
          const choiceId=choice.id||`${id}:${index}`;
          if(choiceIds.has(choiceId))errors.push(`Node '${id}' repeats choice id '${choiceId}'.`);
          choiceIds.add(choiceId);
          if(!choice.to||!own(nodes,choice.to))errors.push(`Choice '${choiceId}' points to a missing node.`);
        });
      });
      if(safe.start&&own(nodes,safe.start)){
        const reached=new Set(),walk=id=>{if(reached.has(id)||!own(nodes,id))return;reached.add(id);const node=nodes[id];if(node.next)walk(node.next);(node.choices||[]).forEach(choice=>walk(choice.to));};
        walk(safe.start);ids.filter(id=>!reached.has(id)).forEach(id=>warnings.push(`Node '${id}' is unreachable.`));
      }
      return Object.freeze({ok:errors.length===0,errors:Object.freeze(errors),warnings:Object.freeze(warnings)});
    }

    start(graph,savedState=null){
      const validation=NarrativeEngine.validate(graph);
      if(!validation.ok)throw new Error(`Invalid narrative graph: ${validation.errors.join(" ")}`);
      this.graph=graph;
      const saved=safeObject(savedState);
      this.variables={...clone(safeObject(graph.vars)),...clone(safeObject(saved.variables))};
      this.history=Array.isArray(saved.history)?clone(saved.history).slice(-200):[];
      this.trail=Array.isArray(saved.trail)?saved.trail.filter(id=>own(graph.nodes,id)).slice(-200):[];
      this.seenNodes=new Set(Array.isArray(saved.seenNodes)?saved.seenNodes:[]);
      this.completed=false;
      const restored=own(graph.nodes,saved.currentId);
      this.currentId=restored?saved.currentId:graph.start;
      return this._enter(this.currentId,{applyEntryEffects:!restored,recordHistory:!restored});
    }

    scope(){return {vars:this.variables,game:this.context};}

    _applySet(set){
      const source=safeObject(set),scope=this.scope(),updates={};
      Object.keys(source).forEach(key=>{updates[key]=resolveValue(source[key],scope);});
      Object.assign(this.variables,updates);
    }

    _applyEffects(effects){(Array.isArray(effects)?effects:[]).forEach(effect=>this.effectHandler(clone(effect),this.snapshot()));}

    _enter(nodeId,options={}){
      const node=this.graph.nodes[nodeId];
      this.currentId=nodeId;
      if(options.applyEntryEffects!==false){this._applySet(node.set);this._applyEffects(node.effects);}
      this.seenNodes.add(nodeId);
      if(node.end){
        this.completed=true;
        const final=this.snapshot();this.onComplete(final);return final;
      }
      const presentation=this.presentation();
      if(options.recordHistory!==false&&presentation.text)this.history.push({nodeId,speaker:presentation.speaker,text:presentation.text});
      if(this.history.length>200)this.history=this.history.slice(-200);
      const state=this.snapshot();this.onChange(presentation,state);return state;
    }

    presentation(){
      if(!this.graph||this.completed)return null;
      const node=this.graph.nodes[this.currentId],scope=this.scope();
      const localize=(key,fallback)=>key?this.localize(key,node.params||{},fallback):String(fallback||"");
      const choices=(node.choices||[]).filter(choice=>evaluateCondition(choice.if,scope)).map((choice,index)=>({id:choice.id||`${this.currentId}:${index}`,text:localize(choice.textKey,choice.text),disabled:Boolean(choice.disabled),hint:localize(choice.hintKey,choice.hint)}));
      return Object.freeze({sceneId:this.graph.id||"",nodeId:this.currentId,speaker:localize(node.speakerKey,node.speaker),title:localize(node.titleKey,node.title),text:localize(node.lineKey,node.line),background:node.background||this.graph.background||"",portrait:node.portrait||this.graph.portrait||"",choices:Object.freeze(choices),canContinue:Boolean(node.next),continueLabel:localize(node.continueLabelKey,node.continueLabel),direction:clone(safeObject(node.direction))});
    }

    advance(){
      if(!this.graph||this.completed)return this.snapshot();
      const node=this.graph.nodes[this.currentId];
      if(!node.next)throw new Error(`Narrative node '${this.currentId}' cannot advance.`);
      this._applySet(node.setOnExit);this._applyEffects(node.effectsOnExit);
      const target=this.graph.nodes[node.next],reversible=!node.setOnExit&&!node.effectsOnExit&&!target.set&&!target.effects;
      if(reversible){this.trail.push(this.currentId);if(this.trail.length>200)this.trail=this.trail.slice(-200);}
      return this._enter(node.next);
    }

    choose(choiceId){
      if(!this.graph||this.completed)return this.snapshot();
      const node=this.graph.nodes[this.currentId],scope=this.scope();
      const choice=(node.choices||[]).find((entry,index)=>(entry.id||`${this.currentId}:${index}`)===choiceId);
      if(!choice||!evaluateCondition(choice.if,scope)||choice.disabled)throw new Error("This narrative choice is not available.");
      this._applySet(choice.set);this._applyEffects(choice.effects);
      this.trail=[];
      return this._enter(choice.to);
    }

    back(){
      if(!this.graph||this.completed||!this.trail.length)return this.snapshot();
      const previous=this.trail.pop();
      return this._enter(previous,{applyEntryEffects:false,recordHistory:false});
    }

    snapshot(){return Object.freeze({version:1,sceneId:this.graph&&this.graph.id||"",currentId:this.currentId,variables:clone(this.variables),history:clone(this.history),trail:clone(this.trail),seenNodes:Array.from(this.seenNodes),completed:this.completed});}
  }

  NarrativeEngine.evaluateCondition=evaluateCondition;
  return NarrativeEngine;
});
