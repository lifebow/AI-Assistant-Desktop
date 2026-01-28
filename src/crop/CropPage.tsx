import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SelectionRect {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

const CropPage: React.FC = () => {
    const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
    const [selection, setSelection] = useState<SelectionRect | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    // Receive screenshot from main process
    useEffect(() => {
        const handleScreenshot = (_event: any, data: { screenshot: string }) => {
            console.log('[CropPage] Received screenshot');
            setScreenshotUrl(data.screenshot);
        };

        if ((window as any).electronAPI?.onCropScreenshot) {
            (window as any).electronAPI.onCropScreenshot(handleScreenshot);

            // Notify main process that we are ready to receive data
            // This completes the handshake and triggers the window to show
            console.log('[CropPage] Sending crop-ready signal');
            (window as any).electronAPI?.cropReady?.();
        }

        // Also check if screenshot was passed as query param (fallback)
        const urlParams = new URLSearchParams(window.location.search);
        const screenshotParam = urlParams.get('screenshot');
        if (screenshotParam) {
            setScreenshotUrl(decodeURIComponent(screenshotParam));
        }

        return () => {
            // Cleanup if needed
        };
    }, []);

    // Handle ESC key to cancel
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                console.log('[CropPage] ESC pressed, canceling');
                (window as any).electronAPI?.cropCancel?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Load image when screenshot URL changes
    useEffect(() => {
        if (!screenshotUrl) return;

        const img = new Image();
        img.onload = () => {
            imageRef.current = img;
            // Force re-render to draw image
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                drawCanvas();
            }
        };
        img.src = screenshotUrl;
    }, [screenshotUrl]);

    // Draw canvas with image and selection
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imageRef.current;

        if (!canvas || !img) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Handle High DPI
        const dpr = window.devicePixelRatio || 1;
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Ensure canvas buffer matches screen density
        // Setting width/height clears the canvas and resets state
        if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
        }

        // Reset transform to identity then apply scale
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        // Clear canvas (logical coords)
        ctx.clearRect(0, 0, width, height);

        // Draw screenshot (logical coords)
        // The image from main process should be high-res (matching physical pixels).
        // By drawing it into logical width/height (1500x), with 2x scale, it maps 1:1 to physical pixels (3000x).
        ctx.drawImage(img, 0, 0, width, height);

        // Draw dark overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, width, height);

        // If we have a selection, cut out the selected area
        if (selection) {
            const x = Math.min(selection.startX, selection.endX);
            const y = Math.min(selection.startY, selection.endY);
            const selWidth = Math.abs(selection.endX - selection.startX);
            const selHeight = Math.abs(selection.endY - selection.startY);

            if (selWidth > 0 && selHeight > 0) {
                // Clear the dark overlay in the selection area
                ctx.clearRect(x, y, selWidth, selHeight);

                // Redraw the image in the selection area to ensure it's bright/clear
                // We use standard drawImage here which maps source to dest. 
                // Source coord calculation:
                // logical x / logical canvas width = ratio.
                // ratio * img.width = source x.

                ctx.drawImage(
                    img,
                    (x / width) * img.width,
                    (y / height) * img.height,
                    (selWidth / width) * img.width,
                    (selHeight / height) * img.height,
                    x, y, selWidth, selHeight
                );

                // Draw selection border
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1; // 1px logical is fine
                ctx.strokeRect(x, y, selWidth, selHeight);

                // Draw dimension text
                ctx.fillStyle = '#fff';
                ctx.font = '14px sans-serif';
                // Add shadow for better visibility
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;
                const dimensionText = `${Math.round(selWidth)} × ${Math.round(selHeight)}`;
                const textY = y > 30 ? y - 10 : y + selHeight + 20;
                ctx.fillText(dimensionText, x, textY);
                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            }
        }
    }, [selection]);

    // Redraw when selection changes or window resizes
    useEffect(() => {
        drawCanvas();

        const handleResize = () => requestAnimationFrame(drawCanvas);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [drawCanvas]);

    // Mouse event handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setSelection({
            startX: e.clientX,
            startY: e.clientY,
            endX: e.clientX,
            endY: e.clientY,
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !selection) return;
        setSelection({
            ...selection,
            endX: e.clientX,
            endY: e.clientY,
        });
    };

    const handleMouseUp = () => {
        if (!isDragging || !selection) return;
        setIsDragging(false);

        const x = Math.min(selection.startX, selection.endX);
        const y = Math.min(selection.startY, selection.endY);
        const width = Math.abs(selection.endX - selection.startX);
        const height = Math.abs(selection.endY - selection.startY);

        // Minimum selection size
        if (width < 10 || height < 10) {
            console.log('[CropPage] Selection too small, canceling');
            (window as any).electronAPI?.cropCancel?.();
            return;
        }

        // Crop the image and send back
        cropAndComplete(x, y, width, height);
    };

    const cropAndComplete = (x: number, y: number, width: number, height: number) => {
        const img = imageRef.current;
        const canvas = canvasRef.current;
        if (!img || !canvas) return;

        // Create a temporary canvas for the cropped image
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = width;
        cropCanvas.height = height;
        const cropCtx = cropCanvas.getContext('2d');

        if (!cropCtx) return;

        // Calculate the source rectangle in the original image coordinates
        const scaleX = img.width / canvas.width;
        const scaleY = img.height / canvas.height;

        cropCtx.drawImage(
            img,
            x * scaleX,
            y * scaleY,
            width * scaleX,
            height * scaleY,
            0, 0, width, height
        );

        const croppedDataUrl = cropCanvas.toDataURL('image/png');
        console.log('[CropPage] Cropped image ready, sending to main');
        (window as any).electronAPI?.cropComplete?.(croppedDataUrl);
    };

    // Handle right click to cancel
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        (window as any).electronAPI?.cropCancel?.();
    };

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                cursor: 'crosshair',
                overflow: 'hidden',
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={handleContextMenu}
            />

            {/* Instructions overlay */}
            <div
                style={{
                    position: 'fixed',
                    bottom: 20,
                    left: 20,
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: '12px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    lineHeight: 1.6,
                    pointerEvents: 'none',
                }}
            >
                <div>🖱️ Drag to select area</div>
                <div>⎋ ESC or Right-click to cancel</div>
            </div>
        </div>
    );
};

export default CropPage;
