# 国内访问加速部署指南

## 现状诊断

qiongkura.xyz 目前托管在 **Cloudflare Pages(免费版)**,大陆访客的请求绕海外节点,
走拥塞的跨境线路。实测(晚高峰):

| 资源 | TTFB | 总耗时 |
|---|---|---|
| 首页 HTML(62KB) | 0.8 ~ 11s | **44 ~ 155s** |

字体阻塞已解决:Google Fonts 改为**自托管子集化 woff2**(`fonts/` 目录,约 460KB,
`font-display: swap` 不阻塞首屏,同域加载)。

## 方案 A:腾讯云 EdgeOne Pages(推荐,免费、无需备案)

EdgeOne Pages 有香港/海外优质节点,大陆访问普遍明显快于 CF 免费版;支持从 GitHub
自动部署,工作流与现在完全一致。

1. 登录腾讯云控制台 → 搜索「EdgeOne Pages」→ 开通(免费)
2. 创建项目 → **从 Git 仓库导入** → 授权 GitHub → 选 `Qiongkura/my-profile`
3. 构建配置:选 **静态站点 / 无需构建**,输出目录填 `/`(仓库根就是站点)
4. 部署完成后会得到一个 `xxx.edgeone.app` 预览域名,先验证功能
5. 绑定自定义域名:项目设置 → 域名管理 → 添加 `qiongkura.xyz`
   → 到你的域名 DNS 处,把指向 Cloudflare 的记录改为 EdgeOne 提示的 CNAME
6. HTTPS 证书自动签发;之后 `git push` 会自动重新部署(与 CF 相同)

> 注意:切换 DNS 后 Cloudflare 上的旧部署保留与否均可;建议先并行验证再切。

## 方案 B:国内 CDN + OSS(最快最稳,需要 ICP 备案)

1. 域名 ICP 备案(个人备案约 2~4 周;qiongkura.xyz 可备案,需在国内注册商或转入)
2. 腾讯云 COS / 阿里云 OSS 开静态网站托管,上传站点文件
3. 绑定已备案域名 + CDN 加速,大陆节点秒开
4. 可与 Cloudflare 双线并存:DNS 分线路解析(国内 → 国内 CDN,境外 → CF)

## 方案 C:维持 Cloudflare

零改动;接受晚高峰跨境拥塞(早间/非高峰尚可)。

## 已完成的优化(任何方案下都有效)

- [x] 移除 Google Fonts 渲染阻塞(国内访问必卡项)
- [x] 字体自托管:`tools/make-fonts.py` 按站点用字生成子集化 woff2
      (Inter ×4 字重 + 思源黑体 ×3 字重,共约 460KB,`font-display: swap` 不阻塞)
- [x] 站点文案改动后重跑 `python tools/make-fonts.py` 即可刷新字体子集

## 弹弹珠机页面

`/marble/` 是纯静态独立页,随主站一起部署,无需额外配置。
