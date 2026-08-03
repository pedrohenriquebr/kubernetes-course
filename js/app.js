/* ============================================================ APP */
const LS_KEY='k8sjourney_progress_v2';
let done = new Set(JSON.parse(localStorage.getItem(LS_KEY)||'[]'));
const FLAT = COURSE.flatMap(m=>m.lessons.map(l=>Object.assign({},l,{mod:m})));
const totalLessons = FLAT.length;
const $ = s=>document.querySelector(s);

function saveProgress(){ localStorage.setItem(LS_KEY, JSON.stringify(Array.from(done))); }

function renderSidebar(){
  const sb=$('#sidebar');
  sb.innerHTML = '<button class="side-home" id="sideHome"><span class="mi" aria-hidden="true">home</span> Visão geral do curso</button>' + COURSE.map(function(m){
    const doneCount = m.lessons.filter(l=>done.has(l.id)).length;
    return '<div class="mod" data-mod="'+m.id+'">'+
      '<button class="mod-head" type="button">'+
      '<span class="mod-num">M'+m.num+'</span>'+
      '<span class="mod-title">'+m.title+'</span>'+
      '<span class="mod-count">'+doneCount+'/'+m.lessons.length+'</span>'+
      '<span class="mod-chev"><span class="mi" aria-hidden="true">chevron_right</span></span>'+
      '</button>'+
      '<div class="mod-body">'+m.lessons.map(function(l){
        return '<a class="les-link '+(done.has(l.id)?'done':'')+'" data-les="'+l.id+'" href="#/lesson/'+l.id+'">'+
        '<span class="les-check"><span class="mi" aria-hidden="true">check</span></span><span>'+l.title+'</span></a>';
      }).join('')+'</div></div>';
  }).join('');
  sb.querySelectorAll('.mod-head').forEach(function(h){h.addEventListener('click',function(){h.parentElement.classList.toggle('open');});});
  $('#sideHome').addEventListener('click',function(){location.hash='#/home';closeSide();});
}

function updateProgress(){
  const pct = Math.round(done.size/totalLessons*100);
  $('#progressFill').style.width=pct+'%';
  $('#progressTxt').textContent=pct+'%';
}

function syncActive(){
  document.querySelectorAll('.les-link').forEach(function(a){
    a.classList.toggle('active', a.dataset.les===currentLesson);
    a.classList.toggle('done', done.has(a.dataset.les));
  });
  const cur = FLAT.find(l=>l.id===currentLesson);
  if(cur){
    const modEl = document.querySelector('.mod[data-mod="'+cur.mod.id+'"]');
    if(modEl) modEl.classList.add('open');
    COURSE.forEach(function(m){
      const el=document.querySelector('.mod[data-mod="'+m.id+'"] .mod-count');
      if(el) el.textContent = m.lessons.filter(l=>done.has(l.id)).length + '/' + m.lessons.length;
    });
  }
}

