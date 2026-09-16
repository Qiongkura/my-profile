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

只在本地看效果、不发布：在该目录运行 `python tools/serve.py`，然后打开 <http://localhost:8000>（别用 `python -m http.server`，原因见下面「本地预览」一节）。本地看到的是本地文件，和线上是两回事。

## 文件结构

```text
my-profile/
├── index.html                 # 五个章节的页面结构
├── styles.css                 # 视觉系统、滚动吸附、响应式
├── script.js                  # 章节切换、指示器、视差、声波绘制
├── assets/
│   ├── avatar.jpg             # ABOUT 头像
│   ├── home-01.webp           # 首页主视觉轮播 1
│   ├── home-02.webp           # 首页主视觉轮播 2
│   ├── home-03.webp           # 首页主视觉轮播 3
│   ├── racing-frame.webp      # BeamNG 车载视角（作品预览）
│   ├── racing-perception.webp # BeamNG 前视感知画面（RACING）
│   ├── hifi-visualizer.webp   # 音频可视化界面（作品预览）
│   ├── hifi-gear-01.webp      # 我的设备照片 1（HI-FI 主视觉）
│   ├── hifi-gear-02.webp      # 我的设备照片 2（HI-FI 主视觉）
│   ├── focus-home.webp        # Focus-time-tracker 主界面
│   └── focus-stats.webp       # Focus-time-tracker 统计报告
├── assets/audio/
│   └── cha-tang.mp3         # 最近在听「茶汤」，由你提供的 FLAC 转出的 320 kbps MP3（13.1 MiB）
├── tools/
│   └── serve.py               # 支持 HTTP Range 的本地预览服务器（音频拖进度条要用它）
└── README.md
```

## 页面结构

| 章节 | 内容 |
| --- | --- |
| 01 HOME | 名字、身份、兴趣方向、BUILD / DRIVE / LISTEN、主视觉轮播（3 张） |
| 02 RACING | BeamNG Autopilot 与真实模块（M1–M6） |
| 03 PROJECTS | 五个项目的文字目录 + 悬停预览 |
| 04 HI-FI | Audio Visualizer、常听类型（各带一首代表曲目）、最近在听「茶汤」（可点播） |
| 05 ABOUT | 学校年级、三个关键词、技术栈、联系方式 |

## 图片轮播（首页与赛车章节）

页面里有两处自动轮播，用的是同一个组件：`figure[data-slideshow]`，里面的 `.slide` 就是参与轮播的图片。

- **01 HOME 主视觉**：`assets/home-01~03.webp`，共 3 张。
- **02 RACING 主图**：共 9 张 —— 7 张模拟赛车实拍，加 2 张视觉标线检测叠加图（来自
  `beamng-autopilot/logs/m5_lane_state/` 的实车测试帧：`live_smoke_20260815_030108.jpg`
  与 `live_smoke_20260815_023628.jpg`，取同一次会话中画面差异明显的两帧）。

行为：每 4.8 秒自动切换，鼠标悬停、键盘聚焦或页面切到后台时暂停，离开后继续；`←` `→` 按钮与键盘方向键可手动切换；章节滚出视口后停止计时。开启「减少动态效果」时不自动播放，只能手动切换。两处轮播各自独立计时，互不影响。

图注是可选的：`.slide` 上的 `data-cap-zh` / `data-cap-en` 决定图注文字，对应的显示位置是同一张 `figure` 里的 `[data-slide-cap-zh]` / `[data-slide-cap-en]`。首页轮播没有写图注，`figcaption` 上加了 `.slide-bar--end`，只显示右下角的计数与翻页按钮；要补图注就把那对 span 加回去并去掉这个类。计数 `01 / 03` 由脚本按图片张数自动生成，不用手改。

