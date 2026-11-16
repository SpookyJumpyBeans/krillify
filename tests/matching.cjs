const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
 const base=path.join(__dirname,'../extension/');
 const {sameThing,takeThree}=await import(pathToFileURL(path.resolve(base+'core.js')));
 // content.js keeps its own copy of the matcher; load it so both copies are held to the same cases.
 const src=fs.readFileSync(base+'content.js','utf8');
 const copy=src.slice(src.indexOf('  const answerWords = value =>'),src.indexOf('  function markUsed('));
 assert(copy.includes('const sameThing'),'content.js matcher not found');
 const contentSame=vm.runInNewContext(copy+';sameThing');
 const cases=[['Hiball','Hiball Energy',true],['Hiball Energy','hiball',true],['Hi-Ball','Hiball Energy',true],['Hi Ball Energy','Hiball',true],
  ['Beatles','The Beatles',true],['Monster','Monster Energy',true],['redfox','Red fox terrier',true],['Cat','Cat shark',true],['Hiball','HIBALL',true],
  ['Cat','Catfish',false],['Red fox','Red panda',false],['Bear','Bearded dragon',false],['Energy','Hiball Energy',false],['Ox','Ox tongue',false],['','Hiball',false]];
 for(const [a,b,want] of cases){assert.equal(sameThing(a,b),want,`core: ${a} | ${b}`);assert.equal(contentSame(a,b),want,`content: ${a} | ${b}`);}
 // Picks: two forms of one answer never appear together, and a used short form blocks the long one.
 assert.deepEqual(takeThree(['Hiball Energy','Hiball','Celsius','Celsius Live Fit','Bang'],[],[],3,()=>0).map(x=>x.answer),['Hiball Energy','Celsius','Bang']);
 assert.deepEqual(takeThree(['Hiball Energy','Celsius','Bang'],['hiball'],[],3,()=>0).map(x=>x.answer),['Celsius','Bang']);
 assert.deepEqual(takeThree(['Hiball','Celsius'],[],['Hiball Energy'],3,()=>0).map(x=>x.answer),['Celsius']);
 console.log('PASS short-form answer matching in core and content copies, and short-form blocking in picks');
})().catch(e=>{console.error(e);process.exitCode=1});
