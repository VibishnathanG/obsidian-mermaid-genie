import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptDiagramSource,
  transpileZenUML,
  transpileUseCase,
  transpileAgentFlow,
  transpileTreeView,
  transpileCynefin,
  transpileWardley,
  transpileRailroad,
} from '../src/transpiler';

test('ZenUML: transpiles nested method activations and reply messages', () => {
  const zenumlCode = `zenuml
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
  `;

  const transpiled = transpileZenUML(zenumlCode);
  assert.ok(transpiled.startsWith('sequenceDiagram'));
  assert.ok(transpiled.includes('autonumber'));
  assert.ok(transpiled.includes('actor User'));
  assert.ok(transpiled.includes('participant AppUI as «Boundary» AppUI'));
  assert.ok(transpiled.includes('participant Router as «Control» Router'));
  assert.ok(transpiled.includes('participant VaultStore as «Entity» VaultStore'));
  assert.ok(transpiled.includes('User->>+AppUI: openNote(noteId)'));
  assert.ok(transpiled.includes('AppUI->>+Router: dispatchRoute()'));
  assert.ok(transpiled.includes('Router->>+VaultStore: fetchMarkdown(noteId)'));
  assert.ok(transpiled.includes('VaultStore-->>-Router: markdownContent'));
  assert.ok(transpiled.includes('Router-->>-AppUI: renderedDocument'));
  assert.ok(transpiled.includes('AppUI-->>-User: displayView'));
});

test('ZenUML: transpiles async messages, loops, branches, and annotators', () => {
  const zenumlCode = `zenuml
    title Demo
    Alice->John: Hello John, how are you?
    while(is_connected) {
      John->Alice: Great!
    }
    if(ready) {
      Alice->John: Proceed
    } else {
      Alice->John: Wait
    }
  `;

  const transpiled = transpileZenUML(zenumlCode);
  assert.ok(transpiled.includes('Alice->>John: Hello John, how are you?'));
  assert.ok(transpiled.includes('loop is_connected'));
  assert.ok(transpiled.includes('alt ready'));
  assert.ok(transpiled.includes('else'));
  assert.ok(transpiled.includes('end'));
});

test('UseCase: transpiles actors, system boundaries, and stereotype links', () => {
  const useCaseCode = `usecase-beta
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
    Checkout ..> : include Browse
  `;

  const transpiled = transpileUseCase(useCaseCode);
  assert.ok(transpiled.includes('flowchart LR'));
  assert.ok(transpiled.includes('Author["👤 Editor"]'));
  assert.ok(transpiled.includes('Reader["👤 Visitor"]'));
  assert.ok(transpiled.includes('subgraph Obsidian_Knowledge_Base["Obsidian Knowledge Base"]'));
  assert.ok(transpiled.includes('NoteCreation(["Create & Link Notes"])'));
  assert.ok(transpiled.includes('Author --> NoteCreation'));
  assert.ok(transpiled.includes('Checkout -. "«include»" .-> Browse'));
});

test('AgentFlow: transpiles flow blocks and shape decorators to standard flowchart', () => {
  const agentFlowCode = `agentflow-beta TB
    flow GenieAgent["Mermaid Genie Processing Pipeline"]
      raw["Source Markdown"]@{ shape: input }
      pre["Wrap Decisions & Calc Spacing"]@{ shape: tool }
      out["Enhanced SVG Output"]@{ shape: output }

      raw --> pre
      pre --> out
    end
  `;

  const transpiled = transpileAgentFlow(agentFlowCode);
  assert.ok(transpiled.includes('flowchart TB'));
  assert.ok(transpiled.includes('subgraph GenieAgent["Mermaid Genie Processing Pipeline"]'));
  assert.ok(transpiled.includes('raw[/"📥 Source Markdown"/]'));
  assert.ok(transpiled.includes('pre["⚙️ Wrap Decisions & Calc Spacing"]'));
  assert.ok(transpiled.includes('out[\\"📤 Enhanced SVG Output"\\]'));
});

test('TreeView: transpiles indented tree hierarchies to flowchart LR', () => {
  const treeCode = `treeView-beta
├── .obsidian/
│   ├── plugins/
│   │   └── obsidian-mermaid-genie/
│   │       ├── main.js
│   │       └── styles.css
└── README.md
  `;

  const transpiled = transpileTreeView(treeCode);
  assert.ok(transpiled.includes('flowchart LR'));
  assert.ok(transpiled.includes('.obsidian/'));
  assert.ok(transpiled.includes('plugins/'));
  assert.ok(transpiled.includes('-->'));
});

