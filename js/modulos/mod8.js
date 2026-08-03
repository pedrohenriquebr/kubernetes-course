/* Módulo 08 — Kubernetes para Devs .NET */
const MOD8 = {id:'m8',num:'08',title:'Segurança & Políticas',level:'adv',lessons:[
{id:'m8l1',title:'RBAC: quem pode o quê',mins:15,body:
'<p>O RBAC do Kubernetes responde: <em>qual identidade</em> (User/Group/<strong>ServiceAccount</strong>) pode <em>qual verbo</em> (get/list/create/delete…) sobre <em>qual recurso</em> em <em>qual namespace</em>. Fluxo de uma requisição na API: <strong>autenticação → autorização (RBAC) → admission control → etcd</strong>.</p>'+
C('yaml',`apiVersion: v1
kind: ServiceAccount
metadata: { name: ci-deployer, namespace: prod }
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { name: deployer, namespace: prod }
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "update", "patch"]
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: ci-deployer-binding, namespace: prod }
subjects:
- kind: ServiceAccount
  name: ci-deployer
roleRef:
  kind: Role
  name: deployer
  apiGroup: rbac.authorization.k8s.io`)+
'<h2>Os quatro pedaços do quebra-cabeça</h2>'+
'<table class="tbl"><tr><th>Peça</th><th>Responde</th><th>Exemplo</th></tr>'+
'<tr><td><code>Subject</code></td><td>QUEM</td><td>ServiceAccount <code>ci-deployer</code> (ou User/Group)</td></tr>'+
'<tr><td><code>Verbs</code></td><td>O QUE pode fazer</td><td>get, list, watch, create, update, patch, delete</td></tr>'+
'<tr><td><code>Resources</code></td><td>SOBRE QUAL objeto</td><td>deployments, pods, services, secrets</td></tr>'+
'<tr><td><code>Scope</code></td><td>EM QUAL namespace</td><td>Role = 1 namespace; ClusterRole = cluster inteiro</td></tr></table>'+
'<p>Detalhes que separam quem sabe de quem decora:</p>'+
'<ul><li><strong>Role vs ClusterRole:</strong> Role vale no namespace do RoleBinding; ClusterRole vale no cluster todo (e pode ser "reduzida" a um namespace via RoleBinding). <code>view</code>/<code>edit</code>/<code>admin</code>/<code>cluster-admin</code> são ClusterRoles prontas.</li>'+
'<li><strong>apiGroups:</strong> <code>""</code> (core: pods, services, secrets…), <code>apps</code> (deployments, statefulsets), <code>batch</code> (jobs, cronjobs), <code>networking.k8s.io</code> (ingresses, networkpolicies), <code>rbac.authorization.k8s.io</code> (roles!).</li>'+
'<li><strong>Non-resource URLs:</strong> para endpoints como <code>/healthz</code> — <code>nonResourceURLs</code> + verbs get/post (só em ClusterRole).</li>'+
'<li><strong>Agregação:</strong> ClusterRoles podem agregar outras (permissões compostas).</li></ul>'+
C('bash',`kubectl auth can-i update deployments -n prod \\
  --as=system:serviceaccount:prod:ci-deployer
kubectl auth can-i --list --as=system:serviceaccount:prod:ci-deployer   # tudo que ela pode
kubectl get role,rolebinding -n prod`)+
'<h2>ServiceAccount: a identidade do seu Pod</h2>'+
'<p>Cada Pod tem um ServiceAccount (padrão: <code>default</code>) e um <strong>token montado em volume</strong> (<code>/var/run/secrets/kubernetes.io/serviceaccount</code>). Se o app não conversa com a API do cluster, desligue o token:</p>'+
C('yaml',`apiVersion: v1
kind: ServiceAccount
metadata: { name: api-pagamentos, namespace: pagamentos }
automountServiceAccountToken: false     # o Pod não precisa do token`)+
LAB('RBAC mínimo de verdade',
'<ol><li>Crie a ServiceAccount <code>ci-deployer</code>, a Role <code>deployer</code> e o RoleBinding acima no namespace <code>prod</code>.</li>'+
'<li>Teste como a identidade: <code>kubectl auth can-i create pods -n prod --as=system:serviceaccount:prod:ci-deployer</code> → <code>no</code> (a Role só dá get/list).</li>'+
'<li>Adicione o verbo <code>create</code> em pods e repita → <code>yes</code>.</li>'+
'<li>Teste em outro namespace: <code>kubectl auth can-i get pods -n dev --as=...</code> → <code>no</code> (a Role é do namespace prod).</li>'+
'<li>Confira a lista completa: <code>kubectl auth can-i --list --as=system:serviceaccount:prod:ci-deployer</code>.</li></ol>')+
WARN('Princípio do menor privilégio SEMPRE: seu Pod não precisa falar com a API do cluster? Não dê permissões ao ServiceAccount (ou use <code>automountServiceAccountToken: false</code>).')+
TERMS([['RBAC','Autorização por identidade × verbo × recurso × namespace'],['ServiceAccount','Identidade do Pod (token em volume)'],['Role/ClusterRole','Permissões (namespace / cluster)'],['RoleBinding','Amarra subject à role'],['Verbos','get, list, watch, create, update, patch, delete'],['can-i','Testa permissões sem executar']])+
QUIZ('Sua CI precisa atualizar Deployments em prod, mas NÃO ler Secrets. Qual Role expressa isso?',
['cluster-admin','Role com deployments: update/patch + pods: get/list (sem secrets)','view','Role com tudo em prod'],1,
'Isso! Menor privilégio: só os verbos/recurso que a esteira precisa. Secrets ficam de fora.')+
QUIZ('kubectl auth can-i serve para…',
['Testar a saúde do cluster','Perguntar à API se uma identidade pode fazer X','Renovar tokens','Auditar logs'],1,
'Exato! can-i pergunta sem executar — perfeito para validar RBAC antes de quebrar algo.')},
{id:'m8l2',title:'Secrets gerenciados pelos clouds',mins:15,body:
'<p>Secrets nativos em base64 não sobrevivem a uma auditoria séria. Padrão de produção: secrets vivem em um <strong>cofre gerenciado</strong> e são injetados no Pod via CSI driver, com <strong>identidade do workload</strong> (sem senhas em arquivo!). Para clusters fora dos clouds: <strong>External Secrets Operator</strong>, <strong>SOPS</strong> (criptografa o YAML no Git) ou <strong>Sealed Secrets</strong>.</p>'+
'<div class="ptabs">'+
'<button class="ptab active" data-t="aks" type="button">AKS (Azure)</button>'+
'<button class="ptab" data-t="gke" type="button">GKE (Google)</button>'+
'<button class="ptab" data-t="eks" type="button">EKS (AWS)</button>'+
'</div>'+
'<div class="ptab-panel active" data-t="aks"><h4>Azure Key Vault + Workload Identity</h4><p>O <em>Secrets Store CSI Driver</em> monta o Key Vault como volume; o Pod se autentica via <strong>Workload Identity Federation</strong> (token do service account vira identidade Entra ID). No .NET, <code>DefaultAzureCredential</code> com os SDKs de Key Vault funciona sem connection string.</p></div>'+
'<div class="ptab-panel" data-t="gke"><h4>Secret Manager + Workload Identity</h4><p>Workload Identity mapeia o ServiceAccount do K8s para uma <em>service account do IAM</em>; o app usa <code>Google.Cloud.SecretManager.V1</code> ou o CSI driver. Zero chaves JSON no repositório.</p></div>'+
'<div class="ptab-panel" data-t="eks"><h4>Secrets Manager + IRSA / Pod Identity</h4><p><em>IAM Roles for Service Accounts (IRSA)</em> — ou o mais simples <em>EKS Pod Identity</em> — associa permissões IAM ao Pod; o SDK da AWS (<code>AWSSDK.SecretsManager</code>) ou o CSI Provider AWS faz o resto.</p></div>'+
'<h2>O fluxo do CSI driver (o padrão dos três)</h2>'+
'<ol><li>Você instala o <strong>Secrets Store CSI Driver</strong> + o provider do cloud (Azure Key Vault / Google Secret Manager / AWS Secrets Manager).</li>'+
'<li>O Pod declara um volume <code>csi</code> com o secret provider class (quais segredos montar).</li>'+
'<li>O driver busca no cofre <strong>na hora da montagem</strong> — o segredo não fica no etcd.</li>'+
'<li>O Pod autentica na nuvem via identidade do workload (sem chave em lugar nenhum).</li></ol>'+
C('yaml',`apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata: { name: api-kv, namespace: prod }
spec:
  provider: azure                      # azure / gcp / aws
  parameters:
    usePodIdentity: "false"
    useVMManagedIdentity: "true"
    keyvaultName: meu-kv
    objects: |
      array:
        - objectName: conn-pagamentos
          objectType: secret
    tenantId: "00000000-0000-0000-0000-000000000000"`)+
'<h2>Fora dos clouds: Git com segredo criptografado</h2>'+
'<table class="tbl"><tr><th>Ferramenta</th><th>Como funciona</th><th>Quando</th></tr>'+
'<tr><td><strong>External Secrets Operator</strong></td><td>CRD <code>ExternalSecret</code> → sincroniza do cofre (AWS, Azure, GCP, Vault…) para Secrets do K8s</td><td>padrão moderno: GitOps-friendly, segredo continua vivo no cofre</td></tr>'+
'<tr><td><strong>SOPS</strong></td><td>criptografa campos do YAML com KMS/PGP antes do commit</td><td>time pequeno, sem cofre central</td></tr>'+
'<tr><td><strong>Sealed Secrets</strong></td><td>controller no cluster "sela" um Secret com chave pública; o Git guarda o selado</td><td>alternativa simples sem cofre externo</td></tr></table>'+
'<h2>E no .NET: o segredo nem precisa chegar ao cluster</h2>'+
'<p>Com workload identity, o <strong>código</strong> pode buscar direto no cofre (sem montar volume):</p>'+
C('csharp',`// Azure: DefaultAzureCredential resolve a Workload Identity do Pod
builder.Configuration.AddAzureKeyVault(
    new Uri("https://meu-kv.vault.azure.net/"),
    new DefaultAzureCredential());`)+
LAB('Comparando os caminhos',
'<ol><li>Identifique no seu cluster qual caminho existe hoje (Secret nativo? ESO? CSI?).</li>'+
'<li>Rode <code>kubectl get externalsecrets -A</code> e <code>kubectl get secretproviderclass -A</code> para mapear.</li>'+
'<li>Num cluster de teste, instale o External Secrets Operator via Helm e crie um <code>ExternalSecret</code> apontando para um cofre de teste — veja o Secret nascer e se atualizar quando o cofre muda.</li>'+
'<li>Compare com o fluxo do CSI: volume montado na hora, sem Secret no etcd.</li></ol>')+
NOTE('No .NET, o <code>DefaultAzureCredential</code> (e os equivalentes <code>GoogleCredential</code>/<code>AWSCredentials</code>) encadeiam: workload identity → managed identity → credenciais locais de dev. Ou seja: o MESMO código roda no cluster, no CI e na sua máquina — sem connection string de segredo em lugar nenhum.')+
TERMS([['Cofre gerenciado','Key Vault / Secret Manager / Secrets Manager'],['CSI driver','Monta o segredo como volume na hora (não fica no etcd)'],['Workload identity','Token do ServiceAccount vira identidade na nuvem'],['External Secrets Operator','Sincroniza cofre → Secret do K8s (CRD ExternalSecret)'],['SOPS','YAML criptografado no Git (KMS/PGP)'],['Sealed Secrets','Secret "selado" com chave pública do cluster']])+
QUIZ('A grande vantagem do CSI driver sobre o Secret nativo:',
['É mais rápido','O segredo NÃO fica no etcd (é buscado na montagem)','É gratuito','Não precisa de RBAC'],1,
'Isso! Segredo nativo fica em base64 no etcd; o CSI busca do cofre na montagem.')+
QUIZ('GitOps + segredos de produção sem cofre central: qual ferramenta?',
['Secret nativo no repo','SOPS (YAML criptografado) ou Sealed Secrets','ConfigMap','kubectl create secret em cada deploy'],1,
'Isso! SOPS/Sealed Secrets permitem versionar o segredo criptografado — o plano B quando não há cofre.')},
{id:'m8l3',title:'Hardening de Pods e supply chain',mins:14,body:
'<p>Checklist de hardening que todo manifest de produção deveria passar (os <em>Pod Security Standards</em> definem os níveis <code>privileged</code> → <code>baseline</code> → <code>restricted</code>):</p>'+
C('yaml',`    securityContext:
      runAsNonRoot: true
      runAsUser: 1000
      readOnlyRootFilesystem: true     # imagem imutável de verdade
      allowPrivilegeEscalation: false
      capabilities: { drop: ["ALL"] }
      seccompProfile: { type: RuntimeDefault }`)+
'<h2>Entendendo cada linha</h2>'+
'<ul><li><strong><code>runAsNonRoot</code> + <code>runAsUser</code>:</strong> o processo NUNCA roda como root. O nível <code>restricted</code> do PSA exige.</li>'+
'<li><strong><code>readOnlyRootFilesystem</code>:</strong> o filesystem da imagem fica só-leitura — app que "escreve em qualquer lugar" quebra (revele diretórios de escrita: <code>/tmp</code> com <code>emptyDir</code>).</li>'+
'<li><strong><code>allowPrivilegeEscalation: false</code> + <code>capabilities.drop: ALL</code>:</strong> sem <code>setuid</code>, sem capacidades extras do kernel.</li>'+
'<li><strong><code>seccompProfile: RuntimeDefault</code>:</strong> o kernel bloqueia syscalls perigosas; perfil do container runtime — praticamente grátis.</li></ul>'+
C('yaml',`    # app que precisa escrever em /tmp (ex.: uploads temporários):
    securityContext:
      readOnlyRootFilesystem: true
      allowPrivilegeEscalation: false
      capabilities: { drop: ["ALL"] }
    volumeMounts:
    - { name: tmp, mountPath: /tmp }
  volumes:
  - name: tmp
    emptyDir: {}`)+
'<h2>Supply chain: da imagem ao runtime</h2>'+
'<ul><li><strong>Scan no CI (shift-left):</strong> Trivy/Grype na imagem antes do push; falha em CRITICAL/HIGH.</li>'+
'<li><strong>Registry com bloqueio:</strong> o registry também escaneia (ACR/Artifact Registry/ECR) — imagem vulnerável nem entra.</li>'+
'<li><strong>Scan contínuo no cluster (Trivy Operator):</strong> além do scan no CI, um operador escaneia TODAS as imagens em execução (inclusive as de terceiros), com rescan periódico (~24h) e relatórios como CRs (<code>VulnerabilityReport</code>, <code>ConfigAuditReport</code>) — a camada que pega "imagem que entrou antes da política".</li>'+
'<li><strong>Assinatura (Sigstore/cosign):</strong> a imagem é assinada no build; a admissão (Kyverno) só aceita assinada. Saber QUEM construiu o artefato.</li>'+
'<li><strong>SBOM:</strong> inventário de dependências gerado no build — a base para responder "essa lib vulnerável está em produção?" em minutos.</li>'+
'<li><strong>Políticas de admissão:</strong> "proibido latest", "proibido root", "resources obrigatórios" (Kyverno/OPA).</li>'+
'<li><strong>Rede:</strong> NetworkPolicies default-deny + RBAC mínimo (lições anteriores).</li></ul>'+
'<h2>User Namespaces: o "root falso" do container (GA 1.36)</h2>'+
'<p>Com <code>spec.hostUsers: false</code>, o processo roda como root <em>dentro do container</em>, mas é mapeado para um usuário <strong>não-root e sem privilégios no host</strong> (o kubelet escolhe UIDs não sobrepostos por Pod). Se o container for comprometido e "escapar", não tem privilégios de host. Restrições: incompatível com <code>hostNetwork</code>/<code>hostPID</code>/<code>hostIPC</code>, e exige kernel/runtime modernos (Linux 6.3+, runc 1.2+, containerd 2.0+).</p>'+
C('yaml',`spec:
  hostUsers: false      # user namespace: root "falso" no host
  containers:
  - name: api
    image: meuregistry/minha-api:1.0.0
    securityContext:
      runAsUser: 0      # root DENTRO do container, sem privilégio no host`)+
'<h2>seccomp, AppArmor e SELinux: as camadas de contenção</h2>'+
'<p>O <code>seccompProfile: RuntimeDefault</code> (já coberto) bloqueia syscalls perigosas. Além dele: <strong>AppArmor</strong> (perfis de acesso a arquivos/capabilidades por aplicação — anotação <code>container.apparmor.security.beta.kubernetes.io</code> ou <code>securityContext.appArmorProfile</code> na 1.30+) e <strong>SELinux</strong> (políticas de rótulo, comum em RHEL/OpenShift). Para o dev .NET: o essencial é saber que existem e que imagens oficiais .NET rodam bem com seccomp RuntimeDefault; perfis AppArmor/SELinux são decisão de plataforma.</p>'+
LAB('Scan de imagem na prática',
'<ol><li>Instale o Trivy: <code>winget install AquaSecurity.Trivy</code> (ou <code>brew install trivy</code>).</li>'+
'<li>Escaneie: <code>trivy image mcr.microsoft.com/dotnet/aspnet:8.0</code> — veja a lista de vulnerabilidades.</li>'+
'<li>Compare com a imagem SDK: <code>trivy image mcr.microsoft.com/dotnet/sdk:8.0</code> — mais superfície (mais vulnerabilidades).</li>'+
'<li>Gere o SBOM: <code>trivy image --format cyclonedx --output sbom.json mcr.microsoft.com/dotnet/aspnet:8.0</code> e abra o JSON.</li>'+
'<li>No CI (Módulo 6), o mesmo comando com <code>--exit-code 1 --severity CRITICAL,HIGH</code> bloqueia o pipeline.</li></ol>')+
NOTE('A imagem oficial <code>mcr.microsoft.com/dotnet/aspnet</code> já roda como usuário não-root — meio caminho andado para o nível <em>restricted</em>. O <code>readOnlyRootFilesystem</code> costuma ser o passo que mais quebra apps .NET que escrevem em disco por padrão (cache, temp) — revele <code>/tmp</code> com emptyDir e aponte o ASP.NET temp/cache para lá.')+
TERMS([['runAsNonRoot','Processo nunca roda como root (PSA restricted)'],['readOnlyRootFilesystem','Imagem só-leitura + emptyDir para escrita'],['Capabilities drop','Remove poderes do kernel (setuid, raw sockets…)'],['seccomp','Filtro de syscalls (RuntimeDefault = padrão do runtime)'],['Trivy/Grype','Scan de vulnerabilidades (CI + registry)'],['cosign/Sigstore','Assinatura de imagem'],['SBOM','Inventário de dependências do artefato']])+
QUIZ('O app .NET quebra com readOnlyRootFilesystem: true. Primeiro passo?',
['Remover a opção','Revelar /tmp com emptyDir e apontar cache/temp do ASP.NET para lá','Rodar como root','Aumentar o memory limit'],1,
'Isso! Escrita deve ser explícita: emptyDir montado em /tmp e o app configurado para usar esse caminho.')+
QUIZ('"Essa lib vulnerável está em produção?" — responda em minutos com…',
['Achismo','SBOM do build + scan do registry','kubectl get pods','O dashboard do Grafana'],1,
'Exato! SBOM + scan contínuo = resposta rastreável.')},
{id:'m8l4',title:'Admission control, webhooks e Pod Security Admission',mins:15,body:
'<p>Entre a autorização e a gravação no etcd existe o <strong>admission control</strong>: uma cadeia de plugins e webhooks que <em>modifica</em> (mutating) e <em>valida</em> (validating) cada requisição. É aqui que políticas viram lei — não recomendação.</p>'+
'<p>Fluxo completo: <strong>API → autenticação → RBAC → admission (mutating → validação de schema → validating) → etcd</strong>. Admissão nativa inclui ResourceQuota, LimitRanger, DefaultStorageClass, ServiceAccount e… o <strong>Pod Security Admission (PSA)</strong>, que substituiu o antigo PodSecurityPolicy.</p>'+
'<h2>Webhooks: o jeito de plugar sua própria política</h2>'+
'<p>Um <em>admission webhook</em> é um serviço HTTPS que a API chama em cada requisição (antes de gravar):</p>'+
'<ul><li><strong>MutatingAdmissionWebhook:</strong> pode ALTERAR o objeto (ex.: injetar sidecar, preencher resources, adicionar labels).</li>'+
'<li><strong>ValidatingAdmissionWebhook:</strong> pode ACEITAR ou REJEITAR (ex.: bloquear imagem latest, exigir securityContext).</li></ul>'+
'<p>Configuração crítica do webhook: <code>failurePolicy: Fail</code> (API bloqueia se o webhook cair — seguro, mas arriscado) ou <code>Ignore</code> (API segue sem o webhook — disponibilidade, mas perde a garantia); e <code>sideEffects: None</code> (o webhook não pode ter efeitos colaterais).</p>'+
'<h2>Pod Security Admission: os 3 modos e a migração segura</h2>'+
C('yaml',`# aplicar nível "restricted" a um namespace inteiro, com 3 rótulos:
apiVersion: v1
kind: Namespace
metadata:
  name: pagamentos
  labels:
    pod-security.kubernetes.io/enforce: restricted      # REJEITA Pods fora do padrão
    pod-security.kubernetes.io/audit: restricted         # registra violações
    pod-security.kubernetes.io/warn: restricted          # avisa no apply`)+
'<p>A migração recomendada (e a ordem dos 3 modos):</p>'+
'<ol><li><strong><code>warn</code></strong> primeiro — os devs veem o aviso no apply e corrigem no ritmo deles.</li>'+
'<li><strong><code>audit</code></strong> depois — violações registradas nos eventos/audit log (métricas de compliance).</li>'+
'<li><strong><code>enforce</code></strong> por último — quando o namespace está limpo, vira lei.</li></ol>'+
'<h2>Kyverno: políticas em YAML</h2>'+
'<p>O <strong>Kyverno</strong> é o admission webhook mais amigável: as políticas são CRDs em YAML puro (sem linguagem de regras como o OPA/Rego).</p>'+
C('yaml',`apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: { name: no-latest }
spec:
  validationFailureAction: Enforce
  rules:
  - name: require-tag
    match: { resources: { kinds: ["Pod"] } }
    validate:
      message: "Tag ':latest' é proibida em produção"
      pattern:
        spec:
          containers:
          - image: "!*:latest"`)+
'<p>Políticas típicas do dia a dia: exigir <code>resources</code>, exigir <code>securityContext</code> (restricted), bloquear <code>latest</code>, exigir labels da equipe, gerar NetworkPolicy default-deny automaticamente, <em>mutar</em> Pods para adicionar probes/limits padrão.</p>'+
LAB('Kyverno no seu kind',
'<ol><li>Instale: <code>helm upgrade --install kyverno kyverno/kyverno --repo https://kyverno.github.io/kyverno/ -n kyverno --create-namespace</code>.</li>'+
'<li>Aplique a política <code>no-latest</code> acima.</li>'+
'<li>Tente criar um Deployment com <code>nginx:latest</code> → REJEITADO com a mensagem da política.</li>'+
'<li>Troque para <code>nginx:1.27</code> → aceito.</li>'+
'<li>Crie uma política que exige <code>resources</code> e veja o apply falhar num Deployment sem requests/limits.</li></ol>')+
QUIZ('Quais são os três modos de um label Pod Security Admission?',
['allow, deny, audit','enforce, audit, warn','strict, relaxed, open','on, off, log'],1,
'Isso! enforce (bloqueia), audit (registra) e warn (avisa) — permitindo migração gradual para o padrão restricted.')+
QUIZ('Mutating vs Validating webhook: a diferença é…',
['Um roda no node, outro no control plane','Mutating ALTERA o objeto; Validating ACEITA ou REJEITA','Um é do cloud, outro é open source','Não há diferença'],1,
'Exato! Mutating muda antes (ex.: injeta sidecar); Validating decide depois (ex.: bloqueia latest).')+
TERMS([['Admission control','Cadeia de validação/mutação antes do etcd'],['Mutating webhook','Altera o objeto (sidecar, defaults, labels)'],['Validating webhook','Aceita ou rejeita (latest, securityContext)'],['failurePolicy','Fail (bloqueia se o webhook cair) ou Ignore'],['PSA','Pod Security Admission: warn → audit → enforce'],['Kyverno','Políticas em YAML (CRDs) — sem linguagem de regras']])},
{id:'m8l5',title:'OIDC e identidade: como você autentica no cluster',mins:12,body:
'<p>O RBAC decide o que uma identidade PODE fazer — mas como o API Server sabe QUEM você é? Esta lição fecha o ciclo de identidade: <strong>autenticação</strong>.</p>'+
'<h2>Os dois mundos de identidade</h2>'+
'<table class="tbl"><tr><th>Identidade</th><th>Onde vive</th><th>Como autentica</th></tr>'+
'<tr><td>Humano (você, a esteira)</td><td>Fora do cluster (Entra ID, Google, AWS IAM…)</td><td><strong>OIDC</strong>: token JWT emitido pelo seu IdP</td></tr>'+
'<tr><td>Máquina (seu Pod)</td><td>Dentro do cluster</td><td><strong>ServiceAccount token</strong> (JWT assinado pelo cluster)</td></tr></table>'+
'<h2>O fluxo OIDC (quando você roda kubectl)</h2>'+
'<ol><li>O <code>kubectl</code> (ou plugin <code>oidc-login</code>) abre o navegador → você autentica no IdP (ex.: Entra ID) → recebe um <strong>JWT</strong>.</li>'+
'<li>O kubeconfig guarda o token e o <code>idp-issuer-url</code>.</li>'+
'<li>A cada chamada, o kubectl envia o JWT no header <code>Authorization: Bearer</code>.</li>'+
'<li>O API Server <strong>valida a assinatura</strong> contra as chaves públicas do IdP (JWKS) e lê os <strong>claims</strong>: <code>sub</code> (usuário), <code>groups</code> (grupos).</li>'+
'<li>O RBAC usa usuário + grupos — o mesmo RBAC da lição 1, agora com identidades reais.</li></ol>'+
'<p>Detalhe crítico: o API Server precisa confiar no IdP — a config do kube-apiserver tem <code>--oidc-issuer-url</code> + <code>--oidc-client-id</code> (+ opcional <code>--oidc-groups-claim</code>). Em clusters gerenciados, isso é habilitado pelo provider (AKS com Entra ID, GKE com Google, EKS com IAM — cada um do seu jeito).</p>'+
C('bash',`# o kubeconfig com OIDC (exemplo — o plugin oidc-login preenche):
users:
- name: eu@empresa.com
  user:
    exec:
      name: kubelogin
      args: [get-token, --login=interactive]
      command: kubelogin
# o token JWT renovado automaticamente a cada expiração`)+
'<h2>ServiceAccount tokens: a identidade do Pod</h2>'+
'<p>O Pod monta um JWT em <code>/var/run/secrets/kubernetes.io/serviceaccount/token</code> — validado pelo cluster (o API Server é o próprio IdP). Nos clusters modernos, o token é <strong>projetado</strong> (bound): com <strong>audiência</strong> e <strong>expiração</strong> — não é mais o segredo eterno de antes. E é esse token que vira identidade na nuvem (workload identity: o cluster "apresenta" o ServiceAccount ao IdP do cloud).</p>'+
C('bash',`# o token do seu Pod:
kubectl exec pod -- cat /var/run/secrets/kubernetes.io/serviceaccount/token
# é um JWT: decodifique o payload e veja os claims
# {"iss":"https://kubernetes.default.svc.cluster.local","aud":["https://kubernetes.default.svc"],...}`)+
DEEP('Workload Identity Federation é a ponte entre os dois mundos: o token do ServiceAccount (assinado pelo cluster) é trocado por um token do IdP do cloud (Entra ID/Google/AWS) via o protocolo OIDC federation — sem nenhuma chave de nuvem dentro do cluster. É o que o <code>DefaultAzureCredential</code>/<code>GoogleCredential</code>/<code>AWSCredentials</code> resolvem "de graça" no seu código (Módulo 9).')+
'<p>E os certificados dentro do cluster? O kubelet usa um certificado de cliente para falar com o API Server (mTLS), emitido via <strong>CertificateSigningRequest (CSR)</strong> — um recurso da API (<code>certificates.k8s.io</code>) que um aprovador (o kube-controller-manager, ou você) aceita. No dia a dia de dev você não cria CSRs, mas saber que "o certificado do node é um CSR aprovado" explica o <code>kubectl get csr</code> em clusters quebrados por certificado expirado.</p>'+
LAB('Autenticação na prática',
'<ol><li>Decodifique o JWT do seu Pod: copie o token e cole em jwt.io (ou decode com <code>base64 -d</code> na parte do meio) — veja <code>iss</code>, <code>aud</code>, <code>sub</code> e a expiração.</li>'+
'<li>Confira a montagem: <code>kubectl exec pod -- ls /var/run/secrets/kubernetes.io/serviceaccount/</code> — token, ca.crt, namespace.</li>'+
'<li>Use o token para chamar a API: <code>kubectl exec pod -- curl -k -H "Authorization: Bearer \$(cat .../token)" https://kubernetes.default.svc/api/v1/namespaces</code> — veja o erro de RBAC (a ServiceAccount default não tem permissão).</li>'+
'<li>No seu cluster real, descubra o IdP: <code>kubectl cluster-info</code> e o kubeconfig (o campo <code>user.exec</code> revela o fluxo OIDC).</li></ol>')+
NOTE('No .NET, o pacote <code>Azure.Identity</code> (DefaultAzureCredential), <code>Google.Cloud.Auth</code> e <code>AWSSDK.Core</code> implementam o fluxo de workload identity — o seu código nunca vê o token; a SDK troca o ServiceAccount do Pod por credenciais da nuvem automaticamente.')+
TERMS([['OIDC','OpenID Connect: autenticação via JWT de um IdP externo'],['JWT','Token assinado com claims (sub, groups, exp)'],['JWKS','Chaves públicas do IdP — o API Server valida a assinatura'],['ServiceAccount token','JWT do Pod, validado pelo próprio cluster'],['Bound token','Token projetado com audiência e expiração'],['Workload identity','Troca do token do cluster por identidade da nuvem']])+
QUIZ('Quando você roda kubectl num cluster com OIDC, quem emite o seu token?',
['O API Server','O IdP (Entra ID, Google, AWS…) — o kubectl só apresenta','O etcd','O kubelet'],1,
'Isso! O kubectl autentica no IdP e apresenta o JWT; o API Server valida a assinatura contra o IdP.')+
QUIZ('O token no /var/run/secrets/.../token do seu Pod serve para…',
['Autenticar no API Server (e virar identidade na nuvem via workload identity)','Criptografar o disco','Logar no Windows','Acessar o Docker Hub'],0,
'Exato! É a identidade do Pod — e a base da workload identity nos clouds.')}
]};
