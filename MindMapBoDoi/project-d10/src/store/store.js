import { create } from 'zustand'
import { temporal } from 'zundo'
import { devtools } from 'zustand/middleware'
import dagre from 'dagre'
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  // ✨ 1. Import thêm `getConnectedEdges`
  getConnectedEdges,
} from '@xyflow/react'

// --- (Default Styles, Initial State, ID Generation, Layout... giữ nguyên) ---
// --- Default Styles ---
const defaultNodeStyle = {
  backgroundColor: '#fff',
  color: '#000',
  fontFamily: 'Arial',
  fontSize: 14,
  borderRadius: '8px',
  fontWeight: 'normal',
  fontStyle: 'normal',
  border: '3px solid #555',
  width: 180,
  height: 'auto',
  opacity: 1,
  lineHeight: '1.2',
  backgroundOpacity: 1,
}

// --- Initial State ---
const initialNodes = [
  {
    id: '1',
    type: 'custom',
    position: { x: 0, y: 0 },
    draggable: true,
    selectable: true, // ✨ THÊM: Mặc định
    data: {
      label: 'Node Đầu Tiên',
      style: { ...defaultNodeStyle, backgroundColor: '#a2e9ff' },
    },
  },
]

// --- ID Generation Helper ---
const getNextId = (nodes) => {
  if (!nodes || nodes.length === 0) return '1'
  const numericIds = nodes.map(n => parseInt(n.id, 10)).filter(id => !isNaN(id))
  if (numericIds.length === 0) return '1'
  const maxId = Math.max(...numericIds)
  return (maxId + 1).toString()
}

// --- HÀM LAYOUT (Phiên bản LR đơn giản, hoạt động 100%) ---
const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  const isHorizontal = direction === 'LR'
  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 150 })

  nodes.forEach((node) => {
    // ✨ SỬA: Đọc width/height từ data.style HOẶC data
    const w = node.data.style?.width || node.data.width || 180;
    const h = node.data.style?.height || node.data.height || 50;
    const nodeWidth = parseInt(w, 10);
    const nodeHeight = parseInt(h, 10);
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    // ✨ SỬA: Đọc width/height từ data.style HOẶC data
    const w = node.data.style?.width || node.data.width || 180;
    const h = node.data.style?.height || node.data.height || 50;
    const nodeWidth = parseInt(w, 10);
    const nodeHeight = parseInt(h, 10);

    return {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      draggable: true, 
      selectable: true, // ✨ THÊM: Đảm bảo layout xong vẫn chọn được
    }
  })

  return { nodes: layoutedNodes, edges }
}

// Clipboard bên ngoài store
let clipboard = [];

// --- Store Creator ---
const storeCreator = (set, get) => ({
  nodes: initialNodes,
  edges: [],
  selectedNodeId: null, 
  isMiniMapVisible: false,
  needsFitView: false,
  isSearchVisible: false, 
  selectedEdgeId: null,
  selectedNodeIds: [], 
  darkMode: false,     
  edgeToolbarPosition: null,
  backgroundVariant: 'cross', 
  patternColor: '#ccc', 
  appMode: 'normal', 
  activeDrawAreaId: null,
  currentDrawTool: { mode: 'cursor' }, 

  // --- (Các hàm handler cũ: onNodesChange, onEdgesChange... giữ nguyên) ---
  onNodesChange: (changes) => {
    const { nodes } = get()
    let nextNodes = applyNodeChanges(changes, nodes)
    
    const selectionChange = changes.find(c => c.type === 'select');
    if (selectionChange) {
      const newSelectedNodeIds = nextNodes
        .filter(n => n.selected)
        .map(n => n.id);
      set({ selectedNodeIds: newSelectedNodeIds });
    }
    
    set({ nodes: nextNodes })
  },
onEdgesChange: (changes) => {
    const nextEdges = applyEdgeChanges(changes, get().edges);
    
    const selectionChange = changes.find(c => c.type === 'select' && c.selected === false);
    if (selectionChange) {
      set({ selectedEdgeId: null, edgeToolbarPosition: null });
    }
    set({ edges: nextEdges });
  },  onConnect: (connection) => {
    const newEdge = {
      ...connection,
      type: 'default', 
      animated: false,
      style: { strokeWidth: 2, stroke: '#888' },
      label: '',
      labelBgStyle: { fill: '#fff', fillOpacity: 0.7 },
      labelStyle: { fontSize: 12, fontWeight: 500 },
    }
    set({ edges: addEdge(newEdge, get().edges) })
  },

  // --- (Các hàm UI control cũ: loadState, setSelectedNodeId... giữ nguyên) ---
  loadState: (newState) => {
    if (newState && Array.isArray(newState.nodes) && Array.isArray(newState.edges)) {
      set({
        nodes: newState.nodes,
        edges: newState.edges,
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedNodeIds: [], 
        needsFitView: true,
      })
    } else {
      console.error('Failed to load invalid state:', newState)
      alert('Không thể tải file: Dữ liệu không hợp lệ.')
    }
  },
  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }), 
  toggleMiniMap: () => set((state) => ({ isMiniMapVisible: !state.isMiniMapVisible })),
  setNeedsFitView: (value) => set({ needsFitView: value }),
  toggleSearchVisible: () => set((state) => ({ isSearchVisible: !state.isSearchVisible })),
