# auth-service-frontend

flyingjack-cloud 认证服务前端，使用 Angular + Angular Material 构建。包含 **auth-portal**（登录、注册、账号管理）和 **admin-portal**（管理员功能）两个子项目。

后端地址：`http://localhost:9001`（在 `projects/auth-portal/src/environments/environment.development.ts` 中配置）

## 启动开发服务器

```bash
# auth-portal（默认 http://localhost:4200）
npm run start:auth

# admin-portal
npm run start:admin
```

## 构建

```bash
npm run build:auth     # 构建 auth-portal 生产包
npm run build:admin    # 构建 admin-portal 生产包
```

## 测试

测试框架：Jasmine + Karma（ChromeHeadless）

WSL2 需要先安装浏览器：`sudo apt-get install -y chromium-browser`

```bash
# 运行 auth-portal 所有单元测试（单次，不监听）
npm run test:auth

# 监听模式（文件变更自动重跑）
ng test auth-portal

# 只跑某个测试文件
ng test auth-portal --include='**/login.component.spec.ts'

# admin-portal 测试
npm run test:admin
```

## 项目结构

```
projects/
  auth-portal/          # 用户端：登录、注册、找回密码、个人中心
    src/app/
      core/             # 全局守卫、拦截器、核心服务
      shared/           # 可复用组件、管道
      features/
        login/
        register/
        reset-password/
        oauth2-consent/
        account/        # 个人资料、修改密码
        auth-layout/
  admin-portal/         # 管理员端：用户管理、OAuth2 客户端管理
  shared/               # 两个子项目共享的服务、守卫、拦截器
```

## 页面路由

| 路径 | 说明 |
|------|------|
| `/login` | 登录（支持邮箱/手机号，验证码保护） |
| `/register` | 注册（邮箱/手机号切换） |
| `/reset-password` | 找回密码 |
| `/oauth2/authorize` | OAuth2 授权确认页 |
| `/account/profile` | 个人资料 |
| `/account/security` | 修改密码 |
