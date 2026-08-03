/* Módulo 02 — Kubernetes para Devs .NET */
const MOD2 = {id:'m2',num:'02',title:'Workloads Completos',level:'ini',lessons:[
{id:'m2l1',title:'Pods: a unidade mínima',mins:13,body:
'<p>O <strong>Pod</strong> é a menor unidade agendável do Kubernetes: um ou mais containers que compartilham rede (mesmo IP, comunicação via <code>localhost</code>) e podem compartilhar volumes, tratados como uma unidade. Na prática, 99% dos Pods têm <strong>1 container</strong>; o padrão multi-container é o <em>sidecar</em> (ex.: agente de logs ao lado da sua API).</p>'+
C('yaml',`apiVersion: v1
kind: Pod
metadata:
  name: minha-api
  labels:            # etiquetas chave=valor para seleção/organização
    app: minha-api
    tier: backend
spec:
  containers:
  - name: api
    image: meuregistry/minha-api:1.0.0
    ports:
    - containerPort: 8080`)+
C('bash',`kubectl apply -f pod.yaml
kubectl get pod minha-api
kubectl delete pod minha-api`)+
'<p>Cada Pod recebe um <strong>IP único dentro do cluster</strong>. Mas atenção ao conceito mais importante desta lição: <strong>Pods são efêmeros</strong>. Eles nascem, morrem e <em>nunca voltam</em> — outro Pod (com outro IP e outro nome) nasce no lugar. Por isso:</p>'+
'<ul><li>Nunca aponte para o IP de um Pod → use <strong>Services</strong> (lição 4).</li>'+
'<li>Nunca crie Pods "na mão" em produção → use <strong>Deployments</strong> (lição 2).</li>'+
'<li>Estado que precisa sobreviver → <strong>Volumes externos</strong> (Módulo 3).</li></ul>'+
'<h2>O Pod por dentro: o pause container</h2>'+
'<p>Cada Pod carrega um container invisível chamado <strong>pause</strong>. Ele é criado primeiro e "segura" os namespaces do Pod; os containers do app entram nesses namespaces. Consequências diretas: os containers do Pod <strong>compartilham o mesmo IP, o mesmo <code>localhost</code> e as mesmas portas</strong> — um Pod com 2 containers não pode ter os dois escutando na mesma porta.</p>'+
'<h2>restartPolicy: quem reinicia e quando</h2>'+
'<table class="tbl"><tr><th>Política</th><th>Comportamento do kubelet</th><th>Uso</th></tr>'+
'<tr><td><code>Always</code> (padrão)</td><td>reinicia o container sempre que ele terminar</td><td>Pods de serviço (Deployments)</td></tr>'+
'<tr><td><code>OnFailure</code></td><td>reinicia só se o container falhar (exit ≠ 0)</td><td>Jobs</td></tr>'+
'<tr><td><code>Never</code></td><td>nunca reinicia</td><td>Jobs que querem inspecionar a falha</td></tr></table>'+
'<p>As <strong>fases</strong> de um Pod: <code>Pending</code> (aceito, aguardando scheduling/containers), <code>Running</code> (pelo menos 1 container de pé), <code>Succeeded</code>/<code>Failed</code> (todos os containers terminaram — normal em Jobs), e <code>Unknown</code> (kubelet sem resposta — node com problema).</p>'+
TIP('Nomes de Pod: se você não definir <code>metadata.name</code>, use <code>metadata.generateName</code> (ex.: <code>generateName: api-</code>) — o API Server gera <code>api-abc123</code>. É o mecanismo usado pelos controllers para nomear Pods de Deployment/Job.')+
TIP('Detalhe que evita confusão: <strong>não dá para adicionar (nem remover) containers de um Pod já em execução</strong> — o spec do Pod é imutável nesse ponto. Mudou o conjunto de containers? O controlador cria um Pod novo (é exatamente por isso que Deployments recriam Pods no rollout).')+
LAB('Um Pod com sidecar (2 containers)',
'<ol><li>Crie o YAML abaixo e aplique: <code>kubectl apply -f pod-2ct.yaml</code>.</li>'+
'<li>Veja os 2 containers (e o pause): <code>kubectl get pod multi -o jsonpath=\'{.spec.containers[*].name}\'</code>.</li>'+
'<li>Execute dentro de um container específico: <code>kubectl exec -it multi -c sidecar -- sh</code> — e de dentro, <code>wget -qO- localhost:8080</code>: o sidecar alcança a API pelo <code>localhost</code> do Pod.</li>'+
'<li>Logs por container: <code>kubectl logs multi -c api</code>.</li>'+
'<li>No kind, olhe os processos do node: <code>docker exec kind-worker-0 crictl ps</code> (o <code>pause</code> aparece como o primeiro de cada Pod).</li></ol>')+
C('yaml',`# pod-2ct.yaml — Pod com 2 containers compartilhando rede
apiVersion: v1
kind: Pod
metadata: { name: multi, labels: { app: multi } }
spec:
  containers:
  - name: api
    image: nginx:1.27
    ports: [{ containerPort: 80 }]
  - name: sidecar
    image: busybox:1.36
    command: ['sh','-c','sleep 3600']`)+
NOTE('Em .NET, o padrão sidecar clássico é o <em>agente de logs</em> (Fluent Bit) ou o <em>proxy de saída</em> ao lado da sua API. E lembre: se dois containers do mesmo Pod precisam se comunicar, é <code>localhost</code> — sem Service no meio.')+
TERMS([['Pod','Menor unidade agendável: 1+ containers com rede/volume compartilhados'],['Pause container','Segura os namespaces do Pod (IP e localhost compartilhados)'],['Sidecar','Container auxiliar no mesmo Pod (logs, proxy, agente)'],['restartPolicy','Always/OnFailure/Never — quem reinicia o container'],['Fases do Pod','Pending → Running → Succeeded/Failed (+ Unknown)']])+
QUIZ('Você tem um Pod com 2 containers. O container A escuta na porta 8080. O container B…',
['Precisa de um Service para alcançar o A','Pode chamar localhost:8080 — o network namespace é compartilhado','Não pode existir — Pods têm 1 container','Precisa da mesma imagem'],1,
'Isso! Containers do mesmo Pod compartilham rede: B alcança A em localhost:8080.')+
QUIZ('Em qual situação você NÃO veria o kubelet reiniciando seu container?',
['Container com exit code 137 (OOM) em Deployment','Container finaliza com sucesso em Deployment (restartPolicy Always)','Job com restartPolicy Never que falha','Deployment com restartPolicy Always'],2,
'Exato! Com restartPolicy: Never, o kubelet não reinicia — o Pod fica Failed para você inspecionar.')},
{id:'m2l2',title:'Deployments e ReplicaSets',mins:14,body:
'<p>Na vida real usamos o trio da figura abaixo: o <strong>Deployment</strong> (objeto de mais alto nível, que você versiona no Git) gerencia um <strong>ReplicaSet</strong> (que garante "N réplicas idênticas"), que por sua vez gerencia os <strong>Pods</strong>. O <strong>Service</strong> encontra esses Pods por <em>labels</em> e distribui o tráfego.</p>'+
FIG(IMG.deploy,'Deployment → ReplicaSet → Pods, com o Service roteando por label (app=web)')+
C('yaml',`apiVersion: apps/v1
kind: Deployment
metadata:
  name: minha-api
spec:
  replicas: 3                      # estado desejado
  revisionHistoryLimit: 5          # ReplicaSets antigos guardados p/ rollback
  selector:
    matchLabels:
      app: minha-api               # quais Pods "são meus"
  template:                        # "receita" do Pod (é um Pod embutido!)
    metadata:
      labels:
        app: minha-api
    spec:
      containers:
      - name: api
        image: meuregistry/minha-api:1.0.0
        ports:
        - containerPort: 8080`)+
C('bash',`kubectl apply -f deployment.yaml
kubectl get deploy,rs,pod -l app=minha-api
kubectl scale deploy/minha-api --replicas=5
kubectl set image deploy/minha-api api=meuregistry/minha-api:1.1.0`)+
'<h2>A mecânica: por que o rollback é instantâneo</h2>'+
'<p>A cada mudança no template (imagem, env, recursos…), o Deployment cria um <strong>ReplicaSet novo</strong> e migra as réplicas para ele, mantendo os antigos até <code>revisionHistoryLimit</code> (padrão 10). O rollback (<code>kubectl rollout undo</code>) é só "apontar para o ReplicaSet anterior" — por isso é instantâneo, sem rebuild de imagem.</p>'+
'<ul><li><strong>selector é imutável:</strong> tentar mudar <code>spec.selector.matchLabels</code> de um Deployment existente falha na API — o selector define a "identidade" do Deployment (quais Pods ele possui).</li>'+
'<li><strong>Pods não pertencem ao Deployment</strong> — pertencem ao ReplicaSet (ownerReference). Deletar o ReplicaSet antigo "órfãos" os Pods.</li>'+
'<li><strong><code>kubectl scale</code> é imperativo:</strong> funciona, mas some na próxima aplicação do YAML — prefira mudar <code>replicas</code> no YAML (Módulo 1, lição 5).</li></ul>'+
'<h2>Finalizers: por que objetos ficam presos em Terminating</h2>'+
'<p><strong>Finalizers</strong> são chaves em <code>metadata.finalizers</code> que <em>bloqueiam a exclusão</em> de um objeto até que uma condição seja cumprida — geralmente para um controller fazer a limpeza antes. Quando você deleta um objeto com finalizer, a API retorna 202 e adiciona <code>deletionTimestamp</code>, mas o objeto <strong>não some</strong> até todos os finalizers serem removidos. Se o controller não consegue limpar (ou não existe mais), o objeto fica <strong>preso em <code>Terminating</code></strong> para sempre.</p>'+
'<ul><li>O <strong>namespace</strong> usa a finalizer <code>kubernetes</code>: ele só some depois que TODOS os objetos dentro dele foram apagados — é por isso que deletar um namespace com recursos presos trava.</li>'+
'<li>O <strong>ReplicaSet</strong> usa finalizers para não sumir enquanto houver Pods dele.</li>'+
'<li>Diagnóstico: <code>kubectl get ns loja -o json | jq \'.spec.finalizers, .metadata.finalizers\'</code> e <code>kubectl get ns loja -o jsonpath=\'{.status.conditions}\'</code> — se um recurso dentro do namespace estiver com finalizer órfão, remova o finalizer na mão (com cuidado!): <code>kubectl patch ns loja --type merge -p \'{"metadata":{"finalizers":[]}}\'</code>.</li></ul>'+
DEEP('Finalizers são o mecanismo que dá ao Kubernetes o "delete suave": o objeto vira "morto-vivo" até a limpeza. Em CRDs (Módulo 10), operadores usam finalizers próprios (<code>exemplo.com.br/cleanup</code>) para garantir que o recurso externo (ex.: um banco) seja apagado antes do objeto. Se o operator for removido antes, o recurso fica preso — o problema clássico de "uninstall do Helm que nunca termina".')+
LAB('Rollout na prática',
'<ol><li>Aplique o Deployment acima e observe: <code>kubectl get deploy,rs,pod -l app=minha-api -w</code>.</li>'+
'<li>Mude a imagem para <code>:1.1.0</code> no YAML e aplique de novo. Veja nascer um ReplicaSet novo.</li>'+
'<li>Histórico: <code>kubectl rollout history deploy/minha-api</code> — cada REVISION é um ReplicaSet.</li>'+
'<li>Volte: <code>kubectl rollout undo deploy/minha-api</code> — instantâneo.</li>'+
'<li>Inspecione a hierarquia: <code>kubectl get rs -l app=minha-api -o wide</code> e <code>kubectl get pod &lt;pod&gt; -o yaml | grep -A5 ownerReferences</code>.</li></ol>')+
NOTE('Repare no padrão: <code>spec.selector.matchLabels</code> do Deployment precisa "bater" com <code>template.metadata.labels</code>. Esse casamento de labels × selectors é o sistema nervoso do Kubernetes — Services, NetworkPolicies e HPA usam a mesma ideia.')+
TERMS([['Deployment','Objeto de topo: gerencia ReplicaSets, rollouts e rollbacks'],['ReplicaSet','Garante N réplicas de Pods idênticos; um por revisão'],['Template','A "receita" do Pod embutida no Deployment'],['Revision','Cada ReplicaSet histórico = uma revisão do rollout'],['OwnerReference','O ReplicaSet é dono dos Pods; deletar o dono deleta os filhos']])+
QUIZ('O selector do Deployment é imutável. Por quê?',
['Por limitação técnica do YAML','Porque ele define quais Pods o Deployment possui — mudá-lo "roubaria" Pods de outros donos','Porque labels não podem mudar','Porque o API Server não aceita patch em selector'],1,
'Isso! O selector define a propriedade. Mudá-lo quebraria a associação com os Pods existentes — o Kubernetes proíbe por design.')+
QUIZ('Por que o rollback no Kubernetes é tão rápido?',
['Ele rebuilda a imagem antiga','Ele reaponta para o ReplicaSet anterior, que já existe','Ele restaura do etcd','Ele recria o Deployment do zero'],1,
'Exato! Os ReplicaSets antigos ficam guardados (revisionHistoryLimit) — o undo é trocar o ponteiro, não reconstruir nada.')},
{id:'m2l3',title:'Rollouts, rollbacks e estratégias',mins:12,body:
'<p>Quando você muda a imagem (ou o template) de um Deployment, ele faz um <strong>rolling update</strong>: cria um ReplicaSet novo e migra os Pods gradualmente, sem downtime.</p>'+
C('yaml',`spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # até 1 Pod "a mais" durante o rollout
      maxUnavailable: 0    # nenhum Pod indisponível (zero downtime)`)+
C('bash',`kubectl rollout status deploy/minha-api      # acompanha
kubectl rollout history deploy/minha-api       # versões anteriores
kubectl rollout undo deploy/minha-api          # VOLTA A VERSÃO (salva-vidas)
kubectl rollout undo deploy/minha-api --to-revision=2
kubectl rollout restart deploy/minha-api       # recria Pods (ex.: recarregar Secrets)`)+
'<p>E para deploy "controlado em fases", existe o <strong>pause/resume</strong>: <code>kubectl rollout pause deploy/minha-api</code> congela o rollout no meio (o que já subiu continua; o resto espera) e <code>kubectl rollout resume deploy/minha-api</code> continua — o padrão para validar manualmente antes de completar, ou para "meio a meio" em canary caseiro.</p>'+
'<h2>Lendo a saúde de um rollout</h2>'+
'<p>O Deployment expõe <strong>conditions</strong> no status — leia com <code>kubectl rollout status</code> ou <code>kubectl get deploy -o wide</code>:</p>'+
'<ul><li><strong>Progressing:</strong> o rollout está em andamento (mudou algo).</li>'+
'<li><strong>Complete:</strong> novos Pods prontos, antigos terminados.</li>'+
'<li><strong>NewReplicaSetAvailable:</strong> o ReplicaSet novo está disponível.</li>'+
'<li><strong>ProgressDeadlineExceeded:</strong> o rollout não completou dentro de <code>progressDeadlineSeconds</code> (padrão 600s) — <em>não para</em>, mas sinaliza que algo está travado (imagem errada, probe falhando).</li></ul>'+
'<table class="tbl"><tr><th>Estratégia</th><th>Como funciona</th><th>Quando usar</th></tr>'+
'<tr><td>RollingUpdate</td><td>troca gradual, velho e novo coexistem</td><td>padrão; APIs stateless</td></tr>'+
'<tr><td>Recreate</td><td>derruba tudo, depois sobe o novo</td><td>apps que não aceitam 2 versões (lock de arquivo, migração única)</td></tr>'+
'<tr><td>Blue/Green</td><td>duas versões completas; o Service "vira a chave"</td><td>rollback instantâneo crítico</td></tr>'+
'<tr><td>Canary</td><td>% do tráfego vai para o novo primeiro</td><td>validar em produção com risco mínimo (via Gateway API/service mesh)</td></tr></table>'+
'<h2>Blue/Green com dois Deployments (sem downtime)</h2>'+
'<p>O padrão blue/green é simples: dois Deployments (blue e green) e um Service cuja chave seletora aponta para um deles. Para trocar a versão, você muda a label do Service (ou do Deployment):</p>'+
C('yaml',`apiVersion: v1
kind: Service
metadata: { name: minha-api }
spec:
  selector:
    app: minha-api
    versao: blue          # troque para "green" para virar a chave
  ports: [{ port: 80, targetPort: 8080 }]`)+
'<p>O tráfego muda na hora; voltar é trocar a label de novo. O preço: <strong>duas vezes os recursos</strong> durante a validação, e a necessidade de uma esteira (ou você mesmo) para virar a chave — o Kubernetes não faz isso sozinho.</p>'+
WARN('Canary com porcentagem de tráfego <em>não</em> é o Service comum: o Service distribui 50/50 (ou N/M por contagem de Pods), sem peso fino. Para canary de verdade (10% / 90%), use Gateway API (Módulo 4) ou service mesh.')+
LAB('Um rollout que falha — e o undo que salva',
'<ol><li>Aplique o Deployment com imagem <code>nginx:1.27</code>.</li>'+
'<li>Quebre de propósito: mude a imagem para <code>nginx:nao-existe-999</code> e aplique.</li>'+
'<li>Observe: <code>kubectl rollout status deploy/minha-api</code> — trava em <em>waiting</em>; os Pods novos ficam <code>ImagePullBackOff</code>.</li>'+
'<li>Rode <code>kubectl rollout undo deploy/minha-api</code> — tráfego restaurado instantaneamente.</li>'+
'<li>Confira: <code>kubectl get deploy minha-api -o yaml | grep -A4 conditions:</code> — você deve ver <code>Progressing</code> e depois <code>NewReplicaSetAvailable</code>.</li></ol>')+
QUIZ('Seu rollout está travado em ProgressDeadlineExceeded. O que isso significa?',
['O Deployment foi pausado','O rollout não completou no tempo limite — investigue probes/imagem','O cluster está sem memória','O ReplicaSet antigo foi deletado'],1,
'Isso! ProgressDeadlineExceeded é o alarme: o rollout não progrediu em 600s (padrão). Não trava o sistema, mas é um sinal de problema.')+
QUIZ('Você quer canary de 10% do tráfego para a versão nova. Qual é a ferramenta certa?',
['kubectl scale','Dois Deployments + Service comum','Gateway API com weights (ou service mesh)','NodePort'],2,
'Exato! O Service comum não faz peso fino — o Gateway API (Módulo 4) tem traffic splitting nativo.')},
{id:'m2l4',title:'Services: rede estável para Pods efêmeros',mins:15,body:
'<p>Se Pods têm IP descartável, como outro serviço chama sua API? Com um <strong>Service</strong>: um IP virtual + nome DNS estável que distribui tráfego para o conjunto de Pods que casam com o <em>selector</em>.</p>'+
C('yaml',`apiVersion: v1
kind: Service
metadata:
  name: minha-api
spec:
  selector:
    app: minha-api        # "aponta" para os Pods do Deployment
  ports:
  - port: 80              # porta do Service (dentro do cluster)
    targetPort: 8080      # porta do container`)+
'<table class="tbl"><tr><th>Tipo</th><th>Alcance</th><th>Uso típico</th></tr>'+
'<tr><td><code>ClusterIP</code> (padrão)</td><td>só dentro do cluster</td><td>comunicação entre microsserviços</td></tr>'+
'<tr><td><code>NodePort</code></td><td>IP do node + porta alta (faixa padrão 30000–32767)</td><td>dev/testes; evite em produção</td></tr>'+
'<tr><td><code>LoadBalancer</code></td><td>exposto via LB do cloud</td><td>entrada de tráfego externo em clouds</td></tr>'+
'<tr><td><code>ExternalName</code></td><td>alias DNS (CNAME) p/ fora do cluster</td><td>referenciar SaaS/bancos externos</td></tr></table>'+
TIP('Mental model do Service: é o <strong>letreiro de Las Vegas</strong> — sem ele, o Pod é um prédio anônimo no escuro; com o Service, todo mundo acha a porta. O IP virtual é estável; os Pods atrás mudam à vontade.')+
'<h2>Como o Service funciona por dentro: kube-proxy</h2>'+
'<p>O <strong>kube-proxy</strong> roda em cada node e traduz o IP virtual do Service em regras de encaminhamento para os Pods de tráfego:</p>'+
'<ul><li><strong>iptables</strong> (padrão): uma cadeia de regras por Service/Port; seleção aleatória. Simples e robusto, mas o custo de atualização cresce com o número de Services.</li>'+
'<li><strong>IPVS</strong>: tabela hash no kernel — escala melhor em clusters grandes (centenas de Services) e suporta algoritmos (rr, lc…). Habilitado com <code>--proxy-mode=ipvs</code>.</li></ul>'+
'<p>Os Pods de tráfego são descobertos via <strong>EndpointSlices</strong> (objetos que listam IP:porta dos Pods vivos do selector) — o assunto da lição "Services a fundo" (Módulo 4).</p>'+
'<h2>Ajustes que importam em produção</h2>'+
'<table class="tbl"><tr><th>Campo</th><th>Efeito</th><th>Quando usar</th></tr>'+
'<tr><td><code>sessionAffinity: ClientIP</code></td><td>mesmo cliente sempre no mesmo Pod</td><td>sessão em memória (evite — prefira estado externo)</td></tr>'+
'<tr><td><code>externalTrafficPolicy: Local</code></td><td>preserva o IP de origem do cliente; sem salto extra</td><td>quando o app precisa do IP real (logs, geolocalização)</td></tr></table>'+
'<p>Dentro do cluster, qualquer Pod resolve <code>minha-api</code> (mesmo namespace) ou <code>minha-api.meu-ns.svc.cluster.local</code>. Em .NET:</p>'+
C('csharp',`// Service discovery "de graça" via DNS do cluster
var client = httpClientFactory.CreateClient("pedidos");
// baseUrl configurado como: http://pedidos-api  (ClusterIP service)
var resp = await client.GetAsync("/pedidos/42");`)+
LAB('Service + port-forward + chamada de dentro do cluster',
'<ol><li>Aplique um Deployment com 3 réplicas (<code>nginx:1.27</code>) e o Service acima.</li>'+
'<li>Veja os endpoints: <code>kubectl get endpointslices -l kubernetes.io/service-name=minha-api</code> — IPs dos Pods vivos.</li>'+
'<li>Acesse localmente: <code>kubectl port-forward svc/minha-api 8080:80</code> e abra <code>http://localhost:8080</code>.</li>'+
'<li>Chame de dentro do cluster: <code>kubectl run curl-test --rm -it --image=curlimages/curl -- sh</code> e dentro: <code>curl http://minha-api</code>.</li>'+
'<li>Escale para 5 réplicas e repita o passo 2 — os endpoints mudam sem tocar no Service.</li></ol>')+
CLOUD('Em AKS/GKE/EKS, um Service do tipo <code>LoadBalancer</code> cria automaticamente um Azure Load Balancer / Google Cloud Load Balancer / AWS NLB de verdade, com IP público. É assim que sua API aparece para o mundo sem Ingress.')+
NOTE('No .NET, <code>IHttpClientFactory</code> + Polly combinam perfeitamente com Service discovery: a base URL (<code>http://pedidos-api</code>) vem da configuração e muda por ambiente via ConfigMap — dev local usa localhost, cluster usa DNS interno. E o <code>externalTrafficPolicy: Local</code> importa quando sua API lê o IP do cliente (ex.: middleware de auditoria).')+
TERMS([['Service','IP virtual + DNS estável na frente de Pods efêmeros'],['Selector','Labels que definem quais Pods o Service atende'],['ClusterIP','Tipo padrão — alcançável só dentro do cluster'],['kube-proxy','Implementa o Service via iptables ou IPVS em cada node'],['EndpointSlice','Lista atual de IP:porta dos Pods atrás do Service'],['port-forward','Túnel local para um Service/Pod (debug sem expor nada)']])+
QUIZ('Por que NÃO devemos chamar outro microsserviço pelo IP do Pod dele?',
['Porque IPs de Pods são efêmeros e mudam a cada recriação.','Porque Pods não têm IP.','Porque o DNS do cluster bloqueia IPs.','Porque o kube-proxy criptografa o IP.'],0,
'Exato! Pods nascem e morrem; o Service dá um nome/IP estável na frente deles.')+
QUIZ('Um Service descobre quais Pods atender usando…',
['o nome do Deployment','selector contra as labels dos Pods','a porta 443','o namespace apenas'],1,
'Isso! Selector × labels é o mecanismo universal de "encaixe" entre objetos.')+
QUIZ('O que o kube-proxy faz?',
['Baixa as imagens dos Pods','Traduz o IP virtual do Service em regras de rede para os Pods (iptables/IPVS)','Agenda os Pods','Guarda o estado do cluster'],1,
'Exato! kube-proxy implementa o Service no plano de dados de cada node.')},
{id:'m2l5',title:'Namespaces, Labels e Selectors',mins:11,body:
'<p><strong>Namespaces</strong> são "clusters virtuais" dentro do cluster: isolam nomes, organizam times/ambientes e permitem cotas e RBAC por área (<code>dev</code>, <code>prod</code>, <code>pagamentos</code>…). Alguns namespaces existem por padrão: <code>default</code>, <code>kube-system</code> (componentes do sistema) e <code>kube-public</code>. <strong>Labels</strong> classificam objetos; <strong>selectors</strong> consultam essas classificações.</p>'+
C('bash',`kubectl create namespace pagamentos
kubectl apply -f deployment.yaml -n pagamentos
kubectl get pods -n pagamentos
kubectl get pods -l app=minha-api,tier=backend   # selector por labels
kubectl get pods -l 'environment in (staging, production)'`)+
C('yaml',`metadata:
  namespace: pagamentos
  labels:
    app: minha-api
    tier: backend
    versao: "1.2"
    equipe: checkout`)+
'<h2>Labels vs Annotations: qual usar?</h2>'+
'<ul><li><strong>Labels</strong> são <em>indexáveis e selecionáveis</em>: Services, NetworkPolicies, HPA e o kubectl usam elas para "achar" objetos. Toda label participa de queries.</li>'+
'<li><strong>Annotations</strong> são <em>metadados não indexáveis</em>: dados para ferramentas e humanos (ex.: <code>prometheus.io/scrape: "true"</code>, email do dono, versão de release). Não podem ser usadas em selectors.</li></ul>'+
'<p>Convenções de labels (recommended labels da doc oficial): <code>app.kubernetes.io/name</code>, <code>app.kubernetes.io/instance</code>, <code>app.kubernetes.io/version</code>, <code>app.kubernetes.io/component</code>, <code>app.kubernetes.io/managed-by</code> — o Helm e o Kustomize já as adicionam por padrão (Módulo 6).</p>'+
'<h2>Sintaxe de seleção</h2>'+
C('bash',`kubectl get pods -l app=minha-api                 # igualdade
kubectl get pods -l 'app!=minha-api'               # diferente
kubectl get pods -l 'app in (api, worker)'         # conjunto
kubectl get pods -l 'app notin (cron)'             # fora do conjunto
kubectl get pods -l app --show-labels              # existe a label + mostra
kubectl get pods -l app=minha-api -n pagamentos    # namespace + selector

# Field selectors — filtram por CAMPOS do objeto (não labels):
kubectl get pods --field-selector=status.phase=Running
kubectl get pods --field-selector=spec.nodeName=kind-worker-0`)+
TIP('Labels na CLI têm sintaxe própria: <code>kubectl label pod p app=web</code> usa <strong>=</strong> (não <code>:</code> como no YAML), <code>--overwrite</code> sobrescreve, <code>kubectl label pod p app-</code> (com <code>-</code> no final) REMOVE a label, e <code>kubectl get pods -L app</code> mostra a label como coluna da listagem.')+
TIP('Demo clássica do selector: remova a label de um Pod gerenciado por Deployment (<code>kubectl label pod &lt;pod&gt; app-</code>) — para o Deployment, o Pod "deixou de existir" (o selector não o encontra mais) e um substituto nasce na hora. É a prova viva de que o controle é por label, não por "memória".')+
WARN('Evite a tentação de criar "um namespace por developer" sem governança: cada namespace multiplica superfícies de rede, cotas e RBAC a manter. Comece com namespaces por ambiente ou por domínio de negócio.')+
LAB('Classificando e selecionando',
'<ol><li>Crie os namespaces: <code>kubectl create ns dev</code> e <code>kubectl create ns prod</code>.</li>'+
'<li>Aplique o mesmo Deployment nos dois, com labels diferentes de <code>environment</code> (dev/prod).</li>'+
'<li>Liste por ambiente: <code>kubectl get pods -l environment=prod -A</code>.</li>'+
'<li>Adicione uma anotação: <code>kubectl annotate pod &lt;pod&gt; owner=voce</code> e veja que ela <em>não</em> aparece em <code>-l</code>.</li>'+
'<li>Adicione a label recomendada: <code>kubectl label pod &lt;pod&gt; app.kubernetes.io/version=1.0.0</code>.</li></ol>')+
TERMS([['Namespace','"Cluster virtual" — isolamento de nomes, cotas e RBAC'],['Label','Metadado indexável usado em selectors (Services, HPA, NetPol)'],['Annotation','Metadado não indexável para ferramentas/humanos'],['Selector','Query por labels: =, !=, in, notin, existe'],['Field selector','Filtro por campos do objeto (status.phase, spec.nodeName)']])+
QUIZ('Qual destes dados deve ser uma ANNOTATION (e não label)?',
['app.kubernetes.io/name','prometheus.io/scrape: "true"','environment: prod','app: minha-api'],1,
'Isso! Annotation é para metadados que ferramentas leem — labels são para seleção. Se algo precisa ser selecionado, é label.')+
QUIZ('Qual comando lista Pods Running em qualquer namespace?',
['kubectl get pods --field-selector=status.phase=Running -A','kubectl get pods -l Running','kubectl get pods --namespace=all','kubectl get pod status=Running'],0,
'Exato! Field selector filtra por campo do objeto; -A inclui todos os namespaces.')},
{id:'m2l6',title:'StatefulSet, DaemonSet, Jobs e CronJobs',mins:17,body:
'<p>Deployment não é o único workload. A documentação oficial lista cinco tipos principais; saber escolher entre eles é o que separa um curso completo de um superficial.</p>'+
'<table class="tbl"><tr><th>Workload</th><th>Perfil</th><th>Exemplos</th></tr>'+
'<tr><td>Deployment</td><td>stateless, réplicas intercambiáveis</td><td>APIs, frontends, workers sem estado</td></tr>'+
'<tr><td>StatefulSet</td><td>stateful, identidade estável</td><td>bancos, brokers, sistemas distribuídos</td></tr>'+
'<tr><td>DaemonSet</td><td>1 cópia por node</td><td>agentes de log/monitoring, CNI</td></tr>'+
'<tr><td>Job</td><td>tarefa única até concluir</td><td>migrações, importações, batch</td></tr>'+
'<tr><td>CronJob</td><td>Jobs agendados</td><td>relatórios noturnos, backups, limpeza</td></tr></table>'+
TIP('Legado: o <strong>ReplicationController</strong> foi o antecessor do ReplicaSet (mesma ideia, sem selectors expressivos) — substituído em <code>apps/v1</code>. Se você encontrar um, migre para Deployment/ReplicaSet.')+
'<h3>StatefulSet — identidade estável</h3>'+
'<p>Cada réplica ganha nome fixo (<code>postgres-0</code>, <code>postgres-1</code>…), DNS estável e <em>seu próprio disco</em> via <code>volumeClaimTemplates</code>. A escala e o rollout são <strong>ordenados</strong> (0 → N). Exige um Service <em>headless</em>.</p>'+
C('yaml',`apiVersion: apps/v1
kind: StatefulSet
metadata: { name: postgres }
spec:
  serviceName: postgres-headless
  replicas: 3
  selector: { matchLabels: { app: postgres } }
  template:
    metadata: { labels: { app: postgres } }
    spec:
      containers:
      - name: pg
        image: postgres:16
        volumeMounts: [{ name: data, mountPath: /var/lib/postgresql/data }]
  volumeClaimTemplates:          # um PVC por réplica, criado automaticamente
  - metadata: { name: data }
    spec:
      accessModes: ["ReadWriteOnce"]
      resources: { requests: { storage: 10Gi } }`)+
WARN('Como dev, prefira bancos <strong>gerenciados</strong> do cloud (Azure SQL, Cloud SQL, RDS) a rodar banco em StatefulSet. StatefulSet faz sentido quando o produto é literalmente o banco (operadores como CloudNativePG/Strimzi cuidam disso).')+
'<h3>DaemonSet — um por node</h3>'+
'<p>O DaemonSet garante que todos (ou alguns) nodes rodem uma cópia do Pod — via <code>nodeSelector</code>/<code>affinity</code> você restringe a quais nodes. É assim que rodam coletores de log (Fluent Bit), agentes de métricas (node-exporter) e os próprios componentes de rede (CNI). Atualizações usam <code>updateStrategy: RollingUpdate</code> (por padrão, node a node).</p>'+
'<h3>Job — tarefa única com controle fino</h3>'+
C('yaml',`apiVersion: batch/v1
kind: Job
metadata: { name: migra-dados }
spec:
  completions: 1          # quantos Pods precisam terminar com sucesso
  parallelism: 1
  backoffLimit: 6         # tentativas antes de desistir (padrão: 6)
  ttlSecondsAfterFinished: 300   # auto-limpeza 5 min depois de concluir!
  template:
    spec:
      restartPolicy: Never    # Jobs NUNCA usam Always
      containers:
      - name: migra
        image: meuregistry/migrador:2.0.0`)+
'<p>Detalhes que valem ouro:</p>'+
'<ul><li><strong><code>completions</code> × <code>parallelism</code>:</strong> "N concluem com sucesso" × "quantos rodam ao mesmo tempo". Para fila de trabalho (work queue), você define <code>completions</code> sem valor (ou 1) e <code>parallelism</code> N: cada Pod consome da fila até ela esvaziar.</li>'+
'<li><strong><code>ttlSecondsAfterFinished</code>:</strong> sem isso, Jobs concluídos ficam para sempre — o cluster acumula lixo. Sempre defina TTL (ou limpe com <code>kubectl delete job</code>).</li>'+
'<li><strong><code>podFailurePolicy</code> (1.26+):</strong> regras por código de saída (ex.: falhar a Job imediatamente em erro 4xx, ignorar 5xx).</li></ul>'+
'<h3>CronJob — Jobs no relógio</h3>'+
C('yaml',`apiVersion: batch/v1
kind: CronJob
metadata: { name: relatorio-noturno }
spec:
  schedule: "0 2 * * *"               # todo dia às 02:00
  timeZone: "America/Sao_Paulo"       # fuso explícito (1.27+)
  concurrencyPolicy: Forbid           # não sobrepõe execuções
  startingDeadlineSeconds: 300        # tolerância de atraso p/ disparar
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: rel
            image: meuregistry/relatorios:1.0.0`)+
'<p><code>concurrencyPolicy</code>: <code>Allow</code> (padrão — pode sobrepor), <code>Forbid</code> (não dispara se o anterior ainda roda) e <code>Replace</code> (mata o anterior e começa de novo). <code>startingDeadlineSeconds</code> evita "chuva de execuções" quando o cluster fica indisponível por um tempo.</p>'+
LAB('Um Job que falha e um CronJob de verdade',
'<ol><li>Crie um Job que falha: imagem <code>busybox</code> com comando <code>exit 1</code> e <code>backoffLimit: 3</code>. Observe <code>kubectl get pods -w</code> — o kubelet tenta 3 vezes e o Job marca <code>Failed</code>.</li>'+
'<li>Veja o histórico: <code>kubectl describe job &lt;job&gt;</code> (seção Events).</li>'+
'<li>Crie um CronJob que roda a cada 1 minuto (<code>schedule: "*/1 * * * *"</code>) e veja: <code>kubectl get cronjob, jobs</code>.</li>'+
'<li>Deleta o CronJob: <code>kubectl delete cronjob relatorio-noturno</code>.</li></ol>')+
NOTE('Migração de banco no deploy? O padrão .NET é um <strong>Job</strong> com <code>dotnet ef database update</code> (ou <code>DbInitializer</code> via <code>Host.CreateApplicationBuilder</code>) rodando <em>antes</em> do rollout do Deployment — via Helm hook (Módulo 6) ou init container (próxima lição).')+
QUIZ('Uma tarefa de processamento de folha de pagamento roda todo dia 5 às 22h e não pode se sobrepor. Qual workload?',
['Deployment com replicas: 1','DaemonSet','CronJob com concurrencyPolicy: Forbid','StatefulSet'],2,
'Perfeito! Agendamento + prevenção de sobreposição é exatamente o caso do CronJob com Forbid.')+
QUIZ('Sua Job processa itens de uma fila: 10 Pods paralelos até a fila esvaziar. Como declarar?',
['completions: 10, parallelism: 10','Job sem completions fixo + parallelism: 10 (padrão work queue)','CronJob com Replace','DaemonSet com nodeSelector'],1,
'Exato! O padrão work queue: parallelism define os workers; cada Pod sai da fila quando termina.')+
QUIZ('O que acontece se você NÃO definir ttlSecondsAfterFinished numa Job?',
['O cluster apaga sozinho em 1h','A Job e seus Pods ficam para sempre (lixo acumulado)','O Deployment reinicia a Job','O etcd limpa na próxima escrita'],1,
'Isso! Sem TTL, Jobs concluídas ficam retidas — o lixo só cresce. Defina TTL ou limpe na esteira.')},
{id:'m2l7',title:'Init containers, hooks e ciclo de vida do Pod',mins:14,body:
'<p><strong>Init containers</strong> rodam <em>em sequência até completar</em> antes dos containers principais. Casos clássicos: aguardar uma dependência, baixar configuração, rodar migração de banco.</p>'+
C('yaml',`spec:
  initContainers:
  - name: espera-postgres
    image: busybox:1.36
    command: ['sh','-c','until nslookup postgres.pagamentos.svc.cluster.local; do sleep 2; done']
  - name: migra-banco
    image: meuregistry/minha-api:1.0.0
    command: ['dotnet','MinhaApi.dll','--migrate-only']
  containers:
  - name: api
    image: meuregistry/minha-api:1.0.0`)+
'<h2>Regras dos init containers</h2>'+
'<ul><li>Rodam <strong>em ordem</strong>; o próximo só começa quando o anterior sai com exit 0.</li>'+
'<li>Se um init falha, o Pod é <strong>reiniciado por inteiro</strong> (respeitando o <code>restartPolicy</code> do Pod).</li>'+
'<li>Compartilham volumes com os containers principais — padrão comum: baixar config para um volume e montar no app.</li>'+
'<li>Não recebem probes e não participam do tráfego (não existem para o Service).</li></ul>'+
'<h2>Sidecar containers: o init que continua rodando (1.28+/estável 1.33)</h2>'+
'<p>Desde o Kubernetes 1.28 (estável na 1.33), um init container com <code>restartPolicy: Always</code> vira um <strong>sidecar</strong>: ele inicia na fase de init, mas <em>continua rodando</em> durante toda a vida do Pod — e reinicia se morrer, sem derrubar o Pod. É o substituto moderno do padrão "2 containers + agente" para logging, proxy e sync:</p>'+
C('yaml',`spec:
  initContainers:
  - name: logshipper
    image: fluent/fluent-bit:3.1
    restartPolicy: Always      # o que torna este um SIDECAR
    volumeMounts:
    - { name: logs, mountPath: /var/log/app }
  containers:
  - name: api
    image: meuregistry/minha-api:1.0.0
    volumeMounts:
    - { name: logs, mountPath: /app/logs }
  volumes:
  - name: logs
    emptyDir: {}`)+
'<p>Vantagens sobre o init container comum: ordem de start garantida (o sidecar sobe antes do app, como init), mas sem morrer quando termina. Em Jobs, um sidecar não impede a conclusão do Job quando o container principal termina.</p>'+
'<h2>Lifecycle hooks</h2>'+
'<ul><li><code>postStart</code>: roda logo após o container criar. <strong>Atenção:</strong> sem garantia de ordem com o entrypoint — se o hook e o app brigarem pelo mesmo recurso, é corrida. Prefira init containers para "pré-condições".</li>'+
'<li><code>preStop</code>: roda <em>antes</em> do SIGTERM — o ponto-chave para graceful shutdown.</li></ul>'+
'<h2>A sequência de encerramento de um Pod (decore esta)</h2>'+
'<ol><li>O Pod recebe o sinal de terminação (delete, drain, rollout).</li>'+
'<li><strong>preStop</strong> executa (blocking).</li>'+
'<li>O kubelet envia <strong>SIGTERM</strong> aos containers.</li>'+
'<li>Aguarda até <code>terminationGracePeriodSeconds</code> (padrão 30s) os containers saírem.</li>'+
'<li>Estourou o tempo? <strong>SIGKILL</strong> — sem perdão.</li></ol>'+
'<p>Importante: o <code>preStop</code> <em>não tem timeout próprio</em> — ele consome o grace period. <code>sleep 5</code> + grace 45s = o SIGTERM chega ~5s depois, com 40s de sobra para o app drenar.</p>'+
C('yaml',`spec:
  terminationGracePeriodSeconds: 45
  containers:
  - name: api
    lifecycle:
      preStop:
        exec:
          command: ["sh","-c","sleep 5"]   # drena conexões do LB/Service`)+
LAB('Observando o ciclo de vida',
'<ol><li>Aplique um Pod com <code>preStop: sleep 10</code>, grace de 60s e um container que loga sinais: <code>command: [sh, -c, "trap \'echo RECEBI_SIGTERM; exit 0\' TERM; echo iniciou; sleep 3600"]</code>.</li>'+
'<li>Deletar: <code>kubectl delete pod vida</code> (sem --force).</li>'+
'<li>Observe os logs: <code>kubectl logs vida --follow</code> — primeiro o <code>preStop</code> espera 10s, depois o SIGTERM chega e o trap roda.</li>'+
'<li>Confira a timeline no <code>kubectl describe pod vida</code> (Events: Killing/SIGTERM).</li>'+
'<li>Teste o estouro: <code>preStop: sleep 90</code> com grace 30s → SIGKILL após 30s.</li></ol>')+
NOTE('O Generic Host do ASP.NET Core já trata SIGTERM com <em>graceful shutdown</em> (para de aceitar requests e aguarda os em andamento). Para Workers (<code>BackgroundService</code>), implemente <code>StopAsync</code> corretamente e considere <code>services.Configure&lt;HostOptions&gt;(o =&gt; o.ShutdownTimeout = TimeSpan.FromSeconds(40));</code> para casar com o grace period. Regra de ouro: <strong>grace do Pod &gt; preStop + shutdown do app</strong>, com folga — senão SIGKILL corta requests em voo.')+
TERMS([['Init container','Roda antes dos containers principais, em ordem, até completar'],['postStart','Hook pós-criação (sem ordem garantida com o entrypoint)'],['preStop','Hook pré-terminação — drena conexões antes do SIGTERM'],['SIGTERM','Sinal de "encerre com educação" — o app deve tratar'],['SIGKILL','Morte súbita — acontece se o grace period estourar'],['terminationGracePeriodSeconds','Janela total entre preStop e SIGKILL (padrão 30s)']])+
QUIZ('Seu grace period é 30s, o preStop dorme 20s e o app demora 25s para drenar. O que acontece?',
['Tudo certo — 20 + 25 &lt; 30','O app é morto com SIGKILL antes de terminar de drenar','O preStop é pulado','O cluster espera mais 30s'],1,
'Exato! preStop + drenagem consomem o mesmo grace period (30s): 20+25 = 45s &gt; 30s → SIGKILL. Ajuste grace &gt; preStop + shutdown.')+
QUIZ('Para "garantir que o banco existe antes de subir a API", o ideal é…',
['postStart com sleep','Init container com retry/espera','LivenessProbe no banco','Preferir um Sidecar'],1,
'Isso! Init container é a forma declarativa de pré-condição; postStart não tem ordem garantida com o entrypoint.')},
{id:'m2l8',title:'O container runtime: CRI, containerd e crictl',mins:14,body:
'<p>Quando o kubelet decide que um Pod deve rodar no node, quem efetivamente <strong>cria e executa os containers</strong> é o <strong>container runtime</strong>. Esta lição desce um nível: o que roda entre o kubelet e o processo do seu app.</p>'+
'<h2>CRI: a interface padronizada</h2>'+
'<p>O <strong>Container Runtime Interface (CRI)</strong> é o contrato gRPC entre o kubelet e o runtime (gRPC na porta 2379 do node, socket unix). Com o CRI, o Kubernetes não precisa saber os detalhes de nenhum runtime — qualquer runtime que implemente o CRI funciona. Os dois grandes: <strong>containerd</strong> (padrão no AKS/GKE/EKS e no kind) e <strong>CRI-O</strong>.</p>'+
'<h2>A pilha por dentro do node</h2>'+
'<ol><li><strong>kubelet</strong> decide o que o Pod precisa (imagem, volumes, flags).</li>'+
'<li><strong>containerd</strong> (daemon) baixa a imagem e prepara o sandbox.</li>'+
'<li><strong>runc</strong> (OCI runtime) cria os processos do container com namespaces/cgroups.</li>'+
'<li><strong>CNI plugins</strong> conectam a rede do Pod ao node.</li></ol>'+
'<p>Ou seja: o "docker" que você usa no dia a dia é uma <em>ferramenta de dev</em> que fala com o containerd; no cluster, o containerd é usado <em>direto</em>, sem o daemon do Docker no meio.</p>'+
'<h2>crictl: o kubectl do runtime</h2>'+
'<p>O <code>crictl</code> é o cliente de linha de comando do CRI — útil para inspecionar o node quando o kubectl "não enxerga" (ex.: Pod preso em ContainerCreating). No kind, cada node é um container Docker: você entra no node e usa o crictl de dentro.</p>'+
C('bash',`# No kind: "entre" no node e use o crictl
docker exec -it kind-worker-0 crictl ps -a        # TODOS os containers (incl. pause)
docker exec -it kind-worker-0 crictl ps | grep -c pause   # 1 pause por Pod
docker exec -it kind-worker-0 crictl images       # imagens presentes no node
docker exec -it kind-worker-0 crictl pull nginx:1.27  # baixar manualmente
docker exec -it kind-worker-0 crictl inspect <container-id> | head -40`)+
'<h2>imagePullPolicy: quando o runtime baixa a imagem</h2>'+
'<table class="tbl"><tr><th>Política</th><th>Comportamento</th><th>Uso</th></tr>'+
'<tr><td><code>Always</code></td><td>sempre faz pull (mesmo se já existe local)</td><td>tags mutáveis (<code>latest</code>) e CI</td></tr>'+
'<tr><td><code>IfNotPresent</code></td><td>baixa só se não existe no node</td><td>padrão para tags <code>1.0.0</code> (imutáveis)</td></tr>'+
'<tr><td><code>Never</code></td><td>nunca baixa — usa só o que existe</td><td>kind/testes offline; imagens locais</td></tr></table>'+
'<p>Detalhe que confunde muita gente: para tags que NÃO são <code>latest</code>, o padrão é <code>IfNotPresent</code> — ou seja, se a imagem <code>minha-api:1.0.0</code> já existe no node, o runtime <em>não</em> refaz o pull. É por isso que tags mutáveis com o mesmo nome (ex.: <code>1.0.0</code> reenviada) podem rodar a versão velha: use <code>imagePullPolicy: Always</code> (ou SHA imutável) nesses casos.</p>'+
DEEP('O pull acontece em cada node, não "no cluster". Quando você escala um Deployment para 10 réplicas em 3 nodes, cada node baixa a imagem para si (com cache). Imagens grandes × nodes muitos = rollout lento. Por isso imagens pequenas e registry próximo (ACR/GAR/ECR na mesma região) importam tanto.')+
'<h2>RuntimeClass: escolhendo o runtime por Pod (e o Pod Overhead)</h2>'+
'<p>O <strong>RuntimeClass</strong> permite escolher <em>qual configuração de runtime</em> um Pod usa — para equilibrar segurança × desempenho ou rodar workloads especiais:</p>'+
'<ul><li><strong>gVisor / Kata Containers:</strong> isolamento com virtualização (sandbox) — Pods mais seguros, um pouco mais lentos; usados para workloads não-confiáveis.</li>'+
'<li><strong>Windows HostProcess:</strong> Pods Windows com acesso ao host.</li>'+
'<li><strong>Pod Overhead:</strong> o RuntimeClass pode declarar CPU/memória extras que o runtime consome — o scheduler soma ao request do Pod na conta do node (evita overcommit).</li></ul>'+
C('yaml',`apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata: { name: sandboxed }
handler: runsc            # ex.: gVisor
overhead:
  podFixed:
    cpu: "250m"
    memory: "64Mi"
scheduling:
  nodeSelector: { kubernetes.io/os: linux }`)+
C('yaml',`spec:
  runtimeClassName: sandboxed   # o Pod usa o runtime escolhido
  containers:
  - name: api
    image: meuregistry/minha-api:1.0.0`)+
'<p>Se o RuntimeClass não existir (ou o CRI não suportar o handler), o Pod falha — sem erro silencioso. Nos clouds gerenciados, o suporte a gVisor/Kata varia (confira a doc do provider); no kind, o <code>handler</code> padrão é o containerd.</p>'+
LAB('Inspecionando o runtime no kind',
'<ol><li>Aplique um Pod simples (<code>nginx:1.27</code>) e espere <code>Running</code>.</li>'+
'<li><code>docker exec kind-worker-0 crictl ps -a</code> — identifique: 1 <code>pause</code> + 1 <code>nginx</code> (mais o que o próprio node roda).</li>'+
'<li><code>docker exec kind-worker-0 crictl images | grep nginx</code> — a imagem está no node.</li>'+
'<li>Teste o pull manual: <code>docker exec kind-worker-0 crictl pull alpine:3.20</code> e confira em <code>crictl images</code>.</li>'+
'<li>(Só por curiosidade) Veja os processos do node: <code>docker exec kind-worker-0 ps aux | head</code>.</li></ol>')+
NOTE('No .NET, o runtime importa menos para o código — mas saber que <code>mcr.microsoft.com/dotnet/aspnet</code> roda em cima do containerd em qualquer cloud responde metade dos "porquês" de compatibilidade. E se um dia o Pod ficar preso em <code>ContainerCreating</code>, o <code>crictl ps -a</code> no node mostra o erro real do runtime que o kubectl esconde.')+
TERMS([['CRI','Interface gRPC kubelet↔runtime (containerd, CRI-O)'],['containerd','Runtime padrão dos clouds gerenciados e do kind'],['runc','OCI runtime: cria os processos com namespaces/cgroups'],['crictl','CLI do CRI — inspeciona containers no node'],['imagePullPolicy','Always / IfNotPresent / Never — quando o node baixa a imagem']])+
QUIZ('O Pod está preso em ContainerCreating e o kubectl describe não mostra nada útil. Onde olhar?',
['No etcd','No node, com crictl ps -a / crictl inspect','No kube-scheduler','No Registry'],1,
'Isso! O erro real do runtime (imagem, rede, volume) aparece no crictl do node — o kubectl só mostra o sintoma.')+
QUIZ('Sua equipe reenviou a imagem minha-api:1.0.0 (mesma tag) e os Pods continuam com a versão antiga. Por quê?',
['O registry bloqueia reenvio','imagePullPolicy padrão para tag não-latest é IfNotPresent — o node não refaz o pull','O kubelet não reinicia Pods','O containerd não suporta update'],1,
'Exato! Para tags que não são latest, o padrão é IfNotPresent. Use Always ou tag por SHA/commit para tags mutáveis.')}
]};
