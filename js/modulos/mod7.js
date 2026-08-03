/* Módulo 07 — Kubernetes para Devs .NET */
const MOD7 = {id:'m7',num:'07',title:'Observabilidade & Debugging',level:'adv',lessons:[
{id:'m7l1',title:'Logs: do stdout ao cluster',mins:12,body:
'<p>Regra nº1: seu app escreve logs no <strong>stdout/stderr</strong> (o ASP.NET Core já faz isso com o console logger). O kubelet captura e o <code>kubectl logs</code> exibe. Em produção, um agente (Fluent Bit/Vector como DaemonSet) coleta e envia para um backend.</p>'+
C('bash',`kubectl logs deploy/minha-api -f --tail=200
kubectl logs NOME_POD --previous        # logs do container ANTES do crash (ouro p/ debug)
kubectl logs -l app=minha-api           # todos os Pods do selector
kubectl logs POD -c sidecar             # container específico do Pod
kubectl logs POD --timestamps           # quando cada linha foi emitida`)+
'<h2>Logs estruturados: o formato que o cluster (e o backend) esperam</h2>'+
'<p>Log de texto puro é ilegível para máquinas; <strong>JSON estruturado</strong> vira campos pesquisáveis no backend. No .NET, troque o formatter do console:</p>'+
C('csharp',`// Program.cs — logs em JSON
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole(o => {
    o.JsonWriterOptions = new System.Text.Json.JsonWriterOptions { Indented = false };
    o.TimestampFormat = "yyyy-MM-ddTHH:mm:ss.fffZ";
});
// A partir daqui, cada log é um objeto JSON:
// {"Timestamp":"...","LogLevel":"Information","EventId":14,
//  "EventName":"PedidoCriado","Message":"Pedido 42 criado","PedidoId":42}`)+
'<p>Regras de ouro dos logs em Kubernetes:</p>'+
'<ul><li><strong>Nunca concatene</strong>: <code>LogInformation("Pedido {PedidoId} criado", id)</code> — os placeholders viram campos estruturados.</li>'+
'<li><strong>stdout é o contrato</strong>: não grave em arquivo dentro do container (o arquivo morre com o Pod e o agente não coleta).</li>'+
'<li><strong>Não logue segredos</strong> (o log vai para o backend de todos) e respeite níveis (Debug em dev, Information em prod).</li>'+
'<li><strong>Multi-container:</strong> <code>kubectl logs -c</code> seleciona; o padrão sidecar de logs consolida.</li></ul>'+
'<h2>Eventos do Kubernetes ≠ logs do app</h2>'+
'<p><code>kubectl get events</code> mostra o que o <em>cluster</em> fez (Killing, Pulling, Scheduled); <code>kubectl logs</code> mostra o que o <em>app</em> fez. Diagnóstico completo usa os dois.</p>'+
TIP('Dois prazos que explicam muita coisa: os <strong>eventos do cluster expiram em ~1 hora</strong> (janela de diagnóstico — colete o que importa na hora) e os <strong>logs de um Pod deletado somem em ~45 segundos</strong> (o kubelet limpa /var/log/pods). É por isso que logs de produção vão para fora do cluster, não ficam no node.')+
LAB('Logs na prática',
'<ol><li>Rode um Pod com logs estruturados JSON (o código acima) e veja: <code>kubectl logs deploy/minha-api</code> — cada linha é JSON.</li>'+
'<li>Mande 5 requests e grep por <code>PedidoId</code>: <code>kubectl logs deploy/minha-api | grep PedidoId</code>.</li>'+
'<li>Quebre o app (mude um env para inválido) e veja o crash: <code>kubectl logs POD --previous</code> mostra o erro que causou o restart.</li>'+
'<li>Confira os eventos: <code>kubectl get events --sort-by=.lastTimestamp | tail</code>.</li></ol>')+
CLOUD('<strong>AKS:</strong> Container Insights (Log Analytics). <strong>GKE:</strong> Cloud Logging nativo. <strong>EKS:</strong> CloudWatch via Fluent Bit. Nos três, logs estruturados (JSON) do .NET chegam pesquisáveis por campo.')+
NOTE('Use logs estruturados: <code>logger.LogInformation("Pedido {PedidoId} criado", id)</code> — os placeholders viram campos pesquisáveis no backend (não concatene strings).')+
TERMS([['stdout/stderr','Onde o app escreve — o contrato com o cluster'],['kubectl logs','Leitura dos logs (--previous para o crash anterior)'],['Log estruturado','JSON com campos — pesquisável no backend'],['Evento do cluster','Killing/Scheduled/Pulled — o que o K8s fez'],['Fluent Bit/Vector','Agentes (DaemonSet) que coletam e enviam']])+
QUIZ('O app escreve logs em /var/log/app.log dentro do container. Qual o problema?',
['Nenhum','O arquivo morre com o Pod e o agente de logs não coleta — use stdout','O disco enche mais rápido','O kubelet apaga'],1,
'Isso! Arquivo em container = efêmero e invisível. stdout é o contrato.')+
QUIZ('Para ver o erro que causou o último crash, use…',
['kubectl logs POD','kubectl logs POD --previous','kubectl get events','kubectl describe node'],1,
'Exato! --previous mostra os logs do container ANTES do restart.')},
{id:'m7l2',title:'Métricas: Prometheus + Grafana',mins:15,body:
'<p>O Prometheus "raspa" (scrape) endpoints HTTP de métricas e guarda séries temporais; o Grafana visualiza; o Alertmanager alerta. Métricas que todo dev deve conhecer: CPU, memória, latência HTTP, taxa de erro, saturação de fila.</p>'+
'<h2>Como o Prometheus descobre o que raspar</h2>'+
'<p>O Prometheus usa <strong>service discovery</strong> do Kubernetes: Pods e Services com as annotations <code>prometheus.io/scrape</code> entram automaticamente no scraping (padrão do kube-prometheus-stack).</p>'+
C('yaml',`# o Prometheus descobre seu Pod via annotations:
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "9464"`)+
'<h2>Tipos de métrica (o básico que destrava o PromQL)</h2>'+
'<table class="tbl"><tr><th>Tipo</th><th>O que é</th><th>Uso</th></tr>'+
'<tr><td><code>counter</code></td><td>só aumenta (requests, erros)</td><td><code>rate()</code>/<code>increase()</code> — nunca leia o valor cru</td></tr>'+
'<tr><td><code>gauge</code></td><td>sobe e desce (CPU, memória, fila atual)</td><td>valor instantâneo</td></tr>'+
'<tr><td><code>histogram</code></td><td>contadores por bucket de valor (latências)</td><td><code>histogram_quantile()</code> para percentis</td></tr>'+
'<tr><td><code>summary</code></td><td>percentis calculados no app</td><td>quando não dá para agregar por bucket</td></tr></table>'+
'<h2>PromQL que salva vidas</h2>'+
C('bash',`# p95 de latência por serviço
histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket[5m])) by (le, job))

# taxa de erro 5xx
sum(rate(http_server_request_duration_seconds_count{http_response_status_code=~"5.."}[5m]))
  /
sum(rate(http_server_request_duration_seconds_count[5m]))

# RPS por serviço
sum(rate(http_server_request_duration_seconds_count[5m])) by (job)

# CPU do node
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memória do Pod em relação ao limit
sum(container_memory_working_set_bytes{container!=""}) by (pod) /
sum(kube_pod_container_resource_limits{resource="memory"}) by (pod)`)+
'<h2>Recording rules e alertas</h2>'+
'<p>Queries caras (agregações sobre muitos Pods) viram <strong>recording rules</strong> — o Prometheus pré-computa e você consulta o resultado. O <strong>Alertmanager</strong> recebe regras de alerta (ex.: <code>p95 &gt; 1s por 10min</code>) e roteia para Slack/e-mail/PagerDuty com agrupamento e silenciamento.</p>'+
LAB('kube-prometheus-stack no seu cluster',
'<ol><li>Instale: <code>helm upgrade --install kube-prom prometheus-community/kube-prometheus-stack --repo https://prometheus-community.github.io/helm-charts -n observability --create-namespace</code>.</li>'+
'<li>Acesse o Grafana: <code>kubectl port-forward svc/kube-prom-grafana -n observability 3000:80</code> → <code>http://localhost:3000</code> (admin/admin — mude!).</li>'+
'<li>Abra o dashboard "Kubernetes / Compute Resources / Pod" e veja suas métricas reais.</li>'+
'<li>No Prometheus (port-forward 9090): rode as queries acima — RPS, p95, memória do Pod.</li>'+
'<li>Exponha o seu app .NET (endpoint /metrics com o OpenTelemetry) e veja os novos targets: Status/Targets no Prometheus.</li></ol>')+
NOTE('O .NET 8+ expõe métricas nativas no formato OpenTelemetry (<code>dotnet add package OpenTelemetry.Exporter.Prometheus.AspNetCore</code>): HTTP, GC, thread pool, exceptions — sem instrumentação manual.')+
TERMS([['Scrape','Prometheus puxa o endpoint /metrics a cada intervalo'],['counter/gauge/histogram','Tipos de métrica (contador, valor, buckets)'],['rate()','Taxa por segundo de um counter (sempre use rate/increase)'],['histogram_quantile','Percentil a partir de buckets de histograma'],['Recording rule','Query pré-computada (performance)'],['Alertmanager','Roteia alertas (Slack, e-mail, PagerDuty)']])+
QUIZ('Para saber o RPS da sua API, use…',
['O valor cru do counter','rate(counter[5m])','A média do counter','O max do counter'],1,
'Isso! Counter só cresce — o valor cru é inútil; rate() dá a taxa por segundo.')+
QUIZ('Como o Prometheus acha seu Pod para raspar?',
['Ele varre a rede','Annotations prometheus.io/scrape + service discovery do K8s','Você configura o IP na mão','kubectl apply --prometheus'],1,
'Exato! Annotations + service discovery nativo — sem configurar IPs.')},
{id:'m7l3',title:'Distributed tracing com OpenTelemetry',mins:14,body:
'<p>Em microsserviços, "a chamada está lenta" vira "QUAL chamada, em QUAL serviço?". O <strong>tracing</strong> conecta spans de uma requisição através de serviços via headers W3C (<code>traceparent</code>) — e o .NET é cidadão de primeira classe no OpenTelemetry:</p>'+
'<h2>Os conceitos em 30 segundos</h2>'+
'<ul><li><strong>Trace</strong>: a requisição inteira (ex.: "GET /pedidos/42").</li>'+
'<li><strong>Span</strong>: um trecho com nome e duração ("HTTP para pedidos-api", "query no banco", "GC").</li>'+
'<li><strong>Contexto</strong>: o header <code>traceparent</code> propaga trace-id/span-id entre serviços — é isso que conecta os spans em uma árvore.</li>'+
'<li><strong>Baggage</strong>: pares chave-valor propagados junto (ex.: tenant, user) — use pouco (vai para tudo).</li></ul>'+
C('csharp',`// Program.cs
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService("minha-api"))
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddOtlpExporter());          // env: OTEL_EXPORTER_OTLP_ENDPOINT

builder.Services.AddOpenTelemetry()
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddRuntimeInstrumentation()   // GC, heap, thread pool
        .AddOtlpExporter());`)+
C('yaml',`    env:
    - name: OTEL_EXPORTER_OTLP_ENDPOINT
      value: http://otel-collector.observability.svc:4317`)+
'<h2>O OpenTelemetry Collector: o hub do tráfego de telemetria</h2>'+
'<p>Em vez de cada Pod mandar direto para o backend (e ficar preso a ele), o padrão é um <strong>Collector</strong> no cluster: os apps enviam OTLP para ele, e ele faz o pipeline <em>receivers → processors → exporters</em>:</p>'+
C('yaml',`# otel-collector.yaml (trecho)
receivers:
  otlp:
    protocols: { grpc: { endpoint: 0.0.0.0:4317 }, http: { endpoint: 0.0.0.0:4318 } }
processors:
  batch: {}                      # agrupa spans (performance)
  tail_sampling:                 # amostragem: 100% de erros, 10% do resto
    policies:
    - { name: erros, type: status_code, status_code: { status_codes: [ERROR] } }
    - { name: amostra, type: probabilistic, probabilistic: { sampling_percentage: 10 } }
exporters:
  otlp:
    endpoint: jaeger.observability.svc:4317     # ou Application Insights / Cloud Trace / X-Ray
service:
  pipelines:
    traces: { receivers: [otlp], processors: [batch, tail_sampling], exporters: [otlp] }`)+
'<h2>Sampling: o controle de custo</h2>'+
'<p>100% dos traces = caro. O padrão: <strong>amostragem head</strong> (no app, ex.: 10%) ou <strong>tail</strong> (no collector — mais preciso: decide por span de erro). O ideal para dev: erros SEMPRE amostrados, o resto em %.</p>'+
LAB('Tracing de verdade com Jaeger no kind',
'<ol><li>Instale o Jaeger: <code>helm upgrade --install jaeger jaegertracing/jaeger --repo https://jaegertracing.github.io/helm-charts -n observability</code>.</li>'+
'<li>Suba 2 serviços .NET (ou o exemplo) com o código acima e <code>OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger-collector.observability.svc:4317</code> — A chama B.</li>'+
'<li>Gere tráfego e abra o Jaeger: <code>kubectl port-forward svc/jaeger-query -n observability 16686:16686</code> → <code>http://localhost:16686</code>.</li>'+
'<li>Procure o serviço "minha-api": veja o trace inteiro — a chamada HTTP A→B como spans pai/filho com durações.</li>'+
'<li>Adicione um span manual: <code>using var span = tracer.StartActiveSpan("processa-pedido");</code> e veja ele na árvore.</li></ol>')+
CLOUD('Backends: AKS → Application Insights (via OTel) ou Jaeger; GKE → Cloud Trace; EKS → AWS X-Ray. Todos aceitam OTLP, o protocolo aberto — troque o backend sem trocar o código.')+
TERMS([['Trace','Requisição inteira (árvore de spans)'],['Span','Trecho com nome/duração (HTTP, banco, GC)'],['traceparent','Header W3C que propaga o contexto entre serviços'],['Collector','Hub OTLP: receivers → processors (batch, sampling) → exporters'],['Sampling','Amostragem de traces (head no app, tail no collector)'],['Baggage','Chave-valor propagado junto (use pouco)']])+
QUIZ('O que conecta os spans de serviços diferentes na mesma árvore?',
['O IP do Pod','O header traceparent (W3C) propagado nas chamadas','O namespace','O kube-proxy'],1,
'Isso! O contexto viaja no header — sem ele, cada serviço vira um trace órfão.')+
QUIZ('100% de traces em produção é…',
['Obrigatório','Caro demais — use sampling (erros sempre, resto em %)','Impossível','O padrão do Prometheus'],1,
'Exato! Sampling controla custo; a regra de ouro é nunca perder o erro.')},
{id:'m7l4',title:'Kit de debugging: do CrashLoop ao OOMKill',mins:16,body:
'<p>O fluxo de debug que resolve 95% dos problemas: <code>kubectl get pods</code> (status) → <code>kubectl describe pod</code> (events!) → <code>kubectl logs --previous</code> (crash) → <code>kubectl exec</code>/<code>debug</code> (dentro do container).</p>'+
'<table class="tbl"><tr><th>Sintoma</th><th>Causas prováveis</th><th>Investigação</th></tr>'+
'<tr><td><code>CrashLoopBackOff</code></td><td>erro no start, probe de liveness mal configurado, variável de ambiente faltando</td><td><code>logs --previous</code>, describe (events)</td></tr>'+
'<tr><td><code>ImagePullBackOff</code></td><td>tag errada, registry privado sem imagePullSecrets, nome errado</td><td>describe → eventos de pull</td></tr>'+
'<tr><td><code>Pending</code></td><td>sem recursos (requests altos), taints sem toleration, PVC não vinculado</td><td>describe pod (eventos do scheduler)</td></tr>'+
'<tr><td><code>OOMKilled</code></td><td>limit de memória baixo para o GC do .NET</td><td>describe (Last State), métricas de memória</td></tr>'+
'<tr><td><code>Evicted</code></td><td>node sem memória/disco (lição de eviction!)</td><td><code>kubectl describe node</code></td></tr>'+
'<tr><td><code>CreateContainerConfigError</code></td><td>ConfigMap/Secret não existe ou chave errada</td><td>describe (events) — o nome do objeto ausente aparece</td></tr>'+
'<tr><td><code>ContainerCreating</code> preso</td><td>volume não montou, pull lento, CNI com problema</td><td>describe + <code>crictl ps -a</code> no node (Módulo 2)</td></tr>'+
'<tr><td><code>Terminating</code> preso (não some)</td><td><strong>Finalizer</strong> órfão: um controller que deveria limpar não existe mais (lição de Finalizers, Módulo 2)</td><td><code>kubectl get &lt;recurso&gt; -o json | jq \'.metadata.finalizers\'</code>; remova com patch (com cuidado)</td></tr></table>'+
'<h2>Ephemeral containers: o "kubectl exec" quando o Pod está quebrado</h2>'+
'<p>Se o container principal morre em loop (ou a imagem não tem shell), o <code>kubectl debug</code> "cola" um container temporário no Pod — compartilhando o namespace de processos (<code>--target</code>) para você investigar:</p>'+
C('bash',`kubectl get events -n prod --sort-by=.lastTimestamp | tail -20   # eventos recentes
kubectl top pods -n prod        # uso real de CPU/memória (requer metrics-server)
kubectl top nodes

# container de debug "acoplado" ao Pod (ephemeral container):
kubectl debug -it deploy/minha-api --image=mcr.microsoft.com/dotnet/sdk:8.0 \\
  --target=api -- dotnet-trace collect -p 1 --format speedscope

# ou um dump de memória p/ analisar no Visual Studio depois:
kubectl debug -it deploy/minha-api --image=mcr.microsoft.com/dotnet/sdk:8.0 \\
  --target=api -- dotnet-dump collect -p 1`)+
TIP('<code>kubectl top pods/nodes</code> exige o <strong>metrics-server</strong> instalado — sem ele, o erro é "metrics API not available". No kind, instale via Helm (Módulo 6); em clusters gerenciados, o provider costuma entregar (mas confira).')+
'<h2>O fluxo do .NET: do sintoma ao dump</h2>'+
'<ol><li><strong>CrashLoopBackOff</strong> → <code>kubectl logs POD --previous</code>: a exceção que matou o processo está aqui.</li>'+
'<li><strong>Lentidão/threads:</strong> <code>kubectl debug ... -- dotnet-trace collect -p 1 --format speedscope</code> → abra o speedscope no navegador (CPU, async, locks).</li>'+
'<li><strong>Memória suspeita:</strong> <code>kubectl debug ... -- dotnet-dump collect -p 1</code> → <code>dotnet-dump analyze</code> (heap, referências) ou abra no Visual Studio (Dump Analysis).</li>'+
'<li><strong>GC:</strong> <code>dotnet-counters monitor --process-id 1 --counters System.Runtime</code> — GC heap size, gen0/1/2, time in GC.</li></ol>'+
LAB('Reproduzindo e diagnosticando um CrashLoop',
'<ol><li>Crie um Deployment com env <code>ConnectionStrings__Default</code> referenciando um Secret que NÃO existe → <code>CreateContainerConfigError</code>. Observe o evento no describe.</li>'+
'<li>Crie o Secret → o Pod sobe. Agora quebre o start: comando <code>["dotnet","MinhaApi.dll"]</code> com DLL errada → <code>CrashLoopBackOff</code>.</li>'+
'<li>Diagnostique: <code>kubectl logs POD --previous</code> mostra o erro real de start.</li>'+
'<li>Simule OOM (lab do Módulo 5) e veja <code>kubectl describe pod</code> → <em>OOMKilled</em> + <code>kubectl top pods</code> para o uso real.</li>'+
'<li>Por fim, cole um ephemeral container: <code>kubectl debug -it POD --image=busybox --target=api -- sh</code> e explore <code>/proc/1</code>.</li></ol>')+
NOTE('<code>--target</code> compartilha o namespace de processos do container principal. Se sua imagem final não tem shell (distroless), o <code>kubectl debug</code> com imagem de SDK é a saída — ou mantenha <code>dotnet-monitor</code> habilitado em ambientes internos.')+
TERMS([['CrashLoopBackOff','Container reinicia em loop — logs --previous mostra o erro'],['ImagePullBackOff','Pull falhou — tag/registry/imagePullSecrets'],['CreateContainerConfigError','ConfigMap/Secret ausente ou chave errada'],['Ephemeral container','Container de debug colado no Pod (kubectl debug)'],['dotnet-trace','Coleta de CPU/async (speedscope)'],['dotnet-dump','Dump de memória para análise (heap, referências)']])+
QUIZ('Sintoma: CreateContainerConfigError. Causa mais provável?',
['Imagem errada','Secret/ConfigMap não existe ou chave errada','Node sem memória','Probe falhando'],1,
'Isso! O nome do objeto ausente aparece nos events do describe — crie o Secret/ConfigMap ou corrija a referência.')+
QUIZ('Sua imagem final não tem shell e o app está em CrashLoop. Como investigar?',
['Não dá','kubectl debug com imagem de SDK + --target (ephemeral container)','Rebuildar a imagem','kubectl exec funciona igual'],1,
'Exato! O ephemeral container compartilha o namespace de processos — investigue /proc/1, rode dotnet-trace/dump.')}
]};
