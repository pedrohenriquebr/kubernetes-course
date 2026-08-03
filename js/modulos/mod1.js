/* Módulo 01 — Kubernetes para Devs .NET */
const MOD1 = {id:'m1',num:'01',title:'Fundamentos: do Container ao Kubernetes',level:'ini',lessons:[
{id:'m1l1',title:'O que são containers?',mins:14,body:
'<p>Um <strong>container</strong> é um processo isolado que carrega consigo <em>tudo que precisa para rodar</em>: binários, bibliotecas, arquivos de configuração e dependências. O isolamento é feito por recursos do kernel Linux (<em>namespaces</em> para visão isolada de sistema e <em>cgroups</em> para limites de CPU/memória — detalhe no final deste módulo).</p>'+
'<ul><li><strong>Imagem</strong> = o "molde" imutável (camadas de filesystem empilhadas).</li>'+
'<li><strong>Container</strong> = a imagem <em>rodando</em> (instância da imagem).</li>'+
'<li><strong>Registry</strong> = onde as imagens moram (Docker Hub, ACR, GAR, ECR, GHCR).</li></ul>'+
'<h2>O Dockerfile multi-stage, na prática .NET</h2>'+
'<p>A imagem de uma API ASP.NET Core nasce de um <strong>Dockerfile multi-stage</strong>: uma fase compila com o SDK, outra empacota só o runtime — imagem pequena e segura:</p>'+
C('docker',`# Dockerfile de uma API ASP.NET Core 8
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
USER 1000                      # nunca rodar como root
EXPOSE 8080
ENTRYPOINT ["dotnet", "MinhaApi.dll"]`)+
'<p>Três detalhes que valem ouro:</p>'+
'<ul><li><strong><code>COPY . .</code> antes do restore:</strong> cada linha do Dockerfile vira uma camada com cache. Copie só o <code>*.csproj</code> antes do restore para o cache de dependências sobreviver entre builds — o build fica 10–20× mais rápido no CI.</li>'+
'<li><strong><code>.dockerignore</code>:</strong> exclua <code>bin/</code>, <code>obj/</code>, <code>.git/</code> — senão o contexto do build fica gigante e o cache quebra à toa.</li>'+
'<li><strong><code>USER 1000</code>:</strong> a imagem final da Microsoft já cria o usuário <code>app</code> (UID 1654); rodar como root é a causa nº1 de falha em políticas de segurança (Módulo 8).</li></ul>'+
C('docker',`# .dockerignore
bin/
obj/
.git/
*.user
.vs/`)+
'<h2>Imagens e o pull nos nodes</h2>'+
'<p>Quando você aplica um Deployment, cada node que receber o Pod precisa <strong>baixar a imagem</strong> (pull). Imagem pequena = pull rápido = Pod sobe rápido = rollout rápido. Por isso o multi-stage importa tanto em Kubernetes: o tamanho da imagem afeta diretamente a velocidade de escala e de recuperação.</p>'+
C('bash',`docker build -t meuregistry/minha-api:1.0.0 .
docker run -p 8080:8080 meuregistry/minha-api:1.0.0
docker history meuregistry/minha-api:1.0.0   # veja as camadas da imagem
docker image ls --format '{{.Repository}}:{{.Tag}} {{.Size}}'`)+
TIP('Regra de ouro do container: ele <strong>vive enquanto o processo principal vive</strong>. Se o CMD/ENTRYPOINT termina — ou roda em background e "entrega" o terminal — o container morre na hora. É por isso que o <code>ENTRYPOINT ["dotnet", "MinhaApi.dll"]</code> roda em foreground, e que o Dockerfile clássico do nginx usa <code>daemon off</code> no CMD.')+
LAB('Build e inspeção da sua primeira imagem',
'<ol><li>Monte um projeto ASP.NET Core mínimo (<code>dotnet new web -n MinhaApi</code>) e crie o Dockerfile acima.</li>'+
'<li>Build: <code>docker build -t minha-api:1.0.0 .</code></li>'+
'<li>Inspecione: <code>docker history minha-api:1.0.0</code> — repare nas camadas <code>FROM aspnet</code> e no <code>COPY --from=build</code>.</li>'+
'<li>Rode <code>docker run -d -p 8080:8080 --name api1 minha-api:1.0.0</code> e acesse <code>http://localhost:8080</code>.</li>'+
'<li>Compare o tamanho: <code>docker image ls</code> — a imagem final deve ter ~200 MB contra >800 MB da fase SDK.</li></ol>')+
TIP('Sempre tagueie com versão imutável (SHA do git ou semver): <code>minha-api:1.0.0</code>, nunca <code>minha-api:latest</code> em produção — <code>latest</code> quebra o rastreamento de rollout (Módulo 6).')+
NOTE('A imagem <code>mcr.microsoft.com/dotnet/aspnet:8.0</code> já roda como usuário não-root e sem SDK/source — menos superfície de ataque e pull mais rápido nos nodes. Esses dois critérios (tamanho + não-root) são os que mais aparecem em auditorias de Kubernetes.')+
TERMS([['Imagem','Molde imutável em camadas — o que você versiona e distribui'],['Container','Processo isolado executando uma imagem'],['Registry','Repositório de imagens (Docker Hub, ACR, GAR, ECR, GHCR)'],['Multi-stage','Dockerfile com fases: build (SDK) → runtime (só binários)'],['Camada','Unidade do filesystem da imagem; COPY/RUN criam camadas']])+
QUIZ('Por que o Dockerfile multi-stage deixa o deploy no Kubernetes mais rápido?',
['Porque o SDK compila mais rápido na segunda fase','Porque a imagem final é menor → pull nos nodes é mais rápido','Porque o runtime usa menos portas','Porque o Kubernetes exige exatamente 2 fases'],1,
'Isso! Imagem pequena = pull rápido = Pod sobe mais rápido — velocidade de rollout e de recuperação dependem disso.')+
QUIZ('O que acontece se você rodar um container como root em produção?',
['Nada — é o padrão recomendado','Políticas de segurança (PSA, seccomp) podem rejeitar o Pod, e um processo comprometido vira root no host','O container não sobe','O Kubernetes muda o usuário automaticamente'],1,
'Exato! Não-root é pré-requisito para o nível "restricted" do Pod Security (Módulo 8) e reduz o impacto de um escape de container.')},
{id:'m1l2',title:'Containers vs Máquinas Virtuais',mins:9,body:
'<table class="tbl"><tr><th></th><th>Máquina Virtual</th><th>Container</th></tr>'+
'<tr><td>Isolamento</td><td>Hardware (hipervisor)</td><td>SO (namespaces/cgroups)</td></tr>'+
'<tr><td>Sistema operacional</td><td>Um SO completo <em>por</em> VM</td><td>Compartilha o kernel do host</td></tr>'+
'<tr><td>Tamanho</td><td>GBs</td><td>MBs</td></tr>'+
'<tr><td>Boot</td><td>Minutos</td><td>Milissegundos/segundos</td></tr>'+
'<tr><td>Densidade</td><td>Poucas por host</td><td>Dezenas/centenas por host</td></tr>'+
'<tr><td>Fronteira de segurança</td><td>Hipervisor (kernel isolado)</td><td>Kernel compartilhado (isolação de processos)</td></tr></table>'+
'<p>É exatamente essa leveza que torna o Kubernetes possível: criar e destruir instâncias em segundos, reagindo a falhas e picos. Uma VM leva minutos para subir — tarde demais para self-healing.</p>'+
'<p>Curiosidade: nos clouds, os <em>worker nodes</em> do Kubernetes <strong>são</strong> VMs — containers rodam <em>dentro</em> de VMs. Os modelos se complementam: a VM isola o node; o container isola o app.</p>'+
'<h2>E as microVMs?</h2>'+
'<p>Existe um meio-termo: <strong>microVMs</strong> (Firecracker da AWS, Cloud Hypervisor) — VMs minúsculas que sobem em ~100ms, com o isolamento de hardware de uma VM e a densidade de um container. É a tecnologia por trás do <strong>Fargate</strong> (EKS) e do <strong>ACI</strong>/Virtual Nodes (AKS): quando você usa "serverless containers", seu Pod está, na real, dentro de uma microVM.</p>'+
'<table class="tbl"><tr><th>Modelo</th><th>Isolamento</th><th>Boot</th><th>Onde você encontra</th></tr>'+
'<tr><td>Container (núcleo do K8s)</td><td>namespaces/cgroups</td><td>ms</td><td>Pod comum em qualquer cluster</td></tr>'+
'<tr><td>MicroVM</td><td>Hipervisor leve</td><td>~100ms</td><td>Fargate, ACI/Virtual Nodes, kata-containers</td></tr>'+
'<tr><td>VM tradicional</td><td>Hipervisor</td><td>minutos</td><td>Os próprios nodes do cluster</td></tr></table>'+
TIP('Para o dia a dia como dev, o modelo não muda: você continua escrevendo containers. MicroVMs são um detalhe de isolamento que o provider decide por você — saber que existem explica o preço e a latência do modo serverless.')+
QUIZ('Nos clouds gerenciados (AKS/GKE/EKS), os worker nodes são…',
['Containers rodando direto no host físico','VMs (e os Pods rodam dentro delas)','MicroVMs sempre','Ambientes sem kernel'],1,
'Isso! O provider gerencia VMs como nodes; containers rodam dentro delas. E no modo serverless, cada Pod vira uma microVM.')},
{id:'m1l3',title:'Por que Kubernetes existe?',mins:11,body:
'<p>Imagine que sua API .NET viralizou. Com Docker "na mão" você precisa responder: em quantas máquinas rodo? Como distribuo as cópias? Como o load balancer descobre quem está vivo? Como faço deploy sem downtime? Como volto uma versão quebrada? <strong>Kubernetes é a resposta padronizada para essas perguntas.</strong></p>'+
'<ul><li><strong>Orquestração:</strong> decide onde cada container roda e redistribui a carga.</li>'+
'<li><strong>Self-healing:</strong> container morreu? Sobe outro. Node morreu? Reagenda os Pods.</li>'+
'<li><strong>Scaling:</strong> réplicas sobem e descem por métricas (CPU, fila, HTTP).</li>'+
'<li><strong>Rollouts seguros:</strong> atualizações graduais com rollback automático.</li>'+
'<li><strong>Service discovery + DNS:</strong> serviços se encontram pelo nome.</li>'+
'<li><strong>Secrets e config:</strong> configuração fora da imagem, por ambiente.</li></ul>'+
'<h2>Histórico (rápido, mas importante)</h2>'+
'<p>Nasceu no Google em 2014 (inspirado no <em>Borg</em>, orquestrador interno usado no Google por mais de uma década), foi doado à <strong>CNCF</strong> em 2016 e virou o padrão da indústria — por isso todos os grandes clouds oferecem "Kubernetes gerenciado". A CNCF hoje abriga o ecossistema inteiro: Prometheus, Helm, ArgoCD, KEDA, OpenTelemetry, containerd — todos projetos que você vai usar neste curso.</p>'+
'<h2>Quando NÃO usar Kubernetes (o contraponto honesto)</h2>'+
'<p>Nem todo projeto precisa de cluster. Seja honesto antes de adotar:</p>'+
'<ul><li><strong>Uma API só + banco, sem escala:</strong> um container em uma VM (ou um App Service/Fly.io) resolve com 10% do esforço.</li>'+
'<li><strong>Time pequeno sem operação:</strong> cluster é infraestrutura para operar — sem ninguém para cuidar, ele vira custo e dívida.</li>'+
'<li><strong>Workloads stateful sensíveis a localidade:</strong> se o seu banco precisa estar "perto" e você não quer operar StatefulSets, um banco gerenciado é mais simples.</li></ul>'+
'<p>O Kubernetes paga o investimento quando você tem <strong>múltiplos serviços</strong>, <strong>escala elástica</strong>, <strong>deploys frequentes</strong> e <strong>times maiores</strong> — ou quando o seu cloud oferece ele gerenciado (AKS/GKE/EKS) e o custo marginal de usar vira baixo.</p>'+
CLOUD('Azure → <strong>AKS</strong>, Google → <strong>GKE</strong>, AWS → <strong>EKS</strong>. O núcleo (API, objetos, kubectl) é o mesmo projeto open source; o que muda é o "recheio" de integrações de cada nuvem (Módulo 9).')+
TERMS([['CNCF','Fundação que mantém o Kubernetes e o ecossistema nativo de cloud'],['Orquestração','Decidir onde rodar, escalar e recuperar workloads'],['Self-healing','Correção automática de falhas por reconciliação'],['Managed Kubernetes','Control Plane operado pelo provider (AKS/GKE/EKS)']])+
QUIZ('Qual cenário NÃO justifica adotar Kubernetes?',
['Uma startup com 4 microsserviços e deploys diários','Uma API única com 5 usuários que roda há 3 anos sem mudar','Um time que quer escalar workers por fila','Uma plataforma com vários times e ambientes'],1,
'Exato! Kubernetes resolve problemas de escala, frequência de deploy e operação — para uma API pequena e estável, é custo sem retorno.')},
{id:'m1l4',title:'Arquitetura: Control Plane e Nodes',mins:16,body:
'<p>Um cluster Kubernetes é dividido em dois "mundos": o <strong>Control Plane</strong> (o cérebro) e os <strong>Worker Nodes</strong> (os músculos, onde seus containers rodam).</p>'+
ARCH_SVG+
'<div class="figcap">Arquitetura de um cluster: Control Plane (decisão) × Worker Nodes (execução)</div>'+
'<h3>Control Plane</h3>'+
'<ul><li><strong>kube-apiserver:</strong> a única porta de entrada. Tudo (kubectl, controllers, kubelets) fala com a API REST. Autenticação, autorização e validação acontecem aqui.</li>'+
'<li><strong>etcd:</strong> banco chave-valor distribuído e consistente. <em>Todo o estado do cluster</em> vive aqui. Se o etcd corrompe, o cluster "esquece" de si mesmo.</li>'+
'<li><strong>kube-scheduler:</strong> observa Pods novos sem node atribuído e escolhe o node ideal (recursos livres, afinidades, taints, políticas).</li>'+
'<li><strong>kube-controller-manager:</strong> roda os <em>controllers</em> (Node, Job, EndpointSlice, ServiceAccount…) em loops infinitos de reconciliação.</li>'+
'<li><strong>cloud-controller-manager:</strong> (em clouds) integra com a API do provider: cria Load Balancers, gerencia rotas e o ciclo de vida de nodes.</li></ul>'+
'<h3>Worker Nodes</h3>'+
'<ul><li><strong>kubelet:</strong> o "agente" do node; garante que os containers descritos nos Pods estejam rodando e reporta status ao Control Plane.</li>'+
'<li><strong>kube-proxy:</strong> mantém regras de rede (iptables/IPVS) que implementam os Services.</li>'+
'<li><strong>container runtime:</strong> executa os containers (containerd e CRI-O são os mais comuns).</li></ul>'+
'<h2>O fluxo de uma requisição (a chave para entender TUDO)</h2>'+
'<ol><li><strong><code>kubectl apply -f deployment.yaml</code></strong> → o kubectl envia o YAML via HTTPS para o API Server (porta <strong>6443</strong>).</li>'+
'<li><strong>API Server</strong> autentica (quem é você?), autoriza (RBAC — você pode criar Deployment?) e valida (o YAML é válido?).</li>'+
'<li>O objeto é <strong>persistido no etcd</strong> (porta 2379) — o estado desejado agora é um fato.</li>'+
'<li><strong>kube-scheduler</strong> percebe um Pod novo sem node e escolhe o melhor node (recursos, afinidades).</li>'+
'<li>O API Server entrega a ordem ao <strong>kubelet</strong> do node escolhido (porta 10250, HTTPS).</li>'+
'<li>O kubelet pede ao <strong>container runtime</strong> (containerd) para baixar a imagem e criar os containers.</li>'+
'<li>O kubelet reporta status de volta; os controllers do Control Plane observam e <strong>reconciliam</strong>.</li></ol>'+
'<p>Repare: <strong>tudo passa pelo API Server</strong>. O etcd só conversa com ele. Os controllers nunca falam com os kubelets diretamente — tudo via API. É essa centralização que permite auditoria, RBAC e admission control em um único ponto.</p>'+
'<h2>Alta disponibilidade do Control Plane</h2>'+
'<p>Em produção, o Control Plane roda em <strong>3+ máquinas</strong> (stacked etcd ou external etcd). O etcd usa o algoritmo <strong>Raft</strong>: para escrever, precisa do consenso de maioria (quórum) — 3 réplicas toleram 1 falha; 5 toleram 2. É por isso que "derrubar 2 de 3 control planes" trava o cluster: sem quórum, o etcd recusa escrita. Nos clouds gerenciados, isso é invisível para você — o provider opera.</p>'+
LAB('Verificando o cluster por dentro',
'<ol><li><code>kubectl cluster-info</code> — mostra a URL do API Server.</li>'+
'<li><code>kubectl get --raw=/readyz</code> — responde <code>ok</code> (health do API Server).</li>'+
'<li><code>kubectl get pods -n kube-system -o wide</code> — veja onde cada componente roda (no kind: Control Plane tudo em 1 node).</li>'+
'<li><code>kubectl get --raw=/api/v1</code> — a lista de recursos da API (group/version).</li>'+
'<li>Desafio: <code>kubectl explain pod.spec.containers</code> — use a documentação embutida para descobrir o campo <code>imagePullPolicy</code>.</li></ol>')+
DEEP('Existe uma exceção ao "tudo passa pela API": os <strong>Static Pods</strong> — Pods declarados em arquivos no diretório do kubelet (<code>/etc/kubernetes/manifests</code>). O kubelet os cria direto, sem o API Server; é assim que os componentes do Control Plane (etcd, kube-apiserver…) rodam em clusters kubeadm. Se um dia você vir um Pod "sem dono" com nome terminando no hostname do node, é um static pod.')+
TIP('Quando um <code>kubectl apply</code> falha com erro de validação, o problema é quase sempre na etapa 3 (schema) ou 2 (RBAC). O <code>kubectl explain</code> resolve a etapa 3; o <code>kubectl auth can-i</code> resolve a 2 (Módulo 8).')+
NOTE('Como dev, você quase nunca toca no Control Plane — em clusters gerenciados (AKS/GKE/EKS) ele é operado pelo provider. Mas entender o fluxo <em>kubectl → API Server → etcd → scheduler → kubelet</em> explica 90% dos comportamentos que você verá no <code>kubectl describe</code>.')+
TERMS([['API Server','Porta 6443: única entrada; autentica, autoriza, valida e persiste'],['etcd','Banco chave-valor (Raft, quórum) com todo o estado do cluster'],['kube-scheduler','Escolhe o node para cada Pod novo'],['kubelet','Agente do node: garante que os containers dos Pods rodem'],['kube-proxy','Regras de rede (iptables/IPVS) que implementam Services'],['Quórum','Maioria do etcd para aceitar escrita — 3 nós toleram 1 falha']])+
QUIZ('Você derrubou 2 dos 3 nodes do Control Plane. O que acontece com as escritas?',
['Nada — o cluster continua normal','O etcd perde o quórum e recusa escritas (o cluster fica somente leitura/frágil)','O terceiro node assume sozinho e vira líder vitalício','Os workers promovem um novo Control Plane automaticamente'],1,
'Isso! Sem quórum (maioria), o etcd recusa escritas para evitar estados divergentes. É por isso que produção usa 3+ control planes.')+
QUIZ('Qual componente conversa diretamente com o etcd?',
['O kubelet','O kube-proxy','Somente o API Server','O kubectl'],2,
'Exato! O etcd só fala com o API Server — tudo no cluster passa por ele.')},
{id:'m1l5',title:'O modelo declarativo e os controllers',mins:15,body:
'<p>Aqui está a chave mental do Kubernetes: você <strong>não executa ações</strong>, você <strong>declara o estado desejado</strong> em YAML e aplica contra a API. A partir daí, os <em>controllers</em> trabalham em loop (<strong>reconciliation loop</strong>) comparando <em>estado atual</em> com <em>estado desejado</em> e agem para aproximá-los.</p>'+
TIP('Analogia que ajuda: o manifest é um <strong>pedido de café</strong> — você descreve o resultado ("latte, aveia, sem tampa") e o barista (o cluster) decide COMO fazer. Você nunca diz "aqueça o leite a 65° e despeje em espiral": você declara o quê, não o como.')+
C('bash',`# Imperativo (evite no dia a dia):
kubectl create deployment web --image=nginx

# Declarativo (o jeito Kubernetes):
kubectl apply -f deployment.yaml
# "Eu desejo 3 réplicas da imagem X com estes recursos."
# Se alguém deletar um Pod, o controller cria outro.
# Se você mudar replicas para 5, ele escala. Etc.`)+
'<h2>apply vs create vs patch: a família dos mutadores</h2>'+
'<table class="tbl"><tr><th>Comando</th><th>O que faz</th><th>Para quê</th></tr>'+
'<tr><td><code>kubectl apply</code></td><td>Cria ou <strong>faz merge</strong> com o que já existe</td><td>O padrão do dia a dia — idempotente, GitOps-friendly</td></tr>'+
'<tr><td><code>kubectl create</code></td><td>Cria; <strong>falha se já existe</strong></td><td>Recursos pontuais (ex.: secret via CLI)</td></tr>'+
'<tr><td><code>kubectl replace</code></td><td>Substitui o objeto inteiro</td><td>Raro — quebra campos que o controller gerencia</td></tr>'+
'<tr><td><code>kubectl patch</code></td><td>Altera campos específicos (strategic/merge/json)</td><td>Mudança rápida sem editar o YAML completo</td></tr></table>'+
'<h2>Server-side apply: como o apply "sabe" o que é seu</h2>'+
'<p>Desde o Kubernetes 1.22+, o <code>apply</code> usa <strong>server-side apply (SSA)</strong>: o objeto guarda <code>managedFields</code> — a memória de "quem (qual campo) foi definido por qual agente" (o kubectl, um Helm, um controller). Isso permite que <strong>vários agentes coexistam</strong> editando campos diferentes do mesmo objeto sem pisar uns nos outros, e resolve o clássico <strong>3-way merge</strong>: estado anterior + meu YAML + estado atual → o que foi apagado do meu YAML é removido do cluster.</p>'+
C('bash',`# Veja quem gerencia o quê no objeto:
kubectl get deploy minha-api -o yaml | grep -A5 managedFields

# Patch cirúrgico (sem tocar no resto):
kubectl patch deploy minha-api -p '{"spec":{"replicas":5}}'

# Editar o objeto ao vivo (cuidado — é imperativo):
kubectl edit deploy minha-api`)+
'<h2>Consequências práticas do modelo</h2>'+
'<ul><li><strong>Self-healing de graça:</strong> delete um Pod de um Deployment e observe outro nascer (<code>kubectl get pods -w</code>).</li>'+
'<li><strong>Seus YAMLs são o source of truth</strong> — devem viver no Git (base do GitOps, Módulo 6).</li>'+
'<li><strong>Idempotência:</strong> rodar <code>apply</code> várias vezes não duplica nada; só converge.</li>'+
'<li><strong>Nunca edite objetos "na mão"</strong> (kubectl edit/scale em produção) se eles forem gerenciados por YAML: a próxima aplicação do seu YAML apaga a mudança — ou pior, gera conflito de managedFields.</li></ul>'+
LAB('Drift e reconciliação na prática',
'<ol><li>Crie um Deployment simples: <code>kubectl apply -f deployment.yaml</code> (replicas: 3).</li>'+
'<li>Deletar um Pod e observar o reparo: <code>kubectl get pods -w</code> e, em outro terminal, <code>kubectl delete pod &lt;pod&gt;</code>. Veja um novo Pod nascer sozinho.</li>'+
'<li>Causar drift: <code>kubectl scale deploy/minha-api --replicas=5</code> (imperativo). Depois rode <code>kubectl apply -f deployment.yaml</code> (replicas: 3) — o cluster volta para 3. O YAML sempre vence.</li>'+
'<li>Confira o managedFields: <code>kubectl get deploy minha-api -o yaml | grep -A3 -B3 manager:</code> — você verá os agentes kubectl e o controller.</li></ol>')+
QUIZ('Você aplicou um Deployment com replicas: 3. Um node inteiro cai, levando 1 Pod junto. O que acontece?',
['Nada — o Deployment fica com 2 réplicas até você intervir.','O controller do Deployment cria um Pod substituto e o scheduler o agenda em outro node saudável.','O cluster inteiro reinicia para recuperar o estado.','O etcd restaura o container morto no mesmo node.'],1,
'Correto! O controller percebe atual(2) ≠ desejado(3) e o scheduler agenda um Pod novo em node saudável. Self-healing por reconciliação.')+
QUIZ('Qual componente guarda o estado do cluster?',
['kube-proxy','kubelet','etcd','container runtime'],2,
'Isso! O etcd é o banco distribuído que persiste todo o estado do cluster.')+
QUIZ('Alguém rodou kubectl scale --replicas=5 no seu Deployment (YAML diz 3). Você roda kubectl apply -f deployment.yaml. O que acontece?',
['Fica 5 — o scale vence','Volta para 3 — o YAML declarado é o estado desejado','O apply falha com conflito','O cluster entra em erro'],1,
'Exato! O estado desejado é o YAML. Qualquer drift é revertido na próxima aplicação — essa é a base do GitOps.')+
DOC('Este módulo cobre as seções <em>Overview</em> e <em>Cluster Architecture</em> da documentação oficial (kubernetes.io/docs/concepts).')},
{id:'m1l6',title:'Containers por dentro: namespaces, cgroups e overlayfs',mins:15,body:
'<p>Para operar Kubernetes com confiança, você precisa saber <em>o que um container realmente é</em> por baixo do capô. Nada aqui é teórico: cada mecanismo vira um comportamento que você vai ver no cluster (crash, OOM, CPU throttling, imagem gigante).</p>'+
'<h2>Namespaces: a ilusão de isolamento</h2>'+
'<p>Um container é um processo comum do host, mas dentro de <strong>namespaces</strong> Linux — cópias isoladas de "visões" do sistema. Cada namespace esconde uma coisa:</p>'+
'<table class="tbl"><tr><th>Namespace</th><th>O que isola</th><th>O que o processo "vê"</th></tr>'+
'<tr><td><code>PID</code></td><td>Processos</td><td>Só os processos do container (PID 1 = seu app)</td></tr>'+
'<tr><td><code>NET</code></td><td>Rede</td><td>Própria interface, IP e roteamento</td></tr>'+
'<tr><td><code>MNT</code></td><td>Filesystem</td><td>Só as camadas da imagem montadas</td></tr>'+
'<tr><td><code>UTS</code></td><td>Hostname</td><td>Hostname próprio</td></tr>'+
'<tr><td><code>IPC</code></td><td>Fila de mensagens</td><td>Só a própria</td></tr>'+
'<tr><td><code>USER</code></td><td>UIDs</td><td>UID 1000 dentro ≠ UID 1000 no host</td></tr></table>'+
'<h2>cgroups: o teto do consumo</h2>'+
'<p>Namespaces <em>escondem</em>; cgroups <em>limitam</em>. O <strong>cgroup v2</strong> do container define os limites de CPU (<code>cpu.max</code>), memória (<code>memory.max</code>) e I/O. Quando o processo estoura o limite de CPU, ele é <strong>estrangulado (throttled)</strong>; quando estoura memória, o kernel mata o processo (<strong>OOM kill</strong>) — é exatamente o <code>OOMKilled</code> que você vai ver no <code>kubectl describe pod</code>.</p>'+
C('bash',`# Inspecionar um container em execução (Linux):
docker run -d --name api1 --memory=256m --cpus=1 minha-api:1.0.0
docker inspect api1 --format '{{.State.Pid}}'    # PID no host

# Ver os namespaces do processo (precisa de root no host):
ls -la /proc/<PID>/ns/        # ns/pid, ns/net, ns/mnt... cada um um inode
cat /sys/fs/cgroup/<caminho-do-cgroup>/memory.max   # limite de memória

# Executar "dentro" do namespace do container (Linux):
nsenter -t <PID> -a -- ps aux`)+
'<h2>overlayfs: imagens em camadas</h2>'+
'<p>A imagem é um empilhamento de camadas <strong>somente-leitura</strong>; o container ganha uma camada <strong>read-write</strong> por cima (copy-on-write). Por isso: dois containers da MESMA imagem compartilham as camadas de leitura (economia de disco e pull), e cada container tem seu próprio espaço de escrita — que <strong>morre com o Pod</strong> (aí entra o storage do Módulo 3).</p>'+
C('bash',`docker history minha-api:1.0.0        # as camadas da imagem
docker inspect minha-api:1.0.0 --format '{{json .RootFS.Layers}}'  # hashes das camadas
du -sh /var/lib/docker/overlay2/ 2>/dev/null  # espaço usado (Linux)`)+
DEEP('O <em>pause container</em> do Kubernetes (visto na próxima lição) existe para segurar os namespaces do Pod: quando você cria um Pod, o runtime sobe primeiro um container <code>pause</code> que "segura" o network namespace, e os containers do app entram nesse mesmo namespace. É por isso que containers do mesmo Pod enxergam <code>localhost</code> entre si.')+
LAB('Vendo os containers por dentro',
'<ol><li>Rode um container simples: <code>docker run -d --name lab1 --memory=128m --cpus=0.5 alpine sleep 300</code>.</li>'+
'<li>Descubra o PID no host: <code>docker inspect lab1 --format \'{{.State.Pid}}\'</code>.</li>'+
'<li>(Linux) Liste os namespaces: <code>ls -la /proc/&lt;PID&gt;/ns/</code> e compare com os do seu shell.</li>'+
'<li>(Linux) Confira o limite: <code>cat /sys/fs/cgroup/&lt;cgroup-do-container&gt;/memory.max</code> → deve refletir os 128m.</li>'+
'<li>Observe as camadas: <code>docker history alpine</code> (poucas camadas) vs <code>docker history minha-api:1.0.0</code> (muitas — SDK + runtime).</li></ol>')+
NOTE('O <strong>GC do .NET</strong> lê os limites do cgroup automaticamente (server GC): se o container tem <code>memory: 256Mi</code>, o runtime dimensiona os heaps para caber — mas um limite muito apertado ainda pode gerar OOMKill em picos. Meça o working set (Módulo 7) antes de definir requests/limits (Módulo 5).')+
TERMS([['Namespaces','Isolam visões do kernel (PID, NET, MNT, UTS, IPC, USER)'],['cgroups','Limitam consumo (CPU, memória, I/O) por grupo de processos'],['Overlayfs','Camadas RO da imagem + camada RW do container (copy-on-write)'],['OOM kill','Kernel mata o processo que estourou memory.max → OOMKilled'],['Throttling','CPU limitada = processo estrangulado, não morto'],['Pause container','Segura os namespaces do Pod (localhost entre containers)']])+
QUIZ('Um Pod morre com status OOMKilled. O que aconteceu?',
['A CPU foi estrangulada','O processo estourou o limite de memória do cgroup e o kernel o matou','O disco encheu','A imagem não existe'],1,
'Isso! OOM = Out Of Memory: o kernel matou o processo que passou de memory.max. CPU em excesso só throttla (fica lento), não mata.')+
QUIZ('Dois containers da mesma imagem no mesmo host compartilham…',
['A camada read-write','As camadas somente-leitura da imagem','O namespace PID','O mesmo IP'],1,
'Exato! As camadas RO são compartilhadas (economia de disco/pull); a camada RW e os namespaces são por container.')}
]};
