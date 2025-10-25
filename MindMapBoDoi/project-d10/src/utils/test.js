import fs from 'fs';
import { markdownToMindmap } from './markdownToMindmap.js';

// Đọc nội dung Markdown
const content = fs.readFileSync('./phapluat.md', 'utf8');

// Chuyển sang Mindmap data
const { nodes, edges } = markdownToMindmap(content);

// Xuất ra file JSON để test hiển thị
fs.writeFileSync('./mindmap.json', JSON.stringify({ nodes, edges }, null, 2));

console.log('✅ Đã tạo mindmap.json!');
