import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  SelectionMode,
  MiniMap,
  useReactFlow,
} from '@xyflow/react';
import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { useStore } from './store/store';
import CustomNode from './components/CustomNode';
import VerticalToolbar from './components/VerticalToolbar';
import ZoomToolbar from './components/ZoomToolbar';
import CustomEdgeToolbar from './components/CustomEdgeToolbar';
import DarkModeToggle from './components/DarkModeToggle';
import './App.scss';
import DrawAreaNode from './components/DrawAreaNode';
import { markdownToMindmap } from './utils/markdownToMindmap';
import CytoscapeMindmap from './components/CytoscapeMindmap'; // ✅ thêm mới

const nodeTypes = { custom: CustomNode, drawArea: DrawAreaNode };
const FAKE_NODE_ID = 'multi-select-fake-node';

/* --------------------------- FLOW CONTENT --------------------------- */
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
    currentDrawTool,
    setCurrentDrawTool,
    setActiveDrawArea,
  } = useStore();

  const reactFlowInstance = useReactFlow();
  const [previewRect, setPreviewRect] = useState(null);
  const isCreating = useRef(false);
  const startPos = useRef(null);
  const previewRectRef = useRef(null);
  const wrapperRef = useRef(null);

  /* ---- Hiển thị fake node khi multi-select ---- */
  const nodesToRender = useMemo(() => {
    const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
    if (selectedNodes.length <= 1 || appMode !== 'normal') return nodes;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity;
    selectedNodes.forEach((n) => {
      minX = Math.min(minX, n.position.x);
      maxX = Math.max(maxX, n.position.x);
      minY = Math.min(minY, n.position.y);
    });

    const fakeNode = {
      id: FAKE_NODE_ID,
      type: 'custom',
      position: { x: (minX + maxX) / 2 + 90, y: minY },
      data: selectedNodes[0].data,
      selected: true,
      selectable: false,
      draggable: false,
    };
    return [...nodes, fakeNode];
  }, [nodes, selectedNodeIds, appMode]);

  /* ---- Sự kiện click ---- */
  const handleEdgeClick = (e, edge) => {
    e.stopPropagation();
    setSelectedEdgeId(edge.id, { x: e.clientX, y: e.clientY });
  };

  const handlePaneClick = (e) => {
    if (appMode === 'normal' && e.target.classList.contains('react-flow__pane')) {
      setSelectedEdgeId(null);
      setSelectedNodeIds([]);
    }
    if (appMode === 'canvasMode' && currentDrawTool.mode !== 'cursor') {
      setCurrentDrawTool({ mode: 'cursor' });
      setActiveDrawArea(null);
    }
  };

  const handleNodeClick = (e, node) => {
    e.stopPropagation();
    setSelectedEdgeId(null);
    if (e.ctrlKey || e.metaKey) {
      setSelectedNodeIds((prev) =>
        prev.includes(node.id) ? prev.filter((id) => id !== node.id) : [...prev, node.id]
      );
    } else setSelectedNodeIds([node.id]);
  };

  /* ---- Vẽ khung DrawArea ---- */
  const handlePaneMouseDown = (e) => {
    if (e.button !== 0 || appMode !== 'creatingDrawArea') return;
    const screenPos = { x: e.clientX, y: e.clientY };
    isCreating.current = true;
    startPos.current = screenPos;
    const initial = { x: screenPos.x, y: screenPos.y, width: 0, height: 0 };
    setPreviewRect(initial);
    previewRectRef.current = initial;
    document.addEventListener('mousemove', handlePaneMouseMove);
    document.addEventListener('mouseup', handlePaneMouseUp);
  };

  const handlePaneMouseMove = (e) => {
    if (!isCreating.current || !startPos.current) return;
    const current = { x: e.clientX, y: e.clientY };
    const rect = {
      x: Math.min(startPos.current.x, current.x),
      y: Math.min(startPos.current.y, current.y),
      width: Math.abs(current.x - startPos.current.x),
      height: Math.abs(current.y - startPos.current.y),
    };
    setPreviewRect(rect);
    previewRectRef.current = rect;
  };

  const handlePaneMouseUp = (e) => {
    document.removeEventListener('mousemove', handlePaneMouseMove);
    document.removeEventListener('mouseup', handlePaneMouseUp);
    if (!isCreating.current) return;
    isCreating.current = false;
    const rect = previewRectRef.current;
    setPreviewRect(null);
    if (rect && rect.width > 10 && rect.height > 10) {
      const topLeft = reactFlowInstance.screenToFlowPosition({ x: rect.x, y: rect.y });
      const bottomRight = reactFlowInstance.screenToFlowPosition({
        x: rect.x + rect.width,
        y: rect.y + rect.height,
      });
      addDrawAreaNode(
        { x: topLeft.x, y: topLeft.y },
        { width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y }
      );
    }
    setAppMode('normal');
  };

  /* ---- Phím tắt ---- */
  useEffect(() => {
    const handleKey = (e) => {
      const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
      if (isTyping) return;
      if (e.key === 'Escape' && appMode === 'canvasMode') return setAppMode('normal');
      const ctrl = e.ctrlKey || e.metaKey;
      if (appMode === 'normal' && ctrl) {
        if (e.key === 'c' || e.key === 'C') copyNodes();
        if (e.key === 'v' || e.key === 'V') pasteNodes();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [copyNodes, pasteNodes, appMode, setAppMode]);

  return (
    <>
      <div className="reactflow-wrapper" ref={wrapperRef} onMouseDown={handlePaneMouseDown}>
        <ReactFlow
          nodes={nodesToRender}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          onlyRenderVisibleElements
          panOnDrag={[2]}
          selectionOnDrag={true}
          zoomOnScroll
          zoomOnDoubleClick={false}
          nodesDraggable
          nodesConnectable
          selectionMode={SelectionMode.Partial}
          minZoom={0.02}
          maxZoom={3}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          onNodeClick={handleNodeClick}
        >
          <Background variant={backgroundVariant} color={patternColor} />
          {isMiniMapVisible && <MiniMap />}
          {previewRect && (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 20,
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
          style={{ left: edgeToolbarPosition.x, top: edgeToolbarPosition.y }}
        />
      )}
    </>
  );
}

/* --------------------------- MINDMAP EDITOR --------------------------- */
function MindmapEditor() {
  const darkMode = useStore((s) => s.darkMode);
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

/* --------------------------- IMPORT MINDMAP --------------------------- */
function ImportMindmap() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { loadState } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const createMockMindmap = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:3000/mindmaps/${id}/json`, { credentials: 'include' });
      if (!res.ok) throw new Error('Không thể tải nội dung mindmap từ server');
      const data = await res.json();
      if (!data.success || !data.data?.content) throw new Error('Dữ liệu trả về không hợp lệ');
      const markdownText = data.data.content;
      const { nodes, edges } = markdownToMindmap(markdownText);
      loadState({ nodes, edges });
      setLoading(false);
      setTimeout(() => navigate('/editor'), 300);
    } catch (err) {
      console.error('Error loading mindmap:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [id, loadState, navigate]);

  useEffect(() => {
    createMockMindmap();
  }, [createMockMindmap]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.icon}>🗺️</div>
        <h2>Đang tạo Mindmap...</h2>
        <p style={{ opacity: 0.8 }}>Khởi tạo sơ đồ tư duy mẫu</p>
        <div style={styles.progressOuter}>
          <div style={styles.progressInner}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>❌</div>
        <h2 style={{ color: '#d32f2f', marginBottom: '10px' }}>Lỗi</h2>
        <p style={{ color: '#666', marginBottom: '30px', maxWidth: '500px' }}>{error}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/editor')} style={styles.btnPrimary}>
            Tạo Mindmap Mới
          </button>
          <button onClick={() => window.location.reload()} style={styles.btnSecondary}>
            Thử Lại
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/* --------------------------- CYTOSCAPE VIEWER --------------------------- */
function CytoscapeViewer() {
  const { id } = useParams();
  const [markdown, setMarkdown] = useState('');
  useEffect(() => {
    fetch(`http://localhost:3000/mindmaps/${id}/json`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setMarkdown(data.data?.content || ''))
      .catch(console.error);
  }, [id]);
  if (!markdown) return <div style={{ padding: 40 }}>Đang tải...</div>;
  return <CytoscapeMindmap markdownContent={markdown} />;
}

/* --------------------------- APP MAIN --------------------------- */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MindmapEditor />} />
        <Route path="/editor" element={<MindmapEditor />} />
        <Route path="/import/:id" element={<ImportMindmap />} />
        <Route path="/cyto/:id" element={<CytoscapeViewer />} /> {/* ✅ hỗ trợ mindmap khổng lồ */}
      </Routes>
    </BrowserRouter>
  );
}

/* --------------------------- STYLES --------------------------- */
const styles = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    textAlign: 'center',
  },
  icon: { fontSize: '64px', marginBottom: '20px', animation: 'pulse 1.5s ease-in-out infinite' },
  progressOuter: {
    width: '200px',
    height: '4px',
    background: 'rgba(255,255,255,0.3)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '20px',
  },
  progressInner: {
    width: '100%',
    height: '100%',
    background: 'white',
    animation: 'loading 1.5s ease-in-out infinite',
  },
  errorContainer: {
    padding: '40px',
    textAlign: 'center',
    background: 'var(--bg-primary)',
    minHeight: '100vh',
  },
  btnPrimary: {
    padding: '12px 24px',
    background: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  btnSecondary: {
    padding: '12px 24px',
    background: '#666',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
  },
};

export default App;
