/* Módulo 03 — Kubernetes para Devs .NET */
const MOD3 = {id:'m3',num:'03',title:'Configuração, Secrets & Storage',level:'int',lessons:[
{id:'m3l1',title:'ConfigMaps: configuração fora da imagem',mins:13,body:
'<p>Imagem imutável + configuração variável por ambiente = <strong>ConfigMap</strong>. Ele injeta pares chave-valor como <em>variáveis de ambiente</em> ou como <em>arquivos</em> montados em volume. Limite de tamanho: <strong>1 MiB</strong> por ConfigMap.</p>'+
C('yaml',`apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
data:
  ASPNETCORE_ENVIRONMENT: "Production"
  Logging__LogLevel__Default: "Information"   # __ vira : na config do .NET
  FeatureFlags__NovoCheckout: "true"`)+
C('yaml',`spec:
  containers:
  - name: api
    image: meuregistry/minha-api:1.0.0
    envFrom:                 # injeta TUDO como env vars
    - configMapRef:
        name: api-config
    env:                     # ou escolha uma a uma
    - name: MEU_SETTING
      valueFrom:
        configMapKeyRef:
          name: api-config
          key: FeatureFlags__NovoCheckout
    volumeMounts:            # OU como arquivo (ex.: appsettings.custom.json)
    - name: cfg
      mountPath: /app/config`)+
'<h2>Env vs Volume: qual usar?</h2>'+
'<table class="tbl"><tr><th>Forma</th><th>Quando atualiza?</th><th>Uso típico</th></tr>'+
'<tr><td>Variável de ambiente</td><td>só quando o Pod <strong>reinicia</strong> (não é dinâmico)</td><td>valores de config simples</td></tr>'+
'<tr><td>Volume montado</td><td>o arquivo <strong>atualiza no Pod vivo</strong> (o app precisa reler — ou reiniciar)</td><td>appsettings, TLS, configs que mudam</td></tr></table>'+
'<p>E o detalhe que mais confunde: mudar o ConfigMap <strong>não reinicia os Pods</strong>. O padrão para "recarregar" é <code>kubectl rollout restart deploy</code> — ou, melhor, ancorar o ConfigMap por checksum (comum em charts Helm, Módulo 6):</p>'+
C('bash',`# Recarregar config sem mudar a imagem:
kubectl rollout restart deploy/minha-api

# O truque do checksum (visto em charts Helm):
#   template.metadata.annotations:
#     checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
# Qualquer mudança no ConfigMap muda o checksum → o template muda → rollout acontece.`)+
'<h2>imutabilidade</h2>'+
'<p>ConfigMap (e Secret) críticos podem ser marcados <code>immutable: true</code>: a API rejeita alteração — para mudar, você recria o objeto com outro nome e aponta o Deployment. Isso elimina a classe de bugs de "config mudou sem ninguém perceber".</p>'+
LAB('ConfigMap na prática',
'<ol><li>Crie o ConfigMap <code>api-config</code> acima e um Deployment que o injeta via <code>envFrom</code>.</li>'+
'<li>Confira dentro do Pod: <code>kubectl exec deploy/minha-api -- env | grep ASPNETCORE</code>.</li>'+
'<li>Mude um valor no ConfigMap e aplique — <code>kubectl exec ... env</code> mostra o valor VELHO (env só muda no restart).</li>'+
'<li>Rode <code>kubectl rollout restart deploy/minha-api</code> e confira o valor novo.</li>'+
'<li>Agora monte o MESMO ConfigMap como volume (mountPath <code>/app/config</code>) e veja o arquivo atualizar no Pod vivo.</li></ol>')+
NOTE('A configuração do ASP.NET Core lê variáveis de ambiente automaticamente — e <code>__</code> mapeia para <code>:</code> na hierarquia. Ou seja: <em>zero código</em>, seu <code>IConfiguration</code> simplesmente funciona no cluster. Para ler arquivos montados, adicione o caminho no <code>builder.Configuration</code> ou use <code>appsettings.custom.json</code> com <code>reloadOnChange</code>.')+
WARN('ConfigMap NÃO é para dados sensíveis — ele não é criptografado e aparece em <code>kubectl get -o yaml</code>. Para isso use Secrets (próxima lição). Dica: marque ConfigMaps críticos com <code>immutable: true</code> para evitar mudanças acidentais (exige recriar o objeto para alterar).')+
TERMS([['ConfigMap','Pares chave-valor de configuração (≤ 1 MiB)'],['envFrom','Injeta todas as chaves como variáveis de ambiente'],['Volume de configMap','Monta as chaves como arquivos — atualizam no Pod vivo'],['immutable','ConfigMap/Secret que a API recusa alterar'],['Checksum annotation','Padrão Helm para reiniciar Pods quando a config muda']])+
QUIZ('Você mudou um valor no ConfigMap e aplicou. Por que a API continua com o valor antigo?',
['O ConfigMap não pode mudar','Env vars só mudam quando o Pod reinicia — rode kubectl rollout restart','O etcd não propagou','O kube-proxy bloqueia'],1,
'Isso! Env é "congelado" no start do Pod. Volume montado atualiza o arquivo, mas o app precisa reler.')+
QUIZ('O que NÃO é permitido em ConfigMap?',
['YAML válido como valor','Valores acima de 1 MiB','Chaves com hífen','Valores com espaço'],1,
'Exato! O limite de 1 MiB é duro — acima disso a API rejeita. Para grandes configs, pense em arquivos montados de outra origem.')},
{id:'m3l2',title:'Secrets: dados sensíveis',mins:14,body:
'<p><strong>Secrets</strong> guardam dados sensíveis (connection strings, tokens, certificados). Por padrão são armazenados em base64 no etcd — <em>codificação, não criptografia</em>. Em produção: habilite <strong>encryption at rest</strong> no etcd e/ou use cofres externos (Módulo 8).</p>'+
'<table class="tbl"><tr><th>Tipo de Secret</th><th>Uso</th></tr>'+
'<tr><td><code>Opaque</code> (padrão)</td><td>dados arbitrários</td></tr>'+
'<tr><td><code>kubernetes.io/tls</code></td><td>certificados (usado pelo Ingress)</td></tr>'+
'<tr><td><code>kubernetes.io/dockerconfigjson</code></td><td>credenciais de registry privado (imagePullSecrets)</td></tr>'+
'<tr><td><code>kubernetes.io/service-account-token</code></td><td>tokens de ServiceAccount (legado)</td></tr></table>'+
'<h2>Criando sem vazar para o histórico</h2>'+
C('bash',`# criar sem colocar a senha no histórico do shell:
kubectl create secret generic api-secrets \\
  --from-literal=ConnectionStrings__Default="Server=db;Password=***" \\
  --from-literal=ApiKeyIntegracoes="super-secreta"

kubectl create secret tls api-tls --cert=tls.crt --key=tls.key

# ou a partir de arquivo (a forma mais segura):
kubectl create secret generic api-secrets --from-file=./secrets.env`)+
C('yaml',`spec:
  containers:
  - name: api
    envFrom:
    - secretRef:
        name: api-secrets    # ConnectionStrings__Default vira env var
  # imagem em registry privado:
  imagePullSecrets:
  - name: registry-cred`)+
'<h2>Env vs Volume para Secrets (diferença importante)</h2>'+
'<ul><li><strong>Env:</strong> congelado no start do Pod (como ConfigMap) — e o valor fica visível em <code>kubectl exec -- env</code> para quem tiver acesso ao Pod.</li>'+
'<li><strong>Volume:</strong> monta cada chave como arquivo; atualiza no Pod vivo; <strong>o Secret precisa existir antes</strong> (senão o Pod nem sobe). Padrão preferido quando o app lê de arquivo (ex.: certificados, <code>appsettings</code> com segredo).</li></ul>'+
'<h2>Registry privado: imagePullSecrets</h2>'+
'<p>Para puxar imagem de um registry privado (ACR/GAR/ECR/Docker Hub pago), o node precisa de credencial. Você cria um Secret <code>dockerconfigjson</code> e o referencia no Pod:</p>'+
C('bash',`kubectl create secret docker-registry registry-cred \\
  --docker-server=meuregistry.azurecr.io \\
  --docker-username=meuuser --docker-password=***`)+
C('bash',`# ECR (AWS) na prática — o fluxo completo do push:
aws ecr get-login-password --region us-east-1 | \\
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
# (a senha é temporária — dura ~12h; o login é por registry)

docker tag minha-api:1.0.0 123456789.dkr.ecr.us-east-1.amazonaws.com/minha-api:1.0.0
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/minha-api:1.0.0
# o imagePullSecrets do Pod usa um Secret dockerconfigjson com essas credenciais`)+
'<p>E no YAML do Deployment, <code>spec.imagePullSecrets: - name: registry-cred</code>. O kubernetes.io/dockerconfigjson fica no namespace — não é global.</p>'+
'<h2>O limite de 1 MiB e o que fazer com segredos grandes</h2>'+
'<p>Assim como ConfigMap, Secrets têm <strong>1 MiB</strong>. Não use Secret para arquivos grandes (certificados de CA enormes, bundles): monte-os como volume a partir de um ConfigMap ou injete via cofre externo (Módulo 8: CSI/Key Vault/Secret Manager/Secrets Manager).</p>'+
LAB('Secret na prática',
'<ol><li>Crie o Secret com <code>--from-literal</code> e confira o base64: <code>kubectl get secret api-secrets -o yaml</code>.</li>'+
'<li>Monte como env num Pod e verifique: <code>kubectl exec deploy/minha-api -- env | grep ConnectionStrings</code>.</li>'+
'<li>Monte o MESMO Secret como volume (<code>mountPath: /app/secrets</code>) e veja os arquivos: <code>kubectl exec ... -- ls /app/secrets</code>.</li>'+
'<li>Confira o dado bruto: <code>kubectl get secret api-secrets -o jsonpath=\'{.data.ConnectionStrings__Default}\' | base64 -d</code> — repare: QUALQUER um com acesso de leitura no cluster lê isso. É por isso que encryption at rest + cofres importam.</li></ol>')+
NOTE('No .NET, env vars viram configuração automaticamente, então <code>builder.Configuration.GetConnectionString("Default")</code> funciona sem tocar em arquivo. Segredos grandes demais? Lembre do limite de 1 MiB por Secret — e evite versionar YAML de Secret no Git sem criptografia (SOPS/Sealed Secrets, Módulo 8).')+
TERMS([['Secret','Dados sensíveis em base64 no etcd (codificação, não criptografia)'],['Opaque','Tipo padrão: dados arbitrários'],['dockerconfigjson','Credenciais de registry privado (imagePullSecrets)'],['1 MiB','Limite de tamanho de Secret/ConfigMap'],['imagePullSecrets','Secret que o kubelet usa para baixar imagens privadas']])+
QUIZ('O que significa "base64 não é criptografia"?',
['Que o base64 é reversível e não protege o dado — quem tem acesso lê','Que o etcd criptografa por cima','Que só o admin decodifica','Que o dado é apagado após o uso'],0,
'Exato! base64 é só encoding. Proteção de verdade = encryption at rest + cofres + RBAC mínimo (Módulo 8).')+
QUIZ('Seu Deployment em um namespace usa imagem de um registry privado. O que falta no YAML?',
['Nada — o kubelet adivinha','spec.imagePullSecrets apontando para um Secret dockerconfigjson do namespace','Uma env var com a senha','annotation no Pod'],1,
'Isso! O Secret dockerconfigjson precisa existir no MESMO namespace do Pod.')},
{id:'m3l3',title:'Volumes, PV e PVC',mins:15,body:
'<p>Containers têm filesystem efêmero: arquivos somem com o Pod. Para persistir, o Kubernetes abstrai storage em três camadas:</p>'+
'<ul><li><strong>Volume:</strong> diretório montado no Pod. Tipos comuns: <code>emptyDir</code> (temporário, some com o Pod), <code>configMap</code>/<code>secret</code> (arquivos de config), <code>persistentVolumeClaim</code> (disco).</li>'+
'<li><strong>PersistentVolume (PV):</strong> o "disco" provisionado (Azure Disk, EBS, GCE PD, NFS…).</li>'+
'<li><strong>PersistentVolumeClaim (PVC):</strong> o <em>pedido</em> de storage que o Pod referencia — o dev declara "quanto e como", o cluster resolve "onde".</li></ul>'+
'<h2>emptyDir: memória e compartilhamento entre containers</h2>'+
'<p>O <code>emptyDir</code> nasce vazio com o Pod e <strong>morre com ele</strong> — perfeito para cache e para containers do mesmo Pod compartilharem arquivos. Variante esperta: <code>emptyDir.medium: Memory</code> monta um tmpfs (RAM) — rápido, mas conta para o limite de memória do Pod e some no reboot do node.</p>'+
C('yaml',`spec:
  containers:
  - name: api
    volumeMounts:
    - name: cache
      mountPath: /var/cache
  volumes:
  - name: cache
    emptyDir:
      medium: Memory      # tmpfs (RAM) — some sem rastro
      sizeLimit: 256Mi`)+
'<h2>Volumes efêmeros genéricos: PVC descartável junto do Pod</h2>'+
'<p>Além do <code>emptyDir</code> (disco local do node), existe o <strong>generic ephemeral volume</strong> (estável 1.26+): um <code>volumeClaimTemplate</code> embutido no Pod cria um PVC <em>efêmero</em> — provisionado com o Pod e apagado com ele. É o "emptyDir com superpoderes": storage de rede, tamanho fixo, snapshots e resize (o que o driver permitir).</p>'+
C('yaml',`spec:
  containers:
  - name: api
    volumeMounts:
    - { name: scratch, mountPath: /scratch }
  volumes:
  - name: scratch
    ephemeral:
      volumeClaimTemplate:          # vira um PVC <pod>-<volume> que morre com o Pod
        spec:
          accessModes: ["ReadWriteOnce"]
          storageClassName: "fast"  # usa a StorageClass (disco de rede!)
          resources:
            requests: { storage: 5Gi }`)+
'<p>Uso típico: cache grande, scratch de processamento, dados temporários que precisam de performance/features que o disco local não tem. <strong>Atenção (segurança):</strong> quem pode criar Pods cria PVCs indiretamente — em clusters multi-tenant, restrinja com quota/admission se necessário.</p>'+
'<h2>Storage local: o disco do node como recurso limitável</h2>'+
'<p>O disco local do node (onde ficam os <code>emptyDir</code> e as imagens) também é um recurso contável: <code>ephemeral-storage</code>. Declare requests/limits para ele (detalhe na lição de recursos, Módulo 5) e defina <code>emptyDir.sizeLimit</code> para o kubelet não deixar o container encher o node.</p>'+
'<h2>PV e PVC: o ciclo de vida</h2>'+
'<ol><li><strong>Provisioning:</strong> você cria um PVC (pedido); o StorageClass provisiona o PV automaticamente (ou um admin cria PVs estáticos).</li>'+
'<li><strong>Binding:</strong> o PV "casa" com o PVC (mesmos accessMode e capacidade ≥). Binding é 1:1 — um PV serve um PVC.</li>'+
'<li><strong>Using:</strong> o Pod monta o PVC.</li>'+
'<li><strong>Reclaiming:</strong> quando o PVC é deletado, o PV segue a política da StorageClass: <code>Delete</code> (apaga o disco!) ou <code>Retain</code> (preserva o disco para recuperação manual).</li></ol>'+
C('yaml',`apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: uploads-pvc
spec:
  accessModes: ["ReadWriteOnce"]     # RWO: 1 node; RWX: vários; ROX: leitura p/ vários
  resources:
    requests:
      storage: 10Gi`)+
C('yaml',`spec:
  containers:
  - name: api
    volumeMounts:
    - name: uploads
      mountPath: /app/uploads        # caminho dentro do container
  volumes:
  - name: uploads
    persistentVolumeClaim:
      claimName: uploads-pvc`)+
'<p><strong>Access modes:</strong> <code>ReadWriteOnce</code> (1 node monta; outros nodes podem montar o MESMO PVC? Não — o segundo Pod em outro node fica Pending), <code>ReadOnlyMany</code> (vários nodes, leitura), <code>ReadWriteMany</code> (vários nodes, escrita — exige storage distribuído: Azure Files, EFS, Filestore). Detalhe: o access mode é do <em>volume</em> — o PV declara; o PVC pede compatível.</p>'+
TIP('Dois gotchas clássicos de montagem: <strong>mountPath sobrescreve o diretório existente</strong> — se a pasta do container já tem arquivos, eles ficam "escondidos" atrás do volume; use <code>subPath</code> para montar um arquivo/pasta específica dentro de um diretório que precisa continuar intacto. E o mount <strong>cria diretórios que não existem</strong> no container.')+
TIP('Analogia do binding: o <strong>PVC é a chave e o PV é o armário</strong> — relação monogâmica (1 PVC ↔ 1 PV). E o tamanho: um claim de 1Gi pode casar com um PV de 2Gi (o claim "assume" o tamanho do PV) — a capacidade do claim é o mínimo, não o teto.')+
WARN('Cuidado com a pegadinha do RWO: dois Pods da MESMA réplica em nodes diferentes querendo o mesmo PVC → o segundo fica <code>Pending</code> para sempre. É a causa nº1 de "deploy travado" com uploads compartilhados. Soluções: storage RWX, um Pod por PVC, ou estado fora do cluster (blob/S3).')+
LAB('PVC com PV estático no kind',
'<ol><li>O kind não tem StorageClass dinâmica — crie um PV estático hostPath (caminho dentro do node):</li></ol>'+
C('yaml',`apiVersion: v1
kind: PersistentVolume
metadata: { name: pv-local }
spec:
  capacity: { storage: 1Gi }
  accessModes: ["ReadWriteOnce"]
  hostPath: { path: "/mnt/dados" }   # diretório no NODE (só p/ lab!)
  persistentVolumeReclaimPolicy: Retain`)+
'<ol start="2"><li>Aplique o PV e o PVC acima; <code>kubectl get pv,pvc</code> — o PVC deve ficar <code>Bound</code>.</li>'+
'<li>Monte no Pod e escreva: <code>kubectl exec deploy/minha-api -- sh -c "echo oi > /app/uploads/teste.txt"</code>.</li>'+
'<li>Deletar o Pod e recriar — o arquivo continua (o disco é do PV, não do Pod).</li>'+
'<li>Deletar o PVC com <code>Retain</code>: o PV fica <code>Released</code> (disco preservado). Com <code>Delete</code>, o disco sumiria.</li></ol>')+
NOTE('Em ASP.NET Core, aponte pastas de upload/temp para o mount path via configuração. Com múltiplas réplicas + disco <code>ReadWriteOnce</code>, os Pods precisam cair no mesmo node — para uploads compartilhados use storage <code>RWX</code> (Azure Files, EFS, Filestore) ou, melhor, um blob (Azure Blob/S3/GCS) — que é o padrão recomendado para apps .NET em produção.')+
TERMS([['Volume','Diretório montado no Pod (emptyDir, configMap, secret, PVC)'],['PV','PersistentVolume: o disco provisionado (Azure Disk, EBS, NFS…)'],['PVC','Pedido de storage: "quanto e como" — o cluster resolve "onde"'],['Access mode','RWO / ROX / RWX — quem pode montar e como'],['Reclaim policy','Delete (apaga disco) ou Retain (preserva) ao apagar o PVC']])+
QUIZ('Dois Pods em nodes diferentes usam o mesmo PVC ReadWriteOnce. O segundo fica…',
['Running normalmente','Pending — RWO permite montar em 1 node por vez','Succeeded','Failed com ImagePullBackOff'],1,
'Isso! RWO = um node por vez. Para múltiplos consumidores, RWX ou estado fora do cluster.')+
QUIZ('Um emptyDir com medium: Memory…',
['Persiste entre Pods','Usa RAM (tmpfs) e conta para o limite de memória do Pod','É criptografado','É um disco da nuvem'],1,
'Exato! É um tmpfs: rápido, volátil, e o que ele ocupa conta no memory limit do Pod.')},
{id:'m3l4',title:'StorageClass: provisionamento dinâmico',mins:12,body:
'<p>A <strong>StorageClass</strong> define <em>como</em> o storage é provisionado sob demanda (provisioner + parâmetros + política). Quando seu PVC é criado, o cluster cria o PV automaticamente. Ciclo de vida do PV: <strong>Provisioning</strong> (estático ou dinâmico) → <strong>Binding</strong> → <strong>Using</strong> → <strong>Reclaiming</strong> (<code>Delete</code> apaga o disco; <code>Retain</code> preserva).</p>'+
'<table class="tbl"><tr><th>Cloud</th><th>Provisioners típicos</th><th>Classes comuns</th></tr>'+
'<tr><td>AKS</td><td><code>disk.csi.azure.com</code>, <code>file.csi.azure.com</code></td><td><code>managed-csi</code>, <code>azurefile-csi</code> (RWX)</td></tr>'+
'<tr><td>GKE</td><td><code>pd.csi.storage.gke.io</code></td><td><code>standard-rwo</code>, <code>premium-rwo</code></td></tr>'+
'<tr><td>EKS</td><td><code>ebs.csi.aws.com</code>, <code>efs.csi.aws.com</code> (RWX)</td><td><code>gp2</code>/<code>gp3</code></td></tr></table>'+
'<h2>volumeBindingMode: o timing do disco</h2>'+
'<p>O <code>volumeBindingMode</code> decide QUANDO o disco é criado:</p>'+
'<ul><li><strong><code>Immediate</code></strong> (padrão em vários clouds): o PV nasce no momento do PVC — sem saber onde o Pod vai cair. Em cluster multi-zona, o disco pode nascer na zona errada → Pod sem espaço.</li>'+
'<li><strong><code>WaitForFirstConsumer</code></strong>: o PV só é criado quando o <em>primeiro Pod</em> usa o PVC — então o provisioner cria o disco NA ZONA do Pod. É o modo recomendado para discos zonal (Azure Disk, EBS, PD).</li></ul>'+
C('yaml',`apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: { name: meu-disk-fast }
provisioner: disk.csi.azure.com     # varia por cloud
parameters:
  skuName: Premium_LRS              # parâmetros do provisioner
  cachingMode: ReadOnly
volumeBindingMode: WaitForFirstConsumer   # disco na zona do Pod
allowVolumeExpansion: true                # PVC pode crescer depois
reclaimPolicy: Delete`)+
'<h2>Expansão e snapshots</h2>'+
'<ul><li><strong><code>allowVolumeExpansion: true</code></strong>: permite <code>kubectl patch pvc --type merge -p \'{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}\'</code> — o disco cresce no lugar (não dá para encolher).</li>'+
'<li><strong>Snapshots:</strong> com o <code>VolumeSnapshot</code> + CSI, você tira "foto" do volume (backup/DR) e cria volumes a partir dela.</li></ul>'+
C('bash',`kubectl get storageclass            # o que existe no seu cluster
kubectl get pvc,pv                  # claims e volumes vinculados
kubectl describe pvc uploads-pvc    # por que não vinculou ainda?  ← LEIA OS EVENTS
kubectl get storageclass meu-disk-fast -o yaml`)+
LAB('Diagnosticando storage',
'<ol><li>No kind (sem StorageClass dinâmica), rode <code>kubectl get storageclass</code> — vazio. É por isso que PVCs lá ficam <code>Pending</code>.</li>'+
'<li>Crie um PVC sem PV correspondente e veja: <code>kubectl describe pvc</code> — <em>waiting for a volume to be created</em>.</li>'+
'<li>No seu cluster real (ou com um provisioner instalado via Helm), o fluxo completo: PVC → PV criado em segundos → Pod monta.</li>'+
'<li>Diagnóstico em produção: PVC <code>Pending</code> → <code>kubectl describe pvc</code> + <code>kubectl get events</code> são a resposta (quota, zona, permissão do CSI).</li></ol>')+
TIP('Em produção, quase nunca se cria PV na mão: 99% dos casos usam o provisionamento dinâmico da StorageClass do cloud. PV estático é para legado, NFS próprio ou storage especial.')+
NOTE('Para o .NET: disco <code>WaitForFirstConsumer</code> + uma réplica por zona funciona bem; para múltiplas réplicas escrevendo no mesmo volume, vá de RWX (Azure Files/EFS/Filestore) ou de um objeto store.')+
TERMS([['StorageClass','Receita de provisionamento: provisioner + parâmetros + política'],['Provisioner','Driver CSI que cria o disco (disk.csi.azure.com, ebs.csi.aws.com…)'],['WaitForFirstConsumer','Disco criado na zona do primeiro Pod'],['allowVolumeExpansion','PVC pode crescer (nunca encolher)'],['VolumeSnapshot','"Foto" do volume via CSI — backup/DR']])+
QUIZ('Seu PVC está Pending em produção. Primeiro passo de diagnóstico?',
['kubectl delete e recriar o PVC','kubectl describe pvc (ler os events)','Aumentar o StorageClass','Reiniciar o kubelet'],1,
'Isso! Os events do PVC dizem a causa: quota, zona, permissão do CSI, falta de StorageClass…')+
QUIZ('O que WaitForFirstConsumer resolve?',
['Velocidade do disco','O disco nascer na zona certa (onde o Pod vai cair)','O preço do storage','A criptografia'],1,
'Exato! Com Immediate, o disco pode nascer na zona errada em clusters multi-zona e o Pod fica Pending para sempre.')},
{id:'m3l5',title:'Downward API, LimitRange e ResourceQuota',mins:13,body:
'<p><strong>Downward API</strong> expõe metadados do próprio Pod para o container (via env ou volume) — sem chamar a API do Kubernetes:</p>'+
C('yaml',`spec:
  containers:
  - name: api
    env:
    - name: POD_NAME
      valueFrom: { fieldRef: { fieldPath: metadata.name } }
    - name: POD_NAMESPACE
      valueFrom: { fieldRef: { fieldPath: metadata.namespace } }
    - name: MEM_LIMIT
      valueFrom: { resourceFieldRef: { resource: limits.memory } }`)+
'<p>O que a Downward API consegue expor: <code>metadata.name</code>, <code>metadata.namespace</code>, <code>metadata.labels</code>, <code>metadata.annotations</code>, <code>status.podIP</code>, <code>spec.nodeName</code> e os <strong>requests/limits do container</strong> (<code>resourceFieldRef</code>). Para conjuntos de metadados, use a forma <strong>volume projected</strong>:</p>'+
C('yaml',`spec:
  volumes:
  - name: podinfo
    projected:
      sources:
      - downwardAPI:
          items:
          - path: "labels"
            fieldRef: { fieldPath: metadata.labels }
      - configMap:
          name: api-config
      - secret:
          name: api-secrets`)+
'<h2>LimitRange: padrões por container</h2>'+
'<p>O LimitRange define <strong>padrões e limites por objeto</strong> no namespace (Container, Pod ou PVC). Se um Deployment não declara resources, o LimitRange preenche (default/defaultRequest); se declara abaixo do mínimo (min) ou acima do máximo (max), a criação é <strong>rejeitada</strong>.</p>'+
'<h2>ResourceQuota: teto agregado do namespace</h2>'+
'<p>A quota impõe o <strong>total consumido</strong> no namespace: requests/limits somados, contagem de objetos, storage. É a ferramenta do multi-tenant.</p>'+
C('yaml',`apiVersion: v1
kind: ResourceQuota
metadata: { name: pagamentos-quota, namespace: pagamentos }
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    limits.memory: 64Gi
    count/deployments.apps: "15"
    count/secrets: "20"
    persistentvolumeclaims: "10"
---
apiVersion: v1
kind: LimitRange
metadata: { name: limites, namespace: pagamentos }
spec:
  limits:
  - type: Container
    default: { cpu: "1", memory: 512Mi }           # limit se omitido
    defaultRequest: { cpu: 250m, memory: 256Mi }   # request se omitido`)+
'<p>Escopos úteis da quota: <code>BestEffort</code>/<code>NotBestEffort</code> (ex.: proibir Pods sem recursos), <code>NotTerminating</code> (Pods de longa duração). Exemplo: <code>requests.cpu: "10"</code> com escopo <code>NotBestEffort</code> = Pods com request consumem; BestEffort nem conta.</p>'+
LAB('Quota na prática (e a rejeição que você vai ver na vida real)',
'<ol><li>Crie um namespace de teste e aplique o ResourceQuota acima.</li>'+
'<li>Aplique um Deployment SEM requests/limits → a API <strong>rejeita</strong>: <code>Error from server (Forbidden): ... exceeded quota</code>.</li>'+
'<li>Aplique o LimitRange e repita — agora o Deployment passa (o LimitRange preenche os valores).</li>'+
'<li>Escale além da quota: <code>kubectl scale deploy --replicas=50</code> → os Pods extras ficam <code>Pending</code> (quota estourada). Veja com <code>kubectl describe pod</code>.</li>'+
'<li>Confira o consumo: <code>kubectl get resourcequota pagamentos-quota -o yaml</code> (seções used/hard).</li></ol>')+
WARN('Efeito prático para devs: se o namespace tem ResourceQuota, seu <code>kubectl apply</code> de um Deployment <strong>sem requests/limits</strong> pode ser rejeitado (a menos que um LimitRange preencha os valores). Declarar recursos sempre — você já vai fazer isso por resiliência anyway (Módulo 5).')+
NOTE('No .NET, é comum ler o próprio nome/labels via Downward API para logging estruturado (adicionar <code>pod.name</code> como campo em todo log) e para identificar a réplica em dashboards. O <code>resourceFieldRef</code> também ajuda o app a dimensionar pools internos pelo limite declarado.')+
TERMS([['Downward API','Metadados do Pod expostos como env ou volume (sem chamar a API)'],['Projected volume','Várias fontes (downwardAPI + configMap + secret) num volume só'],['LimitRange','Padrões/mínimos/máximos POR container, Pod ou PVC no namespace'],['ResourceQuota','Teto agregado do namespace (recursos e contagem de objetos)'],['Escopo de quota','BestEffort/NotBestEffort/NotTerminating — a que Pods a quota se aplica']])+
QUIZ('Sua API precisa saber o próprio nome do Pod para logs. Como?',
['Chamando a API do Kubernetes do app','Downward API com fieldRef metadata.name','Lendo o hostname do container (que é o nome do Pod!) — ou Downward API','Um ConfigMap por Pod'],2,
'Certo! O hostname do container já é o nome do Pod (sem caracteres especiais) — e a Downward API é a forma explícita e recomendada.')+
QUIZ('Namespace com quota: seu Deployment sem requests foi REJEITADO. Por quê?',
['O YAML tinha erro de sintaxe','A quota exige requests declarados (ou um LimitRange que os preencha)','O etcd estava cheio','O scheduler recusou'],1,
'Isso! Pods sem requests podem ser rejeitados quando a quota usa escopos NotBestEffort — ou a soma estoura o teto. Sempre declare resources.')}
]};
