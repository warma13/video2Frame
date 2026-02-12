        let videoFile = null;
        let videoElement = null;
        let extractedFrames = [];
        let watermarkArea = null;
        
        // 初始化
        function init() {
            setupUploadArea();
            setupControls();
            setupEventListeners();
        }
        
        // 设置上传区域
        function setupUploadArea() {
            const uploadArea = document.getElementById('uploadArea');
            const videoFileInput = document.getElementById('videoFile');
            
            uploadArea.addEventListener('click', () => {
                videoFileInput.click();
            });
            
            videoFileInput.addEventListener('change', handleFileSelect);
            
            // 拖拽功能
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                
                if (e.dataTransfer.files.length > 0) {
                    handleFile(e.dataTransfer.files[0]);
                }
            });
        }
        
        // 处理文件选择
        function handleFileSelect(e) {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        }
        
        // 处理文件
        function handleFile(file) {
            if (!file.type.startsWith('video/')) {
                showError('请上传视频文件');
                return;
            }
            
            videoFile = file;
            previewVideo(file);
            document.getElementById('extractBtn').disabled = false;
            showError('');
        }
        
        // 预览视频
        function previewVideo(file) {
            const videoPreview = document.getElementById('videoPreview');
            const previewVideo = document.getElementById('previewVideo');
            
            const videoURL = URL.createObjectURL(file);
            previewVideo.src = videoURL;
            videoElement = previewVideo;
            
            videoPreview.style.display = 'block';
            
            // 更新视频信息
            document.getElementById('videoFileName').textContent = file.name;
            document.getElementById('videoFileSize').textContent = formatFileSize(file.size);
            
            // 视频加载完成后更新分辨率和时长
            previewVideo.addEventListener('loadedmetadata', function() {
                document.getElementById('videoResolution').textContent = `${previewVideo.videoWidth} × ${previewVideo.videoHeight}`;
                document.getElementById('videoDuration').textContent = formatTime(previewVideo.duration);
            });
            
            // 自动加载第一帧到去背景色预览
            loadFirstFrameForBackgroundRemoval();
        }
        
        // 格式化文件大小
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        // 加载第一帧用于背景色选择
        function loadFirstFrameForBackgroundRemoval() {
            if (!videoElement) return;
            
            // 确保视频元素已经准备好
            if (videoElement.readyState >= 2) {
                captureFirstFrame();
            } else {
                videoElement.addEventListener('loadedmetadata', captureFirstFrame);
            }
        }
        
        // 捕获第一帧
        function captureFirstFrame() {
            videoElement.currentTime = 0;
            
            videoElement.addEventListener('seeked', () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                
                const frameURL = canvas.toDataURL('image/png');
                updateFirstFramePreview(frameURL);
                
                // 保存原始第一帧URL，用于后续更新预览
                window.originalFirstFrameURL = frameURL;
                
                // 更新水印预览
                const watermarkPreview = document.getElementById('watermarkPreview');
                watermarkPreview.src = frameURL;
                
                // 图片加载完成后更新水印预览覆盖层
                watermarkPreview.onload = function() {
                    updateWatermarkPreview();
                };
            }, { once: true });
        }
        
        // 设置控件
        function setupControls() {
            const extractMethod = document.getElementById('extractMethod');
            const intervalControl = document.getElementById('intervalControl');
            const timePointsControl = document.getElementById('timePointsControl');
            const totalFramesControl = document.getElementById('totalFramesControl');
            const startTimeControl = document.getElementById('startTimeControl');
            const firstFrameTimeControl = document.getElementById('firstFrameTimeControl');
            const detectionParamsControl = document.getElementById('detectionParamsControl');
            const removeBackground = document.getElementById('removeBackground');
            const backgroundColorControl = document.getElementById('backgroundColorControl');
            const removeWatermark = document.getElementById('removeWatermark');
            const watermarkControl = document.getElementById('watermarkControl');
            
            // 初始显示默认控件
            function updateControls() {
                const method = extractMethod.value;
                
                intervalControl.style.display = method === 'interval' ? 'block' : 'none';
                timePointsControl.style.display = method === 'specific' ? 'block' : 'none';
                totalFramesControl.style.display = (method === 'total' || method === 'startEnd') ? 'block' : 'none';
                startTimeControl.style.display = method === 'startEnd' ? 'block' : 'none';
                firstFrameTimeControl.style.display = method === 'startEnd' ? 'block' : 'none';
                detectionParamsControl.style.display = method === 'startEnd' ? 'block' : 'none';
                backgroundColorControl.style.display = removeBackground.checked ? 'block' : 'none';
                watermarkControl.style.display = removeWatermark.checked ? 'block' : 'none';
            }
            
            // 初始更新
            updateControls();
            
            // 监听变化
            extractMethod.addEventListener('change', updateControls);
            removeBackground.addEventListener('change', updateControls);
            removeWatermark.addEventListener('change', updateControls);
            

            
            // 颜色容差滑块
            const colorTolerance = document.getElementById('colorTolerance');
            const toleranceValue = document.getElementById('toleranceValue');
            
            colorTolerance.addEventListener('input', () => {
                toleranceValue.textContent = colorTolerance.value;
            });
        }
        
        let playbackInterval = null;
        let currentFrameIndex = 0;
        
        // 设置事件监听器
        function setupEventListeners() {
            document.getElementById('extractBtn').addEventListener('click', extractFrames);
            document.getElementById('playFramesControlBtn').addEventListener('click', playFrames);
            document.getElementById('stopFramesBtn').addEventListener('click', stopFrames);
            document.getElementById('closePreviewModal').addEventListener('click', closeImagePreview);
            
            // 播放/暂停按钮事件
            document.getElementById('playPauseBtn').addEventListener('click', function() {
                if (videoElement) {
                    if (videoElement.paused) {
                        videoElement.play();
                    } else {
                        videoElement.pause();
                    }
                }
            });
            
            // 进退一帧按钮事件
            document.getElementById('rewindFrameBtn').addEventListener('click', function() {
                if (videoElement) {
                    // 后退一帧（大约33ms，假设30fps）
                    videoElement.currentTime = Math.max(0, videoElement.currentTime - 1/30);
                }
            });
            
            document.getElementById('forwardFrameBtn').addEventListener('click', function() {
                if (videoElement) {
                    // 前进一帧（大约33ms，假设30fps）
                    videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + 1/30);
                }
            });
            
            // 进退一秒按钮事件
            document.getElementById('rewindSecondBtn').addEventListener('click', function() {
                if (videoElement) {
                    // 后退一秒
                    videoElement.currentTime = Math.max(0, videoElement.currentTime - 1);
                }
            });
            
            document.getElementById('forwardSecondBtn').addEventListener('click', function() {
                if (videoElement) {
                    // 前进一秒
                    videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + 1);
                }
            });
            
            // 颜色选择器事件
            document.getElementById('backgroundColorPicker').addEventListener('change', function() {
                const hexColor = this.value;
                backgroundColor = hexToRgb(hexColor);
                document.getElementById('currentColorDisplay').textContent = hexColor;
            });
            
            // 水印选择事件
            document.getElementById('selectWatermarkBtn').addEventListener('click', openWatermarkSelection);
            document.getElementById('confirmWatermarkBtn').addEventListener('click', confirmWatermarkSelection);
            document.getElementById('cancelWatermarkBtn').addEventListener('click', closeWatermarkModal);
            document.getElementById('closeWatermarkModal').addEventListener('click', closeWatermarkModal);
            
            // 水印预设位置事件
            document.getElementById('watermarkPresets').addEventListener('change', function() {
                // 当选择预设时，自动应用
                applyPreset();
            });
            
            // 更新水印区域按钮事件
            document.getElementById('updateWatermarkBtn').addEventListener('click', function() {
                // 获取输入框中的值
                const x = parseFloat(document.getElementById('watermarkX').value) || 0;
                const y = parseFloat(document.getElementById('watermarkY').value) || 0;
                const w = parseFloat(document.getElementById('watermarkW').value) || 0;
                const h = parseFloat(document.getElementById('watermarkH').value) || 0;
                
                // 验证值的范围
                const validX = Math.max(0, Math.min(1, x));
                const validY = Math.max(0, Math.min(1, y));
                const validW = Math.max(0, Math.min(1 - validX, w));
                const validH = Math.max(0, Math.min(1 - validY, h));
                
                // 更新水印区域
                watermarkArea = {
                    left: validX,
                    top: validY,
                    width: validW,
                    height: validH
                };
                
                // 更新输入框中的值为验证后的值
                document.getElementById('watermarkX').value = validX.toFixed(2);
                document.getElementById('watermarkY').value = validY.toFixed(2);
                document.getElementById('watermarkW').value = validW.toFixed(2);
                document.getElementById('watermarkH').value = validH.toFixed(2);
                
                // 更新水印预览
                updateWatermarkPreview();
            });
            
            // 应用预设函数
            function applyPreset() {
                const preset = document.getElementById('watermarkPresets').value;
                
                switch (preset) {
                    case 'doubao':
                        // 豆包预设位置
                        watermarkArea = {
                            left: 0.84,
                            top: 0.96,
                            width: 0.15,
                            height: 0.04
                        };
                        break;
                    
                    case 'top-left':
                        // 左上角预设位置
                        watermarkArea = {
                            left: 0.01,
                            top: 0.01,
                            width: 0.2,
                            height: 0.1
                        };
                        break;
                    
                    case 'top-right':
                        // 右上角预设位置
                        watermarkArea = {
                            left: 0.79,
                            top: 0.01,
                            width: 0.2,
                            height: 0.1
                        };
                        break;
                    
                    case 'bottom-left':
                        // 左下角预设位置
                        watermarkArea = {
                            left: 0.01,
                            top: 0.89,
                            width: 0.2,
                            height: 0.1
                        };
                        break;
                    
                    case 'bottom-right':
                        // 右下角预设位置
                        watermarkArea = {
                            left: 0.79,
                            top: 0.89,
                            width: 0.2,
                            height: 0.1
                        };
                        break;
                    
                    default:
                        return;
                }
                
                console.log(`Applied ${preset} preset watermark area:`, watermarkArea);
                // 更新水印区域输入框
                document.getElementById('watermarkX').value = watermarkArea.left.toFixed(2);
                document.getElementById('watermarkY').value = watermarkArea.top.toFixed(2);
                document.getElementById('watermarkW').value = watermarkArea.width.toFixed(2);
                document.getElementById('watermarkH').value = watermarkArea.height.toFixed(2);
                
                // 启用输入框和更新按钮
                document.getElementById('watermarkX').disabled = false;
                document.getElementById('watermarkY').disabled = false;
                document.getElementById('watermarkW').disabled = false;
                document.getElementById('watermarkH').disabled = false;
                document.getElementById('updateWatermarkBtn').disabled = false;
                
                // 更新水印预览
                updateWatermarkPreview();
            }
            
            // 点击模态框背景关闭预览
            document.getElementById('imagePreviewModal').addEventListener('click', function(e) {
                if (e.target === this) {
                    closeImagePreview();
                }
            });
            
        // 打包下载按钮事件
        document.getElementById('zipAllFramesBtn').addEventListener('click', zipAllFrames);
            
            // 将当前时间设为首帧时间点按钮事件
            document.getElementById('setFirstFrameTimeBtn').addEventListener('click', function() {
                if (videoElement) {
                    const currentTime = videoElement.currentTime;
                    document.getElementById('firstFrameTime').value = currentTime.toFixed(2);
                }
            });
            
            // 全局保存设置事件监听器
            const globalWidthInput = document.getElementById('globalWidth');
            const globalHeightInput = document.getElementById('globalHeight');
            const globalKeepRatioCheckbox = document.getElementById('globalKeepRatio');
            
            globalWidthInput.addEventListener('input', function() {
                if (globalKeepRatioCheckbox.checked && extractedFrames.length > 0) {
                    // 使用第一帧的比例作为参考
                    const firstFrameItem = document.querySelector('.frame-item');
                    if (firstFrameItem) {
                        const firstFrameImg = firstFrameItem.querySelector('.frame-image');
                        if (firstFrameImg.naturalWidth > 0) {
                            const ratio = firstFrameImg.naturalHeight / firstFrameImg.naturalWidth;
                            const newWidth = parseFloat(this.value) || 0;
                            globalHeightInput.value = Math.round(newWidth * ratio);
                        }
                    }
                }
            });
            
            globalHeightInput.addEventListener('input', function() {
                if (globalKeepRatioCheckbox.checked && extractedFrames.length > 0) {
                    // 使用第一帧的比例作为参考
                    const firstFrameItem = document.querySelector('.frame-item');
                    if (firstFrameItem) {
                        const firstFrameImg = firstFrameItem.querySelector('.frame-image');
                        if (firstFrameImg.naturalHeight > 0) {
                            const ratio = firstFrameImg.naturalWidth / firstFrameImg.naturalHeight;
                            const newHeight = parseFloat(this.value) || 0;
                            globalWidthInput.value = Math.round(newHeight * ratio);
                        }
                    }
                }
            });
        }
        
        // 循环播放提取的帧
        function playFrames() {
            if (extractedFrames.length === 0) {
                showError('请先提取帧');
                return;
            }
            
            // 停止之前的播放
            stopFrames();
            
            const frameDuration = parseFloat(document.getElementById('frameDuration').value);
            const previewImage = document.getElementById('previewImage');
            const previewText = document.getElementById('previewText');
            
            // 隐藏文本，显示图片
            previewText.style.display = 'none';
            previewImage.style.display = 'block';
            
            // 启用停止按钮
            document.getElementById('stopFramesBtn').disabled = false;
            
            currentFrameIndex = 0;
            
            function playNextFrame() {
                if (currentFrameIndex >= extractedFrames.length) {
                    currentFrameIndex = 0; // 循环播放
                }
                
                previewImage.src = extractedFrames[currentFrameIndex];
                currentFrameIndex++;
            }
            
            // 立即播放第一帧
            playNextFrame();
            
            // 设置间隔播放
            playbackInterval = setInterval(playNextFrame, frameDuration * 1000);
        }
        
        // 停止播放
        function stopFrames() {
            if (playbackInterval) {
                clearInterval(playbackInterval);
                playbackInterval = null;
            }
            
            const previewImage = document.getElementById('previewImage');
            const previewText = document.getElementById('previewText');
            
            // 显示文本，隐藏图片
            previewText.style.display = 'block';
            previewImage.style.display = 'none';
            
            // 启用播放按钮，禁用停止按钮
            document.getElementById('playFramesControlBtn').disabled = extractedFrames.length === 0;
            document.getElementById('stopFramesBtn').disabled = true;
        }
        
        // 提取帧
        async function extractFrames() {
            if (!videoFile || !videoElement) {
                showError('请先上传视频文件');
                return;
            }
            
            showError('');
            
            try {
                // 等待视频加载完成
                await new Promise((resolve) => {
                    if (videoElement.readyState >= 2) {
                        resolve();
                    } else {
                        videoElement.addEventListener('loadedmetadata', resolve);
                    }
                });
                
                const duration = videoElement.duration;
                const method = document.getElementById('extractMethod').value;
                const quality = 0.9; // 使用默认值
                const framesContainer = document.getElementById('framesContainer');
                
                framesContainer.innerHTML = '';
                extractedFrames = []; // 清空之前的帧
                document.getElementById('playFramesControlBtn').disabled = true;
                document.getElementById('stopFramesBtn').disabled = true;
                stopFrames(); // 停止任何正在进行的播放
                
                let timePoints = [];
                
                switch (method) {
                    case 'interval':
                        const interval = parseFloat(document.getElementById('interval').value);
                        for (let t = 0; t < duration; t += interval) {
                            timePoints.push(t);
                        }
                        break;
                    
                    case 'specific':
                        const pointsStr = document.getElementById('timePoints').value;
                        timePoints = pointsStr.split(',').map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
                        break;
                    
                    case 'total':
                        const totalFrames = parseInt(document.getElementById('totalFrames').value);
                        for (let i = 0; i < totalFrames; i++) {
                            const t = (i / (totalFrames - 1)) * duration;
                            timePoints.push(t);
                        }
                        break;
                    
                    case 'startEnd':
                        timePoints = await detectStartEndFrames();
                        break;
                }
                
                console.log('Extracting frames with watermark removal:', document.getElementById('removeWatermark').checked);
                console.log('Watermark area:', watermarkArea);
                
                // 提取帧
                for (let i = 0; i < timePoints.length; i++) {
                    const time = timePoints[i];
                    await extractFrameAtTime(time, i, quality);
                }
                
                if (timePoints.length === 0) {
                    showError('未设置有效的提取参数');
                }
                
            } catch (error) {
                console.error('提取帧时出错:', error);
                showError('提取帧时出错，请重试');
            }
        }
        
        // 首尾帧检测算法
        async function detectStartEndFrames() {
            const startTime = parseFloat(document.getElementById('startTime').value);
            const firstFrameTime = parseFloat(document.getElementById('firstFrameTime').value);
            const totalFrames = parseInt(document.getElementById('totalFrames').value);
            const step = parseFloat(document.getElementById('detectionStep').value);
            const threshold = parseFloat(document.getElementById('detectionThreshold').value);
            const maxDetectionDuration = parseFloat(document.getElementById('maxDetectionTime').value);
            
            // 获取用户指定时间的首帧作为参考帧
            const referenceFrame = await getFrameAtTime(firstFrameTime);
            
            // 从指定时间开始检测（从首帧时间点之后开始）
            let currentTime = Math.max(firstFrameTime + startTime, firstFrameTime + 0.1); // 确保从首帧时间之后开始
            const maxDetectionTime = Math.min(currentTime + maxDetectionDuration, videoElement.duration);
            
            let endFrameTime = -1;
            let bestMatchTime = -1;
            let bestMatchDiff = Infinity;
            
            // 第一次扫描，寻找最佳匹配
            while (currentTime < maxDetectionTime) {
                const currentFrame = await getFrameAtTime(currentTime);
                
                // 计算差异
                const data1 = referenceFrame.data;
                const data2 = currentFrame.data;
                let diff = 0;
                
                for (let i = 0; i < data1.length; i += 4) {
                    diff += Math.abs(data1[i] - data2[i]);     // R
                    diff += Math.abs(data1[i+1] - data2[i+1]); // G
                    diff += Math.abs(data1[i+2] - data2[i+2]); // B
                }
                
                const avgDiff = diff / (data1.length / 4 * 3);
                
                // 记录最佳匹配
                if (avgDiff < bestMatchDiff) {
                    bestMatchDiff = avgDiff;
                    bestMatchTime = currentTime;
                }
                
                // 如果找到足够相似的帧，直接返回
                if (avgDiff < threshold) {
                    endFrameTime = currentTime;
                    break;
                }
                
                currentTime += step;
            }
            
            // 如果没有找到完全匹配的帧，使用最佳匹配
            if (endFrameTime === -1 && bestMatchTime !== -1) {
                endFrameTime = bestMatchTime;
            }
            
            if (endFrameTime === -1) {
                showError('未找到与首帧相似的帧');
                return [];
            }
            
            // 从首帧时间点到endFrameTime分为帧数段，提取每段第一帧
            const timePoints = [];
            const segmentLength = (endFrameTime - firstFrameTime) / totalFrames;
            for (let i = 0; i < totalFrames; i++) {
                const t = firstFrameTime + (i * segmentLength);
                timePoints.push(t);
            }
            
            return timePoints;
        }
        
        // 获取指定时间的帧
        function getFrameAtTime(time) {
            return new Promise((resolve) => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                videoElement.currentTime = time;
                
                videoElement.addEventListener('seeked', () => {
                    canvas.width = videoElement.videoWidth;
                    canvas.height = videoElement.videoHeight;
                    
                    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                    
                    // 获取图像数据
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    resolve(imageData);
                }, { once: true });
            });
        }
        
        // 比较两个帧是否相同
        async function compareFrames(frame1, frame2) {
            // 简单的像素比较算法
            const data1 = frame1.data;
            const data2 = frame2.data;
            
            if (data1.length !== data2.length) {
                return false;
            }
            
            // 计算差异
            let diff = 0;
            
            for (let i = 0; i < data1.length; i += 4) {
                // 比较RGB值
                diff += Math.abs(data1[i] - data2[i]);     // R
                diff += Math.abs(data1[i+1] - data2[i+1]); // G
                diff += Math.abs(data1[i+2] - data2[i+2]); // B
            }
            
            // 计算平均差异
            const avgDiff = diff / (data1.length / 4 * 3);
            
            // 如果平均差异小于阈值，则认为是相同帧
            // 使用一个更宽松的阈值，提高检测成功率
            return avgDiff < 20;
        }
        
        let backgroundColor = null;
        
        // 在指定时间提取帧
        function extractFrameAtTime(time, index, quality) {
            return new Promise((resolve) => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                videoElement.currentTime = time;
                
                videoElement.addEventListener('seeked', () => {
                    canvas.width = videoElement.videoWidth;
                    canvas.height = videoElement.videoHeight;
                    
                    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                    
                    // 应用去水印处理
                    const removeWatermarkEnabled = document.getElementById('removeWatermark').checked;
                    console.log('Remove watermark enabled:', removeWatermarkEnabled);
                    console.log('Watermark area exists:', !!watermarkArea);
                    
                    if (removeWatermarkEnabled && watermarkArea) {
                        console.log('Applying watermark removal with area:', watermarkArea);
                        removeWatermark(canvas, ctx, watermarkArea);
                    }
                    
                    // 应用去背景色处理
                    if (document.getElementById('removeBackground').checked) {
                        removeBackgroundColor(canvas, ctx);
                    }
                    
                    const saveFormat = document.getElementById('saveFormat').value;
                    const mimeType = saveFormat === 'png' ? 'image/png' : 'image/jpeg';
                    
                    canvas.toBlob((blob) => {
                        const frameURL = URL.createObjectURL(blob);
                        displayFrame(frameURL, time, index);
                        resolve();
                    }, mimeType, quality);
                }, { once: true });
            });
        }
        
        // 去背景色处理
        function removeBackgroundColor(canvas, ctx) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const tolerance = parseInt(document.getElementById('colorTolerance').value);
            const edgeRemoval = document.getElementById('edgeRemoval').checked;
            const continuousRemoval = document.getElementById('continuousRemoval').checked;
            const removalMode = continuousRemoval ? 'continuous' : 'full';
            
            // 如果还没有选择背景色，使用左上角像素作为背景色
            if (!backgroundColor) {
                backgroundColor = {
                    r: data[0],
                    g: data[1],
                    b: data[2]
                };
            }
            
            if (removalMode === 'full') {
                // 全图去色：遍历所有像素
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // 计算与背景色的距离
                    const distance = Math.sqrt(
                        Math.pow(r - backgroundColor.r, 2) +
                        Math.pow(g - backgroundColor.g, 2) +
                        Math.pow(b - backgroundColor.b, 2)
                    );
                    
                    if (edgeRemoval) {
                        // 穿透边缘去色：根据距离计算透明度
                        if (distance < tolerance) {
                            // 完全透明
                            data[i + 3] = 0;
                        } else if (distance < tolerance * 2) {
                            // 半透明过渡
                            const alpha = Math.round(((distance - tolerance) / tolerance) * 255);
                            data[i + 3] = alpha;
                        }
                        // 距离大于容差的2倍，保持原透明度
                    } else {
                        // 普通去色：只处理完全匹配的像素
                        if (distance < tolerance) {
                            data[i + 3] = 0; // 设置alpha通道为0（透明）
                        }
                    }
                }
            } else {
                // 连续去色：只去除与边缘连续的背景色
                const width = canvas.width;
                const height = canvas.height;
                const visited = new Array(width * height).fill(false);
                const queue = [];
                
                // 从图像边缘开始
                // 顶部和底部边缘
                for (let x = 0; x < width; x++) {
                    queue.push({ x, y: 0 });
                    queue.push({ x, y: height - 1 });
                }
                // 左侧和右侧边缘
                for (let y = 1; y < height - 1; y++) {
                    queue.push({ x: 0, y });
                    queue.push({ x: width - 1, y });
                }
                
                // 洪水填充算法
                while (queue.length > 0) {
                    const { x, y } = queue.shift();
                    const index = (y * width + x) * 4;
                    
                    if (x < 0 || x >= width || y < 0 || y >= height || visited[y * width + x]) {
                        continue;
                    }
                    
                    visited[y * width + x] = true;
                    
                    const r = data[index];
                    const g = data[index + 1];
                    const b = data[index + 2];
                    
                    // 计算与背景色的距离
                    const distance = Math.sqrt(
                        Math.pow(r - backgroundColor.r, 2) +
                        Math.pow(g - backgroundColor.g, 2) +
                        Math.pow(b - backgroundColor.b, 2)
                    );
                    
                    if (distance < tolerance) {
                        // 匹配背景色，设置为透明
                        if (edgeRemoval) {
                            if (distance < tolerance) {
                                // 完全透明
                                data[index + 3] = 0;
                            } else if (distance < tolerance * 2) {
                                // 半透明过渡
                                const alpha = Math.round(((distance - tolerance) / tolerance) * 255);
                                data[index + 3] = alpha;
                            }
                        } else {
                            data[index + 3] = 0;
                        }
                        
                        // 继续处理相邻像素
                        queue.push({ x: x + 1, y });
                        queue.push({ x: x - 1, y });
                        queue.push({ x, y: y + 1 });
                        queue.push({ x, y: y - 1 });
                    }
                }
            }
            
            // 将处理后的数据放回画布
            ctx.putImageData(imageData, 0, 0);
        }
        
        // 去水印处理
        function removeWatermark(canvas, ctx, watermarkArea) {
            console.log('Removing watermark with area:', watermarkArea);
            
            const width = canvas.width;
            const height = canvas.height;
            
            // 计算水印区域的实际像素位置
            const x = Math.round(watermarkArea.left * width);
            const y = Math.round(watermarkArea.top * height);
            const w = Math.round(watermarkArea.width * width);
            const h = Math.round(watermarkArea.height * height);
            
            console.log('Watermark pixel area:', { x, y, w, h });
            
            // 确保水印区域在画布范围内
            const safeX = Math.max(0, x);
            const safeY = Math.max(0, y);
            const safeW = Math.min(w, width - safeX);
            const safeH = Math.min(h, height - safeY);
            
            console.log('Safe watermark area:', { safeX, safeY, safeW, safeH });
            
            // 获取背景色
            let fillColor = '#ffffff'; // 默认白色
            if (backgroundColor) {
                fillColor = `rgb(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b})`;
            }
            console.log('Using fill color:', fillColor);
            
            // 填充水印区域为纯色背景色
            ctx.fillStyle = fillColor;
            ctx.fillRect(safeX, safeY, safeW, safeH);
        }
        
        // 显示提取的帧
        function displayFrame(frameURL, time, index) {
            const framesContainer = document.getElementById('framesContainer');
            
            const frameItem = document.createElement('div');
            frameItem.className = 'frame-item';
            
            frameItem.innerHTML = `
                <div class="frame-image-container">
                    <img src="${frameURL}" class="frame-image" alt="帧 ${index + 1}" style="cursor: pointer;">
                </div>
                <div class="frame-info">
                    <p>帧 ${index + 1}</p>
                    <p>${formatTime(time)}</p>
                    <div style="display: flex; gap: 5px;">
                        <button class="download-btn" onclick="downloadFrame('${frameURL}', ${index + 1})"><span class="download-icon"></span> 保存</button>
                        <button class="download-btn delete-btn" style="background-color: #e74c3c;"><span class="delete-icon"></span> 删除</button>
                    </div>
                </div>
            `;
            
            framesContainer.appendChild(frameItem);
            
            // 添加图片点击事件
            const imgElement = frameItem.querySelector('.frame-image');
            imgElement.addEventListener('click', function() {
                previewImage(frameURL);
            });
            
            // 保存帧URL
            extractedFrames.push(frameURL);
            
            // 添加删除按钮事件监听器
            const deleteBtn = frameItem.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', function() {
                // 从界面上删除帧卡片
                frameItem.remove();
                
                // 从extractedFrames数组中移除对应的帧URL
                const frameIndex = extractedFrames.indexOf(frameURL);
                if (frameIndex > -1) {
                    extractedFrames.splice(frameIndex, 1);
                }
                
                // 如果没有帧了，禁用播放按钮和打包下载按钮
                if (extractedFrames.length === 0) {
                    document.getElementById('playFramesControlBtn').disabled = true;
                    document.getElementById('stopFramesBtn').disabled = true;
                    document.getElementById('zipAllFramesBtn').disabled = true;
                }
            });
            
            // 如果是第一帧，填充全局宽度和高度默认值
            if (index === 0) {
                // 加载图片后填充全局宽度和高度默认值
                imgElement.onload = function() {
                    const globalWidthInput = document.getElementById('globalWidth');
                    const globalHeightInput = document.getElementById('globalHeight');
                    globalWidthInput.value = imgElement.naturalWidth;
                    globalHeightInput.value = imgElement.naturalHeight;
                };
            }
            
            // 启用播放按钮和打包下载按钮
            if (extractedFrames.length > 0) {
                document.getElementById('playFramesControlBtn').disabled = false;
                document.getElementById('stopFramesBtn').disabled = false;
                document.getElementById('zipAllFramesBtn').disabled = false;
            }
        }
        
        // 预览图片
        function previewImage(imageURL) {
            const modal = document.getElementById('imagePreviewModal');
            const modalImage = document.getElementById('previewModalImage');
            
            modalImage.src = imageURL;
            modal.style.display = 'flex';
        }
        
        // 关闭图片预览
        function closeImagePreview() {
            document.getElementById('imagePreviewModal').style.display = 'none';
        }
        
        // 更新第一帧预览
        function updateFirstFramePreview(frameURL) {
            const firstFramePreview = document.getElementById('firstFramePreview');
            firstFramePreview.src = frameURL;
            
            // 添加点击选择背景色的事件
            firstFramePreview.onclick = function(e) {
                const rect = firstFramePreview.getBoundingClientRect();
                const x = Math.round((e.clientX - rect.left) * (firstFramePreview.naturalWidth / rect.width));
                const y = Math.round((e.clientY - rect.top) * (firstFramePreview.naturalHeight / rect.height));
                
                // 创建临时canvas来获取像素数据
                const canvas = document.createElement('canvas');
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    const pixel = ctx.getImageData(x, y, 1, 1).data;
                    backgroundColor = {
                        r: pixel[0],
                        g: pixel[1],
                        b: pixel[2]
                    };
                    
                    // 更新颜色显示
                    updateColorDisplay();
                };
                img.src = frameURL;
            };
        }
        
        // 更新颜色显示
        function updateColorDisplay() {
            if (backgroundColor) {
                const hexColor = rgbToHex(backgroundColor.r, backgroundColor.g, backgroundColor.b);
                document.getElementById('backgroundColorPicker').value = hexColor;
                document.getElementById('currentColorDisplay').textContent = hexColor;
            }
        }
        
        // RGB转HEX
        function rgbToHex(r, g, b) {
            return '#' + [r, g, b].map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
        }
        
        // HEX转RGB
        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }
        
        // 打开水印选择模态框
        function openWatermarkSelection() {
            if (!videoElement) {
                showError('请先上传视频文件');
                return;
            }
            
            // 捕获第一帧作为水印选择的预览
            videoElement.currentTime = 0;
            
            videoElement.addEventListener('seeked', () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                
                const frameURL = canvas.toDataURL('image/png');
                
                // 更新水印预览
                const watermarkPreview = document.getElementById('watermarkPreview');
                watermarkPreview.src = frameURL;
                
                // 图片加载完成后更新预览
                watermarkPreview.onload = function() {
                    updateWatermarkPreview();
                };
                
                // 更新选择模态框中的图像
                const selectionImage = document.getElementById('watermarkSelectionImage');
                selectionImage.src = frameURL;
                
                // 显示模态框
                document.getElementById('watermarkSelectionModal').style.display = 'flex';
                
                // 初始化框选功能
                initWatermarkSelection(selectionImage);
            }, { once: true });
        }
        
        // 初始化水印选择
        function initWatermarkSelection(imageElement) {
            let isSelecting = false;
            let startX = 0;
            let startY = 0;
            const selectionBox = document.getElementById('selectionBox');
            
            imageElement.addEventListener('mousedown', (e) => {
                isSelecting = true;
                const imageRect = imageElement.getBoundingClientRect();
                startX = e.clientX - imageRect.left;
                startY = e.clientY - imageRect.top;
                selectionBox.style.display = 'block';
                selectionBox.style.left = `${startX}px`;
                selectionBox.style.top = `${startY}px`;
                selectionBox.style.width = '0px';
                selectionBox.style.height = '0px';
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isSelecting) return;
                
                const imageRect = imageElement.getBoundingClientRect();
                const currentX = e.clientX - imageRect.left;
                const currentY = e.clientY - imageRect.top;
                
                const left = Math.min(startX, currentX);
                const top = Math.min(startY, currentY);
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);
                
                selectionBox.style.left = `${left}px`;
                selectionBox.style.top = `${top}px`;
                selectionBox.style.width = `${width}px`;
                selectionBox.style.height = `${height}px`;
            });
            
            document.addEventListener('mouseup', (e) => {
                if (!isSelecting) return;
                isSelecting = false;
                
                const imageRect = imageElement.getBoundingClientRect();
                const selectionRect = selectionBox.getBoundingClientRect();
                
                // 计算相对位置
                watermarkArea = {
                    left: (selectionRect.left - imageRect.left) / imageRect.width,
                    top: (selectionRect.top - imageRect.top) / imageRect.height,
                    width: selectionRect.width / imageRect.width,
                    height: selectionRect.height / imageRect.height
                };
                
                console.log('Selected watermark area:', watermarkArea);
                
                // 更新水印区域输入框
                document.getElementById('watermarkX').value = watermarkArea.left.toFixed(2);
                document.getElementById('watermarkY').value = watermarkArea.top.toFixed(2);
                document.getElementById('watermarkW').value = watermarkArea.width.toFixed(2);
                document.getElementById('watermarkH').value = watermarkArea.height.toFixed(2);
                
                // 启用输入框和更新按钮
                document.getElementById('watermarkX').disabled = false;
                document.getElementById('watermarkY').disabled = false;
                document.getElementById('watermarkW').disabled = false;
                document.getElementById('watermarkH').disabled = false;
                document.getElementById('updateWatermarkBtn').disabled = false;
                
                // 更新水印预览
                updateWatermarkPreview();
            });
        }
        
        // 确认水印选择
        function confirmWatermarkSelection() {
            closeWatermarkModal();
            // 更新水印预览
            updateWatermarkPreview();
        }
        
        // 关闭水印模态框
        function closeWatermarkModal() {
            document.getElementById('watermarkSelectionModal').style.display = 'none';
        }
        
        // 更新水印预览
        function updateWatermarkPreview() {
            const watermarkPreview = document.getElementById('watermarkPreview');
            const watermarkPreviewOverlay = document.getElementById('watermarkPreviewOverlay');
            
            if (watermarkArea && watermarkPreview.src) {
                // 确保图片加载完成
                if (watermarkPreview.complete) {
                    // 显示覆盖层
                    watermarkPreviewOverlay.style.display = 'block';
                    
                    // 获取图片的实际大小
                    const imgWidth = watermarkPreview.naturalWidth;
                    const imgHeight = watermarkPreview.naturalHeight;
                    
                    // 获取容器大小
                    const containerWidth = watermarkPreview.parentElement.clientWidth;
                    const containerHeight = watermarkPreview.parentElement.clientHeight;
                    
                    // 计算图片在容器中的缩放比例
                    const scaleX = containerWidth / imgWidth;
                    const scaleY = containerHeight / imgHeight;
                    const scale = Math.min(scaleX, scaleY);
                    
                    // 计算缩放后图片的大小
                    const scaledImgWidth = imgWidth * scale;
                    const scaledImgHeight = imgHeight * scale;
                    
                    // 计算图片在容器中的居中位置
                    const imgOffsetX = (containerWidth - scaledImgWidth) / 2;
                    const imgOffsetY = (containerHeight - scaledImgHeight) / 2;
                    
                    // 计算水印区域在缩放后图片上的位置和大小
                    const overlayLeft = watermarkArea.left * scaledImgWidth;
                    const overlayTop = watermarkArea.top * scaledImgHeight;
                    const overlayWidth = watermarkArea.width * scaledImgWidth;
                    const overlayHeight = watermarkArea.height * scaledImgHeight;
                    
                    // 计算在容器中的绝对位置
                    const absoluteLeft = overlayLeft + imgOffsetX;
                    const absoluteTop = overlayTop + imgOffsetY;
                    
                    // 设置覆盖层样式
                    watermarkPreviewOverlay.style.left = `${absoluteLeft}px`;
                    watermarkPreviewOverlay.style.top = `${absoluteTop}px`;
                    watermarkPreviewOverlay.style.width = `${overlayWidth}px`;
                    watermarkPreviewOverlay.style.height = `${overlayHeight}px`;
                    watermarkPreviewOverlay.style.position = 'absolute';
                    watermarkPreviewOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
                    watermarkPreviewOverlay.style.border = '2px solid #ff0000';
                    watermarkPreviewOverlay.style.pointerEvents = 'none';
                } else {
                    // 图片未加载完成，等待加载后再更新
                    watermarkPreview.onload = updateWatermarkPreview;
                }
            } else {
                // 隐藏覆盖层
                watermarkPreviewOverlay.style.display = 'none';
            }
        }
        
        // 下载帧
        function downloadFrame(frameURL, frameIndex) {
            const saveFormat = document.getElementById('saveFormat').value;
            const mimeType = saveFormat === 'png' ? 'image/png' : 'image/jpeg';
            const extension = saveFormat;
            
            // 获取全局设置的宽度和高度
            const globalWidth = parseInt(document.getElementById('globalWidth').value) || 0;
            const globalHeight = parseInt(document.getElementById('globalHeight').value) || 0;
            const useOriginalRatio = document.getElementById('useOriginalRatio').checked;
            
            fetch(frameURL)
                .then(response => response.blob())
                .then(blob => {
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = function() {
                            // 创建画布
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            
                            // 设置画布大小
                            if (!useOriginalRatio && globalWidth > 0 && globalHeight > 0) {
                                canvas.width = globalWidth;
                                canvas.height = globalHeight;
                            } else {
                                canvas.width = img.width;
                                canvas.height = img.height;
                            }
                            
                            // 绘制图像
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            
                            // 转换为blob
                            canvas.toBlob(resolve, mimeType, 0.9);
                        };
                        img.src = URL.createObjectURL(blob);
                    });
                })
                .then(resizedBlob => {
                    const url = URL.createObjectURL(resizedBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `frame_${getCurrentTimeString()}_${frameIndex}.${extension}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
        }
        
        // 格式化时间
        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            const ms = Math.floor((seconds % 1) * 100);
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
        }
        
        // 获取当前时间的格式化字符串，用于文件名
        function getCurrentTimeString() {
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const seconds = now.getSeconds().toString().padStart(2, '0');
            return `${year}${month}${day}_${hours}${minutes}${seconds}`;
        }
        
        // 保存全部帧
        function saveAllFrames() {
            if (extractedFrames.length === 0) {
                showError('没有可保存的帧');
                return;
            }
            
            // 依次下载每个帧
            extractedFrames.forEach((frameURL, index) => {
                downloadFrame(frameURL, index + 1);
            });
        }
        
        // 打包下载所有帧
        async function zipAllFrames() {
            if (extractedFrames.length === 0) {
                showError('没有可打包的帧');
                return;
            }
            
            try {
                const zip = new JSZip();
                const folder = zip.folder('frames');
                
                // 为每个帧添加到ZIP文件
                for (let i = 0; i < extractedFrames.length; i++) {
                    const frameURL = extractedFrames[i];
                    const response = await fetch(frameURL);
                    const blob = await response.blob();
                    folder.file(`frame_${i + 1}.png`, blob);
                }
                
                // 生成ZIP文件并下载
                const content = await zip.generateAsync({ type: 'blob' });
                saveAs(content, `frames_${getCurrentTimeString()}.zip`);
            } catch (error) {
                console.error('打包下载失败:', error);
                showError('打包下载失败，请稍后重试');
            }
        }
        
        // 显示错误信息
        function showError(message) {
            document.getElementById('errorMessage').textContent = message;
        }
        
        // 页面加载完成后初始化
        document.addEventListener('DOMContentLoaded', init);