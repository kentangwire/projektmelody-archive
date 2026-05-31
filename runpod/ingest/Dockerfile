FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ARG DEBIAN_FRONTEND=noninteractive
ARG S5CMD_VERSION=2.2.2

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    jq \
    python3 \
    python3-pip \
    qbittorrent-nox \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/s5cmd.tar.gz "https://github.com/peak/s5cmd/releases/download/v${S5CMD_VERSION}/s5cmd_${S5CMD_VERSION}_Linux-64bit.tar.gz" \
  && tar -C /usr/local/bin -xzf /tmp/s5cmd.tar.gz s5cmd \
  && rm -f /tmp/s5cmd.tar.gz \
  && chmod +x /usr/local/bin/s5cmd

RUN python3 -m pip install --no-cache-dir requests

WORKDIR /app
COPY entrypoint.sh /app/entrypoint.sh
COPY github_pr.py /app/github_pr.py

RUN chmod +x /app/entrypoint.sh

ENV MODE=run
ENV WORK_DIR=/work

ENTRYPOINT ["/app/entrypoint.sh"]
