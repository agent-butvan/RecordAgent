# TypeSafe Jev / System One 错误处理调研

> 调研日期：2026-09-21。仅采用 TypeSafe 官方文档、官方 SDK 与第一方 API 实测；官方文档仍处于快速迭代期，落地前应再次核对链接内容。

## 结论摘要

1. Jev 的 HTTP 入口是 `POST https://api.typesafe.ai/v1/systemone`，使用 `Authorization: Bearer <API_KEY>` 和 JSON body。成功响应 body 的稳定结构是 `model`、`answers`、`usage`；`usage` 只有 `input_tokens`、`output_tokens`。[官方 HTTP API Reference](https://docs.typesafe.ai/api)
2. TypeSafe HTTP API Reference 只承诺错误使用标准 HTTP 状态码和描述问题的 JSON body，**没有声明固定的错误 body schema**。官方 JavaScript SDK 将 `APIError.body` 定义为 `unknown`，并明确它可能是“解析后的 JSON、纯文本或空”；Python SDK也把错误 body 描述为“JSON error body、纯文本或 `None`”。因此本项目不能把 `message`、`detail.message` 或 `error.message` 中任一形状当作长期服务端契约。[官方 HTTP API Reference](https://docs.typesafe.ai/api) · [JavaScript `APIError`](https://docs.typesafe.ai/sdk/javascript/api/classes/APIError) · [Python Exceptions](https://docs.typesafe.ai/sdk/python/api/exceptions)
3. 官方 SDK 明确区分 `400`、`401`、`403`、`404`、`422`、`429` 和 `5xx`；连接失败和超时没有 HTTP response，是单独异常。[官方 SDK 源码](https://github.com/typesafe-ai/typesafe-sdk-js/blob/66880ccded6cb642dc1809620c2b108c33730214/src/errors.ts)
4. 可观测信息应优先读取响应头 `x-typesafe-request-id`。官方 SDK在成功和失败路径都提供 request ID，但 JavaScript 类型将其标为可选，说明客户端必须允许 header 缺失。[`APIError.requestId`](https://docs.typesafe.ai/sdk/javascript/api/classes/APIError#requestid) · [`WithResponse.requestId`](https://docs.typesafe.ai/sdk/javascript/api/interfaces/WithResponse#requestid)
5. 官方 SDK 默认每次尝试超时 10 秒，初次请求后最多重试 2 次；默认重试 `408`、`429`、所有 `5xx`、连接错误和超时，并采用带 jitter 的指数退避。它会优先尊重 `retry-after-ms` 或 `Retry-After`，最长接受 60 秒服务端等待提示。[`RetryPolicy`](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy) · [`TypeSafeClientConfig.timeout`](https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig#timeout) · [官方重试实现](https://github.com/typesafe-ai/typesafe-sdk-js/blob/66880ccded6cb642dc1809620c2b108c33730214/src/retry.ts)

## 请求与成功响应契约

### 请求

```http
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

```json
{
  "state": "需要判断的文本、对象或数组",
  "model": "jev-latest",
  "questions": {
    "question_id": {
      "type": "noul",
      "instructions": "一个原子判断问题"
    }
  }
}
```

顶层必填字段为：

- `state`: `string | object | array`；
- `model`: `string`，官方推荐使用 `jev-latest`；
- `questions`: `map<string, Question>`，每个 answer 以相同 question id 返回。

问题类型为 `noul`、`choice`、`score`。完整字段、Choice 上限 255 项、Score 2–10 级等限制见[官方 HTTP API Reference](https://docs.typesafe.ai/api)。

### 成功响应

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "question_id": {
      "type": "noul",
      "noul": 0.95
    }
  },
  "usage": {
    "input_tokens": 296,
    "output_tokens": 20
  }
}
```

官方 HTTP Reference 把 `model`、`answers`、`usage` 标为 required。Choice 和 Score answer 还包含 `confidence` 和 `probabilities`；Score 另含 `legend`。Noul 只承诺 `noul` 概率，没有独立 `confidence` 字段。[官方 HTTP API Reference](https://docs.typesafe.ai/api) · [官方 Quick Start](https://docs.typesafe.ai/introduction/quickstart)

`usage` 是**成功响应 body** 的字段。当前官方资料没有承诺错误响应也携带 usage，因此失败调用不能依赖 token usage 存在，也不应自行推算为“供应商实际用量”。

## 错误响应与 HTTP 状态

### 官方明确的状态分类

| 状态/失败类型 | 官方 SDK 含义 | 默认是否重试 |
| --- | --- | --- |
| `400` | 请求无效 | 否 |
| `401` | 认证失败 | 否 |
| `403` | 无权限 | 否 |
| `404` | 资源不存在 | 否 |
| `408` | 请求超时状态 | 是 |
| `422` | 服务端参数校验失败 | 否 |
| `429` | 超出限流 | 是 |
| `529` | TypeSafe 服务暂时过载 | 是（归入 `5xx`） |
| `5xx` | 服务端处理失败 | 是 |
| 连接失败 | DNS、TLS、连接关闭、response body 读取失败等，无 HTTP response | 是 |
| 客户端超时 | 完整响应未在本次尝试的 timeout 内到达，无 HTTP response | 是 |

来源：[官方 HTTP API Reference](https://docs.typesafe.ai/api) · [官方 JavaScript SDK 错误分类](https://github.com/typesafe-ai/typesafe-sdk-js/blob/66880ccded6cb642dc1809620c2b108c33730214/src/errors.ts) · [官方 Python Exceptions](https://docs.typesafe.ai/sdk/python/api/exceptions) · [官方 RetryPolicy](https://docs.typesafe.ai/sdk/python/api/retries)

注意：这是官方 SDK 暴露和处理的状态集合，不等于服务端承诺“只会返回这些状态”。其他非 2xx 状态在 JavaScript SDK 中会落入通用 `APIError`。

### 错误 body 没有固定 schema

官方 JavaScript SDK 的公共类型为：

```ts
class APIError extends TypeSafeError {
  readonly status: number;
  readonly headers: Headers;
  readonly body: unknown;
  readonly requestId: string | undefined;
}
```

官方 SDK 的 message 提取实现兼容：

- 纯文本 body；
- `{ "error": "..." }`；
- `{ "error": { "message": "..." } }`；
- `{ "message": "..." }`；
- `{ "detail": "..." }`；
- `{ "detail": { "message": "..." } }`；
- `detail` 为校验错误数组，每项可能包含 `loc` 与 `msg`。

但这只是**官方客户端的兼容解析策略**，不是服务端错误 schema 保证；其公共 `body` 类型仍是 `unknown`。[官方 `APIError` 文档](https://docs.typesafe.ai/sdk/javascript/api/classes/APIError) · [官方 SDK `extractMessage` 源码](https://github.com/typesafe-ai/typesafe-sdk-js/blob/66880ccded6cb642dc1809620c2b108c33730214/src/errors.ts#L10-L34)

因此建议本项目：完整保留 status、headers、原始 body（需限制长度并脱敏），再按上述多形状做“尽力提取”；解析失败时退回安全的本地文案，不能因错误提示 schema 变化再次抛错。

### 认证失败的当前实测

2026-09-21 使用无效 Bearer token 请求第一方 endpoint，返回：

```http
HTTP/2 401
content-type: application/json
x-typesafe-request-id: req_...
```

```json
{
  "detail": {
    "error_type": "authentication_error",
    "message": "Cannot authenticate with the server. Please check your API key and try again."
  }
}
```

这与官方 SDK 对 `detail.message` 的兼容逻辑一致，但属于某一时点的第一方 API 观测，**不是官方文档承诺的固定结构**。前端可展示中文概括“Jev 认证失败，请检查 API Key”，request ID 可用于排查；不应直接向用户回显 key、Authorization header 或未审查的完整 body。

## 限流、超时与重试

官方 JavaScript SDK 默认值如下：

| 配置 | 默认值 |
| --- | --- |
| 单次尝试 timeout | `10_000 ms` |
| 初次请求后的最大重试数 | `2` |
| 首次 backoff | `500 ms` |
| 最大 backoff | `5_000 ms` |
| jitter | 最多向下随机浮动 `25%` |
| 默认重试状态 | `408`、`429`、`500–599` |
| 默认重试网络/超时错误 | 是 |
| 尊重服务端 retry header | 是 |
| 接受的最大服务端 retry delay | `60_000 ms`，更长则退回本地 backoff |

来源：[官方 RetryPolicy API](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy) · [官方 SDK 默认值源码](https://github.com/typesafe-ai/typesafe-sdk-js/blob/66880ccded6cb642dc1809620c2b108c33730214/src/retry.ts#L5-L25)

限流异常为 HTTP `429`。官方 SDK 暴露 `retryAfterMs`，从 `retry-after-ms` 或标准 `Retry-After` 解析；字段可能缺失或无效，客户端必须有本地 backoff。[官方 `RateLimitError`](https://docs.typesafe.ai/sdk/javascript/api/classes/RateLimitError) · [官方 header 解析源码](https://github.com/typesafe-ai/typesafe-sdk-js/blob/66880ccded6cb642dc1809620c2b108c33730214/src/retry.ts#L33-L49)

官方 SDK 的 timeout 是“**每次尝试**”而不是整个重试链路总预算。因此默认最坏耗时可能明显超过 10 秒。本项目若直接用 Java `RestClient`，应同时设置：连接超时、单次读取/响应超时、总调用预算，并让上层取消信号能够终止重试等待。

## 可观测字段与承诺边界

| 信息 | 位置 | 官方承诺强度 | 本项目建议 |
| --- | --- | --- | --- |
| `model` | 成功 body | HTTP Reference 标 required | 记录实际版本，便于回归 |
| `answers` | 成功 body | HTTP Reference 标 required | 严格校验所请求的 question id 和 answer type |
| `usage.input_tokens` / `output_tokens` | 成功 body | HTTP Reference 标 required | 作为供应商 usage 保存；失败时允许缺失 |
| `x-typesafe-request-id` | response header | 官方 SDK支持，但 JS 类型允许缺失 | 成功与失败都尽力记录；对用户可显示短格式或完整 ID |
| HTTP status | response | 标准 HTTP + 官方 SDK分类 | 作为稳定错误分类的首要依据 |
| `Retry-After` / `retry-after-ms` | response header | 官方 SDK明确解析，但允许缺失/无效 | 仅在合法范围内采用，否则本地指数退避 |
| 错误 body | response body | `unknown` / JSON / text / empty | 仅尽力解析，原文限制长度并脱敏 |
| `error_type` | 当前 401 body 内 | 仅实测，未在 HTTP Reference 承诺 | 可记日志但不可作为唯一分支条件 |

成功路径若使用官方 JavaScript SDK，可以通过 `WithResponse<T>` 同时取得解析后的 data、原始 `Response` 和可选 request ID。[官方 `WithResponse`](https://docs.typesafe.ai/sdk/javascript/api/interfaces/WithResponse)

## 对 ButvanAgent 的落地建议

1. 在 Jev adapter 建立单一的 `JevCallException`（或等价领域错误），字段至少包含：`category`、`httpStatus`、`requestId`、`retryAfterMs`、`safeMessage`、`rawBodySummary`、`cause`；网络失败与 HTTP 错误不得混为一类。
2. HTTP 非 2xx 时先读取 body，再按 `error`、`message`、`detail`、`detail.message`、校验错误数组顺序尽力提取。原始 body 只写 debug/结构化诊断，限制长度并移除 token、Authorization、API Key 等敏感内容。
3. 分类策略以 status/异常类型为准：`401/403` 提示检查凭据或权限；`400/422` 提示请求或配置不兼容；`429` 提示限流并携带预计重试时间；`5xx`、连接失败、超时提示 Jev 暂不可用。
4. 重试策略对齐官方 SDK：只自动重试 `408/429/5xx`、连接失败和超时；最多 2 次，指数退避加 jitter，并尊重合法的 retry header。`400/401/403/404/422` 不自动重试。
5. 路由场景中的 Jev 失败应保留现有本地 fallback，但返回一个可观测的降级结果：内部日志记录 status + request ID + category；面向用户展示简洁中文 Message，例如“Jev 暂不可用，已使用本地工具路由（请求 ID：…）”。不要把供应商原始错误无筛选地展示到 UI。
6. 测试至少覆盖：JSON 各类 message 形状、纯文本、空 body、超长/恶意 body、401、422、429 + 两类 retry header、5xx 重试、连接失败、超时、request ID 缺失、重试后成功、重试耗尽及 fallback 仍可用。

## 尚未获得官方承诺的事项

- 服务端错误 body 的固定 JSON Schema，以及 `error_type` 的完整枚举；
- 每一种错误情形的精确 status/body 对照表；
- 所有响应都一定包含 `x-typesafe-request-id`；
- 失败请求是否计费、是否返回 usage，以及重试是否分别计费；
- 服务端限流额度、窗口算法和固定 rate-limit header；
- 服务端端到端 SLA、最大处理时间和官方总重试预算；
- POST 重试的幂等键支持。官方 SDK会直接重试 System One POST，但文档未提供 idempotency key 契约。

这些不确定项应通过 TypeSafe 官方支持渠道确认，或在接入测试中作为可变行为处理，不能固化为产品承诺。
