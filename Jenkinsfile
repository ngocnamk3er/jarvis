pipeline {
  agent any

  environment {
    // From the host's Docker daemon (Jenkins builds/pushes via the mounted
    // socket), so "localhost" is correct here — this is NOT what the
    // manifests reference (they use host.minikube.internal, see
    // k8s/kustomization.yaml).
    REGISTRY = "localhost:5050/root/jarvis"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        // env.GIT_COMMIT here is unreliable — it reflects whatever commit
        // Jenkins last used to fetch *this Jenkinsfile* (a separate,
        // earlier checkout Jenkins does before the pipeline even starts),
        // not necessarily the commit checkout scm just resolved above.
        // Confirmed live: a build tagged its images with a stale SHA from
        // several commits back, silently deploying old code. Read the
        // workspace's actual HEAD instead.
        script {
          env.IMAGE_TAG = sh(script: 'git rev-parse --short=8 HEAD', returnStdout: true).trim()
        }
      }
    }

    stage('Frontend lint & build') {
      steps {
        // Jenkins' own agent has no Node toolchain (deliberately — only
        // Docker/git/kustomize, see jenkins/Dockerfile); run this in the
        // same node image frontend/Dockerfile itself builds from. This is
        // Docker-outside-of-Docker (Jenkins talks to the *host's* daemon
        // via the mounted socket) — docker-workflow's .inside() handles
        // the workspace volume sharing via --volumes-from automatically.
        dir('frontend') {
          script {
            docker.image('node:22-alpine').inside {
              // This host's IPv6 path is broken (see backend/Dockerfile) —
              // node:22-alpine has no /etc/gai.conf fix baked in like our
              // own images do, so npm's registry requests hit the same
              // hang/timeout pattern. --dns-result-order is Node's
              // equivalent IPv4-preference knob.
              withEnv(['NODE_OPTIONS=--dns-result-order=ipv4first']) {
                sh 'npm ci'
                sh 'npm run lint'
                sh 'npm run build'
              }
            }
          }
        }
      }
    }

    stage('Build images') {
      steps {
        sh "docker build -t ${REGISTRY}/jarvis-backend:${IMAGE_TAG} backend"
        sh """docker build \
              --build-arg NEXT_PUBLIC_API_URL=http://api.jarvis.local \
              --build-arg NEXT_PUBLIC_KEYCLOAK_ISSUER=http://auth.jarvis.local/realms/jarvis \
              -t ${REGISTRY}/jarvis-frontend:${IMAGE_TAG} frontend"""
        sh "docker build -t ${REGISTRY}/jarvis-keycloak:${IMAGE_TAG} keycloak"
      }
    }

    stage('Push images') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'gitlab-registry', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          sh 'echo "$REG_PASS" | docker login localhost:5050 -u "$REG_USER" --password-stdin'
          sh "docker push ${REGISTRY}/jarvis-backend:${IMAGE_TAG}"
          sh "docker push ${REGISTRY}/jarvis-frontend:${IMAGE_TAG}"
          sh "docker push ${REGISTRY}/jarvis-keycloak:${IMAGE_TAG}"
        }
      }
    }

    stage('Bump manifests') {
      steps {
        // Jenkins never talks to the cluster (see k8s/frontend.yaml's
        // hostAliases comment — that IP is hardcoded, not resolved here).
        // Only the image tags need bumping.
        dir('k8s') {
          sh """
            kustomize edit set image \
              jarvis-backend=host.minikube.internal:5050/root/jarvis/jarvis-backend:${IMAGE_TAG} \
              jarvis-frontend=host.minikube.internal:5050/root/jarvis/jarvis-frontend:${IMAGE_TAG} \
              jarvis-keycloak=host.minikube.internal:5050/root/jarvis/jarvis-keycloak:${IMAGE_TAG}
          """
        }
        withCredentials([usernamePassword(credentialsId: 'gitlab-repo', usernameVariable: 'GIT_USER', passwordVariable: 'GIT_TOKEN')]) {
          sh '''
            git config user.email "jenkins@localhost"
            git config user.name "jenkins-bot"
            git add k8s/kustomization.yaml
            git diff --cached --quiet && echo "no manifest changes" && exit 0
            git commit -m "ci: bump image tags to ${IMAGE_TAG}"
            git push "http://${GIT_USER}:${GIT_TOKEN}@gitlab:8929/root/jarvis.git" HEAD:main
          '''
        }
      }
    }
  }
}
