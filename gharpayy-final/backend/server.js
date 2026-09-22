const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(__dirname, 'data');
const FILES = {
  leads: path.join(DATA, 'leads.json'),
  seed: path.join(DATA, 'seed-leads.json'),
  calls: path.join(DATA, 'calls.json'),
  movements: path.join(DATA, 'movements.json'),
  movementCare: path.join(DATA, 'movement-care.json'),
  bookingFlows: path.join(DATA, 'booking-flows.json')
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2)); }
function nextId(items) { return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1; }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS'
  });
  res.end(body);
}
function notFound(res) { send(res, 404, { error: 'Route not found' }); }
function stageAfterOutcome(outcome) {
  if (outcome === 'Booked') return ['Booked', 'Onboard customer'];
  if (['Interested', 'Follow-up', 'Call Back'].includes(outcome)) return ['Contacted', outcome === 'Call Back' ? 'Call at agreed time' : 'Send matched options'];
  return ['Contacted', 'Update CRM'];
}
function movementSessionToday() {
  const file = FILES.movementCare;
  if (!fs.existsSync(file)) return {date: todayKey(), status:'not_started', promise:'', resultTarget:2, queue:[], activeIndex:-1, completed:[], qualified:0, summary:''};
  const value = readJson(file);
  return value && value.date === todayKey() ? value : {date:todayKey(), status:'not_started', promise:'', resultTarget:2, queue:[], activeIndex:-1, completed:[], qualified:0, summary:''};
}
function saveMovementSession(value){ writeJson(FILES.movementCare, value); return value; }
function nextMoveLeadIds(leads, limit=30){
  return [...leads].filter(l=>l.stage!=='Booked').sort((a,b)=>b.score-a.score).slice(0,limit).map(l=>l.id);
}
function movementResultStage(result, stage){
  if (result === 'Booked') return ['Booked','Start onboarding'];
  if (result === 'Qualified' || result === 'Interested') return [stage === 'New' ? 'Contacted' : stage, result === 'Qualified' ? 'Schedule tour' : 'Send matched options'];
  if (result === 'Follow-up') return [stage === 'New' ? 'Contacted' : stage, 'Schedule follow-up'];
  if (result === 'Not Interested') return [stage,'Mark lost / revive later'];
  return [stage,'Retry later'];
}
function advanceStage(stage) {
  const flow = {
    New: 'Contacted',
    Contacted: 'Tour Scheduled',
    'Tour Scheduled': 'Tour Done',
    'Tour Done': 'Negotiation',
    Negotiation: 'Booked',
    Booked: 'Booked'
  };
  return flow[stage] || 'Contacted';
}

