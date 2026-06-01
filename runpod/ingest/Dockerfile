FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ARG DEBIAN_FRONTEND=noninteractive
ARG S5CMD_VERSION=2.2.2
ARG JELLYFIN_FFMPEG_VERSION=7.1.4-1

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    jq \
    python3 \
    python3-pip \
    qbittorrent-nox \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

# Ubuntu apt ffmpeg is built without NVENC; jellyfin-ffmpeg includes h264_nvenc.
RUN curl -fsSL -o /tmp/jffm.tar.xz \
      "https://github.com/jellyfin/jellyfin-ffmpeg/releases/download/v${JELLYFIN_FFMPEG_VERSION}/jellyfin-ffmpeg_${JELLYFIN_FFMPEG_VERSION}_portable_linux64-gpl.tar.xz" \
  && mkdir -p /opt/jellyfin-ffmpeg \
  && tar -xJf /tmp/jffm.tar.xz -C /opt/jellyfin-ffmpeg --strip-components=1 \
  && ln -sf /opt/jellyfin-ffmpeg/ffmpeg /usr/local/bin/ffmpeg \
  && ln -sf /opt/jellyfin-ffmpeg/ffprobe /usr/local/bin/ffprobe \
  && rm /tmp/jffm.tar.xz

RUN curl -fsSL -o /tmp/s5cmd.tar.gz "https://github.com/peak/s5cmd/releases/download/v${S5CMD_VERSION}/s5cmd_${S5CMD_VERSION}_Linux-64bit.tar.gz" \
  && tar -C /usr/local/bin -xzf /tmp/s5cmd.tar.gz s5cmd \
  && rm -f /tmp/s5cmd.tar.gz \
  && chmod +x /usr/local/bin/s5cmd

RUN python3 -m pip install --no-cache-dir requests

WORKDIR /app
COPY entrypoint.sh /app/entrypoint.sh
COPY run-url.sh /app/run-url.sh
COPY github_pr.py /app/github_pr.py

RUN chmod +x /app/entrypoint.sh /app/run-url.sh

ENV MODE=run
ENV WORK_DIR=/work
ENV IDLE=1

ENTRYPOINT ["/app/entrypoint.sh"]
