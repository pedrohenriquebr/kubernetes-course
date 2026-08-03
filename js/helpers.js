/* ============================================================ HELPERS */
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const C = (lang, code) => '<div class="codeblock"><div class="cb-head"><span>'+lang+'</span><button class="copy-btn" type="button">copiar</button></div><pre class="language-'+lang+'"><code class="language-'+lang+'">'+esc(code)+'</code></pre></div>';
const FIG = (src, cap) => '<img class="fig" src="'+src+'" alt="'+esc(cap)+'"><div class="figcap">'+cap+'</div>';
const NOTE = h => '<div class="callout note"><b>💙 Nota .NET →</b> '+h+'</div>';
const CLOUD = h => '<div class="callout cloud"><b>☁️ Nos providers →</b> '+h+'</div>';
const WARN = h => '<div class="callout warn"><b>⚠️ Atenção →</b> '+h+'</div>';
const DOC = h => '<div class="callout doc"><b>📘 Doc oficial →</b> '+h+'</div>';
const QUIZ = (q, opts, correct, explain) => '<div class="quiz" data-correct="'+correct+'" data-explain="'+esc(explain)+'"><span class="quiz-tag">⚡ Quick check</span><p class="quiz-q">'+q+'</p>'+opts.map(function(o,i){return '<button class="quiz-opt" data-i="'+i+'" type="button">'+o+'</button>';}).join('')+'<p class="quiz-fb"></p></div>';
const LAB = (t, html) => '<div class="callout lab"><b>🧪 Mão na massa — '+t+' →</b> '+html+'</div>';
const TIP = h => '<div class="callout tip"><b>💡 Dica →</b> '+h+'</div>';
const DEEP = h => '<div class="callout deep"><b>🔬 Aprofundamento →</b> '+h+'</div>';
const TERMS = arr => '<div class="terms">'+arr.map(function(t){return '<div><dt>'+t[0]+'</dt><dd>'+t[1]+'</dd></div>';}).join('')+'</div>';

const IMG = {
  hero:'https://image.qwenlm.ai/public_source/3785727c-606f-4899-afd6-c314f0f6af5b/1aa9d97be-7a21-4db8-b7da-eaf64d58ce5c.png',
  deploy:'https://image.qwenlm.ai/public_source/3785727c-606f-4899-afd6-c314f0f6af5b/15d34ddba-1079-417b-8531-7f7a2d125509.png',
  ingress:'https://image.qwenlm.ai/public_source/3785727c-606f-4899-afd6-c314f0f6af5b/1ca88d9ef-f922-4179-97f0-b1b184e9c37d.png'
};

