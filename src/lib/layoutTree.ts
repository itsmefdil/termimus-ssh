export type SplitDirection = "row" | "column"; // 'row' = left & right, 'column' = top & bottom

export interface PaneLeaf {
  type: "leaf";
  id: string;
  tabIds: string[];
  activeTabId: string;
}

export interface PaneSplit {
  type: "split";
  id: string;
  direction: SplitDirection;
  ratio: number; // percentage for first child (15 to 85, default 50)
  children: [PaneNode, PaneNode];
}

export type PaneNode = PaneLeaf | PaneSplit;

let nextPaneSeq = 1;
export function generatePaneId(): string {
  return `pane-${Date.now().toString(36)}-${(nextPaneSeq++).toString(36)}`;
}

let nextSplitSeq = 1;
export function generateSplitId(): string {
  return `split-${Date.now().toString(36)}-${(nextSplitSeq++).toString(36)}`;
}

let nextGroupSeq = 1;
export function generateGroupId(): string {
  return `group-${Date.now().toString(36)}-${(nextGroupSeq++).toString(36)}`;
}

/**
 * Creates the initial single-leaf layout with one active tab.
 */
export function createInitialLayout(tabId: string): PaneLeaf {
  return createLeafPane(tabId);
}

export function createLeafPane(tabId: string): PaneLeaf {
  return {
    type: "leaf",
    id: generatePaneId(),
    tabIds: [tabId],
    activeTabId: tabId,
  };
}

export function createSplitPane(
  direction: SplitDirection,
  first: PaneNode,
  second: PaneNode,
  ratio = 50
): PaneSplit {
  return {
    type: "split",
    id: generateSplitId(),
    direction,
    ratio,
    children: [first, second],
  };
}

/**
 * Recursively find the leaf pane containing the given tab ID.
 */
export function findPaneContainingTab(
  node: PaneNode | null,
  tabId: string
): PaneLeaf | null {
  if (!node) return null;
  if (node.type === "leaf") {
    return node.tabIds.includes(tabId) ? node : null;
  }
  return (
    findPaneContainingTab(node.children[0], tabId) ||
    findPaneContainingTab(node.children[1], tabId)
  );
}

/**
 * Recursively find a leaf pane by its ID.
 */
export function findPaneById(
  node: PaneNode | null,
  paneId: string
): PaneLeaf | null {
  if (!node) return null;
  if (node.type === "leaf") {
    return node.id === paneId ? node : null;
  }
  return (
    findPaneById(node.children[0], paneId) ||
    findPaneById(node.children[1], paneId)
  );
}

/**
 * Get all leaf panes in the layout tree.
 */
export function getAllLeafPanes(node: PaneNode | null): PaneLeaf[] {
  if (!node) return [];
  if (node.type === "leaf") return [node];
  return [
    ...getAllLeafPanes(node.children[0]),
    ...getAllLeafPanes(node.children[1]),
  ];
}

/**
 * Get all session IDs contained anywhere in this layout tree.
 */
export function getAllSessionIdsInTree(node: PaneNode | null): string[] {
  return getAllLeafPanes(node).flatMap((l) => l.tabIds);
}

/**
 * Remove a tab ID from the tree.
 * If a leaf becomes empty, it is eliminated and the sibling node takes over the split.
 * Returns the new root node (or null if all tabs are gone).
 */
export function removeTabFromTree(
  node: PaneNode | null,
  tabId: string
): PaneNode | null {
  if (!node) return null;

  if (node.type === "leaf") {
    if (!node.tabIds.includes(tabId)) {
      return node;
    }
    const remainingTabs = node.tabIds.filter((id) => id !== tabId);
    if (remainingTabs.length === 0) {
      return null; // This leaf is empty and should be pruned
    }
    const nextActive =
      node.activeTabId === tabId ? remainingTabs[remainingTabs.length - 1] : node.activeTabId;
    return {
      ...node,
      tabIds: remainingTabs,
      activeTabId: nextActive,
    };
  }

  // Split node
  const left = removeTabFromTree(node.children[0], tabId);
  const right = removeTabFromTree(node.children[1], tabId);

  if (!left && !right) {
    return null;
  }
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }

  return {
    ...node,
    children: [left, right],
  };
}

