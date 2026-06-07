# 统一认证中心前端设计文档

**日期**：2026-06-07
**项目**：flyingjack-cloud / auth-service-frontend
**技术栈**：Angular（Standalone Components）+ Angular Material + Signals

---

## 一、总体架构

采用 **Angular multi-project workspace + 精简共享库** 方案：

- 一个 Angular workspace，包含两个独立 app 和一个共享库
- 所有组件使用 Angular Standalone Components（Angular 17+ 风格）
- 状态管理使用 Angular Signals；HTTP 层使用 RxJS
- 两个 app 各自独立部署，通过 TypeScript path alias `@shared/*` 引用共享库

---

## 二、Workspace 目录结构

```
angular.json
projects/
  auth-portal/                    ← 用户前台
  admin-portal/                   ← 管理后台
libs/
  shared/
    src/
      api/                        ← API service（按模块分文件）
      interceptors/               ← ApiInterceptor
      guards/                     ← authGuard、adminGuard
      utils/                      ← PKCE 工具函数
      components/                 ← LoadingButton、ErrorAlert 等少量共用 UI
      models/                     ← 共享 TS interface（User、Client、ApiResponse）
```

两个 app 各自维护独立的 `app.routes.ts`、`app.config.ts`、`environments/`。

---

## 三、用户前台（auth-portal）

### 3.1 视觉风格

现代轻量风：浅色调、卡片式布局、大圆角。登录/注册类页面无导航栏，居中卡片 + 品牌 logo 区域。

### 3.2 路由结构

```
/                     → 重定向：已登录 → /account，未登录 → /login
/login                → 登录页（公开）
/register             → 注册页（公开）
/reset-password       → 找回密码（公开）
/oauth2/consent       → OAuth2 授权同意页（authGuard 保护）
/account              → 个人中心 layout（authGuard 保护）
  /account/profile    → 个人资料（查看 + 修改用户名）
  /account/security   → 安全设置（修改密码）
```

### 3.3 布局组件

- **`AuthLayoutComponent`**：登录、注册、找回密码共用的无导航 shell，内容居中卡片
- **`AccountShellComponent`**：个人中心 shell，含顶部导航栏（logo + 用户名 + 退出）和左侧 tab 导航

### 3.4 页面说明

**LoginComponent**
- 支持用户名/手机/邮箱三种登录方式（`loginType` 枚举），通过 `mat-tab-group` 切换
- 失败计数由 Signal 维护：
  - ≥ 3 次：展示 `CaptchaFieldComponent`，请求头附加 `X-Captcha-ID` / `X-Captcha-Token`
  - ≥ 10 次：展示冷却倒计时（10 分钟），禁用提交按钮
- 登录成功后：有 `redirect_uri` 参数则继续 OAuth2 流程，否则跳转 `/account`

**RegisterComponent**
- 注册方式：手机或邮箱（`registerType` 枚举），填写后点击"发送验证码"（60s 倒计时按钮），输入验证码 + 密码完成注册
- 实时校验：用户名/邮箱/手机号可用性（debounce 调用 `/account/check/*`）

**ResetPasswordComponent**
- 流程：输入邮箱或手机号 → 点击"发送验证码"（60s 倒计时）→ 输入新密码 + 验证码 → 提交

**OAuth2ConsentComponent**
- 从 URL query params 读取：`client_id`、`redirect_uri`、`scope`、`code_challenge`、`code_challenge_method`、`state`
- 展示：客户端名称、头像（`avatarUrl`）、请求的 scope 列表
- "授权"：调用 `POST /oauth2/authorize`，拿到 `{ code }` 后拼接 `redirect_uri?code=...&state=...` 跳转
- "拒绝"：携带 `error=access_denied` 跳回 `redirect_uri`

**ProfileComponent / SecurityComponent**
- Profile：展示并内联编辑用户名（5-15 位小写字母数字），提交调用 `PUT /account/profile`
- Security：旧密码 + 新密码表单，提交调用 `POST /account/change-password`，旧密码错误展示 `401 WRONG_PASSWORD` 提示

---

## 四、管理后台（admin-portal）

### 4.1 视觉风格

企业风：深色顶部 toolbar + 白色内容区，低饱和度配色，信息密度高。

### 4.2 路由结构

```
/login                → 管理员登录页（公开，登录成功后跳转 /users）
/                     → 重定向到 /users
/users                → 用户列表（adminGuard 保护）
/users/:id            → 用户详情
/clients              → OAuth2 客户端列表（adminGuard 保护）
/clients/new          → 创建客户端
/clients/:clientId    → 客户端详情（编辑 / 删除）
```

