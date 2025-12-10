# NagaAgent 记忆模块分析与应用报告

## 1. NagaAgent 记忆模块架构分析

根据对 NagaAgent 项目的分析（基于开源信息和架构设计模式），其记忆系统（Memory System）采用了 **GraphRAG（图检索增强生成）** 架构，并结合了向量检索技术。以下是其核心算法和设计亮点：

### 1.1 核心架构
NagaAgent 的记忆系统并非单一的数据库存储，而是一个复合系统，主要包含以下组件：

1.  **短期记忆（Working Memory）**：基于内存或 Redis 的对话历史窗口，用于保持当前会话的上下文连贯性。
2.  **长期记忆（Long-term Memory）**：
    *   **知识图谱（Knowledge Graph）**：使用 Neo4j 存储实体（Entities）及其关系（Relations）。解决"结构化信息"的存储，如人物关系、项目依赖等。
    *   **向量记忆（Vector Memory）**：使用向量数据库（如 Faiss 或 Neo4j Vector Index）存储文本块的语义向量。解决"非结构化信息"的模糊检索。
3.  **记忆处理管道（Memory Pipeline）**：
    *   **抽取（Extraction）**：利用 LLM 从对话中抽取实体、关系和关键事件。
    *   **融合（Fusion）**：将新抽取的信息合并到现有图谱中（去重、更新属性）。
    *   **检索（Retrieval）**：混合检索策略（Hybrid Search），结合关键词匹配、向量相似度和图遍历。

### 1.2 关键算法逻辑

1.  **实体抽取与链接 (Entity Extraction & Linking)**：
    *   使用专门的 Prompt 让 LLM 输出 JSON 格式的实体和关系。
    *   **实体消歧**：通过检索图谱中已有的相似实体，判断是新建节点还是更新现有节点。

2.  **混合检索策略 (Hybrid Retrieval)**：
    *   **第一步：语义召回**。将用户 Query 转化为向量，在向量索引中检索 Top-K 个最相似的实体节点。
    *   **第二步：图扩展 (Graph Expansion)**。以召回的实体为起点，沿关系边向外扩展 1-2 跳（Hops），获取关联的上下文（如"用户的项目" -> "使用的技术"）。
    *   **第三步：上下文重排**。对获取的图路径信息进行去重和相关性打分，构建最终的 Prompt Context。

3.  **动态记忆更新**：
    *   对话结束后异步触发记忆写入，不阻塞用户响应。
    *   支持"遗忘"机制（虽然 NagaAgent 文档未详细描述，但通常通过时间衰减或相关性权重实现）。

---

## 2. Epsilon 项目现状与差距

### 2.1 现状
目前 Epsilon 的 Phase 3 实现已具备以下功能：
*   ✅ **Neo4j 集成**：成功连接 Neo4j Aura。
*   ✅ **基础 GraphRAG**：实现了基于 **关键词匹配** 的图检索。
*   ✅ **实体抽取**：使用 LLM 抽取实体和关系并写入图谱。
*   ✅ **可视化**：实现了前端知识图谱交互。

### 2.2 差距（Gap Analysis）
相比于 NagaAgent 的成熟设计，Epsilon 目前缺少 **语义理解能力**：
*   **缺失向量检索**：目前依赖关键词（Keywords）匹配。如果用户说"写代码的那个工具"而图谱中存的是"IDE"或"VSCode"，关键词匹配可能失效，但向量检索能识别出它们在语义上是接近的。
*   **检索路径单一**：目前的 Cypher 查询主要关注特定类型的关系，缺乏灵活的子图挖掘。

---

## 3. 应用方案：升级 Epsilon 记忆算法

我们将引入 **向量检索（Vector Search）** 来升级现有的 Memory Service，使其达到 NagaAgent 的水平。

### 3.1 技术选型
*   **Embedding 模型**：复用 `langchain-openai` 的 `OpenAIEmbeddings`（轻量、无需额外部署本地模型）。
*   **向量存储**：直接使用 **Neo4j Vector Index**。Neo4j 5.x 原生支持向量索引，无需引入 Faiss，保持架构简洁。

### 3.2 实施步骤

1.  **升级 LLMService**：添加 `get_embedding` 接口。
2.  **升级 MemoryService**：
    *   **初始化**：创建 Neo4j 向量索引（针对 `Entity` 节点的 `embedding` 属性）。
    *   **写入**：在写入实体时，计算 `name` + `description` 的向量并存入 Neo4j。
    *   **检索**：将目前的"关键词匹配"升级为"向量相似度搜索 + 图遍历"。

### 3.3 预期效果
*   用户提问更加自然，无需命中精确关键词。
*   记忆召回率（Recall）显著提升。
*   能关联到语义相关但字面不同的知识点。

