import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useStore } from '../store/store';
import {
  SaveOutlined,
  FolderOpenOutlined,
  CameraOutlined,
  ApartmentOutlined,
  UndoOutlined,
  RedoOutlined,
  SearchOutlined,
  DeleteOutlined,
  EditOutlined,       // Dùng cho "Chế độ Canvas"
  BorderOutlined,     // Dùng cho "Tạo Vùng Vẽ" (MỚI)
  AimOutlined,        // Dùng cho "Trỏ chuột" (MỚI)
  HighlightOutlined,  // Dùng cho "Highlight" (Chuyển từ DrawAreaToolbar)
  ClearOutlined,      // Dùng cho "Tẩy" (Chuyển từ DrawAreaToolbar)
} from '@ant-design/icons';
import { toPng } from 'html-to-image';
import { AutoComplete, message } from 'antd';
import { useReactFlow } from '@xyflow/react';
// ✨ XÓA: Import không dùng đến
// import DrawAreaToolbar from './DrawAreaToolbar'; 

// --- (Các icon SVG cho Thêm Node) ---
const OvalIcon = () => <svg width="24" height="24" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="22" height="14" rx="7" stroke="currentColor" strokeWidth="2" /></svg>;
const SquareIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" /></svg>;
const CircleIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" /></svg>;
// --- Hết Icon ---
// ✨ CHUYỂN VÀO TỪ DrawAreaToolbar.jsx
// Preset cho VẼ
const DRAW_PRESETS = [
  { name: 'Mỏng', color: '#000000', settings: { mode: 'draw', color: '#000000', thickness: 2, opacity: 1 } },
  { name: 'Vừa', color: '#FE6464', settings: { mode: 'draw', color: '#FE6464', thickness: 5, opacity: 1 } },
  { name: 'Dày', color: '#2DC75C', settings: { mode: 'draw', color: '#2DC75C', thickness: 10, opacity: 1 } },
];
// Preset cho HIGHLIGHT
const HIGHLIGHT_PRESETS = [
  { name: 'Vàng', color: '#FFEDA4', settings: { mode: 'highlight', color: '#FFEDA4', thickness: 20, opacity: 0.5 } },
  { name: 'Hồng', color: '#FFB1B1', settings: { mode: 'highlight', color: '#FFB1B1', thickness: 20, opacity: 0.5 } },
  { name: 'Lục', color: '#96E3AD', settings: { mode: 'highlight', color: '#96E3AD', thickness: 20, opacity: 0.5 } },
];
// Preset cho Tẩy
const ERASE_TOOL = { mode: 'erase', color: '#FFFFFF', thickness: 20, opacity: 1 };
// Preset cho Trỏ chuột
const CURSOR_TOOL = { mode: 'cursor' };
// --- HẾT CHUYỂN ---

