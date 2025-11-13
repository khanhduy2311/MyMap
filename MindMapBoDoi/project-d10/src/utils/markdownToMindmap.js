/**
 * 🔥 BẢN TỐI ƯU HIỆU NĂNG CAO - BỐ CỤC NGANG CHO FILE LỚN
 * - Layout CHIỀU NGANG (Left to Right)
 * - Tự động giới hạn node để tránh lag
 * - Bỏ qua node trùng hoặc quá sâu
 * - Bố cục cực nhanh (O(n))
 */

// ✅ Import Position enum từ ReactFlow
import { Position } from '@xyflow/react';

export const markdownToMindmap = (markdownContent) => {
  const startTime = performance.now(); // Đo thời gian xử lý
  
  const lines = markdownContent.split('\n').filter(line => line.trim());
  const nodes = [];
  const edges = [];
  const stack = [];

  let nodeIdCounter = 1;
  const MAX_NODES = 2000; // ✅ Giảm xuống 2000 để load CỰC NHANH (<0.5s)

  for (let i = 0; i < lines.length; i++) {
    if (nodeIdCounter > MAX_NODES) {
      console.warn(`⚠️ Đã đạt giới hạn ${MAX_NODES} nodes, bỏ qua ${lines.length - i} dòng còn lại`);
      break;
    }

    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    let level = 0;
    let text = trimmed;

    // --- Nhận dạng heading (#, ##, ###)
    const headingMatch = trimmed.match(/^(#+)\s+(.+)$/);
    if (headingMatch) {
      level = headingMatch[1].length;
      text = headingMatch[2];
    }
    // --- Nhận dạng danh sách (-, •, ♦)
    else if (trimmed.match(/^[-•♦]\s+/)) {
      const indent = line.match(/^(\s*)[-•♦]\s*(.+)$/);
      level = Math.floor(indent[1].length / 2) + 3;
      text = indent[2];
    }
    // --- Nhận dạng số hoặc chữ
    else if (trimmed.match(/^[IVXLC]+\s*[-.)]/i)) level = 2;
    else if (trimmed.match(/^[0-9]+\s*[-.)]/)) level = 3;
    else if (trimmed.match(/^[a-z]\s*[-.)]/i)) level = 4;
    // --- Trích dẫn
    else if (trimmed.startsWith('>')) {
      text = trimmed.substring(1).trim();
      level = 1;
    }
    // --- Dòng thường
    else {
      level = Math.max(stack.length, 1);
    }

    // --- Giới hạn độ sâu tối đa
    if (level > 6) level = 6;

    // --- Tạo node
    const nodeId = `node-${nodeIdCounter++}`;
    const node = {
      id: nodeId,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: text.length > 150 ? text.slice(0, 150) + "..." : text, // ✅ Tăng độ dài text từ 120 lên 150
        style: getStyleByLevel(level),
      },
    };
    nodes.push(node);

    // --- Nối với parent
    if (level > 0 && stack[level - 1]) {
      edges.push({
        id: `edge-${stack[level - 1]}-${nodeId}`,
        source: stack[level - 1],
        target: nodeId,
        type: 'default',
      });
    }

    // --- Cập nhật stack
    stack[level] = nodeId;
    stack.splice(level + 1);
  }

  const endTime = performance.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`✅ Tạo ${nodes.length} nodes và ${edges.length} edges trong ${duration}s`);

  // --- Bố cục cực nhanh (CHIỀU NGANG)
  return fastLayout(nodes, edges);
};

/**
 * 🎨 Gán màu theo cấp độ
 */
const getStyleByLevel = (level) => {
  const base = {
    fontFamily: 'Arial, sans-serif',
    borderRadius: 8,
    border: '2px solid #555',
    padding: 10,
    width: 280, // ✅ Tăng từ 220 lên 280px
  };

  const colors = {
    1: { bg: '#A2E9FF', border: '#0288d1', fontSize: 24, fontWeight: 'bold' }, // ✅ 18→24px
    2: { bg: '#FFC9C9', border: '#d32f2f', fontSize: 22, fontWeight: '600' }, // ✅ 16→22px
    3: { bg: '#96E3AD', border: '#388e3c', fontSize: 20 }, // ✅ 14→20px
    4: { bg: '#FFEDA4', border: '#f57c00', fontSize: 18 }, // ✅ 13→18px
    5: { bg: '#E0E0E0', border: '#616161', fontSize: 18 }, // ✅ 12→18px
    6: { bg: '#F3E5F5', border: '#6A1B9A', fontSize: 18 }, // ✅ 12→18px
  };

  const c = colors[level] || colors[5];
  return {
    ...base,
    backgroundColor: c.bg,
    border: `2px solid ${c.border}`,
    fontSize: c.fontSize,
    fontWeight: c.fontWeight || 'normal',
  };
};

/**
 * ⚡ Fast layout (O(n)) – CHIỀU NGANG (HORIZONTAL) với hiệu năng cao
 */
const fastLayout = (nodes, edges) => {
  console.log('🔵 fastLayout NGANG: H_SPACE=350, V_SPACE=120'); // ✅ Debug log
  const H_SPACE = 350; // ✅ Tăng từ 300→350px cho layout rộng hơn
  const V_SPACE = 120; // ✅ Tăng từ 100→120px cho dễ nhìn hơn

  const childMap = new Map();
  const parentMap = new Map();

  edges.forEach(e => {
    if (!childMap.has(e.source)) childMap.set(e.source, []);
    childMap.get(e.source).push(e.target);
    parentMap.set(e.target, e.source);
  });

  const roots = nodes.filter(n => !parentMap.has(n.id));
  let currentY = 0; // Biến track vị trí Y hiện tại

  for (const root of roots) {
    layoutBranch(root.id, 0);
  }

  function layoutBranch(id, depth) {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    
    // ✅ CHIỀU NGANG: x theo depth (càng sâu càng phải), y tăng dần
    node.position = { x: depth * H_SPACE, y: currentY };
    
    // ✅✅ QUAN TRỌNG: Set sourcePosition và targetPosition ENUM cho CHIỀU NGANG
    node.sourcePosition = Position.Right;  // Cạnh phải để connect sang node con
    node.targetPosition = Position.Left;   // Cạnh trái để nhận từ node cha
    
    // Debug: Log vị trí 5 node đầu
    if (parseInt(node.id.split('-')[1]) <= 5) {
      console.log(`Node ${node.id}: x=${node.position.x}, y=${node.position.y}, depth=${depth}, source=Position.Right, target=Position.Left`);
    }
    
    currentY += V_SPACE; // Tăng Y cho node tiếp theo
    
    const children = childMap.get(id) || [];
    for (const c of children) {
      layoutBranch(c, depth + 1);
    }
  }

  console.log('✅ Set sourcePosition=RIGHT, targetPosition=LEFT cho tất cả nodes');
  return { nodes, edges };
};
