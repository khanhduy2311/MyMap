import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer, useStoreApi } from '@xyflow/react';
import { useStore } from '../store/store';

/**
 * Component Node Vùng Vẽ
 * Chứa 1 canvas để vẽ, 1 thanh công cụ, và 1 resizer.
 */
function DrawAreaNode({ id, data, selected }) {
    // ✨ Lấy state/action toàn cục (không cần activeDrawAreaId nữa)
    const {
        updateNodeData,
        updateNodeSize,
        setNodeDraggable,
        appMode,
        // setAppMode, (Không dùng ở đây)
        // activeDrawAreaId, (Không dùng ở đây)
        currentDrawTool,    
        // setCurrentDrawTool, (Không dùng ở đây)
        // setActiveDrawArea,  (Không dùng ở đây)
    } = useStore();
    const store = useStoreApi();

    const canvasRef = useRef(null);
    const isDrawing = useRef(false);
    const lastPos = useRef(null);
    
    const [isHovered, setIsHovered] = useState(false);

    const nodeStyle = data.style || {};
    const width = nodeStyle.width || 400;
    const height = nodeStyle.height || 300;

    // --- Logic Vẽ ---

    // 1. Hook (re)draw canvas (Giữ nguyên)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        if (data.drawing) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
            img.src = data.drawing;
        }
    }, [width, height, data.drawing]);

    // 2. Lấy tọa độ chuột (Giữ nguyên)
    const getCanvasPos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const { transform } = store.getState();
        const zoom = transform[2];

        return {
            x: (e.clientX - rect.left) / zoom,
            y: (e.clientY - rect.top) / zoom,
        };
    };

    // 3. Bắt đầu vẽ (✨ SỬA: Bỏ check activeDrawAreaId)
    const handleMouseDown = (e) => {
        if (e.button === 2) {
            return;
        }
        // Chỉ cần kiểm tra mode và công cụ
        if (appMode !== 'canvasMode' || currentDrawTool.mode === 'cursor') {
            return;
        }
        
        isDrawing.current = true;
        lastPos.current = getCanvasPos(e);
        e.stopPropagation(); 
    };

    // 4. Đang vẽ (✨ SỬA: Bỏ check activeDrawAreaId)
    const handleMouseMove = (e) => {
        if (!isDrawing.current || appMode !== 'canvasMode') return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const pos = getCanvasPos(e);
        ctx.strokeStyle = currentDrawTool.color;
        ctx.lineWidth = currentDrawTool.thickness;
        ctx.globalAlpha = currentDrawTool.opacity;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (currentDrawTool.mode === 'erase') {
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPos.current = pos;
    };

    // 5. Kết thúc vẽ (✨ SỬA: Bỏ check activeDrawAreaId)
    const handleMouseUp = () => {
        if (!isDrawing.current || appMode !== 'canvasMode') return;
        isDrawing.current = false;
        lastPos.current = null;
        const dataUrl = canvasRef.current.toDataURL();
        updateNodeData(id, { drawing: dataUrl });
    };

    // --- Logic Resizing (Giữ nguyên) ---
    const handleResizeStart = () => {
        setNodeDraggable(id, false);
    };

    const handleResizeStop = (event, params) => {
        setNodeDraggable(id, true);
        updateNodeSize(id, { width: params.width, height: params.height });
    };
    
    // ✨ XÓA: Hàm handleDoubleClick (không còn cần thiết)
    
    // Cập nhật Draggable (Giữ nguyên)
    useEffect(() => {
      const isDraggable = (appMode === 'canvasMode' && currentDrawTool.mode === 'cursor');
      setNodeDraggable(id, isDraggable);
    }, [appMode, currentDrawTool.mode, id, setNodeDraggable]); 
    
    // ✨ SỬA: Con trỏ tùy chỉnh (không dùng activeDrawAreaId)
    const getCursor = () => {
      if (appMode !== 'canvasMode') return 'not-allowed';
      if (currentDrawTool.mode === 'cursor') return 'grab';
      // Nếu đang dùng tool vẽ/tẩy, hiện crosshair
      if (currentDrawTool.mode === 'draw' || currentDrawTool.mode === 'highlight' || currentDrawTool.mode === 'erase') {
        return 'crosshair';
      }
      return 'default'; // Trường hợp dự phòng
    };

    return (
        <div
            className={`draw-area-node-wrapper ${selected ? 'selected' : ''} ${isHovered && appMode === 'canvasMode' && currentDrawTool.mode === 'cursor' ? 'hoverable' : ''}`}
            style={{ 
              width, 
              height,
              cursor: getCursor(), 
              pointerEvents: appMode === 'canvasMode' ? 'auto' : 'none'
            }}
            // ✨ XÓA: onDoubleClick={handleDoubleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <NodeResizer
                isVisible={selected && appMode === 'canvasMode' && currentDrawTool.mode === 'cursor'}
                minWidth={100}
                minHeight={100}
                onResizeStart={handleResizeStart}
                onResizeStop={handleResizeStop}
                keepAspectRatio={false}
                handleClassName="node-resizer-handle"
                lineClassName="node-resizer-line"
            />

            <canvas
                ref={canvasRef}
                className="draw-area-canvas"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ 
                    cursor: 'inherit',
                    // Đảm bảo tuân thủ CSS fix (nếu có)
                    pointerEvents: 'inherit' 
                }} 
            />

            <Handle 
                type="target" 
                position={Position.Left} 
                style={{ 
                    opacity: 0,
                    // Đảm bảo tuân thủ CSS fix (nếu có)
                    pointerEvents: 'inherit' 
                }} 
            />
            <Handle 
                type= "source" 
                position= {Position.Right} 
                style= {{ 
                    opacity: 0,
                    // Đảm bảo tuân thủ CSS fix (nếu có)
                    pointerEvents: 'inherit' 
                }} 
            />
        </div>
    );
}

// ✨ XÓA: Hằng số DRAW_PRESETS (không còn dùng trong file này)

export default memo(DrawAreaNode);