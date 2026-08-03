/* Módulo 06 — Kubernetes para Devs .NET */
const MOD6 = {id:'m6',num:'06',title:'Empacotamento, CI/CD & Ferramentas',level:'int',lessons:[
{id:'m6l1',title:'Helm: o gerenciador de pacotes',mins:16,body:
'<p>Aplicação real = dezenas de YAMLs interligados. O <strong>Helm</strong> empacota tudo em um <em>chart</em> com valores parametrizáveis — e instala/atualiza/desinstala com um comando, mantendo histórico de releases.</p>'+
C('bash',`helm repo add bitnami https://charts.bitnami.com/bitnami
helm install meu-postgres bitnami/postgresql --set auth.password=***

# seu chart:
helm install minha-api ./charts/minha-api -f values-dev.yaml
helm upgrade minha-api ./charts/minha-api -f values-prod.yaml
helm rollback minha-api 1
helm list`)+
'<p>Estrutura de um chart:</p>'+
C('bash',`charts/minha-api/
├── Chart.yaml          # nome, versão do chart
├── values.yaml         # valores padrão
├── values-prod.yaml    # overrides por ambiente
└── templates/          # YAMLs com template Go
    ├── deployment.yaml
    ├── service.yaml
    ├── ingress.yaml
    ├── _helpers.tpl     # funções reutilizáveis (nomes, labels)
    └── tests/           # "helm test" — valida a release instalada`)+
C('yaml',`# templates/deployment.yaml (trecho)
spec:
  replicas: {{ .Values.replicas }}
  template:
    spec:
      containers:
      - name: api
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        resources: {{- toYaml .Values.resources | nindent 10 }}`)+
'<h2>Precedência de valores (decore esta ordem)</h2>'+
'<ol><li><code>--set</code> (linha de comando) — maior prioridade</li>'+
'<li><code>-f values-&lt;env&gt;.yaml</code> (arquivos declarados)</li>'+
'<li><code>values.yaml</code> (padrões do chart)</li></ol>'+
'<p>Na prática: <code>values.yaml</code> tem os padrões; <code>values-prod.yaml</code> sobrescreve o ambiente; o CI usa <code>--set image.tag=$SHA</code> para o deploy de cada commit.</p>'+
'<h2>Funções de template que você vai usar TODO dia</h2>'+
C('yaml',`# _helpers.tpl — nomes e labels consistentes
{{- define "minha-api.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

# No template:
name: {{ include "minha-api.fullname" . }}
labels:
  app.kubernetes.io/name: {{ include "minha-api.name" . }}
  app.kubernetes.io/managed-by: {{ .Release.Service }}

# default: valor padrão se vazio
port: {{ .Values.service.port | default 80 }}
# quote: garante string no YAML
versao: {{ .Values.versao | quote }}`)+
'<h2>O checksum que reinventa os Pods na mudança de config</h2>'+
C('yaml',`# templates/deployment.yaml — o truque mais copiado do Helm:
template:
  metadata:
    annotations:
      checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}`)+
'<p>Quando o ConfigMap muda, o checksum muda → o template do Deployment muda → o rollout acontece. Sem isso, Helm atualiza o ConfigMap e os Pods seguem com o valor velho (a lição do Módulo 3 na prática).</p>'+
'<h3>Helm avançado</h3>'+
'<ul><li><strong>Hooks:</strong> Jobs executados em pontos do ciclo (<code>pre-install</code>, <code>pre-upgrade</code> — perfeito para migração de banco no deploy, <code>post-delete</code>…). Hooks têm <code>--weight</code> para ordenar e <code>hook-delete-policy</code> para limpar.</li>'+
'<li><strong>Dependências:</strong> um chart pode depender de outros (<code>dependencies</code> no Chart.yaml + <code>helm dependency update</code>).</li>'+
'<li><strong>OCI registries:</strong> charts podem viver em ACR/GAR/ECR junto das imagens (<code>helm push/pull oci://…</code>).</li>'+
'<li><strong><code>helm test</code>:</strong> templates em <code>templates/tests/</code> que validam a release após o deploy (ex.: chamar o healthcheck).</li></ul>'+
TIP('Armadilha do <code>--dry-run</code> (e do <code>helm template</code>): ele NÃO valida recursos cujos <strong>CRDs ainda não existem no cluster</strong> — um chart com CRD ausente "passa" no dry-run e falha no apply real. Aplique os CRDs antes (ou use <code>--include-crds</code> no install) e lembre disso ao debugar "funcionou no dry-run, quebrou no apply".')+
LAB('Seu primeiro chart',
'<ol><li><code>helm create minha-api</code> — o Helm gera um chart completo de exemplo.</li>'+
'<li>Explore: <code>helm template ./minha-api</code> (renderiza os YAMLs sem instalar) e <code>helm lint ./minha-api</code>.</li>'+
'<li>Instale com dry-run: <code>helm install minha-api ./minha-api --dry-run --debug</code>.</li>'+
'<li>Instale de verdade: <code>helm install minha-api ./minha-api --set replicaCount=2</code>.</li>'+
'<li>Upgrade + histórico: <code>helm upgrade minha-api ./minha-api --set replicaCount=3</code>, <code>helm history minha-api</code>, <code>helm rollback minha-api 1</code>.</li></ol>')+
NOTE('Para o .NET, o par perfeito: imagem por SHA no CI + <code>helm upgrade --install --set image.tag=\${{ github.sha }}</code> = deploy rastreável e rollback trivial — o que a lição de CI/CD (m6l3) monta de ponta a ponta.')+
TERMS([['Chart','Pacote Helm: templates + values + Chart.yaml'],['Release','Instância instalada de um chart (com histórico)'],['values.yaml','Padrões; overrides via -f e --set'],['Hooks','Jobs em pontos do ciclo (pre-install, pre-upgrade…)'],['_helpers.tpl','Funções reutilizáveis (fullname, labels)'],['checksum/config','Annotation que dispara rollout quando a config muda']])+
QUIZ('Qual a ordem de precedência dos valores Helm?',
['values.yaml &gt; -f &gt; --set','--set &gt; -f &gt; values.yaml','-f &gt; --set &gt; values.yaml','Todos têm o mesmo peso'],1,
'Isso! --set vence tudo; depois os -f na ordem; values.yaml é o padrão.')+
QUIZ('Atualizou o ConfigMap via Helm mas os Pods seguem com o valor velho. Por quê?',
['O Helm não atualiza ConfigMaps','Sem checksum no template, o Deployment não muda → sem rollout','O kubelet caiu','O etcd não sincronizou'],1,
'Exato! Helm aplica a config, mas o Deployment só recria Pods se o template dele mudou — o checksum resolve.')},
{id:'m6l2',title:'Kustomize: overlays sem templates',mins:12,body:
'<p>Alternativa nativa (embutida no kubectl): mantenha YAMLs puros numa <em>base</em> e aplique <em>patches</em> por ambiente via <strong>overlays</strong>.</p>'+
C('bash',`k8s/
├── base/                 # deployment, service, kustomization.yaml
└── overlays/
    ├── dev/              # patches: replicas 1, recursos menores
    └── prod/             # patches: replicas 6, ingress TLS, HPA

kubectl apply -k k8s/overlays/prod
kubectl kustomize k8s/overlays/prod   # só renderiza (não aplica)`)+
C('yaml',`# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base
patches:
- path: replica-patch.yaml
labels:
- pairs:
    ambiente: prod`)+
'<h2>Patches: strategic merge vs JSON Patch</h2>'+
'<table class="tbl"><tr><th>Tipo</th><th>Sintaxe</th><th>Uso</th></tr>'+
'<tr><td>Strategic merge</td><td>YAML parcial — "mescla" com o original</td><td>o padrão: mudar campos, adicionar containers</td></tr>'+
'<tr><td>JSON Patch (6902)</td><td>op listas: add/remove/replace por caminho</td><td>casos específicos (remover item de lista)</td></tr></table>'+
C('yaml',`# overlays/prod/replica-patch.yaml (strategic merge)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minha-api
spec:
  replicas: 6
  template:
    spec:
      containers:
      - name: api
        resources:
          requests: { cpu: 500m, memory: 512Mi }
          limits: { cpu: "2", memory: 1Gi }`)+
'<h2>Generators: config sem duplicar</h2>'+
'<p>O <code>ConfigMapGenerator</code>/<code>SecretGenerator</code> criam ConfigMaps/Secrets a partir de arquivos ou literais — e o kustomize <strong>adiciona um hash no nome</strong> (ex.: <code>api-config-8f2c1d</code>): quando o conteúdo muda, o nome muda → o Deployment que referencia o nome muda → rollout automático (o checksum do Helm, de graça).</p>'+
C('yaml',`# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources: [deployment.yaml, service.yaml]
configMapGenerator:
- name: api-config
  literals:
  - ASPNETCORE_ENVIRONMENT=Production
  - FeatureFlags__NovoCheckout=true
secretGenerator:
- name: api-secrets
  files: [secrets.env]`)+
'<p>Outros transformadores úteis: <code>commonLabels</code>, <code>namePrefix</code>/<code>nameSuffix</code> (ex.: <code>dev-</code> por overlay), <code>images</code> (trocar imagem/tag sem patch).</p>'+
LAB('Overlay de verdade',
'<ol><li>Crie <code>base/</code> com um Deployment+Service e o kustomization acima.</li>'+
'<li>Renderize: <code>kubectl kustomize base/</code> — veja o ConfigMap com hash no nome.</li>'+
'<li>Crie <code>overlays/prod</code> com o patch de réplicas e renderize: <code>kubectl kustomize overlays/prod</code> — compare as diferenças.</li>'+
'<li>Mude um literal do configMapGenerator e renderize de novo: o hash muda → o Deployment referencia o nome novo → rollout (é automático quando você aplica).</li>'+
'<li>Aplique: <code>kubectl apply -k overlays/prod</code>.</li></ol>')+
'<p>Regra prática: <strong>Helm</strong> brilha para software de prateleira (Postgres, Redis, Prometheus) e charts compartilhados; <strong>Kustomize</strong> brilha para os manifests do <em>seu</em> app — inclusive é o formato preferido do GitOps com ArgoCD/Flux.</p>'+
TIP('Além de Helm/Kustomize, existe o "config as code": <strong>CDK8s</strong> (escreva manifests em TypeScript/Python/Go — curioso para devs .NET), <strong>Timoni</strong> (empacota a config de múltiplos ambientes como OCI artifacts, com linguagem CUE) e <strong>Kluctl</strong> (diff contra o estado vivo do cluster + GitOps embutido). Vale conhecer; Helm/Kustomize seguem como padrão.')+
TERMS([['Base','Manifests canônicos (YAML puro)'],['Overlay','Base + patches por ambiente'],['Strategic merge','Patch YAML parcial que mescla com o original'],['JSON Patch','Operações add/remove/replace (RFC 6902)'],['ConfigMapGenerator','Gera ConfigMap com hash no nome → rollout automático'],['Transformers','commonLabels, namePrefix, images…']])+
QUIZ('O ConfigMapGenerator gera o nome api-config-8f2c1d. Para que serve o hash?',
['Enfeite','Mudou o conteúdo → mudou o nome → o Deployment recria os Pods','Para ordenar alfabeticamente','Para o RBAC'],1,
'Isso! O hash no nome é o "checksum nativo" do kustomize: config mudou, Pods recriam.')+
QUIZ('Helm ou Kustomize para os manifests DO SEU app?',
['Helm sempre','Kustomize (YAML puro, sem templates) — e é o formato padrão do GitOps','Nenhum','Depende do cloud'],1,
'Exato! Kustomize para o seu app; Helm para dependências de prateleira.')},
{id:'m6l3',title:'CI/CD com GitHub Actions para .NET',mins:18,body:
'<p>O pipeline clássico do dev K8s: <strong>CI</strong> testa e publica a imagem; <strong>CD</strong> aplica manifests/Helm no cluster. Exemplo completo para .NET + Azure (ACR + AKS) — a mesma estrutura vale para GAR+GKE e ECR+EKS:</p>'+
'<p>Antes do pipeline, o fluxo MANUAL que ele automatiza (decore este ciclo — é o "esqueleto" de todo CD): <strong>build</strong> (<code>docker build</code>) → <strong>tag</strong> (<code>docker tag</code> com a URL do registry) → <strong>push</strong> (<code>docker push</code>) → <strong>pull</strong> (o node baixa a imagem) → <strong>run</strong> (o container sobe). O CI/CD só repete isso com garantias (SHA imutável, scan, aprovação).</p>'+
C('yaml',`name: deploy-aks
on:
  push:
    branches: [main]
env:
  REGISTRY: meuregistry.azurecr.io
  IMAGE: minha-api
jobs:
  build-push:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-dotnet@v4
      with: { dotnet-version: 8.0.x }
    - run: dotnet test -c Release
    - run: dotnet publish -c Release -o out
    - uses: azure/docker-login@v2
      with:
        login-server: \${{ env.REGISTRY }}
        username: \${{ secrets.ACR_USER }}
        password: \${{ secrets.ACR_PASS }}
    - run: |
        docker build -t \${{ env.REGISTRY }}/\${{ env.IMAGE }}:\${{ github.sha }} .
        docker push \${{ env.REGISTRY }}/\${{ env.IMAGE }}:\${{ github.sha }}
  deploy:
    needs: build-push
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: azure/aks-set-context@v4
      with:
        cluster-name: prod-aks
        resource-group: rg-prod
    - run: |
        helm upgrade --install minha-api ./charts/minha-api \\
          --set image.tag=\${{ github.sha }} -n prod --create-namespace`)+
'<h2>O pipeline que um time sério tem (e o porquê)</h2>'+
'<ul><li><strong>Tag por <code>github.sha</code>:</strong> imutável e rastreável — cada commit vira uma imagem única. <code>latest</code> quebra o rollout (o cluster não sabe que mudou).</li>'+
'<li><strong>Build com cache:</strong> <code>docker/build-push-action</code> com cache (registro ou GHA) — o multi-stage do Módulo 1 fica 10× mais rápido no CI.</li>'+
'<li><strong>Scan no CI (shift-left):</strong> Trivy/Grype na imagem ANTES do push — vulnerabilidade crítica = pipeline falha, não produção.</li>'+
'<li><strong>SBOM:</strong> o build gera o inventário de dependências (parte da supply chain, Módulo 8).</li>'+
'<li><strong>Ambientes com proteção:</strong> GitHub <em>environments</em> (<code>prod</code>) com reviewers e waits — deploy em prod exige aprovação humana.</li></ul>'+
C('yaml',`    - uses: docker/setup-buildx-action@v3
    - uses: docker/build-push-action@v6
      with:
        context: .
        push: true
        tags: \${{ env.REGISTRY }}/\${{ env.IMAGE }}:\${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
    - uses: aquasecurity/trivy-action@master
      with:
        image-ref: \${{ env.REGISTRY }}/\${{ env.IMAGE }}:\${{ github.sha }}
        severity: CRITICAL,HIGH
        exit-code: '1'
        ignore-unfixed: true`)+
'<h2>Deploy por SHA: o fluxo completo</h2>'+
'<ol><li>CI publica <code>minha-api:&lt;sha&gt;</code> no registry.</li>'+
'<li>CD roda <code>helm upgrade --install --set image.tag=&lt;sha&gt;</code>.</li>'+
'<li>O Deployment muda → rollout → probes validam.</li>'+
'<li>Deu problema? <code>kubectl rollout undo</code> volta para a revisão anterior (a imagem antiga continua no registry).</li></ol>'+
LAB('Pipeline de verdade (GitHub Actions)',
'<ol><li>Crie o repositório com o chart e o workflow acima (ajuste registry/credenciais).</li>'+
'<li>Faça um commit que muda o código e veja: test → build com cache → scan → push → deploy.</li>'+
'<li>Confira a tag no cluster: <code>kubectl get deploy minha-api -o jsonpath=\'{.spec.template.spec.containers[0].image}\'</code>.</li>'+
'<li>Role back: <code>kubectl rollout undo deploy/minha-api</code> — e depois <code>kubectl rollout undo</code> de novo para voltar.</li>'+
'<li>Adicione um environment <code>prod</code> com reviewer e observe o deploy esperando aprovação.</li></ol>')+
NOTE('Tag por <code>github.sha</code> (imutável) + <code>helm upgrade</code> = rollout rastreável e rollback trivial. Evite a tag <code>latest</code> em produção: ela quebra a semântica do rolling update (o cluster não sabe que a imagem mudou).')+
TERMS([['CI','Testa e publica a imagem (por SHA)'],['CD','Aplica Helm/manifests no cluster'],['buildx','Build com cache (GHA ou registry)'],['Trivy','Scan de vulnerabilidades no CI (exit-code em severidade alta)'],['SBOM','Inventário de dependências gerado no build'],['Environment','Ambiente GitHub com reviewers/waits para prod']])+
QUIZ('Por que a tag latest quebra o rolling update?',
['O registry bloqueia','Com imagem igual, o template do Deployment não muda → sem rollout','O kubelet ignora latest','O HPA não escala'],1,
'Exato! O rollout só acontece quando o template muda. Tag imutável por SHA garante que cada deploy seja uma mudança real.')+
QUIZ('Onde o scan de vulnerabilidades entra no fluxo ideal?',
['Só no cluster, antes do deploy','No CI, ANTES do push (shift-left)','Nunca','Só em auditorias anuais'],1,
'Isso! Imagem vulnerável nem deveria existir no registry. Scan no CI com exit-code bloqueia o pipeline.')},
{id:'m6l4',title:'GitOps com ArgoCD',mins:14,body:
'<p><strong>GitOps</strong> inverte o CD: em vez do pipeline "empurrar" para o cluster, um operador <em>dentro</em> do cluster (ArgoCD/Flux) observa o Git e <strong>puxa</strong> o estado desejado, detectando e corrigindo <em>drift</em> (alguém mudou algo na mão? o ArgoCD reverte ou alerta).</p>'+
C('yaml',`apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: minha-api-prod, namespace: argocd }
spec:
  project: default
  source:
    repoURL: https://github.com/minha-org/k8s-manifests
    path: overlays/prod
    targetRevision: main
  destination:
    server: https://kubernetes.default.svc
    namespace: prod
  syncPolicy:
    automated: { prune: true, selfHeal: true }`)+
'<h2>Sync, prune e self-heal — os três pilares</h2>'+
'<ul><li><strong>Sync:</strong> aplicar o estado do Git no cluster.</li>'+
'<li><strong>Prune:</strong> apagar do cluster o que sumiu do Git (sem isso, objetos órfãos ficam para sempre).</li>'+
'<li><strong>Self-heal:</strong> se alguém mudar algo na mão (<code>kubectl scale</code>, <code>kubectl edit</code>), o ArgoCD REVERTE para o Git. É o "drift zero" por design.</li></ul>'+
'<p>Atenção ao trade-off: self-heal agressivo pode atrapalhar operações legítimas (ex.: escalar temporariamente para um pico). Use <code>automated</code> com cuidado no início e avance para <code>selfHeal</code> quando o time estiver maduro.</p>'+
'<h2>Sync waves e hooks: a ordem do deploy</h2>'+
'<p>Objetos podem declarar <code>argocd.argoproj.io/sync-wave: "1"</code> (ordem) e <code>argocd.argoproj.io/hook: PreSync</code> (Job em ponto do ciclo). Padrão para .NET: migração de banco (wave 1) → Deployment (wave 2) → Service/Ingress (wave 3).</p>'+
C('yaml',`metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "1"        # migração roda primeiro
    argocd.argoproj.io/hook: PreSync          # Job de migração como hook`)+
'<h2>Multi-ambiente: app-of-apps e ApplicationSet</h2>'+
'<p>Um <em>Application</em> por ambiente fica repetitivo. Dois padrões:</p>'+
'<ul><li><strong>App-of-apps:</strong> um Application "pai" aponta para um repo que contém só Applications (uma por ambiente/serviço).</li>'+
'<li><strong>ApplicationSet:</strong> um template de Application + <em>generators</em> (lista de ambientes, Git branches, PRs) — cria Applications dinamicamente. O gerador de PR cria ambiente efêmero por pull request.</li></ul>'+
'<h2>ArgoCD vs Flux</h2>'+
'<table class="tbl"><tr><th></th><th>ArgoCD</th><th>Flux</th></tr>'+
'<tr><td>Modelo</td><td>Application (CRD) + UI/CLI rica</td><td>Kustomization/HelmRelease + GitRepository</td></tr>'+
'<tr><td>Interface</td><td>Dashboard web + CLI</td><td>CLI + dashboards externos</td></tr>'+
'<tr><td>Perfil</td><td>adotado em quase todas as orgs grandes</td><td>mais minimalista; forte em GitOps puro</td></tr>'+
'<tr><td>Multi-cluster</td><td>nativo (registro de clusters)</td><td>nativo (clusters via Kustomization)</td></tr></table>'+
TIP('Alternativa moderna ao par ArgoCD/Flux: o <strong>Kluctl</strong> — templating tipo Helm + <strong>diff contra o estado vivo do cluster</strong> (mostra o que vai mudar ANTES de aplicar) + GitOps embutido. Menos difundido, mas o diff contra o "live state" é uma das melhores experiências de deploy.')+
LAB('ArgoCD no seu kind (leve)',
'<ol><li>Instale: <code>kubectl create namespace argocd && kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml</code>.</li>'+
'<li>Acesse a UI: <code>kubectl port-forward svc/argocd-server -n argocd 8080:443</code> e abra <code>https://localhost:8080</code> (admin / senha em <code>argocd-initial-admin-secret</code>).</li>'+
'<li>Crie um repo Git com os manifests (ou use um repo público de exemplo) e o Application acima.</li>'+
'<li>Faça um commit mudando réplicas → observe o sync automático.</li>'+
'<li>Quebre o drift: <code>kubectl scale deploy --replicas=9</code> → o self-heal reverte em segundos.</li></ol>')+
'<p>Benefícios para times de dev: deploy = <strong>merge em PR</strong> (revisão + auditoria de graça), rollback = <strong>revert do commit</strong>, e o pipeline de CI para de guardar credenciais fortíssimas do cluster.</p>'+
NOTE('Para o .NET: o padrão "migração como hook PreSync" resolve o problema mais clássico de deploy com EF Core — e com o GitOps, o rollout vira uma operação de Git, revisável e auditável como qualquer PR.')+
TERMS([['GitOps','Git é a fonte da verdade; o cluster "puxa" o estado'],['Application (ArgoCD)','CRD: repo + path + destino + syncPolicy'],['Sync','Aplicar o Git no cluster'],['Prune','Apagar do cluster o que sumiu do Git'],['Self-heal','Reverter drift manual para o estado do Git'],['Sync wave','Ordem de aplicação (migração → app → ingress)'],['ApplicationSet','Template + generators (ambientes, PRs)']])+
QUIZ('Alguém rodou kubectl scale --replicas=9 no Deployment gerenciado por ArgoCD com selfHeal. O que acontece?',
['Fica 9 até o próximo sync','O ArgoCD reverte para o que está no Git','O Git é atualizado para 9','O ArgoCD bloqueia o kubectl'],1,
'Isso! Self-heal = o Git manda. Drift é corrigido em segundos.')+
QUIZ('Deploy via GitOps = …',
['Rodar kubectl apply no CI com credenciais do cluster','Merge em PR (revisão) — o cluster puxa do Git','SSH no node','Rodar scripts no servidor'],1,
'Exato! O pipeline perde a necessidade de credencial forte; o merge vira o deploy.')},
{id:'m6l5',title:'Ferramentas auxiliares & experiência de desenvolvedor',mins:14,body:
'<p>Um cluster útil precisa de um kit instalado (via Helm, claro):</p>'+
C('bash',`# métricas (pré-requisito do HPA)
helm upgrade --install metrics-server metrics-server/metrics-server \\
  --repo https://kubernetes-sigs.github.io/metrics-server/

# ingress + TLS automático
helm upgrade --install ingress-nginx ingress-nginx \\
  --repo https://kubernetes.github.io/ingress-nginx
helm upgrade --install cert-manager cert-manager \\
  --repo https://charts.jetstack.io --set installCRDs=true

# observabilidade completa
helm upgrade --install kube-prom prometheus-community/kube-prometheus-stack \\
  --repo https://prometheus-community.github.io/helm-charts`)+
'<h2>k9s: o terminal que vira dashboard</h2>'+
'<p>O <strong>k9s</strong> é a ferramenta de produtividade nº1: navegue por Pods/Deployments/Logs com atalhos, sem digitar 50 comandos. Atalhos essenciais: <code>0-9</code> (namespaces), <code>l</code> (logs), <code>d</code> (describe), <code>s</code> (shell), <code>ctrl-d</code> (delete), <code>shift-f</code> (filter), <code>?</code> (ajuda).</p>'+
'<h2>O loop de dev: Skaffold vs Tilt</h2>'+
'<table class="tbl"><tr><th></th><th>Skaffold</th><th>Tilt</th></tr>'+
'<tr><td>Modelo</td><td>build + deploy automático a cada mudança</td><td>mesma ideia + UI web de status</td></tr>'+
'<tr><td>Perfil</td><td>simples, ótimo para começar</td><td>times maiores, feedback visual rico</td></tr>'+
'<tr><td>Config</td><td>skaffold.yaml (profiles por ambiente)</td><td>Tiltfile (starlark — programável)</td></tr></table>'+
'<p>Fluxo típico com Skaffold: você edita o código, ele rebuilda a imagem, aplica o Deployment e mostra os logs — <strong>sem docker build manual</strong>.</p>'+
'<h2>Telepresence: dev local dentro do cluster</h2>'+
'<p>O <strong>Telepresence</strong> conecta sua máquina ao cluster: sua API roda <em>localmente</em> (breakpoint no Visual Studio/Rider), mas enxerga o DNS, os Services e os Secrets do cluster como se fosse um Pod. Perfeito para debugar uma integração sem subir tudo localmente.</p>'+
C('bash',`telepresence connect          # conecta à sua rede local ao cluster
telepresence intercept minha-api --port 8080
# A partir daqui, o tráfego para minha-api no cluster vai para o SEU localhost:8080
# (quando quiser parar: telepresence leave minha-api / telepresence quit)`)+
'<h2>port-forward: o canivete</h2>'+
C('bash',`kubectl port-forward svc/postgres 5432:5432    # acessar DB interno
kubectl port-forward pod/minha-api-abc123 8080:80   # Pod específico
kubectl port-forward svc/minha-api 8080:80 -n prod  # com namespace`)+
LAB('Montando seu kit de dev',
'<ol><li>Instale o k9s (<code>winget install k9s</code> no Windows) e navegue no seu cluster: namespace, logs, describe — sem digitar kubectl.</li>'+
'<li>Instale o kit Helm acima (metrics-server + ingress-nginx + cert-manager) e confirme com <code>helm list -A</code>.</li>'+
'<li>Suba um Postgres via Helm e acesse com <code>kubectl port-forward svc/meu-postgres 5432:5432</code> — conecte do seu .NET local.</li>'+
'<li>Configure o Skaffold num projeto simples e veja o loop: editar → build → deploy automático.</li></ol>')+
NOTE('Para .NET, o Telepresence é transformador: rode a API no Visual Studio/Rider <em>localmente</em> com breakpoint, enquanto ela conversa com os outros serviços e bancos que estão no cluster. Também vale <code>kubectl port-forward</code> para acesso rápido a DBs internos sem expô-los.')+
TERMS([['k9s','TUI: navegue/descreva/logs sem digitar kubectl'],['Skaffold/Tilt','Loop de dev: build + deploy automático'],['Telepresence','Dev local "dentro" do cluster (DNS real, intercept de tráfego)'],['port-forward','Túnel local para Service/Pod (DB interno, debug)'],['metrics-server','Pipeline de métricas para o HPA/kubectl top']])+
QUIZ('Você quer debugar com breakpoint uma API que depende de um Postgres que está no cluster. Qual caminho?',
['Subir o Postgres local também','kubectl port-forward svc/postgres 5432:5432 e conectar de local','Instalar o Postgres no Windows','Não dá'],1,
'Isso! port-forward cria o túnel; sua app local conversa com o DB do cluster sem expor nada.')+
QUIZ('O k9s substitui…',
['O cluster inteiro','A digitação repetitiva do kubectl (navegação, logs, describe)','O Docker','O Helm'],1,
'Exato! k9s é produtividade sobre o kubectl — o cluster continua o mesmo.')}
]};
