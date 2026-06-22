# 第一部分 -  auth-service API 文档

> **Base URL**
> - Dev：`http://localhost:9001`
> - Prod：`https://auth.flyingjack.top`
>
> **路径前缀（prod）**
>
> | 类型 | 路径示例 | 说明 |
> |---|---|---|
> | 业务 API | `/api/account/login` | Istio 剥除 `/api` 前缀后转发给 auth-service |
> | OAuth2 端点 | `/oauth2/token` | 直通，路径不变 |
> | OIDC 发现 | `/.well-known/openid-configuration` | 直通，路径不变 |
>
> Dev 环境直连 `localhost:9001`，路径不带 `/api` 前缀（如 `/account/login`）。
>
> 所有业务响应均包裹在统一格式中：
> ```json
> { "code": 200, "message": "Success", "data": { ... }, "timestamp": 1743783208000 }
> ```
> 错误时 `data` 为 `null`，`code` 为对应 HTTP 状态码。

---

## 权限说明

| 级别 | 说明 |
|---|---|
| **公开** | 无需任何凭证 |
| **已登录** | 需要有效的 Session Cookie（通过 `/account/login` 获取） |
| **ROLE_ADMIN** | 需要 Session 且用户具有 `ROLE_ADMIN` 角色 |
| **OAuth2 客户端** | 需要 HTTP Basic 客户端凭证（`client_id:client_secret`） |

---

## 一、账号认证（Session）

### 登录
```
Dev:  POST /account/login
Prod: POST /api/account/login
```
**权限：** 公开

**请求体：**
```json
{
  "loginType": "username",
  "principal": "myuser",
  "password": "mypassword",
  "clientId": "sample-client"
}
```
`loginType` 枚举：`username` | `phone` | `email`

连续失败 3 次后，需要附加验证码请求头：
- `X-Captcha-ID`: 手机号或验证码会话 ID
- `X-Captcha-Token`: 用户输入的验证码

连续失败 10 次后账号进入 10 分钟冷却期。

**成功响应 200：**
```json
{
  "data": {
    "id": "303066491119603712",
    "username": "myuser",
    "phone": "13012345678",
    "email": "user@example.com"
  }
}
```

---

### 登出
```
Dev:  POST /account/logout
Prod: POST /api/account/logout
```
**权限：** 公开

销毁 Session。若请求头携带 `Authorization: Bearer <token>`，同时吊销该 OAuth2 AccessToken。

**成功响应 200：**
```json
{ "data": true }
```

---

### 检查登录状态
```
Dev:  GET /account/check-login
Prod: GET /api/account/check-login
```
**权限：** 公开

**成功响应 200（已登录）：**
```json
{
  "data": {
    "id": "303066491119603712",
    "username": "myuser",
    "phone": null,
    "email": "user@example.com"
  }
}
```

**未登录响应 401：**
```json
{ "code": 401, "message": "用户未登录", "data": null }
```

---

## 二、账号注册

### 检查用户名是否已注册
```
Dev:  GET /account/check/username?username={username}
Prod: GET /api/account/check/username?username={username}
```
**权限：** 公开

**响应：** `data: true`（已存在） | `data: false`（可用）

---

### 检查邮箱是否已注册
```
Dev:  GET /account/check/email?email={email}
Prod: GET /api/account/check/email?email={email}
```
**权限：** 公开

---

### 检查手机号是否已注册
```
Dev:  GET /account/check/phone?phone={phone}
Prod: GET /api/account/check/phone?phone={phone}
```
**权限：** 公开

---

### 注册账号
```
Dev:  POST /account/register
Prod: POST /api/account/register
```
**权限：** 公开

**请求体：**
```json
{
  "registerType": "email",
  "principal": "user@example.com",
  "password": "mypassword",
  "code": "123456"
}
```
`registerType` 枚举：`phone` | `email`（不支持直接用用户名注册）

`code` 为发送到 `principal` 的验证码（由 third-party-service 下发）。

**成功响应 200：**
```json
{
  "data": {
    "id": "303066491119603712",
    "username": "user-303066491119603712",
    "phone": null,
    "email": "user@example.com"
  }
}
```

---

