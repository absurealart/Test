// ===== Image Generator Module =====
const ImageGenerator = (function() {
    // DOM Elements
    let promptInput, negativePromptInput, widthSelect, heightSelect, styleSelect, techniqueSelect;
    let stepsInput, stepsValue, samplerSelect, imageFormatSelect, qualityEnhanceSelect;
    let seedInput, modelSelect, safeModeCheckbox, watermarkCheckbox, imageCountSelect, enhanceCheckbox;
    let generateBtn, generateBtnText, generateSpinner, downloadBtn, randomizeBtn;
    let generatedImage, loadingSpinner, placeholder, historyList, previewContainer;
    let clearPromptBtn, fullscreenBtn, fullscreenOverlay, fullscreenTextarea, closeFullscreen;

    // Data
    let techniquesData = [];
    let stylesData = [];
    let modelsData = [];
    let translationEngineLoaded = false;

    // State
    let generationHistory = JSON.parse(localStorage.getItem('generationHistory')) || [];
    let currentImageUrls = [];
    let currentGenerationParams = {};
    
    // API Configuration
    const API_BASE_URL = 'https://gen.pollinations.ai';
    const API_KEY = 'sk_UwCiH4XpEOiVRVEIqOtKLr12k18y0LK2'; // Ganti dengan API key Anda
    
    // Zoom State
    let currentZoomLevel = 1;
    const ZOOM_INCREMENT = 0.2;
    const MAX_ZOOM = 3;
    const MIN_ZOOM = 0.5;
    let zoomControlsContainer;
    let isDragging = false;
    let startX, startY, scrollLeft, scrollTop;
    let zoomEnabled = false;

    // Initialize
    async function init() {
        setupDOMReferences();
        setupEventListeners();
        await loadExternalData();
        updateHistoryDisplay();
        await loadTranslationEngine();
        createZoomControls();
        setupImageDrag();
    }

    function setupDOMReferences() {
        promptInput = document.getElementById('prompt');
        negativePromptInput = document.getElementById('negativePrompt');
        widthSelect = document.getElementById('width');
        heightSelect = document.getElementById('height');
        styleSelect = document.getElementById('style');
        techniqueSelect = document.getElementById('technique');
        stepsInput = document.getElementById('steps');
        stepsValue = document.getElementById('stepsValue');
        samplerSelect = document.getElementById('sampler');
        imageFormatSelect = document.getElementById('imageFormat');
        qualityEnhanceSelect = document.getElementById('qualityEnhance');
        seedInput = document.getElementById('seed');
        modelSelect = document.getElementById('model');
        safeModeCheckbox = document.getElementById('safeMode');
        watermarkCheckbox = document.getElementById('watermark');
        imageCountSelect = document.getElementById('imageCount');
        enhanceCheckbox = document.getElementById('enhancePrompt');
        generateBtn = document.getElementById('generateBtn');
        generateBtnText = document.getElementById('generateBtnText');
        generateSpinner = document.getElementById('generateSpinner');
        downloadBtn = document.getElementById('downloadBtn');
        randomizeBtn = document.getElementById('randomizeBtn');
        generatedImage = document.getElementById('generatedImage');
        loadingSpinner = document.getElementById('loadingSpinner');
        placeholder = document.getElementById('placeholder');
        historyList = document.getElementById('historyList');
        previewContainer = document.getElementById('previewContainer');
        clearPromptBtn = document.getElementById('clearPrompt');
        fullscreenBtn = document.getElementById('fullscreenBtn');
        fullscreenOverlay = document.getElementById('fullscreenOverlay');
        fullscreenTextarea = document.getElementById('fullscreenTextarea');
        closeFullscreen = document.getElementById('closeFullscreen');
    }

    // Create zoom controls dynamically
    function createZoomControls() {
        if (!previewContainer) return;

        // Create container for zoom controls
        zoomControlsContainer = document.createElement('div');
        zoomControlsContainer.className = 'zoom-controls-container';
        Object.assign(zoomControlsContainer.style, {
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            display: 'flex',
            gap: '5px',
            zIndex: '10',
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderRadius: '8px',
            padding: '8px',
            opacity: '0.5',
            transition: 'opacity 0.3s ease'
        });

        // Create zoom in button
        const zoomInBtn = createZoomButton('+', 'Zoom In', zoomIn);
        
        // Create zoom out button
        const zoomOutBtn = createZoomButton('-', 'Zoom Out', zoomOut);
        
        // Create reset zoom button
        const resetZoomBtn = createZoomButton('↻', 'Reset Zoom', resetZoom);
        resetZoomBtn.disabled = true;

        // Create enable zoom button
        const enableZoomBtn = createZoomButton('🔍', 'Enable Zoom', toggleZoom);
        enableZoomBtn.style.backgroundColor = 'rgba(255,255,255,0.2)';

        // Append buttons to container
        zoomControlsContainer.appendChild(enableZoomBtn);
        zoomControlsContainer.appendChild(zoomInBtn);
        zoomControlsContainer.appendChild(zoomOutBtn);
        zoomControlsContainer.appendChild(resetZoomBtn);

        // Style preview container
        Object.assign(previewContainer.style, {
            position: 'relative',
            overflow: 'auto',
            cursor: 'default'
        });

        // Style generated image
        if (generatedImage) {
            Object.assign(generatedImage.style, {
                transformOrigin: '0 0',
                transition: 'transform 0.1s ease-out',
                display: 'block',
                maxWidth: 'none'
            });
        }

        // Add to DOM
        previewContainer.appendChild(zoomControlsContainer);
    }

    function createZoomButton(text, title, clickHandler) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.title = title;
        Object.assign(btn.style, {
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '14px',
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
        });
        
        btn.addEventListener('mouseenter', function() {
            this.style.backgroundColor = 'rgba(255,255,255,0.2)';
        });
        
        btn.addEventListener('mouseleave', function() {
            if (!this.disabled) {
                this.style.backgroundColor = 'transparent';
            }
        });
        
        btn.addEventListener('click', clickHandler);
        return btn;
    }

    function setupImageDrag() {
        if (!previewContainer) return;

        previewContainer.addEventListener('mousedown', (e) => {
            if (!zoomEnabled || currentZoomLevel <= 1) return;
            
            isDragging = true;
            startX = e.pageX - previewContainer.offsetLeft;
            startY = e.pageY - previewContainer.offsetTop;
            scrollLeft = previewContainer.scrollLeft;
            scrollTop = previewContainer.scrollTop;
            previewContainer.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !zoomEnabled) return;
            
            e.preventDefault();
            const x = e.pageX - previewContainer.offsetLeft;
            const y = e.pageY - previewContainer.offsetTop;
            const walkX = (x - startX) * 2;
            const walkY = (y - startY) * 2;
            previewContainer.scrollLeft = scrollLeft - walkX;
            previewContainer.scrollTop = scrollTop - walkY;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            if (zoomEnabled) {
                previewContainer.style.cursor = 'grab';
            } else {
                previewContainer.style.cursor = 'default';
            }
        });
    }

    function toggleZoom() {
        zoomEnabled = !zoomEnabled;
        
        if (zoomEnabled) {
            previewContainer.style.cursor = 'grab';
            zoomControlsContainer.style.opacity = '1';
            showNotification('Zoom enabled. Use mouse wheel or buttons to zoom.');
        } else {
            previewContainer.style.cursor = 'default';
            zoomControlsContainer.style.opacity = '0.5';
            resetZoom();
            showNotification('Zoom disabled.');
        }
        
        updateZoomButtons();
    }

    function zoomIn() {
        if (!zoomEnabled || currentZoomLevel >= MAX_ZOOM) return;
        currentZoomLevel = Math.min(currentZoomLevel + ZOOM_INCREMENT, MAX_ZOOM);
        applyZoom();
    }

    function zoomOut() {
        if (!zoomEnabled || currentZoomLevel <= MIN_ZOOM) return;
        currentZoomLevel = Math.max(currentZoomLevel - ZOOM_INCREMENT, MIN_ZOOM);
        applyZoom();
    }

    function resetZoom() {
        if (!zoomEnabled) return;
        currentZoomLevel = 1;
        applyZoom();
        if (previewContainer) {
            previewContainer.scrollTo({
                top: 0,
                left: 0,
                behavior: 'smooth'
            });
        }
    }

    function applyZoom() {
        if (!generatedImage || !generatedImage.src || !zoomEnabled) return;
        
        generatedImage.style.transform = `scale(${currentZoomLevel})`;
        updateZoomButtons();
        showNotification(`Zoom: ${Math.round(currentZoomLevel * 100)}%`, 1500);
    }

    function updateZoomButtons() {
        if (!zoomControlsContainer) return;
        
        const buttons = zoomControlsContainer.querySelectorAll('button');
        if (buttons.length >= 4) {
            buttons[0].style.backgroundColor = zoomEnabled ? 'rgba(100,149,237,0.7)' : 'rgba(255,255,255,0.2)';
            buttons[1].disabled = !zoomEnabled || currentZoomLevel >= MAX_ZOOM;
            buttons[2].disabled = !zoomEnabled || currentZoomLevel <= MIN_ZOOM;
            buttons[3].disabled = !zoomEnabled || currentZoomLevel === 1;
            zoomControlsContainer.style.opacity = zoomEnabled ? '1' : '0.5';
        }
    }

    // Load translation engine
    async function loadTranslationEngine() {
        if (window.Translate && window.Translate.Translate) {
            translationEngineLoaded = true;
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@translate-tools/core/dist/translate.min.js';
            script.onload = () => {
                translationEngineLoaded = true;
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        }).catch(error => {
            console.error('Failed to load translation engine:', error);
            translationEngineLoaded = false;
        });
    }

    async function loadExternalData() {
        showNotification('Loading configuration...', 2000);
        
        try {
            // Load techniques data from teknik.json
            try {
                const techResponse = await fetch('teknik.json');
                if (techResponse.ok) {
                    techniquesData = await techResponse.json();
                    console.log('Loaded techniques:', techniquesData);
                    populateTechniqueDropdown();
                } else {
                    throw new Error('Failed to load teknik.json');
                }
            } catch (error) {
                console.error('Error loading techniques:', error);
                techniquesData = getDefaultTechniques();
                populateTechniqueDropdown();
            }

            // Load styles data from style.json
            try {
                const stylesResponse = await fetch('style.json');
                if (stylesResponse.ok) {
                    stylesData = await stylesResponse.json();
                    console.log('Loaded styles:', stylesData);
                    populateStyleDropdown();
                } else {
                    throw new Error('Failed to load style.json');
                }
            } catch (error) {
                console.error('Error loading styles:', error);
                stylesData = getDefaultStyles();
                populateStyleDropdown();
            }

            // Load models data
            modelsData = getDefaultModels();
            populateModelDropdown();
            
            showNotification('Configuration loaded successfully!', 2000);
        } catch (error) {
            console.error('Error loading external data:', error);
            showNotification('Error loading configuration, using default settings', 3000);
        }
    }

    function getDefaultTechniques() {
        return [
            {
                "id": "hyper-detailed",
                "name": "Hyper Detailed",
                "prompt": "hyperdetailed, intricate details, sharp focus, 8k resolution, photorealistic, professional photography",
                "negativePrompt": "blurry, low quality, low resolution, simple, plain"
            },
            {
                "id": "cinematic",
                "name": "Cinematic",
                "prompt": "cinematic still, dramatic lighting, film grain, shallow depth of field, 35mm film",
                "negativePrompt": "flat lighting, video game, CGI render, digital art"
            },
            {
                "id": "minimalist",
                "name": "Minimalist",
                "prompt": "minimalist, simple composition, clean lines, negative space, monochromatic",
                "negativePrompt": "cluttered, busy, detailed, complex, colorful"
            }
        ];
    }

    function getDefaultStyles() {
        return [
            {
                "id": "photographic",
                "name": "Photographic",
                "prompt": "photorealistic, 35mm film, bokeh, natural lighting, professional photography",
                "negativePrompt": "illustration, drawing, painting, cartoon, CGI"
            },
            {
                "id": "anime",
                "name": "Anime",
                "prompt": "anime style, vibrant colors, expressive eyes, detailed background, studio ghibli",
                "negativePrompt": "realistic, photorealistic, western animation, 3D render"
            },
            {
                "id": "oil-painting",
                "name": "Oil Painting",
                "prompt": "oil painting, brush strokes, textured canvas, impasto technique, old master style",
                "negativePrompt": "digital art, smooth, photorealistic, vector art"
            }
        ];
    }

    function getDefaultModels() {
        return [
            "flux",
            "flux-realism",
            "flux-anime",
            "flux-cablyai",
            "flux-3d",
            "any-dark"
        ];
    }

    function populateTechniqueDropdown() {
        techniqueSelect.innerHTML = '';
        const defaultTechOption = document.createElement('option');
        defaultTechOption.value = '';
        defaultTechOption.textContent = 'None';
        techniqueSelect.appendChild(defaultTechOption);
        
        techniquesData.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech.id;
            option.textContent = tech.name || tech.id;
            techniqueSelect.appendChild(option);
        });
    }

    function populateStyleDropdown() {
        styleSelect.innerHTML = '';
        const defaultStyleOption = document.createElement('option');
        defaultStyleOption.value = '';
        defaultStyleOption.textContent = 'None';
        styleSelect.appendChild(defaultStyleOption);
        
        stylesData.forEach(style => {
            const option = document.createElement('option');
            option.value = style.id;
            option.textContent = style.name || style.id;
            styleSelect.appendChild(option);
        });
    }

    function populateModelDropdown() {
        modelSelect.innerHTML = '';
        
        modelsData.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            modelSelect.appendChild(option);
        });
        
        // Set default model to flux
        if (modelsData.length > 0) {
            modelSelect.value = 'flux';
        }
    }

    function setupEventListeners() {
        stepsInput.addEventListener('input', function() {
            stepsValue.textContent = this.value;
        });

        clearPromptBtn.addEventListener('click', function() {
            promptInput.value = '';
            promptInput.focus();
            showNotification('Prompt cleared');
        });

        document.getElementById('clearNegativePrompt').addEventListener('click', function() {
            negativePromptInput.value = '';
            negativePromptInput.focus();
            showNotification('Negative prompt cleared');
        });

        randomizeBtn.addEventListener('click', generateVariation);
        generateBtn.addEventListener('click', generateImage);
        downloadBtn.addEventListener('click', downloadImage);
        fullscreenBtn.addEventListener('click', openFullscreenEditor);
        closeFullscreen.addEventListener('click', closeFullscreenEditor);
        
        // Add event listener for mouse wheel zoom
        previewContainer.addEventListener('wheel', function(e) {
            if (!zoomEnabled) return;
            
            e.preventDefault();
            if (e.deltaY < 0) {
                zoomIn();
            } else {
                zoomOut();
            }
        });

        // Enter key to generate
        promptInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                generateImage();
            }
        });
    }

    async function translateToEnglish(text) {
        if (!text || !text.trim()) return text;
        
        const englishRegex = /[a-zA-Z]/;
        const nonEnglishRegex = /[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/;
        
        if (englishRegex.test(text) && !nonEnglishRegex.test(text)) {
            return text;
        }
        
        if (!translationEngineLoaded) {
            console.warn('Translation engine not loaded, using original text');
            return text;
        }
        
        try {
            const translator = new TranslateTools.Translate();
            const result = await translator.translate(text, 'en');
            return result || text;
        } catch (error) {
            console.error('Translation error:', error);
            return text;
        }
    }

    async function generateImage() {
        let prompt = promptInput.value.trim();
        if (!prompt) {
            showNotification('Please enter a prompt', 3000, true);
            return;
        }
        
        generateBtn.disabled = true;
        generateBtnText.textContent = 'Translating...';
        generateSpinner.classList.remove('hidden');
        
        try {
            const translatedPrompt = await translateToEnglish(prompt);
            if (translatedPrompt && translatedPrompt !== prompt) {
                promptInput.value = translatedPrompt;
                prompt = translatedPrompt;
            }
        } catch (error) {
            console.error('Translation failed:', error);
        } finally {
            generateBtnText.textContent = 'Generate Image';
            generateSpinner.classList.add('hidden');
        }
        
        const selectedTechnique = techniquesData.find(t => t.id === techniqueSelect.value);
        const selectedStyle = stylesData.find(s => s.id === styleSelect.value);
        
        let fullPrompt = prompt;
        let fullNegativePrompt = negativePromptInput.value.trim() || "";
        
        if (selectedTechnique) {
            fullPrompt += `, ${selectedTechnique.prompt}`;
            if (selectedTechnique.negativePrompt) {
                fullNegativePrompt += fullNegativePrompt ? `, ${selectedTechnique.negativePrompt}` : selectedTechnique.negativePrompt;
            }
        }
        
        if (selectedStyle) {
            fullPrompt += `, ${selectedStyle.prompt}`;
            if (selectedStyle.negativePrompt) {
                fullNegativePrompt += fullNegativePrompt ? `, ${selectedStyle.negativePrompt}` : selectedStyle.negativePrompt;
            }
        }
        
        const imageCount = parseInt(imageCountSelect.value);
        
        currentGenerationParams = {
            prompt,
            negativePrompt: negativePromptInput.value.trim(),
            fullPrompt,
            fullNegativePrompt,
            width: widthSelect.value,
            height: heightSelect.value,
            style: styleSelect.value,
            technique: techniqueSelect.value,
            steps: stepsInput.value,
            sampler: samplerSelect.value,
            imageFormat: imageFormatSelect.value,
            qualityEnhance: qualityEnhanceSelect.value,
            seed: seedInput.value || Math.floor(Math.random() * 1000000),
            model: modelSelect.value,
            safe: !safeModeCheckbox.checked,
            watermark: watermarkCheckbox.checked,
            imageCount: imageCount,
            enhance: enhanceCheckbox ? enhanceCheckbox.checked : true
        };
        
        showLoadingState();
        
        // Clear previous images
        currentImageUrls = [];
        
        // Remove existing multiple images container if any
        const existingContainer = document.getElementById('multipleImagesContainer');
        if (existingContainer) {
            existingContainer.remove();
        }
        
        // Hide single image and show loading for multiple images
        generatedImage.style.display = 'none';
        
        // Create container for multiple images
        const generatedImagesContainer = document.createElement('div');
        generatedImagesContainer.id = 'multipleImagesContainer';
        generatedImagesContainer.className = `multiple-images-grid cols-${imageCount > 2 ? 2 : imageCount}`;
        
        previewContainer.appendChild(generatedImagesContainer);
        
        let completedGenerations = 0;
        const totalGenerations = imageCount;
        
        // Generate each image
        for (let i = 0; i < imageCount; i++) {
            const individualSeed = currentGenerationParams.seed ? 
                parseInt(currentGenerationParams.seed) + i : 
                Math.floor(Math.random() * 1000000);
            
            // Encode the prompt for URL
            const encodedPrompt = encodeURIComponent(fullPrompt);
            
            // Build the API URL with the new format
            let apiUrl = `${API_BASE_URL}/image/${encodedPrompt}?model=${currentGenerationParams.model}`;
            
            // Add authorization header with API key
            const headers = {
                'Authorization': `Bearer ${API_KEY}`
            };
            
            // Add optional parameters
            const params = new URLSearchParams();
            
            // Add width and height
            params.append('width', currentGenerationParams.width);
            params.append('height', currentGenerationParams.height);
            
            // Add seed
            params.append('seed', individualSeed);
            
            // Add negative prompt if exists
            if (fullNegativePrompt) {
                params.append('negative', fullNegativePrompt);
            }
            
            // Add steps
            if (currentGenerationParams.steps) {
                params.append('steps', currentGenerationParams.steps);
            }
            
            // Add sampler
            if (currentGenerationParams.sampler) {
                params.append('sampler', currentGenerationParams.sampler);
            }
            
            // Add quality enhancement
            if (currentGenerationParams.qualityEnhance !== '0') {
                params.append('quality', currentGenerationParams.qualityEnhance);
            }
            
            // Add enhance parameter
            if (currentGenerationParams.enhance) {
                params.append('enhance', 'true');
            }
            
            // Add safe mode
            if (!currentGenerationParams.safe) {
                params.append('safe', 'false');
            }
            
            // Add watermark
            if (currentGenerationParams.watermark) {
                params.append('watermark', 'absureal');
            }
            
            // Add image format
            if (currentGenerationParams.imageFormat !== 'jpg') {
                params.append('format', currentGenerationParams.imageFormat);
            }
            
            // Append parameters to URL
            if (params.toString()) {
                apiUrl += '&' + params.toString();
            }
            
            // Add timestamp to prevent caching
            apiUrl += `&t=${new Date().getTime()}`;
            
            const imgContainer = document.createElement('div');
            imgContainer.className = 'image-item relative';
            
            const img = document.createElement('img');
            img.className = 'generated-image w-full h-auto rounded-lg cursor-pointer';
            img.alt = `Generated image ${i + 1}`;
            
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg';
            loadingOverlay.innerHTML = `
                <div class="text-center text-white">
                    <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                    <p class="text-sm">Generating ${i + 1}/${imageCount}</p>
                </div>
            `;
            
            const imageNumberBadge = document.createElement('div');
            imageNumberBadge.className = 'image-count-badge';
            imageNumberBadge.textContent = `${i + 1}`;
            
            imgContainer.appendChild(img);
            imgContainer.appendChild(loadingOverlay);
            imgContainer.appendChild(imageNumberBadge);
            generatedImagesContainer.appendChild(imgContainer);
            
            // Add click event for individual image download
            img.addEventListener('click', function() {
                downloadSingleImage(apiUrl, i + 1);
            });
            
            // Create a new image object with headers
            const xhr = new XMLHttpRequest();
            xhr.open('GET', apiUrl, true);
            xhr.responseType = 'blob';
            
            // Add authorization header
            xhr.setRequestHeader('Authorization', `Bearer ${API_KEY}`);
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    const blob = xhr.response;
                    const url = URL.createObjectURL(blob);
                    
                    img.onload = function() {
                        loadingOverlay.remove();
                        completedGenerations++;
                        currentImageUrls.push({
                            url: url,
                            originalUrl: apiUrl,
                            index: i
                        });
                        
                        if (completedGenerations === totalGenerations) {
                            onAllImagesGenerated();
                        }
                    };
                    
                    img.src = url;
                } else {
                    loadingOverlay.innerHTML = `
                        <div class="text-center text-white">
                            <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                            <p class="text-sm">Failed to generate (${xhr.status})</p>
                        </div>
                    `;
                    completedGenerations++;
                    
                    if (completedGenerations === totalGenerations) {
                        onAllImagesGenerated();
                    }
                }
            };
            
            xhr.onerror = function() {
                loadingOverlay.innerHTML = `
                    <div class="text-center text-white">
                        <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                        <p class="text-sm">Network error</p>
                    </div>
                `;
                completedGenerations++;
                
                if (completedGenerations === totalGenerations) {
                    onAllImagesGenerated();
                }
            };
            
            xhr.send();
        }
    }

    function onAllImagesGenerated() {
        loadingSpinner.classList.add('hidden');
        generateBtn.disabled = false;
        randomizeBtn.disabled = false;
        downloadBtn.disabled = false;
        generateBtnText.textContent = 'Generate Image';
        generateSpinner.classList.add('hidden');
        
        // Add to history with multiple images
        addToHistory(
            currentGenerationParams.prompt, 
            currentGenerationParams.fullPrompt, 
            currentImageUrls.map(img => img.url)
        );
        
        showNotification(`Generated ${currentImageUrls.length} images successfully! Click on any image to download it individually.`);
    }

    function showLoadingState() {
        generatedImage.style.display = 'none';
        placeholder.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');
        generateBtn.disabled = true;
        randomizeBtn.disabled = true;
        downloadBtn.disabled = true;
        generateBtnText.textContent = 'Generating...';
        generateSpinner.classList.remove('hidden');
        
        // Reset zoom when generating new image
        if (zoomEnabled) {
            resetZoom();
        }
    }

    function generateVariation() {
        if (Object.keys(currentGenerationParams).length === 0) {
            showNotification('Generate an image first before creating variations', 3000, true);
            return;
        }
        
        seedInput.value = Math.floor(Math.random() * 1000000);
        generateImage();
    }

    function downloadImage() {
        if (currentImageUrls.length === 0) return;
        
        if (currentImageUrls.length === 1) {
            // Single image download
            downloadSingleImage(currentImageUrls[0].originalUrl, 1);
        } else {
            // Multiple images - download all individually
            showNotification(`Downloading ${currentImageUrls.length} images...`);
            currentImageUrls.forEach((img, index) => {
                setTimeout(() => {
                    downloadSingleImage(img.originalUrl, index + 1);
                }, index * 500); // Stagger downloads
            });
        }
    }

    function downloadSingleImage(imageUrl, imageNumber) {
        // Generate timestamp for filename
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
        const format = imageFormatSelect.value;
        const countSuffix = currentImageUrls.length > 1 ? `_${imageNumber}` : '';
        const filename = `absureal_${timestamp}${countSuffix}.${format}`;
        
        showDownloadLoading();
        
        // Use XHR to download with headers
        const xhr = new XMLHttpRequest();
        xhr.open('GET', imageUrl, true);
        xhr.responseType = 'blob';
        xhr.setRequestHeader('Authorization', `Bearer ${API_KEY}`);
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                const blob = xhr.response;
                const url = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up the blob URL
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                }, 100);
                
                resetDownloadButton();
                showNotification(`Image ${imageNumber} downloaded successfully!`);
            } else {
                showNotification(`Failed to download image ${imageNumber}`, 3000, true);
                resetDownloadButton();
            }
        };
        
        xhr.onerror = function() {
            showNotification(`Network error downloading image ${imageNumber}`, 3000, true);
            resetDownloadButton();
        };
        
        xhr.send();
    }

    function addToHistory(originalPrompt, fullPrompt, urls) {
        if (generationHistory.length >= 20) {
            generationHistory.pop();
        }
        
        const historyItem = {
            id: Date.now(),
            originalPrompt,
            fullPrompt,
            urls: Array.isArray(urls) ? urls : [urls],
            timestamp: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString(),
            imageCount: Array.isArray(urls) ? urls.length : 1,
            params: currentGenerationParams
        };
        
        generationHistory.unshift(historyItem);
        localStorage.setItem('generationHistory', JSON.stringify(generationHistory));
        updateHistoryDisplay();
    }

    function updateHistoryDisplay() {
        if (generationHistory.length === 0) {
            historyList.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Your generation history will appear here</p>';
            return;
        }
        
        historyList.innerHTML = '';
        generationHistory.forEach((item) => {
            const originalPrompt = item.originalPrompt || item.prompt;
            const truncatedPrompt = originalPrompt.length > 50 
                ? originalPrompt.substring(0, 50) + '...' 
                : originalPrompt;
            
            const imageCountBadge = item.imageCount > 1 ? 
                `<span class="image-count-badge-small">${item.imageCount}</span>` : '';
            
            const qualityBadge = item.params && item.params.qualityEnhance !== '0' ? 
                `<span class="quality-badge" title="Enhanced quality">★</span>` : '';
            
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item neuromorphic-card p-3 rounded-lg mb-2 cursor-pointer fade-in';
            historyItem.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <img src="${item.urls[0]}" class="w-12 h-12 rounded object-cover" alt="History thumbnail">
                        ${imageCountBadge}
                        ${qualityBadge}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-gray-700 truncate">${truncatedPrompt}</div>
                        <div class="text-xs text-gray-500">${item.timestamp} • ${item.imageCount} image${item.imageCount > 1 ? 's' : ''}</div>
                    </div>
                    <button class="neuromorphic-btn p-2 rounded" data-id="${item.id}" title="Load Images">
                        <i class="fas fa-redo text-xs text-blue-600"></i>
                    </button>
                </div>
            `;
            
            historyItem.querySelector('button').addEventListener('click', (e) => {
                e.stopPropagation();
                loadHistoryImages(item.urls, item.imageCount);
            });
            
            historyItem.addEventListener('click', function(e) {
                if (e.target.closest('button')) return;
                loadHistoryPrompt(item.originalPrompt, item.urls, item.imageCount);
            });
            
            historyList.appendChild(historyItem);
        });
    }

    function loadHistoryImages(urls, imageCount) {
        // Clear existing images
        const existingContainer = document.getElementById('multipleImagesContainer');
        if (existingContainer) {
            existingContainer.remove();
        }
        
        // Hide single image
        generatedImage.style.display = 'none';
        placeholder.classList.add('hidden');
        
        // Create container for multiple images
        const generatedImagesContainer = document.createElement('div');
        generatedImagesContainer.id = 'multipleImagesContainer';
        generatedImagesContainer.className = `multiple-images-grid cols-${imageCount > 2 ? 2 : imageCount}`;
        
        urls.forEach((url, index) => {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'image-item relative';
            
            const img = document.createElement('img');
            img.src = url;
            img.className = 'generated-image w-full h-auto rounded-lg cursor-pointer';
            img.alt = `Generated image ${index + 1}`;
            
            const imageNumberBadge = document.createElement('div');
            imageNumberBadge.className = 'image-count-badge';
            imageNumberBadge.textContent = `${index + 1}`;
            
            // Add click event for individual image download
            img.addEventListener('click', function() {
                downloadSingleImage(url, index + 1);
            });
            
            imgContainer.appendChild(img);
            imgContainer.appendChild(imageNumberBadge);
            generatedImagesContainer.appendChild(imgContainer);
        });
        
        previewContainer.appendChild(generatedImagesContainer);
        downloadBtn.disabled = false;
        
        // Update current image URLs
        currentImageUrls = urls.map((url, index) => ({ url, originalUrl: url, index }));
        
        showNotification(`Loaded ${urls.length} images from history`);
    }

    function loadHistoryPrompt(originalPrompt, urls, imageCount) {
        promptInput.value = originalPrompt;
        promptInput.focus();
        loadHistoryImages(urls, imageCount);
    }

    function openFullscreenEditor() {
        fullscreenTextarea.value = promptInput.value;
        fullscreenOverlay.classList.remove('hidden');
        fullscreenTextarea.focus();
    }

    function closeFullscreenEditor() {
        promptInput.value = fullscreenTextarea.value;
        fullscreenOverlay.classList.add('hidden');
        showNotification('Prompt saved from fullscreen editor');
    }

    function showDownloadLoading() {
        const originalHtml = downloadBtn.innerHTML;
        downloadBtn.innerHTML = `
            <i class="fas fa-spinner fa-spin text-blue-600"></i>
        `;
        downloadBtn.disabled = true;
    }

    function resetDownloadButton() {
        downloadBtn.innerHTML = `
            <i class="fas fa-download text-blue-600"></i>
        `;
        downloadBtn.disabled = false;
    }

    function showNotification(message, duration = 3000, isError = false) {
        // Remove existing notification if any
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.className = `notification fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${
            isError ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Remove after duration
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    // Public API
    return {
        init
    };
})();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    ImageGenerator.init();
});