function renderHome(){
  currentLesson=null; syncActive();
  const vids =
  '<a class="video-card" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=2T86xAtR6Fo"><div class="video-ico"><span class="mi" aria-hidden="true">play_arrow</span></div><div><b>Complete Kubernetes Course — From BEGINNER to PRO</b><small>DevOps Directive (EN) · fundamentos dos Módulos 1–5</small></div></a>'+
  '<a class="video-card" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=UEoxMU_l2xs"><div class="video-ico"><span class="mi" aria-hidden="true">play_arrow</span></div><div><b>Seu Primeiro Projeto Prático DevOps COMPLETO: Docker, AWS, Terraform e CI/CD!</b><small>Maria Lazara (PT-BR) · prática de Docker/CI-CD dos Módulos 0 e 6</small></div></a>'+
  '<a class="video-card" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=MTHGoGUFpvE"><div class="video-ico"><span class="mi" aria-hidden="true">play_arrow</span></div><div><b>Kubernetes Zero to Hero: The Complete Beginner\'s Guide (2025)</b><small>Fundamentos completos (EN · 2h50) — analogias didáticas citadas no Módulo 1</small></div></a>';
  $('#main').innerHTML = '<div class="content">'+
    '<div class="hero"><img src="'+IMG.hero+'" alt="Nave de containers Kubernetes">'+
    '<div class="hero-overlay"><span class="hero-tag">Curso completo · Iniciante → Avançado · v2 aprofundada</span>'+
    '<h1>Kubernetes para <span>Devs .NET</span></h1>'+
    '<p>Do primeiro Pod ao multi-cluster: workloads completos, resiliência, Gateway API, segurança, GitOps e um comparativo profundo AKS × GKE × EKS — validado contra a documentação oficial do Kubernetes e dos providers.</p>'+
    '<div class="hero-actions"><button class="btn btn-primary" id="startBtn"><span class="mi" aria-hidden="true">rocket_launch</span> Começar pelo Módulo 0</button>'+
    '<button class="btn btn-ghost" id="projBtn"><span class="mi" aria-hidden="true">flag</span> Ir ao projeto final</button></div></div></div>'+
    '<div class="stats">'+
    '<div class="stat"><b>'+COURSE.length+'</b><span>módulos completos</span></div>'+
    '<div class="stat"><b>'+totalLessons+'</b><span>lições práticas</span></div>'+
    '<div class="stat"><b>'+done.size+'</b><span>lições concluídas</span></div>'+
    '<div class="stat"><b>3</b><span>clouds comparados (AKS·GKE·EKS)</span></div>'+
    '</div>'+
    '<h2 class="sec-title">Trilha de aprendizado</h2>'+
    '<div class="trail">'+COURSE.map(function(m){
      return '<div class="trail-card" data-first="'+m.lessons[0].id+'"><span class="tc-num">'+m.num+'</span>'+
      '<span class="lvl lvl-'+m.level+'">'+(m.level==='ini'?'Iniciante':m.level==='int'?'Intermediário':'Avançado')+'</span>'+
      '<h3>'+m.title+'</h3>'+
      '<p>'+m.lessons.length+' lições · '+m.lessons.reduce(function(a,l){return a+l.mins;},0)+' min de leitura+prática</p></div>';
    }).join('')+'</div>'+
    '<h2 class="sec-title">Vídeos de referência (transcrições base)</h2>'+vids+
    '<h2 class="sec-title">Validação de conteúdo</h2>'+
    '<div class="src-grid">'+
    '<div class="src-card"><b><span class="mi" aria-hidden="true">menu_book</span> Documentação oficial do Kubernetes</b><small>Todas as áreas de kubernetes.io/docs/concepts cobertas: Architecture, Containers, Workloads, Services/Networking, Storage, Configuration, Security, Policies, Scheduling/Eviction, Cluster Admin e Extending.</small></div>'+
    '<div class="src-card"><b><span class="mi" aria-hidden="true">movie</span> DevOps Directive — Beginner to Pro</b><small>As 14 seções do curso (incl. debugging, multi-env, upgrades e developer experience) estão mapeadas neste curso.</small></div>'+
    '<div class="src-card"><b><span class="mi" aria-hidden="true">movie</span> Maria Lazara — Projeto DevOps</b><small>Base prática de Docker e CI/CD dos módulos iniciais.</small></div>'+
    '<div class="src-card"><b>☁️ Docs oficiais dos providers</b><small>Pricing e integrações conferidos em: learn.microsoft.com/azure/aks · cloud.google.com/kubernetes-engine · eks.aws/docs.</small></div>'+
    '</div></div>';
  $('#startBtn').addEventListener('click',function(){location.hash='#/lesson/m0l1';});
  $('#projBtn').addEventListener('click',function(){location.hash='#/lesson/m10l4';});
  document.querySelectorAll('.trail-card').forEach(function(c){c.addEventListener('click',function(){location.hash='#/lesson/'+c.dataset.first;});});
}

let currentLesson=null;
function renderLesson(id){
  const idx = FLAT.findIndex(l=>l.id===id);
  if(idx<0) return renderHome();
  const l = FLAT[idx]; currentLesson=id;
  const prev = FLAT[idx-1], next = FLAT[idx+1];
  const isDone = done.has(id);
  $('#main').innerHTML = '<div class="content lesson">'+
    '<div class="crumb">Módulo '+l.mod.num+' <span>▸</span> '+l.mod.title+'</div>'+
    '<h1>'+l.title+'</h1>'+
    '<div class="meta"><span><span class="mi" aria-hidden="true">schedule</span> ~'+l.mins+' min</span><span>·</span><span>'+(isDone?'<span class="mi" aria-hidden="true">check_circle</span> concluída':'<span class="mi" aria-hidden="true">book</span> em andamento')+'</span></div>'+
    l.body+
    '<button class="done-btn '+(isDone?'is-done':'')+'" id="doneBtn">'+(isDone?'<span class="mi" aria-hidden="true">check</span> Concluída — clicar p/ desmarcar':'Marcar como concluída <span class="mi" aria-hidden="true">check</span>')+'</button>'+
    '<div class="les-nav">'+
    (prev?'<a class="nav-card" href="#/lesson/'+prev.id+'"><small><span class="mi" aria-hidden="true">arrow_back</span> Anterior</small><b>'+prev.title+'</b></a>':'<a class="nav-card" href="#/home"><small><span class="mi" aria-hidden="true">arrow_back</span> Início</small><b>Visão geral</b></a>')+
    (next?'<a class="nav-card next" href="#/lesson/'+next.id+'"><small>Próxima <span class="mi" aria-hidden="true">arrow_forward</span></small><b>'+next.title+'</b></a>':'<a class="nav-card next" href="#/home"><small>Fim <span class="mi" aria-hidden="true">celebration</span></small><b>Voltar ao início</b></a>')+
    '</div></div>';
  $('#doneBtn').addEventListener('click',function(){ done.has(id)?done.delete(id):done.add(id); saveProgress(); renderSidebar(); updateProgress(); renderLesson(id); });
  try{ if(window.Prism) Prism.highlightAllUnder($('#main')); }catch(e){}
  syncActive();
  window.scrollTo({top:0,behavior:'smooth'});
}

