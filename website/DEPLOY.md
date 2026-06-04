# Lookmore撸猫 部署指南

## 一、阿里云 ECS 环境准备

SSH 登录服务器后执行：

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs nginx

# 验证
node -v   # 应显示 v18.x.x
npm -v

# 启动 nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## 二、上传后端代码并配置

```bash
# 在服务器上创建目录
mkdir -p /opt/lookmore && cd /opt/lookmore

# 将本项目的 server/ 目录上传到服务器
# 方式1: scp
# scp -r server/* user@your-server:/opt/lookmore/

# 方式2: git clone（如果推送到了 GitHub）
# git clone <your-repo-url> /opt/lookmore

# 创建 .env 文件
cp .env.example .env
nano .env  # 填入真实的 LAZYMANCHAT_EMAIL 和 LAZYMANCHAT_PASSWORD

# 安装依赖
npm install

# 测试启动
node index.js
# 看到 "Lookmore server running on port 3000" 表示成功
# Ctrl+C 停止
```

## 三、使用 PM2 守护进程

```bash
# 安装 pm2
sudo npm install -g pm2

# 启动服务
pm2 start index.js --name lookmore

# 设置开机自启
pm2 save
pm2 startup
# 按照提示执行输出的命令

# 常用命令
pm2 status          # 查看状态
pm2 logs lookmore   # 查看日志
pm2 restart lookmore # 重启
```

## 四、配置 Nginx 反向代理 + HTTPS

### 4.1 域名解析

将你的域名 A 记录指向阿里云 ECS 的公网 IP。

### 4.2 申请 SSL 证书（Let's Encrypt 免费）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名.com
```

### 4.3 Nginx 配置

编辑 `/etc/nginx/sites-available/lookmore`：

```nginx
server {
    listen 443 ssl http2;
    server_name 你的域名.com;

    ssl_certificate /etc/letsencrypt/live/你的域名.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/你的域名.com/privkey.pem;

    # 请求体大小限制（支持文件上传）
    client_max_body_size 50m;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_buffering off;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/lookmore /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 五、微信小程序后台配置

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 开发管理 → 开发设置
3. **服务器域名** → 点击修改：
   - `request合法域名` 添加：`https://你的域名.com`
4. 保存后等待几分钟生效

## 六、修改小程序 API 地址

编辑 `miniprogram/app.js`，将 `apiBase` 改为你的服务器域名：

```javascript
globalData: {
  apiBase: 'https://你的域名.com',
  // ...
}
```

## 七、上传小程序体验版

1. 打开微信开发者工具
2. 导入项目，选择项目根目录
3. AppID 填入 `wx376293e9f4b2b85b`
4. 点击工具栏 **上传** 按钮
5. 版本号填 `1.0.0`，备注填 `初始版本`
6. 上传成功后，登录微信公众平台 → 管理 → 版本管理
7. 在开发版中找到刚上传的版本，设为 **体验版**
8. 在 **成员管理** 中添加团队成员为体验者（需先关注你的小程序）
9. 团队成员通过体验版二维码或邀请链接打开小程序

## 八、验证清单

- [ ] 服务器上 `node index.js` 能正常启动
- [ ] `curl http://localhost:3000/api/conversations` 返回 `{"conversations":[]}`
- [ ] HTTPS 证书生效，浏览器访问 `https://你的域名.com/api/conversations` 能正常返回
- [ ] 微信开发者工具中 API 调用成功
- [ ] 小程序体验版可正常使用
- [ ] 文件上传功能正常
