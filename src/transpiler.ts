/**
 * Transpiler and compatibility adapter for Mermaid Genie.
 * Provides resilient, zero-failure translation of modern/extended diagram syntaxes
 * (ZenUML, UseCase-beta, TreeView-beta, AgentFlow-beta) into standard, highly-compatible
 * Mermaid formats that render reliably across all Obsidian versions and platforms.
 */

export interface TranspileResult {
  code: string;
  transpiled: boolean;
  type: string;
}

/**
 * Normalizes and cleans input diagram string.
 */
function cleanLines(source: string): string[] {
  return source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

/**
 * Transpiles ZenUML syntax into Mermaid sequenceDiagram syntax.
 * Handles participant annotators, nested sync activations, async messages,
 * returns, loops, branches (alt), opt, par, and try/catch/finally blocks.
 */
export function transpileZenUML(source: string): string {
  const lines = cleanLines(source);
  const output: string[] = ['sequenceDiagram', '    autonumber'];
  const activationStack: { caller: string; callee: string; returned?: boolean }[] = [];
  const blockTypeStack: ('method' | 'loop' | 'alt' | 'opt' | 'par' | 'critical')[] = [];

  let defaultCaller = 'User';
  let hasDeclaredActors = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    // Skip the diagram keyword itself
    if (/^\s*zenuml\b/i.test(trimmed)) {
      continue;
    }

    // Title
    const titleMatch = trimmed.match(/^title\s+(.*)$/i);
    if (titleMatch) {
      output.push(`    title ${titleMatch[1].trim()}`);
      continue;
    }

    // Comments
    if (trimmed.startsWith('//')) {
      const commentText = trimmed.replace(/^\/\/\s*/, '');
      output.push(`    %% ${commentText}`);
      continue;
    }

    // Annotated participants: @Actor Alice, @Database Bob, @Boundary AppUI, @Control Router, @Entity Store
    const annotatorMatch = trimmed.match(/^@([A-Za-z]+)\s+([A-Za-z0-9_]+)(?:\s+as\s+(.*))?$/);
    if (annotatorMatch) {
      const type = annotatorMatch[1].toLowerCase();
      const id = annotatorMatch[2];
      const alias = annotatorMatch[3]?.trim();
      hasDeclaredActors = true;
      if (!defaultCaller || defaultCaller === 'User') {
        defaultCaller = id;
      }

      if (type === 'actor') {
        output.push(alias ? `    actor ${id} as ${alias}` : `    actor ${id}`);
      } else if (type === 'database') {
        output.push(alias ? `    participant ${id} as [(«Database» ${alias})]` : `    participant ${id} as [(«Database» ${id})]`);
      } else {
        const stereotype = `«${annotatorMatch[1]}»`;
        output.push(alias ? `    participant ${id} as ${stereotype} ${alias}` : `    participant ${id} as ${stereotype} ${id}`);
      }
      continue;
    }

    // Aliases: A as Alice
    const aliasMatch = trimmed.match(/^([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+.*)$/);
    if (aliasMatch && !trimmed.includes('->') && !trimmed.includes('.')) {
      output.push(`    participant ${aliasMatch[1]} as ${aliasMatch[2]}`);
      continue;
    }

    // Participant order declaration (bare name like Bob or Alice)
    if (/^[A-Za-z0-9_]+$/.test(trimmed) && !['try', 'catch', 'finally', 'par', 'opt', 'end'].includes(trimmed)) {
      output.push(`    participant ${trimmed}`);
      if (!hasDeclaredActors) {
        defaultCaller = trimmed;
        hasDeclaredActors = true;
      }
      continue;
    }

    // new Object creation
    const newMatch = trimmed.match(/^new\s+([A-Za-z0-9_]+)(?:\((.*)\))?$/);
    if (newMatch) {
      const createdObj = newMatch[1];
      const args = newMatch[2] ? ` (${newMatch[2]})` : '';
      const caller = activationStack.length > 0 ? activationStack[activationStack.length - 1].callee : defaultCaller;
      output.push(`    create participant ${createdObj}`);
      output.push(`    ${caller}->>+${createdObj}: «create»${args}`);
      continue;
    }

    // Loop constructs: while(cond) {, for(...) {, loop(...) {
    const loopMatch = trimmed.match(/^(?:while|for|forEach|foreach|loop)\s*\((.*)\)\s*\{?$/);
    if (loopMatch) {
      const cond = loopMatch[1].trim() || 'loop condition';
      output.push(`    loop ${cond}`);
      blockTypeStack.push('loop');
      continue;
    }

    // Alt/Branch constructs: if(cond) {, else if(cond) {, else {, } else {, } else if(cond) {
    const ifMatch = trimmed.match(/^(?:opt\s+)?if\s*\((.*)\)\s*\{?$/);
    if (ifMatch) {
      const cond = ifMatch[1].trim() || 'condition';
      output.push(`    alt ${cond}`);
      blockTypeStack.push('alt');
      continue;
    }

    const elseIfMatch = trimmed.match(/^(?:\}\s*)?else\s*if\s*\((.*)\)\s*\{?$/);
    if (elseIfMatch) {
      const cond = elseIfMatch[1].trim() || 'condition';
      output.push(`    else ${cond}`);
      continue;
    }

    if (/^(?:\}\s*)?else\s*\{?$/.test(trimmed)) {
      output.push('    else');
      continue;
    }

    // Opt construct: opt {
    if (/^opt\s*\{?$/.test(trimmed)) {
      output.push('    opt');
      blockTypeStack.push('opt');
      continue;
    }

    // Par construct: par {
    if (/^par\s*\{?$/.test(trimmed)) {
      output.push('    par');
      blockTypeStack.push('par');
      continue;
    }

    // Try / catch / finally construct
    if (/^try\s*\{?$/.test(trimmed)) {
      output.push('    critical Try');
      blockTypeStack.push('critical');
      continue;
    }

    if (/^catch\s*\{?$/.test(trimmed)) {
      output.push('    option Catch');
      continue;
    }

    if (/^finally\s*\{?$/.test(trimmed)) {
      output.push('    option Finally');
      continue;
    }

    // Explicit return: return result or return;
    const returnMatch = trimmed.match(/^return(?:\s+(.*))?$/);
    if (returnMatch) {
      const retVal = returnMatch[1]?.trim() || '';
      if (activationStack.length > 0) {
        const top = activationStack[activationStack.length - 1];
        top.returned = true;
        const msg = retVal ? `: ${retVal}` : '';
        output.push(`    ${top.callee}-->>-${top.caller}${msg}`);
      }
      continue;
    }

    // Annotated return: @return A->B: msg
    if (trimmed.startsWith('@return') || trimmed.startsWith('@reply')) {
      const nextLine = (lines[i + 1] || '').trim();
      if (nextLine.includes('->')) {
        const arrow = nextLine.match(/^([A-Za-z0-9_]+)\s*->\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/);
        if (arrow) {
          output.push(`    ${arrow[1]}-->>${arrow[2]}: ${arrow[3]}`);
          i++; // skip next line
          continue;
        }
      }
    }

    // Variable assignment reply: a = A.SyncMessage() or Type a = A.SyncMessage()
    const assignSyncMatch = trimmed.match(/^(?:[A-Za-z0-9_<>[\],\s]+\s+)?([A-Za-z0-9_]+)\s*=\s*([A-Za-z0-9_]+)\.([A-Za-z0-9_]+(?:\(.*\))?)$/);
    if (assignSyncMatch) {
      const varName = assignSyncMatch[1];
      const target = assignSyncMatch[2];
      const method = assignSyncMatch[3];
      const caller = activationStack.length > 0 ? activationStack[activationStack.length - 1].callee : defaultCaller;
      output.push(`    ${caller}->>+${target}: ${method}`);
      output.push(`    ${target}-->>-${caller}: ${varName}`);
      continue;
    }

    // Sync method call with block: Caller->Target.method() { ... } or Target.method() { ... }
    const arrowSyncBlockMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*->\s*([A-Za-z0-9_]+)\.([A-Za-z0-9_]+(?:\(.*\))?)\s*\{$/);
    if (arrowSyncBlockMatch) {
      const caller = arrowSyncBlockMatch[1];
      const callee = arrowSyncBlockMatch[2];
      const method = arrowSyncBlockMatch[3];
      output.push(`    ${caller}->>+${callee}: ${method}`);
      activationStack.push({ caller, callee });
      blockTypeStack.push('method');
      continue;
    }

    const dotSyncBlockMatch = trimmed.match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+(?:\(.*\))?)\s*\{$/);
    if (dotSyncBlockMatch) {
      const callee = dotSyncBlockMatch[1];
      const method = dotSyncBlockMatch[2];
      const caller = activationStack.length > 0 ? activationStack[activationStack.length - 1].callee : defaultCaller;
      output.push(`    ${caller}->>+${callee}: ${method}`);
      activationStack.push({ caller, callee });
      blockTypeStack.push('method');
      continue;
    }

    // Bare sync method call without block: Target.method()
    const bareSyncMatch = trimmed.match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+(?:\(.*\))?)$/);
    if (bareSyncMatch) {
      const callee = bareSyncMatch[1];
      const method = bareSyncMatch[2];
      const caller = activationStack.length > 0 ? activationStack[activationStack.length - 1].callee : defaultCaller;
      output.push(`    ${caller}->>+${callee}: ${method}`);
      output.push(`    deactivate ${callee}`);
      continue;
    }

    // Async message: Caller->Target: Message
    const asyncMsgMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*->\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (asyncMsgMatch) {
      output.push(`    ${asyncMsgMatch[1]}->>${asyncMsgMatch[2]}: ${asyncMsgMatch[3]}`);
      continue;
    }

    // Closing braces: }
    if (trimmed === '}' || trimmed.startsWith('}')) {
      const blockType = blockTypeStack.pop();
      if (blockType === 'method') {
        const top = activationStack.pop();
        if (top && !top.returned) {
          output.push(`    deactivate ${top.callee}`);
        }
      } else if (blockType) {
        output.push('    end');
      }
      continue;
    }

    // Fallback: preserve original line if unrecognized
    output.push(`    ${trimmed}`);
  }

  // Close any unclosed activation stacks
  while (activationStack.length > 0) {
    const top = activationStack.pop();
    if (top && !top.returned) {
      output.push(`    deactivate ${top.callee}`);
    }
  }

  while (blockTypeStack.length > 0) {
    const bt = blockTypeStack.pop();
    if (bt !== 'method') {
      output.push('    end');
    }
  }

  return output.join('\n');
}

/**
 * Transpiles UseCase syntax (usecase / usecase-beta) into a universally compatible flowchart LR/TD.
 * Converts actors into actor shapes, system boundaries into subgraphs, and use cases into pill ovals.
 */
export function transpileUseCase(source: string): string {
  const lines = cleanLines(source);
  const dirMatch = source.match(/\bdirection\s+(LR|RL|TD|TB|BT)\b/i);
  const direction = dirMatch ? dirMatch[1].toUpperCase() : 'LR';
  const output: string[] = [`flowchart ${direction}`];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Skip diagram declaration and direction line
    if (/^\s*(?:usecase-beta|usecase)\b/i.test(trimmed)) continue;
    if (/^\s*direction\s+/i.test(trimmed)) continue;

    // Actor: actor Name or actor Name("Label")
    const actorMatch = trimmed.match(/^actor\s+([A-Za-z0-9_]+)(?:\(["'](.*?)["']\))?$/);
    if (actorMatch) {
      const id = actorMatch[1];
      const label = actorMatch[2] ?? id;
      output.push(`    ${id}["👤 ${label}"]`);
      continue;
    }

    // System Boundary start: systemBoundary Name or systemBoundary "Name"
    const boundaryMatch = trimmed.match(/^systemBoundary\s+["']?([^"']+)["']?$/i);
    if (boundaryMatch) {
      const rawName = boundaryMatch[1].trim();
      const safeId = rawName.replace(/[^A-Za-z0-9_]/g, '_');
      output.push(`    subgraph ${safeId}["${rawName}"]`);
      continue;
    }

    // Boundary end
    if (/^end$/i.test(trimmed)) {
      output.push('    end');
      continue;
    }

    // Use Case definition: ID("Label") or ID["Label"]
    const ucMatch = trimmed.match(/^([A-Za-z0-9_]+)(?:\(["'](.*?)["']\)|\[["'](.*?)["']\])$/);
    if (ucMatch) {
      const id = ucMatch[1];
      const label = ucMatch[2] || ucMatch[3] || id;
      output.push(`    ${id}(["${label}"])`);
      continue;
    }

    // Relationship: A ..> : include B or A ..> : extend B
    const stereotypeRel = trimmed.match(/^([A-Za-z0-9_]+)\s*\.\.>\s*:\s*([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)$/);
    if (stereotypeRel) {
      output.push(`    ${stereotypeRel[1]} -. "«${stereotypeRel[2]}»" .-> ${stereotypeRel[3]}`);
      continue;
    }

    // Standard arrows: A --> B or A ..> B
    const arrowRel = trimmed.match(/^([A-Za-z0-9_]+)\s*(-->|\.\.>)\s*([A-Za-z0-9_]+)(?:\s*:\s*(.*))?$/);
    if (arrowRel) {
      const src = arrowRel[1];
      const arrow = arrowRel[2] === '-->' ? '-->' : '-.->';
      const dest = arrowRel[3];
      const label = arrowRel[4] ? `|"${arrowRel[4].trim()}"| ` : '';
      output.push(`    ${src} ${arrow} ${label}${dest}`);
      continue;
    }

    // Fallback: output as-is
    output.push(`    ${trimmed}`);
  }

  return output.join('\n');
}

/**
 * Transpiles AgentFlow syntax (agentflow-beta) into flowchart TB/LR.
 * Converts flow blocks into subgraphs and custom shapes into standardized nodes.
 */
export function transpileAgentFlow(source: string): string {
  const lines = cleanLines(source);
  const dirMatch = source.match(/^agentflow-beta\s+([A-Za-z]+)/i);
  const direction = dirMatch ? dirMatch[1].toUpperCase() : 'TB';
  const output: string[] = [`flowchart ${direction}`];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || /^\s*agentflow-beta\b/i.test(trimmed)) continue;

    // flow Name["Label"] -> subgraph Name["Label"]
    const flowMatch = trimmed.match(/^flow\s+([A-Za-z0-9_]+)(?:\[["']?(.*?)["']?\])?$/);
    if (flowMatch) {
      const id = flowMatch[1];
      const label = flowMatch[2] || id;
      output.push(`    subgraph ${id}["${label}"]`);
      continue;
    }

    if (/^end$/i.test(trimmed)) {
      output.push('    end');
      continue;
    }

    // Node with shape annotator: id["Label"]@{ shape: input }
    const shapeNodeMatch = trimmed.match(/^([A-Za-z0-9_]+)\[["']?(.*?)["']?\]@\{\s*shape:\s*([A-Za-z0-9_-]+)\s*\}$/);
    if (shapeNodeMatch) {
      const id = shapeNodeMatch[1];
      const label = shapeNodeMatch[2];
      const shape = shapeNodeMatch[3].toLowerCase();

      if (shape === 'input') {
        output.push(`    ${id}[/"📥 ${label}"/]`);
      } else if (shape === 'output') {
        output.push(`    ${id}[\\"📤 ${label}"\\]`);
      } else if (shape === 'tool' || shape === 'process') {
        output.push(`    ${id}["⚙️ ${label}"]`);
      } else if (shape === 'decision') {
        output.push(`    ${id}{"${label}"}`);
      } else {
        output.push(`    ${id}["${label}"]`);
      }
      continue;
    }

    output.push(`    ${trimmed}`);
  }

  return output.join('\n');
}

/**
 * Transpiles ASCII file trees (treeView-beta) into structured flowchart LR diagrams.
 */
export function transpileTreeView(source: string): string {
  const lines = cleanLines(source).filter(l => !/^\s*treeView-beta\b/i.test(l.trim()) && l.trim().length > 0);
  const output: string[] = ['flowchart LR'];

  interface TreeNode {
    depth: number;
    id: string;
    label: string;
  }

  const stack: TreeNode[] = [];
  let counter = 0;

  for (const rawLine of lines) {
    // Measure leading tree symbols / indent to calculate depth
    const prefixMatch = rawLine.match(/^([│\s|├└├──└──\s]+)?(.*)$/);
    const prefix = prefixMatch?.[1] || '';
    const name = (prefixMatch?.[2] || rawLine).trim();
    if (!name) continue;

    // Depth estimated by prefix length in 4-character chunks
    const cleanPrefix = prefix.replace(/[^\s│|├└─]/g, '');
    const depth = Math.max(0, Math.floor(cleanPrefix.length / 3));

    counter++;
    const safeId = `node_${counter}_${name.replace(/[^A-Za-z0-9_]/g, '_')}`;
    const icon = name.endsWith('/') ? '📁' : '📄';
    const label = `${icon} ${name}`;

    output.push(`    ${safeId}["${label}"]`);

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1];
      output.push(`    ${parent.id} --> ${safeId}`);
    }

    stack.push({ depth, id: safeId, label });
  }

  return output.join('\n');
}

/**
 * Universal pre-transpiler: inspects diagram source and transpiles unsupported syntaxes.
 */
export function adaptDiagramSource(source: string): TranspileResult {
  const trimmed = source.trimStart();

  if (/^zenuml\b/i.test(trimmed)) {
    return {
      code: transpileZenUML(source),
      transpiled: true,
      type: 'zenuml',
    };
  }

  if (/^(?:usecase-beta|usecase)\b/i.test(trimmed)) {
    return {
      code: transpileUseCase(source),
      transpiled: true,
      type: 'usecase',
    };
  }

  if (/^agentflow-beta\b/i.test(trimmed)) {
    return {
      code: transpileAgentFlow(source),
      transpiled: true,
      type: 'agentflow',
    };
  }

  if (/^treeView-beta\b/i.test(trimmed)) {
    return {
      code: transpileTreeView(source),
      transpiled: true,
      type: 'treeview',
    };
  }

  return {
    code: source,
    transpiled: false,
    type: 'native',
  };
}
