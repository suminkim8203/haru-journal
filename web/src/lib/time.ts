export type SegmentKind = 'work' | 'pause' | 'break' | 'interrupt';
export interface TimeSegment { kind: SegmentKind; start: number; end: number | null; }
export function workMilliseconds(segments: readonly TimeSegment[], from: number, to: number, now: number): number {
 if (![from,to,now].every(Number.isFinite) || from>=to) throw new Error('Invalid time window');
 let previousEnd=-Infinity, total=0;
 for(let i=0;i<segments.length;i++){
  const s=segments[i],end=s.end??now;
  if(!Number.isFinite(s.start)||!Number.isFinite(end)||end<s.start||s.start<previousEnd||(s.end===null&&i!==segments.length-1))throw new Error('Invalid or overlapping segment');
  previousEnd=end;
  if(s.kind==='work')total+=Math.max(0,Math.min(end,to)-Math.max(s.start,from));
 }
 return total;
}
