# Qiongkura · 个人主页

`qiongkura.xyz` 的源码。白色编辑杂志风单页网站，由五个全屏章节组成，纯静态、无构建步骤。

## 文件结构

```text
my-profile/
├── index.html                 # 五个章节的页面结构
├── styles.css                 # 视觉系统、滚动吸附、响应式
├── script.js                  # 章节切换、指示器、视差、声波绘制
├── assets/
│   ├── avatar.jpg             # ABOUT 头像
│   ├── racing-frame.webp      # BeamNG 车载视角（首页 / 作品预览）
│   ├── racing-perception.webp # BeamNG 前视感知画面（RACING）
│   ├── hifi-visualizer.webp   # 音频可视化界面（HI-FI / 作品预览）
│   ├── focus-home.webp        # Focus-time-tracker 主界面
│   └── focus-stats.webp       # Focus-time-tracker 统计报告
└── README.md
```

## 页面结构

| 章节 | 内容 |
| --- | --- |
| 01 HOME | 名字、身份、兴趣方向、BUILD / DRIVE / LISTEN |
| 02 RACING | BeamNG Autopilot 与真实模块（M1–M6） |
| 03 PROJECTS | 五个项目的文字目录 + 悬停预览 |
| 04 HI-FI | Audio Visualizer、听音偏好、声波与频谱动画 |
| 05 ABOUT | 学校年级、三个关键词、技术栈、联系方式 |

## 交互

- 桌面端使用 CSS `scroll-snap` 实现逐章翻页，JS 增强滚轮、`↑` `↓`、`PageUp` `PageDown`、`Home` `End`。
- 右侧 `01–05` 指示器可点击跳转，并自动跟随当前章节；顶部导航当前项显示红色下划线。
- 移动端关闭强制吸附，改为自然滚动，指示器移到页面底部，导航收进 `MENU`。
- 支持 `prefers-reduced-motion`：关闭视差、声波与所有循环动画。
- 脚本失效时页面仍可通过锚点和原生滚动正常浏览。

## 内容维护

所有文案都在 `index.html` 内，搜索对应标题即可修改：

- 姓名与身份：`QIONGKURA`、`Electronic Information Engineering Student`
- 项目与链接：`work-row` 列表项，以及 `work-panel` 里的预览图
- 联系方式：`mailto:` 链接
- 技术栈：`stack-list`

替换图片时保持文件名不变，或同步修改 `index.html` 中的 `src`。新增图片建议先转成 WebP 以控制体积。

## 本地预览

```bash
cd I:\projects\my-profile
python -m http.server 8000
```

然后访问 <http://localhost:8000>。

## 部署

仓库 `main` 分支连接 Cloudflare Pages，构建方式为 `None`、输出目录 `/`，每次 `git push` 会自动重新部署。

```bash
git add .
git commit -m "Update site"
git push
```

线上地址：

- 自定义域名：<https://qiongkura.xyz>
- Cloudflare 域名：<https://my-profile-1qe.pages.dev>

## 素材说明

页面内图片均来自 Qiongkura 自己的项目截图，未使用外部图库素材。DQN Snake 与 DSH Usage 两个项目仓库中没有界面截图，因此对应预览使用代码绘制的结构示意图，并在图注中标注。
