"""Prepare private candidate files only. Never activates/restarts the live router."""
import argparse,hashlib,json,re,os
from pathlib import Path
import yaml

parser=argparse.ArgumentParser()
parser.add_argument('--output',required=True)
args=parser.parse_args()
base=Path('/opt/supabase/volumes/api/envoy')
out=Path(args.output).resolve()
assert out.is_relative_to(Path('/opt/supabase/backups')) and out!=base
os.umask(0o077)
out.mkdir(mode=0o700,parents=False,exist_ok=False)
lds=(base/'lds.template.yaml').read_text()
cds=(base/'cds.yaml').read_text()
anchor='                      - match:\n                          prefix: /\n                        direct_response:\n                          status: 404\n'
assert lds.count(anchor)==1,'Expected exactly one root 404 route'
new_lds=lds.replace(anchor,anchor.replace('direct_response:\n                          status: 404','route:\n                          cluster: haru_web'),1)
old_cds=yaml.safe_load(cds)
assert set(old_cds)=={'resources'} and isinstance(old_cds['resources'],list),'Unexpected CDS structure'
assert all(c.get('name')!='haru_web' for c in old_cds['resources']),'Cluster already present'
cluster={'@type':'type.googleapis.com/envoy.config.cluster.v3.Cluster','name':'haru_web','type':'STRICT_DNS','connect_timeout':'1s','lb_policy':'ROUND_ROBIN','load_assignment':{'cluster_name':'haru_web','endpoints':[{'lb_endpoints':[{'endpoint':{'address':{'socket_address':{'address':'haru-web','port_value':8080}}}}]}]}}
indent=re.search(r'(?m)^resources:\s*\n( *)-',cds)
assert indent,'Expected ordinary resource list indentation'
addition='\n'.join(indent[1]+line for line in yaml.safe_dump([cluster],sort_keys=False).splitlines())
new_cds=cds.rstrip()+'\n'+addition+'\n'
assert yaml.safe_load(new_cds)=={'resources':old_cds['resources']+[cluster]},'Existing clusters changed'
yaml.safe_load(new_lds)
hashof=lambda text:hashlib.sha256(text.encode()).hexdigest()
for name,text in [('lds.template.yaml',new_lds),('cds.yaml',new_cds)]:
 (out/name).write_text(text)
 (out/('before-'+name)).write_text(lds if name=='lds.template.yaml' else cds)
review={'activated':False,'rootChange':{'before':'direct_response 404','after':'route haru_web'},'clusterAdded':cluster,'existingClustersPreserved':len(old_cds['resources']),'sourceHashes':{'lds.template.yaml':hashof(lds),'cds.yaml':hashof(cds)},'candidateHashes':{'lds.template.yaml':hashof(new_lds),'cds.yaml':hashof(new_cds)}}
(out/'review.json').write_text(json.dumps(review,indent=2)+'\n')
print(json.dumps(review))
