# 国标 2025 文献助手

[English](README.en.md) · [简易操作说明](docs/QUICK_START.md) · [服务与支持](SERVICES.md) · [隐私说明](PRIVACY.md)

面向 Zotero 9 的免费开源插件，用于批量整理 GB/T 7714—2025 参考文献所需的拼音姓名和在线电子资源元数据。

如果插件解决了你的问题，欢迎点亮 Star，让更多 Zotero 用户发现它。

## 功能

- 按常见中国姓氏、拼音结构和条目语境识别可能需要处理的拼音姓名。
- 按文献折叠预览作者、编辑、译者等责任者，确认后转换为 `Wu Saixuan` 式单字段姓名。
- 批量写入 `Medium: OL`，规范 DOI，保留完整的年、卷、期和页码。
- DOI优先；没有 DOI时使用 URL；无 DOI/URL时禁止标记 OL。
- 安全清理冲突的 `Medium:` 行，也可明确选择清空整个 Extra。
- 每次应用前保存本地快照，支持重启、升级或重新安装插件后的批次撤销。
- 配套提供 Zotero/citeproc-js 专用的 GB/T 7714—2025 顺序编码双语 CSL。

姓名识别只提供候选，不推断或断言作者国籍。所有更改均在预览确认后执行。

## 安装

1. 从本项目 [Releases](https://github.com/WANGZFOF/GB-T-7714-2025-Helper/releases) 下载 `.xpi`。
2. 打开 Zotero 的“工具 → 插件”。
3. 点击插件管理器右上角“Tools for all plugins”按钮。
4. 选择“Install Plugin From File…”，再选择下载的 XPI。
5. 重启 Zotero。

不要使用 Zotero 的文献“导入”功能安装插件。

## 使用

1. 在条目列表选择一篇或多篇普通文献。
2. 右键打开“GB/T 7714—2025 文献助手”。
3. 选择“规范化…”，按条目展开并确认姓名或电子资源。
4. 点击“应用所选更改”。

同一右键菜单还提供“撤销上一次修改…”和“修改记录与撤销…”。发生后续人工编辑时，插件默认跳过冲突字段，只有明确勾选“强制恢复”才会覆盖。

## 批量预览界面

姓名规范化和电子资源（OL）是两个独立功能模块。姓名候选按文献折叠，电子资源按表格行集中编辑；列表可独立滚动，底部操作按钮始终可见。

![120 篇文献的姓名规范化批量预览](docs/screenshots/batch-120-name-module-0.3.1.jpeg)

![120 篇文献的电子资源批量预览](docs/screenshots/batch-120-online-module-0.3.1.jpeg)

## 本地历史与隐私

插件完全离线运行，不查询 DOI、ORCID、Crossref或其他外部服务。修改历史保存在 Zotero 数据目录的 `gbt7714-2025-helper` 子目录，不参与 Zotero同步，也不会因插件升级或卸载自动删除。

## 联系作者

若使用Zotero过程中遇到问题，可以联系作者远程协助，可提供全流程Zotero专业服务。

- 作者：Zotero金牌讲师
- 微信：`ZoteroGL`
- 邮箱：`929459880@qq.com`

<img src="content/assets/wechat-contact.png" alt="Zotero金牌讲师微信联系二维码" width="220">

本项目为个人独立开发项目，与 Zotero 官方无隶属或授权关系。可提供的服务类型见 [SERVICES.md](SERVICES.md)，不在仓库公开具体价格。

## 支持项目

Star 是对项目最直接的支持。插件完全免费；赞助不会解锁额外功能，也不代表购买任何服务。

<details>
<summary>☕ 自愿请作者喝杯咖啡</summary>

| 微信赞助 | 支付宝赞助 |
| --- | --- |
| <img src="docs/assets/wechat-support.png" alt="微信自愿赞助二维码" width="240"> | <img src="docs/assets/alipay-support.jpg" alt="支付宝自愿赞助二维码" width="240"> |

</details>

## 开发

```bash
npm test
npm run check
npm run build
```

构建结果写入 `dist/gbt7714-2025-helper-<version>.xpi`。

## 许可证

插件代码采用 [GNU AGPL v3](LICENSE)。配套 CSL 保留样式文件中声明的许可和原模板来源。
