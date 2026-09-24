import { useRef } from "react";
import { PaneNode } from "../../lib/layoutTree";
import { PaneView } from "./PaneView";
import { SplitHandle } from "./SplitHandle";

interface PaneContainerProps {
  node: PaneNode;
  visible?: boolean;
}

export function PaneContainer({ node, visible = true }: PaneContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (node.type === "leaf") {
    return <PaneView pane={node} visible={visible} />;
  }

  const isRow = node.direction === "row";
  const ratio = node.ratio;

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full w-full overflow-hidden ${
        isRow ? "flex-row" : "flex-col"
      }`}
    >
      {/* First Child Pane */}
      <div
        style={{
          flex: "none",
          width: isRow ? `calc(${ratio}% - 3px)` : "100%",
          height: isRow ? "100%" : `calc(${ratio}% - 3px)`,
        }}
        className="relative overflow-hidden"
      >
        <PaneContainer node={node.children[0]} visible={visible} />
      </div>

      {/* Resizable Splitter Handle */}
      <SplitHandle
        splitId={node.id}
        direction={node.direction}
        parentRef={containerRef}
      />

      {/* Second Child Pane */}
      <div
        style={{
          flex: "none",
          width: isRow ? `calc(${100 - ratio}% - 3px)` : "100%",
          height: isRow ? "100%" : `calc(${100 - ratio}% - 3px)`,
        }}
        className="relative overflow-hidden"
      >
        <PaneContainer node={node.children[1]} visible={visible} />
      </div>
    </div>
  );
}