未登录访问受保护路由 → 跳 `/login`；已登录但无 `ROLE_ADMIN` → 显示 403 页面。

### 4.3 Shell 布局（AdminShellComponent）

- 顶部固定 toolbar：logo + 应用名 + 右侧用户名 + 退出
- 左侧固定 sidenav：导航项"用户管理"和"客户端管理"，active 状态高亮
- 内容区：`<router-outlet>`

### 4.4 页面说明

**UserListComponent**
- `mat-table` + 服务端分页（`mat-paginator`）
- 顶部搜索框 debounce 500ms 后触发 `GET /admin/users?search=&page=&size=`
- 列：用户名、邮箱、手机号、角色、状态、注册时间
- 行内操作：`mat-slide-toggle` 切换启用/禁用，直接调用 `PUT /admin/users/:id/status`
- 点击行跳转用户详情

**UserDetailComponent**
- 展示用户完整信息
- 账号状态：enabled / accountNonLocked 两个开关
- 角色分配：`mat-checkbox` 组，覆盖式提交 `PUT /admin/users/:id/roles`
- 危险操作：删除用户（`DELETE /admin/users/:id`），需二次确认对话框

**ClientListComponent**
- 卡片式 grid 展示每个客户端（名称、头像、clientId、创建时间）
- 顶部"新建客户端"按钮跳转 `/clients/new`

**ClientFormComponent**（新建 / 编辑共用）
- 路由参数区分：`/clients/new` vs `/clients/:clientId`
- `mat-tab` 分两个 tab：
  - **基本信息**：clientId、clientName、clientSecret、redirectUris、scopes、description、contactEmail、avatarUrl
  - **高级设置**：authorizationGrantTypes、clientAuthenticationMethods、requireProofKey、accessTokenTtlHours、refreshTokenTtlDays
- 编辑时 clientSecret 留空表示不修改
- 保存：新建调 `POST /clients/`（201），编辑调 `PUT /clients/:clientId`（200）

---

## 五、共享库核心实现

### 5.1 ApiInterceptor

功能一：所有请求自动附加 `withCredentials: true`。

功能二：响应解包 —— 将 `{ code, message, data, timestamp }` 解包为 `data`，service 层直接拿到业务对象。

功能三：错误处理 —— 从响应体提取 `message` 和 `errorId`，抛出自定义 `ApiError`，组件层捕获后按 `errorId` 展示对应文案（参见 API.md 错误码速查表）。

### 5.2 AuthService

```ts
currentUser = signal<User | null>(null);
isLoggedIn  = computed(() => this.currentUser() !== null);
```

- `APP_INITIALIZER` 启动时调用 `GET /account/check-login` 初始化
- `login()` / `logout()` 后同步更新 Signal
- 两个 app 各自独立引入，无跨 app 状态共享

### 5.3 PKCE 工具（pkce.utils.ts）

三个纯函数，无第三方依赖，使用 Web Crypto API：

- `generateCodeVerifier()` → 128 字节随机 Base64URL 字符串
- `generateCodeChallenge(verifier)` → SHA-256(verifier) 的 Base64URL 编码
- `generateState()` → 随机防 CSRF 字符串

`code_verifier` 在发起 `/oauth2/authorize` 前存入 `sessionStorage`，token 交换完成后清除。

### 5.4 路由守卫

- **`authGuard`**：`isLoggedIn()` 为 false → 跳 `/login`
- **`adminGuard`**：`currentUser()?.roles` 不含 `ROLE_ADMIN` → 返回 `/403` 路由

---

## 六、错误处理约定

- API 错误通过 `ApiError.errorId` 区分，组件层维护一个 `errorMessage` Signal 展示在表单顶部
- 网络错误（无响应）展示通用"服务暂时不可用"提示
- 表单校验错误在字段下方实时展示，不依赖 API 调用
- 删除等危险操作统一使用 `MatDialog` 二次确认

---

## 七、环境配置

```ts
// environment.development.ts
export const environment = {
  apiBaseUrl: 'http://localhost:9001',
};
```

`ApiInterceptor` 从 `environment.apiBaseUrl` 读取 base URL，拼接到每个请求前。

---

## 八、范围边界（本期不做）

- 第三方社交登录（Google、GitHub OAuth）
- 邮件/短信验证码的实际发送由 third-party-service 处理，前端仅调用相应 API 触发发送
- 国际化（i18n）
- 管理后台的深色主题切换（后台固定企业风浅色内容区）
