/** FALP discrete routing prototype. No I/O, tool execution or LLM calls. */
export type Gate = 'allowed' | 'unknown' | 'denied';
export interface Decision { id: string; domain: string[] }
export interface World { id: string; answers: Record<string, string> }
export interface Action {
  id: string; capability: string; permission: Gate; available: boolean;
  cost: string; outcomes: Record<string, string>;
}
export interface Observation { action: string; outcome: string; source: string }
export interface Input {
  coverage: 'complete' | 'incomplete';
  gate: Gate; costUnit: string; remainingBudget: string;
  decisions: Decision[]; worlds: World[]; actions: Action[]; observations: Observation[];
}
const LIMIT = { decisions: 64, worlds: 4096, actions: 128, observations: 512, domain: 128, digits: 128 } as const;
function fail(msg: string): never { throw new TypeError(msg); }
function object(v: unknown, p: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail(p + ': expected plain object');
  for (const key of Reflect.ownKeys(v)) {
    const descriptor = Object.getOwnPropertyDescriptor(v, key)!;
    if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor)) fail(p + ': expected JSON data properties');
  }
  return v as Record<string, unknown>;
}
function fields(o: Record<string, unknown>, expected: string[], p: string): void {
  const actual = Object.keys(o).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) fail(p + ': missing or unexpected fields');
}
function str(v: unknown, p: string): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > 256 || v !== v.trim()) fail(p + ': expected non-empty canonical string (max 256 chars)');
  return v;
}
function id(v: unknown, p: string): string {
  const s = str(v,p);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(s)) fail(p + ': expected canonical ID');
  return s;
}
function gate(v: unknown, p: string): Gate {
  if (v !== 'allowed' && v !== 'unknown' && v !== 'denied') fail(p + ': invalid gate');
  return v;
}
function integer(v: unknown, p: string, positive = false): string {
  if (typeof v !== 'string' || v.length > LIMIT.digits || !/^(0|[1-9][0-9]*)$/.test(v) || (positive && v === '0')) fail(p + ': expected canonical decimal integer string');
  return v;
}
function arr(v: unknown, p: string, min: number, max: number): unknown[] {
  if (!Array.isArray(v) || v.length < min || v.length > max) fail(p + ': invalid array size');
  if (Object.getPrototypeOf(v) !== Array.prototype || Reflect.ownKeys(v).length !== v.length + 1) fail(p + ': expected JSON array');
  const values: unknown[] = [];
  for (let i = 0; i < v.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(v, String(i));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) fail(p + ': expected JSON array elements');
    values.push(descriptor.value);
  }
  return values;
}
const cmp = (a: string,b: string): number => a < b ? -1 : a > b ? 1 : 0;
const sorted = (v: string[]): string[] => [...v].sort(cmp);
function unique(v: string[], p: string): void { if (new Set(v).size !== v.length) fail(p + ': duplicate IDs'); }
function lookup<T>(m: Map<string,T>, k: string): T { const v=m.get(k); if (v===undefined) fail('missing '+k); return v; }
function mapping(v: unknown, keys: string[], p: string): Record<string,string> {
  const o=object(v,p); fields(o,keys,p);
  return Object.fromEntries(keys.map(k=>[k,id(o[k],p+'.'+k)]));
}
/** Validate and canonicalize the entire JSON contract. Completeness/authority are external assertions, not proven here. */
export function validate(input: unknown): Input {
  const o=object(input,'input');
  fields(o,['coverage','gate','costUnit','remainingBudget','decisions','worlds','actions','observations'],'input');
  if (o.coverage !== 'complete' && o.coverage !== 'incomplete') fail('coverage: invalid');
  const coverage=o.coverage;
  const g=gate(o.gate,'gate');
  const costUnit=id(o.costUnit,'costUnit');
  const remainingBudget=integer(o.remainingBudget,'remainingBudget');
  const decisions=arr(o.decisions,'decisions',1,LIMIT.decisions).map((v,i)=>{
    const p=`decisions[${i}]`,d=object(v,p);fields(d,['id','domain'],p);
    const domain=arr(d.domain,p+'.domain',1,LIMIT.domain).map(x=>id(x,p+'.domain'));
    unique(domain,p+'.domain');return {id:id(d.id,p+'.id'),domain:sorted(domain)};
  }).sort((a,b)=>cmp(a.id,b.id));
  const qids=decisions.map(d=>d.id);unique(qids,'decisions');
  const worlds=arr(o.worlds,'worlds',0,LIMIT.worlds).map((v,i)=>{
    const p=`worlds[${i}]`,w=object(v,p);fields(w,['id','answers'],p);
    const answers=mapping(w.answers,qids,p+'.answers');
    for(const d of decisions) if(!d.domain.includes(answers[d.id]!)) fail(p+': out-of-domain answer for '+d.id);
    return {id:id(w.id,p+'.id'),answers};
  }).sort((a,b)=>cmp(a.id,b.id));
  const wids=worlds.map(w=>w.id); unique(wids,'worlds');
  const actions=arr(o.actions,'actions',0,LIMIT.actions).map((v,i)=>{
    const p=`actions[${i}]`,a=object(v,p);fields(a,['id','capability','permission','available','cost','outcomes'],p);
    if(typeof a.available!=='boolean') fail(p+'.available: invalid');
    return {id:id(a.id,p+'.id'),capability:id(a.capability,p+'.capability'),permission:gate(a.permission,p+'.permission'),available:a.available,cost:integer(a.cost,p+'.cost',true),outcomes:mapping(a.outcomes,wids,p+'.outcomes')};
  }).sort((a,b)=>cmp(a.id,b.id));
  unique(actions.map(a=>a.id),'actions'); const am=new Map(actions.map(a=>[a.id,a]));
  const obs=arr(o.observations,'observations',0,LIMIT.observations).map((v,i)=>{
    const p=`observations[${i}]`,e=object(v,p);fields(e,['action','outcome','source'],p);
    const a=id(e.action,p+'.action');lookup(am,a);
    // An outcome outside the modeled support is valid input: it creates a conflict, never certainty.
    return {action:a,outcome:id(e.outcome,p+'.outcome'),source:str(e.source,p+'.source')};
  });
  // Canonical deduplication: same evidence triple is idempotent; conflicting outcomes are retained.
  const observations=[...new Map(obs.map(e=>[JSON.stringify([e.action,e.outcome,e.source]),e])).entries()].sort(([a],[b])=>cmp(a,b)).map(([,e])=>e);
  return {coverage,gate:g,costUnit,remainingBudget,decisions,worlds,actions,observations};
}
/** Exact comparison for non-negative rational metrics with strictly positive denominator. */
export function compareRatios(a: bigint,b: bigint,c: bigint,d: bigint): -1|0|1 {
  if(a<0n||c<0n||b<=0n||d<=0n) fail('invalid rational');
  const left=a*d,right=c*b;return left<right?-1:left>right?1:0;
}
export type Route = 'direct'|'focused'|'exploratory'|'abstain';
export type Reason = 'CONFLICT'|'INCOMPLETE_COVERAGE'|'GATE_DENIED'|'GATE_UNKNOWN'|'SUFFICIENT'|'ONE_ACTION_RESOLVES'|'PARTIAL_PROGRESS'|'JOINT_PLAN_REQUIRED'|'NO_ADMISSIBLE_ACTION';
export interface ActionAssessment {
  id: string; capability: string; cost: string; eligible: boolean;
  exclusion: 'denied'|'permission_unknown'|'unavailable'|'over_budget'|'no_partition'|null;
  outcomes: { outcome:string; worlds:number; signatures:number }[];
  worstResidual: number; guaranteedReduction: number;
  efficiency: { numerator:string; denominator:string }; resolvesAll: boolean;
}
export interface Result {
  route: Route; reason: Reason; recommendedAction: string|null;
  coverage: Input['coverage']; gate: Gate; costUnit:string; remainingBudget:string;
  worldIds:string[]; signatures:string[][]; signatureCount:number;
  decisions: { id:string; possible:string[]; status:'determined'|'undetermined'|'unverified'|'conflict' }[];
  unresolvedCount:number; sufficient:boolean;
  actions: ActionAssessment[]; observations: Observation[];
}
/** Pure function: decision depends only on the validated, supplied finite model. */
export function evaluate(raw: unknown): Result {
  const x=validate(raw); const am=new Map(x.actions.map(a=>[a.id,a]));
  const worlds=x.worlds.filter(w=>x.observations.every(e=>lookup(am,e.action).outcomes[w.id]===e.outcome));
  const signatureByWorld=new Map(worlds.map(w=>[w.id,JSON.stringify(x.decisions.map(d=>w.answers[d.id]!))]));
  const sigKeys=sorted([...new Set(signatureByWorld.values())]);
  const signatures=sigKeys.map(k=>JSON.parse(k) as string[]), n=signatures.length;
  const decisions:Result['decisions']=x.decisions.map(d=>{
    const possible=sorted([...new Set(worlds.map(w=>w.answers[d.id]!))]);
    const status=worlds.length===0&&x.coverage==='complete'?'conflict':x.coverage==='incomplete'?'unverified':possible.length===1?'determined':'undetermined';
    return {id:d.id,possible,status};
  });
  const sufficient=x.coverage==='complete' && n===1;
  const actions:ActionAssessment[]=x.actions.map(a=>{
    const groups=new Map<string,World[]>();
    for(const w of worlds){const k=a.outcomes[w.id]!;const group=groups.get(k)??[];group.push(w);groups.set(k,group);}
    const outcomes=sorted([...groups.keys()]).map(k=>{const ws=lookup(groups,k);return {outcome:k,worlds:ws.length,signatures:new Set(ws.map(w=>lookup(signatureByWorld,w.id))).size};});
    const worstResidual=outcomes.reduce((m,o)=>Math.max(m,o.signatures),0);
    const guaranteedReduction=n-worstResidual;
    const exclusion=a.permission==='denied'?'denied':a.permission==='unknown'?'permission_unknown':!a.available?'unavailable':BigInt(a.cost)>BigInt(x.remainingBudget)?'over_budget':outcomes.length<=1?'no_partition':null;
    return {id:a.id,capability:a.capability,cost:a.cost,eligible:exclusion===null,exclusion,outcomes,worstResidual,guaranteedReduction,efficiency:{numerator:String(guaranteedReduction),denominator:a.cost},resolvesAll:n>1&&outcomes.length>0&&worstResidual===1};
  });
  const base={coverage:x.coverage,gate:x.gate,costUnit:x.costUnit,remainingBudget:x.remainingBudget,worldIds:worlds.map(w=>w.id),signatures,signatureCount:n,decisions,unresolvedCount:decisions.filter(d=>d.status!=='determined').length,sufficient,actions,observations:x.observations};
  const finish=(route:Route,reason:Reason,recommendedAction:string|null=null):Result=>({...base,route,reason,recommendedAction});
  if(x.coverage==='complete'&&n===0) return finish('abstain','CONFLICT');
  if(x.gate==='denied') return finish('abstain','GATE_DENIED');
  if(x.gate==='unknown') return finish('abstain','GATE_UNKNOWN');
  if(x.coverage==='incomplete') return finish('abstain','INCOMPLETE_COVERAGE');
  if(sufficient) return finish('direct','SUFFICIENT');
  const eligible=actions.filter(a=>a.eligible);
  const costCmp=(a:ActionAssessment,b:ActionAssessment)=>BigInt(a.cost)<BigInt(b.cost)?-1:BigInt(a.cost)>BigInt(b.cost)?1:cmp(a.id,b.id);
  const complete=eligible.filter(a=>a.resolvesAll).sort(costCmp)[0];
  if(complete) return finish('focused','ONE_ACTION_RESOLVES',complete.id);
  if(eligible.length===0) return finish('abstain','NO_ADMISSIBLE_ACTION');
  const ranked=eligible.filter(a=>a.guaranteedReduction>0).sort((a,b)=>-compareRatios(BigInt(a.guaranteedReduction),BigInt(a.cost),BigInt(b.guaranteedReduction),BigInt(b.cost))||costCmp(a,b));
  if(ranked[0]) return finish('exploratory','PARTIAL_PROGRESS',ranked[0].id);
  // Zero guaranteed one-step gain is not proof of uselessness: actions can have synergy.
  return finish('exploratory','JOINT_PLAN_REQUIRED');
}