## 三、账号管理

### 重置密码（未登录，忘记密码场景）
```
Dev:  POST /account/reset-password
Prod: POST /api/account/reset-password
```
**权限：** 公开

**请求体：**
```json
{
  "registerType": "email",
  "principal": "user@example.com",
  "password": "newpassword",
  "code": "123456"
}
```
`code` 为发送到 `principal` 的验证码。

**成功响应 200：** `data: null`

---

### 获取个人资料
```
Dev:  GET /account/profile
Prod: GET /api/account/profile
```
**权限：** 已登录

**成功响应 200：**
```json
{
  "data": {
    "id": "303066491119603712",
    "username": "myuser",
    "phone": "13012345678",
    "email": "user@example.com"
  }
}
```

---

### 更新个人资料
```
Dev:  PUT /account/profile
Prod: PUT /api/account/profile
```
**权限：** 已登录

**请求体：**
```json
{ "username": "newusername" }
```
用户名须为 5-15 位小写字母和数字。

**成功响应 200：** 返回更新后的用户信息（格式同上）

---

### 修改密码（已登录）
```
Dev:  POST /account/change-password
Prod: POST /api/account/change-password
```
**权限：** 已登录

**请求体：**
```json
{
  "oldPassword": "currentpassword",
  "newPassword": "newpassword123"
}
```
密码须为 8-16 位非空字符。旧密码错误返回 `401 WRONG_PASSWORD`。

**成功响应 200：** `data: null`

---

## 四、OAuth2 授权服务器

> 以下端点由 Spring Authorization Server 标准实现，无需额外开发。

### 获取授权码
```
GET  /oauth2/authorize
POST /oauth2/authorize
```
**权限：** 需要有效 Session（在浏览器中由用户已登录的状态驱动）

**关键参数：**

| 参数 | 说明 |
|---|---|
| `response_type` | `code` |
| `client_id` | 注册的客户端 ID |
| `redirect_uri` | 注册的回调地址 |
| `scope` | `openid` |
| `code_challenge` | PKCE 挑战值（Base64URL(SHA256(code_verifier))） |
| `code_challenge_method` | `S256` |
| `state` | 防 CSRF 随机值 |

**成功响应：** JSON（非重定向），包含授权码：
```json
{ "code": "abc123xyz..." }
```

---

### 交换令牌
```
POST /oauth2/token
```
**权限：** OAuth2 客户端（HTTP Basic: `client_id:client_secret`）

**表单参数（`application/x-www-form-urlencoded`）：**

| grant_type | 必填参数 |
|---|---|
| `authorization_code` | `code`, `redirect_uri`, `code_verifier`（PKCE） |
| `refresh_token` | `refresh_token` |

