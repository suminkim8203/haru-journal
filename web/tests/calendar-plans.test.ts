import test from 'node:test';
import assert from 'node:assert/strict';
import {completedPlanHidden,planCompletion,planWeekSegments,plansOnDay,tasksInPlan} from '../src/lib/calendar-plans.ts';
import type {Plan,Snapshot,Task} from '../src/lib/contracts.ts';

const plan=(id:string,kind:Plan['kind']='general',start='2026-09-22',end='2026-09-25'):Plan=>({id,title:id,kind,start_date:start,end_date:end,success_text:'',estimated_minutes:0,priority:'normal',history:[]});
const task=(id:string,plan_id:string,extra:Partial<Task>={}):Task=>({id,plan_id,title:id,description:'',due_date:null,estimated_minutes:30,priority:'normal',complete:false,tags:[],...extra});
const data=(plans:Plan[],tasks:Task[]):Snapshot=>({schemaVersion:6,diaryId:'x',timezone:'Asia/Seoul',revision:0,plans,tasks,placements:[],runs:[],thoughts:[],reflections:[],closures:[],improvements:[],trash:[]});

test('a planned span includes both boundaries without implying a work record',()=>{
 const snapshot=data([plan('a')],[task('one','a')]);
 assert.deepEqual(plansOnDay(snapshot,'2026-09-21'),[]);
 assert.deepEqual(plansOnDay(snapshot,'2026-09-22').map(p=>p.id),['a']);
 assert.deepEqual(plansOnDay(snapshot,'2026-09-25').map(p=>p.id),['a']);
 assert.deepEqual(plansOnDay(snapshot,'2026-09-26'),[]);
 assert.equal(planCompletion(snapshot,snapshot.plans[0]).percent,0);
});

test('completion is based on general task count, including unplaced tasks, and hides only the following Seoul day',()=>{
 const finished='2026-09-24T14:40:00Z'; // 23:40 Asia/Seoul
 const snapshot=data([plan('a')],[task('done','a',{complete:true,completed_at:finished}),task('unplaced','a',{complete:true,completed_at:finished})]);
 assert.deepEqual(planCompletion(snapshot,snapshot.plans[0]),{done:2,total:2,percent:100});
 assert.equal(completedPlanHidden(snapshot,snapshot.plans[0],'2026-09-24'),false);
 assert.equal(completedPlanHidden(snapshot,snapshot.plans[0],'2026-09-25'),true);
 snapshot.tasks[1].completed_at=undefined;
 assert.equal(completedPlanHidden(snapshot,snapshot.plans[0],'2026-09-25'),false);
});

test('routine completion counts only its selected-day occurrence and never hides the parent plan',()=>{
 const routine=plan('r','routine');
 const snapshot=data([routine],[task('one','r',{routine_id:'rule',occurrence_date:'2026-09-24',complete:true}),task('two','r',{routine_id:'rule',occurrence_date:'2026-09-25'}),task('skipped','r',{routine_id:'rule',occurrence_date:'2026-09-24',skipped:true})]);
 assert.deepEqual(tasksInPlan(snapshot,routine,'2026-09-24').map(t=>t.id),['one']);
 assert.deepEqual(planCompletion(snapshot,routine,'2026-09-24'),{done:1,total:1,percent:100});
 assert.equal(completedPlanHidden(snapshot,routine,'2026-09-26'),false);
});

test('a multiweek marker is one segment per week with its title only on the first visible segment',()=>{
 const plans=[plan('cross','general','2026-08-30','2026-09-10')];
 const first=planWeekSegments(plans,'2026-08-30','2026-09-05','2026-09-01','2026-09-30');
 const second=planWeekSegments(plans,'2026-09-06','2026-09-12','2026-09-01','2026-09-30');
 assert.deepEqual(first.map(({start,end,label})=>({start,end,label})),[{start:'2026-09-01',end:'2026-09-05',label:true}]);
 assert.deepEqual(second.map(({start,end,label})=>({start,end,label})),[{start:'2026-09-06',end:'2026-09-10',label:false}]);
});
