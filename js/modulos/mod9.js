/* Módulo 09 — Kubernetes para Devs .NET */
const MOD9 = {id:'m9',num:'09',title:'Kubernetes Gerenciado: AKS × GKE × EKS',level:'adv',lessons:[
{id:'m9l1',title:'Panorama dos managed Kubernetes',mins:15,body:
'<p>Nos três clouds, o <strong>Control Plane é gerenciado</strong> (patch, HA, backups do etcd por conta do provider) e você opera os <em>node pools</em> (ou nem isso, nos modos serverless). O que diferencia é o ecossistema em volta — valores verificados nas páginas oficiais de preço (sujeitos a mudança):</p>'+
'<table class="tbl"><tr><th>Aspecto</th><th>AKS (Azure)</th><th>GKE (Google)</th><th>EKS (AWS)</th></tr>'+
'<tr><td>Control plane</td><td>Free tier grátis (sem SLA); Standard ~US$ 73/mês (~US$ 0,10/h) com SLA; Premium com LTS</td><td>US$ 0,10/h por cluster (Standard); no Autopilot a taxa é incluída no preço por Pod</td><td>US$ 0,10/h por cluster</td></tr>'+
'<tr><td>Modo serverless</td><td>Virtual nodes (ACI)</td><td><code>Autopilot</code> (cobra pelos requests dos Pods)</td><td><code>Fargate</code></td></tr>'+
'<tr><td>CNI padrão</td><td>Azure CNI / kubenet</td><td>VPC-native (Dataplane V2 aplica NetPol)</td><td>VPC CNI (IPs da VNet por Pod)</td></tr>'+
'<tr><td>Identidade p/ Pods</td><td>Workload Identity (Entra ID)</td><td>Workload Identity (IAM)</td><td>IRSA + EKS Pod Identity</td></tr>'+
'<tr><td>Ingress/Gateway</td><td>App Gateway (AGIC), Gateway API</td><td>GKE Ingress + Gateway nativo + Cloud Armor</td><td>ALB Ingress Controller, VPC Lattice</td></tr>'+
'<tr><td>Observabilidade</td><td>Container Insights</td><td>Cloud Monitoring/Logging nativo</td><td>CloudWatch Container Insights</td></tr>'+
'<tr><td>Autoscaler de nodes</td><td>Cluster Autoscaler (+KEDA add-on)</td><td>Cluster Autoscaler</td><td>Karpenter (muito comum)</td></tr>'+
'<tr><td>Windows nodes</td><td>⭐ excelente (herança .NET)</td><td>suportado</td><td>suportado</td></tr></table>'+
'<h2>Como escolher (o guia de decisão)</h2>'+
'<ul><li><strong>Já está na Azure (ou tem .NET Framework/Windows)?</strong> → AKS. Integração com Entra ID, ACR, Azure DevOps e Windows containers é a melhor.</li>'+
'<li><strong>Quer o "só me deixa desenvolver"?</strong> → GKE Autopilot (não gerencia node) ou AKS com Virtual Nodes.</li>'+
'<li><strong>Time que já vive de AWS (IAM, VPC, CloudWatch)?</strong> → EKS. E o Karpenter é imbatível em custo de nodes.</li>'+
'<li><strong>Multicloud intencional?</strong> → o modelo mental deste curso é o que se porta; mantenha manifests agnósticos e isole integrações (Módulo 10).</li></ul>'+
'<p>E o modelo de preço em uma frase: nos três, você paga <strong>pela gestão (control plane) + pelos nodes (VM) + pelos recursos da nuvem</strong> (LB, disco, egress). O Autopilot/Fargate/ACI trocam o "pagar por node" por "pagar pelo que o Pod pede".</p>'+
NOTE('Para times .NET: o AKS tem a melhor experiência com Windows containers e a integração mais curta com Entra ID/Azure DevOps. Mas os CONCEITOS que você aprendeu são 100% portáveis — mudar de cloud é trocar anotações e provisionamento, não o modelo mental.')+
TERMS([['Managed Kubernetes','Control Plane operado pelo provider'],['Node pool','Grupo de nodes com a mesma config (SO, VM, labels)'],['Autopilot/Fargate/ACI','Modos serverless: paga pelo Pod, não pelo node'],['Workload identity','Token do ServiceAccount vira identidade da nuvem'],['Karpenter','Provisionador de nodes sob medida (EKS)']])+
QUIZ('O que é igual nos três providers?',
['O preço do control plane','Os objetos da API (Pod, Deployment, Service…) e o kubectl','O CNI padrão','O Ingress controller nativo'],1,
'Exato! Kubernetes é um padrão: a API e os objetos são os mesmos; o que muda são add-ons e integrações de cada nuvem.')+
QUIZ('Seu time vive de AWS e quer o melhor custo de nodes sob demanda. Qual caminho?',
['AKS com Virtual Nodes','EKS + Karpenter','GKE Autopilot','Nenhum'],1,
'Isso! Karpenter provisiona a instância certa em segundos — o autoscaler de nodes mais agressivo dos três.')},
{id:'m9l2',title:'AKS na prática (Azure)',mins:16,body:
C('bash',`az group create -n rg-prod -l brazilsouth
az acr create -n meuregistry -g rg-prod --sku Standard
az aks create -n prod-aks -g rg-prod \\
  --node-count 3 --node-vm-size Standard_D4s_v5 \\
  --enable-managed-identity --enable-workload-identity \\
  --attach-acr meuregistry --enable-addons monitoring \\
  --tier standard               # SLA de uptime (free tier = sem SLA)
az aks get-credentials -n prod-aks -g rg-prod`)+
'<h2>Node pools: a organização dos nodes</h2>'+
'<ul><li><strong>System pool:</strong> nodes do sistema (critical add-ons) — não coloque workloads de app aqui.</li>'+
'<li><strong>User pools:</strong> os nodes do seu app; você pode ter vários (Linux, Windows, GPU, spot) com labels/taints.</li>'+
'<li><strong>Windows pool:</strong> node pool Windows Server para containers Windows (.NET Framework) — o diferencial do AKS.</li></ul>'+
C('bash',`# adicionar um user pool spot (70-90% mais barato):
az aks nodepool add --cluster-name prod-aks -g rg-prod \\
  --name spot01 --node-vm-size Standard_D4s_v5 --priority Spot \\
  --node-count 1 --enable-cluster-autoscaler --min-count 1 --max-count 5

# listar pools:
az aks nodepool list --cluster-name prod-aks -g rg-prod -o table`)+
'<h2>Azure CNI vs kubenet</h2>'+
'<ul><li><strong>kubenet:</strong> Pods usam IPs de uma sub-rede interna (NAT para sair) — mais IPs disponíveis, menos integração.</li>'+
'<li><strong>Azure CNI (padrão moderno):</strong> cada Pod ganha um IP real da VNet — integra com firewalls/rotas corporativas, mas consome IPs (planeje o CIDR; existe o <em>Azure CNI Overlay</em> para escalar).</li></ul>'+
'<h2>Workload Identity no seu código .NET</h2>'+
C('yaml',`apiVersion: v1
kind: ServiceAccount
metadata:
  name: minha-api
  annotations:
    azure/workload-client-id: 00000000-0000-0000-0000-000000000000`)+
C('csharp',`// Sem connection string, sem segredo no cluster:
builder.Configuration.AddAzureKeyVault(
    new Uri("https://meu-kv.vault.azure.net/"),
    new DefaultAzureCredential());   // resolve a Workload Identity do Pod`)+
'<p>O fluxo completo: ServiceAccount com a anotação → federação no Entra ID (aplicativo com o emissor OIDC do cluster) → o token do Pod é trocado por um token do Entra ID → <code>DefaultAzureCredential</code> resolve. Nenhuma senha em lugar nenhum.</p>'+
'<h2>Upgrades e manutenção no AKS</h2>'+
C('bash',`az aks upgrade --name prod-aks -g rg-prod --kubernetes-version 1.31.0
az aks get-upgrades --name prod-aks -g rg-prod -o table`)+
'<p>O upgrade sobe nodes novos (surge), drena os antigos respeitando PDBs e remove — a mecânica da lição de upgrades (Módulo 10). Com <code>--tier standard</code>, janelas de manutenção e <em>nodepool surge</em> configuráveis.</p>'+
LAB('Criando um cluster AKS (opcional — precisa de conta Azure)',
'<ol><li>Instale a CLI: <code>winget install Microsoft.AzureCLI</code> e rode <code>az login</code>.</li>'+
'<li>Crie RG + ACR + AKS com os comandos acima (ajuste a região).</li>'+
'<li><code>az aks get-credentials</code> e confira: <code>kubectl get nodes</code>, <code>kubectl get ns</code>.</li>'+
'<li>Conecte o ACR ao AKS (já feito com --attach-acr) e faça um deploy de teste.</li>'+
'<li>Observe o add-on monitoring: métricas do cluster no portal do Azure.</li></ol>')+
'<p>Detalhes que importam no AKS: <strong>Azure CNI</strong> dá IP real da VNet aos Pods; <em>node pools</em> separados por SO (Linux/Windows) e criticidade (system vs user); <strong>virtual nodes</strong> estouram carga para containers serverless (ACI); <strong>KEDA add-on</strong> oficial para autoscaling por eventos.</p>'+
NOTE('Sistemas legados .NET Framework? O AKS é a opção de primeira classe: node pools Windows Server com suporte a Windows containers, algo raro nos concorrentes.')+
TERMS([['System/user pool','Nodes do sistema vs do app (separação e isolamento)'],['Azure CNI','IP real da VNet por Pod (integração corporativa)'],['kubenet','Sub-rede interna com NAT (mais IPs disponíveis)'],['Workload Identity','ServiceAccount → Entra ID via federação OIDC'],['Spot pool','Nodes interrompíveis ~70–90% mais baratos'],['Virtual nodes','Estouro de carga para ACI (serverless)']])+
QUIZ('O que o --attach-acr faz no az aks create?',
['Nada','Conecta o AKS ao ACR (o cluster consegue puxar imagens do seu registry)','Cria um registro novo','Exclui o ACR'],1,
'Isso! O attach configura a role no ACR — o kubelet puxa imagens privadas sem imagePullSecrets manuais.')+
QUIZ('Seu app .NET Framework legado precisa de containers Windows. Qual cloud?',
['AKS (node pools Windows)','GKE Autopilot','EKS Fargate','Nenhuma'],0,
'Exato! Windows containers são o diferencial do AKS — o único dos três com suporte de primeira classe.')},
{id:'m9l3',title:'GKE na prática (Google Cloud)',mins:14,body:
C('bash',`gcloud container clusters create-auto prod-gke \\
  --region southamerica-east1 \\
  --workload-pool meu-projeto.svc.id.goog

gcloud container clusters get-credentials prod-gke \\
  --region southamerica-east1`)+
'<h2>Autopilot vs Standard</h2>'+
'<p><strong>Autopilot</strong> é o modo "só me deixa desenvolver": o Google provisiona e dimensiona os nodes; você paga pelos <em>requests dos Pods</em> (vCPU, memória, storage), não por node — a taxa de gestão do cluster já está incluída. Perfeito para começar e para cargas com pouca variação. Para controle fino (GPU, kernel tuning, spot agressivo, node pools personalizados) use o modo <strong>Standard</strong> (US$ 0,10/h de gestão + custo dos nodes).</p>'+
'<table class="tbl"><tr><th></th><th>Autopilot</th><th>Standard</th></tr>'+
'<tr><td>Quem gerencia nodes</td><td>Google</td><td>você (node pools)</td></tr>'+
'<tr><td>Preço</td><td>por request do Pod</td><td>gestão + VM dos nodes</td></tr>'+
'<tr><td>Controle fino</td><td>limitado (mas cobre 95% dos casos)</td><td>total (GPU, spot, tuning)</td></tr></table>'+
'<h2>Dataplane V2: rede e NetworkPolicy nativas</h2>'+
'<p>O <strong>Dataplane V2</strong> (eBPF) é o padrão do GKE: NetworkPolicies aplicadas de verdade (sem Calico separado), observabilidade de rede no console, e o CNI VPC-native (IPs da VPC por Pod).</p>'+
'<h2>GKE Gateway: Gateway API nativo</h2>'+
'<p>O <strong>GKE Gateway</strong> implementa o Gateway API com balanceadores globais do Google (L7/L4), Cloud Armor (WAF) integrado e TLS gerenciado — sem Ingress Controller para instalar.</p>'+
TIP('Gotchas reais do GKE (vistos na prática): o <strong>Ingress nativo do GKE não aceita <code>spec.ingressClassName</code></strong> — usa a annotation legada <code>kubernetes.io/ingress.class</code>; e a implementação GKE do Gateway API <strong>não suporta TCPRoute</strong> (só HTTPRoute). Verifique o que a sua versão suporta antes de desenhar o roteamento.')+
'<h2>Identidade e GitOps</h2>'+
C('yaml',`# Workload Identity: ServiceAccount do K8s -> IAM do Google
apiVersion: v1
kind: ServiceAccount
metadata:
  name: minha-api
  annotations:
    iam.gke.io/gcp-service-account: minha-api@meu-projeto.iam.gserviceaccount.com`)+
'<p>O <strong>Config Sync</strong> (parte do GKE Enterprise/Fleet) aplica GitOps em escala: um repo declara o estado de N clusters e o agente sincroniza — o par do ArgoCD para malhas de clusters.</p>'+
LAB('Criando um cluster GKE (opcional — precisa de conta Google)',
'<ol><li>Instale a CLI: <code>winget install Google.CloudSDK</code> (ou <code>choco install gcloud</code>) e rode <code>gcloud auth login</code>.</li>'+
'<li>Crie com Autopilot: os comandos acima (região próxima de você).</li>'+
'<li>Confira: <code>kubectl get nodes</code> — repare que os nodes são gerenciados (a lista mostra os criados pelo Autopilot).</li>'+
'<li>Aplique um Deployment com NetworkPolicy e veja o Dataplane V2 aplicar de verdade.</li>'+
'<li>Explore o console: cluster → Workloads, Services e Gateway.</li></ol>')+
NOTE('Para o .NET, o GKE brilha no "time pequeno que não quer operar nodes": Autopilot + Cloud Trace + Secret Manager via workload identity = observabilidade e segredos sem instalar nada.')+
TERMS([['Autopilot','Modo gerenciado: paga pelo Pod, Google opera os nodes'],['Dataplane V2','eBPF: NetPol + observabilidade de rede nativas'],['GKE Gateway','Gateway API nativo (balanceador global + Cloud Armor)'],['Config Sync','GitOps multi-cluster do Google (Fleet)'],['Workload identity','ServiceAccount → IAM do Google']])+
QUIZ('Você quer GPU e tuning fino de kernel no GKE. Qual modo?',
['Autopilot','Standard (node pools próprios)','Fargate','Nenhum'],1,
'Isso! Autopilot cobre 95% dos casos, mas controle fino (GPU, kernel) exige Standard.')+
QUIZ('No GKE, NetworkPolicy funciona…',
['Só com Calico','Nativamente via Dataplane V2 (sem instalar nada)','Só no EKS','Não funciona'],1,
'Exato! O Dataplane V2 aplica NetPol por padrão — um diferencial do GKE.')},
{id:'m9l4',title:'EKS na prática (AWS)',mins:14,body:
'<p>Na AWS, a forma menos dolorosa é o <code>eksctl</code>:</p>'+
C('bash',`eksctl create cluster --name prod-eks \\
  --region us-east-1 --nodegroup-name ng-app \\
  --node-type m6i.xlarge --nodes 3 --asg-access

# IRSA: role IAM amarrada ao ServiceAccount
eksctl create iamserviceaccount --name minha-api \\
  --namespace prod --cluster prod-eks \\
  --role-name minha-api-sqs \\
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess`)+
'<h2>IRSA vs EKS Pod Identity</h2>'+
'<ul><li><strong>IRSA (IAM Roles for Service Accounts):</strong> você configura o provedor OIDC do cluster e cria uma role IAM com trust policy apontando para o ServiceAccount (anotação <code>eks.amazonaws.com/role-arn</code>). Funciona em qualquer versão; é o mecanismo clássico.</li>'+
'<li><strong>EKS Pod Identity (mais novo):</strong> desacopla roles de service accounts — você cria uma associação simples (pod identity association) e ela vale para o cluster todo, sem trust policies por cluster. Mais simples de escalar para muitos clusters; os dois coexistem.</li></ul>'+
TIP('Ponte didática: a <strong>role IAM é o "crachá"</strong> do serviço — "o que eu posso fazer e o que não posso" na conta AWS. É o análogo do RBAC do Kubernetes (Módulo 8): no cluster você dá permissão ao ServiceAccount; na AWS, à role amarrada nele.')+
C('yaml',`apiVersion: v1
kind: ServiceAccount
metadata:
  name: minha-api
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/minha-api-sqs`)+
'<h2>O ecossistema típico do EKS</h2>'+
'<ul><li><strong>Karpenter:</strong> provisiona o node sob medida para os Pods (instância certa, spot inteligente, em segundos) — o autoscaler de nodes mais agressivo.</li>'+
'<li><strong>AWS Load Balancer Controller:</strong> ALB/NLB para Ingress e Gateway API (o "ingress controller" oficial da AWS).</li>'+
'<li><strong>EFS CSI:</strong> storage RWX compartilhado (para uploads/multi-replica).</li>'+
'<li><strong>VPC CNI:</strong> cada Pod ganha IP da VPC — integração total com security groups (os SG podem filtrar por Pod!).</li></ul>'+
LAB('Criando um cluster EKS (opcional — precisa de conta AWS)',
'<ol><li>Instale o eksctl (winget/choco/brew) e configure credenciais AWS.</li>'+
'<li>Rode o <code>eksctl create cluster</code> acima (uns 15 min — provisiona VPC, control plane e nodegroup).</li>'+
'<li><code>kubectl get nodes</code> e <code>kubectl get svc -n kube-system</code>.</li>'+
'<li>Crie o iamserviceaccount e um Deployment que lê da SQS — as credenciais chegam sozinhas no Pod.</li>'+
'<li>Instale o Karpenter (helm) e veja os nodes nascerem sob demanda.</li></ol>')+
'<p>O .NET consome SQS/S3/Dynamo herdando as credenciais do Pod automaticamente (a SDK da AWS resolve a role pelo metadata do Pod).</p>'+
NOTE('Para o .NET na AWS: <code>AWSSDK.SQS</code>/<code>S3</code>/<code>SecretsManager</code> + KEDA com trigger SQS é o par mais comum de worker no EKS — o Módulo 5 já te deu o padrão.')+
TERMS([['IRSA','Role IAM amarrada ao ServiceAccount via OIDC (anotação role-arn)'],['EKS Pod Identity','Associação simples role ↔ ServiceAccount (sem trust policy por cluster)'],['Karpenter','Nodes sob medida em segundos (spot, instância certa)'],['AWS Load Balancer Controller','ALB/NLB para Ingress e Gateway API'],['EFS CSI','RWX compartilhado (uploads multi-replica)'],['VPC CNI','IP da VPC por Pod (security groups por Pod)']])+
QUIZ('IRSA exige, por cluster:',
['Nada','Configurar o provedor OIDC + trust policy da role','Um node pool especial','O Karpenter'],1,
'Isso! IRSA = OIDC provider + trust policy. O Pod Identity elimina esse passo (associação simples).')+
QUIZ('Para workloads tolerantes a interrupção com o menor custo de nodes no EKS:',
['On-demand fixas','Karpenter com spot','Fargate sempre','RDS'],1,
'Exato! Karpenter + spot = instância certa pelo menor preço, para quem aguenta interrupção.')},
{id:'m9l5',title:'Custos e otimização',mins:12,body:
'<ul><li><strong>Right-size:</strong> VPA em modo <em>recommendation</em> + métricas reais; requests inflados = dinheiro queimado (e no Autopilot isso é literal: você paga pelo request). Ferramentas que automatizam a recomendação: <strong>Goldilocks</strong> e <strong>krr</strong> (analisam o uso sob carga e sugerem requests/limits).</li>'+
'<li><strong>Spot/preemptible:</strong> node pools spot para workloads tolerantes a interrupção (workers, batch) com tolerations — até ~70–90% mais barato.</li>'+
'<li><strong>Cluster Autoscaler/Karpenter:</strong> desliga capacity ocioso automaticamente.</li>'+
'<li><strong>Quotas por namespace + showback:</strong> labels de equipe + ferramentas como <strong>OpenCost/Kubecost</strong> para ratear a conta.</li>'+
'<li><strong>Autoscaling de Pods:</strong> HPA/KEDA reduz réplicas fora do pico (e KEDA zera workers ociosos).</li></ul>'+
'<h2>O método (em ordem de impacto)</h2>'+
'<ol><li><strong>1. Requests corretos</strong> — o maior vazamento: request 4× o uso real = node comprado à toa. VPA em Off/recommendation + 2 semanas de métricas.</li>'+
'<li><strong>2. Autoscaling de Pods</strong> — HPA/KEDA para fora do pico; scale-to-zero em workers de fila.</li>'+
'<li><strong>3. Autoscaling de nodes</strong> — Cluster Autoscaler/Karpenter eliminam nodes ociosos.</li>'+
'<li><strong>4. Spot</strong> — para o que aguenta interrupção (workers, batch, ambientes não-críticos).</li>'+
'<li><strong>5. Mostrar a conta</strong> — OpenCost/Kubecost por namespace/equipe: quem paga o quê (showback).</li></ol>'+
'<h2>As pegadinhas que queimam dinheiro</h2>'+
'<ul><li><strong>KEDA com minReplicaCount: 0</strong> economiza em worker ocioso — mas se o trigger estiver mal configurado, a fila cresce sem réplica (fique de olho no KEDA Operator).</li>'+
'<li><strong>Egress:</strong> tráfego entre regiões/zona e para a internet custa caro nos três. Mantenha app + registry + DB na mesma região.</li>'+
'<li><strong>Disco:</strong> <code>reclaimPolicy: Delete</code> sem snapshot = dados e disco somem; PV órfão retido = disco pago para sempre.</li>'+
'<li><strong>Load balancers:</strong> um Service LoadBalancer por app = um LB pago por app. Consolide com Ingress/Gateway.</li></ul>'+
LAB('Auditoria de custo em 30 minutos',
'<ol><li>Liste requests×limites: <code>kubectl get pods -A -o json | jq \'.items[] | {ns: .metadata.namespace, pod: .metadata.name, requests: .spec.containers[0].resources.requests, limits: .spec.containers[0].resources.limits}\'</code> (ou o dashboard do OpenCost).</li>'+
'<li>Compare com o uso real: <code>kubectl top pods -A</code> (com metrics-server) — request vs uso.</li>'+
'<li>Identifique Services LoadBalancer sem Ingress: <code>kubectl get svc -A | grep LoadBalancer</code>.</li>'+
'<li>Identifique PVs Retained órfãos: <code>kubectl get pv | grep Released</code>.</li>'+
'<li>Instale o OpenCost: <code>helm upgrade --install opencost opencost/opencost --repo https://opencost.github.io/opencost-helm-chart</code> e veja o custo por namespace/equipe.</li></ol>')+
WARN('A pegadinha clássica de custo: requests muito maiores que o uso real + HPA sem Cluster Autoscaler = Pods "Pending" em cluster cheio. Autoscaling de Pods e de nodes precisam evoluir juntos.')+
TERMS([['Right-sizing','Requests baseados em uso real (VPA recommendation)'],['Spot','Nodes interrompíveis até ~90% mais baratos'],['Showback','Custo rateado por namespace/equipe (OpenCost)'],['Egress','Tráfego de saída — mantenha tudo na mesma região'],['LB por app','Consolide com Ingress/Gateway (1 LB = $ por app)']])+
QUIZ('O maior vazamento de custo em Kubernetes é…',
['O disco','Requests inflados vs uso real','O egress de logs','O control plane'],1,
'Isso! Request 4× o uso = node comprado à toa. Meça, calibre, repita.')+
QUIZ('No GKE Autopilot, você paga pelo request do Pod. Qual prática vira lei?',
['Aumentar requests para garantir','Right-sizing (request = pico real) — request alto = preço alto','Ignorar requests','Usar limits enormes'],1,
'Exato! No Autopilot o custo é direto: request inflado é literalmente dinheiro no lixo.')}
]};