test('adaptDiagramSource: detects and transforms unsupported diagram keywords', () => {
  const zRes = adaptDiagramSource('zenuml\nAlice->Bob: Hi');
  assert.equal(zRes.transpiled, true);
  assert.equal(zRes.type, 'zenuml');

  const uRes = adaptDiagramSource('usecase-beta\nactor User');
  assert.equal(uRes.transpiled, true);
  assert.equal(uRes.type, 'usecase');

  const cyRes = adaptDiagramSource('cynefin-beta\ncomplex\n"Dynamic branching"');
  assert.equal(cyRes.transpiled, true);
  assert.equal(cyRes.type, 'cynefin');

  const wRes = adaptDiagramSource('wardley-beta\nanchor User [0.95, 0.65]');
  assert.equal(wRes.transpiled, true);
  assert.equal(wRes.type, 'wardley');

  const rRes = adaptDiagramSource('railroad-beta\ndiagram = sequence(terminal("flowchart"));');
  assert.equal(rRes.transpiled, true);
  assert.equal(rRes.type, 'railroad');

  const nativeRes = adaptDiagramSource('flowchart TD\nA --> B');
  assert.equal(nativeRes.transpiled, false);
  assert.equal(nativeRes.type, 'native');
});

test('Cynefin: transpiles problem domains into 2x2 quadrant flowchart', () => {
  const cynefinCode = `cynefin-beta
    title Engineering Problem Domains
    complex
      "Dynamic adaptive graph layout with arbitrary branching"
    complicated
      "WCAG 2.1 relative luminance color contrast calculation"
    clear
      "Mapping theme hex tokens to CSS variables"
    chaotic
      "Uncaught recursive parsing crashes in production"
  `;

  const transpiled = transpileCynefin(cynefinCode);
  assert.ok(transpiled.includes('flowchart TD'));
  assert.ok(transpiled.includes('subgraph Cynefin ["Cynefin Framework: Engineering Problem Domains"]'));
  assert.ok(transpiled.includes('subgraph Complex ["🌀 Complex<br/><i>Probe · Sense · Respond</i>"]'));
  assert.ok(transpiled.includes('subgraph Complicated ["🔍 Complicated<br/><i>Sense · Analyze · Respond</i>"]'));
  assert.ok(transpiled.includes('subgraph Chaotic ["⚡ Chaotic<br/><i>Act · Sense · Respond</i>"]'));
  assert.ok(transpiled.includes('subgraph Clear ["✅ Clear<br/><i>Sense · Categorize · Respond</i>"]'));
  assert.ok(transpiled.includes('Dynamic adaptive graph layout with arbitrary branching'));
  assert.ok(transpiled.includes('WCAG 2.1 relative luminance color contrast calculation'));
  assert.ok(transpiled.includes('TopRow ~~~ BottomRow'));
});

test('Wardley: transpiles components, anchors, and evolution stages', () => {
  const wardleyCode = `wardley-beta
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
  `;

  const transpiled = transpileWardley(wardleyCode);
  assert.ok(transpiled.includes('flowchart TD'));
  assert.ok(transpiled.includes('subgraph Wardley ["Wardley Map: Knowledge Graph System"]'));
  assert.ok(transpiled.includes('User["👤 User<br/><i>Anchor (📦 Product)</i>"]'));
  assert.ok(transpiled.includes('EditorUI["EditorUI<br/><i>📦 Product [0.82, 0.60]</i>"]'));
  assert.ok(transpiled.includes('FileSystem["FileSystem<br/><i>⚡ Commodity [0.20, 0.85]</i>"]'));
  assert.ok(transpiled.includes('User --> EditorUI'));
  assert.ok(transpiled.includes('MarkdownParser --> FileSystem'));
});

test('Railroad: transpiles sequence, choice, and terminal/nonterminal expressions', () => {
  const railroadCode = `railroad-beta
    diagram = sequence(terminal("flowchart"), choice(nonterminal("direction"), terminal("TD")), nonterminal("nodes"));
  `;

  const transpiled = transpileRailroad(railroadCode);
  assert.ok(transpiled.includes('flowchart LR'));
  assert.ok(transpiled.includes('rr_start(( ))'));
  assert.ok(transpiled.includes('(["flowchart"])'));
  assert.ok(transpiled.includes('["direction"]'));
  assert.ok(transpiled.includes('(["TD"])'));
  assert.ok(transpiled.includes('["nodes"]'));
  assert.ok(transpiled.includes('rr_end(( ))'));
});
