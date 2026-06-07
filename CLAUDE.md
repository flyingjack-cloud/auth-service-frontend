# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

本项目是 **flyingjack-cloud** 的认证服务前端，使用 **Angular + Angular Material** 构建。对接后端 auth-service，提供登录、注册、账号管理、OAuth2 客户端管理、管理员用户管理等功能。

所有 API 接口定义（端点、请求/响应格式、权限要求、错误码）均在 `API.md` 中，**开发新功能时必须以 API.md 为准**。

## 技术栈

- **框架**：Angular（最新稳定版）
- **UI 组件库**：Angular Material
- **状态管理**：Angular Signals / RxJS（根据场景选择）
- **HTTP 客户端**：Angular `HttpClient`，通过拦截器统一处理响应格式和错误
- **路由**：Angular Router，使用懒加载（Lazy Loading）按功能模块分割

## 常用命令

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:4200）
ng serve

# 构建生产包
ng build --configuration production

# 运行单元测试
ng test

# 运行单个测试文件
ng test --include='**/auth.service.spec.ts'

# 代码检查
ng lint

# 生成组件/服务/模块
ng generate component features/login
ng generate service core/services/auth
ng generate guard core/guards/auth
```

## 架构说明

### 目录结构约定

```
src/
  app/
    core/           # 全局单例：拦截器、守卫、核心服务（AuthService、SessionService）
    shared/         # 可复用组件、管道、指令
    features/       # 按功能拆分的懒加载模块
      login/
      register/
      account/      # 个人资料、修改密码
      admin/        # 管理员：用户管理、OAuth2 客户端管理
    app.routes.ts   # 根路由，功能模块全部懒加载
```

### API 响应格式

后端所有响应统一包裹：

```json
{ "code": 200, "message": "Success", "data": { ... }, "timestamp": 1743783208000 }
```

需在 `HttpInterceptor` 中统一解包 `data` 字段；错误时 `data` 为 `null`，以 `message` 或 `errorId` 区分原因（详见 `API.md` 错误码速查表）。

### 认证机制

- **Session Cookie**：主要认证方式，登录后由后端通过 `Set-Cookie` 维护，前端无需手动管理 token。HTTP 请求须携带 `withCredentials: true`。
- **OAuth2 PKCE 流程**：`/oauth2/authorize` 返回 JSON 授权码（非重定向），前端需自行实现 PKCE（`code_verifier` / `code_challenge`）逻辑并完成令牌交换。
- **登录失败保护**：连续失败 3 次需附加验证码头（`X-Captcha-ID` / `X-Captcha-Token`），10 次后进入 10 分钟冷却，前端需在登录逻辑中处理这两种状态。

### 权限与路由守卫

后端有三级权限：**公开 / 已登录 / ROLE_ADMIN**。前端路由守卫应通过 `GET /account/check-login` 判断登录状态，并据此保护 `/account/*` 和 `/admin/*` 路由。

### 角色系统

| ID | 角色 |
|----|------|
| 1 | ROLE_ADMIN |
| 2 | ROLE_USER |
| 3 | ROLE_GUEST |

角色更新为**覆盖式**（传完整列表），非追加。

## 后端地址

开发环境：`http://localhost:9001`（在 `environment.development.ts` 中配置 `apiBaseUrl`）
