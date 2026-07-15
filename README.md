# mole-data-editor

> 摩尔庄园早期 iOS / iPad 版**本地存档编辑器** · 纯网页工具，打开即用。

浏览器里直接读取、修改、导出摩尔庄园移动版的本地存档（`userinfo.dat` 玩家数据 / `map.dat` 地图数据），玩家数据与地图数据分开处理。无需安装、无后端，所有解析都在本地浏览器内完成。

## 功能

- 📂 **导入 / 导出 `.dat` 存档** —— 内置存档格式解析器（`dat-parser.js`），处理淘米 iOS 存档的 AES 加密、MD5 校验尾与 Apple 时间戳
- 👤 **玩家数据编辑** —— 昵称、货币、物品等字段的读取与修改
- 🗺️ **地图数据编辑** —— 庄园地图数据独立读取与修改
- 🖼️ **庄园预览** —— `manor-preview.js` 根据数据渲染庄园布局预览
- ✅ 修改前后带字段校验，避免写出损坏存档

## 使用

直接用浏览器打开 `index.html` 即可（纯静态页面）。点「载入示例」可查看结构，或导入自己的 `.dat` 文件进行编辑。

## 附带工具：MoleAssetDecoder

`tools/MoleAssetDecoder/` 是一个配套的 C# 资源解码工具，把摩尔庄园 iOS IPA 里的表、贴图、图集和 ASprite 动画元数据导出成便于消费的目录结构。它只处理 IPA 资源，不读取存档。详见 [`tools/MoleAssetDecoder/README.md`](tools/MoleAssetDecoder/README.md)。

## ⚖️ 免责声明

本工具用于游戏保护（game preservation）、研究与个人存档管理，仅供**离线复活**的老玩家自用。《摩尔庄园》及其数据格式版权归上海淘米所有，本仓库不含任何游戏资源或存档。

---

*[摩尔庄园钉子户](https://github.com/moleworld-dev) · 让停运的庄园在每一代设备上继续活下去。*