setSelectedEdgeId: (edgeId, position = null) => {
    set({
      selectedEdgeId: edgeId,
      edgeToolbarPosition: position,
      edges: get().edges.map(e => ({
        ...e,
        selected: e.id === edgeId
      }))
    });
  },  
setSelectedNodeIds: (ids) => {
    set({
      selectedNodeIds: ids,
      nodes: get().nodes.map(node => ({
        ...node,
        selected: ids.includes(node.id)
      }))
    });
  },  
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setBackgroundVariant: (variant) => set({ backgroundVariant: variant }),
  setPatternColor: (color) => set({ patternColor: color }),
 
  // ✨ SỬA: Cập nhật `draggable` VÀ `selectable` của node khi đổi mode
  setAppMode: (mode) => {
      let nextTool = { mode: 'cursor' }; 
      let nextActiveId = null; 

      if (mode === 'canvasMode') {
          nextTool = { mode: 'cursor' };
      }
      
      const nextNodes = get().nodes.map(n => {
        // Cập nhật 'custom' nodes
        if (n.type === 'custom') {
          return { 
            ...n, 
            draggable: mode === 'normal', // Chỉ kéo được ở 'normal'
            selectable: mode === 'normal' // ✨ Chỉ chọn được ở 'normal'
          };
        }
        // Cập nhật 'drawArea' nodes
        if (n.type === 'drawArea') {
           return { 
             ...n, 
             draggable: mode === 'canvasMode', // (sẽ bị useEffect ghi đè)
             selectable: mode === 'canvasMode' // ✨ Chỉ chọn được ở 'canvasMode'
           };
        }
        return n;
      });
      
      set({
          appMode: mode,
          currentDrawTool: nextTool,
          activeDrawAreaId: nextActiveId,
          nodes: nextNodes, // ✨ Áp dụng node mới
      });
   },
   // (Các hàm khác giữ nguyên)
  setCurrentDrawTool: (tool) => {
     const nextActiveId = (tool.mode === 'cursor') ? null : get().activeDrawAreaId;
     set({ 
       currentDrawTool: tool,
       activeDrawAreaId: nextActiveId 
     });
   },
   setActiveDrawArea: (id) => {
     set({ activeDrawAreaId: id });
   },
  setNodeDraggable: (nodeId, draggable) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, draggable } : node
      ),
    })
  },
  
  // --- Node Actions ---
  addNode: (customStyle = {}) => {
    const newNodeId = getNextId(get().nodes)
    const newNode = {
      id: newNodeId,
      type: 'custom',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      draggable: true, // Mặc định là true (vì đang ở 'normal' mode)
      selectable: true, // Mặc định là true
      data: {
        label: `Node ${newNodeId}`,
        style: { ...defaultNodeStyle, backgroundColor: '#ffc9c9', ...customStyle },
      },
    }
    set({ nodes: [...get().nodes, newNode] })
  },
  
  addDrawAreaNode: (position, size) => {
    const newNodeId = getNextId(get().nodes)
    const newNode = {
      id: newNodeId,
      type: 'drawArea', // Type mới
      position,
      draggable: false, // Mới tạo, ở 'normal' mode -> không kéo được
      selectable: false, // Mới tạo, ở 'normal' mode -> không chọn được
      data: {
        style: { 
          width: size.width, 
          height: size.height
        },
        drawing: null, 
      },
    }
    set({ nodes: [...get().nodes, newNode] })
  },
  // --- (Hàm addMindMapNode giữ nguyên) ---
  addMindMapNode: (sourceNode, direction) => {
    // ... (logic giữ nguyên)
    const { nodes, edges } = get() 
    const newNodeId = getNextId(nodes)
    const nodeWidth = parseInt(sourceNode.data.style.width, 10) || 180;
    const nodeSpacing = 100
    const positionOffset =
      direction === 'right' ? nodeWidth + nodeSpacing : -nodeWidth - nodeSpacing
    const newNode = {
      id: newNodeId,
      type: 'custom',
      position: {
        x: sourceNode.position.x + positionOffset,
        y: sourceNode.position.y,
      },
      draggable: true, 
      selectable: true, // ✨ THÊM
      data: {
        label: `Node ${newNodeId}`,
        style: { ...defaultNodeStyle, backgroundColor: '#f1f1f1' },
      },
    }
    const source = direction === 'right' ? sourceNode.id : newNodeId;
    const target = direction === 'right' ? newNodeId : sourceNode.id;
    const newEdge = {
      id: `e${source}-${target}`,
      source: source,
      target: target,
      type: 'default',
      style: { strokeWidth: 2, stroke: '#888' },
      label: '',
      labelBgStyle: { fill: '#fff', fillOpacity: 0.7 },
      labelStyle: { fontSize: 12, fontWeight: 500 },
    }
    set({
      nodes: [...nodes, newNode],
      edges: addEdge(newEdge, edges),
    })
  },

  // (Các hàm còn lại: updateNodeSize, updateNodeData, deleteElements... giữ nguyên)
  updateNodeSize: (nodeId, size) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: { 
                ...node.data, 
                style: { ...node.data.style, ...size } 
              },
            }
          : node
      ),
    })
  },
  updateNodeData: (nodeId, newData) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === nodeId) {
          const updatedData = {
            ...node.data,
            ...newData,
            style: { ...node.data.style, ...newData.style },
          }
          return { ...node, data: updatedData }
        }
        return node
      }),
    })
  },
  toggleNodeStyle: (nodeId, styleKey) => {
    const node = get().nodes.find((n) => n.id === nodeId)
    if (!node) return
    let newValue
    if (styleKey === 'fontWeight') {
      newValue = node.data.style.fontWeight === 'bold' ? 'normal' : 'bold'
    } else if (styleKey === 'fontStyle') {
      newValue = node.data.style.fontStyle === 'italic' ? 'normal' : 'italic'
    }
    get().updateNodeData(nodeId, { style: { [styleKey]: newValue } })
  },
  updateEdgeLabel: (edgeId, label) => {
    set({
      edges: get().edges.map((edge) =>
        edge.id === edgeId ? { ...edge, label } : edge
      ),
    })
  },
  updateEdgeData: (edgeId, data) => {
    const { style, ...restData } = data; 
    set({
      edges: get().edges.map((edge) =>
        edge.id === edgeId
          ? { 
              ...edge, 
              ...restData, 
              style: { ...edge.style, ...style } 
            }
          : edge
      ),
    })
  },
  updateOutgoingEdges: (nodeId, data) => {
    const { style, ...restData } = data;
    set({
      edges: get().edges.map((edge) =>
        edge.source === nodeId
          ? { ...edge, ...restData, style: { ...edge.style, ...style } }
          : edge
      ),
    })
  },
  updateIncomingEdge: (nodeId, data) => {
    const { style, ...restData } = data;
    set({
      edges: get().edges.map((edge) =>
        edge.target === nodeId
          ? { ...edge, ...restData, style: { ...edge.style, ...style } }
          : edge
      ),
    })
  },
  runAutoLayout: () => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      get().nodes,
      get().edges,
      'LR'
    )
    set({
      nodes: layoutedNodes,
      edges: layoutedEdges,
      needsFitView: true, 
    })
  },
  copyNodes: () => {
    const { nodes, selectedNodeIds } = get();
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    clipboard = selectedNodes.map(n => ({ ...n, selected: false }));
    console.log('Copied nodes:', clipboard);
  },
  pasteNodes: () => {
    const { nodes } = get();
    if (clipboard.length === 0) return;
    let newNodes = [];
    let newSelectedIds = [];
    let baseId = getNextId(nodes); 
    clipboard.forEach((nodeToPaste, index) => {
      const newNodeId = (parseInt(baseId) + index).toString();
      const newNode = {
        ...nodeToPaste,
        id: newNodeId,
        position: {
          x: nodeToPaste.position.x + 40, 
          y: nodeToPaste.position.y + 40,
        },
        selected: true, 
      };
      newNodes.push(newNode);
      newSelectedIds.push(newNodeId);
    });
    set({
      nodes: [...nodes, ...newNodes],
      selectedNodeIds: newSelectedIds, 
      selectedEdgeId: null, 
    });
  },
  deleteElements: () => {
    const { nodes, edges, selectedNodeIds, selectedEdgeId, appMode } = get();
    
    // Khi ở canvasMode, chỉ xóa các DrawAreaNode được chọn
    if (appMode === 'canvasMode') {
        const nodeIdsToDelete = new Set(selectedNodeIds.filter(id => {
            const node = nodes.find(n => n.id === id);
            return node && node.type === 'drawArea';
        }));

        if (nodeIdsToDelete.size === 0) return;

        const nextNodes = nodes.filter(n => !nodeIdsToDelete.has(n.id));
        set({
            nodes: nextNodes,
            selectedNodeIds: [],
        });
        return; // Dừng lại
    }

    // Logic xóa bình thường (chỉ chạy ở normal mode)
    const nodeIdsToDelete = new Set(selectedNodeIds);
    const edgeIdsToDelete = selectedEdgeId ? new Set([selectedEdgeId]) : new Set();
    const connectedEdges = getConnectedEdges(nodes.filter(n => nodeIdsToDelete.has(n.id)), edges);
    connectedEdges.forEach(edge => edgeIdsToDelete.add(edge.id));
    const nextNodes = nodes.filter(n => !nodeIdsToDelete.has(n.id));
    const nextEdges = edges.filter(e => !edgeIdsToDelete.has(e.id));

    set({
      nodes: nextNodes,
      edges: nextEdges,
      selectedNodeIds: [], 
      selectedEdgeId: null, 
    });
   },
  updateNodesStyle: (nodeIds, styleObject) => {
    set({
      nodes: get().nodes.map(node => {
        if (nodeIds.includes(node.id)) {
          return {
            ...node,
            data: {
              ...node.data,
              style: { ...node.data.style, ...styleObject }
            }
          };
        }
        return node;
      })
    });
  },
  updateNodesData: (nodeIds, newData) => {
    set({
      nodes: get().nodes.map(node => {
        if (nodeIds.includes(node.id)) {
          return {
            ...node,
            data: { ...node.data, ...newData }
          };
        }
        return node;
      })
    });
  },
  toggleNodesStyle: (nodeIds, styleKey) => {
    set({
      nodes: get().nodes.map(node => {
        if (nodeIds.includes(node.id)) {
          let newValue;
          if (styleKey === 'fontWeight') {
            newValue = node.data.style.fontWeight === 'bold' ? 'normal' : 'bold';
          } else if (styleKey === 'fontStyle') {
            newValue = node.data.style.fontStyle === 'italic' ? 'normal' : 'italic';
          }
          return {
            ...node,
            data: {
              ...node.data,
              style: { ...node.data.style, [styleKey]: newValue }
            }
          };
        }
        return node;
      })
    });
  },
  updateEdgesStyleByNodeIds: (nodeIds, styleObject) => {
    const nodeIdSet = new Set(nodeIds); 
    set({
      edges: get().edges.map(edge => {
        if (nodeIdSet.has(edge.source) || nodeIdSet.has(edge.target)) {
          return {
            ...edge,
            style: { ...edge.style, ...styleObject } 
          };
        }
        return edge; 
      })
    });
  },
  updateEdgesTypeByNodeIds: (nodeIds, type) => {
    const nodeIdSet = new Set(nodeIds);
    set({
      edges: get().edges.map(edge => {
        if (nodeIdSet.has(edge.source) || nodeIdSet.has(edge.target)) {
          return { ...edge, type }; 
        }
        return edge;
      })
    });
  },
})

// --- Final Store (Zundo wrapper) ---
export const useStore = create(
  devtools( // Bọc temporal bằng devtools
    temporal(storeCreator, {
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
      limit: 100,
    })
  )
)