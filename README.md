# K8s para Devs .NET — Curso Completo de Kubernetes

Curso completo de **Kubernetes para desenvolvedores .NET** (iniciante → avançado), 100% client-side e instalável como **PWA** (funciona offline).

## 📚 Conteúdo

- **11 módulos / 60 lições** (~14h de conteúdo): fundamentos, workloads, configuração/storage, redes (Ingress/Gateway API), resiliência/autoscaling, Helm/CI-CD/GitOps, observabilidade, segurança, AKS × GKE × EKS e projeto final (com rota para certificação CKAD).
- Agnóstico de provider: tudo que você aprende funciona em **AKS, GKE e EKS**.
- Labs práticos (**🧪 Mão na massa**) com `kind`/`kubectl`, quizzes, termos-chave e seções de troubleshooting.
- Pontes constantes com o ecossistema **.NET** (ASP.NET Core, Workers, OpenTelemetry, GC, Azure.Identity…).

## 🚀 Como rodar

Basta servir a pasta (o site é estático):

```bash
# Python
python -m http.server 8080
# ou Node
npx serve .
```

Abra `http://localhost:8080`.

### PWA / offline

- `manifest.webmanifest` — instalação como app (ícones em `icons/`).
- `sw.js` — service worker com precache completo (shell + módulos + CDN) e fallback offline.
- Ao publicar uma nova versão, **incremente `CACHE_VERSION`** no `sw.js`.

## 🌐 Hospedagem

GitHub Pages (branch `main`, raiz): `https://<usuario>.github.io/kubernetes-course/`

## 🗂 Estrutura

```
index.html            # casca (CSS + HTML + registro do SW)
js/
  helpers.js          # helpers de conteúdo (C, NOTE, LAB, QUIZ…)
  curso.js            # monta COURSE a partir dos módulos
  app.js              # render, roteador, busca, quiz
  modulos/mod0..10.js # um arquivo por módulo
manifest.webmanifest  # PWA
sw.js                 # service worker (cache offline)
icons/                # ícones do PWA (SVG + PNG 192/512)
transcricoes/         # transcrições dos vídeos de referência
```

## 🎬 Vídeos de referência

- [Complete Kubernetes Course — From BEGINNER to PRO](https://www.youtube.com/watch?v=2T86xAtR6Fo) (DevOps Directive)
- [Seu Primeiro Projeto Prático DevOps COMPLETO](https://www.youtube.com/watch?v=UEoxMU_l2xs) (Maria Lazara)
- [Kubernetes Zero to Hero: The Complete Beginner's Guide (2025)](https://www.youtube.com/watch?v=MTHGoGUFpvE)
