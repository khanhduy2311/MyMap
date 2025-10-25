import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  SelectionMode,
  MiniMap,
  useReactFlow,
} from '@xyflow/react';
// ✨ SỬA: Thêm useRef
import { useMemo, useEffect, useState, useRef } from 'react';

import { useStore } from './store/store';
import CustomNode from './components/CustomNode';
import VerticalToolbar from './components/VerticalToolbar';
import ZoomToolbar from './components/ZoomToolbar';
import CustomEdgeToolbar from './components/CustomEdgeToolbar';
import DarkModeToggle from './components/DarkModeToggle';
import './App.scss';

import DrawAreaNode from './components/DrawAreaNode';

const nodeTypes = { 
  custom: CustomNode,
  drawArea: DrawAreaNode, 
};

const FAKE_NODE_ID = 'multi-select-fake-node';

// Component FlowContent (để chứa logic)
function FlowContent() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isMiniMapVisible,
    selectedEdgeId,
    setSelectedEdgeId,
    selectedNodeIds,
    setSelectedNodeIds,
    edgeToolbarPosition,
    copyNodes,   
    pasteNodes,  
    backgroundVariant, 
    patternColor, 
    appMode,      
    setAppMode,   
    addDrawAreaNode, 
    activeDrawAreaId, 
    currentDrawTool,
    setCurrentDrawTool,
    setActiveDrawArea,
  } = useStore();
  const reactFlowInstance = useReactFlow();

  // ✨ SỬA: Tách state (để render) và ref (để lấy logic)
  const [previewRect, setPreviewRect] = useState(null); // Dùng để render SVG
  const isCreating = useRef(false);
  const startPos = useRef(null); // ✨ SẼ LƯU TỌA ĐỘ MÀN HÌNH (SCREEN)
  const previewRectRef = useRef(null); 
  
  const wrapperRef = useRef(null); 

  // --- Logic Node Giả (Giữ nguyên) ---
  const nodesToRender = useMemo(() => {
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    const isMultiSelect = selectedNodes.length > 1;

    if (!isMultiSelect || appMode !== 'normal') {
      return nodes;
    }

    let lowestY = Infinity;
    let minXNode = null;
    let maxXNode = null;

    selectedNodes.forEach(node => {
      if (node.position.y < lowestY) { lowestY = node.position.y; }
      if (!minXNode || node.position.x < minXNode.position.x) { minXNode = node; }
      if (!maxXNode || node.position.x > maxXNode.position.x) { maxXNode = node; }
    });

    const targetX = (minXNode.position.x + maxXNode.position.x) / 2 + 90;
    const targetY = lowestY;

    const fakeNode = {
      id: FAKE_NODE_ID,
      type: 'custom',
      position: { x: targetX, y: targetY },
      data: selectedNodes[0].data,
      selected: true,
      selectable: false,
      draggable: false,
    };

    return [...nodes, fakeNode];

  }, [nodes, selectedNodeIds, appMode]);


  // --- (handleEdgeClick, handlePaneClick, handleNodeClick giữ nguyên) ---
  const handleEdgeClick = (event, edge) => {
    event.stopPropagation();
    const position = { x: event.clientX, y: event.clientY };
    setSelectedEdgeId(edge.id, position);
  };

  const handlePaneClick = (event) => {
      if (appMode === 'normal' && event.target.classList.contains('react-flow__pane')) {
          setSelectedEdgeId(null);
          setSelectedNodeIds([]);
      }
      if (appMode === 'canvasMode' && currentDrawTool.mode !== 'cursor') {
          setCurrentDrawTool({ mode: 'cursor' });
          setActiveDrawArea(null); 
      }
  };

  const handleNodeClick = (event, node) => {
    event.stopPropagation();
    setSelectedEdgeId(null);
    if (event.ctrlKey || event.metaKey) {
      const prevSelectedIds = selectedNodeIds;
      const newSelectedIds = prevSelectedIds.includes(node.id)
        ? prevSelectedIds.filter(id => id !== node.id)
        : [...prevSelectedIds, node.id];
      setSelectedNodeIds(newSelectedIds);
    } else {
      setSelectedNodeIds([node.id]);
    }
  };
  
  // ✨ SỬA: Logic Kéo-Thả dùng TỌA ĐỘ MÀN HÌNH (CLIENTX/Y)

  const handlePaneMouseDown = (event) => {
    if (event.button !== 0) return;
    if (appMode !== 'creatingDrawArea') return;
    
    const targetClassList = event.target.classList;
    if (!(targetClassList.contains('react-flow__pane') || event.target === wrapperRef.current)) {
        return;
    }

    // ✨ SỬA: LƯU TỌA ĐỘ MÀN HÌNH (SCREEN)
    const screenPos = { x: event.clientX, y: event.clientY };

    isCreating.current = true;
    startPos.current = screenPos; // Lưu tọa độ screen
    
    const initialRect = {
      x: screenPos.x,
      y: screenPos.y,
      width: 0,
      height: 0,
    };

    setPreviewRect(initialRect); // Cập nhật state (để render)
    previewRectRef.current = initialRect; // Cập nhật ref (để lấy logic)

    document.addEventListener('mousemove', handlePaneMouseMove);
    document.addEventListener('mouseup', handlePaneMouseUp);

    event.preventDefault();
    event.stopPropagation();
  };

  const handlePaneMouseMove = (event) => {
    if (!isCreating.current || !startPos.current) return;

    // ✨ SỬA: DÙNG TỌA ĐỘ MÀN HÌNH (SCREEN)
    const currentPos = { x: event.clientX, y: event.clientY };

    const newX = Math.min(startPos.current.x, currentPos.x);
    const newY = Math.min(startPos.current.y, currentPos.y);
    const newWidth = Math.abs(currentPos.x - startPos.current.x);
    const newHeight = Math.abs(currentPos.y - startPos.current.y);

    const rect = { x: newX, y: newY, width: newWidth, height: newHeight };
    
    setPreviewRect(rect); // Cập nhật state (render)
    previewRectRef.current = rect; // Cập nhật ref (logic)

    event.preventDefault();
    event.stopPropagation();
  };

  const handlePaneMouseUp = (event) => {
    document.removeEventListener('mousemove', handlePaneMouseMove);
    document.removeEventListener('mouseup', handlePaneMouseUp);
    
    // ✨ SỬA: Lấy rect TỌA ĐỘ MÀN HÌNH (SCREEN) từ ref
    const finalRect = previewRectRef.current; 
    
    if (!isCreating.current || !finalRect) return; 

    isCreating.current = false;
    startPos.current = null;
    setPreviewRect(null); // Reset state (render)
    previewRectRef.current = null; // Reset ref (logic)
    setAppMode('normal');

    // ✨ SỬA: DỊCH TỪ TỌA ĐỘ SCREEN SANG FLOW
    // Kiểm tra kích thước tối thiểu (tính bằng pixel màn hình)
    if (finalRect.width > 10 && finalRect.height > 10) {
      
      // Dịch 2 điểm (góc trên-trái và dưới-phải)
      const topLeftFlow = reactFlowInstance.screenToFlowPosition({
        x: finalRect.x,
        y: finalRect.y,
      });
      
      const bottomRightFlow = reactFlowInstance.screenToFlowPosition({
        x: finalRect.x + finalRect.width,
        y: finalRect.y + finalRect.height,
      });

      // Tính toán width/height trong hệ tọa độ flow
      const flowWidth = Math.abs(bottomRightFlow.x - topLeftFlow.x);
      const flowHeight = Math.abs(bottomRightFlow.y - topLeftFlow.y);

      // Gọi addNode với tọa độ flow chính xác
      addDrawAreaNode(
        { x: topLeftFlow.x, y: topLeftFlow.y },
        { width: flowWidth, height: flowHeight }
      );
    }

    event.preventDefault();
    event.stopPropagation();
  };

  // --- (useEffect bắt phím tắt giữ nguyên) ---
  useEffect(() => {
    const handleKeyDown = (event) => {
      const activeEl = document.activeElement;
      const isTyping = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';
      if (isTyping) return;

      if (event.key === 'Escape' && appMode === 'canvasMode') {
          setAppMode('normal'); 
          event.preventDefault();
          return; 
      }

      if (appMode === 'normal') {
          const isCtrlOrMeta = event.ctrlKey || event.metaKey;
          if (isCtrlOrMeta) {
              if (event.key === 'c' || event.key === 'C') {
                  event.preventDefault();
                  copyNodes();
              }
              if (event.key === 'v' || event.key === 'V') {
                  event.preventDefault();
                  pasteNodes();
              }
          }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [copyNodes, pasteNodes, appMode, setAppMode]); 
  
  const isCanvasCursor = appMode === 'canvasMode' && currentDrawTool.mode === 'cursor';

  return (
    <>
      <div 
        className="reactflow-wrapper" 
        ref={wrapperRef} 
        // ✨ Gắn hàm xử lý MOUSE DOWN vào DIV CHA
        onMouseDown={handlePaneMouseDown}
      >
        <ReactFlow
          nodes={nodesToRender}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes} 
          fitView
          
          panOnDrag={[2]} // Chỉ chuột phải
          selectionOnDrag={appMode === 'normal' || isCanvasCursor} // Kéo chọn (chuột trái)
          zoomOnScroll={appMode !== 'canvasMode' || isCanvasCursor} 
          zoomOnDoubleClick={false}
          nodesDraggable={appMode === 'normal' || isCanvasCursor} 
          nodesConnectable={appMode === 'normal'}
          
          selectionMode={SelectionMode.Partial}
          minZoom={0.02}
          maxZoom={3}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          onNodeClick={handleNodeClick} 
          // ✨ XÓA onPaneMouseDown khỏi ReactFlow
        >
          <Background 
            variant={backgroundVariant} 
            color={patternColor} 
          />
          {isMiniMapVisible && <MiniMap />}
          
          {/* ✨ SỬA: ĐẢM BẢO SVG DÙNG TỌA ĐỘ MÀN HÌNH (ABSOLUTE) */}
          {previewRect && (
            <svg 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                pointerEvents: 'none', 
                zIndex: 20 
              }}
            >
              <rect
                x={previewRect.x}
                y={previewRect.y}
                width={previewRect.width}
                height={previewRect.height}
                className="preview-rect-svg" 
              />
            </svg>
          )}
        </ReactFlow>
      </div>
      <ZoomToolbar />

      {selectedEdgeId && edgeToolbarPosition && (
        <CustomEdgeToolbar
          edgeId={selectedEdgeId}
          style={{
            left: edgeToolbarPosition.x,
            top: edgeToolbarPosition.y
          }}
        />
      )}
    </>
  );
}

// --- COMPONENT APP CHÍNH (Wrapper) ---
function App() {
  const darkMode = useStore(s => s.darkMode);

  return (
    <div className={`app-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
      <ReactFlowProvider>
        <VerticalToolbar />
        <DarkModeToggle />
        <FlowContent />
      </ReactFlowProvider>
    </div>
  );
}

export default App;