import unittest
from backup_snapshot import erase_snapshot
A='11111111-1111-4111-8111-111111111111';B='22222222-2222-4222-8222-222222222222'
class SnapshotTests(unittest.TestCase):
 def test_target_has_no_records(self):
  x={'diaryId':A,'plans':[{'title':'private'}],'trash':[{'body':'old'}]};y=erase_snapshot(x,A)
  self.assertTrue(y['erased']);self.assertNotIn('private',str(y));self.assertNotIn('old',str(y));self.assertEqual(len(x['plans']),1)
 def test_other_owner_unchanged(self):
  x={'diaryId':B,'plans':[{'title':'keep'}]};self.assertEqual(erase_snapshot(x,A),x)
 def test_unknown_shape_rejected(self):
  for x in [[],{}, {'plans':[]},{'backupStateVersion':3,'tables':{}}]:
   with self.assertRaises(ValueError):erase_snapshot(x,A)
if __name__=='__main__':unittest.main()
