const { Plugin, Notice, TFile } = require('obsidian');

// Define the plugin class
class CanvasToExcalidrawPlugin extends Plugin {
    async onload() {
        this.addCommand({
            id: 'convert-canvas-to-excalidraw',
            name: 'Convert Canvas to Excalidraw',
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (checking) {
                    return activeFile && activeFile.extension === 'canvas';
                }
                if (activeFile && activeFile.extension === 'canvas') {
                    const outputPath = activeFile.path.replace('.canvas', '.excalidraw');
                    this.convertCanvasToExcalidraw(activeFile, outputPath);
                } else {
                    new Notice('Please open a .canvas file to use this command.');
                }
            }
        });
    }

    async convertCanvasToExcalidraw(file, excalidrawPath) {
        try {
            const canvasData = JSON.parse(await this.app.vault.read(file));
            const elements = [];
            const nodePositions = {};

            // Convert nodes to Excalidraw elements
            canvasData.nodes.forEach((node) => {
                const padding = 30;
                const nodeWidth = node.width || 300;
                const nodeHeight = node.height || 150;
                const maxLineWidth = nodeWidth - padding * 2;
                const fontSize = 16;
                const lineHeight = 20;

                // Word-wrapping logic with word boundaries
                const words = node.text.split(' ');
                let currentLine = '';
                const wrappedLines = [];

                words.forEach(word => {
                    if ((currentLine + word).length * (fontSize / 1.8) > maxLineWidth) {
                        wrappedLines.push(currentLine.trim());
                        currentLine = '';
                    }
                    currentLine += word + ' ';
                });
                if (currentLine.length > 0) wrappedLines.push(currentLine.trim());

                const wrappedText = wrappedLines.join('\n');
                const lineCount = wrappedLines.length;
                const calculatedHeight = lineCount * lineHeight + padding * 2;
                const calculatedWidth = nodeWidth;  // Use the full node width for text

                // Store node bounds for arrow positioning
                nodePositions[node.id] = {
                    x: node.x,
                    y: node.y,
                    width: nodeWidth,
                    height: calculatedHeight
                };

                // Create the text node
                elements.push({
                    type: 'text',
                    version: 2,
                    versionNonce: Math.floor(Math.random() * 100000),
                    isDeleted: false,
                    id: node.id,
                    text: wrappedText,
                    x: node.x + padding,
                    y: node.y + padding,
                    width: nodeWidth - padding * 2,
                    height: calculatedHeight - padding * 2,
                    angle: 0,
                    strokeColor: '#000000',
                    backgroundColor: '#ffffff',
                    fillStyle: 'solid',
                    strokeWidth: 1,
                    strokeStyle: 'solid',
                    roughness: 1,
                    opacity: 100,
                    seed: Math.floor(Math.random() * 100000),
                    groupIds: [],
                    frameId: null,
                    boundElementIds: [],
                    fontSize: fontSize,
                    fontFamily: 1,
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    baseline: 16,
                    containerId: null,
                    updated: Date.now()
                });

                // Add a rectangle outline for the node
                elements.push({
                    type: 'rectangle',
                    version: 2,
                    versionNonce: Math.floor(Math.random() * 100000),
                    isDeleted: false,
                    id: `${node.id}-border`,
                    x: node.x,
                    y: node.y,
                    width: nodeWidth,
                    height: calculatedHeight,
                    angle: 0,
                    strokeColor: '#000000',
                    backgroundColor: 'transparent',
                    fillStyle: 'solid',
                    strokeWidth: 2,
                    strokeStyle: 'solid',
                    roughness: 1,
                    opacity: 100,
                    seed: Math.floor(Math.random() * 100000),
                    groupIds: [],
                    frameId: null,
                    boundElementIds: [],
                    updated: Date.now()
                });
            });

            // Convert edges to Excalidraw arrows
            canvasData.edges.forEach((edge) => {
                const fromNode = nodePositions[edge.fromNode];
                const toNode = nodePositions[edge.toNode];

                if (fromNode && toNode) {
                    const startX = fromNode.x + fromNode.width;
                    const startY = fromNode.y + fromNode.height / 2;
                    const endX = toNode.x;
                    const endY = toNode.y + toNode.height / 2;

                    elements.push({
                        type: 'arrow',
                        version: 2,
                        versionNonce: Math.floor(Math.floor(Math.random() * 100000)),
                        isDeleted: false,
                        id: edge.id,
                        x: startX,
                        y: startY,
                        points: [[0, 0], [endX - startX, endY - startY]],
                        strokeColor: '#000000',
                        backgroundColor: 'transparent',
                        fillStyle: 'solid',
                        strokeWidth: 2,
                        strokeStyle: 'solid',
                        roughness: 1,
                        opacity: 100,
                        seed: Math.floor(Math.random() * 100000),
                        updated: Date.now()
                    });
                }
            });

            const excalidrawData = {
                type: 'excalidraw',
                version: 3,
                source: 'obsidian-canvas-converter',
                elements,
                appState: {
                    gridSize: null,
                    viewBackgroundColor: '#ffffff',
                    currentItemStrokeColor: '#000000',
                    currentItemBackgroundColor: '#ffffff'
                },
                files: {}
            };

            await this.app.vault.adapter.write(excalidrawPath, JSON.stringify(excalidrawData, null, 2));
            new Notice(`Conversion complete! Saved to: ${excalidrawPath}`);
        } catch (error) {
            console.error('Error converting file:', error);
            new Notice('Error converting file. Check the console for details.');
        }
    }

    onunload() {
        console.log('Canvas to Excalidraw plugin unloaded');
    }
}

module.exports = CanvasToExcalidrawPlugin;
