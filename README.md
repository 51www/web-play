# Web Play

可直接部署到 Cloudflare Pages 的纯静态本地视频播放器。视频文件只在浏览器本地读取，不会上传；支持播放列表、弹幕匹配与弹幕渲染。播放内核使用成熟开源播放器 Video.js 8，避免自行实现播放控制。

支持 0.5×–2× 倍速播放，可通过播放器控制栏菜单、右上角快捷按钮或设置中的默认倍速切换；支持在设置中配置去片头/去片尾秒数，播放时自动跳过。单集循环时会在片尾跳回片头之后继续播放。

新增能力：全局快捷键与操作指南、外挂 SRT/VTT 字幕（同名字幕自动挂载、延迟与样式可调）、当前帧截图（可选含弹幕）、画中画、视频信息面板、只读弹幕列表点击跳转、进度条缩略图预览、文件夹批量导入、片单搜索/排序/收藏/标签/最近播放。项目不包含弹幕发送与章节打点。

## 样式关键词

拟物化、真实材质、深棕皮革、拉丝金属、暖白纸张、织物纹理、黄铜配件、青绿点缀、凸起与凹陷、细腻内阴影、边缘高光、缝线与螺丝细节、克制过渡。

主色为皮革棕 `#3D302C`、暖纸色 `#F8F2E6`、金属米灰 `#D8D0C1`、黄铜 `#B77A45`、青绿 `#477D76`，桌面底色为 `#E9E1D3`。这些关键词与色值集中体现在 `src/styles.css` 的设计变量中。侧栏采用皮革材质，播放器与顶栏为拉丝金属，面板和抽屉使用纸张质感；按钮、开关与滑轨通过高光、内阴影和按下位移呈现物理质感。非全屏时播放器宽度限制为 980px，片单位于右侧，窄屏下片单转为抽屉。

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

构建产物位于 `dist/`，仅包含静态资源。

## 部署到 Cloudflare Pages

### 方法一：连接 Git 仓库自动部署（推荐）

1. 将项目推送到 GitHub、GitLab 或其他 Cloudflare Pages 支持的 Git 仓库。
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
3. 进入 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
4. 选择仓库和需要部署的分支，例如 `main`。
5. 填写构建配置：

   | 配置项 | 值 |
   | --- | --- |
   | Framework preset | `Vite` |
   | Root directory | 留空或 `/`，即项目根目录 |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node.js 版本 | 20 或更高；如平台默认值过低，可添加环境变量 `NODE_VERSION` = `20` |

6. 无需配置其他环境变量；项目不依赖服务端密钥或后端服务。
7. 点击 **Save and Deploy**，等待构建完成。
8. 部署成功后会得到 `https://<项目名>.pages.dev` 访问地址。
9. 每次向部署分支推送提交都会自动重新部署；其他分支会生成 Preview 部署。

### 方法二：使用 Wrangler CLI 上传本地构建产物

适合不接 Git、手动发布或临时验证的场景。

```bash
# 安装 Wrangler（如已安装可跳过）
npm install -g wrangler

# 登录 Cloudflare 账号
wrangler login

# 构建静态产物
npm run build

# 上传到 Cloudflare Pages
wrangler pages deploy dist --project-name web-play
```

首次执行时，如果 `web-play` 项目不存在，Wrangler 会引导创建。后续更新重复执行构建与 `pages deploy` 即可。部署完成后终端会输出访问地址。

### 绑定自定义域名

1. 在 Cloudflare Dashboard 打开对应的 Pages 项目。
2. 进入 **Custom domains** → **Set up a custom domain**。
3. 输入域名，例如 `player.example.com`。
4. 按提示添加 DNS 记录；域名在该 Cloudflare 账号下时通常可自动完成配置。
5. Cloudflare 会自动签发 HTTPS 证书，无需额外配置。

### 部署后检查

- 打开 `pages.dev` 地址或自定义域名，应看到“把视频带进放映室”的空状态页面。
- 点击“打开视频”，选择一个本地 MP4/WebM 文件，确认可以播放。
- 打开“弹幕”面板，确认可以加载或手动导入弹幕。
- 若使用自定义域名后弹幕加载失败，优先检查弹幕 API 是否对该域名开放 CORS。
- `public/_headers` 会在构建时复制到 `dist/_headers`。可用 `curl -I https://你的域名/assets/...` 检查静态资源缓存头是否生效。

### 部署注意事项

- 本项目是纯静态站点，不要启用 Cloudflare Workers Functions 或 Serverless Functions。
- 不要将任何私密凭据写入源码或提交到 Git；弹幕 API 地址属于浏览器可见配置。
- `public/_headers` 和 `public/_redirects` 分别用于缓存/安全头与单页回退，请勿删除。
- 视频文件不会随站点部署，用户始终从自己的设备选择本地文件播放。

## 弹幕接口

弹幕 API 地址可在“设置”中修改，默认使用参考插件的公开接口地址。请求链路与 `danmu-chrome` 插件一致：

```text
GET {API_BASE}/api/v2/search/anime?keyword=...
GET {API_BASE}/api/v2/search/episodes?anime=...
GET {API_BASE}/api/v2/comment/{id}?format=json
GET {API_BASE}/api/v2/comment?url={url}&format=json
```

注意：插件通过扩展后台权限解决跨域；本项目是静态网页，必须确保弹幕 API 对部署域名开放 CORS。若接口不可达，视频仍可正常播放，也可在弹幕面板手动导入 JSON/XML 弹幕文件。

## 数据与隐私

- 视频 Blob 与片单保存在浏览器 IndexedDB。
- 设置保存在 localStorage。
- 弹幕关键词会发送给弹幕 API；视频内容不会发送。
- 删除片单或视频引用时会同时清理 IndexedDB 中的 Blob。

## 已知限制

- 视频能否播放取决于浏览器的编码支持，项目不做转码。
- File System Access API 在部分浏览器不可用，本项目统一使用文件输入与 IndexedDB，刷新后可从本地数据库恢复视频。
- 弹幕服务当前不提供发送接口，因此本项目不实现弹幕发送。
