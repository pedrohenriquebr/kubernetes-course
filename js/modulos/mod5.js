/* Módulo 05 — Kubernetes para Devs .NET */
const MOD5 = {id:'m5',num:'05',title:'Resiliência, Recursos & Scheduling',level:'int',lessons:[
{id:'m5l1',title:'Probes: liveness, readiness, startup',mins:15,body:
'<p>O Kubernetes pergunta ao seu app "você está bem?" de três formas. Sem probes, o cluster opera <em>cego</em>: não sabe reiniciar app travado nem tirar app não-pronto do tráfego.</p>'+
TIP('Visualize as probes como um <strong>fantasma cutucando o container com um pau</strong> a cada periodSeconds: "ei, tá vivo?" — se não responde N vezes, o kubelet age. E a readiness é o "pai gentil": "o Timmy (container) ainda não acordou — deixem o Timmy em paz" (sem tráfego até ele ficar pronto).')+
'<table class="tbl"><tr><th>Probe</th><th>Pergunta</th><th>Ação se falhar</th></tr>'+
'<tr><td><code>startupProbe</code></td><td>terminou de iniciar?</td><td>mata o Pod (protege boot lento; os outros probes pausam até ele passar)</td></tr>'+
'<tr><td><code>livenessProbe</code></td><td>travou/deadlock?</td><td><strong>reinicia</strong> o container</td></tr>'+
'<tr><td><code>readinessProbe</code></td><td>pronto p/ tráfego agora?</td><td>tira do Service (sem reiniciar)</td></tr></table>'+
'<p>Mecanismos disponíveis: <code>httpGet</code>, <code>tcpSocket</code>, <code>exec</code> e <code>grpc</code>. Parâmetros: <code>initialDelaySeconds</code>, <code>periodSeconds</code>, <code>timeoutSeconds</code>, <code>failureThreshold</code>, <code>successThreshold</code>.</p>'+
C('yaml',`    ports:
    - containerPort: 8080
    startupProbe:
      httpGet: { path: /healthz/startup, port: 8080 }
      failureThreshold: 30
      periodSeconds: 2
    livenessProbe:
      httpGet: { path: /healthz/live, port: 8080 }
      periodSeconds: 10
      timeoutSeconds: 3
    readinessProbe:
      httpGet: { path: /healthz/ready, port: 8080 }
      periodSeconds: 5`)+
'<h2>Os números que importam (e os erros clássicos)</h2>'+
'<ul><li><strong><code>periodSeconds</code> × <code>failureThreshold</code>:</strong> o container é reiniciado/retirado após <code>period × threshold</code> de falhas contínuas. Ex.: 10s × 3 = 30s até a ação.</li>'+
'<li><strong><code>timeoutSeconds</code>:</strong> quanto a probe espera a resposta. Timeout curto demais (1s) em app que demora para responder = falso negativo.</li>'+
'<li><strong>O erro clássico da liveness:</strong> liveness que checa dependência externa (banco, fila) → quando o banco oscila, TODAS as réplicas são reiniciadas ao mesmo tempo → cascata pior que o problema original.</li>'+
'<li><strong>O erro do endpoint único:</strong> liveness e readiness apontando para o MESMO endpoint → um app ocupado demais "morre" em vez de só sair do tráfego.</li></ul>'+
'<h2>startupProbe: o salva-vidas do boot lento</h2>'+
'<p>Se o seu app demora 40s para subir (EF Core warming, cache), o liveness padrão (10s × 3) vai reiniciá-lo em loop antes de ele ficar pronto. A <code>startupProbe</code> resolve: enquanto ela não passa, <strong>as outras probes ficam suspensas</strong>. Use <code>failureThreshold</code> alto (ex.: 30 × 2s = 60s de janela de boot).</p>'+
LAB('Probes que mentem (e como perceber)',
'<ol><li>Crie um Deployment com <code>livenessProbe httpGet /healthz/live</code> apontando para uma porta SEM servidor (ex.: 9999).</li>'+
'<li>Observe: <code>kubectl get pods -w</code> — o Pod fica em <code>CrashLoopBackOff</code>, reiniciando em loop.</li>'+
'<li>Veja os eventos: <code>kubectl describe pod</code> — <em>Liveness probe failed</em>.</li>'+
'<li>Corrija o endpoint e observe o Pod estabilizar em <code>Running</code> + <code>1/1 Ready</code>.</li>'+
'<li>Variação: use <code>tcpSocket</code> numa porta fechada e veja o mesmo efeito.</li></ol>')+
NOTE('ASP.NET Core: <code>builder.Services.AddHealthChecks()</code> + <code>app.MapHealthChecks("/healthz/live")</code> etc., com <code>HealthCheckRegistration</code> e predicados para separar live/ready. Regra de ouro: liveness NÃO checa dependências externas (senão você reinicia em cascata quando o banco oscila); readiness CHECA.')+
TERMS([['livenessProbe','"Está vivo?" → reinicia em caso de falha'],['readinessProbe','"Está pronto?" → tira/coloca no Service'],['startupProbe','"Terminou de iniciar?" → suspende as outras até passar'],['failureThreshold','Nº de falhas consecutivas até agir (period × threshold = tempo total)'],['httpGet/tcpSocket/exec/grpc','Mecanismos de checagem']])+
QUIZ('Sua liveness checa o banco. O banco oscila por 1 minuto. O que acontece?',
['Nada — o banco se recupera sozinho','TODAS as réplicas são reiniciadas (cascata) — a liveness não deve checar dependências','Só uma réplica é reiniciada','O Service bloqueia o banco'],1,
'Exato! Liveness com dependência externa = reinício em cascata. Liveness checa o processo; readiness checa as dependências.')+
QUIZ('App demora 50s para iniciar e reinicia em loop com CrashLoopBackOff. Solução?',
['Aumentar o timeoutSeconds da liveness','Adicionar startupProbe com failureThreshold alto','Mudar para tcpSocket','Remover a readiness'],1,
'Isso! A startupProbe suspende liveness/readiness até o boot terminar.')},
{id:'m5l2',title:'Requests, limits e QoS',mins:15,body:
'<p>Todo container de produção deve declarar <strong>requests</strong> (reserva — usada pelo scheduler para escolher o node) e <strong>limits</strong> (teto — acima disso, CPU é estrangulada; memória é <em>OOMKilled</em>).</p>'+
C('yaml',`    resources:
      requests:            # "preciso de pelo menos"
        cpu: 250m          # 0.25 vCPU
        memory: 256Mi
      limits:              # "no máximo"
        cpu: "1"
        memory: 512Mi`)+
'<h2>O que cada número faz de verdade (cgroups)</h2>'+
'<ul><li><strong>requests.cpu</strong> → peso no scheduler (soma dos requests ≤ capacidade do node) e fatiamento de CPU (CFS shares).</li>'+
'<li><strong>limits.cpu</strong> → <code>cpu.max</code> do cgroup: acima disso o kernel <strong>estrangula (throttle)</strong> — o processo fica lento, não morre. Sintoma: latência alta sem carga aparente.</li>'+
'<li><strong>requests.memory</strong> → reserva para o scheduler (não "pré-aloca").</li>'+
'<li><strong>limits.memory</strong> → <code>memory.max</code>: estourou → <strong>OOM kill</strong>. Não existe throttle de memória.</li></ul>'+
'<h2>QoS: a ordem de sacrifício</h2>'+
'<table class="tbl"><tr><th>Classe</th><th>Condição</th><th>Sob pressão no node</th></tr>'+
'<tr><td>Guaranteed</td><td>requests == limits em TODOS os containers (cpu e memória)</td><td>último a ser sacrificado</td></tr>'+
'<tr><td>Burstable</td><td>algum request &lt; limit</td><td>sacrificável após BestEffort</td></tr>'+
'<tr><td>BestEffort</td><td>sem requests/limits</td><td>primeiro a morrer</td></tr></table>'+
'<p>Guaranteed também vale a dica: quando requests == limits, o cgroup tem <em>guarantees de CPU</em> (não é estrangulado por vizinhos). É a classe ideal para workloads críticos de latência.</p>'+
'<h2>Como descobrir os números certos</h2>'+
'<ol><li><strong>Meça o working set</strong> em carga real (Módulo 7: métricas do runtime — <code>process_working_set_bytes</code> no .NET).</li>'+
'<li><strong>request ≈ pico típico</strong> (a reserva do scheduler), <strong>limit ≈ 1.5–2× o pico</strong> (folga para GC e picos).</li>'+
'<li>Request inflado demais = node "cheio" de reservas vazias = Pods Pending sem necessidade.</li>'+
'<li>Limits apertados demais = OOMKill/estrangulamento disfarçado de lentidão.</li></ol>'+
LAB('Vendo OOM e throttling acontecerem',
'<ol><li>Suba um Pod com <code>memory: limit 128Mi</code> rodando um stress de memória (imagem <code>polinux/stress</code> com <code>--vm 2 --vm-bytes 256M</code>).</li>'+
'<li>Observe: <code>kubectl get pod -w</code> → o Pod morre e reinicia; <code>kubectl describe pod</code> → <em>OOMKilled</em> no Last State.</li>'+
'<li>Aumente o limit para 512Mi e repita — o Pod sobrevive.</li>'+
'<li>Para CPU: limit <code>500m</code> com stress de CPU — o Pod NÃO morre, só fica lento (throttling). Compare a latência antes/depois.</li></ol>')+
TIP('Nunca declare <code>limits.cpu</code> apertado em apps de latência crítica sem medir: throttling é invisível no dashboard de CPU (aparece só em contadores de throttle). No .NET, monitore com o contador <code>cpu_quota</code>/throttled time do runtime (OpenTelemetry).')+
'<h2>O disco local também é recurso: ephemeral-storage</h2>'+
'<p>O disco do node (onde vivem os <code>emptyDir</code> e o cache de imagens) é contabilizado como <code>ephemeral-storage</code> — declare requests/limits para ele e use <code>emptyDir.sizeLimit</code> para o container não encher o node:</p>'+
C('yaml',`    resources:
      requests:
        cpu: 250m
        memory: 256Mi
        ephemeral-storage: 1Gi       # o disco local do node
      limits:
        cpu: "1"
        memory: 512Mi
        ephemeral-storage: 2Gi`)+
'<p>Estourou o limit de <code>ephemeral-storage</code>? O kubelet evicta o Pod (ou o container é reiniciado com <code>Evicted</code> por pressão de disco — o sinal <code>nodefs</code> da lição de eviction). E para proteção extra contra "fork bomb": <code>spec.securityContext.pidsLimit</code> limita o número de processos do Pod (padrão 100 no kubelet; ajuste por Pod quando necessário).</p>'+
WARN('No .NET, o GC respeita o limit de memória do container (cgroup). Limit apertado demais = OOMKill no pico de GC. Meça o working set com métricas (Módulo 7) e deixe folga (limit ≈ 1.5–2× o uso medido). Se o Pod aparece como <code>OOMKilled</code> em <code>kubectl describe</code>, essa é a causa.')+
TERMS([['requests','Reserva declarada — o scheduler usa para escolher o node'],['limits','Teto — CPU throttla; memória mata (OOM)'],['QoS','Guaranteed / Burstable / BestEffort — ordem de sacrifício'],['Throttling','CPU limitada: o processo fica lento, não morre'],['OOMKilled','Kernel matou o processo por estourar memory.max'],['Working set','Uso real de memória — base para requests/limits']])+
QUIZ('Um Pod com limit de memória estourado…',
['Fica lento (throttle)','É morto pelo kernel (OOMKilled)','É movido para outro node','Salva o estado no disco'],1,
'Isso! Memória não tem throttle: estourou o limite, o kernel mata. CPU estourada = lentidão.')+
QUIZ('Qual classe de QoS você quer para uma API de pagamento?',
['BestEffort','Burstable','Guaranteed (requests == limits)','Não importa'],2,
'Exato! Guaranteed = último a ser sacrificado e sem throttling por vizinhos.')},
{id:'m5l3',title:'Autoscaling: HPA, VPA, KEDA e Cluster Autoscaler',mins:17,body:
'<p><strong>HPA</strong> ajusta réplicas por métrica (requer <code>metrics-server</code> instalado); <strong>VPA</strong> ajusta requests/limits; <strong>Cluster Autoscaler/Karpenter</strong> ajusta o número de <em>nodes</em>.</p>'+
'<h2>HPA: como ele calcula (o algoritmo)</h2>'+
'<p>O HPA observa a métrica a cada ~15s e calcula: <code>desiredReplicas = ceil(currentReplicas × currentMetric / targetMetric)</code>. Ex.: 4 réplicas a 80% de CPU com target 70% → <code>ceil(4 × 80/70) = ceil(4.57) = 5</code> réplicas. O alvo "70% de utilização" é <strong>utilização sobre o request</strong>, não sobre o limit.</p>'+
C('yaml',`apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: minha-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: minha-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target: { type: Utilization, averageUtilization: 70 }
  behavior:                     # anti-flapping
    scaleDown:
      stabilizationWindowSeconds: 300   # espera 5 min antes de reduzir
      policies:
      - { type: Pods, value: 1, periodSeconds: 60 }`)+
'<p>Dois conceitos que evitam sustos:</p>'+
'<ul><li><strong>Stabilization window:</strong> o HPA não reage a picos isolados — espera a janela antes de mudar (scaleUp 0s/scaleDown 300s por padrão). Sem isso, o sistema "serra" (flapping).</li>'+
'<li><strong>Métricas custom/external:</strong> via adapters (Prometheus Adapter, Azure Monitor Adapter, AWS CloudWatch…) o HPA escala por RPS, latência, fila — <code>type: Pods</code> (média por Pod) ou <code>type: Object</code>/<code>External</code>.</li></ul>'+
'<h2>VPA: ajuste automático de requests</h2>'+
'<p>O <strong>VPA</strong> observa o uso real e recomenda (ou aplica) requests/limits: modos <code>Off</code> (só recomenda), <code>Initial</code> (aplica no start), <code>Auto</code>/<code>Recreate</code> (recria Pods com os novos valores). Uso típico: <em>recomendação</em> para calibrar, não automação total — VPA + HPA juntos na MESMA métrica não combinam.</p>'+
'<h2>KEDA: escala por eventos (o queridinho .NET)</h2>'+
C('yaml',`apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: worker-sqs }
spec:
  scaleTargetRef: { name: meu-worker }
  minReplicaCount: 0
  maxReplicaCount: 20
  triggers:
  - type: aws-sqs-queue
    metadata:
      queueURL: https://sqs.us-east-1.amazonaws.com/123/pedidos
      queueLength: "5"`)+
'<p>O KEDA escala seu Deployment por <strong>qualquer fonte</strong> (Service Bus, SQS, RabbitMQ, Kafka, Prometheus, Postgres…): a fila cresce → mais réplicas; esvazia → <strong>escala a ZERO</strong> (o truque que economiza dinheiro em workers). Para batch existe o <code>ScaledJob</code> (cria Jobs sob demanda).</p>'+
'<h2>Nodes: Cluster Autoscaler vs Karpenter</h2>'+
'<ul><li><strong>Cluster Autoscaler:</strong> adiciona/remove nodes conforme Pods Pending ou ociosos (fila de nodes). Mais lento (minutos) e menos flexível.</li>'+
'<li><strong>Karpenter</strong> (AWS): provisiona o node <em>sob medida</em> para os Pods (instância certa, spot, em segundos).</li></ul>'+
'<p>A ordem certa do autoscaling de ponta a ponta: <strong>HPA/KEDA (Pods) → Cluster Autoscaler/Karpenter (nodes)</strong>. Se você escala Pods sem escalar nodes, os Pods novos ficam Pending em cluster cheio.</p>'+
LAB('HPA funcionando no seu cluster',
'<ol><li>Instale o metrics-server (no kind): <code>kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml</code> — pode precisar do flag <code>--kubelet-insecure-tls</code> no kind.</li>'+
'<li>Confira: <code>kubectl top nodes</code> e <code>kubectl top pods</code>.</li>'+
'<li>Aplique o HPA acima (target 70%) num Deployment com <code>requests.cpu: 250m</code>.</li>'+
'<li>Gere carga: <code>kubectl run load --rm -it --image=busybox -- sh -c "while true; do wget -qO- http://minha-api >/dev/null; done"</code> (ajuste para o seu app).</li>'+
'<li>Observe: <code>kubectl get hpa -w</code> — as réplicas sobem; <code>kubectl describe hpa</code> mostra os cálculos.</li>'+
'<li>Pare a carga e veja o scale down (esperando a stabilization window).</li></ol>')+
CLOUD('KEDA é projeto CNCF criado pela Microsoft e vem como add-on nativo no AKS; no GKE/EKS você instala via Helm. Cluster Autoscaler existe nos três; na AWS o <em>Karpenter</em> (que provisiona nodes sob demanda em segundos) é muito comum no EKS.')+
TERMS([['HPA','Escala réplicas por métrica (ceil(réplicas × atual/alvo))'],['Utilização','% sobre o REQUEST, não o limit'],['Stabilization window','Janela anti-flapping antes de mudar réplicas'],['VPA','Ajusta requests/limits (Off/Initial/Auto/Recreate)'],['KEDA','Escala por eventos externos (fila, Kafka, Prometheus) — até zero'],['ScaledJob','KEDA criando Jobs sob demanda (batch)'],['Cluster Autoscaler/Karpenter','Escala NODES (Karpenter: nodes sob medida em segundos)']])+
QUIZ('HPA: 6 réplicas a 90% de CPU, target 60%. Quantas réplicas o algoritmo pede?',
['6','ceil(6 × 90/60) = 9','12','3'],1,
'Isso! desiredReplicas = ceil(current × currentMetric/targetMetric) = ceil(9) = 9.')+
QUIZ('Para um worker de fila que pode ficar ocioso à noite, o que economiza mais?',
['HPA por CPU','KEDA com minReplicaCount: 0 (escala a zero)','Cluster Autoscaler','VPA em Auto'],1,
'Exato! KEDA escala por fila e zera o worker sem trabalho — CPU por réplica ociosa ainda custa.')},
{id:'m5l4',title:'Scheduling: affinity, taints e PDB',mins:16,body:
'<p>Quando "qualquer node serve" deixa de ser verdade:</p>'+
'<ul><li><strong>nodeSelector / nodeAffinity:</strong> "rode só em nodes com SSD" ou "prefira a zona X".</li>'+
'<li><strong>podAntiAffinity:</strong> "espalhe minhas réplicas em nodes/zonas diferentes" (alta disponibilidade).</li>'+
'<li><strong>taints + tolerations:</strong> nodes dedicados (GPU, batch) que repelem Pods não autorizados.</li>'+
'<li><strong>topologySpreadConstraints:</strong> distribuição uniforme entre zonas de disponibilidade.</li>'+
'<li><strong>PodDisruptionBudget (PDB):</strong> "durante manutenção voluntária (drain/upgrade), nunca deixe menos de N réplicas".</li></ul>'+
'<h2>nodeSelector vs nodeAffinity</h2>'+
'<p><code>nodeSelector</code> é a forma simples (igualdade exata de label). <code>nodeAffinity</code> é a forma expressiva: <code>requiredDuringScheduling</code> (obrigatório) ou <code>preferredDuringScheduling</code> (peso — "tente, mas não é obrigatório").</p>'+
C('yaml',`spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - { key: disktype, operator: In, values: [ssd] }
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
          - { key: topology.kubernetes.io/zone, operator: In, values: [us-east-1a] }`)+
'<h2>podAntiAffinity: espalhar réplicas</h2>'+
'<p>Para alta disponibilidade, você quer réplicas em nodes (ou zonas) diferentes. Sem isso, 3 réplicas podem cair no MESMO node — e o node morrer derruba o serviço inteiro.</p>'+
C('yaml',`    affinity:
      podAntiAffinity:
        preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            labelSelector:
              matchLabels: { app: minha-api }
            topologyKey: kubernetes.io/hostname`)+
'<p>O <code>topologyKey</code> define a "unidade" do espalhamento: <code>kubernetes.io/hostname</code> (nodes) ou <code>topology.kubernetes.io/zone</code> (zonas). O <code>preferred</code> é tolerante (se não dá para espalhar, agenda mesmo assim); o <code>required</code> é rígido (Pods ficam Pending).</p>'+
'<h2>Taints + tolerations: quem PODE entrar</h2>'+
'<p>O taint é uma "marca repelente" no node; o Pod precisa da toleration correspondente para ser agendado ali. Efeitos: <code>NoSchedule</code> (não agenda novos), <code>PreferNoSchedule</code> (tenta evitar), <code>NoExecute</code> (repele inclusive Pods já rodando).</p>'+
C('bash',`kubectl taint nodes kind-worker gpu=true:NoSchedule
kubectl get nodes kind-worker -o jsonpath='{.spec.taints}'`)+
C('yaml',`spec:
  tolerations:
  - key: gpu
    operator: Equal
    value: "true"
    effect: NoSchedule`)+
'<p>Os masters têm taints por padrão (é por isso que Pods comuns não caem neles) e o <code>NoExecute</code> com <code>tolerationSeconds</code> dá ao Pod um prazo para sair.</p>'+
'<h2>Pod Scheduling Readiness: o "segure o scheduler" (schedulingGates)</h2>'+
'<p>Com <code>spec.schedulingGates</code>, um Pod é criado mas <strong>não entra na fila do scheduler</strong> até que os gates sejam removidos (status <code>SchedulingGated</code>). É usado por operadores que precisam preparar algo antes do agendamento (ex.: provisionar recurso externo, validar quota):</p>'+
C('yaml',`spec:
  schedulingGates:            # definido na criação; só pode ser REMOVIDO
  - name: exemplo.com/aguardando-recurso
  containers:
  - name: api
    image: meuregistry/minha-api:1.0.0`)+
'<p>Gates só podem ser removidos (nunca adicionados após a criação) e o scheduler ignora o Pod enquanto houver gates — evita "empurrar" o Cluster Autoscaler à toa. Raro no dia a dia do dev, mas aparece em operadores e políticas avançadas.</p>'+
'<h2>PodDisruptionBudget: o seguro do drain</h2>'+
C('yaml',`apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: minha-api-pdb }
spec:
  minAvailable: 2        # OU maxUnavailable: 1 — nunca fique abaixo
  selector:
    matchLabels: { app: minha-api }`)+
'<p>O PDB protege contra <strong>evictions voluntárias</strong> (drain, upgrade de node, cluster autoscaler) — não contra node que cai. Um <code>kubectl drain</code> respeita o PDB: se drenar quebrasse o mínimo, o drain <strong>trava</strong> (a não ser com <code>--disable-eviction</code>).</p>'+
LAB('Taint, toleration e PDB na prática',
'<ol><li>Adicione um taint num worker: <code>kubectl taint nodes kind-worker dedicado=true:NoSchedule</code>.</li>'+
'<li>Aplique um Deployment SEM toleration: os Pods ficam Pending (veja os eventos do scheduler no <code>kubectl describe pod</code>).</li>'+
'<li>Adicione a toleration → os Pods agendam no node com taint.</li>'+
'<li>Remova o taint: <code>kubectl taint nodes kind-worker dedicado=true:NoSchedule-</code>.</li>'+
'<li>Crie o PDB e rode <code>kubectl drain kind-worker --ignore-daemonsets</code> com o PDB ativo: o drain respeita o mínimo de réplicas (ou trava).</li></ol>')+
QUIZ('Sua API deve sobreviver a picos e manutenções: qual combinação faz sentido?',
['limits altíssimos + BestEffort','probes + requests/limits + HPA + PDB','NodePort + replicas: 1','nenhum recurso, o cloud resolve'],1,
'Perfeito! Resiliência é camadas: detecção (probes), reserva (requests/limits), escala (HPA) e proteção contra manutenção (PDB).')+
QUIZ('Um Pod sem requests/limits recebe qual classe de QoS?',
['Guaranteed','Burstable','BestEffort','Premium'],2,
'Isso! Sem declarar nada = BestEffort = primeiro a ser sacrificado sob pressão.')+
QUIZ('O drain TRAVOU no seu node. Qual é a causa mais provável?',
['Falta de memória','O PDB não permite cair abaixo do mínimo de réplicas','O kubelet caiu','O node está com taint'],1,
'Isso! O drain respeita PDBs: se a evacuação violasse o mínimo, ele espera (ou você força com --disable-eviction).')+
TERMS([['nodeAffinity','required/preferred — onde o Pod PODE/PREFERE rodar'],['podAntiAffinity','Espalhar réplicas por node/zona'],['Taint','Marca repelente no node (NoSchedule/NoExecute)'],['Toleration','Permissão do Pod para agendar em node com taint'],['topologyKey','A unidade do espalhamento (hostname, zone)'],['PDB','Mínimo de réplicas durante evictions voluntárias']])},
{id:'m5l5',title:'Eviction, preemption e PriorityClass',mins:14,body:
'<p>Entender <em>como e por que</em> Pods morrem sem você pedir é conhecimento avançado obrigatório:</p>'+
'<ul><li><strong>Node-pressure eviction:</strong> quando um node fica sem memória/disco (sinais como <code>memory.available</code>), o <em>kubelet</em> evacua Pods — ordem: BestEffort → Burstable → Guaranteed (QoS de novo!). O Pod ganha status <code>Evicted</code>.</li>'+
'<li><strong>API-initiated eviction:</strong> o que <code>kubectl drain</code> usa; respeita PDBs e grace periods.</li>'+
'<li><strong>Preemption:</strong> um Pod de <strong>alta prioridade</strong> sem lugar pode <em>desalojar</em> Pods de menor prioridade para abrir espaço.</li></ul>'+
'<h2>Os sinais de pressão do kubelet</h2>'+
'<table class="tbl"><tr><th>Sinal</th><th>Limite soft (padrão)</th><th>Limite hard (padrão)</th></tr>'+
'<tr><td><code>memory.available</code></td><td>1.5 GiB livre</td><td>100 MiB</td></tr>'+
'<tr><td><code>nodefs.available</code> (disco do node)</td><td>10%</td><td>5%</td></tr>'+
'<tr><td><code>imagefs.available</code> (disco de imagens)</td><td>15%</td><td>10%</td></tr></table>'+
'<p>No soft, o kubelet avisa (pod eviction grace) e começa a evacuar com calma; no hard, a evacuação é imediata. A ordem de sacrifício: QoS (BestEffort primeiro), depois uso real (o que mais consome do sinal).</p>'+
'<h2>API-initiated eviction e o PDB</h2>'+
'<p><code>kubectl drain</code>, o Cluster Autoscaler e os upgrades usam o endpoint de eviction da API — e esse caminho <strong>respeita PDBs e grace periods</strong>. Diferente da pressão de node, aqui o Pod sai "educadamente".</p>'+
'<h2>PriorityClass e preemption</h2>'+
C('yaml',`apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: { name: alta-criticidade }
value: 100000
globalDefault: false
description: "Workloads de pagamento — não devem ser preemptados"`)+
'<p>Valores altos = mais prioridade (o <code>system-cluster-critical</code> vale 2 bilhões). Quando um Pod de alta prioridade não cabe em nenhum node, o scheduler <strong>preempta</strong> (desaloja) Pods de menor prioridade — marcando os desalojados como <code>Preempting</code>. Use com moderação: preemption é agressivo e pode derrubar workloads "comuns".</p>'+
'<p><strong>Node graceful shutdown</strong> (1.21+): quando um node é desligado "educadamente" (cloud: shutdown de VM por manutenção/spot), o kubelet detecta o sinal e <em>drena os Pods respeitando PDB e grace period</em> — em vez de morte súbita. Ou seja: nem todo node que "cai" é bruto; em clouds, boa parte dos desligamentos é graceful — e o seu app nem percebe (é o drain da lição de upgrades, automático).</p>'+
DEEP('A diferença que importa para o dev: <strong>eviction por pressão de node NÃO respeita PDB</strong> — é o kubelet decidindo sozinho para salvar o node. Já a eviction via API (drain/upgrade/autoscaler) respeita. Ou seja: PDB protege de manutenção, não de node doente.')+
NOTE('Consequências para seu código .NET: trate todo shutdown como "pode acontecer agora". Workers de fila: ack só após processar e com handlers idempotentes; APIs: graceful shutdown no SIGTERM (já vem no Generic Host); Jobs: <code>restartPolicy: OnFailure</code> e retries idempotentes. Nada de assumir que o Pod vai viver.')+
QUIZ('O node está com memória quase esgotada. Qual Pod o kubelet evacua primeiro?',
['Guaranteed de produção','Burstable com requests baixos','BestEffort sem requests/limits','O mais novo'],2,
'Correto! BestEffort é a classe mais frágil e a primeira a ser evacuada sob pressão no node.')+
QUIZ('O PDB protege contra…',
['Node cair de repente','Evictions VOLUNTÁRIAS (drain, upgrade, autoscaler)','OOM kill','kubectl delete manual'],1,
'Isso! PDB é para manutenção programada. Node caiu ou OOM são involuntários — aí quem protege é o QoS + replicas + antiaffinity.')+
TERMS([['Node-pressure eviction','kubelet evacua Pods quando o node está sem memória/disco'],['Sinais','memory.available, nodefs.available, imagefs.available'],['API-initiated eviction','Eviction via API (drain/upgrade) — respeita PDB'],['Preemption','Pod de alta prioridade desaloja os de menor'],['PriorityClass','Valor de prioridade (alto = protegido de preempt)']])},
{id:'m5l6',title:'Chaos: testando sua resiliência de verdade',mins:14,body:
'<p>Você configurou probes, PDB, HPA e antiaffinity. Como saber se funciona <strong>antes</strong> do incidente real? Quebrando de propósito — em ambiente controlado. Esta lição é um laboratório completo de <strong>fault injection</strong>.</p>'+
'<h2>O que testar (o mínimo de resiliência)</h2>'+
'<ol><li><strong>Morte de Pod:</strong> o Deployment se auto-repara?</li>'+
'<li><strong>Morte de node:</strong> os Pods são reagendados? O tráfego continua?</li>'+
'<li><strong>OOM:</strong> o app respeita o limit? O restart é limpo?</li>'+
'<li><strong>Lentidão (throttle):</strong> como a latência se comporta sob limit de CPU?</li>'+
'<li><strong>Manutenção (drain):</strong> o PDB segura o mínimo?</li>'+
'<li><strong>Dependência fora:</strong> o banco cai — a liveness NÃO reinicia em cascata; a readiness tira do tráfego?</li></ol>'+
LAB('Caos controlado no seu cluster (passo a passo)',
'<ol><li><strong>Setup:</strong> Deployment com 3 réplicas + readiness (healthcheck) + PDB (<code>minAvailable: 2</code>) + Service.</li>'+
'<li><strong>Teste 1 — morte de Pod:</strong> <code>kubectl delete pod</code> em um Pod e observe <code>kubectl get pods -w</code> — um novo nasce em segundos.</li>'+
'<li><strong>Teste 2 — morte de node (kind):</strong> <code>docker stop kind-worker</code> e observe os Pods marcados <code>Unknown</code>/<code>Terminating</code> e reagendados no outro worker (tempo de tolerância do node ≈ 40s+). Depois <code>docker start kind-worker</code>.</li>'+
'<li><strong>Teste 3 — OOM:</strong> rode o stress de memória do lab da lição de resources e confira o restart limpo.</li>'+
'<li><strong>Teste 4 — drain:</strong> <code>kubectl drain kind-worker-1 --ignore-daemonsets --delete-emptydir-data</code> — o PDB segura; veja os Pods migrando para o outro worker. Termine com <code>kubectl uncordon</code>.</li>'+
'<li><strong>Teste 5 — banco fora:</strong> derrube o Service do banco (ou uma NetworkPolicy) e observe: Pods ficam <em>não-ready</em> (readiness), mas NÃO reiniciam em loop (liveness ok).</li></ol>')+
'<h2>Ferramentas para ir além</h2>'+
'<ul><li><strong>Chaos Mesh</strong> (CNCF): falhas de rede (latência, perda de pacote), kill de Pod, falha de disco — declarado em CRDs.</li>'+
'<li><strong>Litmus</strong> (CNCF): experiments prontos (pod-kill, node-drain, chaos de rede) com verificação de "steady state".</li>'+
'<li><strong>kubectl tip:</strong> <code>kubectl rollout restart deploy</code> é o "caos educado" do dia a dia.</li></ul>'+
'<h2>O ciclo do caos responsável</h2>'+
'<ol><li>Defina a <strong>hipótese</strong>: "3 réplicas + PDB + readiness aguentam drain sem downtime".</li>'+
'<li><strong>Medida do steady state:</strong> taxa de erro e latência antes.</li>'+
'<li><strong>Injete a falha</strong> e meça depois.</li>'+
'<li><strong>Compare</strong> com a hipótese; se quebrou, é bug seu — corrige no código/YAML, não no processo.</li></ol>'+
NOTE('No .NET, o teste de resiliência mais valioso é o "banco fora": com <code>AddHealthChecks</code> separando live/ready, o cluster tira a réplica do Service (ready=false) sem reiniciar. E com Polly no cliente, o app que chama a API degradada não estoura exceções — retry com backoff e fallback.')+
TERMS([['Fault injection','Quebrar de propósito para validar resiliência'],['Steady state','Métricas "normais" antes do caos (baseline)'],['Chaos Mesh / Litmus','Ferramentas CNCF de experiments de caos'],['Pod eviction','Morte "voluntária" (drain) vs involuntária (node cai)'],['Hipótese de resiliência','O que você ACHA que aguenta — testado de verdade']])+
QUIZ('O objetivo do caos engineering é…',
['Quebrar o cluster de propósito em produção','Validar hipóteses de resiliência em ambiente controlado','Punir quem erra deploy','Testar o RBAC'],1,
'Isso! Caos é método: hipótese → baseline → falha → comparação. É como o teste de fogo da sua resiliência.')+
QUIZ('Banco caiu e TODAS as réplicas da sua API reiniciaram em cascata. O que está errado?',
['O banco — ele não deveria cair','A livenessProbe está checando o banco (não deveria)','O HPA','O PDB'],1,
'Exato! Liveness com dependência externa = reinício em cascata. O erro clássico que o caos revela em 5 minutos.')}
]};