图片用 `object-fit: cover`，画幅是横向条幅，所以会裁切。赛车章节每张图通过内联 `object-position` 指定取景位置：标线检测图用 100%（检测叠加线集中在画面下三分之一，取景 100% 可看到约 99% 的叠加内容）；赛车实拍用 55%。首页三张用的是默认居中，主体偏了就在对应 `<img>` 上加 `style="object-position: center 40%"` 之类的取值。

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

## HI-FI 章节的「常听类型」与试听

侧栏（`.hifi-side`）下面两块内容：

- **常听类型**：四个类型，每行右边跟一首该类型最有代表性的曲目（`index.html` 里搜 `listen-pick`）。这些只是文字，点了不会播放；改文案直接改那两个 `<span>`（中英各一）即可。
- **最近在听**：目前是「茶汤 · 郁可唯」，这一行可以直接点开播放。

代表曲目是从「最近播放」列表里挑的（中文流行：会呼吸的痛 · 梁静茹；欧美流行：Just Like Fire · P!nk；另类音乐：NIGHT DANCER · imase；电子音乐：CAROUSEL! · DEITIES / ASMODEUS），想换成别的直接改文字就行。

### 「茶汤」的试听音频

站内托管的是 `assets/audio/cha-tang.mp3`（13.1 MiB，320 kbps），由你提供的那份 FLAC 转码而来。页面把它作为 `<audio>` 的 `src`，不再跳转网易云或其他外部音乐网站；用 `preload="none"`，没人点播放就不会下载。想换歌就替换这个文件，或改 `index.html` 里 `li.pick--now` 那一行的 `data-src`。

**为什么站内不是 FLAC**：Cloudflare Pages 对**单个文件**的上限是 **25 MiB**（官方 Limits 文档原文：*The maximum file size for a single Cloudflare Pages site asset is 25 MiB*），你那份 FLAC 是 34.8 MiB，超出后整个部署会失败——现象就是 GitHub 上文件在、但线上仍是旧版本、音频路径返回 404。想放真正无损的原文件，官方给的路子是传 R2（*Larger Files: consider uploading them to R2 and utilizing the public bucket feature*），把 `data-src` 换成 R2 的公网地址即可；也可以用 GitHub Release 附件（单文件上限 2 GB）承载，然后写它的直链。

转码命令（用了本机捆绑的 ffmpeg）：

```bash
ffmpeg -y -i "茶汤.flac" -c:a libmp3lame -b:a 320k -map_metadata 0 -id3v2_version 3 assets/audio/cha-tang.mp3
```

文件名和路径要和 `data-src` 完全一致。播放器行为：

- **播放键**是 27px 圆形描边按钮，图标是内联 SVG（播放三角 / 暂停双杠），由行的 `.is-playing` 类切换，脚本不再往按钮里写文字
- **音量条**在单曲行的右侧：默认落在 **50%**（约 **−12dB**），拖动即时生效，点小喇叭静音 / 恢复，键盘 `←` `→` 每次 5%、`Home` / `End` 到 0 / 100%。悬停滑块会显示当前位置对应的 dB
  滑块存的是**位置**，实际增益走**平方映射**（`gain = 位置²`）：位置 50% ≈ −12dB、25% ≈ −24dB、100% 才等于文件原始电平。线性映射下 50% 只有 −6dB，对响度做满的流行母带来说依然很吵，所以没用线性。改动写进 `localStorage` 的 `qiongkura-volume-v2`，下次打开沿用（隐私模式下写不进去也不影响播放）
- **进度条**只在正在播放的那一行展开：点击或拖动跳转，键盘 `←` `→` 跳 5 秒、`Home` / `End` 到首尾，右侧显示 `已播 / 总长`
- 文件不存在或浏览器不支持该格式时，只在当前行显示「音频暂时无法播放」，不会打开网易云官网

进度条与音量条共用 `script.js` 里的 `bindDrag(bar, onRatio)`：按下即定位、拖动跟随、抬起释放（指针捕获 + `pointercancel` 兜底）。要再加一根类似的条，直接调它即可，不用重写一遍指针逻辑。

