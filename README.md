# 日知·资讯工作台

一个可直接部署到 GitHub Pages 的个人资讯工作台，聚合：

- AI 实操：生图、视频生成、Agent 和自动化工作流
- 中国政策：官方政策、合规和产业扶持信息
- 行业趋势：AI、机器人、新能源、电商、教育等
- 机会雷达：从行业变化中提取可验证的商业机会
- 意外常识：常见误区、反直觉事实和科学解释
- 星标复习：重要资讯可标记星星，自动置顶并可只看星标内容

## 本地运行

```bash
npm install
npm run update
npm run serve
```

打开终端显示的本地地址。请不要直接双击 `index.html`，因为浏览器会限制本地 JSON 读取。

## 发布到 GitHub Pages

1. 在 GitHub 新建一个仓库，将本目录推送到仓库的 `main` 分支。
2. 进入仓库 `Settings > Pages`。
3. `Build and deployment` 选择 `Deploy from a branch`。
4. Branch 选 `main`，目录选 `/ (root)`，点击 `Save`。
5. 等待几分钟，GitHub 会显示站点地址。

## 自动更新

`.github/workflows/update-news.yml` 每天北京时间 `08:15`、`12:15`、`16:15` 和 `20:15` 运行，更新 `data/news.json` 并自动提交。也可在 GitHub 仓库的 `Actions > Update daily intelligence > Run workflow` 手动刷新。

GitHub 可能会对长期无人使用的定时任务停用；定期访问仓库的 Actions 页即可检查状态。

## DeepSeek 智能分析

配置 DeepSeek 后，每次更新会优先分析新增的高价值资讯，生成：

- 结构化摘要和实际影响
- 证据边界与风险提示
- 三步行动指南
- 机会指数、可信度和综合优先级

模型只使用标题和 RSS 摘要进行筛选，不代替原文复核。分析结果会按资讯 ID 缓存，不会重复调用 API。接口故障时会自动回退到规则分析。

### GitHub Actions 配置

1. 在 DeepSeek 控制台生成一把新密钥。
2. 进入 GitHub 仓库 `Settings > Secrets and variables > Actions`。
3. 点击 `New repository secret`。
4. Name 填写 `DEEPSEEK_API_KEY`，Secret 填写新密钥。
5. 在 Actions 页手动运行一次 `Update daily intelligence`。

密钥不得写入 `app.js`、`data/news.json` 或任何会提交到 Git 的文件。

### 本地配置

```bash
cp .env.example .env
# 编辑 .env，填入新密钥
npm run update:ai
```

`.env` 已加入 `.gitignore`。默认每次最多分析 12 条新资讯，可通过 `DEEPSEEK_MAX_ITEMS` 调整，上限为 30。

## 调整信息源

信息源集中在 `config/sources.json`。每条包含：

- `name`：页面显示的信息源名称
- `category`：`ai` / `policy` / `industry` / `opportunity` / `knowledge`
- `url`：RSS 或 Atom 地址
- `limit`：每次最多取回条数

对重要政策和投资、创业决策，页面分数只用于筛选，必须点击“阅读原文”复核。

## 星标和收藏

每张资讯卡右上角有两个独立按钮：

- 星星：适合记忆、复习和优先处理的内容，打星后会自动排在资讯流前面。
- 书签：适合稍后再读的内容，与星标互不影响。

星标、收藏、已读和行动清单都保存在当前浏览器的 `localStorage`。清理浏览器缓存、更换设备或换浏览器后不会同步。
