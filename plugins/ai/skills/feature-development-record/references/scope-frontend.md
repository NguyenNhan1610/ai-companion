<!-- FDR scope fragment: loaded when --scope includes frontend or fullstack.
     Insert these sections between "Canonical Test Fixtures" and "Edge Cases" in the FDR output.
     Skip entirely for backend, api, data scopes. -->

### Wireframes

<!-- ASCII wireframes for each key screen/view/component the feature introduces or modifies.
     Each wireframe anchors the UI Component Props table and test selectors below it. -->

#### {Screen/View Name} — {state: default | empty | error | loading}

```
┌─────────────────────────────────────────┐
│  {Header / Nav}                         │
├─────────────────────────────────────────┤
│                                         │
│  {Layout description using box-drawing} │
│                                         │
│  ┌──────────┐  ┌──────────────────────┐ │
│  │ {Panel}  │  │ {Main content}       │ │
│  │          │  │                      │ │
│  └──────────┘  │  [Button Label]      │ │
│                │  < Input Field >     │ │
│                └──────────────────────┘ │
│                                         │
├─────────────────────────────────────────┤
│  {Footer / Status}                      │
└─────────────────────────────────────────┘
```

**Key elements:**

| Element | Selector | Behavior | Maps to |
|---------|----------|----------|---------|
| `{Button Label}` | `data-testid="{id}"` | {click → action} | FAC-{N} |
| `{Input Field}` | `role="textbox"` | {type → validate → submit} | FAC-{N} |

<!-- Repeat for each screen state (default, empty, error, loading) and each key view. -->

### UI Component Props & Test Selectors

<!-- FDR-REQ-5: Props interface + testable interaction sequences.
     Derives from wireframes above. -->

| Component | Props Interface | Test Selector | Interaction Sequence |
|-----------|---------------|---------------|---------------------|
| `{ComponentName}` | `{props type definition}` | `data-testid="{id}"` or `role="{role}"` | {click → type → submit → verify} |
