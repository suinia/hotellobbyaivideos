# 语言资源维护

所有站点译文放在本目录，运行时不调用翻译服务。

```text
locales/
  config.json             # 支持的语种、显示名称、HTML 语言、首次 IP 判断
  en/                     # 默认语言，也是文案结构的基准
    common.json           # 共享控件、导航、页脚
    home.json             # 首页
    workbench.json        # 工作台、账户、套餐、动态提示
    seo.json              # SEO 正文、协议、教程与元信息
  de/                     # 所有语种均与 en 使用相同的文件和 key
  fr/
  es/
  pt-br/
  ja/
  zh-tw/
  catalog.generated.ts    # 自动生成的资源导入，勿手改
  source-index.json       # 现有英文文案到固定 key 的兼容索引
  legacy-patterns.json    # 现有动态英文句子的匹配规则，不包含译文
  seo-paths.json          # 从页面加载器生成的公开路由索引
```

## 修改现有文案

1. 在 `en/` 搜索原文，找到对应 key。迁移文案的 `copy_...` key 是固定标识，不随文案修改而改变。
2. 修改所有语言相同 key 的内容。不要因改文案而重命名 key。
3. 运行 `npm run i18n:check`。正常改文案无需改页面、词典加载器或语言分支代码。

首页保持可读的结构，例如 `home.hero.title`。原有英文页面使用兼容索引读资源；英语 SEO 页面也走同一个资源渲染器，通过内部 rewrite 保持公开网址和 canonical 不变。

## 新增文案

在所有语言文件里增加同一个可读 key，例如：

```json
{ "upload.limit": "You can upload up to {count, number} images." }
```

德语、法语可以调整词序，但必须保留 `count` 参数及 `number` 格式。

新控件按固定 key 读取：

```tsx
const locale = useUiLocale();
const message = t(locale, "workbench.upload.limit", { count: 3 });
```

导入 `t`：`@/lib/i18n/catalog`。创建新控件需要编写控件代码；之后修改措辞、补译文只改 JSON。

不要新增 `locale === "de"` 之类的文案分支。数据库模板标题、prompt、用户输入、模型输出和回调参数保持原样，不能作为翻译后的功能值提交。

### 保护数据库和用户内容

翻译渲染器会检查可见字符串，所以标题即使恰好是 `Create` 或 `Product Ad` 也要明确保护：

```tsx
<span data-i18n-skip>{template.title}</span>
<InspirationPreview data-i18n-preserve="title" title={template.title} />
```

`data-i18n-skip` 保护整个节点；`data-i18n-preserve` 仅保护列出的属性，其他功能控件仍翻译。图片替代文本通过 `t()` 插入原始名称，再保护 `alt`。JSON-LD 可用该属性列出要保留的字段路径，例如 `itemListElement.3.name`。

Metadata 使用 `preserveSeoFields()` 保留数据库描述；需要在数据库名称旁翻译固定说明时，使用 `setSeoFieldTranslations()` 与 `t()` 插值。这些保护记录不会写入 HTML 元信息。

## 新增语种

1. 复制 `en/` 为新语种目录，翻译内容并保留所有 key 与参数。
2. 在 `config.json.languages` 添加语种，例如 `es` 的名称、`htmlLang`、`openGraphLocale`。
3. 如需首次 IP 自动选中该语言，在 `config.json.geo` 加国家或地区规则。
4. 运行 `npm run i18n:generate` 和 `npm run i18n:check`。

语言菜单、路径、Cookie 校验、HTML 语言、hreflang 和 Sitemap 自动按配置扩展，无需手改业务代码。构建时会自动生成导入并校验。

## 新增命名空间

在 `en/` 增加 JSON 文件，并为其他语种添加同名文件，再运行生成和检查命令。加载器会自动发现命名空间。新增公开页面仍需实现页面并注册页面加载器；其路由索引由生成命令同步。

## 校验

`npm run i18n:check` 检查语种间 key、占位符名称及格式一致，也检查兼容索引和动态规则引用的 key 存在。构建会先生成并校验资源，漏 key 或漏参数会阻止构建。