function route(){
  const h = location.hash;
  if(h.indexOf('#/lesson/')===0) renderLesson(h.replace('#/lesson/',''));
  else renderHome();
}
window.addEventListener('hashchange',route);

$('#main').addEventListener('click',function(e){
  const opt=e.target.closest('.quiz-opt');
  if(opt){
    const quiz=opt.closest('.quiz'); if(!quiz||quiz.classList.contains('done'))return;
    const correct=+quiz.dataset.correct, i=+opt.dataset.i;
    quiz.classList.add('done');
    quiz.querySelectorAll('.quiz-opt').forEach(function(b){b.disabled=true; if(+b.dataset.i===correct)b.classList.add('correct');});
    if(i!==correct) opt.classList.add('wrong');
    const fb=quiz.querySelector('.quiz-fb');
    fb.className='quiz-fb '+(i===correct?'ok':'no');
    fb.textContent = i===correct ? '✅ '+quiz.dataset.explain : '❌ Não exatamente. '+quiz.dataset.explain;
    return;
  }
  const tab=e.target.closest('.ptab');
  if(tab){
    const scope=tab.closest('.lesson');
    tab.parentElement.querySelectorAll('.ptab').forEach(function(t){t.classList.toggle('active',t===tab);});
    scope.querySelectorAll('.ptab-panel').forEach(function(p){p.classList.toggle('active',p.dataset.t===tab.dataset.t);});
    return;
  }
  const cp=e.target.closest('.copy-btn');
  if(cp){
    const code=cp.closest('.codeblock').querySelector('code').innerText;
    navigator.clipboard.writeText(code).then(function(){cp.innerHTML='<span class="mi" aria-hidden="true">check</span>copiado!';setTimeout(function(){cp.innerHTML='<span class="mi" aria-hidden="true">content_copy</span>copiar';},1400);});
  }
});

const INDEX = FLAT.map(function(l){
  const div=document.createElement('div'); div.innerHTML=l.body;
  return {id:l.id,title:l.title,mod:l.mod.title,text:(l.title+' '+l.mod.title+' '+div.textContent).toLowerCase()};
});
function openSearch(){$('#searchModal').classList.add('open');$('#searchInput').value='';$('#searchResults').innerHTML='';setTimeout(function(){$('#searchInput').focus();},50);}
function closeSearch(){$('#searchModal').classList.remove('open');}
$('#openSearch').addEventListener('click',openSearch);
$('#searchModal').addEventListener('click',function(e){if(e.target.id==='searchModal')closeSearch();});
document.addEventListener('keydown',function(e){
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();}
  if(e.key==='Escape')closeSearch();
});
$('#searchInput').addEventListener('input',function(e){
  const q=e.target.value.trim().toLowerCase();
  const res=$('#searchResults');
  if(!q){res.innerHTML='<div class="sr-empty">Digite para buscar em todo o conteúdo do curso…</div>';return;}
  const hits=INDEX.filter(function(x){return x.text.indexOf(q)>=0;}).slice(0,12);
  res.innerHTML = hits.length? hits.map(function(h){return '<a class="sr-item" href="#/lesson/'+h.id+'"><b>'+h.title+'</b><small>'+h.mod+'</small></a>';}).join('') : '<div class="sr-empty"><span class="mi" aria-hidden="true">sentiment_dissatisfied</span> Nada encontrado — tente "ingress", "hpa", "secrets", "aks"…</div>';
  res.querySelectorAll('.sr-item').forEach(function(a){a.addEventListener('click',closeSearch);});
});

const closeSide=function(){$('#sidebar').classList.remove('open');};
$('#burger').addEventListener('click',function(){$('#sidebar').classList.toggle('open');});
$('#sidebar').addEventListener('click',function(e){if(e.target.closest('.les-link'))closeSide();});
$('#logoHome').addEventListener('click',function(){location.hash='#/home';});

renderSidebar(); updateProgress(); route();
