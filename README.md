# HairFlow website

自包含静态网页，直接打开 `index.html` 即可。无后端、CDN、字体下载、
WebGL、三维模型加载或编译步骤。整目录复制即可部署。

```bash
cd /root/HairDiffusion/website
python -m http.server 8000 --bind 127.0.0.1
```

打开 `http://localhost:8000`；远程服务器用 VS Code / SSH 转发 8000 端口。
已有 tmux 预览会话 `hairflow_website_preview`。

## 内容

1. 标题、8位作者及单位、teaser、正式 caption 和 abstract。
2. Method：pipeline 图及用户提供的正式 caption。
3. Results：12例，每页4例，共3页。
4. Comparisons：论文对比图及用户提供的正式 caption。
5. Simulation：两段仿真视频，注明 Unreal Engine 风吹头发仿真。

单位 1 为 Shanghai Jiao Tong University，2 为 LightSpeed Studio。
Yating Wang 1,2；Kui Wu 2；Ran Yi 1；Zixuan Lu 2；Tongtong Wang 2；
Zhongtian Zheng 2；Lizhuang Ma 1；Yuefan Shen 2。
Lizhuang Ma 标注 `*`，单位下方注明 `* Corresponding author`。

## 图片视角交互

- 拖动 mesh 或 strands，二者同步切换视角。
- 每行 View 滑条也能切换视角；Reset / 双击恢复正面。
- 键盘聚焦图像后，左右键切换，Home 复位。
- 结果区顶部和底部都提供 Previous / 1 / 2 / 3 / Next，数字下方为对应样例编号。
- 当前页高亮，文字显示 “Examples 1–4 of 12 · Page 1 of 3”；首尾页禁用对应按钮。
- 从底部切换后自动返回结果页顶部，并将键盘焦点移至当前页按钮。
- 不再使用翻页滑条或隐藏的横滑翻页，避免与旋转混淆。
- 拖动模型图片只改变视角，不翻页。
- 手机保持页面纵向滚动；输入/sketch在上，mesh/strands并排在下。

每例8个固定仰角的环绕视角，方位角间隔45°。采用离线图片而非实时3D，
不支持任意俯仰或真实几何缩放。两侧共享相机与视角索引。
每例 mesh/strand 各一张 WebP 图集，共16帧；单帧512×512，
图集2048×1024。正面小图优先显示；行接近视口时预加载并解码图集，
后台每次只加载一对，不预加载其他分页。交互时复用缓存。
新图集使用 `random8-hq` 文件名，CSS/JS带版本号，避免误用旧资源缓存。
浏览器只需解码图片和 canvas 2D 绘制，无模型下载或显卡渲染要求。

## 素材与来源

`assets/turntables/manifest.json` 保存12个选例、原论文页/行、
几何来源哈希和渲染处理记录。保留盘发、复古卷发、马尾、动漫、
短发、稀疏头发、绘画及长卷发等不同例子。

多视角图复用 `blender/render_hair_simple.py` 和 `blender/render_mesh_simple.py`：
使用全密度论文展示几何，不再使用上一版的4万面/8000根简化模型。
mesh采用论文 comparison 的 `--hair_normal_color --normal_palette direct`，
strands采用用户确认的 `--per_strand_color`，基于原始strand索引的随机HSV，
跨视角保持一致。发丝半径沿用原论文 `.00014`。
原先误用的固定低饱和 palette 已弃用；见 `preview/strand-color-audit.jpg`：
左为原论文图，中为错误palette，右为同相机/同分辨率复现原随机映射。
两者与bust统一坐标，沿用原正面相机仰角和中心，初始缩放0.88留出旋转余量。
strand渲染器检查全部发丝顶点以确定整圈固定构图，mesh严格复用其每帧相机。
离线渲染768px，Cycles发丝128 samples、网格256 samples；网页下采样至512px，
图集WebP质量90，正面封面质量92。材质和随机颜色映射沿用论文。
这不是新推理结果，没有修改原始模型、姿态或实验结果。

## 目录

```text
index.html                  论文正文与布局
style.css                   样式
script.js                   四例分页、图片同步视角、灯箱、视频
assets/cases.js             12例索引，无 fetch，兼容 file://
assets/turntables/          24张WebP图集、24张小封面及manifest
assets/images/              实际使用的论文图、输入、sketch、仿真封面
assets/videos/              两段仿真MP4
assets/manifest.json        发布素材来源
tools/check_site.py         自包含性、图集、视频检查
tools/pack_turntables.py    从离线渲染帧重新打包图集
tools/render_turntables.py  使用原论文Blender渲染器生成8视角
tools/render_mesh_views.py  mesh渲染入口，复用strand相机和原论文材质
preview/                    新版浏览器截图
```

旧版模型、Three.js、未使用视频、PDF副本及旧截图已移出网站，
临时备份在 `/tmp/hairflow-website-v2-archive`，不参与运行和发布。
论文原文件与 `/root/output` 原始实验数据未改动。
本次离线帧位于 `/tmp/hairflow-paper-turntables-random-hq`，可用 `pack_turntables.py`
重新打包；临时目录不是永久数据存储。原始几何的长期来源和渲染器哈希在 manifest 中。
需重新生成时，在 hairgen 环境和 tmux 中运行 `tools/render_turntables.py`，
它仅写入 `--output`（默认上述临时目录），不会改写原始实验数据。
Blender 及原始几何仅用于离线制作，不属于网页运行依赖。

## 验证

```bash
python website/tools/check_site.py
node --check website/script.js
```

浏览器实测：每页4例、12例切换，全部图集加载，同步拖动/滑条/复位，
作者单位，无外部网络请求，无WebGL，以及320/390/768/1440px布局。