**成功响应 200：**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 7200,
  "scope": "openid"
}
```

AccessToken 有效期：**2 小时**；RefreshToken 有效期：**7 天**。

---

### 吊销令牌
```
POST /oauth2/revoke
```
**权限：** OAuth2 客户端

**表单参数：**
- `token`: 要吊销的 AccessToken 或 RefreshToken

---

### Token 自省
```
POST /oauth2/introspect
```
**权限：** OAuth2 客户端

**表单参数：**
- `token`: 要检查的 token

**成功响应：**
```json
{
  "active": true,
  "sub": "myuser",
  "client_id": "sample-client",
  "token_type": "Bearer",
  "exp": 1743790408,
  "iat": 1743783208,
  "scope": "openid"
}
```

---

### JWKS 公钥（供资源服务验签）
```
GET /.well-known/jwks.json
```
**权限：** 公开

---

### OIDC 服务发现
```
GET /.well-known/oauth2-authorization-server
```
**权限：** 公开

---

## 五、OAuth2 客户端管理

> 所有接口均需 **ROLE_ADMIN**。响应不返回 `clientSecret` 明文。

### 列出所有客户端
```
Dev:  GET /clients/
Prod: GET /api/clients/
```

**成功响应 200：**
```json
{
  "data": [
    {
      "id": 1,
      "clientId": "sample-client",
      "clientIdIssuedAt": "2025-04-04T16:00:00Z",
      "clientName": "sample-client",
      "clientAuthenticationMethods": "client_secret_basic",
      "authorizationGrantTypes": "authorization_code,refresh_token",
      "redirectUris": "http://localhost:4300/callback",
      "scopes": "openid",
      "description": null,
      "avatarUrl": null,
      "contactEmail": null
    }
  ]
}
```

---

### 查询单个客户端
```
Dev:  GET /clients/{client_id}
Prod: GET /api/clients/{client_id}
```

**失败响应 404：** 客户端不存在

---

### 创建客户端
```
Dev:  POST /clients/
Prod: POST /api/clients/
```

**请求体：**
```json
{
  "clientId": "my-app",
  "clientName": "My Application",
  "clientSecret": "plaintextSecret",
  "authorizationGrantTypes": "authorization_code,refresh_token",
  "clientAuthenticationMethods": "client_secret_basic",
  "redirectUris": "https://myapp.com/callback",
  "scopes": "openid",
  "requireProofKey": true,
  "accessTokenTtlHours": 2,
  "refreshTokenTtlDays": 7,
  "description": "My application client",
  "avatarUrl": null,
  "contactEmail": "admin@myapp.com"
}
```

**成功响应 201：** 返回创建后的 `ClientSafeDto`

**失败响应 409：** `clientId` 已存在

---

### 更新客户端
```
Dev:  PUT /clients/{client_id}
Prod: PUT /api/clients/{client_id}
```

**请求体：**（所有字段可选，仅传需要修改的字段）
```json
{
  "clientName": "Updated Name",
  "clientSecret": "newSecret",
  "redirectUris": "https://myapp.com/callback,https://myapp.com/silent",
  "accessTokenTtlHours": 4
}
```
`clientSecret` 不传则保留原密钥。

**成功响应 200：** 返回更新后的 `ClientSafeDto`

---

### 删除客户端
```
Dev:  DELETE /clients/{client_id}
Prod: DELETE /api/clients/{client_id}
```

**成功响应 204**

**失败响应 404：** 客户端不存在

---

## 六、管理员用户管理

> 所有接口均需 **ROLE_ADMIN**。

### 分页查询用户列表
```
Dev:  GET /admin/users?page=0&size=20&search={username}
Prod: GET /api/admin/users?page=0&size=20&search={username}
```

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `page` | int | 0 | 页码（从 0 开始） |
| `size` | int | 20 | 每页条数 |
| `search` | string | - | 按用户名模糊搜索（可选） |

**成功响应 200：**
```json
{
  "data": {
    "content": [
      {
        "id": "303066491119603712",
        "username": "testuser",
        "phone": "13012345678",
        "email": "test@test.com",
        "createdAt": "2025-04-04T16:00:00Z",
        "enabled": true,
        "accountNonLocked": true,
        "accountNonExpired": true,
        "credentialsNonExpired": true,
        "roles": ["ROLE_USER"]
      }
    ],
    "totalElements": 1,
    "totalPages": 1,
    "size": 20,
    "number": 0
  }
}
```

---

### 查询单个用户
```
Dev:  GET /admin/users/{id}
Prod: GET /api/admin/users/{id}
```

**失败响应 404：** 用户不存在

---

### 更新账号状态（启用/禁用/锁定）
```
Dev:  PUT /admin/users/{id}/status
Prod: PUT /api/admin/users/{id}/status
```

**请求体：**（字段为 `null` 时不修改该项）
```json
{
  "enabled": false,
  "accountNonLocked": true
}
```

| 字段 | 说明 |
|---|---|
| `enabled` | `false` 禁用账号，登录时返回 `INVALID_ACCOUNT` |
| `accountNonLocked` | `false` 锁定账号，登录时返回 `INVALID_ACCOUNT` |

**成功响应 200：** `data: null`

---

### 更新用户角色
```
Dev:  PUT /admin/users/{id}/roles
Prod: PUT /api/admin/users/{id}/roles
```

**请求体：**
```json
{ "roleIds": [2] }
```

| ID | 角色名 |
|---|---|
| 1 | ROLE_ADMIN |
| 2 | ROLE_USER |
| 3 | ROLE_GUEST |

传入完整角色 ID 列表（覆盖式更新，非追加）。

**成功响应 200：** `data: null`

---

### 删除用户
```
Dev:  DELETE /admin/users/{id}
Prod: DELETE /api/admin/users/{id}
```

**成功响应 204**

**失败响应 404：** 用户不存在

---

## 错误码速查

| HTTP | errorId | 说明 |
|---|---|---|
| 400 | `error.common.param.invalid` | 请求参数格式错误 |
| 400 | `error.common.param.miss` | 缺少必填参数 |
| 400 | `error.common.param.miss-captcha` | 需要验证码或验证码错误 |
| 401 | `error.security.authenticated.bad-credential` | 用户名/密码错误 |
| 401 | `error.security.authenticated.invalid-account` | 账号禁用/锁定/过期 |
| 401 | `error.security.authenticated.expired-credential` | 密码已过期 |
| 401 | `error.user.wrong-password` | 旧密码不正确（change-password） |
| 403 | `error.security.access-denied.default` | 权限不足 |
| 404 | `error.user.not-found` | 用户不存在 |
| 403 | `error.oauth2.client.miss` | OAuth2 客户端不存在 |
| 409 | `error.business.conflict` | 资源已存在（用户名/clientId 冲突） |
| 429 | `error.security.authenticated.authenticated.over-attempt` | 登录尝试次数过多 |
| 429 | `error.business.sentinel.flow` | 服务限流 |
| 500 | `error.system.fail` | 系统内部错误 |


# 第二部分 - third-party-service API 文档

# third-party-service API 文档

**Base URL (dev):** `http://localhost:7100`