/**
 * Splits a target leaf pane into two panes (one original, one with newTabId).
 * If newTabId already exists elsewhere in the tree, it is first pruned from there.
 */
export function splitLeafNode(
  root: PaneNode,
  targetPaneId: string,
  newTabId: string,
  direction: SplitDirection,
  side: "first" | "second" = "second"
): PaneNode {
  // 1. Remove newTabId from anywhere else in the tree first
  const cleanedRoot = removeTabFromTree(root, newTabId) || root;

  // 2. Helper to replace the target leaf with a new split node
  function replaceInTree(node: PaneNode): PaneNode {
    if (node.type === "leaf") {
      if (node.id === targetPaneId) {
        const newLeaf: PaneLeaf = {
          type: "leaf",
          id: generatePaneId(),
          tabIds: [newTabId],
          activeTabId: newTabId,
        };

        const children: [PaneNode, PaneNode] =
          side === "first" ? [newLeaf, node] : [node, newLeaf];

        const splitNode: PaneSplit = {
          type: "split",
          id: generateSplitId(),
          direction,
          ratio: 50,
          children,
        };
        return splitNode;
      }
      return node;
    }

    return {
      ...node,
      children: [
        replaceInTree(node.children[0]),
        replaceInTree(node.children[1]),
      ],
    };
  }

  return replaceInTree(cleanedRoot);
}

/**
 * Moves a tab into an existing leaf pane, docking it as a tab in that pane.
 */
export function moveTabToPane(
  root: PaneNode,
  targetPaneId: string,
  tabId: string
): PaneNode {
  // First check if it's already only in this pane
  const currentPane = findPaneContainingTab(root, tabId);
  if (currentPane && currentPane.id === targetPaneId) {
    // Just ensure it's active in this pane
    return setPaneActiveTab(root, targetPaneId, tabId);
  }

  // Remove tab from its old location (which might collapse empty panes)
  const cleaned = removeTabFromTree(root, tabId);
  if (!cleaned) {
    return createInitialLayout(tabId);
  }

  function addToTarget(node: PaneNode): PaneNode {
    if (node.type === "leaf") {
      if (node.id === targetPaneId) {
        return {
          ...node,
          tabIds: [...node.tabIds.filter((id) => id !== tabId), tabId],
          activeTabId: tabId,
        };
      }
      return node;
    }
    return {
      ...node,
      children: [
        addToTarget(node.children[0]),
        addToTarget(node.children[1]),
      ],
    };
  }

  return addToTarget(cleaned);
}

/**
 * Updates the active tab inside a specific leaf pane.
 */
export function setPaneActiveTab(
  node: PaneNode,
  paneId: string,
  tabId: string
): PaneNode {
  if (node.type === "leaf") {
    if (node.id === paneId && node.tabIds.includes(tabId)) {
      return {
        ...node,
        activeTabId: tabId,
      };
    }
    return node;
  }
  return {
    ...node,
    children: [
      setPaneActiveTab(node.children[0], paneId, tabId),
      setPaneActiveTab(node.children[1], paneId, tabId),
    ],
  };
}

/**
 * Updates the split ratio of a specific split node (clamped 15%..85%).
 */
export function updateSplitRatio(
  node: PaneNode,
  splitId: string,
  ratio: number
): PaneNode {
  const clampedRatio = Math.max(15, Math.min(85, Math.round(ratio)));
  if (node.type === "leaf") return node;

  if (node.id === splitId) {
    return {
      ...node,
      ratio: clampedRatio,
    };
  }

  return {
    ...node,
    children: [
      updateSplitRatio(node.children[0], splitId, clampedRatio),
      updateSplitRatio(node.children[1], splitId, clampedRatio),
    ],
  };
}
