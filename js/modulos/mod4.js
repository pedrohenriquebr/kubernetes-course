/* Módulo 04 — Kubernetes para Devs .NET */
const MOD4 = {id:'m4',num:'04',title:'Redes, Ingress & Gateway API',level:'int',lessons:[
{id:'m4l1',title:'DNS e descoberta de serviços',mins:10,body:
'<p>Cada cluster roda um DNS interno (CoreDNS). Todo Service ganha um nome: <code>&lt;service&gt;.&lt;namespace&gt;.svc.cluster.local</code>. Regras práticas:</p>'+
'<ul><li>Mesmo namespace → <code>http://pedidos-api</code></li>'+
'<li>Outro namespace → <code>http://pedidos-api.vendas</code> (ou FQDN completo)</li>'+
'<li>Portas nomeadas geram registros SRV (<code>_http._tcp.pedidos-api.vendas.svc…</code>)</li></ul>'+
C('bash',`# testando DNS de dentro do cluster:
kubectl run dns-test --rm -it --image=busybox:1.36 --restart=Never -- \\
  nslookup minha-api.meu-ns.svc.cluster.local

# FQDN completo (sempre funciona, qualquer namespace):
#   <service>.<namespace>.svc.cluster.local

# Nome curto (mesmo namespace):
#   <service>`)+
'<p>Regras que economizam horas de debugging:</p>'+
'<ul><li>O FQDN <strong>completo</strong> (<code>pedidos-api.vendas.svc.cluster.local</code>) resolve de qualquer lugar.</li>'+
'<li>O nome curto (<code>pedidos-api</code>) só resolve <strong>no mesmo namespace</strong>.</li>'+
'<li>Nome com namespace (<code>pedidos-api.vendas</code>) resolve de qualquer namespace — mas lembre: <code>vendas</code> aqui é o namespace, e o DNS adiciona <code>.svc.cluster.local</code> por trás.</li>'+
'<li>Não existe "DNS global" entre clusters — cada cluster tem seu CoreDNS.</li></ul>'+
'<p>Por que isso funciona sem configuração: o CoreDNS é um DaemonSet/Deployment no <code>kube-system</code>, e cada Pod recebe o <code>nameserver</code> do cluster no <code>/etc/resolv.conf</code> (detalhe completo na lição "DNS do cluster a fundo", mais adiante neste módulo).</p>'+
NOTE('Em .NET, combine com <code>IHttpClientFactory</code> + Polly: a URL base vem da configuração (<code>http://pedidos-api</code>) e muda por ambiente via ConfigMap — dev local usa localhost, cluster usa DNS interno.')+
TERMS([['CoreDNS','DNS interno do cluster (svc.cluster.local)'],['FQDN','<service>.<namespace>.svc.cluster.local'],['Registro A','IP do Service (ou IPs dos Pods, se headless)'],['Registro SRV','Portas nomeadas de um Service'],['resolv.conf','Arquivo do Pod com o nameserver do cluster']])+
QUIZ('De dentro do namespace "vendas", como chamar a API "pedidos" que está no namespace "vendas"?',
['http://pedidos-api','http://pedidos-api.vendas','http://pedidos.vendas.svc','http://pedidos-api.default'],0,
'Isso! Mesmo namespace usa só o nome do Service. O FQDN completo sempre funciona, mas o curto é o idioma do dia a dia.')+
QUIZ('O DNS do cluster é…',
['Um Service especial chamado dns','O CoreDNS, rodando como workload no kube-system','O kube-dns binário no kernel','O /etc/hosts de cada node'],1,
'Isso! CoreDNS roda como Deployment/DaemonSet no kube-system e cada Pod aponta para ele.')},
{id:'m4l2',title:'Services a fundo: EndpointSlices, headless e políticas de tráfego',mins:14,body:
'<p>Por dentro do Service: o <strong>kube-proxy</strong> mantém regras (iptables ou IPVS) em cada node para encaminhar conexões do IP virtual para os backends. Os backends são registrados em <strong>EndpointSlices</strong> (até ~100 endpoints por slice — escala muito melhor que o antigo objeto Endpoints) e podem carregar <em>topology hints</em> para preferir backends na mesma zona.</p>'+
'<h2>EndpointSlices: a lista de backends viva</h2>'+
'<p>O controller do Service observa os Pods do selector e mantém <strong>EndpointSlices</strong> atualizados: cada entrada é um par <code>endereço:porta</code> de um Pod pronto. O kube-proxy lê esses objetos e programa as regras. Quando um Pod morre ou fica não-pronto, o EndpointSlice muda em segundos — e o tráfego para de ir para ele.</p>'+
C('bash',`kubectl get endpointslices -l kubernetes.io/service-name=minha-api
kubectl describe endpointslices <nome>      # addresses + ports + topology`)+
'<p><strong>Topology hints:</strong> em clusters multi-zona, o control plane tenta "dar dica" ao kube-proxy para priorizar backends da MESMA zona do cliente (menos latência, menos custo de cross-zone). Funciona com <code>topology.kubernetes.io/zone</code> nas labels e EndpointSlice com hints.</p>'+
'<h3>Service headless (clusterIP: None)</h3>'+
'<p>Sem IP virtual: o DNS retorna <strong>diretamente os IPs dos Pods</strong>. É o par obrigatório dos StatefulSets (<code>postgres-0.postgres-headless…</code>) e útil quando o cliente quer escolher o backend (ex.: gRPC com balanceamento client-side).</p>'+
C('yaml',`apiVersion: v1
kind: Service
metadata: { name: postgres-headless }
spec:
  clusterIP: None          # HEADLESS
  selector: { app: postgres }
  ports: [{ port: 5432 }]`)+
'<p>No headless com selector, o DNS resolve para <strong>todos os IPs dos Pods</strong> (round-robin do cliente) e cada Pod ganha um registro próprio: <code>postgres-0.postgres-headless.ns.svc.cluster.local</code> — é assim que o StatefulSet "acha" cada réplica individual.</p>'+
'<h3>Ajustes de comportamento</h3>'+
'<table class="tbl"><tr><th>Campo</th><th>Efeito</th><th>Quando usar</th></tr>'+
'<tr><td><code>sessionAffinity: ClientIP</code></td><td>mesmo cliente sempre no mesmo backend</td><td>apps com sessão em memória (evite; prefira estado fora do app)</td></tr>'+
'<tr><td><code>externalTrafficPolicy: Local</code></td><td>preserva IP de origem e evita salto extra</td><td>LoadBalancer/NodePort quando precisar do IP real do cliente</td></tr></table>'+
'<p>E os "primos" internos do <code>externalTrafficPolicy</code> (tráfego <em>dentro</em> do cluster):</p>'+
'<ul><li><strong><code>spec.internalTrafficPolicy: Local</code></strong>: o tráfego interno (Pod→Service) só vai para endpoints no <strong>mesmo node</strong> — útil para economizar saltos de rede e latência em workloads locais (ex.: agentes por node). Padrão: <code>Cluster</code> (qualquer node).</li>'+
'<li><strong><code>spec.trafficDistribution: PreferSameZone</code></strong> (1.31+): preferência de distribuição por zona — "tente ficar na mesma zona", sem ser uma garantia rígida.</li></ul>'+
C('yaml',`spec:
  internalTrafficPolicy: Local          # tráfego interno restrito ao mesmo node
  trafficDistribution: PreferSameZone   # preferência por endpoints da mesma zona`)+
'<p>O <code>externalTrafficPolicy: Local</code> tem um efeito colateral que precisa ser conhecido: o tráfego só vai para nodes que têm Pod do Service (senão a conexão cai). Em balanceadores que enviam para qualquer node (ex.: Azure LB), combine com <code>internalTrafficPolicy</code> e entenda o seu CNI.</p>'+
LAB('EndpointSlice, headless e clientIP',
'<ol><li>Escale o Deployment para 3 e confira: <code>kubectl get endpointslices -l kubernetes.io/service-name=minha-api -o yaml</code> — 3 addresses.</li>'+
'<li>Marque um Pod como não-pronto (remova a label do selector ou use uma probe falhando) e repita: o endpoint sai da lista sem você tocar no Service.</li>'+
'<li>Crie o Service headless acima e resolva: <code>kubectl run dns --rm -it --image=busybox -- nslookup postgres-headless</code> — veja os IPs dos Pods direto.</li>'+
'<li>Adicione <code>sessionAffinity: ClientIP</code> ao Service e rode 10 curls de dentro do cluster: o mesmo Pod atende todos.</li></ol>')+
NOTE('C# e gRPC: conexões HTTP/2 de longa duração "grudam" em um backend. Com Services comuns, use load balancing client-side (ou recicle conexões) — é um caso típico onde entender EndpointSlices salva horas de debugging.')+
TERMS([['EndpointSlice','Lista viva de endereços:porta dos Pods atrás do Service'],['Topology hints','Dica para priorizar backends da mesma zona do cliente'],['Headless','Service sem IP virtual — DNS retorna os IPs dos Pods'],['sessionAffinity','ClientIP: mesmo cliente → mesmo Pod'],['externalTrafficPolicy','Local preserva IP de origem; Cluster faz salto extra']])+
QUIZ('Um Pod morre. Quanto tempo até o Service parar de mandar tráfego para ele?',
['Dias','Segundos — o control plane atualiza o EndpointSlice e o kube-proxy as regras','Nunca','Até o próximo rollout'],1,
'Isso! O mecanismo é quase imediato: Pod morto → EndpointSlice atualizado → tráfego redirecionado.')+
QUIZ('Para que serve o Service headless?',
['Expor na internet','Fazer load balance no kernel','Deixar o cliente resolver os IPs dos Pods diretamente (StatefulSets, gRPC client-side)','Criptografar o tráfego'],2,
'Exato! Headless devolve o controle de balanceamento para o cliente — obrigatório em StatefulSets e útil em gRPC.')},
{id:'m4l3',title:'Ingress: HTTP/HTTPS na porta de entrada',mins:16,body:
'<p>Um Service <code>LoadBalancer</code> por app = um load balancer pago por app. O <strong>Ingress</strong> resolve isso: <em>um</em> entrypoint HTTP(S) que roteia por host e caminho para vários Services — com TLS, redirects e rewrites.</p>'+
FIG(IMG.ingress,'Ingress Controller roteando /api e /web para Services distintos')+
C('yaml',`apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: loja-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod   # TLS automático
spec:
  ingressClassName: nginx
  rules:
  - host: api.loja.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: minha-api
            port:
              number: 80
  tls:
  - hosts: [api.loja.example.com]
    secretName: api-loja-tls`)+
'<p>O Ingress é só a <em>declaração</em>; quem executa é o <strong>Ingress Controller</strong> (NGINX, Traefik, ou os nativos de cada cloud). Anotações são específicas de cada controller — uma das limitações que motivou o Gateway API (próxima lição).</p>'+
'<h2>pathType: Prefix vs Exact</h2>'+
'<ul><li><strong><code>Prefix</code></strong>: <code>/api</code> casa com <code>/api</code>, <code>/api/v1</code>, <code>/api/orders</code>… (casa por segmentos — <code>/api2</code> NÃO casa).</li>'+
'<li><strong><code>Exact</code></strong>: só o caminho idêntico.</li></ul>'+
'<h2>Anotações do NGINX Ingress (as que mais aparecem)</h2>'+
C('yaml',`metadata:
  annotations:
    # Roteamento com rewrite (strips /api antes de mandar ao Service):
    nginx.ingress.kubernetes.io/rewrite-target: /$2
    # Limites e proteção:
    nginx.ingress.kubernetes.io/proxy-body-size: 10m
    nginx.ingress.kubernetes.io/limit-rps: "10"
    nginx.ingress.kubernetes.io/enable-cors: "true"
    # Sessão (use com moderação):
    nginx.ingress.kubernetes.io/affinity: cookie
    nginx.ingress.kubernetes.io/session-cookie-name: loja_sessao`)+
'<p>Cada controller tem o seu dicionário de anotações — é o ponto mais "proprietário" do Ingress clássico e a maior motivação do Gateway API.</p>'+
'<h2>TLS: o fluxo com cert-manager</h2>'+
'<ol><li>O Ingress declara <code>tls.hosts</code> + <code>secretName</code>.</li>'+
'<li>O <strong>cert-manager</strong> (controller de certificados) lê a anotação <code>cert-manager.io/cluster-issuer</code>, resolve o desafio ACME (HTTP-01/DNS-01) e <strong>cria o Secret TLS automaticamente</strong>.</li>'+
'<li>Renovação: automática (o cert-manager cuida do ciclo).</li></ol>'+
LAB('Ingress NGINX no kind (de verdade)',
'<ol><li>Instale o controller: <code>kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml</code> (o manifest do kind já configura portMappings 80/443).</li>'+
'<li>Aguarde: <code>kubectl -n ingress-nginx wait --for=condition=ready pod -l app.kubernetes.io/component=controller</code>.</li>'+
'<li>Aplique 2 Deployments+Services (ex.: <code>web</code> e <code>api</code>) e o Ingress roteando <code>/web</code> e <code>/api</code>.</li>'+
'<li>Teste: <code>curl -H "Host: api.loja.example.com" http://localhost/api</code> — o tráfego passou pelo NGINX até o Service certo.</li>'+
'<li>Mude o host no /etc/hosts (ou use -H) e veja o roteamento por hostname.</li></ol>')+
CLOUD('<strong>AKS:</strong> add-on <em>Application Gateway Ingress Controller (AGIC)</em> ou NGINX. <strong>GKE:</strong> Ingress nativo (GLBC + Cloud Armor/WAF) ou NGINX. <strong>EKS:</strong> <em>AWS Load Balancer Controller</em> (ALB) ou NGINX.')+
TERMS([['Ingress','Declaração de roteamento HTTP(S) por host/caminho'],['Ingress Controller','Quem implementa: NGINX, Traefik, AGIC, ALB, GLBC'],['pathType','Prefix (por segmentos) ou Exact'],['Anotação','Config específica do controller (rewrite, limits, cors…)'],['cert-manager','Controller que emite e renova certificados (ACME)']])+
QUIZ('O Ingress sozinho não faz nada. Quem executa o roteamento?',
['O kube-proxy','O Ingress Controller (NGINX, Traefik, ALB…)','O CoreDNS','O etcd'],1,
'Isso! Ingress é só a declaração; o controller lê e programa o proxy. Sem controller instalado, nada acontece.')+
QUIZ('pathType: Prefix com path /api casa com qual caminho?',
['/api2','/ap','/api/orders','/apiX'],2,
'Exato! Prefix casa por segmentos: /api, /api/v1, /api/orders — mas não /api2.')},
{id:'m4l4',title:'Gateway API: o sucessor do Ingress',mins:14,body:
'<p>O <strong>Gateway API</strong> é o sucessor oficial do Ingress (GA em 2023): mais expressivo, portável entre implementações e desenhado em torno de <em>papéis</em>: provedor de infraestrutura, operador de cluster e desenvolvedor de aplicação.</p>'+
'<table class="tbl"><tr><th>Objeto</th><th>Dono</th><th>Papel</th></tr>'+
'<tr><td><code>GatewayClass</code></td><td>infra</td><td>define a implementação (ex.: ALB, GKE Gateway, Istio, Envoy)</td></tr>'+
'<tr><td><code>Gateway</code></td><td>operador</td><td>instância do gateway: listeners, portas, certificados</td></tr>'+
'<tr><td><code>HTTPRoute</code></td><td>dev</td><td>regras de roteamento: hosts, paths, filtros, traffic split</td></tr></table>'+
'<p>A separação de papéis é o coração do design: o time de infra define o <code>GatewayClass</code> (uma vez), o operador provisiona o <code>Gateway</code>, e o <strong>dev só escreve <code>HTTPRoute</code></strong> — sem tocar em infraestrutura. E o dev não precisa de permissão para criar Gateways (RBAC granular por recurso).</p>'+
C('yaml',`apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata: { name: loja-gw }
spec:
  gatewayClassName: gke-l7-regional      # varia por implementação
  listeners:
  - name: https
    port: 443
    protocol: HTTPS
    tls:
      mode: Terminate
      certificateRefs: [{ name: api-loja-tls }]
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: { name: loja-routes }
spec:
  parentRefs: [{ name: loja-gw }]
  hostnames: ["api.loja.example.com"]
  rules:
  - matches: [{ path: { type: PathPrefix, value: /v2 } }]
    backendRefs:
    - { name: minha-api-v2, port: 80, weight: 10 }   # canary nativo!
    - { name: minha-api-v1, port: 80, weight: 90 }
  - backendRefs: [{ name: minha-api, port: 80 }]`)+
'<h2>Filtros padronizados (sem anotações proprietárias)</h2>'+
C('yaml',`rules:
- matches: [{ path: { type: PathPrefix, value: /api } }]
  filters:
  - type: URLRewrite
    urlRewrite: { path: { type: ReplacePrefixMatch, replacePrefixMatch: / } }
  - type: RequestHeaderModifier
    requestHeaderModifier:
      set: [{ name: X-Internal, value: "true" }]
  backendRefs: [{ name: minha-api, port: 80 }]
- matches: [{ path: { type: Exact, value: /healthz } }]
  filters:
  - type: RequestMirror
    requestMirror: { backendRef: { name: minha-api-shadow, port: 80 } }  # shadow traffic`)+
'<p>RequestRedirect, URLRewrite, RequestHeaderModifier e RequestMirror são filtros <strong>padronizados</strong> — funcionam igual em qualquer implementação.</p>'+
'<h2>Cross-namespace e ReferenceGrant</h2>'+
'<p>Um HTTPRoute no namespace <code>loja</code> pode referenciar um Service em <code>pagamentos</code>? Só se existir um <strong>ReferenceGrant</strong> autorizando: o dono do namespace de destino concede permissão explícita. É o controle de "quem pode apontar para o quê" que o Ingress não tinha.</p>'+
C('yaml',`apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata: { name: permite-loja, namespace: pagamentos }
spec:
  from: [{ group: gateway.networking.k8s.io, kind: HTTPRoute, namespace: loja }]
  to: [{ group: "", kind: Service }]`)+
LAB('Explorando o Gateway API',
'<ol><li>Verifique se seu cluster tem o CRD: <code>kubectl get crd gateways.gateway.networking.k8s.io</code> (no kind padrão NÃO tem — instale via <code>kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/latest/download/standard-install.yaml</code>).</li>'+
'<li>Rode <code>kubectl explain httproute.spec.rules.filters</code> — veja a lista oficial de filtros.</li>'+
'<li>Aplique um Gateway + HTTPRoute com traffic split (pesos 90/10) e confira em <code>kubectl describe httproute</code> (seção Status: Accepted).</li>'+
'<li>Quebre de propósito (Service inexistente) e veja o status <code>ResolvedRefs: False</code> — o Gateway API reporta problemas por recurso, não "some silenciosamente".</li></ol>')+
CLOUD('Suporte nativo crescente: <strong>GKE Gateway</strong> (Google), <strong>AKS</strong> com Application Gateway for Containers / AGIC Gateway API, <strong>EKS</strong> via AWS Load Balancer Controller e VPC Lattice; implementações portáveis: Istio, Cilium, NGINX Gateway Fabric, Envoy Gateway, Traefik.')+
TERMS([['GatewayClass','Implementação (ALB, GKE Gateway, Envoy…) — papel da infra'],['Gateway','Instância: listeners, portas, TLS — papel do operador'],['HTTPRoute','Rotas e filtros — papel do dev'],['Filtros','Redirect, rewrite, headers, mirror — padronizados'],['ReferenceGrant','Autorização de referência cross-namespace'],['Status conditions','Accepted/ResolvedRefs — a API "fala" quando algo está errado']])+
QUIZ('Como fazer canary (10% do tráfego) com Gateway API?',
['Anotação do Ingress','backendRefs com weight: 10/90 num HTTPRoute','Dois Gateways','kubectl scale'],1,
'Exato! Traffic split por weight é nativo do HTTPRoute — sem anotações proprietárias.')+
QUIZ('Por que o Gateway API separa GatewayClass/Gateway/HTTPRoute?',
['Por organização de arquivos','Porque cada papel (infra, operador, dev) tem permissão só no que é seu','Porque o YAML ficou grande demais','Para suportar mais clouds'],1,
'Isso! A separação por papel habilita RBAC granular: o dev cria HTTPRoute, não Gateway.')},
{id:'m4l5',title:'NetworkPolicies: firewall entre Pods',mins:14,body:
'<p>Por padrão, <strong>todo Pod fala com todo Pod</strong>. NetworkPolicy é o firewall declarativo que muda isso — essencial para zero-trust dentro do cluster.</p>'+
TIP('Mental model: a NetworkPolicy é o <strong>"helicopter parent"</strong> da rede — "você só fala com o Melvin da casa ao lado, nada de conversar com o Jimmy da outra rua". E lembre: sem política = portas abertas (todo mundo fala com todo mundo).')+
C('yaml',`# 1) negar tudo por padrão no namespace pagamentos
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: pagamentos
spec:
  podSelector: {}        # todos os Pods
  policyTypes: [Ingress, Egress]
---
# 2) permitir apenas checkout -> api-pagamentos
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-checkout
  namespace: pagamentos
spec:
  podSelector:
    matchLabels: { app: api-pagamentos }
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector:
        matchLabels: { app: checkout }
    - namespaceSelector:
        matchLabels: { kubernetes.io/metadata.name: ingress }
    ports:
    - port: 8080`)+
'<p>As regras combinam <code>podSelector</code>, <code>namespaceSelector</code> e <code>ipBlock</code> (CIDR externo). Regras são <strong>aditivas</strong>: um Pod só é permitido por pelo menos uma política que o aceite. Não existe "deny explícito" — o deny é a ausência de allow.</p>'+
'<h2>O padrão zero-trust completo</h2>'+
'<ol><li><strong>default-deny no namespace</strong> (ingress + egress).</li>'+
'<li>Liberar <strong>ingress</strong> por app: quem pode chamar quem.</li>'+
'<li>Liberar <strong>egress</strong> com cuidado — o padrão que mais quebra apps: DNS!</li></ol>'+
C('yaml',`# egress mínimo que TODO namespace precisa (DNS do cluster):
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-dns, namespace: pagamentos }
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
  - to:
    - namespaceSelector:
        matchLabels: { kubernetes.io/metadata.name: kube-system }
      podSelector:
        matchLabels: { k8s-app: kube-dns }
    ports:
    - port: 53
      protocol: UDP
    - port: 53
      protocol: TCP`)+
'<p>Sem essa política, o egress é bloqueado e <strong>o app não resolve nenhum nome</strong> — incluindo o próprio DNS do cluster. É o erro clássico de "aplicou NetworkPolicy e tudo quebrou".</p>'+
'<h2>ipBlock: tráfego para fora do cluster</h2>'+
C('yaml',`spec:
  podSelector: { matchLabels: { app: worker } }
  policyTypes: [Egress]
  egress:
  - to:
    - ipBlock:
        cidr: 10.0.0.0/8        # VPC do cloud
    - ipBlock:
        cidr: 0.0.0.0/0
        except: [10.0.0.0/8, 172.16.0.0/12]   # tudo, menos interno`)+
'<p>Detalhe: <code>ipBlock</code> NÃO respeita namespaces — é rede crua. E o kube-proxy não implementa NetworkPolicy: quem implementa é o <strong>CNI</strong> (Calico, Cilium, kindnet…).</p>'+
LAB('Default-deny de verdade no kind',
'<ol><li>O kindnet (CNI padrão do kind) implementa NetworkPolicy — dá para testar local.</li>'+
'<li>Suba 2 Pods de teste (<code>cliente</code> e <code>servidor</code> com <code>nc</code>/<code>wget</code>).</li>'+
'<li>Confirme que o cliente alcança o servidor (sem política).</li>'+
'<li>Aplique o <code>default-deny</code> ingress no namespace — a chamada passa a falhar.</li>'+
'<li>Aplique <code>allow-checkout</code> (podSelector do cliente) — volta a funcionar.</li>'+
'<li>Adicione egress default-deny e veja o DNS quebrar — depois aplique o allow-dns e veja voltar.</li></ol>')+
WARN('NetworkPolicy só funciona se o CNI suportar. Nos clouds: AKS (Azure CNI + políticas/Calico), GKE (Dataplane V2 aplica nativamente), EKS (Calico/Network Policy add-on). Sem isso, o YAML aplica… nada.')+
NOTE('Em .NET: se sua API "perdeu" acesso ao banco ou a outra API depois de uma política nova, o caminho de debug é <code>kubectl get networkpolicy -n ns</code> + revisar egress. E lembre da regra do DNS: quase todo egress mínimo precisa da política allow-dns.')+
TERMS([['NetworkPolicy','Firewall declarativo entre Pods (ingress/egress)'],['Aditivo','Permitido = existe ao menos uma política que aceita'],['podSelector','Seleciona Pods-alvo (dentro do namespace)'],['namespaceSelector','Seleciona Pods por namespace de origem/destino'],['ipBlock','CIDR cru — rede fora do conceito de namespace'],['CNI','Quem implementa NetworkPolicy (Calico, Cilium, kindnet)']])+
QUIZ('Aplicou default-deny de egress e o app parou de resolver nomes. O que falta?',
['Reiniciar o kubelet','Uma política permitindo DNS (porta 53 → kube-dns)','Aumentar o DNS TTL','Usar IP fixo'],1,
'Isso! Egress bloqueado corta o DNS do cluster. Toda política de egress precisa da exceção do kube-dns.')+
QUIZ('NetworkPolicy é implementada por…',
['kube-proxy','O CNI (Calico, Cilium, kindnet…)','CoreDNS','O API Server'],1,
'Exato! O kube-proxy só faz Services. Quem programa o firewall é o CNI.')},
{id:'m4l6',title:'Service Mesh (visão geral)',mins:12,body:
'<p>Quando "rede" vira requisito de negócio — mTLS obrigatório, retries/circuit-breaker globais, canary por porcentagem, observabilidade de chamada a chamada — entra o <strong>service mesh</strong> (Istio, Linkerd): uma camada de proxies (<em>sidecars</em>) que intercepta o tráfego entre Pods.</p>'+
'<h2>Como funciona por dentro</h2>'+
'<ol><li><strong>Injeção de sidecar:</strong> o mesh adiciona um proxy (envoy, no Istio) ao Pod — todo tráfego entra e sai por ele.</li>'+
'<li><strong>Plano de controle:</strong> um controlador distribui as configurações (rotas, mTLS, métricas) aos sidecars.</li>'+
'<li><strong>mTLS automático:</strong> cada proxy tem identidade (SPIFFE); as conexões entre proxies são TLS mútuo — criptografia e autenticação de serviço a serviço sem tocar no código.</li></ol>'+
'<ul><li><strong>O que dá:</strong> mTLS automático, traffic splitting, timeouts/retries declarativos, telemetria rica (tracing distribuído de graça).</li>'+
'<li><strong>O que cobra:</strong> complexidade operacional (control plane para operar), latência extra (um salto de proxy por chamada), upgrades delicados, recursos (um sidecar por Pod).</li></ul>'+
'<table class="tbl"><tr><th></th><th>Istio</th><th>Linkerd</th></tr>'+
'<tr><td>Proxy</td><td>Envoy (potente, rico em features)</td><td>Linkerd2-proxy (Rust, minimalista)</td></tr>'+
'<tr><td>Perfil</td><td>máximo de features (mTLS, canary, tracing, WAF-like)</td><td>simplicidade e performance (mTLS + observabilidade)</td></tr>'+
'<tr><td>Custo operacional</td><td>alto</td><td>baixo</td></tr>'+
'<tr><td>Quando</td><td>plataforma grande, times de infra dedicados</td><td>times pequenos/médios que querem 80% do benefício</td></tr></table>'+
DEEP('O Gateway API conversa com service mesh: no Istio, os Gateways e HTTPRoutes podem ser "transparentes" — o dev escreve HTTPRoute e o mesh implementa (roteamento + mTLS) sem criar outro objeto. É a convergência: o padrão de rede da CNCF.')+
NOTE('Antes de pensar em mesh: HTTP clients com resiliência no .NET (Polly) + Gateway API bem configurado. Mesh se paga em dezenas de serviços, não em três. E no .NET, o lado do cliente também precisa cooperar: <code>IHttpClientFactory</code> reutilizando conexões evita que o mTLS por sidecar gere custo de handshake em toda chamada.')+
TERMS([['Service mesh','Camada de proxies sidecar que intercepta o tráfego entre Pods'],['mTLS','TLS mútuo: criptografia + autenticação de serviço a serviço'],['Sidecar injection','Proxy adicionado automaticamente ao Pod'],['Envoy','Proxy do Istio (e base de vários gateways)'],['SPIFFE','Identidade padrão para workloads (quem é este serviço?)']])+
QUIZ('O que o service mesh resolve que o Kubernetes padrão não resolve?',
['Load balancing','mTLS automático + canary fino + telemetria por chamada','DNS interno','Rollout'],1,
'Isso! Rede básica (Service, Ingress) o K8s já dá; mTLS e controle fino de tráfego são o território do mesh.')+
QUIZ('O custo de um mesh: cada chamada ganha…',
['Latência de um salto de proxy (e recursos por sidecar)','Um round trip ao API Server','Uma query no etcd','Um certificado novo'],0,
'Exato! Sidecar = latência + memória/CPU por Pod. Vale quando os benefícios (mTLS, observabilidade) superam o custo — em plataformas grandes.')},
{id:'m4l7',title:'DNS do cluster a fundo: search domains, ndots e políticas',mins:12,body:
'<p>Esta lição desce ao <code>/etc/resolv.conf</code> do Pod — a fonte de 90% dos problemas de "DNS não resolve" que parecem mágica.</p>'+
'<h2>O resolv.conf de um Pod</h2>'+
C('bash',`# Dentro de um Pod qualquer:
cat /etc/resolv.conf
# nameserver 10.96.0.10        <- ClusterIP do CoreDNS (Service kube-dns)
# search ns.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5`)+
'<p>O <code>search</code> lista os domínios que o resolver tenta em ordem; o <code>ndots:5</code> define quantos pontos um nome precisa ter para ser tratado como FQDN (resolvido direto) em vez de "nome curto" (tentado com os search domains).</p>'+
'<p>Para <code>pedidos-api</code> (0 pontos): o resolver tenta <code>pedidos-api.ns.svc.cluster.local</code> → <code>pedidos-api.svc.cluster.local</code> → <code>pedidos-api.cluster.local</code> → <code>pedidos-api</code>. Cada tentativa é uma query ao CoreDNS.</p>'+
'<p>Para <code>pedidos-api.vendas.svc.cluster.local</code> (4+ pontos): ainda não é FQDN (precisa 5) — o resolver TENTA COM search primeiro, e só depois o nome direto. Cada tentativa errada gera um <strong>NXDOMAIN</strong>.</p>'+
DEEP('O problema clássico do "primeiro request lento": com ndots:5, um nome com menos de 5 pontos gera múltiplas queries (com search) até a resposta certa — cada uma com timeout se o servidor não responde rápido. Em apps .NET com HttpClient que não reutiliza (ou em cada nova conexão), isso vira latência visível. O .NET respeita o resolv.conf do container (Dns.GetHostEntry / HttpClient) — por isso o padrão é igual em qualquer linguagem.')+
'<h2>dnsPolicy: como o Pod monta o resolv.conf</h2>'+
'<table class="tbl"><tr><th>Política</th><th>resolv.conf do Pod</th><th>Uso</th></tr>'+
'<tr><td><code>ClusterFirst</code> (padrão)</td><td>CoreDNS + search domains do cluster</td><td>99% dos casos</td></tr>'+
'<tr><td><code>Default</code></td><td>herda o resolv.conf do NODE (host)</td><td>casos especiais (DNS externo direto)</td></tr>'+
'<tr><td><code>None</code></td><td>você fornece o <code>dnsConfig</code> inteiro</td><td>DNS privado da empresa, override total</td></tr></table>'+
C('yaml',`spec:
  dnsPolicy: None
  dnsConfig:
    nameservers: ["10.1.2.3"]              # DNS privado da empresa
    searches: ["internal.corp.example.com"]
    options:
    - name: ndots
      value: "1"                            # resolve nomes curtos direto`)+
'<h2>IPv4/IPv6 dual-stack</h2>'+
'<p>Clusters podem rodar em <strong>dual-stack</strong> (IPv4 + IPv6): Services ganham dois ClusterIPs (<code>spec.ipFamilies: [IPv4, IPv6]</code> com <code>ipFamilyPolicy: RequireDualStack</code>), Pods recebem as duas famílias, e o DNS resolve A (IPv4) e AAAA (IPv6). Para o dev, o modelo não muda: você continua chamando pelo nome do Service. Relevante em clouds com IPv6 (EKS/GKE têm suporte; confira a doc do provider) e em exigências regulatórias de IPv6.</p>'+
LAB('Vendo o DNS por dentro',
'<ol><li>Suba um Pod de teste: <code>kubectl run dns-test --rm -it --image=busybox:1.36 --restart=Never -- sh</code>.</li>'+
'<li>Dentro: <code>cat /etc/resolv.conf</code> — confira search + ndots.</li>'+
'<li>Resolva com verbose: <code>nslookup -debug pedidos-api</code> — veja a sequência de tentativas com search.</li>'+
'<li>Resolva o FQDN completo: <code>nslookup pedidos-api.vendas.svc.cluster.local</code> — 1 resposta direta.</li>'+
'<li>Teste o CoreDNS direto: <code>nslookup pedidos-api 10.96.0.10</code> (o IP do seu CoreDNS).</li></ol>')+
TIP('Debug rápido de DNS: <code>kubectl get svc -n kube-system kube-dns</code> (IP), <code>kubectl get pods -n kube-system -l k8s-app=kube-dns</code> (Pods do CoreDNS) e <code>kubectl logs -n kube-system -l k8s-app=kube-dns --tail=20</code> (queries).')+
TERMS([['search domains','ns.svc.cluster.local svc.cluster.local cluster.local — tentados em ordem'],['ndots','Nº de pontos para tratar como FQDN (padrão 5)'],['dnsPolicy','ClusterFirst / Default / None'],['dnsConfig','Override do resolv.conf (com dnsPolicy: None)'],['kube-dns','O Service ClusterIP do CoreDNS (10.96.0.10 típico)']])+
QUIZ('Seu Pod não resolve "pedidos-api" mas resolve o FQDN completo. Causa provável?',
['O CoreDNS está fora do ar','O search domain está errado no resolv.conf (ou o nome curto é de outro namespace)','Falta NetworkPolicy','O kube-proxy caiu'],1,
'Isso! O nome curto depende dos search domains. FQDN completo sempre resolve (se o Service existe) — o curto, só se o search estiver certo.')+
QUIZ('Por que reduzir ndots para 1 ajuda em DNS privado?',
['Porque 1 é mais rápido que 5','Menos tentativas com search → menos NXDOMAIN e latência','Porque o CoreDNS exige','Porque o resolv.conf fica menor'],1,
'Exato! Com ndots baixo, nomes curtos vão direto — menos queries perdidas, menos latência no primeiro request.')}
]};
