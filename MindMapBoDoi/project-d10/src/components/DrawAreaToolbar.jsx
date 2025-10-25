import React from 'react';
import { NodeToolbar } from '@xyflow/react';
import { BorderOutlined, HighlightOutlined, ClearOutlined } from '@ant-design/icons';

// --- Định nghĩa các Preset ---

// Preset cho VẼ
const DRAW_PRESETS = [
  // 1. Mỏng, Đen
  { 
    name: 'Mỏng', 
    color: '#000000', 
    settings: { mode: 'draw', color: '#000000', thickness: 2, opacity: 1 } 
  },
  // 2. Trung bình, Đỏ
  { 
    name: 'Vừa', 
    color: '#FE6464', 
    settings: { mode: 'draw', color: '#FE6464', thickness: 5, opacity: 1 } 
  },
  // 3. Dày, Lục
  { 
    name: 'Dày', 
    color: '#2DC75C', 
    settings: { mode: 'draw', color: '#2DC75C', thickness: 10, opacity: 1 } 
  },
];

// Preset cho HIGHLIGHT
const HIGHLIGHT_PRESETS = [
  // 1. Vàng
  { 
    name: 'Vàng', 
    color: '#FFEDA4', 
    settings: { mode: 'highlight', color: '#FFEDA4', thickness: 20, opacity: 0.5 } 
  },
  // 2. Hồng
  { 
    name: 'Hồng', 
    color: '#FFB1B1', 
    settings: { mode: 'highlight', color: '#FFB1B1', thickness: 20, opacity: 0.5 } 
  },
  // 3. Lục
  { 
    name: 'Lục', 
    color: '#96E3AD', 
    settings: { mode: 'highlight', color: '#96E3AD', thickness: 20, opacity: 0.5 } 
  },
];

// Preset cho Tẩy
const ERASE_TOOL = { 
  mode: 'erase', 
  color: '#FFFFFF', // Màu này không quan trọng
  thickness: 20, // Độ dày cục tẩy
  opacity: 1 
};


const DrawAreaToolbar = ({ nodeId, isVisible, currentTool, onSetTool }) => {
  const currentMode = currentTool.mode;

  return (
    <NodeToolbar
      nodeId={nodeId}
      position="top"
      isVisible={isVisible}
    >
      <div
        className="draw-toolbar"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {/* === Nút Chuyển Chế Độ === */}
        <button
          className={currentMode === 'draw' ? 'active' : ''}
          onClick={() => onSetTool(DRAW_PRESETS[0].settings)} // Chuyển về preset đầu tiên
          title="Vẽ"
        >
          <BorderOutlined />
        </button>
        <button
          className={currentMode === 'highlight' ? 'active' : ''}
          onClick={() => onSetTool(HIGHLIGHT_PRESETS[0].settings)} // Chuyển về preset đầu tiên
          title="Highlight"
        >
          <HighlightOutlined />
        </button>
        <button
          className={currentMode === 'erase' ? 'active' : ''}
          onClick={() => onSetTool(ERASE_TOOL)}
          title="Tẩy"
        >
          <ClearOutlined />
        </button>
        
        <div className="divider" />
        
        {/* === Các Nút Preset === */}
        
        {/* Hiển thị Preset VẼ */}
        {currentMode === 'draw' && DRAW_PRESETS.map(p => (
          <button
            key={p.name}
            className={`preset-button ${currentTool.color === p.color ? 'active' : ''}`}
            title={p.name}
            onClick={() => onSetTool(p.settings)}
          >
            <div 
              className="preset-swatch"
              style={{ 
                backgroundColor: p.color,
                // Mô phỏng độ dày
                height: `${p.settings.thickness + 2}px`, 
                width: `${p.settings.thickness + 2}px`, 
              }} 
            />
          </button>
        ))}
        
        {/* Hiển thị Preset HIGHLIGHT */}
        {currentMode === 'highlight' && HIGHLIGHT_PRESETS.map(p => (
          <button
            key={p.name}
            className={`preset-button ${currentTool.color === p.color ? 'active' : ''}`}
            title={p.name}
            onClick={() => onSetTool(p.settings)}
          >
            <div 
              className="preset-swatch"
              style={{ backgroundColor: p.color, opacity: 0.7 }} 
            />
          </button>
        ))}

        {/* Thông báo khi đang Tẩy */}
        {currentMode === 'erase' && (
          <span className="erase-label">Đang ở chế độ Tẩy</span>
        )}
      </div>
    </NodeToolbar>
  );
};

export default DrawAreaToolbar;