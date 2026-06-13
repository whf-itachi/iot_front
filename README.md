# IoT Frontend — 叶片加工监控平台前端

基于 **Vue 3 + Vite** 的 IoT 叶片加工监控系统前端，提供设备管理、数据大屏、用户管理、租户管理等页面。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.5 | 前端框架 |
| Vite | 6.2 | 构建工具 |
| Pinia | 2.3 | 状态管理 |
| Vue Router | 4.5 | 路由管理 |
| ECharts | 6.1 | 数据可视化图表 |
| Axios | 1.7 | HTTP 请求 |
| ExcelJS | 4.4 | Excel 导入导出 |
| jsPDF + html2canvas | - | PDF 导出 |

## 项目结构

```
iot_front/
├── src/
│   ├── main.js              # 应用入口
│   ├── App.vue              # 根组件
│   ├── api/
│   │   └── index.js         # Axios 封装 & API 接口定义
│   ├── router/
│   │   └── index.js         # 路由配置
│   ├── stores/
│   │   └── auth.js          # 认证状态管理（Pinia）
│   ├── assets/
│   │   └── style.css        # 全局样式
│   └── views/               # 页面组件
│       ├── Login.vue        #   登录页
│       ├── Layout.vue       #   布局框架（侧边栏 + 顶栏）
│       ├── Dashboard.vue    #   仪表盘首页
│       ├── BigScreen.vue    #   数据大屏
│       ├── DeviceList.vue   #   设备列表
│       ├── DeviceDetail.vue #   设备详情

│       ├── FlatnessData.vue #   平整度数据
│       ├── BladeProcessLog.vue#  叶片加工过程日志
│       ├── TenantManagement.vue# 租户管理
│       ├── UserManagement.vue#   用户管理
│       └── Profile.vue      #   个人中心
├── index.html               # HTML 入口
├── vite.config.js           # Vite 配置
├── package.json             # 依赖配置
├── .env.development         # 开发环境变量
├── .env.production          # 生产环境变量
└── .gitignore               # Git 忽略规则
```

## 快速开始

### 环境要求

- Node.js 18+

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

开发环境配置（`.env.development`）：

```env
VITE_API_BASE=http://localhost:8080
VITE_IOT_PROXY=http://localhost:8086
VITE_API_TIMEOUT=30000
VITE_DEFAULT_PAGE_SIZE=20
VITE_ENABLE_DEV_LOGIN=false
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问：http://localhost:3000

### 4. 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录，可直接部署到 Nginx 等静态服务器。

## 页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/login` | Login | 登录页 |
| `/` | Dashboard | 仪表盘首页 |
| `/devices` | DeviceList | 设备列表 |
| `/devices/:id` | DeviceDetail | 设备详情 |
| `/flatness` | FlatnessData | 平整度数据 |
| `/blade-log` | BladeProcessLog | 叶片加工过程日志 |
| `/tenants` | TenantManagement | 租户管理（管理员） |
| `/users` | UserManagement | 用户管理（管理员） |
| `/profile` | Profile | 个人中心 |

## Nginx 部署示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
