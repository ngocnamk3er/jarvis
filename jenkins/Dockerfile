FROM jenkins/jenkins:lts-jdk17

USER root

# This host's IPv6 path is broken (see backend/Dockerfile for the same fix) —
# make getaddrinfo prefer IPv4-mapped addresses so apt downloads don't hang.
RUN echo "precedence ::ffff:0:0/96  100" >> /etc/gai.conf

# Docker CLI (jobs talk to the host's Docker daemon via the socket mounted
# in docker-compose.yml, no dockerd running in this container) + git (the
# base image doesn't bundle a git binary the Git plugin can shell out to).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg git \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
      > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# kustomize — the Jenkinsfile's manifest-bump stage uses
# `kustomize edit set image` to point k8s/kustomization.yaml at the
# just-pushed, commit-SHA-tagged images.
# set -o pipefail matters here: without it, a curl failure mid-stream
# (this host's network is intermittently flaky — see the IPv6 comment
# above) leaves tar operating on a truncated/empty stream, which can exit
# 0 having extracted nothing — silently passing the RUN step with no
# kustomize binary present at all (confirmed live: happened on a prior
# build with no error, only caught later at pipeline runtime).
RUN set -o pipefail && \
    curl -fsSL "https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2Fv5.5.0/kustomize_v5.5.0_linux_amd64.tar.gz" \
      | tar -xz -C /usr/local/bin kustomize \
    && chmod +x /usr/local/bin/kustomize \
    && /usr/local/bin/kustomize version

USER jenkins

# jenkins-plugin-cli is a JVM tool — it ignores glibc's /etc/gai.conf above
# and does its own IPv6-first resolution, which hangs on this host's broken
# IPv6 path exactly like the plain apt/pip downloads did. Force IPv4 at the
# JVM level too.
ENV JAVA_TOOL_OPTIONS="-Djava.net.preferIPv4Stack=true"

RUN jenkins-plugin-cli --plugins \
      git:latest \
      workflow-aggregator:latest \
      docker-workflow:latest \
      gitlab-plugin:latest \
      pipeline-stage-view:latest
