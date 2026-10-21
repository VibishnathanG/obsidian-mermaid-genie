# Mermaid Syntax Rendering Test Gallery

Comprehensive test file containing sample code blocks for all Mermaid, Pele, and extended diagram syntaxes. Use this file inside Obsidian to verify styling, typography, arrow alignment, badge positioning, and responsive rendering.

## Master-Plan

| Diagram Type | Keyword / Syntax | Anchor Link | Reference Note |
| :--- | :--- | :--- | :--- |
| Flowchart | `flowchart` / `graph` | [D01](#D01-Flowchart) | |
| Swimlanes Diagram | `swimlane-beta` / `subgraph` | [D02](#D02-Swimlanes-Diagram) | |
| Sequence Diagram | `sequenceDiagram` | [D03](#D03-Sequence-Diagram) | |
| Class Diagram | `classDiagram` | [D04](#D04-Class-Diagram) | |
| State Diagram | `stateDiagram-v2` | [D05](#D05-State-Diagram) | |
| Entity Relationship Diagram | `erDiagram` | [D06](#D06-Entity-Relationship-Diagram) | |
| User Journey | `journey` | [D07](#D07-User-Journey) | |
| Gantt Chart | `gantt` | [D08](#D08-Gantt-Chart) | |
| Pie Chart | `pie` | [D09](#D09-Pie-Chart) | |
| Quadrant Chart | `quadrantChart` | [D10](#D10-Quadrant-Chart) | |
| Requirement Diagram | `requirementDiagram` | [D11](#D11-Requirement-Diagram) | |
| Use Case Diagram | `usecase-beta` | [D12](#D12-Use-Case-Diagram) | |
| GitGraph (Git) Diagram | `gitGraph` | [D13](#D13-GitGraph-Diagram) | |
| C4 Diagram | `C4Context` / `C4Container` | [D14](#D14-C4-Architecture-Diagram) | |
| Mindmaps | `mindmap` | [D15](#D15-Mindmap) | |
| Timeline | `timeline` | [D16](#D16-Timeline) | |
| ZenUML | `zenuml` | [D17](#D17-ZenUML-Sequence) | |
| Sankey Diagram | `sankey-beta` | [D18](#D18-Sankey-Diagram) | |
| XY Chart | `xychart-beta` | [D19](#D19-XY-Chart) | |
| Block Diagram | `block-beta` | [D20](#D20-Block-Diagram) | |
| Packet Diagram | `packet-beta` | [D21](#D21-Packet-Diagram) | |
| Kanban | `kanban` | [D22](#D22-Kanban) | |
| Architecture Diagram | `architecture-beta` | [D23](#D23-Architecture-Diagram) | |
| Radar Chart | `radar-beta` | [D24](#D24-Radar-Chart) | |
| Event Modeling | `eventmodeling` | [D25](#D25-Event-Modeling) | |
| Treemap | `treemap-beta` | [D26](#D26-Treemap) | |
| Venn Diagram | `venn-beta` | [D27](#D27-Venn-Diagram) | |
| Ishikawa (Fishbone) Diagram | `ishikawa-beta` | [D28](#D28-Ishikawa-Fishbone-Diagram) | |
| Wardley Map | `wardley-beta` | [D29](#D29-Wardley-Map) | |
| Cynefin Framework | `cynefin-beta` | [D30](#D30-Cynefin-Framework) | |
| TreeView | `treeView-beta` | [D31](#D31-TreeView) | |
| Railroad Diagram | `railroad-beta` | [D32](#D32-Railroad-Diagram) | |
| AgentFlow | `agentflow-beta` | [D33](#D33-AgentFlow) | |

---

### D01-Flowchart

```mermaid
flowchart TD
    Start([Start Process]) --> Check{"Binding Constraint?"}
    Check -->|Balanced, general| M["M Family: General"]
    Check -->|CPU-bound| C["C Family: Compute"]
    Check -->|Memory-bound| R["R Family: Memory"]
    Check -->|Storage IOPS| I["I Family: Storage"]
    Check -->|GPU accelerated| P["P Family: Accelerated"]
    Check -->|Low and spiky| T["T Family: Burstable"]
    M --> Final{"ARM Architecture?"}
    C --> Final
    R --> Final
    Final -->|Yes| Graviton["AWS Graviton instance"]
    Final -->|No| x86["Standard x86 instance"]
```

[↑ Back to plan](#Master-Plan)

---

### D02-Swimlanes-Diagram

```mermaid
flowchart LR
    subgraph Client["👤 Client Layer"]
        Req["Submit Order"]
        Wait["Wait for Confirmation"]
    end
    subgraph Gateway["🛡️ API Gateway"]
        Auth["Authenticate Token"]
        Route["Route Service"]
    end
    subgraph Services["⚙️ Backend Microservices"]
        Inventory["Verify Stock"]
        Payment["Charge Card"]
    end
    subgraph Storage["🗄️ Database"]
        DB[(Orders DB)]
    end

    Req --> Auth
    Auth --> Route
    Route --> Inventory
    Inventory --> Payment
    Payment --> DB
    DB --> Wait
```

[↑ Back to plan](#Master-Plan)

---

### D03-Sequence-Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 Client
    participant API as 🛡️ API Gateway
    participant Auth as 🔑 Auth Service
    participant DB as 🗄️ Database

    User->>API: POST /api/v1/login
    activate API
    API->>Auth: Validate Credentials
    activate Auth
    Auth->>DB: Query User Record
    activate DB
    DB-->>Auth: User Record & Hash
    deactivate DB
    Auth-->>API: JWT Access Token
    deactivate Auth
    API-->>User: 200 OK (Bearer Token)
    deactivate API
```

[↑ Back to plan](#Master-Plan)

---

### D04-Class-Diagram

```mermaid
classDiagram
    class Vehicle {
        +String make
        +String model
        +int year
        +startEngine() void
        +stopEngine() void
    }
    class ElectricCar {
        +int batteryCapacityKwh
        +chargeBattery(int kwh) void
    }
    class FuelCar {
        +int tankCapacityLiters
        +refuel(int liters) void
    }
    Vehicle <|-- ElectricCar : Extends
    Vehicle <|-- FuelCar : Extends
```

[↑ Back to plan](#Master-Plan)

---

### D05-State-Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing : Submit Task
    state Processing {
        [*] --> Validating
        Validating --> Executing : Valid
        Executing --> Done : Success
        Executing --> Error : Exception
    }
    Processing --> Idle : Reset
    Processing --> Terminated : Fatal Failure
    Terminated --> [*]
```

[↑ Back to plan](#Master-Plan)

---

### D06-Entity-Relationship-Diagram

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : ordered_in

    CUSTOMER {
        string customer_id PK
        string full_name
        string email
    }
    ORDER {
        string order_id PK
        string customer_id FK
        date order_date
        float total_amount
    }
    ORDER_ITEM {
        string item_id PK
        string order_id FK
        string product_id FK
        int quantity
        float unit_price
    }
    PRODUCT {
        string product_id PK
        string sku
        string name
        float price
    }
```

[↑ Back to plan](#Master-Plan)

---

### D07-User-Journey

```mermaid
journey
    title E-Commerce User Shopping Journey
    section Discovery
      Browse landing page: 5: Customer
      Search product category: 4: Customer
      Compare price and specs: 3: Customer
    section Purchase
      Add to shopping cart: 4: Customer
      Enter shipping address: 3: Customer
      Complete credit payment: 5: Customer, Gateway
    section Post-Purchase
      Receive order confirmation: 5: Customer
      Track parcel delivery: 4: Customer, Logistics
```

[↑ Back to plan](#Master-Plan)

---

### D08-Gantt-Chart

```mermaid
gantt
    title Obsidian Plugin Development Sprint
    dateFormat  YYYY-MM-DD
    section Architecture
    Design Token System       :done,    des1, 2026-03-01, 2026-03-05
    Color Contrast Engine     :done,    des2, 2026-03-06, 2026-03-10
    section Implementation
    Orthogonal Connector Flow :active,  imp1, 2026-03-11, 2026-03-18
    Label Disjoint Intervals  :         imp2, 2026-03-19, 2026-03-24
    section QA & Release
    Integration Testing       :         qa1,  2026-03-25, 2026-03-28
    Public Community Release  :milestone, rel,  2026-03-29, 0d
```

[↑ Back to plan](#Master-Plan)

---

### D09-Pie-Chart

```mermaid
pie title Cloud Infrastructure Budget Allocation
    "Compute (EC2 / EKS)" : 42
    "Object & Block Storage" : 24
    "Relational Databases" : 18
    "Network & Egress" : 10
    "Observability & Logs" : 6
```

[↑ Back to plan](#Master-Plan)

---

### D10-Quadrant-Chart

```mermaid
quadrantChart
    title Feature Priority Assessment
    x-axis Low Effort --> High Effort
    y-axis Low Impact --> High Impact
    quadrant-1 Strategic Bets
    quadrant-2 Quick Wins
    quadrant-3 Deprioritize
    quadrant-4 Resource Drains
    "Orthogonal Routing": [0.35, 0.88]
    "Theme Variables Sync": [0.22, 0.76]
    "Auto Spacing Algorithm": [0.42, 0.82]
    "Legacy Browser Polyfills": [0.82, 0.18]
    "Custom WebGL Renderer": [0.89, 0.45]
```

[↑ Back to plan](#Master-Plan)

---

### D11-Requirement-Diagram

```mermaid
requirementDiagram
    requirement Req_Performance {
        id: 101
        text: Render diagrams under 100ms
        risk: medium
        verifymethod: benchmark
    }
    requirement Req_Accessibility {
        id: 102
        text: Maintain WCAG AA 4.5 contrast
        risk: low
        verifymethod: automated_test
    }
    element Engine {
        type: software_module
    }
    Engine - satisfies -> Req_Performance
    Engine - satisfies -> Req_Accessibility
```

[↑ Back to plan](#Master-Plan)

---

### D12-Use-Case-Diagram

```mermaid
usecase-beta
    direction LR
    actor Author("Editor")
    actor Reader("Visitor")
    systemBoundary "Obsidian Knowledge Base"
        NoteCreation("Create & Link Notes")
        MermaidRender("Render Interactive Flowcharts")
        ExportGraph("Export SVG / PNG")
    end
    Author --> NoteCreation
    Author --> MermaidRender
    Author --> ExportGraph
    Reader --> MermaidRender
```

[↑ Back to plan](#Master-Plan)

---

### D13-GitGraph-Diagram

```mermaid
gitGraph
    commit id: "Initial repo skeleton"
    commit id: "Add color engine"
    branch feature/orthogonal-router
    checkout feature/orthogonal-router
    commit id: "Implement step curves"
    commit id: "Add rounded bezier corners"
    checkout main
    merge feature/orthogonal-router id: "Merge orthogonal routing"
    branch feature/adaptive-spacing
    checkout feature/adaptive-spacing
    commit id: "Add dynamic link expansion"
    checkout main
    merge feature/adaptive-spacing id: "Release v1.1.0"
    commit id: "Tag production build"
```

[↑ Back to plan](#Master-Plan)

---

### D14-C4-Architecture-Diagram

```mermaid
C4Context
    title Cloud Document Processing Architecture
    Person(user, "Knowledge Worker", "Creates notes and workflow diagrams")
    System(obsidian, "Obsidian Client", "Desktop application running Mermaid Genie")
    System_Ext(vault, "Local File Vault", "Stores markdown notes and attachments")
    System_Ext(cloud, "Cloud Sync Service", "Synchronizes vaults across devices")

    Rel(user, obsidian, "Edits notes and inspects diagrams")
    Rel(obsidian, vault, "Reads and writes notes locally")
    Rel(obsidian, cloud, "Syncs encrypted note snapshots")
```

[↑ Back to plan](#Master-Plan)

---

### D15-Mindmap

```mermaid
mindmap
  root((Obsidian Mermaid Genie))
    Visual Aesthetics
      Coordinated Color Palettes
      WCAG AA Contrast Ratios
      Pill-shaped Edge Badges
    Geometry & Routing
      Orthogonal Step Connectors
      Rounded Corner Fillets
      Disjoint Branch Intervals
    Compatibility
      22 Core Diagram Types
      Dark & Light Theme Adaptability
      Obsidian Native Canvas & Live Preview
```

[↑ Back to plan](#Master-Plan)

---

### D16-Timeline

```mermaid
timeline
    title Evolution of Mermaid Integration
    2022 : Standard Mermaid Dagre
         : Default bundled styling
    2024 : Mermaid Flow Enhancer
         : Ancestor path trace highlights
    2025 : Pele & Auto-Beautiful Integration
         : Expanded diagram schemas
    2026 : Mermaid Genie
         : Adaptive link spacing
         : Orthogonal bent routing
         : Universal 22+ diagram engine
```

[↑ Back to plan](#Master-Plan)

---

### D17-ZenUML-Sequence

```mermaid
zenuml
    title Vault Checkout Process
    @Actor User
    @Boundary AppUI
    @Control Router
    @Entity VaultStore

    User->AppUI.openNote(noteId) {
        AppUI->Router.dispatchRoute() {
            Router->VaultStore.fetchMarkdown(noteId) {
                return markdownContent
            }
            return renderedDocument
        }
        return displayView
    }
```

[↑ Back to plan](#Master-Plan)

---

### D18-Sankey-Diagram

```mermaid
sankey-beta
    Electricity,Data Center Infrastructure,100
    Renewable Solar,Electricity,45
    Wind Turbines,Electricity,35
    Hydroelectric,Electricity,20
    Data Center Infrastructure,Server Compute Nodes,58
    Data Center Infrastructure,Cooling Systems,28
    Data Center Infrastructure,Network Switches,14
```

[↑ Back to plan](#Master-Plan)

---

### D19-XY-Chart

```mermaid
xychart-beta
    title "Throughput vs Render Latency"
    x-axis ["Batch 1", "Batch 2", "Batch 3", "Batch 4", "Batch 5"]
    y-axis "Time in Milliseconds" 0 --> 120
    bar [35, 48, 62, 54, 38]
    line [28, 36, 49, 44, 30]
```

[↑ Back to plan](#Master-Plan)

---

### D20-Block-Diagram

```mermaid
block-beta
    columns 4
    In(("Input Stream")):1
    Parser["Lexer & Parser"]:1
    Optimizer["Layout Engine"]:1
    Out(("Rendered SVG")):1

    In --> Parser
    Parser --> Optimizer
    Optimizer --> Out
```

[↑ Back to plan](#Master-Plan)

---

### D21-Packet-Diagram

```mermaid
packet-beta
    0-7: "Packet Type (OpCode)"
    8-15: "Flags & Security"
    16-31: "Payload Sequence Length"
    32-63: "Originating Node Address"
    64-95: "Destination Node Address"
    96-127: "CRC32 Checksum Verification"
```

[↑ Back to plan](#Master-Plan)

---

### D22-Kanban

```mermaid
kanban
    backlog[📋 Ready for Planning]
      task1[Explore WebGL GPU acceleration]
      task2[Interactive node drag handles]
    wip[⚡ Actively in Progress]
      task3[Disjoint interval branch spacing]
      task4[Empty edge badge removal]
    review[🔍 Quality Review]
      task5[Universal schema test coverage]
    done[✅ Shipped to Production]
      task6[Orthogonal rounded step connectors]
      task7[WCAG AA Contrast verification]
```

[↑ Back to plan](#Master-Plan)

---

### D23-Architecture-Diagram

```mermaid
architecture-beta
    group cloud(cloud)[AWS Infrastructure]
    service alb(internet)[Application Load Balancer] in cloud
    service api(server)[API Cluster] in cloud
    service redis(database)[Redis Cache] in cloud
    service rds(database)[Aurora PostgreSQL] in cloud

    alb:R -- L:api
    api:B -- T:redis
    api:R -- L:rds
```

[↑ Back to plan](#Master-Plan)

---

### D24-Radar-Chart

```mermaid
radar-beta
    axis speed["Rendering Speed"], memory["Low Memory"], layout["Layout Precision"], breadth["Diagram Coverage"], a11y["Accessibility"]
    curve target["Target Spec"]{90, 85, 95, 95, 90}
    curve actual["Current Genie"]{92, 88, 96, 98, 94}
    max 100
```

[↑ Back to plan](#Master-Plan)

---

### D25-Event-Modeling

```mermaid
eventmodeling
    tf 01 ui OrderCheckoutScreen
    tf 02 cmd PlaceOrderCommand
    tf 03 evt OrderPlacedEvent
    tf 04 read OrderReadModel
```

[↑ Back to plan](#Master-Plan)

---

### D26-Treemap

```mermaid
treemap-beta
    "Repository Codebase"
      "Layout & Routing": 42
      "Palettes & Theming": 24
      "DOM & Event Controllers": 18
    "Test Suites"
      "Alignment Verification": 25
      "Color Utilities": 15
```

[↑ Back to plan](#Master-Plan)

---

### D27-Venn-Diagram

```mermaid
venn-beta
    set MarkdownAuthors["Markdown Authors"]
    set SoftwareEngineers["Software Engineers"]
    union MarkdownAuthors,SoftwareEngineers["Obsidian Power Users"]
```

[↑ Back to plan](#Master-Plan)

---

### D28-Ishikawa-Fishbone-Diagram

```mermaid
ishikawa-beta
    Visual Clipping on Nodes
    Typography
      Unconstrained text width
      Missing flex centering
    Layout Engine
      Small default nodeSpacing
      Shared midpoint connector crowding
    CSS Overrides
      ForeignObject overflow hidden
      Nested borders on subroutine shapes
```

[↑ Back to plan](#Master-Plan)

---

### D29-Wardley-Map

```mermaid
wardley-beta
    title Knowledge Graph System
    anchor User [0.95, 0.65]
    component EditorUI [0.82, 0.60]
    component GraphRenderer [0.65, 0.50]
    component MarkdownParser [0.45, 0.70]
    component FileSystem [0.20, 0.85]

    User -> EditorUI
    EditorUI -> GraphRenderer
    EditorUI -> MarkdownParser
    MarkdownParser -> FileSystem
```

[↑ Back to plan](#Master-Plan)

---

### D30-Cynefin-Framework

```mermaid
cynefin-beta
    title Engineering Problem Domains
    complex
      "Dynamic adaptive graph layout with arbitrary branching"
    complicated
      "WCAG 2.1 relative luminance color contrast calculation"
    clear
      "Mapping theme hex tokens to CSS variables"
    chaotic
      "Uncaught recursive parsing crashes in production"
```

[↑ Back to plan](#Master-Plan)

---

### D31-TreeView

```mermaid
treeView-beta
├── .obsidian/
│   ├── plugins/
│   │   └── obsidian-mermaid-genie/
│   │       ├── main.js
│   │       ├── manifest.json
│   │       └── styles.css
├── notes/
│   ├── Architecture.md
│   └── Sprints.md
└── README.md
```

[↑ Back to plan](#Master-Plan)

---

### D32-Railroad-Diagram

```mermaid
railroad-beta
    diagram = sequence(terminal("flowchart"), nonterminal("direction"), nonterminal("nodes"));
```

[↑ Back to plan](#Master-Plan)

---

### D33-AgentFlow

```mermaid
agentflow-beta TB
    flow GenieAgent["Mermaid Genie Processing Pipeline"]
      raw["Source Markdown"]@{ shape: input }
      pre["Wrap Decisions & Calc Spacing"]@{ shape: tool }
      render["Native Mermaid / Pele Render"]@{ shape: tool }
      enhance["Orthogonal Routing & Badges"]@{ shape: tool }
      out["Enhanced SVG Output"]@{ shape: output }

      raw --> pre
      pre --> render
      render --> enhance
      enhance --> out
    end
```

[↑ Back to plan](#Master-Plan)