### 歌词滚动

单曲行上的 `data-lrc` 指向歌词文件（当前是 `assets/audio/cha-tang.lrc`）。**这个文件不存在时歌词整块保持 `hidden`、不占任何空间**，页面与没有这个功能时完全一样；放进文件后自动出现。

- 格式就是标准 LRC：`[mm:ss.xx]歌词`。一行带多个时间戳都认，`[ar:]` `[ti:]` 这类标签行会被忽略
- 播放时按 `timeupdate` 同步，当前句高亮并居中滚动；只在句子变化时才滚一次，不会每帧抖动
- 点某一句跳到那一句（暂停状态下点会直接开始播放）
- 三行小窗 + 上下渐隐遮罩；矮窗口（高 ≤ 820px）收成两行，保证 HI-FI 仍是一节一屏
- 开启「减少动态效果」时不做平滑滚动，直接跳位
- 平滑滚动在后台标签页或某些节流环境里可能完全不生效，这里做了兜底：若 600ms 内滚动位置一动没动，就直接跳到目标位置，避免「高亮走了但歌词不动」

歌词文件就在 `assets/audio/cha-tang.lrc`：52 句，UTF-8 无 BOM，时间轴 0:25–4:36，时间戳严格升序。换歌时 `data-src` 与 `data-lrc` 一起改，LRC 保持 UTF-8 即可（从播放器歌词页复制来的多半是 GBK，需要先转成 UTF-8，否则会乱码）。

> 歌词文本受版权保护，公开仓库里托管歌词属于公开传播，是否放由你自己判断；这份是你提供并确认要用的。以后如果网易云解析插件配好了代理（`API_BASE`），也可以让歌词直接从那边取，不必放在仓库里。

首次点击播放时才请求音频；线上 Cloudflare 会按 HTTP Range 分段传输，进度条可以拖动。这个仓库是公开的，请确认你有权公开托管这份音频。

本地预览时记得用 `tools/serve.py` 而不是 `python -m http.server`，否则进度条拖不动，原因见下面「本地预览」。

## 窗口尺寸适配

版式不再用「某个宽度对应某一档尺寸」的写法，而是用一个统一的缩放单位跟视口比例联动，因此**任何分辨率、任何系统缩放（Windows 100% / 125% / 150% / 175%）下，内容占屏的比例都一致**。

核心就两条，写在 `styles.css` 的 `:root` 里：

- `--u: min(1vw, 1.6vh)` —— 全站唯一的尺寸单位。所有字号、间距、行距都写成 `calc(N * var(--u))`。16:9 及更宽的屏幕由高度主导，于是每节 100vh 的填充率恒定；超宽屏则由宽度主导，避免内容被横向拉爆。
- `--maxw: clamp(280px, 74vw, 3000px)` —— 内容宽度按视口比例给（各档实测都是 74%~75%），不再随宽度档跳变。

图片高度用 `clamp(下限, min(Xvh, Yvw), 上限)`，同时受高度和宽度约束：屏幕高度变了图片跟着变，窗口变窄时又不会撑爆栏宽。

字号一律带可读性下限（如正文不低于 11px、标签不低于 10px），所以极小的窗口里字号不会再缩，这时由 `@media (max-height: 820px)` 这一档把图片高度让出一部分，保证一节仍是一屏。

结构断点只剩三处：

- **宽度 ≤ 1180px 且竖屏**（iPad 竖屏、竖屏窗口）：和手机一样改为上下堆叠、自然滚动，不再硬塞双栏。竖屏时 1024px 宽的双栏一屏会非常局促。
- **宽度 ≤ 900px**：上下堆叠、自然滚动，顶部导航收起为抽屉菜单，章节指示器移到页面底部，内容宽度改为 `92vw`。
- **宽度 ≤ 620px**：手机档，进一步压缩字号与间距。

### 实测数据（11 个尺寸）

