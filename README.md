# Qiongkura · 个人主页

`qiongkura.xyz` 的源码。白色编辑杂志风单页网站，由五个全屏章节组成，纯静态、无构建步骤。

## 改完怎么发布（重要）

网站是 GitHub 自动部署的，**在 VS Code 里改完文件不会自动上线**。必须提交并推送到 GitHub，Cloudflare 才会重新部署（约 1 分钟）。

最省事的方式：双击项目根目录的 `publish.cmd`。它会自动做三件事：

1. 如果 `styles.css` 或 `script.js` 有改动，把 `index.html` 里的 `?v=` 版本号加一（否则访客看到的还是旧缓存样式）
2. 提交所有改动
3. 推送到 GitHub

也可以手动执行：

```bash
cd /i/projects/my-profile
python tools/bump_asset_version.py   # 改了 CSS / JS 时才需要
python tools/bump_asset_version.py --force   # 强制加一，用于补救漏改的情况
git add -A
git commit -m "Update site"
git push
```

> 注意：`publish.cmd` 只能靠「未提交的改动」判断是否要升版本号。如果某次 CSS 改动已经提交了却没升版本号，用 `--force` 补一次。

只在本地看效果、不发布：在该目录运行 `python -m http.server 8000`，然后打开 <http://localhost:8000>。本地看到的是本地文件，和线上是两回事。

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
│   ├── hifi-visualizer.webp   # 音频可视化界面（作品预览）
│   ├── hifi-gear-01.webp      # 我的设备照片 1（HI-FI 主视觉）
│   ├── hifi-gear-02.webp      # 我的设备照片 2（HI-FI 主视觉）
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

## HI-FI 章节的图片

主视觉是 `.hifi-media` 的两栏结构：

- 左栏 `.frame--portrait`：竖图，高度撑满整个媒体区（跟随右栏内容高度），宽度由 `.hifi-media` 的第一列决定（`minmax(150px, 240px)`）
- 右栏 `.hifi-media-right`：横图 `.frame--landscape` + 项目信息

两张都用 `object-fit: cover`，会裁切。换图时如果主体被裁掉，用内联 `object-position` 调整取景；横图高度改 `.frame--landscape img` 的 `height`，竖图高度跟随右栏内容自动变化。窄屏（≤980px）会变成上下排列。

音频可视化界面截图不再放在这一章，它仍然出现在 PROJECTS 的轮播里。

## 窗口尺寸适配

整站的尺寸基准比初始设计稿小了约 12%（所有 px 写死的尺寸统一乘 0.88，`vw`/`vh` 尺寸不变，因此图片相对屏幕的比例维持原设计）。想整体再放大或缩小，就按同一系数改 `styles.css` 里所有 px 值即可，注意跳过 `@media` 断点、`1px` 描边与阴影这类不该跟着变的数值；字号另有 10px 下限，避免小标签糊成一团。


版式由 `styles.css` 末尾的一组媒体查询控制，从大到小依次是：

- **宽度 ≥ 2400px 且高度 ≥ 1600px**（4K 屏 100% 缩放）：`--maxw` 放宽到 `min(1866px, 88vw)`，图片高度上限再放开一档，字号相对上一档回落约 10%——大屏上画面重心落在图片上，而不是被超大字标占满。
- **宽度 ≥ 1921px**（含 4K 开 150% 缩放后的 ~2555px 视口）：`--maxw` 放宽到 `min(1584px, 88vw)`，内容宽度接近翻倍；字号以默认档为准调小约 10%，图片高度则提高一档（大图约 +20%）。
- **宽度 1181–1920px**：默认档，`--maxw: 1197px`，每章正好一屏。
- **宽度 901–1180px**：仍是双栏，但间距、图片高度、内部留白收紧；滚动从 `y mandatory` 放宽为 `y proximity`，保证一节一屏。
- **宽度 ≤ 900px**：改为上下堆叠、自然滚动，顶部导航收起为抽屉菜单，右侧章节指示器移到页面底部。
- **宽度 ≤ 620px**：手机档，进一步缩小字号与图片高度。
- **高度 ≤ 820px**（笔记本矮窗口）：压缩纵向留白与图片高度，让一节内容仍能塞进一屏。

改动版式后用多个尺寸量一遍最稳妥。快速自查方法：把浏览器窗口分别拖到 ~1000px、~950px、~880px 宽，以及全屏状态，确认每章仍是一节一屏、左右不出现横向滚动条。

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
- 听音偏好：`.listen-list`（常听类型）
- 设备：`.frame--gear` 里的两张照片与图注（DX1ii · JT9 · TitanX）
- 技术栈：`stack-list`

替换图片时保持文件名不变，或同步修改 `index.html` 中的 `src`。新增图片建议先转成 WebP 以控制体积。

## 更新样式或脚本时请改版本号

`index.html` 里这样引用资源：

```html
<link rel="stylesheet" href="styles.css?v=5" />
<script src="script.js?v=5"></script>
```

`?v=` 是缓存版本号。浏览器会长期缓存 CSS/JS，改了内容但文件名不变时，访客可能几小时内看到的还是旧样式（页面结构是新的、样式是旧的，会明显错乱）。所以每次修改 `styles.css` 或 `script.js` 后，把 `v=` 的数字加一。

只改 HTML 文案或图片内容不需要动这个版本号。

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

## 添加图片时的两个注意点

**1. 先应用 EXIF 旋转。** 手机/相机拍的照片经常把方向记在 EXIF 里，像素本身却是横向的。直接用 PIL 打开转换会得到躺着的图。转换时要这样写：

```python
from PIL import Image, ImageOps
im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
```

`hifi-gear-01.webp` 就踩过这个坑：源图 EXIF 方向是 6（竖拍 4284×5712），未旋转直接转换会得到 5712×4284 的横图。

**2. 同名替换要改缓存参数。** 浏览器会长期缓存图片。如果替换了图片内容但文件名不变，请把 `index.html` 里的引用改成 `图片.webp?v=2`（依次递增），否则访客仍会看到旧图。本项目里 `hifi-gear-01.webp?v=2` 就是这么处理的。

## 素材说明

页面内图片均来自 Qiongkura 自己的项目截图，未使用外部图库素材。DQN Snake 与 DSH Usage 两个项目仓库中没有界面截图，因此对应预览使用代码绘制的结构示意图，并在图注中标注。
