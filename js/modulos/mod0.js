/* Módulo 00 — Kubernetes para Devs .NET */
const MOD0 = {id:'m0',num:'00',title:'Boas-vindas & Ambiente',level:'ini',lessons:[
{id:'m0l1',title:'Como usar este curso',mins:8,body:
'<p>Bem-vindo(a)! Este curso leva você <strong>do zero ao nível avançado</strong> em Kubernetes com o olhar de quem <strong>desenvolve software</strong>. Os conceitos são ensinados de forma <em>agnóstica de provider</em>: tudo que você aprender funciona no AKS (Azure), GKE (Google) e EKS (AWS); as diferenças entre eles são tratadas no Módulo 9.</p>'+
'<h2>A jornada — o mapa completo</h2>'+
'<p>O curso tem <strong>11 módulos</strong> em quatro níveis. Guarde este mapa: cada módulo responde a uma pergunta que o desenvolvedor faz na vida real.</p>'+
'<table class="tbl"><tr><th>Nível</th><th>Módulos</th><th>A pergunta que ele responde</th></tr>'+
'<tr><td>Iniciante</td><td>0–2</td><td>"O que é isso e como eu subo minha API nele?" — ambiente, arquitetura, modelo declarativo e TODOS os workloads.</td></tr>'+
'<tr><td>Intermediário</td><td>3–5</td><td>"Como configuro, conecto e torno resiliente?" — ConfigMaps/Secrets, storage, rede profunda, probes, autoscaling, eviction e scheduling.</td></tr>'+
'<tr><td>Intermediário+</td><td>6–8</td><td>"Como produzo isso de verdade?" — Helm, CI/CD, GitOps, observabilidade, RBAC, segurança e supply chain.</td></tr>'+
'<tr><td>Avançado</td><td>9–10</td><td>"Como os clouds gerenciam e como eu vou além?" — AKS×GKE×EKS a fundo, upgrades, CRDs/Operators e projeto final.</td></tr></table>'+
'<h2>Como estudar (o método)</h2>'+
'<ol><li><strong>Leia na ordem.</strong> Cada lição assume a anterior — pular quebra a base.</li>'+
'<li><strong>Execute TUDO.</strong> Quase toda lição tem um laboratório <em><span class="mi" aria-hidden="true">science</span> Mão na massa</em> com comandos para rodar no seu cluster local. Kubernetes só faz sentido com um cluster na frente (Módulo 0, lição 2). Se algo não rodar, <strong>não avance</strong>: investigue antes de seguir.</li>'+
'<li><strong>Responda os quick checks</strong> ao final das lições — eles testam decisão, não decoreba.</li>'+
'<li><strong>Use a busca</strong> (<kbd style="font-family:var(--mono)">Ctrl K</kbd>) para revisar qualquer conceito a qualquer momento.</li>'+
'<li><strong>Revise os Termos-chave</strong> (<span class="mi" aria-hidden="true">push_pin</span>) de cada lição antes de começar a próxima — eles são o "resumo executivo".</li></ol>'+
'<h2>As caixas que você vai encontrar</h2>'+
NOTE('ponte direta entre o conceito agnóstico e o ecossistema .NET (ASP.NET Core, Workers, Azure.Identity, OpenTelemetry, GC do .NET...).')+
CLOUD('como o conceito se materializa em AKS, GKE e EKS — e o que muda entre eles.')+
DOC('a seção correspondente da documentação oficial do Kubernetes, usada como fonte primária de validação de todo o conteúdo.')+
TIP('Não decore YAML. Decore <em>o modelo mental</em>: estado desejado + reconciliação + API declarativa. O YAML você sempre consulta com <code>kubectl explain</code> na hora.')+
TERMS([['Estado desejado','O que você declara no YAML — o cluster trabalha para chegar lá'],['Reconciliação','Loop que compara estado atual × desejado e age para aproximá-los'],['Declarativo','Você diz O QUÊ (3 réplicas), nunca COMO (rode este script)'],['Provider-agnóstico','Conceitos idênticos em qualquer cluster; integrações específicas só no Módulo 9']])+
QUIZ('Qual destes NÃO combina com o modelo do Kubernetes?',
['Declarar estado desejado em YAML','Rodar scripts imperativos de configuração a cada deploy','Deixar controllers corrigirem o estado','Usar a API REST como porta de entrada'],1,
'Exato! O Kubernetes é declarativo: você descreve o resultado e o cluster descobre o "como". Scripts imperativos são o modelo antigo (e frágil).')},
{id:'m0l2',title:'Preparando o ambiente local',mins:20,body:
'<p>Você precisa de três ferramentas: <strong>Docker</strong> (para buildar imagens), <strong>kubectl</strong> (o cliente do Kubernetes) e um <strong>cluster local</strong>. Para desenvolvedores, o <code>kind</code> (Kubernetes in Docker) é a opção mais leve — a mesma abordagem usada no curso do DevOps Directive.</p>'+
'<h2>1. Docker Desktop (Windows/macOS)</h2>'+
'<p>No Windows, o Docker Desktop roda sobre o <strong>WSL2</strong> — um kernel Linux de verdade. Isso importa porque containers <em>são</em> processos Linux: o kind só funciona com o backend WSL2 habilitado.</p>'+
C('powershell',`# Windows — instalação via winget (Windows 10/11 atualizado)
winget install -e --id Docker.DockerDesktop
# Depois de instalar: abra o Docker Desktop e confira Settings > Resources > WSL Integration.
# O engine precisa aparecer como "Running".

# Teste de sanidade:
docker version            # Client E Server precisam responder
docker run --rm hello-world`)+
'<h2>2. kubectl — o cliente</h2>'+
C('powershell',`winget install Kubernetes.kubectl`)+
'<p>O kubectl conversa com o <strong>API Server</strong> (porta 6443, HTTPS) usando o arquivo <code>kubeconfig</code> (padrão: <code>~/.kube/config</code>). Ele define <em>clusters</em>, <em>usuários</em> e <em>contextos</em> — o <strong>contexto</strong> é a combinação ativa cluster+usuário+namespace:</p>'+
C('bash',`kubectl config get-contexts          # lista contextos
kubectl config current-context       # qual está ativo agora
kubectl config use-context kind-k8sjourney
kubectl config view --minify         # só o contexto atual (ótimo p/ debug)

# Autocomplete (bash/zsh) — adicione ao seu ~/.bashrc ou ~/.zshrc:
# source <(kubectl completion bash)

# Aliases que economizam horas:
alias k=kubectl
alias kgp='kubectl get pods'
alias kgd='kubectl get deploy'
alias kd='kubectl describe'
alias kaf='kubectl apply -f'
alias kdel='kubectl delete -f'`)+
'<h2>3. kind — o cluster local</h2>'+
'<p>O <strong>kind</strong> sobe um cluster Kubernetes <em>inteiro dentro de containers Docker</em> — cada "node" é um container rodando kubelet + containerd. É o jeito mais rápido de ter um cluster real (Control Plane + workers) no seu notebook.</p>'+
C('powershell',`winget install Kubernetes.kind`)+
'<p>O cluster padrão tem 1 node (control-plane). Para este curso, um cluster de <strong>3 nodes</strong> (1 control-plane + 2 workers) é muito melhor: você vai exercitar scheduling, taints e eviction de verdade.</p>'+
C('yaml',`# kind-config.yaml — o cluster do curso (3 nodes)
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: k8sjourney
nodes:
- role: control-plane
- role: worker
- role: worker`)+
C('bash',`kind create cluster --config kind-config.yaml
# Esperado: "Creating cluster k8sjourney ..." + "kubeconfig updated"

kubectl cluster-info
kubectl get nodes -o wide          # 3 nodes Ready
kubectl get pods -n kube-system    # etcd, kube-apiserver, CoreDNS...`)+
'<h2>3.5. Alternativa: minikube (baterias incluídas)</h2>'+
'<p>O <strong>minikube</strong> é a alternativa mais "completa" para lab local: ele sobe o Kubernetes <em>via kubeadm</em> (o instalador oficial), traz um <strong>dashboard</strong> web e <strong>add-ons</strong> prontos (ingress, metrics-server, storage-provisioner, registry) — e funciona com vários drivers, inclusive <strong>Hyper-V</strong> no Windows (útil se você não usa WSL2). O <code>kubectl</code> é o MESMO para os dois: a diferença é só o contexto do kubeconfig.</p>'+
C('powershell',`# Instalação (Windows):
winget install minikube        # ou: choco install minikube
# macOS: brew install minikube

# Start com 3 nodes (como o cluster do curso), usando o Docker:
minikube start --driver=docker --nodes=3 --cpus=2 --memory=4096

# Sem WSL2? Use o driver Hyper-V:
# minikube start --driver=hyperv --nodes=3

# Versão específica do Kubernetes:
# minikube start --kubernetes-version=v1.31.0`)+
C('bash',`# Add-ons prontos (o "baterias incluídas"):
minikube addons list
minikube addons enable ingress
minikube addons enable metrics-server
minikube addons enable dashboard
minikube addons enable storage-provisioner   # PVC dinâmico DE GRAÇA (o kind não tem)

# Dashboard web:
minikube dashboard        # abre no navegador

# O contexto muda — o kubectl é o mesmo:
kubectl config get-contexts        # minikube vs kind-k8sjourney
kubectl config use-context minikube
kubectl get nodes -o wide          # 3 nodes do minikube`)+
'<table class="tbl"><tr><th></th><th>minikube</th><th>kind</th></tr>'+
'<tr><td>Como sobe o cluster</td><td>via <strong>kubeadm</strong> (instalação "de verdade")</td><td>containers Docker direto (kubelet + containerd)</td></tr>'+
'<tr><td>Baterias incluídas</td><td>dashboard + add-ons (ingress, metrics, storage-provisioner…)</td><td>mínimo — instala tudo via Helm</td></tr>'+
'<tr><td>Multi-node</td><td>sim (<code>--nodes=3</code>)</td><td>sim (config file) — o padrão deste curso</td></tr>'+
'<tr><td>Drivers</td><td>Docker, Hyper-V, VirtualBox, QEMU, podman…</td><td>só Docker</td></tr>'+
'<tr><td>PVC dinâmico (storage)</td><td>add-on storage-provisioner</td><td>não tem por padrão (os labs usam PV estático)</td></tr>'+
'<tr><td>Recursos</td><td>mais pesado (VM/containers maiores)</td><td>leve — ideal para CI e máquinas fracas</td></tr>'+
'<tr><td>Melhor para</td><td>começar, dashboard, Windows sem WSL2, testar add-ons</td><td>multi-node rápido, labs do curso, CI</td></tr></table>'+
'<p><strong>Qual usar no lab de aprendizado?</strong> Os dois ensinam o MESMO Kubernetes — o <code>kubectl</code> é idêntico, só o contexto muda. Este curso usa <strong>kind</strong> porque os labs de scheduling, taints, eviction e caos (Módulo 5) dependem de multi-node leve e rápido de recriar — e porque o fluxo "instala tudo via Helm" é exatamente o que você fará em produção. Escolha o <strong>minikube</strong> se quiser baterias incluídas (dashboard, PVC dinâmico de graça) ou se o seu Windows não tem WSL2 (driver Hyper-V). E dá para ter os DOIS instalados: <code>kubectl config use-context</code> alterna na hora.</p>'+
TIP('Lab alternativo com minikube: <code>minikube start --driver=docker --nodes=3</code> + <code>minikube addons enable metrics-server storage-provisioner ingress</code> e repita o lab "Seu primeiro cluster de verdade" abaixo — os comandos kubectl são os mesmos (contexto <code>minikube</code>).')+
'<p>Outras opções para registro: <strong>k3s</strong> (K8s leve da Rancher — ótimo para testar e edge), <strong>kubeadm</strong> (instalação manual — o jeito dos clusters on-premise) e <strong>devbox</strong> (wrapper do Nix: as ferramentas do projeto instaladas de forma reprodutível, com lock file). O modelo mental é o mesmo em todos: o que muda é como o cluster foi montado.</p>'+
'<h2>4. Versões: a política de version skew</h2>'+
'<p>O Kubernetes tem uma <strong>política oficial de compatibilidade</strong> (version skew): o kubectl pode estar até <strong>1 versão à frente ou atrás</strong> do API Server; os kubelets dos nodes podem estar até <strong>3 versões menores atrás</strong> do API Server. Na prática: mantenha o kubectl na MESMA versão do cluster.</p>'+
C('bash',`kubectl version --client        # versão do cliente
kubectl version                   # cliente + server (exige cluster ativo)
kubectl explain pod               # documentação embutida — use SEMPRE
kubectl explain deployment.spec.strategy`)+
LAB('Seu primeiro cluster de verdade',
'<ol><li>Crie o arquivo <code>kind-config.yaml</code> acima e rode <code>kind create cluster --config kind-config.yaml</code>.</li>'+
'<li>Confira <code>kubectl get nodes -o wide</code> — 3 nodes <code>Ready</code>.</li>'+
'<li>Rode <code>kubectl describe node</code> no primeiro node e procure <em>Capacity</em> e <em>Allocatable</em> (CPU/memória que os Pods podem usar).</li>'+
'<li>Liste o sistema: <code>kubectl get pods -n kube-system -o wide</code> e identifique os componentes do Control Plane (etcd, kube-apiserver, kube-controller-manager, kube-scheduler) e dos workers (kube-proxy, coredns).</li>'+
'<li>Deixe o cluster de pé — vamos usá-lo em TODOS os labs do curso.</li></ol>')+
'<h2>Troubleshooting de ambiente (o que mais quebra)</h2>'+
'<table class="tbl"><tr><th>Sintoma</th><th>Causa provável</th><th>Correção</th></tr>'+
'<tr><td><code>Cannot connect to the Docker daemon</code></td><td>Docker Desktop não está "Running" (ou WSL2 caiu)</td><td>Abra o Docker Desktop e espere o engine subir; teste com <code>docker info</code></td></tr>'+
'<tr><td><code>kind: command not found</code></td><td>PATH não atualizou após o winget</td><td>Abra um terminal NOVO (ou <code>refreshenv</code>)</td></tr>'+
'<tr><td><code>Unable to connect to the server: connection refused</code></td><td>Cluster não existe ou contexto errado</td><td><code>kind get clusters</code> + <code>kubectl config get-contexts</code></td></tr>'+
'<tr><td>WSL2 comendo memória demais</td><td>WSL2 pode usar até 50% da RAM</td><td>Crie <code>%UserProfile%/.wslconfig</code> com <code>[wsl2]</code> e <code>memory=6GB</code>; rode <code>wsl --shutdown</code></td></tr>'+
'<tr><td><code>no kind clusters found</code></td><td>Cluster nunca foi criado (ou foi deletado)</td><td>Rode <code>kind create cluster</code> novamente</td></tr></table>'+
TIP('Se algo der errado: <code>kubectl describe</code> (eventos) e <code>kubectl get events --sort-by=.lastTimestamp</code> são seus melhores amigos. Em cluster local, 90% dos problemas são Docker parado ou contexto errado.')+
NOTE('No Windows, todo o fluxo funciona igual: <code>docker build</code>, push no registry e <code>kubectl apply</code>. O cluster não sabe (nem se importa) com a linguagem do seu app — ele só quer containers na especificação correta.')+
TERMS([['kubeconfig','Arquivo (~/.kube/config) com clusters, usuários e contextos'],['Contexto','Cluster + usuário + namespace ativos — trocável com kubectl config use-context'],['kind','Kubernetes in Docker: cluster inteiro dentro de containers'],['minikube','Cluster local via kubeadm com dashboard e add-ons prontos'],['Version skew','Política de compatibilidade entre kubectl/apiserver/kubelets'],['API Server','Porta 6443 (HTTPS): única porta de entrada do cluster']])+
QUIZ('Você instalou o Docker Desktop no Windows e o backend está em modo Hyper-V (legado). O kind não sobe. Por quê?',
['Falta instalar o .NET Framework','kind precisa de containers Linux nativos — habilite o backend WSL2','A porta 6443 está ocupada','O kubeconfig está no caminho errado'],1,
'Isso! Containers Linux (e o kind inteiro) dependem do kernel Linux do WSL2; o backend Hyper-V legado não é suportado.')+
QUIZ('Qual comando mostra os nodes do seu cluster com IP, imagem do SO e versão do kernel?',
['kubectl get nodes -o wide','kubectl get pods','kubectl config view --minify','docker ps'],0,
'Exato! <code>-o wide</code> adiciona colunas (INTERNAL-IP, OS-IMAGE, KERNEL-VERSION e zona na nuvem).')+
QUIZ('Você quer um lab local com dashboard, PVC dinâmico e ingress funcionando de cara, sem instalar nada via Helm. Qual ferramenta?',
['kind','minikube (add-ons: dashboard, storage-provisioner, ingress)','kubeadm','Docker Compose'],1,
'Isso! O minikube entrega add-ons prontos; o kind é mínimo — você instala tudo via Helm (o que também é um ótimo exercício).')+
QUIZ('Você já tem o cluster kind do curso rodando e quer testar o minikube. Como alternar entre eles?',
['Reinstalar o kubectl','kubectl config use-context (kind-k8sjourney ↔ minikube)','Apagar o kubeconfig','minikube stop'],1,
'Exato! Os dois vivem no mesmo kubeconfig; o contexto decide qual cluster o kubectl fala.')},
{id:'m0l3',title:'Vídeos de referência e fontes do conteúdo',mins:7,body:
'<p>Parte da sequência didática deste curso foi construída a partir das transcrições/roteiros dos vídeos abaixo e depois <strong>validada e ampliada</strong> contra a documentação oficial do Kubernetes e dos três grandes providers. Você <em>não precisa</em> assistir os vídeos para seguir o curso — eles são complemento.</p>'+
'<a class="video-card" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=2T86xAtR6Fo"><div class="video-ico"><span class="mi" aria-hidden="true">play_arrow</span></div><div><b>Complete Kubernetes Course — From BEGINNER to PRO</b><small>DevOps Directive (EN) · 14 seções: história/motivação, arquitetura, setup, resource types, Helm, app demo, CRDs/operators, tooling, dev experience, debugging, multi-env, upgrades e CI/CD — cobrimos TODAS elas neste curso.</small></div></a>'+
'<a class="video-card" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=UEoxMU_l2xs"><div class="video-ico"><span class="mi" aria-hidden="true">play_arrow</span></div><div><b>Seu Primeiro Projeto Prático DevOps COMPLETO: Docker, AWS, Terraform e CI/CD!</b><small>Maria Lazara (PT-BR) · base prática dos Módulos 0 e 6: Docker hands-on e pipeline CI/CD de ponta a ponta.</small></div></a>'+
'<a class="video-card" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=MTHGoGUFpvE"><div class="video-ico"><span class="mi" aria-hidden="true">play_arrow</span></div><div><b>Kubernetes Zero to Hero: The Complete Beginner\'s Guide (2025)</b><small>Curso completo de fundamentos (EN · 2h50): arquitetura, YAML, Pods, Services, Storage, NetworkPolicies — com analogias didáticas ótimas para começar.</small></div></a>'+
'<h2>Como usar os vídeos</h2>'+
'<ul><li><strong>Antes</strong> de um módulo: assista a seção correspondente do DevOps Directive para ter a visão geral em vídeo.</li>'+
'<li><strong>Depois</strong>: execute os labs do curso — é a execução que fixa o conceito.</li>'+
'<li>O vídeo da Maria Lazara é o par dos Módulos 0 e 6: Docker hands-on e CI/CD de ponta a ponta em português.</li>'+
'<li>O <strong>Zero to Hero</strong> é o par do Módulo 1: as analogias (manifest = pedido de café, PVC = chave/armário, Service = letreiro) fixam os fundamentos antes dos labs.</li></ul>'+
DEEP('Como o conteúdo foi validado: cada afirmação sobre o comportamento do Kubernetes foi conferida contra <code>kubernetes.io/docs</code> (fonte primária); cada afirmação sobre clouds foi conferida nas páginas oficiais de preço/features de AKS, GKE e EKS, com data de verificação. Preços mudam — conceitos não.')+
'<h2>Fontes de validação</h2>'+
'<div class="src-grid">'+
'<div class="src-card"><b>kubernetes.io/docs/concepts</b><small>Fonte primária: arquitetura, workloads, services/networking, storage, configuration, security, policies, scheduling/eviction e extensibility.</small></div>'+
'<div class="src-card"><b>github.com/sidpalas/devops-directive-kubernetes-course</b><small>Repositório companheiro do curso do DevOps Directive; estrutura de 14 seções usada como checklist de cobertura.</small></div>'+
'<div class="src-card"><b>Docs dos providers</b><small>learn.microsoft.com/azure/aks · cloud.google.com/kubernetes-engine · docs.aws.amazon.com/eks — pricing e integrações verificadas nas páginas oficiais de preço.</small></div>'+
'</div>'+
QUIZ('Qual é a fonte primária de validação técnica deste curso?',
['Os vídeos do YouTube','A documentação oficial do Kubernetes (kubernetes.io/docs)','Os blogs dos providers','O repositório do DevOps Directive'],1,
'Isso! Os vídeos deram a sequência didática; a verdade técnica vem da documentação oficial — e os detalhes de cloud, das páginas oficiais de cada provider.')}
]};
