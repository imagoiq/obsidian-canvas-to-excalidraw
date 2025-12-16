const { Plugin, Notice, TFile } = require('obsidian');

// Define the plugin class
class CanvasToExcalidrawPlugin extends Plugin {
    elements = [];
    files = {};
    nodePositions = {};

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
                    this.resetProperties();
                    this.convertCanvasToExcalidraw(activeFile, outputPath);
                } else {
                    new Notice('Please open a .canvas file to use this command.');
                }
            }
        });
    }

    resetProperties() {
        this.elements = [];
        this.files = {};
        this.nodePositions = {};
    }

    async convertCanvasToExcalidraw(file, excalidrawPath) {
        try {
            const canvasData = JSON.parse(await this.app.vault.read(file));

            // Convert nodes to Excalidraw elements
            for (const node of canvasData.nodes) {
                if(node?.text) {
                    this.addTextNode(node);
                }
                if(node?.file) {
                    await this.addImageNode(node);
                }
            }

            // Convert edges to Excalidraw arrows with custom styles
            canvasData.edges.forEach((edge) => {
                const fromNode = this.nodePositions[edge.fromNode];
                const toNode = this.nodePositions[edge.toNode];

                if (fromNode && toNode) {
                    const startX = fromNode.x + fromNode.width;
                    const startY = fromNode.y + fromNode.height / 2;
                    const endX = toNode.x;
                    const endY = toNode.y + toNode.height / 2;

                    this.elements.push({
                        type: 'arrow',
                        version: 2,
                        versionNonce: Math.floor(Math.random() * 100000),
                        isDeleted: false,
                        id: edge.id,
                        x: startX,
                        y: startY,
                        points: [[0, 0], [endX - startX, endY - startY]],
                        strokeColor: '#000000',  // Default to black for arrows
                        backgroundColor: 'transparent',
                        fillStyle: 'solid',
                        strokeWidth: 2,
                        strokeStyle: 'solid',
                        roughness: 0,
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
                elements: this.elements,
                appState: {
                    gridSize: null,
                    viewBackgroundColor: '#ffffff',
                    currentItemStrokeColor: '#000000',
                    currentItemBackgroundColor: '#ffffff'
                },
                files: this.files
            };

            await this.app.vault.adapter.write(excalidrawPath, JSON.stringify(excalidrawData, null, 2));
            new Notice(`Conversion complete! Saved to: ${excalidrawPath}`);
        } catch (error) {
            console.error('Error converting file:', error);
            new Notice('Error converting file. Check the console for details.');
        }
    }

    async addImageNode(node) {
        const fileContent = await this.app.vault.adapter.readBinary(node.file);

        // create the file node
        const { mimeType } = getMimeTypeFromArrayBuffer(fileContent);

        this.files[node.id] = {
            mimeType,
            id: node.id,
            dataURL: `data:${mimeType};base64,${arrayBufferToBase64(fileContent)}`,
            created: Date.now(),
            lastRetrieved: Date.now(),
        };

        // create the image node
        this.elements.push({
            type: 'image',
            version: 2,
            versionNonce: Math.floor(Math.random() * 100000),
            isDeleted: false,
            id: node.id,
            x: node.x,
            y: node.y,
            fileId: node.id,
            width: node.width,
            height: node.height,
            seed: Math.floor(Math.random() * 100000),
            updated: Date.now()
        });
    }

    addTextNode(node) {
        const padding = 30;
        const nodeWidth = node.width || 300;
        const nodeHeight = node.height || 150;
        const maxLineWidth = nodeWidth - padding * 2;
        const fontSize = 16;
        const lineHeight = 20;

        // Extract colors with fallback
        const style = node.style || {};
        const backgroundColor = style.backgroundColor || style.fill || '#ffffff';
        const strokeColor = style.borderColor || style.stroke || '#000000';

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
        this.nodePositions[node.id] = {
            x: node.x,
            y: node.y,
            width: nodeWidth,
            height: calculatedHeight
        };

        // Add a rectangle outline for the node with style
        this.elements.push({
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
            strokeColor: strokeColor,
            backgroundColor: backgroundColor,
            fillStyle: 'solid',
            strokeWidth: 2,
            strokeStyle: 'solid',
            roughness: 0,
            opacity: 100,
            seed: Math.floor(Math.random() * 100000),
            groupIds: [],
            frameId: null,
            boundElements: [{
                id: node.id,
                type: 'text'
            }],
            updated: Date.now()
        });

        // Create the text node
        this.elements.push({
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
            strokeColor: strokeColor,
            backgroundColor: backgroundColor,
            fillStyle: 'solid',
            strokeWidth: 1,
            strokeStyle: 'solid',
            roughness: 0,
            opacity: 100,
            seed: Math.floor(Math.random() * 100000),
            groupIds: [],
            frameId: null,
            boundElementIds: null,
            fontSize: fontSize,
            fontFamily: 6,
            textAlign: 'left',
            verticalAlign: 'top',
            baseline: 16,
            containerId: `${node.id}-border`,
            updated: Date.now()
        });
    }

    onunload() {
        console.log('Canvas to Excalidraw plugin unloaded');
    }
}

function arrayBufferToBase64( buffer ) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}

function getMimeTypeFromArrayBuffer(arrayBuffer) {
    const uint8arr = new Uint8Array(arrayBuffer)

    const len = 4
    if (uint8arr.length >= len) {
        let signatureArr = new Array(len)
        for (let i = 0; i < len; i++)
            signatureArr[i] = (new Uint8Array(arrayBuffer))[i].toString(16)
        const signature = signatureArr.join('').toUpperCase()

        switch (signature) {
            case '89504E47':
                return 'image/png'
            case '47494638':
                return 'image/gif'
            case '52494646':
                return 'image/webp'
            case '424D':
                return 'image/bmp'
            case 'FFD8FFDB':
            case 'FFD8FFE0':
                return 'image/jpeg'
            default:
                return null
        }
    }
    return null
}

module.exports = CanvasToExcalidrawPlugin;
