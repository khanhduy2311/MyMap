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
import { message } from 'antd'; // THÊM: Để hiển thị thông báo "Đã lưu"
import { useStore } from './store/store';
import CustomNode from './components/CustomNode';
import VerticalToolbar from './components/VerticalToolbar';
import ZoomToolbar from './components/ZoomToolbar';
import CustomEdgeToolbar from './components/CustomEdgeToolbar';
import DarkModeToggle from './components/DarkModeToggle';
import './App.scss';
import DrawAreaNode from './components/DrawAreaNode';
import { markdownToMindmap } from './utils/markdownToMindmap';
import CytoscapeMindmap from './components/CytoscapeMindmap';

const nodeTypes = { custom: CustomNode, drawArea: DrawAreaNode };
const FAKE_NODE_ID = 'multi-select-fake-node';

// THÊM: Hàm Debounce để tối ưu auto-save
function debounce(func, wait) {
  let timeout;
  const debounced = (...args) => {
    const context = this;
    const later = () => {
      clearTimeout(timeout);
      func.apply(context, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
  // Thêm hàm .flush() để gọi lưu ngay lập tức (cho nút lưu thủ công)
  debounced.flush = (...args) => {
    clearTimeout(timeout);
    func.apply(this, args);
  };
  return debounced;
}


/* --------------------------- FLOW CONTENT --------------------------- */
// SỬA: Thêm props 'currentMindmapId' và 'onManualSave'
function FlowContent({ currentMindmapId, onManualSave }) {
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
    // THÊM: Lấy state liên quan đến việc tải/lưu
    isLoaded,
    setSaveStatus // (Giả định bạn có hàm này trong store.js)
  } = useStore();

  const reactFlowInstance = useReactFlow();
  const [previewRect, setPreviewRect] = useState(null);
  const isCreating = useRef(false);
  const startPos = useRef(null);
  const previewRectRef = useRef(null);
  const wrapperRef = useRef(null);

  // THÊM: Logic Auto-save và Manual-save
  const { REACT_APP_API_URL } = process.env;
  const isAutoSaving = useRef(false);

  // Hàm gọi API để lưu vào CSDL
  const handleSaveToDB = useCallback(debounce(async (nodesToSave, edgesToSave) => {
    // Chỉ lưu nếu có ID, không đang lưu, và đã tải xong
    if (!currentMindmapId || isAutoSaving.current || !isLoaded) {
      return;
    }

    isAutoSaving.current = true;
    if (setSaveStatus) setSaveStatus('saving');

    try {
      const { toPng } = await import('html-to-image');
      const viewport = document.querySelector('.react-flow__viewport');
      let thumbnailUrl = null;
      if (viewport) {
         thumbnailUrl = await toPng(viewport, { width: 300, height: 200, cacheBust: true, pixelRatio: 1 });
      }

      const response = await fetch(`${REACT_APP_API_URL || 'http://localhost:3000'}/mindmaps/update/${currentMindmapId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          nodes: nodesToSave,
          edges: edgesToSave,
          thumbnailUrl: thumbnailUrl // Gửi cả thumbnail
        }),
      });

      if (!response.ok) throw new Error('Lỗi khi lưu vào CSDL');
      
      const result = await response.json();
      if(result.success) {
         if (setSaveStatus) setSaveStatus('saved');
      } else {
         throw new Error(result.message || 'Lỗi lưu CSDL');
      }

    } catch (err) {
      console.error("Lỗi auto-save:", err);
      if (setSaveStatus) setSaveStatus('error');
      // Chỉ báo lỗi nếu không phải là lưu thủ công
      if (!onManualSave) {
          message.error("Không thể tự động lưu sơ đồ.");
      }
    } finally {
      isAutoSaving.current = false;
    }
  }, 1500), [currentMindmapId, isLoaded, REACT_APP_API_URL, setSaveStatus]); // Delay 1.5s

  // Kích hoạt Auto-save
  useEffect(() => {
    if (isLoaded && nodes.length > 0) {
      handleSaveToDB(nodes, edges);
    }
  }, [nodes, edges, isLoaded, handleSaveToDB]);

  // Kết nối với nút Lưu thủ công
  useEffect(() => {
    if (onManualSave) {
      onManualSave.current = () => {
        handleSaveToDB.flush(nodes, edges); // Gọi .flush() để lưu ngay
        message.success('Đã lưu sơ đồ!');
      };
    }
  }, [handleSaveToDB, nodes, edges, onManualSave]);
  

  /* ---- Hiển thị fake node khi multi-select (Giữ nguyên) ---- */
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

  /* ---- Sự kiện click (Giữ nguyên) ---- */
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

  /* ---- Vẽ khung DrawArea (Giữ nguyên) ---- */
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

  /* ---- Phím tắt (Giữ nguyên) ---- */
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
          defaultZoom={1.0}
          fitViewOptions={{ padding: 0.05, minZoom: 0.5, maxZoom: 1.5 }} // ✅ ZOOM GẦN HƠN NỮA
          onlyRenderVisibleElements
          panOnDrag={[2]}
          selectionOnDrag={true}
          zoomOnScroll
          zoomOnDoubleClick={false}
          nodesDraggable
          nodesConnectable
          selectionMode={SelectionMode.Partial}
          minZoom={0.3}
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

  // SỬA: Lấy ID từ URL và tạo ref cho nút lưu thủ công
  const { id } = useParams();
  const manualSaveRef = useRef(null);
  
  // THÊM: Tải mindmap khi component mount (nếu chưa có trong store)
  const { isLoaded, setLoaded, loadState, nodes, setCurrentMindmapId } = useStore();
  
  useEffect(() => {
    // Chỉ tải nếu chưa tải (bỏ kiểm tra ID khớp vì id thay đổi qua URL)
    if (!isLoaded) {
      const fetchMindmap = async () => {
         try {
            if(setLoaded) setLoaded(false);
            const res = await fetch(`http://localhost:3000/mindmaps/${id}/json`, { credentials: 'include' });
            if (!res.ok) throw new Error('Không thể tải mindmap');
            const data = await res.json();
            if (!data.success || !data.data) throw new Error('Dữ liệu không hợp lệ');

            // ✅ LUÔN convert từ markdown để có layout NGANG mới nhất
            console.log('🔄 Converting markdown to mindmap with HORIZONTAL layout...');
            const { nodes, edges } = markdownToMindmap(data.data.content);
            loadState({ nodes, edges });
            console.log('✅ Loaded', nodes.length, 'nodes with HORIZONTAL layout');
            
            if(setCurrentMindmapId) setCurrentMindmapId(id);
            if(setLoaded) setLoaded(true);
         } catch(err) {
            console.error("Lỗi tải mindmap:", err);
            message.error("Không thể tải sơ đồ. Đang chuyển về dashboard...");
            setTimeout(() => window.location.href = '/dashboard', 2000);
         }
      };
      fetchMindmap();
    }
  }, [id, isLoaded, loadState, setLoaded, setCurrentMindmapId]);


  return (
    <div className={`app-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
      <ReactFlowProvider>
        {/* SỬA: Truyền hàm lưu thủ công vào VerticalToolbar */}
        <VerticalToolbar 
          onManualSave={() => manualSaveRef.current && manualSaveRef.current()}
        />
        <DarkModeToggle />
        {/* SỬA: Truyền ID và ref xuống FlowContent */}
        <FlowContent 
          currentMindmapId={id} 
          onManualSave={manualSaveRef} 
        />
      </ReactFlowProvider>
    </div>
  );
}

/* --------------------------- IMPORT MINDMAP --------------------------- */
function ImportMindmap() {
  const { id } = useParams();
  const navigate = useNavigate();
  // SỬA: Lấy thêm 'setLoaded' và 'setCurrentMindmapId' từ store
  const { loadState, setLoaded, setCurrentMindmapId } = useStore(); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // SỬA: Đổi tên hàm và logic bên trong
  const fetchAndLoadMindmap = useCallback(async () => {
    try {
      setLoading(true);
      if (setLoaded) setLoaded(false); // Báo là đang tải
      
      const res = await fetch(`http://localhost:3000/mindmaps/${id}/json`, { credentials: 'include' });
      if (!res.ok) throw new Error('Không thể tải nội dung mindmap từ server');
      
      const data = await res.json();
      if (!data.success || !data.data) throw new Error('Dữ liệu trả về không hợp lệ');

      let nodes, edges;
      // KIỂM TRA: Ưu tiên dùng nodes/edges nếu đã có trong CSDL
      if (data.data.nodes && data.data.nodes.length > 0) {
        nodes = data.data.nodes;
        edges = data.data.edges || [];
      } else {
        // Nếu không, chuyển đổi từ markdown
        const markdownText = data.data.content;
        const result = markdownToMindmap(markdownText);
        nodes = result.nodes;
        edges = result.edges;
      }
      
      loadState({ nodes, edges }); // Tải state
      if (setCurrentMindmapId) setCurrentMindmapId(id); // Set ID
      if (setLoaded) setLoaded(true); // Báo đã tải xong

      setLoading(false);
      
      // SỬA: Chuyển hướng đến /editor/:id
      setTimeout(() => navigate(`/editor/${id}`), 300);

    } catch (err) {
      console.error('Error loading mindmap:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [id, loadState, navigate, setLoaded, setCurrentMindmapId]);

  useEffect(() => {
    fetchAndLoadMindmap();
  }, [fetchAndLoadMindmap]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.icon}>🗺️</div>
        {/* SỬA: Đổi text */}
        <h2>Đang tải Mindmap...</h2>
        <p style={{ opacity: 0.8 }}>Vui lòng đợi trong giây lát</p>
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
          {/* SỬA: Bỏ nút "Tạo Mindmap Mới" vì không hợp lý */}
          <button onClick={() => window.location.reload()} style={styles.btnSecondary}>
            Thử Lại
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/* --------------------------- CYTOSCAPE VIEWER (Giữ nguyên) --------------------------- */
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
        {/* SỬA: Route cho editor giờ phải có :id */}
        <Route path="/editor/:id" element={<MindmapEditor />} />
        
        {/* Các route cũ */}
        <Route path="/import/:id" element={<ImportMindmap />} />
        <Route path="/cyto/:id" element={<CytoscapeViewer />} />
        
        {/* THÊM: Route dự phòng, chuyển hướng về dashboard (bên Pug) */}
        <Route path="/" element={<EditorFallback />} />
        <Route path="/editor" element={<EditorFallback />} />
      </Routes>
    </BrowserRouter>
  );
}

// THÊM: Component Fallback để chuyển hướng
function EditorFallback() {
  useEffect(() => {
    // Chuyển hướng về trang dashboard chính (bên Pug)
    window.location.href = '/dashboard';
  }, []);

  return (
    <div style={styles.loadingContainer}>
      <div style={styles.icon}>🧭</div>
      <h2>Đang chuyển hướng...</h2>
      <p style={{ opacity: 0.8 }}>Vui lòng chọn một mindmap từ dashboard.</p>
    </div>
  );
}


/* --------------------------- STYLES (Giữ nguyên) --------------------------- */
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
