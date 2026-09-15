# 个人介绍网站

这是一个无需构建工具的单页个人介绍网站，适合直接部署到 GitHub Pages、Cloudflare Pages 或其他静态托管平台。

## 文件说明

```text
my-profile/
├── index.html   # 页面内容和结构
├── styles.css   # 响应式视觉样式
├── script.js    # 移动端菜单、滚动动画和导航高亮
├── assets/
│   └── avatar.jpg # 个人头像
└── README.md    # 当前说明文件
```

## 当前内容

网站已经替换为 Qiongkura 的个人信息：

- 身份：华南农业大学电子信息工程大二学生 / vibe coder
- 城市：广州
- 项目：Focus-time-tracker、dsh-usage-plugin、BeamNG-autopilot
- 联系方式：2447402326@qq.com、202534310330@stu.scau.edu.cn
- GitHub：<https://github.com/Qiongkura>
- 头像：`assets/avatar.jpg`

如果以后要修改内容，直接编辑 `index.html`，搜索对应的姓名、简介、项目或邮箱即可。头像文件替换时保持路径为 `assets/avatar.jpg`，或同步修改 HTML 中的 `src` 路径。

## 本地预览

在这个文件夹中打开终端，运行：

```bash
python -m http.server 8000
```

然后访问 <http://localhost:8000>。

也可以直接双击 `index.html` 预览；使用本地服务器预览时，滚动动画和资源路径更接近正式部署环境。

## 上传到 GitHub

1. 打开你的 GitHub 仓库：<https://github.com/Qiongkura/my-profile>
2. 点击 **Add file → Upload files**。
3. 上传 `index.html`、`styles.css`、`script.js` 和 `README.md`。
4. 点击 **Commit changes**。

## 部署到静态托管平台

### GitHub Pages

仓库上传完成后：

1. 进入仓库的 **Settings → Pages**。
2. 在 **Build and deployment** 中选择 `Deploy from a branch`。
3. 分支选择 `main`，目录选择 `/ (root)`。
4. 点击保存，等待 GitHub 生成网站地址。

### Cloudflare Pages

1. 进入 **Workers & Pages → Create application → Pages**。
2. 选择 **Connect to Git**，连接 GitHub。
3. 选择 `Qiongkura/my-profile` 仓库。
4. 构建方式选择 `None`，构建命令留空，输出目录使用根目录 `/`。
5. 部署完成后，再从 **Custom domains** 绑定自己的域名。

## 注意事项

- `index.html` 必须位于仓库根目录。
- 这是纯静态网站，不需要数据库、后端或服务器程序。
- 如果使用中国大陆服务器，通常需要考虑 ICP 备案；海外静态托管一般不需要配置大陆服务器备案。
