"""Independent finite oracle: Python tuple sets + fractions.Fraction, no TS code imported."""
import copy, itertools, json, random, subprocess
from fractions import Fraction
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def reference(x):
    qs=sorted(d['id'] for d in x['decisions'])
    acts={a['id']:a for a in x['actions']}
    worlds={w['id']:tuple(w['answers'][q] for q in qs) for w in x['worlds']}
    for e in x['observations']:
        worlds={w:s for w,s in worlds.items() if acts[e['action']]['outcomes'][w]==e['outcome']}
    signatures=set(worlds.values()); n=len(signatures)
    assessments={}
    for a in acts.values():
        possible=set(a['outcomes'][w] for w in worlds)
        buckets=[{worlds[w] for w in worlds if a['outcomes'][w]==k} for k in possible]
        worst=max(map(len,buckets),default=0)
        eligible=(a['permission']=='allowed' and a['available'] and int(a['cost'])<=int(x['remainingBudget']) and len(possible)>1)
        assessments[a['id']]=(eligible,worst,n-worst)
    choices=[a for a in acts.values() if assessments[a['id']][0]]
    if x['coverage']=='complete' and n==0: route,reason,rec='abstain','CONFLICT',None
    elif x['gate']=='denied': route,reason,rec='abstain','GATE_DENIED',None
    elif x['gate']=='unknown': route,reason,rec='abstain','GATE_UNKNOWN',None
    elif x['coverage']=='incomplete': route,reason,rec='abstain','INCOMPLETE_COVERAGE',None
    elif n==1: route,reason,rec='direct','SUFFICIENT',None
    else:
        full=[a for a in choices if assessments[a['id']][1]==1]
        progress=[a for a in choices if assessments[a['id']][2]>0]
        if full:
            route,reason,rec='focused','ONE_ACTION_RESOLVES',min(full,key=lambda a:(int(a['cost']),a['id']))['id']
        elif not choices: route,reason,rec='abstain','NO_ADMISSIBLE_ACTION',None
        elif progress:
            route,reason,rec='exploratory','PARTIAL_PROGRESS',min(progress,key=lambda a:(-Fraction(assessments[a['id']][2],int(a['cost'])),int(a['cost']),a['id']))['id']
        else: route,reason,rec='exploratory','JOINT_PLAN_REQUIRED',None
    return route,reason,rec,worlds,signatures,assessments

def exhaustive():
    # Every nonempty subset of the four two-bit joint signatures, all binary action partitions.
    # All triples: subset × action-A mapping × action-B mapping = 15 × 16 × 16 = 3840.
    base=list(itertools.product(['v0','v1'],repeat=2))
    partitions=list(itertools.product(['o0','o1'],repeat=4))
    for mask in range(1,16):
        chosen=[i for i in range(4) if mask & (1<<i)]
        for pa,pb in itertools.product(partitions,repeat=2):
            yield dict(coverage='complete',gate='allowed',costUnit='unit',remainingBudget='3',decisions=[dict(id='q1',domain=['v0','v1']),dict(id='q2',domain=['v0','v1'])],worlds=[dict(id=f'w{i}',answers=dict(q1=base[i][0],q2=base[i][1])) for i in chosen],actions=[dict(id=k,capability='synthetic',permission='allowed',available=True,cost=str(j+1),outcomes={f'w{i}':p[i] for i in chosen}) for j,(k,p) in enumerate([('a',pa),('b',pb)])],observations=[])

def random_cases(n=512):
    rng=random.Random(27112026)
    for _ in range(n):
        m=rng.randrange(0,10); actions=[]
        worlds=[dict(id=f'w{i}',answers={f'q{j}':f'v{rng.randrange(3)}' for j in range(3)}) for i in range(m)]
        for j in range(rng.randrange(1,5)):
            actions.append(dict(id=f'a{j}',capability='synthetic',permission=rng.choice(['allowed','allowed','unknown','denied']),available=rng.choice([True,True,False]),cost=str(rng.choice([1,2,3,9007199254740992,9007199254740993])),outcomes={w['id']:f'o{rng.randrange(3)}' for w in worlds}))
        obs=[dict(action=rng.choice(actions)['id'],outcome=f'o{rng.randrange(4)}',source=f'e{i}') for i in range(rng.randrange(3))]
        yield dict(coverage=rng.choice(['complete','complete','incomplete']),gate=rng.choice(['allowed','allowed','unknown','denied']),costUnit='unit',remainingBudget=str(rng.choice([0,1,3,9007199254740993])),decisions=[dict(id=f'q{j}',domain=['v0','v1','v2']) for j in range(3)],worlds=worlds,actions=actions,observations=obs)

def verify(cases):
    run=subprocess.run(['node','tests/batch.mjs'],cwd=ROOT,input=json.dumps(cases),text=True,capture_output=True,check=True)
    actual=json.loads(run.stdout);assert len(actual)==len(cases)
    for i,(x,r) in enumerate(zip(cases,actual)):
        route,reason,rec,worlds,sigs,ass=reference(x)
        assert (r['route'],r['reason'],r['recommendedAction'])==(route,reason,rec),i
        assert r['worldIds']==sorted(worlds),i
        assert set(map(tuple,r['signatures']))==sigs,i
        assert r['signatureCount']==len(sigs),i
        assert r['sufficient']==(x['coverage']=='complete' and len(sigs)==1),i
        assert {a['id']:(a['eligible'],a['worstResidual'],a['guaranteedReduction']) for a in r['actions']}==ass,i
    return len(cases)
if __name__=='__main__':
    exhaustive_cases=list(exhaustive()); rnd=list(random_cases())
    # Batch to bound transient memory; all cases compared individually.
    for name,cases in [('exhaustive',exhaustive_cases),('seeded',rnd)]:
        n=sum(verify(cases[i:i+256]) for i in range(0,len(cases),256))
        print(f'{name}: {n}/{len(cases)} PASS')
    print(f'differential total: {len(exhaustive_cases)+len(rnd)} PASS')
