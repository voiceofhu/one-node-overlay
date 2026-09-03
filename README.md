# Overlay

Overlay 拉取 One Node sing-box 订阅，再用一份高优先级用户 JSON 合并后返回。代理流量不会经过 Worker。

## 使用

- 打开根路径会自动生成 UUID，直接进入空白新增页。
- 编辑地址：`https://overlay.marseo.eu.org/<UUID>`
- 订阅地址：`https://overlay.marseo.eu.org/sub/<UUID>`
- UUID 同时是配置 key 和密钥；持有订阅链接的人也能编辑该配置。
- KV 中只保存 UUID 的 SHA-256 和 AES-256-GCM 加密配置。

## 请求调试

- `/debug/request` 接收任意请求并返回 `ok: true`，同时原样回显 URL、查询参数、Headers、Cloudflare `request.cf` 和请求 Body。
- `/debug` 按新到旧显示最近 100 次完整请求，支持逐条或全部展开/收起。
- 请求历史保存在 KV 中并于 24 小时后过期；响应和查看页均不缓存。

## 本地开发

```bash
cp .env.prod.example .env.prod
pnpm install
pnpm dev
```

生成本地和生产加密密钥：

```bash
openssl rand -base64 32
```

## 生产部署

生产配置只有 [wrangler.toml](./wrangler.toml)，绑定域名 `overlay.marseo.eu.org` 和 KV `OVERLAY_CONFIG`。

部署只由 [.github/workflows/deploy.yml](./.github/workflows/deploy.yml) 执行；推送 `main` 或手动触发 GitHub Action。仓库需要三个 Secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CONFIG_ENCRYPTION_KEY`

`package.json` 不包含部署命令。

## 本地检查

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## 合并规则

1. 对象递归合并，同名普通字段使用用户值。
2. 带 `tag` 的对象数组按 `tag` 合并。
3. 普通数组以用户值在前的顺序去重。
4. `route.rules` 保留必要前置动作，再执行用户规则和上游规则。
