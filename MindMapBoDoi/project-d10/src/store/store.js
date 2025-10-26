import { create } from 'zustand'
import { temporal } from 'zundo'
import { devtools } from 'zustand/middleware'
import dagre from 'dagre'
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  getConnectedEdges,
} from '@xyflow/react'

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
    selectable: true,
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

// --- HÀM VALIDATE DATA QUAN TRỌNG ---
const validateAndFixNodes = (nodes) => {
  if (!Array.isArray(nodes)) return initialNodes;
  
  return nodes.map((node, index) => {
    // Đảm bảo node có ID hợp lệ
    const validId = node.id && typeof node.id === 'string' ? node.id : `node-${index}`;
    
    // Đảm bảo position có giá trị số hợp lệ, không phải NaN
    const validPosition = {
      x: Number.isFinite(node.position?.x) ? node.position.x : index * 200,
      y: Number.isFinite(node.position?.y) ? node.position.y : index * 100
    };

    // Đảm bảo data có cấu trúc hợp lệ
    const validData = {
      label: node.data?.label || `Node ${validId}`,
      style: { ...defaultNodeStyle, ...node.data?.style },
      ...node.data
    };

    return {
      id: validId,
      type: node.type || 'custom',
      position: validPosition,
      draggable: node.draggable !== undefined ? node.draggable : true,
      selectable: node.selectable !== undefined ? node.selectable : true,
      data: validData,
      ...node
    };
  });
};

const validateAndFixEdges = (edges) => {
  if (!Array.isArray(edges)) return [];
  
  return edges.map((edge, index) => ({
    id: edge.id || `edge-${index}`,
    source: edge.source || '',
    target: edge.target || '',
    type: edge.type || 'default',
    style: { strokeWidth: 2, stroke: '#888', ...edge.style },
    label: edge.label || '',
    labelBgStyle: { fill: '#fff', fillOpacity: 0.7, ...edge.labelBgStyle },
    labelStyle: { fontSize: 12, fontWeight: 500, ...edge.labelStyle },
    ...edge
  })).filter(edge => edge.source && edge.target);
};

// --- HÀM LAYOUT ---
const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  const isHorizontal = direction === 'LR'
  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 150 })

  nodes.forEach((node) => {
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
      selectable: true,
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
  // === THÊM MỚI: Hàm Reset Store ===
  resetToInitialState: () => {
    console.log("Reseting store to initial state...");
    set({
      nodes: initialNodes,
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      needsFitView: true,
      // Đặt lại các state khác nếu cần
    });
    // Gọi clear của zundo (middleware temporal)
    useStore.temporal.clear();
  },
  // --- QUAN TRỌNG: Sửa hàm loadState ---
  loadState: (newState) => {
    if (newState && Array.isArray(newState.nodes) && Array.isArray(newState.edges)) {
      // VALIDATE và FIX data trước khi load
      const validatedNodes = validateAndFixNodes(newState.nodes);
      const validatedEdges = validateAndFixEdges(newState.edges);
      
      console.log('Loading validated nodes:', validatedNodes);
      console.log('Loading validated edges:', validatedEdges);

      set({
        nodes: validatedNodes,
        edges: validatedEdges,
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedNodeIds: [], 
        needsFitView: true,
      })
    } else {
      console.error('Failed to load invalid state:', newState)
      // Fallback đơn giản - dùng initialNodes
      set({
        nodes: initialNodes,
        edges: [],
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedNodeIds: [], 
        needsFitView: true,
      });
    }
  },

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
  },

  onConnect: (connection) => {
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
 
  setAppMode: (mode) => {
      let nextTool = { mode: 'cursor' }; 
      let nextActiveId = null; 

      if (mode === 'canvasMode') {
          nextTool = { mode: 'cursor' };
      }
      
      const nextNodes = get().nodes.map(n => {
        if (n.type === 'custom') {
          return { 
            ...n, 
            draggable: mode === 'normal',
            selectable: mode === 'normal'
          };
        }
        if (n.type === 'drawArea') {
           return { 
             ...n, 
             draggable: mode === 'canvasMode',
             selectable: mode === 'canvasMode'
           };
        }
        return n;
      });
      
      set({
          appMode: mode,
          currentDrawTool: nextTool,
          activeDrawAreaId: nextActiveId,
          nodes: nextNodes,
      });
   },

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
      draggable: true,
      selectable: true,
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
      type: 'drawArea',
      position,
      draggable: false,
      selectable: false,
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

  addMindMapNode: (sourceNode, direction) => {
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
      selectable: true,
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
        return;
    }

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

// --- Final Store ---
export const useStore = create(
  devtools(
    temporal(storeCreator, {
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
      limit: 100,
    })
  )
)