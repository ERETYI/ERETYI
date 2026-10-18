# 乐刷刷 · 备考训练站（GitHub Pages 部署包）

纯静态站点（HTML + JS + PWA），无需构建，直接部署。

## 部署步骤（二选一）

### 方式 A：上传到已有仓库（推荐）
1. 登录 GitHub，新建仓库（如 `le-shuashua`），保持公开（Pages 免费版要求）
2. 将本目录下所有文件上传到仓库根目录
3. 进入仓库 Settings → Pages → Source 选择 `main` 分支 / (root)，保存
4. 访问地址：`https://<用户名>.github.io/<仓库名>/`

### 方式 B：gh 命令行（需 Token）
```bash
gh auth login --with-token < token.txt
gh repo create le-shuashua --public --source . --push
gh api repos/<用户名>/le-shuashua/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

## 注意
- 数据保存在浏览器 localStorage，换设备/浏览器不互通
- 离线可用（PWA Service Worker），更新后请刷新页面
- 部署到子路径（仓库名路径）也可正常使用（已全部使用相对路径）
