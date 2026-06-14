# MoleAssetDecoder

摩尔庄园 iOS IPA 资源解码/导出工具，用 C# 实现。
它把 IPA 里的表、贴图、图集和 ASprite 动画元数据导出成后续庄园绘制更容易消费的目录结构。这个工具只处理 IPA 资源，不读取 `map.dat` 或 `userinfo.dat` 存档。

## 用法

```powershell
dotnet run --project .\tools\MoleAssetDecoder\MoleAssetDecoder.csproj -- `
  --ipa "Mole.ipa" `
  --out .\exported-assets `
  --locale zh-Hans
```

参数：
- `--ipa`：输入 IPA 路径。
- `--out`：导出目录，默认建议用 `.\exported-assets`。
- `--locale`：语言目录，默认使用 `zh-Hans`。

## 主要输出

- `manifest.json`：导出摘要，包含表、纹理、图集、ASprite 等清单。
- `object-catalog.json`：从 `property*` 和 `property_description*` 解出的物件表，供绘制和玩法查表使用。
- `atlas-frames.json`：Cocos plist 图集帧矩形，指向对应 atlas 纹理。
- `asprite-frames.json`：`*_asprite*.dat` 里的模块、帧和动画记录，供预览器从整张帧条中裁出真实单帧。
- `tables/*.json`：解码后的 binary/XML plist，以及可 AES 解密的 DAT plist 表。
- `textures/png/*`：可给浏览器/WebGL 使用的 PNG/JPG 资源，包括 PVR/CCZ 解出的 PNG。
- `textures/pvr/*`：从 `.pvr.ccz` 解包出来的 PVR 原始载荷。

## 说明

- Mole `.dat` plist 使用 AES-128-ECB 解密，密钥为 `39653543fa0d66aa`。
- `.pvr.ccz` 是 zlib CCZ 容器，解包后的 PVR 载荷用 `TextureCompressor.FileFormats.Pvr` 解码。
- Apple CgBI PNG 会转换成标准 RGBA PNG，方便浏览器和 WebGL 直接加载。
- `*_asprite*.dat` 是客户端自定义 ASprite 二进制动画数据；导出器会解析其中的 module、fmodule、frame、aframe 和 animation 记录，并写入 `asprite-frames.json`。