在 4K@100%/125%/150%/175%、1440p、1080p@100%/125%/150%、1366×768 上实测：内容宽度 74%~75%，各章填充率 43%~71%，每章正好一屏，横向溢出 0。

字号与图片高度的整体比例由 `--u` 的倍数控制（如 `.wordmark` 是 `min(calc(7.2 * var(--u)), ...)`）。想整体放大或缩小，把所有 `N * var(--u)` 的 N 同乘一个系数即可；图片另在 `.frame--*` 的 `min(Xvh, Yvw)` 里按同一系数调 X 与 Y。

改完版式后想复核，最快的办法是在浏览器里把窗口从最大拖到很窄、再从 100% 缩放到 150%，看两点：每章是否仍是一屏（不出现半截内容），以及是否出现横向滚动条。

## 项目页的悬停简介

PROJECTS 一页上，把鼠标停在某个项目名字上**满 2 秒**会触发一次展开：

- 左栏收窄到「项目名文字的实际宽度」，预览模块因此左移贴住文字，同时略微变窄；
- 模块原本占据的右侧位置淡入该项目的简介（分类、标题、两三句说明、技术标签）。

鼠标移出整个作品区、按 `Esc`、或窗口变窄进入单栏布局时，都会收起。用键盘 `Tab` 聚焦到项目名不需要等 2 秒，立即展开。

实现要点（改的时候别踩坑）：

- 左栏宽度与简介宽度都由 JS 按**文字的真实宽度**量出来写进 CSS 变量（`--list-w-idle / --list-w-hug / --brief-w`），两个状态只改 `width`，所以能平滑过渡。量宽度必须遍历文本节点用 `Range` 量，直接量元素盒子会得到被拉伸满栏的宽度；也不能把整栏文字都算进去，行尾的箭头 `↗` 会把宽度顶满。
- 简介在收起状态必须 `width: 0; height: 0`：只把宽度归零的话，文字会在零宽容器里逐字换行，把整个章节撑成两三屏高。
- 单栏布局（手机、竖屏）下简介整体 `display: none`，交互不参与。
- 简介内容是成对的 `<span class="zh">` / `<span class="en">`，与全站双语规则一致；无 JS 时全部简介直接铺开显示，不会丢内容。简介里每项含「分类 / 标题 / 两三句说明 / 3 条具体要点 / 技术标签」，要点来自各仓库 README。
- **别在展开那一刻做测量。** 宽度测量里有一次 `getBoundingClientRect`，如果在 `open()` 里同步做，会在动画起步的同一帧强制整页重排，观感就是「顿一下」。现在测量放在页面载入、窗口 resize、以及鼠标刚进入项目名时（比 2 秒动画早得多），展开本身只切一个 class。
- 简介内容按最终宽度排版好（`.work-brief-item { width: var(--brief-w) }`），外层只做裁剪揭示，所以动画期间文字不会逐帧重新折行。
- 矮窗口（高 ≤ 820px）里简介窄了会不停换行、把章节顶超一屏，因此这时简介的宽度占比从 44% 提到 62%。
- 改完简介文案后建议在**中英文各测一遍**：英文文案更长，容易在 1280×698 这类小窗口把章节顶超一屏。

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
python tools/serve.py          # 默认 8000，也可 python tools/serve.py 8080
```

然后访问 <http://localhost:8000>。

用 `tools/serve.py` 而不是 `python -m http.server`：**音频进度条拖动要求服务器支持 HTTP Range**。标准库的 `http.server` 不返回 `Accept-Ranges`，浏览器拿到的 `audio.seekable` 是 `[0, 0]`，于是本地拖进度条会「跳一下又回到 0」，很容易误以为播放器写坏了；线上 Cloudflare / GitHub Pages 都支持 Range，不受影响。`tools/serve.py` 就是在 `SimpleHTTPRequestHandler` 上补了 Range，顺便关掉缓存，改完文件刷新即可看到。

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
