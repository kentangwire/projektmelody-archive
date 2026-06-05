FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ARG DEBIAN_FRONTEND=noninteractive
ARG S5CMD_VERSION=2.2.2
ARG JELLYFIN_FFMPEG_VERSION=7.1.4-1

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gcc \
    jq \
    libc6-dev \
    python3 \
    python3-pip \
    qbittorrent-nox \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

# Ubuntu apt ffmpeg is built without NVENC; jellyfin-ffmpeg includes h264_nvenc.
RUN curl -fsSL -o /tmp/jffm.tar.xz \
      "https://github.com/jellyfin/jellyfin-ffmpeg/releases/download/v${JELLYFIN_FFMPEG_VERSION}/jellyfin-ffmpeg_${JELLYFIN_FFMPEG_VERSION}_portable_linux64-gpl.tar.xz" \
  && mkdir -p /opt/jellyfin-ffmpeg \
  && tar -xJf /tmp/jffm.tar.xz -C /opt/jellyfin-ffmpeg \
  && FFMPEG="$(find /opt/jellyfin-ffmpeg -name ffmpeg -type f | head -1)" \
  && FFPROBE="$(find /opt/jellyfin-ffmpeg -name ffprobe -type f | head -1)" \
  && test -n "${FFMPEG}" && test -x "${FFMPEG}" \
  && ln -sf "${FFMPEG}" /usr/local/bin/ffmpeg \
  && ln -sf "${FFPROBE}" /usr/local/bin/ffprobe \
  && ln -sf "${FFMPEG}" /opt/jellyfin-ffmpeg/ffmpeg \
  && ln -sf "${FFPROBE}" /opt/jellyfin-ffmpeg/ffprobe \
  && rm /tmp/jffm.tar.xz

RUN curl -fsSL -o /tmp/s5cmd.tar.gz "https://github.com/peak/s5cmd/releases/download/v${S5CMD_VERSION}/s5cmd_${S5CMD_VERSION}_Linux-64bit.tar.gz" \
  && tar -C /usr/local/bin -xzf /tmp/s5cmd.tar.gz s5cmd \
  && rm -f /tmp/s5cmd.tar.gz \
  && chmod +x /usr/local/bin/s5cmd

RUN python3 -m pip install --no-cache-dir requests faster-whisper

WORKDIR /app
COPY entrypoint.sh /app/entrypoint.sh
COPY run-url.sh /app/run-url.sh
COPY watch-progress.sh /app/watch-progress.sh
COPY watch-upload.sh /app/watch-upload.sh
COPY watch-upload.py /app/watch-upload.py
COPY watch-upload-lite.py /app/watch-upload-lite.py
COPY upload-with-progress.py /app/upload-with-progress.py
COPY github_pr.py /app/github_pr.py
COPY generate_cc.py /app/generate_cc.py
COPY run-cc.sh /app/run-cc.sh
COPY nvenc_fix.c /tmp/nvenc_fix.c

RUN gcc -shared -fPIC -O2 -o /opt/libnvenc_fix.so /tmp/nvenc_fix.c -ldl \
  && rm /tmp/nvenc_fix.c

RUN chmod +x /app/entrypoint.sh /app/run-url.sh /app/watch-progress.sh /app/watch-upload.sh /app/watch-upload.py /app/watch-upload-lite.py /app/upload-with-progress.py

ENV MODE=run
ENV WORK_DIR=/work
ENV IDLE=1
ENV NVIDIA_DRIVER_CAPABILITIES=compute,video,utility
ENV NVIDIA_VISIBLE_DEVICES=all

ENTRYPOINT ["/app/entrypoint.sh"]