const VerticalToolbar = () => {
  const {
    addNode,
    loadState,
    nodes,
    runAutoLayout,
    isSearchVisible,
    toggleSearchVisible,
    deleteElements,
    selectedNodeIds,
    selectedEdgeId,
    appMode,      // ✨ 1. Lấy state mode
    setAppMode,   // ✨ 2. Lấy action đổi mode
    currentDrawTool,
    setCurrentDrawTool,
  } = useStore();

  const { fitView } = useReactFlow();
  const [isPickerVisible, setPickerVisible] = useState(false);
  const fileInputRef = useRef(null);

  // --- (Logic zundo/temporal state giữ nguyên) ---
  const { undo, redo } = useStore.temporal;
  const [temporalState, setTemporalState] = useState(
    useStore.temporal.getState()
  );
  useEffect(() => {
    const unsubscribe = useStore.temporal.subscribe(setTemporalState);
    return () => unsubscribe();
  }, []);
  const { pastStates = [], futureStates = [] } = temporalState;
  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;
  // ---

  const canDelete = (appMode === 'normal' && (selectedNodeIds.length > 0 || !!selectedEdgeId)) ||
    (appMode === 'canvasMode' && selectedNodeIds.length > 0);

  // --- (Tất cả các hàm handle... giữ nguyên) ---
  const handleAddNode = (shape) => {
    // ... (giữ nguyên)
    let style = {};
    if (shape === 'oval') style.borderRadius = '50px';
    if (shape === 'circle') style.borderRadius = '50%';
    if (shape === 'square') style.borderRadius = '10px';
    addNode(style);
    setPickerVisible(false);
  };
  const handleSave = (e) => {
    // ... (giữ nguyên)
    e.stopPropagation();
    const { nodes, edges } = useStore.getState();
    const stateToSave = { nodes, edges };
    const jsonString = JSON.stringify(stateToSave, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindmap.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Đã lưu sơ đồ!');
  };
  const handleLoadClick = (e) => { e.stopPropagation(); fileInputRef.current?.click(); };
  const handleFileChange = (event) => {
    // ... (giữ nguyên)
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text === 'string') {
          const parsedState = JSON.parse(text);
          loadState(parsedState);
          message.success('Tải sơ đồ thành công!');
        }
      } catch (err) {
        console.error("Error parsing JSON file:", err);
        message.error("Lỗi: File JSON không hợp lệ.");
      }
    };
    reader.readAsText(file);
    event.target.value = null;
  };
  const handleExportPNG = () => {
    // ... (giữ nguyên)
    const viewport = document.querySelector(' .react-flow__viewport');
    if (!viewport) {
      message.error('Không tìm thấy sơ đồ để xuất ảnh!');
      return;
    }
    const key = 'exporting-png';
    message.loading({ content: 'Đang xuất PNG...', key });
    toPng(viewport, {
      backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-primary') || '#f8f9fa',
      filter: (node) => (
        node.className ?
          !String(node.className).includes('react-flow__controls') &&
          !String(node.className).includes('react-flow__minimap') &&
          !String(node.className).includes('dark-mode-toggle') &&
          !String(node.className).includes('zoom-toolbar')
          : true
      ),
    }).then((dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'mindmap.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      message.success({ content: 'Xuất ảnh PNG thành công!', key, duration: 2 });
    }).catch((err) => {
      console.error('Lỗi khi xuất ảnh:', err);
      message.error({ content: 'Đã xảy ra lỗi khi xuất ảnh.', key, duration: 2 });
    });
  };
  const searchOptions = useMemo(() => { return nodes.map((node) => ({ value: node.id, label: node.data.label || '(Node không tên)', })); }, [nodes]);
  const onSearchSelect = (nodeId) => { fitView({ nodes: [{ id: nodeId }], duration: 300, maxZoom: 1.2, }); };
  // ✨ SỬA: Hàm này giờ BẬT/TẮT Chế độ Canvas
  const handleToggleCanvasMode = () => {
    setAppMode(appMode === 'canvasMode' ? 'normal' : 'canvasMode');
  };
  // ✨ THÊM: Hàm này BẬT/TẮT Chế độ Tạo Vùng
  const handleToggleCreateAreaMode = () => {
    setAppMode(appMode === 'creatingDrawArea' ? 'normal' : 'creatingDrawArea');
  };
  // --- Hết Hàm ---
  
  // --- Hết Hàm ---


  return (
    <>
      <div
        className="vertical-toolbar"
      >
        <div
          className="add-node-wrapper"
          onMouseEnter={() => setPickerVisible(true)}
          onMouseLeave={() => setPickerVisible(false)}
        >
          <button title="Thêm Node">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M11 13H5v-2h6V5h2v6h6v2h-6v6h-2z" /></svg>
          </button>

          {isPickerVisible && (
            <div className="shape-picker">
              <button onClick={() => handleAddNode('oval')} title="Hình Oval"><OvalIcon /></button>
              <button onClick={() => handleAddNode('square')} title="Hình Vuông"><SquareIcon /></button>
              <button onClick={() => handleAddNode('circle')} title="Hình Tròn"><CircleIcon /></button>
            </div>
          )}
        </div>

        <button
          onClick={handleToggleCanvasMode}
          className={appMode === 'canvasMode' ? 'active' : ''}
          title={appMode === 'canvasMode' ? "Thoát chế độ Canvas" : "Bật chế độ Canvas"}
        >
          <EditOutlined />
        </button>
        
        {/* ✨ THÊM: Thanh công cụ Canvas Toàn cục */}
        {appMode === 'canvasMode' && (
          <div className="draw-toolbar-global">
            {/* Nút Trỏ chuột */}
            <button
              className={currentDrawTool.mode === 'cursor' ? 'active' : ''}
              onClick={() => setCurrentDrawTool(CURSOR_TOOL)}
              title="Con trỏ (Chọn/Di chuyển Canvas)"
            >
              <AimOutlined />
            </button>
            <div className="divider" />
            
            {/* Nút Vẽ + Presets */}
            {DRAW_PRESETS.map(p => (
              <button
                key={p.name}
                className={`preset-button ${currentDrawTool.mode === 'draw' && currentDrawTool.color === p.color ? 'active' : ''}`}
                title={`Vẽ (${p.name})`}
                onClick={() => setCurrentDrawTool(p.settings)}
              >
                <div 
                  className="preset-swatch"
                  style={{ 
                    backgroundColor: p.color,
                    height: `${p.settings.thickness + 4}px`, 
                    width: `${p.settings.thickness + 4}px`, 
                  }} 
                />
              </button>
            ))}
            <div className="divider" />

            {/* Nút Highlight + Presets */}
            {HIGHLIGHT_PRESETS.map(p => (
              <button
                key={p.name}
                className={`preset-button ${currentDrawTool.mode === 'highlight' && currentDrawTool.color === p.color ? 'active' : ''}`}
                title={`Highlight (${p.name})`}
                onClick={() => setCurrentDrawTool(p.settings)}
              >
                <div 
                  className="preset-swatch"
                  style={{ backgroundColor: p.color, opacity: 0.7 }} 
                />
              </button>
            ))}
            <div className="divider" />

            {/* Nút Tẩy */}
            <button
              className={currentDrawTool.mode === 'erase' ? 'active' : ''}
              onClick={() => setCurrentDrawTool(ERASE_TOOL)}
              title="Tẩy"
            >
              <ClearOutlined />
            </button>
          </div>
        )}
        
        {/* ✨ XÓA: Khối 'editingCanvas' và DrawAreaToolbar đã bị loại bỏ */}
        {/* ✨ XÓA: Khối 'draw-toolbar-global' bị trùng lặp đã bị loại bỏ */}

        <button onClick={handleSave} title="Lưu Sơ Đồ (JSON)"> <SaveOutlined /> </button>
        <button onClick={handleLoadClick} title="Tải Sơ Đồ (JSON)"> <FolderOpenOutlined /> </button>
        <button onClick={handleExportPNG} title="Xuất ra ảnh PNG"> <CameraOutlined /> </button>
        <button onClick={runAutoLayout} title="Tự động sắp xếp"> <ApartmentOutlined /> </button>

        <button
          onClick={toggleSearchVisible}
          className={isSearchVisible ? 'active' : ''}
          title="Tìm kiếm Node"
        >
          <SearchOutlined />
        </button>
        {/* ✨ THÊM: Nút tạo vùng vẽ (kéo thả) */}
        <button
          onClick={handleToggleCreateAreaMode}
          className={appMode === 'creatingDrawArea' ? 'active' : ''}
          title={appMode === 'creatingDrawArea' ? "Hủy tạo vùng" : "Tạo Vùng Vẽ (Kéo thả)"}
        >
          <BorderOutlined />
        </button>
        

        {/* ✨ KIỂM TRA LẠI NÚT DELETE */}
        <button
          onClick={deleteElements} // Gọi đúng action
          disabled={!canDelete}    // Dùng đúng biến cờ
          title="Xóa"
        >
          <DeleteOutlined />
        </button>

        <button onClick={undo} disabled={!canUndo} title="Hoàn tác"> <UndoOutlined /> </button>
        <button onClick={redo} disabled={!canRedo} title="Làm lại"> <RedoOutlined /> </button>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="application/json"
          onChange={handleFileChange}
        />

        {isSearchVisible && (
          <div className="search-toolbar">
            <AutoComplete
              style={{ width: 180 }}
              options={searchOptions}
              placeholder="Tìm kiếm node..."
              filterOption={(inputValue, option) =>
                option.label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
              }
              onSelect={onSearchSelect}
              allowClear
            />
          </div>
        )}
      </div>
    </>
  );
};

export default VerticalToolbar;