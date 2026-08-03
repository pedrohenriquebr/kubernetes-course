/* Módulo 10 — Kubernetes para Devs .NET */
const MOD10 = {id:'m10',num:'10',title:'Avançado: Operators, Upgrades & Projeto Final',level:'adv',lessons:[
{id:'m10l1',title:'CRDs e Operators: estendendo o Kubernetes',mins:15,body:
'<p>Lembra do modelo declarativo? <strong>CRDs (Custom Resource Definitions)</strong> deixam você inventar <em>novos objetos</em>, e um <strong>controller/Operator</strong> implementa o reconciliation loop deles. É assim que o ecossistema modela "coisas" fora do core:</p>'+
C('yaml',`apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata: { name: backups.exemplo.com.br }
spec:
  group: exemplo.com.br
  scope: Namespaced
  names: { kind: Backup, plural: backups, singular: backup }
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              schedule: { type: string }`)+
'<h2>Lendo um CRD (o que importa para quem consome)</h2>'+
'<ul><li><strong>group/kind:</strong> a identidade do recurso (<code>backups.exemplo.com.br</code> = group <code>exemplo.com.br</code>, kind <code>Backup</code>).</li>'+
'<li><strong>scope:</strong> Namespaced ou Cluster (se vale por cluster inteiro).</li>'+
'<li><strong>versions:</strong> <code>served</code> (quais a API aceita) e <code>storage</code> (qual persiste no etcd) — a mecânica da evolução de versões.</li>'+
'<li><strong>openAPIV3Schema:</strong> a validação do spec (o equivalente ao schema do Deployment, mas seu).</li>'+
'<li><strong>status + subresources:</strong> onde o controller escreve o estado observado (e o <code>/status</code> separado, como nos recursos nativos).</li></ul>'+
'<p>Exemplos famosos que você já usou neste curso sem saber: <em>cert-manager</em> (Certificate), <em>Prometheus Operator</em> (ServiceMonitor), <em>ArgoCD</em> (Application), <em>KEDA</em> (ScaledObject), <em>Kyverno</em> (Policy), <em>Strimzi</em> (Kafka).</p>'+
TIP('Existe um segundo caminho para "estender a API" além do CRD: a <strong>API Aggregation Layer</strong> — você serve um endpoint HTTP próprio (com authn/authz delegados ao API Server) e o registra como <code>APIService</code>. É mais poderoso (controle total do protocolo), mas muito mais trabalho; CRDs cobrem 95% dos casos (ex.: metrics-server e o próprio KEDA usam APIService para métricas customizadas).')+
'<h2>O controller por dentro (o mesmo loop de sempre)</h2>'+
'<ol><li><strong>Watch:</strong> observa o recurso customizado (ex.: <code>Backup</code>).</li>'+
'<li><strong>Reconcile:</strong> compara estado atual × desejado (ex.: "o backup das 02h existe?") e age (cria o Job do backup).</li>'+
'<li><strong>Status:</strong> escreve o resultado (LastBackupTime, Status: Succeeded).</li>'+
'<li>Repete para sempre — a mesma filosofia do Deployment, mas com a sua lógica de negócio.</li></ol>'+
'<p>Quando precisar <strong>escrever</strong> um, o caminho é <strong>Kubebuilder/controller-runtime</strong> (Go) ou o <em>KubeOps</em> (C#!), que geram o esqueleto do controller (detalhe na lição m10l5):</p>'+
C('bash',`# esqueleto de um operator em Go com Kubebuilder
kubebuilder init --domain exemplo.com.br --repo github.com/meu/backup-operator
kubebuilder create api --group exemplo --version v1 --kind Backup`)+
LAB('Consumindo um CRD de verdade',
'<ol><li>Instale o cert-manager: <code>helm upgrade --install cert-manager cert-manager --repo https://charts.jetstack.io --set installCRDs=true -n cert-manager --create-namespace</code>.</li>'+
'<li>Veja o CRD: <code>kubectl get crd certificates.cert-manager.io -o yaml</code> — repare no schema e no status.</li>'+
'<li>Use a documentação embutida: <code>kubectl explain certificate.spec</code>.</li>'+
'<li>Crie um Certificate e veja o controller escrever o status: <code>kubectl get certificate -w</code> + <code>kubectl get secret</code> (o controller cria o Secret TLS).</li>'+
'<li>Conclusão: você acabou de "usar um operator" — consumir CRDs é o dia a dia; escrever, raro.</li></ol>')+
NOTE('Sim, existe ecossistema .NET para Operators (KubeOps, dotnet-operator-sdk). Para a maioria dos casos, porém, você vai CONSUMIR operators — e para isso basta saber <code>kubectl explain</code> + ler o CRD.')+
TERMS([['CRD','Definição de um recurso customizado (schema + validação)'],['Custom Resource','Instância do seu recurso (um objeto Backup, Certificate…)'],['Controller','Loop de reconciliação que implementa o comportamento'],['Operator','CRD + controller empacotados (cert-manager, ArgoCD, KEDA)'],['Status subresource','Onde o controller reporta o estado observado'],['Kubebuilder','SDK Go para gerar operators']])+
QUIZ('O cert-manager, o ArgoCD e o KEDA são…',
['Plugins do kubectl','Operators: CRDs + controllers','Add-ons do CoreDNS','Versões do Helm'],1,
'Isso! Todos expõem CRDs e rodam controllers que reconciliam.')+
QUIZ('Qual parte do CRD valida o spec do seu recurso?',
['metadata.name','openAPIV3Schema','scope','status'],1,
'Exato! O schema OpenAPI valida o que pode entrar no spec — igual aos recursos nativos.')},
{id:'m10l2',title:'Upgrades, manutenção e drains',mins:14,body:
'<p>Clusters precisam de patch constante (segurança!). Nos gerenciados, o fluxo padrão é: <strong>upgrade do Control Plane primeiro</strong> (via provider), depois <strong>node pools</strong> — normalmente com <em>surge nodes</em>: nodes novos entram, Pods migram, nodes antigos saem. Mantenha a política de <em>version skew</em>: kubelets podem ficar no máximo algumas versões menores atrás do API server; não deixe o cluster "derivar".</p>'+
'<h2>O ciclo do upgrade de node (a mesma mecânica em todo lugar)</h2>'+
'<ol><li><strong>Cordon:</strong> o node para de receber Pods novos.</li>'+
'<li><strong>Drain:</strong> os Pods são evacuados (eviction via API — respeita PDBs e grace periods).</li>'+
'<li><strong>Upgrade/reboot:</strong> o node atualiza (ou é substituído por um novo).</li>'+
'<li><strong>Uncordon:</strong> o node volta a receber Pods.</li></ol>'+
C('bash',`# operações de manutenção manual (mesma mecânica dos clouds):
kubectl cordon node-3          # marca como não-agendável
kubectl drain node-3 \\
  --ignore-daemonsets \\
  --delete-emptydir-data       # evacua Pods respeitando PDBs!
kubectl uncordon node-3        # volta a aceitar Pods`)+
'<h2>O que trava (e destrava) um drain</h2>'+
'<table class="tbl"><tr><th>Situação</th><th>Comportamento</th></tr>'+
'<tr><td>PDB no mínimo de réplicas</td><td>o drain <strong>trava</strong> esperando (ou exija <code>--disable-eviction</code> para forçar)</td></tr>'+
'<tr><td>DaemonSet no node</td><td>precisa de <code>--ignore-daemonsets</code> (DaemonSet não migra)</td></tr>'+
'<tr><td>Pod com emptyDir</td><td>precisa de <code>--delete-emptydir-data</code> (dados efêmeros)</td></tr>'+
'<tr><td>Pod não gerenciado (Pod solto)</td><td>drain recusa (ou <code>--force</code> — não recomendado)</td></tr></table>'+
'<p>E o que garante zero downtime durante tudo isso (Módulo 5 de novo): Deployments com múltiplas réplicas espalhadas (anti-affinity/topology spread) + <strong>PDB</strong> + <strong>terminationGracePeriodSeconds</strong> adequado + <strong>preStop</strong> + probes corretos.</p>'+
'<h2>Janelas de manutenção (nos clouds)</h2>'+
'<p>AKS (maintenance windows), GKE (maintenance windows com exclusões) e EKS (via configuração do upgrade) permitem agendar upgrades para a madrugada — e <em>surge</em> para controlar quantos nodes sobem de uma vez. Use: upgrade em janela + surge 1 + PDBs em todos os workloads = sem janela de indisponibilidade.</p>'+
'<h2>O procedimento "blue/green" de upgrade de node pool</h2>'+
'<p>Em vez de atualizar nodes no lugar, o padrão mais seguro (usado no GKE e replicável em qualquer cloud): <strong>crie um node pool NOVO</strong> com a versão nova → <code>cordon</code> no pool antigo (nada novo cai lá) → <code>kubectl rollout restart</code> nos Deployments (os Pods migram para o pool novo) → <code>kubectl drain</code> no que sobrar → <strong>delete o pool antigo</strong>. A versão nova é validada em produção ANTES de o antigo ser desligado — se algo falhar, é só não deletar o pool antigo.</p>'+
LAB('Simulando um upgrade no kind',
'<ol><li>Garanta o Deployment com 3 réplicas + PDB (<code>minAvailable: 2</code>) + anti-affinity por hostname.</li>'+
'<li><code>kubectl cordon kind-worker</code> — novos Pods não caem mais nele.</li>'+
'<li><code>kubectl drain kind-worker --ignore-daemonsets --delete-emptydir-data</code> — os Pods migram para o outro worker (o PDB segura o mínimo).</li>'+
'<li>Confira: <code>kubectl get pods -o wide</code> — nenhum Pod no node drenado.</li>'+
'<li><code>kubectl uncordon kind-worker</code> — o node volta a receber Pods.</li>'+
'<li>Desafio: com replicas: 2 e <code>minAvailable: 2</code>, o drain trava? Por quê?</li></ol>')+
NOTE('Sua parte como dev no upgrade: o app precisa aceitar SIGTERM e drenar conexões (o ASP.NET Core já faz), processar Jobs idempotentemente e não depender de IP/hostname do Pod. Se o app não é "drenável", a manutenção do cluster vira janela de indisponibilidade.')+
QUIZ('Durante um node drain, o que impede que TODAS as réplicas da sua API sejam evacuadas ao mesmo tempo?',
['O kube-proxy','O PodDisruptionBudget','O ConfigMap','O HPA'],1,
'Correto! O PDB é respeitado pelo drain (eviction via API) e garante o mínimo de disponibilidade durante manutenções voluntárias.')+
QUIZ('O drain travou. O que você faz?',
['kubectl delete node','Investiga (PDB no mínimo? DaemonSet? emptyDir?) e resolve — ou usa --disable-eviction sabendo do risco','kubectl force','Reinicia o kubelet'],1,
'Isso! Drain travar é o sistema protegendo você. Resolva a causa; forçar é a exceção.')+
TERMS([['Cordon','Node não recebe Pods novos'],['Drain','Evacua os Pods (respeita PDB)'],['Uncordon','Node volta a receber Pods'],['Surge','Quantos nodes novos entram por vez no upgrade'],['Version skew','kubelet até 3 versões atrás do API Server'],['Maintenance window','Janela agendada para upgrades (madrugada)']])},
{id:'m10l3',title:'Multi-cluster e padrões avançados',mins:12,body:
'<ul><li><strong>Por que multi-cluster?</strong> DR/região extra, isolamento de tenants, blast radius, follow-the-sun.</li>'+
'<li><strong>Gerência de frota:</strong> Google Fleet/Anthos, Azure Arc/AKS Fleet, AWS EKS Anywhere.</li>'+
'<li><strong>Deploy em frota:</strong> GitOps com ArgoCD "app-of-apps"/ApplicationSet ou Flux — o Git continua sendo a fonte da verdade de todos os clusters.</li>'+
'<li><strong>Tráfego global:</strong> DNS geo + Global Load Balancers (Azure Front Door, Cloud LB global, Route53) apontando para o gateway de cada cluster.</li></ul>'+
'<h2>Os três padrões de multi-cluster</h2>'+
'<table class="tbl"><tr><th>Padrão</th><th>O que resolve</th><th>Quando</th></tr>'+
'<tr><td>Hub-and-spoke (frota)</td><td>gerência central: config, observabilidade, GitOps em N clusters</td><td>muitos clusters pequenos (times, regiões)</td></tr>'+
'<tr><td>Active/passive (DR)</td><td>cluster principal + standby que assume</td><td>RTO/RPO definidos; tráfego geo + failover manual</td></tr>'+
'<tr><td>Active/active</td><td>tráfego global distribuído entre regiões</td><td>latência e alta disponibilidade globais (complexo: dados!)</td></tr></table>'+
'<p>O ponto mais difícil NÃO é o Kubernetes — é o <strong>estado</strong>: banco multi-região, filas, cache. Multi-cluster de workloads stateless é "fácil"; multi-cluster de dados é um projeto de arquitetura de dados.</p>'+
'<h2>GitOps multi-cluster na prática</h2>'+
'<p>O padrão ArgoCD: um ApplicationSet com generator por cluster, apontando para o mesmo repo:</p>'+
C('yaml',`apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata: { name: loja, namespace: argocd }
spec:
  generators:
  - clusters: {}                  # para cada cluster registrado no ArgoCD
  template:
    metadata: { name: 'loja-{{name}}' }
    spec:
      project: default
      source:
        repoURL: https://github.com/minha-org/k8s-manifests
        targetRevision: main
        path: 'overlays/{{name}}'   # um overlay por cluster
      destination:
        server: '{{server}}'
        namespace: loja`)+
WARN('Multi-cluster multiplica custo e complexidade (identidade, rede, secrets, observabilidade por cluster). Comece com UM cluster bem operado; multi-cluster é resposta a requisito explícito de negócio/DR.')+
TERMS([['Multi-cluster','Vários clusters por região/tenant/ambiente'],['Hub-and-spoke','Frota gerenciada centralmente (Fleet, Arc, EKS Anywhere)'],['ApplicationSet','Template de Application por cluster (ArgoCD)'],['Active/passive','DR: standby assume no failover'],['Active/active','Tráfego global distribuído (o estado é o desafio)']])+
QUIZ('O maior desafio do multi-cluster NÃO é o Kubernetes, é…',
['O kubectl','O estado (dados, filas, cache)','O Ingress','O Helm'],1,
'Isso! Workloads stateless replicam fácil; dados multi-região é projeto de arquitetura.')+
QUIZ('Deploy em N clusters com o mesmo repo Git: qual ferramenta?',
['kubectl na mão em cada um','ArgoCD ApplicationSet (generator por cluster) ou Flux','Um script SSH','Kustomize sozinho'],1,
'Exato! O Git vira a fonte da verdade de TODOS os clusters de uma vez.')},
{id:'m10l4',title:'Projeto final: microsserviços .NET de ponta a ponta',mins:20,body:
'<p>Hora de juntar tudo. Arquitetura alvo: <strong>API de pedidos</strong> (.NET) + <strong>worker</strong> de fila + <strong>Postgres</strong>, com Ingress TLS, probes, HPA, PDB, secrets do cloud e CI/CD GitOps.</p>'+
C('yaml',`# 1) namespace (com PSA) + config
apiVersion: v1
kind: Namespace
metadata:
  name: loja
  labels:
    pod-security.kubernetes.io/enforce: restricted
---
apiVersion: v1
kind: ConfigMap
metadata: { name: pedidos-config, namespace: loja }
data:
  ASPNETCORE_ENVIRONMENT: Production
  QueueSettings__NomeFila: "pedidos-novos"
---
# 2) Deployment da API com tudo que o curso ensinou
apiVersion: apps/v1
kind: Deployment
metadata: { name: pedidos-api, namespace: loja }
spec:
  replicas: 2
  selector: { matchLabels: { app: pedidos-api } }
  template:
    metadata:
      labels: { app: pedidos-api }
      annotations: { prometheus.io/scrape: "true", prometheus.io/port: "9464" }
    spec:
      serviceAccountName: pedidos-api
      terminationGracePeriodSeconds: 45
      containers:
      - name: api
        image: meuregistry/pedidos-api:1.4.0
        ports: [{ containerPort: 8080 }]
        envFrom: [{ configMapRef: { name: pedidos-config } }]
        resources:
          requests: { cpu: 250m, memory: 256Mi }
          limits:   { cpu: "1",  memory: 512Mi }
        startupProbe:  { httpGet: { path: /healthz/startup, port: 8080 }, failureThreshold: 30, periodSeconds: 2 }
        livenessProbe: { httpGet: { path: /healthz/live,  port: 8080 }, periodSeconds: 10 }
        readinessProbe:{ httpGet: { path: /healthz/ready, port: 8080 }, periodSeconds: 5 }
        lifecycle:
          preStop: { exec: { command: ["sh","-c","sleep 5"] } }
        securityContext:
          runAsNonRoot: true
          readOnlyRootFilesystem: true
          allowPrivilegeEscalation: false
          capabilities: { drop: ["ALL"] }
---
# 3) Service + Ingress + HPA + PDB
apiVersion: v1
kind: Service
metadata: { name: pedidos-api, namespace: loja }
spec:
  selector: { app: pedidos-api }
  ports: [{ port: 80, targetPort: 8080 }]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata: { name: loja, namespace: loja }
spec:
  ingressClassName: nginx
  rules:
  - host: api.loja.example.com
    http:
      paths:
      - { path: /, pathType: Prefix, backend: { service: { name: pedidos-api, port: { number: 80 } } } }
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: pedidos-api, namespace: loja }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: pedidos-api }
  minReplicas: 2
  maxReplicas: 8
  metrics:
  - type: Resource
    resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: pedidos-api, namespace: loja }
spec:
  minAvailable: 1
  selector: { matchLabels: { app: pedidos-api } }`)+
'<h2>O plano de implementação (fases, na ordem)</h2>'+
'<ol><li><strong>Fase 1 — Fundação local:</strong> cluster kind de 3 nodes; namespace <code>loja</code> com PSA; Postgres via Helm (ou, para o padrão de produção, o operador <strong>CloudNativePG</strong> — Postgres declarativo em CRDs, com backup para object store; é assim que operadores de banco funcionam no mundo real).</li>'+
'<li><strong>Fase 2 — API de pedidos:</strong> Dockerfile multi-stage (Módulo 1); Deployment + Service + ConfigMap + Secrets (Módulos 2–3); healthchecks live/ready separados (Módulo 5).</li>'+
'<li><strong>Fase 3 — Resiliência:</strong> probes + resources calibrados (meça com kubectl top) + HPA + PDB + anti-affinity + preStop/grace (Módulo 5).</li>'+
'<li><strong>Fase 4 — Rede:</strong> Ingress NGINX com TLS (cert-manager) e NetworkPolicy default-deny + allow (Módulo 4).</li>'+
'<li><strong>Fase 5 — Observabilidade:</strong> logs JSON, /metrics OTel, kube-prometheus-stack + dashboards, tracing (Módulo 7).</li>'+
'<li><strong>Fase 6 — Worker de fila:</strong> Worker .NET + KEDA com scale-to-zero na fila (Módulo 5) + job de migração via Helm hook (Módulo 6).</li>'+
'<li><strong>Fase 7 — CI/CD:</strong> GitHub Actions (buildx cache + Trivy + SBOM + tag por SHA) → ArgoCD GitOps (Módulo 6).</li>'+
'<li><strong>Fase 8 — Segurança e caos:</strong> PSA enforce, Kyverno (no-latest, resources), scan no registry, e o laboratório de caos do Módulo 5 validando tudo.</li>'+
'<li><strong>Fase 9 — Cloud:</strong> porta o mesmo manifest para AKS/GKE/EKS (Módulo 9): workload identity + cofre + ingress do provider.</li></ol>'+
'<h3>Checklist de entrega (valide-se!)</h3>'+
'<ol><li>✅ Imagem multi-stage, não-root, sem <code>latest</code> (Módulos 1 e 8).</li>'+
'<li>✅ Config via ConfigMap; segredos via cofre do cloud com workload identity (Módulos 3 e 8).</li>'+
'<li>✅ Probes + resources + HPA + PDB + preStop/grace period (Módulos 2 e 5).</li>'+
'<li>✅ Ingress com TLS; Service ClusterIP interno (Módulo 4).</li>'+
'<li>✅ Logs estruturados + métricas OTel + tracing (Módulo 7).</li>'+
'<li>✅ CI publica imagem por SHA; CD via GitOps (Módulo 6).</li>'+
'<li>✅ NetworkPolicy default-deny + PSA no namespace (Módulos 4 e 8).</li>'+
'<li>✅ Worker em KEDA com scale-to-zero quando a fila esvazia (Módulo 5).</li>'+
'<li>✅ Caos testado: drain, morte de node, OOM, banco fora (Módulo 5).</li></ol>'+
LAB('O dia da entrega',
'<ol><li>Substitua <code>meuregistry</code> pelas suas imagens reais e aplique o manifest acima no seu cluster.</li>'+
'<li>Rode o laboratório de caos completo (m5l6): morte de Pod, morte de node, drain com PDB, OOM.</li>'+
'<li>Gere carga e veja o HPA escalar (com metrics-server instalado).</li>'+
'<li>Simule um rollout ruim e faça o rollback instantâneo.</li>'+
'<li>Audite: <code>kubectl auth can-i --list</code>, <code>kubectl get networkpolicy</code>, <code>kubectl get pdb</code> — tudo no lugar?</li></ol>')+
NOTE('Parabéns por chegar até aqui! <span class="mi" aria-hidden="true">celebration</span> Você agora domina o modelo mental agnóstico do Kubernetes (cobrindo TODAS as áreas da documentação de conceitos oficial) e sabe traduzi-lo para AKS, GKE ou EKS. Próximo passo sugerido: certificação <strong>CKAD</strong> — especialmente alinhada ao perfil de dev que este curso construiu (veja a lição m10l6).')},
{id:'m10l5',title:'Operators na prática: Kubebuilder e controller-runtime',mins:14,body:
'<p>A lição m10l1 mostrou o que é um operator por fora. Agora, o esqueleto de um de verdade — para você saber o que está por trás quando um dia precisar (ou para decidir conscientemente que não precisa).</p>'+
'<h2>1. O esqueleto (Kubebuilder)</h2>'+
C('bash',`# pré-requisito: Go 1.22+
kubebuilder init --domain exemplo.com.br --repo github.com/meu/backup-operator
kubebuilder create api --group exemplo --version v1 --kind Backup
# Gera: api/v1/backup_types.go (o CRD) + internal/controller/backup_controller.go`)+
'<h2>2. O reconciler (o coração)</h2>'+
C('go',`// internal/controller/backup_controller.go (essência)
func (r *BackupReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // 1) Lê o estado DESEJADO (o CR)
    var backup exemplov1.Backup
    if err := r.Get(ctx, req.NamespacedName, &backup); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }

    // 2) Lê o estado ATUAL (ex.: o Job de backup existe?)
    job := &batchv1.Job{}
    err := r.Get(ctx, types.NamespacedName{Name: backup.Name, Namespace: backup.Namespace}, job)

    // 3) Reconcilia: cria o Job se não existe
    if errors.IsNotFound(err) {
        novo := buildJob(&backup)
        if err := r.Create(ctx, novo); err != nil {
            return ctrl.Result{}, err
        }
    }

    // 4) Escreve o status observado
    backup.Status.LastBackup = metav1.Now()
    return ctrl.Result{RequeueAfter: time.Hour}, r.Status().Update(ctx, &backup)
}`)+
'<p>Repare: é o MESMO padrão do curso inteiro — desejo vs atual, e ação para aproximar. O controller-runtime cuida do watch, do requeue e dos retries; você escreve só o "o que fazer quando algo muda".</p>'+
'<h2>3. Rodar e instalar</h2>'+
C('bash',`make install        # instala os CRDs no cluster
make run             # roda o controller localmente (debug!)
# ou, em produção: make docker-build docker-push && make deploy`)+
'<h2>E o .NET nessa história?</h2>'+
'<p>Existe o <strong>KubeOps</strong> (C#): a mesma ideia com <code>[EntityKind]</code>, <code>IResourceController&lt;T&gt;</code> e templates de CRD gerados de classes. Na prática, a maioria dos times .NET NUNCA escreve operators — consome (cert-manager, ArgoCD, KEDA, Kyverno, Strimzi). Quando o negócio exige (ex.: um "Banco de Dados como Serviço" interno), o caminho Go é o padrão da comunidade.</p>'+
LAB('Seu primeiro operator (30 minutos)',
'<ol><li>Instale o Go e o Kubebuilder (docs oficiais).</li>'+
'<li>Rode <code>kubebuilder init</code> + <code>kubebuilder create api</code> como acima.</li>'+
'<li><code>make manifests</code> e inspecione o CRD gerado em <code>config/crd/</code>.</li>'+
'<li>Rode <code>make install</code> e crie uma instância do CR: <code>kubectl apply -f config/samples/</code>.</li>'+
'<li>Rode <code>make run</code> e veja o log do reconciler quando você criar/deletar o recurso.</li>'+
'<li>Conclusão honesta: entendeu o mecanismo? Ótimo — agora volte para consumir operators, que é onde o dev .NET agrega valor.</li></ol>')+
NOTE('Como dev .NET, o conhecimento que paga é <em>ler</em> CRDs e <em>usar</em> operators com segurança (kubectl explain, status, condições). Escrever operator é um projeto em si — avalie o ROI antes.')+
TERMS([['Kubebuilder','SDK Go: gera CRD + controller + CRDs'],['controller-runtime','Framework do loop de reconciliação (watch, requeue)'],['Reconciler','Sua função: desejo vs atual → ação'],['RequeueAfter','Quando o controller volta a reconciliar'],['KubeOps','Ecossistema C# para operators'],['make install/run','Instala CRDs / roda o controller local']])+
QUIZ('O controller-runtime faz por você:',
['A lógica de negócio','O watch, o requeue e os retries — você escreve a reconciliação','O Dockerfile','O CI/CD'],1,
'Isso! Você escreve o "o que fazer"; o framework cuida do loop.')+
QUIZ('Onde o dev .NET agrega mais valor em operators?',
['Escrevendo o próprio na primeira semana','Consumindo operators prontos (kubectl explain, status, condições)','Forkando o cert-manager','Rodando kubebuilder em produção'],1,
'Exato! 99% dos casos: consumir. Escrever é projeto com ROI a avaliar.')},
{id:'m10l6',title:'Rumo à CKAD: estratégia e simulado',mins:14,body:
'<p>O <strong>CKAD</strong> (Certified Kubernetes Application Developer) é a certificação da CNCF para quem <em>desenvolve</em> para Kubernetes — exatamente o perfil deste curso. Diferente do CKA (admin), o CKAD foca em workloads, rede, storage, troubleshooting e, principalmente, <strong>velocidade com kubectl</strong>.</p>'+
'<h2>O formato</h2>'+
'<ul><li>Prova prática de <strong>2 horas</strong> em ambiente real (você opera clusters reais via kubectl no navegador).</li>'+
'<li>~15–20 questões, nota mínima ~66% (varia por edição).</li>'+
'<li>Domínios (pesos aproximados): aplicações (20%), troubleshooting (30%), topologia de workloads (20%), services/rede (15%), storage (10%), configuração (20%).</li>'+
'<li>Docs do Kubernetes liberadas (kubernetes.io/docs) — <em>mas não o kubectl explain no navegador</em>: treine consultar a doc rápido.</li></ul>'+
'<h2>A estratégia de prova (o que separa quem passa)</h2>'+
'<ol><li><strong>Aliases e atalhos desde o primeiro minuto:</strong> <code>export k=kubectl</code> + completions; <code>kubectl get po,deploy,svc -n ns</code>.</li>'+
'<li><strong>Gere YAML em vez de digitar:</strong> <code>kubectl create deploy web --image=nginx --dry-run=client -o yaml &gt; web.yaml</code> e <em>edite</em> — nunca escreva YAML do zero.</li>'+
'<li><strong>kubectl explain é seu amigo:</strong> <code>kubectl explain deployment.spec.template.spec.containers.resources</code> para campos exatos.</li>'+
'<li><strong>Vá do mais fácil para o mais difícil;</strong> cada questão vale ponto — não fique preso.</li>'+
'<li><strong>Validar é rápido:</strong> <code>kubectl get events</code> e <code>kubectl describe</code> confirmam que a questão foi resolvida (não confie no "parece certo").</li>'+
'<li><strong>Treine com tempo:</strong> simulados de 2h cronometrados — a prova é um jogo de tempo.</li></ol>'+
C('bash',`# os comandos que mais caem (domine estes):
kubectl create deployment web --image=nginx --replicas=2 --dry-run=client -o yaml > d.yaml
kubectl create job job1 --image=busybox --dry-run=client -o yaml -- sh -c 'sleep 5' > j.yaml
kubectl create cronjob cron1 --image=busybox --schedule="*/5 * * * *" --dry-run=client -o yaml > c.yaml
kubectl expose deploy web --port=80 --target-port=8080 --type=ClusterIP --dry-run=client -o yaml > s.yaml
kubectl create configmap cfg --from-literal=key=value --dry-run=client -o yaml > cm.yaml
kubectl create secret generic sec --from-literal=pass=123 --dry-run=client -o yaml > sec.yaml
kubectl label node node1 disktype=ssd
kubectl taint nodes node1 gpu=true:NoSchedule
kubectl rollout undo deploy web
kubectl logs po -l app=web --tail=5 --previous`)+
'<h2>Simulado de 5 questões (aquecimento)</h2>'+
'<ol><li><strong>Q1:</strong> Crie um Deployment <code>web</code> (nginx:1.27, 3 réplicas) com readinessProbe httpGet na 80 e resources (requests 100m/128Mi, limits 500m/256Mi).</li>'+
'<li><strong>Q2:</strong> Exponha o Deployment como ClusterIP na porta 80→8080 e verifique os endpoints.</li>'+
'<li><strong>Q3:</strong> Crie um ConfigMap <code>cfg</code> (chave <code>LOG_LEVEL=debug</code>) e monte TODAS as chaves como env no Deployment.</li>'+
'<li><strong>Q4:</strong> Adicione um taint <code>dedicated=db:NoSchedule</code> no node X e crie um Pod tolerante a ele.</li>'+
'<li><strong>Q5:</strong> Um Deployment está em CrashLoopBackOff — encontre o erro real (logs --previous) e corrija.</li></ol>'+
'<p>Cronometre: o alvo da prova é ~6–7 min por questão.</p>'+
LAB('Plano de 4 semanas (2h/dia)',
'<ol><li><strong>Semana 1:</strong> refazer este curso com TODOS os labs executados (Módulos 0–5).</li>'+
'<li><strong>Semana 2:</strong> Módulos 6–10 + montar o projeto final (m10l4) no seu cluster.</li>'+
'<li><strong>Semana 3:</strong> simulados cronometrados (killer.sh — o simulado oficial é o mais próximo da prova).</li>'+
'<li><strong>Semana 4:</strong> revisar erros dos simulados + refazer as lições fracas + treinar digitação de YAML via dry-run.</li></ol>')+
TIP('No dia da prova: leia TODA a questão antes de agir (muitas têm 2–3 sub-tarefas), use o namespace indicado (não o default), e salve YAMLs em /home para reuso. Se travar em uma questão, pula e volta.')+
TERMS([['CKAD','Certificação prática para devs de Kubernetes (2h, ambiente real)'],['Dry-run client','Gere YAML sem aplicar: kubectl create ... --dry-run=client -o yaml'],['kubectl explain','Documentação embutida de cada campo'],['killer.sh','Simulado oficial mais próximo da prova'],['Domínios','Apps, troubleshooting, workloads, rede, storage, config']])+
QUIZ('A melhor prática para responder uma questão de criação de recurso:',
['Digitar o YAML do zero','Gerar com --dry-run=client -o yaml e editar','Copiar da memória','Escrever no bloco de notas'],1,
'Isso! O gerador cria a estrutura certa; você só ajusta os campos — tempo é o recurso mais escasso.')+
QUIZ('O CKAD valida…',
['Conhecimento teórico','Habilidade prática de operar Kubernetes via kubectl em tempo real','Decoreba de versões','Só teoria de rede'],1,
'Exato! Prova prática, ambiente real, contra o relógio.')}
]};