function defaultBookingMessages(lead) {
  return [
    {from:'customer',text:`Hi, I’m still looking around ${lead.area}. Is the ₹${Number(lead.budget||0).toLocaleString('en-IN')} range workable?`,time:'10:14'},
    {from:'operator',text:`Yes, I can shortlist options in that range. What is your move-in date and preferred property type?`,time:'10:16'},
    {from:'customer',text:'I can decide soon. I mainly need the right option and a clear next step.',time:'10:18'}
  ];
}
function defaultBookingQuestions(lead) {
  return [
    {key:'moveIn',label:'Move-in / decision date'},
    {key:'propertyType',label:'Property type / configuration'},
    {key:'budgetFit',label:'Budget confirmation'},
    {key:'decisionMaker',label:'Who will make the final decision?'}
  ];
}
function getBookingFlows(){ return fs.existsSync(FILES.bookingFlows) ? readJson(FILES.bookingFlows) : {}; }
function saveBookingFlows(value){ writeJson(FILES.bookingFlows,value); return value; }
function getBookingFlow(lead){
  const all=getBookingFlows();
  if(all[String(lead.id)]) return all[String(lead.id)];
  return {leadId:lead.id,leadName:lead.name,messages:defaultBookingMessages(lead),questions:defaultBookingQuestions(lead),answers:{},nextStep:'Send property options',deadlineDate:'',deadlineTime:'',closingPromise:'',status:'Draft',savedAt:null};
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy(new Error('Request too large'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}
async function handleApi(req, res, pathname, query) {
  if (req.method === 'OPTIONS') { res.writeHead(204, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'}); return res.end(); }
  if (req.method === 'GET' && pathname === '/api/health') return send(res, 200, { ok: true, service: 'gharpayy-leadops-backend', timestamp: new Date().toISOString() });

  if (req.method === 'GET' && pathname === '/api/leads') {
    let leads = readJson(FILES.leads);
    const q = String(query.get('q') || '').toLowerCase().trim();
    const stage = String(query.get('stage') || 'all');
    const intent = String(query.get('intent') || 'all');
    if (q) leads = leads.filter(l => [l.name, l.phone, l.area, l.source].join(' ').toLowerCase().includes(q));
    if (stage !== 'all') leads = leads.filter(l => l.stage === stage);
    if (intent !== 'all') leads = leads.filter(l => l.intent === intent);
    leads.sort((a, b) => b.score - a.score);
    return send(res, 200, { leads, count: leads.length });
  }

  const leadMatch = pathname.match(/^\/api\/leads\/(\d+)$/);
  const callMatch = pathname.match(/^\/api\/leads\/(\d+)\/calls$/);
  const movementMatch = pathname.match(/^\/api\/leads\/(\d+)\/movement$/);

  if (req.method === 'GET' && leadMatch) {
    const leads = readJson(FILES.leads); const lead = leads.find(l => l.id === Number(leadMatch[1]));
    return lead ? send(res, 200, lead) : send(res, 404, { error: 'Lead not found' });
  }

  if (req.method === 'POST' && pathname === '/api/leads') {
    let body; try { body = await parseBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const { name, phone, area, budget, intent } = body;
    if (!name || !String(name).trim()) return send(res, 400, { error: 'Name is required' });
    const leads = readJson(FILES.leads);
    const cleanIntent = ['Hot', 'Warm', 'Cold'].includes(intent) ? intent : 'Warm';
    const lead = {
      id: nextId(leads), name: String(name).trim(), phone: String(phone || 'Not provided'), source: 'Manual',
      stage: 'New', intent: cleanIntent, score: cleanIntent === 'Hot' ? 80 : cleanIntent === 'Warm' ? 55 : 30,
      area: String(area || 'Not set'), budget: String(budget || 0), owner: 'Aman', next: 'First call', createdAt: new Date().toISOString()
    };
    leads.unshift(lead); writeJson(FILES.leads, leads); return send(res, 201, lead);
  }


  const bookingMatch = pathname.match(/^\/api\/booking-flow\/(\d+)$/);
  if (req.method === 'GET' && bookingMatch) {
    const leads = readJson(FILES.leads); const lead = leads.find(l => l.id === Number(bookingMatch[1]));
    return lead ? send(res, 200, getBookingFlow(lead)) : send(res, 404, {error:'Lead not found'});
  }
  if (req.method === 'POST' && bookingMatch) {
    let body; try { body = await parseBody(req); } catch (e) { return send(res, 400, {error:e.message}); }
    const id=Number(bookingMatch[1]); const leads=readJson(FILES.leads); const lead=leads.find(l=>l.id===id);
    if(!lead) return send(res,404,{error:'Lead not found'});
    const deadlineDate=String(body.deadlineDate||'').trim(), deadlineTime=String(body.deadlineTime||'').trim();
    const closingPromise=String(body.closingPromise||'').trim();
    if(!closingPromise) return send(res,400,{error:'Closing promise is required'});
    const all=getBookingFlows();
    const flow={...getBookingFlow(lead),...body,leadId:id,leadName:lead.name,answers:body.answers||{},messages:body.messages||getBookingFlow(lead).messages,savedAt:new Date().toISOString()};
    all[String(id)]=flow; saveBookingFlows(all);
    lead.next=String(flow.nextStep||'Follow up'); lead.bookingFlowStatus=flow.status||'Draft'; if(deadlineDate) lead.bookingDeadline=deadlineDate+(deadlineTime?` ${deadlineTime}`:'');
    lead.bookingPromise=closingPromise; lead.lastBookingFlowAt=flow.savedAt;
    writeJson(FILES.leads,leads);
    return send(res,200,flow);
  }

  if (req.method === 'GET' && pathname === '/api/movement-care/today') {
    const session = movementSessionToday();
    return send(res, 200, session);
  }

  if (req.method === 'POST' && pathname === '/api/movement-care/start') {
    let body; try { body = await parseBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const leads = readJson(FILES.leads); const limit = Math.min(30, Math.max(1, Number(body.limit) || 30));
    const promise = String(body.promise || '').trim(); const resultTarget = Math.max(1, Number(body.resultTarget) || 2);
    if (!promise) return send(res, 400, { error:'Daily promise is required' });
    const session = {date:todayKey(),status:'active',promise,resultTarget,queue:nextMoveLeadIds(leads,limit),activeIndex:-1,completed:[],qualified:0,startedAt:new Date().toISOString(),closedAt:null,summary:''};
    return send(res, 201, saveMovementSession(session));
  }

  const mcComplete = pathname.match(/^\/api\/movement-care\/today\/leads\/(\d+)\/complete$/);
  if (req.method === 'POST' && mcComplete) {
    let body; try { body = await parseBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const session = movementSessionToday(); if (session.status !== 'active') return send(res, 400, {error:'Start an active Movement CARE day first'});
    const id=Number(mcComplete[1]); const leads=readJson(FILES.leads); const lead=leads.find(l=>l.id===id);
    if(!lead || !session.queue.includes(id)) return send(res, 404, {error:'Lead is not in today’s queue'});
    if(session.completed.some(x=>x.leadId===id)) return send(res, 400, {error:'Lead already completed today'});
    const action=String(body.action||'Call'), result=String(body.result||'Follow-up'), note=String(body.note||'').trim();
    const [to,next]=movementResultStage(result,lead.stage); const from=lead.stage; lead.stage=to; lead.next=next; if(note) lead.note=note; lead.lastMovementAt=new Date().toISOString(); lead.lastMovementResult=result;
    writeJson(FILES.leads,leads);
    const movements=readJson(FILES.movements); const movement={id:nextId(movements),leadId:id,from,to,action,result,note,day:todayKey(),createdAt:new Date().toISOString()}; movements.push(movement); writeJson(FILES.movements,movements);
    session.completed.push({leadId:id,name:lead.name,action,result,note,completedAt:new Date().toISOString()});
    if(result==='Qualified'||result==='Booked') session.qualified+=1;
    const completedIds = new Set(session.completed.map(x=>x.leadId));
    const nextIndex = session.queue.findIndex(leadId => !completedIds.has(leadId));
    session.activeIndex = nextIndex >= 0 ? nextIndex : -1;
    saveMovementSession(session);
    return send(res,200,{...session,nextLeadId:nextIndex>=0?session.queue[nextIndex]:null});
  }

  if (req.method === 'POST' && pathname === '/api/movement-care/close') {
    const session=movementSessionToday(); if(session.status==='not_started') return send(res,400,{error:'Start Movement CARE first'});
    session.status='closed'; session.closedAt=new Date().toISOString();
    session.summary=`Movement CARE: ${session.completed.length}/${session.queue.length} leads worked; ${session.qualified}/${session.resultTarget} qualified. Promise: ${session.promise}`;
    return send(res,200,saveMovementSession(session));
  }

  if (req.method === 'POST' && callMatch) {
    let body; try { body = await parseBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
    const id = Number(callMatch[1]);
    const { outcome, notes = '', nextFollowUp = null, durationSeconds = 0 } = body;
    if (!outcome) return send(res, 400, { error: 'Call outcome is required' });
    const leads = readJson(FILES.leads); const lead = leads.find(l => l.id === id);
    if (!lead) return send(res, 404, { error: 'Lead not found' });
    const [newStage, next] = stageAfterOutcome(outcome);
    lead.stage = newStage; lead.next = next;
    if (String(notes).trim()) lead.note = String(notes).trim();
    if (nextFollowUp) lead.nextFollowUp = nextFollowUp;
    lead.lastCallAt = new Date().toISOString(); lead.lastCallOutcome = outcome;
    writeJson(FILES.leads, leads);
    const calls = readJson(FILES.calls);
    const call = { id: nextId(calls), leadId: id, outcome, notes: String(notes || ''), nextFollowUp, durationSeconds: Number(durationSeconds) || 0, createdAt: new Date().toISOString() };
    calls.push(call); writeJson(FILES.calls, calls); return send(res, 201, { lead, call });
  }

  if (req.method === 'PATCH' && movementMatch) {
    const id = Number(movementMatch[1]); const leads = readJson(FILES.leads); const lead = leads.find(l => l.id === id);
    if (!lead) return send(res, 404, { error: 'Lead not found' });
    const from = lead.stage; const to = advanceStage(from); lead.stage = to;
    lead.next = to === 'Booked' ? 'Onboard customer' : to === 'Tour Scheduled' ? 'Confirm tour' : to === 'Tour Done' ? 'Post-tour call' : to === 'Negotiation' ? 'Handle objection' : 'Qualification call';
    writeJson(FILES.leads, leads);
    const movements = readJson(FILES.movements); const movement = { id: nextId(movements), leadId: id, from, to, day: todayKey(), createdAt: new Date().toISOString() };
    movements.push(movement); writeJson(FILES.movements, movements); return send(res, 200, { lead, movement });
  }

  if (req.method === 'GET' && pathname === '/api/stats') {
    const leads = readJson(FILES.leads), calls = readJson(FILES.calls), movements = readJson(FILES.movements); const today = todayKey();
    const callsToday = calls.filter(c => c.createdAt.slice(0,10) === today).length;
    const movementDoneToday = movements.filter(m => m.day === today).length;
    const hotLeads = leads.filter(l => l.intent === 'Hot').length;
    const openLeads = leads.filter(l => l.stage !== 'Booked').length;
    const followUpsDue = Math.max(2, Math.round(leads.filter(l => ['New','Contacted','Negotiation'].includes(l.stage)).length / 4));
    const tourDone = leads.filter(l => l.stage === 'Tour Done').length;
    const booked = leads.filter(l => l.stage === 'Booked').length;
    const tourConversion = tourDone + booked ? Math.round((booked / Math.max(1, tourDone + booked)) * 100) : 0;
    return send(res, 200, { openLeads, hotLeads, callsToday, followUpsDue, tourConversion, movementDoneToday });
  }

  if (req.method === 'POST' && pathname === '/api/reset') {
    writeJson(FILES.leads, readJson(FILES.seed)); writeJson(FILES.calls, []); writeJson(FILES.movements, []); writeJson(FILES.movementCare, {date:todayKey(),status:'not_started',promise:'',resultTarget:2,queue:[],activeIndex:-1,completed:[],qualified:0,summary:''}); writeJson(FILES.bookingFlows, {});
    return send(res, 200, { ok: true, message: 'Demo data reset' });
  }
  return notFound(res);
}

function serveStatic(req, res, pathname) {
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!filePath.startsWith(ROOT)) return notFound(res);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(ROOT, 'index.html');
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream'});
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url.pathname, url.searchParams);
    if (req.method !== 'GET') return notFound(res);
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => console.log(`Gharpayy LeadOps running on http://localhost:${PORT}`));
