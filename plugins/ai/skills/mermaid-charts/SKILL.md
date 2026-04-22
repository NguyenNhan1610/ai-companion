---
name: mermaid-charts
description: Validate Mermaid.js diagram syntax. Use when user asks to create diagrams, validate mermaid syntax, or check flowcharts, sequence diagrams, ER diagrams, class diagrams, state diagrams, gantt charts. Also trigger when user mentions mermaid, diagram, flowchart, or architecture visualization. Rendering to SVG/PNG is not supported — this skill only validates syntax.
user-invocable: true
---

# Mermaid.js Diagrams

Validate Mermaid.js diagram syntax. Image rendering has been removed; use another tool (online playground, IDE plugin) if you need to render a diagram to SVG/PNG.

## Command

```bash
/ai:mermaid validate graph TD; A-->B; B-->C
```

## Setup

If mmdc is not installed:
```bash
/ai:setup --install-mermaid
```

## Quick Syntax Reference

### Flowchart
```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
```

### Sequence Diagram
```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    Client->>API: POST /users
    API->>DB: INSERT user
    DB-->>API: OK
    API-->>Client: 201 Created
```

### Class Diagram
```mermaid
classDiagram
    class User {
        +String name
        +String email
        +login()
        +logout()
    }
    class Order {
        +Int id
        +Date created
        +calculate_total()
    }
    User "1" --> "*" Order
```

### ER Diagram
```mermaid
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "ordered in"
```

### State Diagram
```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Processing: submit
    Processing --> Completed: success
    Processing --> Failed: error
    Failed --> Pending: retry
    Completed --> [*]
```

### Gantt Chart
```mermaid
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Design    :a1, 2024-01-01, 30d
    Implement :a2, after a1, 45d
    section Phase 2
    Testing   :a3, after a2, 20d
    Deploy    :a4, after a3, 5d
```

## Tips

- Use `graph TD` for top-down, `graph LR` for left-right flow
- Wrap node text in `[]` for rectangles, `{}` for diamonds, `()` for rounded, `(())` for circles
- Use `-->` for solid arrows, `-.->` for dotted, `==>` for thick
- Add labels to arrows: `-->|label text|`
- Subgraphs: `subgraph title ... end`
