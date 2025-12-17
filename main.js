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
                if(node.type === 'text') {
                    this.convertTextNode(node);
                }
                if(node.type === 'file') {
                    await this.convertImageNode(node);
                }
                if(node.type === 'group') {
                    await this.convertGroupNode(node);
                }
            }

            // Convert edges to Excalidraw arrows with custom styles
            for (const edge of canvasData.edges) {
                this.convertArrowEdge(edge);
            }
            
            // Add elements inside Frame 
            for (const frame of this.elements.filter(element => element.type === 'frame')) {
                this.boundElementToFrame(frame);
            }

            const excalidrawData = {
                type: 'excalidraw',
                version: 2,
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

    async convertImageNode(node) {
        try {
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
                frameId: null,
                fileId: node.id,
                width: node.width,
                height: node.height,
                seed: Math.floor(Math.random() * 100000),
                updated: Date.now()
            });

            // Store node bounds for arrow positioning
            this.nodePositions[node.id] = {
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height
            };
        }
        catch(e) {
            console.log(e);
        }
    }

    convertTextNode(node) {
        const padding = 30;
        const nodeWidth = node.width || 300;
        const nodeHeight = node.height || 150;
        const maxLineWidth = nodeWidth - padding * 2;
        const fontSize = 16;
        const lineHeight = 20;

        // Extract colors with fallback
        const style = node.style || {};
        const backgroundColor = style.backgroundColor || style.fill || '#e9ecef';
        const strokeColor = style.borderColor || style.stroke || '#333333';

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
            strokeColor: "#666666",
            backgroundColor: backgroundColor,
            fillStyle: "hachure",
            strokeWidth: 1,
            strokeStyle: "solid",
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

    convertArrowEdge(edge) {
        const fromNode = this.nodePositions[edge.fromNode];
        const toNode = this.nodePositions[edge.toNode];

        if (fromNode && toNode) {
            const startElement = this.elements.find(node => node.id === edge.fromNode);
            const endElement = this.elements.find(node => node.id === edge.toNode);

            const startBindingId = startElement.type === 'text' ? `${startElement.id}-border`: startElement.id;
            const endBindingId = endElement.type === 'text' ? `${endElement.id}-border`: endElement.id;

            let startX;
            let startXRelative;
            let startY;
            let startYRelative;
            let endX;
            let endXRelative;
            let endY;
            let endYRelative;

            // start node
            if(edge?.fromSide === 'top') {
                startX = fromNode.x + fromNode.width / 2;
                startY = fromNode.y;
                startXRelative = 0.5;
                startYRelative = 0.0;
            }
            if(edge?.fromSide === 'bottom') {
                startX = fromNode.x + fromNode.width / 2;
                startY = fromNode.y + fromNode.height;
                startXRelative = 0.5;
                startYRelative = 1.0;
            }
            if(edge?.fromSide === 'left') {
                startX = fromNode.x;
                startY = fromNode.y + fromNode.height / 2;
                startXRelative = 0.0;
                startYRelative = 0.5;
            }
            if(edge?.fromSide === 'right') {
                startX = fromNode.x + fromNode.width
                startY = fromNode.y + fromNode.height / 2;
                startXRelative = 1.0;
                startYRelative = 0.5;
            }

            // end node
            if(edge?.toSide === 'top') {
                endX = toNode.x + toNode.width / 2;
                endY = toNode.y;
                endXRelative = 0.5;
                endYRelative = 0.0;
            }
            if(edge?.toSide === 'bottom') {
                endX = toNode.x + toNode.width / 2;
                endY = toNode.y + toNode.height;
                endXRelative = 0.5;
                endYRelative = 1.0;
            }
            if(edge?.toSide === 'left') {
                endX = toNode.x;
                endY = toNode.y + toNode.height / 2;
                endXRelative = 0.0;
                endYRelative = 0.5;
            }
            if(edge?.toSide === 'right') {
                endX = toNode.x + toNode.width
                endY = toNode.y + toNode.height / 2;
                endXRelative = 1.0;
                endYRelative = 0.5;
            }

            this.elements.push({
                type: 'arrow',
                version: 2,
                versionNonce: Math.floor(Math.random() * 100000),
                isDeleted: false,
                id: edge.id,
                x: startX,
                y: startY,
                points: [[0, 0], [endX - startX, endY - startY]],
                startBinding: {
                    elementId: startBindingId,
                    mode: "inside",
                    fixedPoint: [
                        startXRelative,
                        startYRelative
                    ]
                },
                endBinding: {
                    elementId: endBindingId,
                    mode: "inside",
                    fixedPoint: [
                        endXRelative,
                        endYRelative
                    ]
                },
                strokeColor: "#AAAAAA",
                backgroundColor: "transparent",
                fillStyle: "solid",
                frameId:null,
                strokeWidth: 2,
                strokeStyle: "solid",
                endArrowhead: "triangle",
                elbowed: false,
                roughness: 0,
                opacity: 100,
                seed: Math.floor(Math.random() * 100000),
                updated: Date.now()
            });

            // Add to bound elements property
            this.elements = this.elements.map(element => {
                if(element.id === startBindingId || element.id === endBindingId) {
                    if(!('boundElements' in element)){
                        element.boundElements = [];
                    }

                    element.boundElements.push({
                        id: edge.id,
                        type: "arrow"
                    })
                }

                return element
            })
        }
    }

    convertGroupNode(node) {
        this.elements.push({
            type: 'frame',
            version: 2,
            versionNonce: Math.floor(Math.random() * 100000),
            isDeleted: false,
            id: node.id,
            name: node.label,
            groupIds: [],
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            roughness: 0,
            opacity: 100,
            locked: false,
            seed: Math.floor(Math.random() * 100000),
            updated: Date.now(),
            frameRole: "marker"
        });

        // Store node bounds for arrow positioning
        this.nodePositions[node.id] = {
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height
        };
    }

    boundElementToFrame(frame) {
        // Add to bound elements property
        this.elements = this.elements.map(element => {
            if(element.type === 'frame') {
                return element;
            }

            if(isWithinFrame(element, frame)) {
                element.frameId = frame.id;
            }

            return element
        })
    }

    onunload() {
        console.log('Canvas to Excalidraw plugin unloaded');
    }
}

function isWithinFrame(innerBox, outerBox) {
    const { x: innerX, y: innerY, width: innerWidth, height: innerHeight } = innerBox;
    const { x: outerX, y: outerY, width: outerWidth, height: outerHeight } = outerBox;
    
    const isTopLeftInside = innerX >= outerX && innerY >= outerY;
    
    const isBottomRightInside = (innerX + innerWidth) <= (outerX + outerWidth) &&
        (innerY + innerHeight) <= (outerY + outerHeight);
    
    return isTopLeftInside && isBottomRightInside;
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
