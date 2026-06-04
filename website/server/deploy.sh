#!/bin/bash
set -e

SERVER_IP="42.121.119.93"
REMOTE_DIR="/opt/lookmore-server"

echo "=== 1. 上传代码 ==="
rsync -avz --exclude 'node_modules' --exclude '.DS_Store' ./ root@${SERVER_IP}:${REMOTE_DIR}/

echo ""
echo "=== 2. 上传 .env 文件 ==="
scp ~/Desktop/.env root@${SERVER_IP}:${REMOTE_DIR}/.env

echo ""
echo "=== 3. 安装依赖 ==="
ssh root@${SERVER_IP} "cd ${REMOTE_DIR} && npm install --production"

echo ""
echo "=== 4. 配置 Nginx ==="
ssh root@${SERVER_IP} "cp ${REMOTE_DIR}/nginx.conf /etc/nginx/sites-available/lookmore && \
  ln -sf /etc/nginx/sites-available/lookmore /etc/nginx/sites-enabled/ && \
  rm -f /etc/nginx/sites-enabled/default && \
  mkdir -p /etc/nginx/ssl"

echo ""
echo "=== 5. 配置 systemd 服务 ==="
ssh root@${SERVER_IP} "cp ${REMOTE_DIR}/lookmore.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable lookmore"

echo ""
echo "=== 6. 重启服务 ==="
ssh root@${SERVER_IP} "systemctl restart lookmore && systemctl reload nginx || true"

echo ""
echo "=== 完成 ==="
echo "请确认已手动完成以下步骤："
echo "1. 上传 SSL 证书到 /etc/nginx/ssl/"
echo "2. ssh root@42.121.119.93 'nginx -t && systemctl reload nginx'"
echo "3. ssh root@42.121.119.93 'journalctl -u lookmore -f' 查看服务日志"
