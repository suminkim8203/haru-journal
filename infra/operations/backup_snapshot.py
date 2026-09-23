"""Typed deletion of legacy diary snapshots. Unknown shapes fail closed."""
import copy,uuid

def erase_snapshot(value,diary):
 diary=str(uuid.UUID(diary))
 if not isinstance(value,dict):raise ValueError('Unknown snapshot shape')
 if value.get('backupStateVersion') in (2,3):
  raise ValueError('Fingerprint manifest must be regenerated from sanitized archive')
 if value.get('erased') is True:return copy.deepcopy(value)
 if 'diaryId' not in value:raise ValueError('Snapshot ownership missing')
 owner=str(uuid.UUID(value['diaryId']))
 if owner!=diary:return copy.deepcopy(value)
 return {'erased':True,'reason':'Account deletion completed; original diary records removed.'}
