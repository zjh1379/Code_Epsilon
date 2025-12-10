# Neo4j Visualization Library (NVL) 安装说明

## 概述

知识图谱可视化组件已更新为使用Neo4j官方可视化库（NVL）的React包装器。

参考文档：https://neo4j.com/docs/nvl/current/react-wrappers/

## 安装步骤

### 1. 安装NVL依赖

在 `frontend` 目录下运行：

```bash
cd frontend
npm install @neo4j-nvl/react @neo4j-nvl/base
```

### 2. 验证安装

安装完成后，TypeScript类型错误应该会自动解决。

### 3. 启动开发服务器

```bash
npm run dev
```

## 主要变更

### 从 react-force-graph-2d 迁移到 NVL

**之前**：
- 使用 `react-force-graph-2d` 库
- 自定义Canvas渲染

**现在**：
- 使用 `@neo4j-nvl/react` 的 `InteractiveNvlWrapper`
- 官方支持的Neo4j可视化库
- 内置交互处理器（缩放、平移、拖拽）

### 数据格式转换

NVL使用以下数据格式：

**节点 (nodes)**:
```typescript
{
  id: string
  labels: string[]  // 节点类型标签
  properties: Record<string, any>  // 节点属性
  size?: number  // 节点大小
  color?: string  // 节点颜色
}
```

**关系 (rels)**:
```typescript
{
  id: string
  from: string  // 源节点ID（不是source）
  to: string    // 目标节点ID（不是target）
  type: string  // 关系类型
  properties?: Record<string, any>
}
```

代码已自动处理数据格式转换，无需手动修改。

## 功能特性

### InteractiveNvlWrapper 提供的功能

- ✅ 节点点击事件
- ✅ 节点悬停事件
- ✅ 关系点击事件
- ✅ 画布点击事件
- ✅ 缩放（鼠标滚轮）
- ✅ 平移（拖拽画布）
- ✅ 节点拖拽
- ✅ 自动布局

### 自定义配置

当前配置：
- `initialZoom: 1` - 初始缩放级别
- `minZoom: 0.1` - 最小缩放
- `maxZoom: 5` - 最大缩放

可以在 `GraphCanvas.tsx` 中的 `nvlOptions` 中修改。

## 注意事项

1. **包版本**：确保使用最新版本的 `@neo4j-nvl/react` 和 `@neo4j-nvl/base`
2. **类型定义**：安装包后，TypeScript类型会自动可用
3. **性能**：NVL针对Neo4j图数据进行了优化，性能更好
4. **兼容性**：NVL是Neo4j官方库，与Neo4j数据库集成更紧密

## 故障排除

如果遇到类型错误：
1. 确保已安装依赖：`npm install`
2. 重启TypeScript服务器（VS Code: Cmd/Ctrl + Shift + P -> "TypeScript: Restart TS Server"）
3. 清除node_modules并重新安装：`rm -rf node_modules package-lock.json && npm install`

## 参考资源

- NVL官方文档：https://neo4j.com/docs/nvl/current/react-wrappers/
- NVL GitHub：https://github.com/neo4j/neo4j-visualization-library
- Neo4j文档：https://neo4j.com/docs/