const ARCH_SVG = '<svg viewBox="0 0 940 470" style="width:100%;border-radius:16px;border:1px solid var(--line);background:#0d1730;margin:16px 0 6px" font-family="Inter,sans-serif">'+
'<rect x="24" y="26" width="392" height="418" rx="18" fill="#101f3a" stroke="#38bdf8" stroke-width="2"/>'+
'<text x="220" y="62" fill="#22d3ee" font-size="20" font-weight="800" text-anchor="middle">Control Plane</text>'+
'<rect x="52" y="84" width="336" height="70" rx="12" fill="#0c2038" stroke="#22d3ee" stroke-width="1.6"/><text x="220" y="112" fill="#e2e8f0" font-size="16" font-weight="700" text-anchor="middle">kube-apiserver</text><text x="220" y="134" fill="#94a3b8" font-size="11.5" text-anchor="middle">a "porta de entrada" de toda operação (REST)</text>'+
'<rect x="52" y="168" width="336" height="70" rx="12" fill="#0c2038" stroke="#22d3ee" stroke-width="1.6"/><text x="220" y="196" fill="#e2e8f0" font-size="16" font-weight="700" text-anchor="middle">etcd</text><text x="220" y="218" fill="#94a3b8" font-size="11.5" text-anchor="middle">banco chave-valor distribuído (estado do cluster)</text>'+
'<rect x="52" y="252" width="336" height="70" rx="12" fill="#0c2038" stroke="#22d3ee" stroke-width="1.6"/><text x="220" y="280" fill="#e2e8f0" font-size="16" font-weight="700" text-anchor="middle">kube-scheduler</text><text x="220" y="302" fill="#94a3b8" font-size="11.5" text-anchor="middle">decide em qual node cada Pod vai rodar</text>'+
'<rect x="52" y="336" width="336" height="70" rx="12" fill="#0c2038" stroke="#22d3ee" stroke-width="1.6"/><text x="220" y="364" fill="#e2e8f0" font-size="16" font-weight="700" text-anchor="middle">kube-controller-manager</text><text x="220" y="386" fill="#94a3b8" font-size="11.5" text-anchor="middle">loops de reconciliação (estado atual → desejado)</text>'+
'<rect x="470" y="26" width="446" height="200" rx="18" fill="#101f3a" stroke="#a78bfa" stroke-width="2"/>'+
'<text x="693" y="58" fill="#a78bfa" font-size="18" font-weight="800" text-anchor="middle">Worker Node 1</text>'+
'<rect x="494" y="74" width="150" height="52" rx="10" fill="#0c2038" stroke="#22d3ee"/><text x="569" y="105" fill="#e2e8f0" font-size="14" font-weight="700" text-anchor="middle">kubelet</text>'+
'<rect x="494" y="134" width="150" height="52" rx="10" fill="#0c2038" stroke="#22d3ee"/><text x="569" y="165" fill="#e2e8f0" font-size="14" font-weight="700" text-anchor="middle">kube-proxy</text>'+
'<rect x="660" y="74" width="118" height="52" rx="10" fill="#0e3350" stroke="#34d399"/><text x="719" y="105" fill="#a7f3d0" font-size="13.5" font-weight="700" text-anchor="middle">Pod</text>'+
'<rect x="790" y="74" width="104" height="52" rx="10" fill="#0e3350" stroke="#34d399"/><text x="842" y="105" fill="#a7f3d0" font-size="13.5" font-weight="700" text-anchor="middle">Pod</text>'+
'<rect x="660" y="134" width="234" height="52" rx="10" fill="#0c2038" stroke="#22d3ee"/><text x="777" y="165" fill="#e2e8f0" font-size="13.5" font-weight="700" text-anchor="middle">container runtime</text>'+
'<rect x="470" y="244" width="446" height="200" rx="18" fill="#101f3a" stroke="#a78bfa" stroke-width="2"/>'+
'<text x="693" y="276" fill="#a78bfa" font-size="18" font-weight="800" text-anchor="middle">Worker Node 2</text>'+
'<rect x="494" y="292" width="150" height="52" rx="10" fill="#0c2038" stroke="#22d3ee"/><text x="569" y="323" fill="#e2e8f0" font-size="14" font-weight="700" text-anchor="middle">kubelet</text>'+
'<rect x="494" y="352" width="150" height="52" rx="10" fill="#0c2038" stroke="#22d3ee"/><text x="569" y="383" fill="#e2e8f0" font-size="14" font-weight="700" text-anchor="middle">kube-proxy</text>'+
'<rect x="660" y="292" width="118" height="52" rx="10" fill="#0e3350" stroke="#34d399"/><text x="719" y="323" fill="#a7f3d0" font-size="13.5" font-weight="700" text-anchor="middle">Pod</text>'+
'<rect x="790" y="292" width="104" height="52" rx="10" fill="#0e3350" stroke="#34d399"/><text x="842" y="323" fill="#a7f3d0" font-size="13.5" font-weight="700" text-anchor="middle">Pod</text>'+
'<rect x="660" y="352" width="234" height="52" rx="10" fill="#0c2038" stroke="#22d3ee"/><text x="777" y="383" fill="#e2e8f0" font-size="13.5" font-weight="700" text-anchor="middle">container runtime</text>'+
'<g stroke="#22d3ee" stroke-width="2.4" fill="none"><path d="M416 140 C 450 140 440 126 470 126" marker-end="url(#ar)"/><path d="M416 240 C 450 240 440 344 470 344" marker-end="url(#ar)"/></g>'+
'<defs><marker id="ar" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L8,4.5 L0,9 z" fill="#22d3ee"/></marker></defs>'+
'</svg>';