**Base URL (prod):** `https://api.flyingjack.top/third` （Istio 路由匹配 `/third/` 前缀并裁切后转发至本服务）

所有响应均为统一格式 `ApiRes<T>`，见[响应格式](#响应格式)。

---

## 响应格式

### 成功响应

```json
{
  "code": 200,
  "message": "Success",
  "data": { ... },
  "timestamp": 1714000000000
}
```

### 错误响应

```json
{
  "code": 429,
  "message": "Attempt to many",
  "path": "/captcha/generate/sms",
  "timestamp": 1714000000000
}
```

| HTTP 状态码 | 含义 |
|-------------|------|
| 200 | 成功 |
| 400 | 参数错误 / 缺少必填字段 |
| 429 | 请求过于频繁 |
| 500 | 服务内部错误 / 三方服务异常 |

---

## 验证码接口

### 1. 生成图片验证码

> **对外接口**，需要经过 Istio / Gateway 转发才能访问。

```
GET /captcha/generate/image
```

**请求参数：** 无

**响应 `data`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `uuid` | `string (UUID)` | 验证码唯一标识，后续 verify 时作为 `captchaId` 传入 |
| `base64Image` | `string` | Base64 编码的 PNG 图片（160×60 px） |

**响应示例：**

```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "uuid": "a3f1c2d4-5678-4abc-9def-000000000001",
    "base64Image": "iVBORw0KGgoAAAANSUhEUgAA..."
  },
  "timestamp": 1714000000000
}
```

**说明：**
- 验证码为 6 位大小写字母+数字混合（排除 `0`/`O` 等易混字符）
- 有效期 **5 分钟**，过期后需重新获取
- 严格模式（默认开启）下，verify 时会校验请求 IP 必须与生成时一致

---

### 2. 发送短信验证码

> **会产生阿里云短信费用，禁止随意调用。**
> 同一 IP **60 秒内只能发送一次**，超出返回 429。

```
GET /captcha/generate/sms?phone={phone}
```

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `phone` | `string` | 是 | 接收验证码的手机号（需为有效手机号格式） |

**响应 `data`：** `true`（发送成功）

**响应示例：**

```json
{
  "code": 200,
  "message": "Success",
  "data": true,
  "timestamp": 1714000000000
}
```

**错误情况：**

| 场景 | HTTP 状态 | 说明 |
|------|-----------|------|
| 手机号格式无效 | 400 | `IllegalArgumentException: Not a valid phone` |
| 同 IP 60 秒内重复请求 | 429 | `TO_MANY_LOGIN_ATTEMPT` |
| 阿里云短信服务异常 | 500 | `ThirdPartySystemException` |

**说明：**
- 验证码为 **6 位纯数字**，有效期 **5 分钟**
- 后续 verify 时 `captchaId` 填手机号本身
- 严格模式下 verify 会校验 IP 一致性

---

### 3. 发送邮件验证码

> 同一 IP **30 秒内只能发送一次**，超出返回 429。

```
GET /captcha/generate/mail?email={email}
```

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `email` | `string` | 是 | 收件人邮箱地址 |

**请求头（可选）：**

| Header | 说明 |
|--------|------|
| `Accept-Language` | 控制邮件语言，支持 `zh-CN`、`en-US`，默认跟随服务器 Locale |

**响应 `data`：** `true`（发送成功）

**响应示例：**

```json
{
  "code": 200,
  "message": "Success",
  "data": true,
  "timestamp": 1714000000000
}
```

**错误情况：**

| 场景 | HTTP 状态 | 说明 |
|------|-----------|------|
| 邮箱格式无效 | 400 | `IllegalArgumentException: Not a valid email` |
| 同 IP 30 秒内重复请求 | 429 | `TO_MANY_LOGIN_ATTEMPT` |
| 邮件服务异常（网易 SMTP）| 500 | `ThirdPartySystemException` |

**说明：**
- 验证码为 **6 位大小写字母+数字**，通过 Thymeleaf HTML 模板 `email_code.html` 渲染发送
- 后续 verify 时 `captchaId` 填邮箱地址本身
- 严格模式下 verify 会校验 IP 一致性

---

### 4. 验证验证码

> **内部服务调用接口**，不对外暴露，由其他微服务（如 auth-service）通过 OpenFeign 调用。

```
POST /captcha/verify
Content-Type: application/json
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `captchaId` | `string` | 是 | 图片验证码填 UUID；短信/邮件验证码填手机号/邮箱 |
| `captcha` | `string` | 是 | 用户输入的验证码 |

**请求示例：**

```json
{
  "captchaId": "a3f1c2d4-5678-4abc-9def-000000000001",
  "captcha": "aB3dE9"
}
```

**响应：** 直接返回 `boolean`（非包装格式）

| 值 | 含义 |
|----|------|
| `true` | 验证通过，缓存已自动清除（一次性验证） |
| `false` | 验证失败（验证码错误、已过期、IP 不一致） |

**说明：**
- 严格模式（`captcha.verify.strict=true`，默认）：请求 IP 必须与生成时 IP 一致，否则直接返回 `false`
- 验证通过后缓存立即删除，验证码不可复用

---

## 频率限制汇总

| 接口 | 限制维度 | 冷却时间 |
|------|----------|----------|
| `GET /captcha/generate/sms` | 客户端 IP | 60 秒 |
| `GET /captcha/generate/mail` | 客户端 IP | 30 秒 |
| `GET /captcha/generate/image` | 无限制 | — |
| `POST /captcha/verify` | 无限制 | — |

> 生产环境额外的限流由 **Istio** 层统一管控，不在此服务内实现。

---

## 验证码有效期汇总

| 类型 | 有效期 | `captchaId` 取值 |
|------|--------|-----------------|
| 图片验证码 | 5 分钟 | 生成返回的 UUID |
| 短信验证码 | 5 分钟 | 手机号 |
| 邮件验证码 | 5 分钟 | 邮箱地址 |

---

## 典型调用流程

### 图片验证码登录流

```
1. 客户端 GET /captcha/generate/image
   ← { uuid, base64Image }

2. 用户填写验证码后，客户端携带 uuid + 输入值
   发起登录请求至 auth-service

3. auth-service 内部调用 POST /captcha/verify
   { captchaId: uuid, captcha: "用户输入" }
   ← true / false
```

### 手机号/邮箱验证码流

```
1. 客户端 GET /captcha/generate/sms?phone=xxx
              或 GET /captcha/generate/mail?email=xxx

2. 用户收到验证码，填写后发起请求至对应业务服务

3. 业务服务内部调用 POST /captcha/verify
   { captchaId: "手机号或邮箱", captcha: "用户输入" }
   ← true / false
```
