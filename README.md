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

## 赛车章节的图片轮播

RACING 章节的主图是自动轮播，共 9 张：

- 7 张模拟赛车实拍
- 2 张视觉标线检测叠加图（来自 `beamng-autopilot/logs/m5_lane_state/` 的实车测试帧：
  `live_smoke_20260815_030108.jpg` 与 `live_smoke_20260815_023628.jpg`，取同一次会话中画面差异明显的两帧）

行为：每 4.8 秒自动切换，鼠标悬停、键盘聚焦或页面切到后台时暂停，离开后继续；`←` `→` 按钮与键盘方向键可手动切换；章节滚出视口后停止计时。开启「减少动态效果」时不自动播放，只能手动切换。

图片用 `object-fit: cover`，画幅是横向条幅，所以会裁切。每张图通过内联 `object-position` 指定取景位置：标线检测图用 100%（检测叠加线集中在画面下三分之一，取景 100% 可看到约 99% 的叠加内容）；赛车实拍用 55%。换图时如果主体不在中间，记得同步调整这个值。

## 交互

- 桌面端使用 CSS `scroll-snap` 实现逐章翻页，JS 增强滚轮、`↑` `↓`、`PageUp` `PageDown`、`Home` `End`。
- 右侧 `01–05` 指示器可点击跳转，并自动跟随当前章节；顶部导航当前项显示红色下划线。
- 移动端关闭强制吸附，改为自然滚动，指示器移到页面底部，导航收进 `菜单`。
- 支持 `prefers-reduced-motion`：关闭视差、声波与所有循环动画。
- 脚本失效时页面仍可通过锚点和原生滚动正常浏览。

## 中英双语

顶部导航右侧有 `中文 / EN` 切换按钮：

- 默认显示中文；点击 `EN` 切换为英文，选择会记在浏览器本地存储，下次打开保持上次的语言。
- 两种语言的文案都写在 `index.html` 里成对的 `<span class="zh">` 与 `<span class="en" lang="en">`，由 `html[data-lang]` 控制显示哪一个，因此切换是即时的、不需要重新加载。
- 图片 `alt`、区块 `aria-label` 与页面标题用 `data-alt-zh / data-alt-en`、`data-aria-zh / data-aria-en` 成对维护。
- 修改文案时两种语言都要改，避免只更新一侧。

## 内容维护

所有文案都在 `index.html` 内，搜索对应标题即可修改：

- 姓名与身份：`QIONGKURA`、`电子信息工程专业学生`
- 项目与链接：`work-row` 列表项，以及 `work-panel` 里的预览图
- 联系方式：`.contact-row` 里的 `Personal`、`Academic / Work`、`GitHub` 三行
- 听音偏好与设备：`.listen-list`（常听类型）和 `.gear-line`（我的设备：DX1ii、JT9、TitanX）
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
