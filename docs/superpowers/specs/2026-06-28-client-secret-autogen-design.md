# OAuth2 客户端创建 — 自动生成密钥 & 一次性展示

**日期：** 2026-06-28  
**范围：** admin-portal 客户端管理，shared 模型/服务层

---

## 背景

后端 `POST /clients/` 接口已更新：`clientSecret` 可省略，省略时服务端自动生成 32 字节随机密钥（Base64URL 编码），并通过响应体的 `plainSecret` 字段一次性返回明文。前端需要配合这一变化调整表单与创建后的 UX 流程。

---

## 变更范围

### 1. `projects/shared/src/lib/models/client.model.ts`

- `CreateClientRequest.clientSecret` 改为 `clientSecret?: string`（可选）
- 新增 `CreateClientResponse` 接口：
  ```ts
  export interface CreateClientResponse {
    client: OAuthClient;
    plainSecret: string;
  }
  ```

### 2. `projects/shared/src/lib/services/client-management.service.ts`

- `createClient()` 返回类型从 `OAuthClient` 改为 `CreateClientResponse`

### 3. `projects/admin-portal/src/app/features/clients/client-form/client-form.component.ts`

**表单变更：**
- `clientSecret` 控件去掉 `Validators.required`（新建模式下改为选填）
- `save()` 构造 payload 时，`clientSecret` 为空字符串则不传该字段（`...(v.clientSecret ? { clientSecret: v.clientSecret } : {})`）

**新增 `SecretRevealDialogComponent`（inline，与 `DeleteClientDialogComponent` 同风格）：**
- 接收 `MAT_DIALOG_DATA: { plainSecret: string }`
- `disableClose: true`（禁止遮罩点击和 ESC 关闭）
- 内容：
  - 标题"密钥已生成"
  - 警告文字：此密钥仅显示一次，关闭后无法再查看
  - 只读 monospace 输入框展示 `plainSecret`
  - 复制按钮：调用 `navigator.clipboard.writeText()`，成功后图标切换为 ✓，2 秒后恢复
  - Checkbox：`我已将密钥保存至安全位置`
  - 「完成」按钮：checkbox 未勾选时 `disabled`，勾选后启用，点击 `[mat-dialog-close]`

**创建成功回调：**
- 原来直接 `router.navigate(['/clients'])`
- 改为：打开 `SecretRevealDialogComponent`，传入 `plainSecret`；弹窗关闭后再 `router.navigate(['/clients'])`

### 4. `projects/admin-portal/src/app/features/clients/client-form/client-form.component.html`

- `clientSecret` 字段添加 `<mat-hint>留空则由系统自动生成</mat-hint>`

---

## 数据流

```
用户填写表单（clientSecret 可选）
  → save() 构造 payload（空 secret 不传）
  → POST /clients/
  → 拦截器解包 data → CreateClientResponse { client, plainSecret }
  → 打开 SecretRevealDialogComponent(plainSecret)
  → 用户复制并勾选确认
  → 弹窗关闭 → router.navigate(['/clients'])
```

---

## 不在范围内

- auth-portal 无客户端管理功能，无需改动
- 编辑模式（`isEdit`）逻辑不变：`clientSecret` 已为可选，不传则保留原密钥
