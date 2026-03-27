// Audio Studio Pro - Main Application
class AudioStudio {
    constructor() {
        this.recordings = [];
        this.currentView = 'recordings';
        this.currentAudio = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.startTime = null;
        this.timerInterval = null;
        this.animationId = null;
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.currentPlayingId = null;
        this.modalAudio = null;
        
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.loadFromStorage();
        this.bindEvents();
        this.updateStats();
        this.renderRecordings();
        this.initVisualizer();
    }
    
    cacheElements() {
        this.elements = {
            recordBtn: document.getElementById('recordBtn'),
            stopBtn: document.getElementById('stopBtn'),
            playLatestBtn: document.getElementById('playLatestBtn'),
            saveBtn: document.getElementById('saveBtn'),
            timeDisplay: document.getElementById('timeDisplay'),
            statusMessage: document.getElementById('statusMessage'),
            recordingsContainer: document.getElementById('recordingsContainer'),
            searchInput: document.getElementById('searchInput'),
            sortSelect: document.getElementById('sortSelect'),
            qualitySelect: document.getElementById('qualitySelect'),
            visualizer: document.getElementById('visualizer'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            modal: document.getElementById('playerModal'),
            modalPlayBtn: document.getElementById('modalPlayBtn'),
            progressSlider: document.getElementById('progressSlider'),
            currentTime: document.getElementById('currentTime'),
            totalDuration: document.getElementById('totalDuration'),
            modalFavoriteBtn: document.getElementById('modalFavoriteBtn'),
            modalDownloadBtn: document.getElementById('modalDownloadBtn'),
            recordingIndicator: document.getElementById('recordingIndicator'),
            totalRecordings: document.getElementById('totalRecordings'),
            totalTime: document.getElementById('totalTime'),
            totalSize: document.getElementById('totalSize'),
            storageFill: document.getElementById('storageFill'),
            storageText: document.getElementById('storageText'),
            sectionTitle: document.getElementById('sectionTitle'),
            exportAllBtn: document.getElementById('exportAllBtn'),
            clearAllBtn: document.getElementById('clearAllBtn')
        };
        
        // Menu items
        this.menuItems = document.querySelectorAll('.menu-item');
    }
    
    bindEvents() {
        this.elements.recordBtn.addEventListener('click', () => this.startRecording());
        this.elements.stopBtn.addEventListener('click', () => this.stopRecording());
        this.elements.playLatestBtn.addEventListener('click', () => this.playLatest());
        this.elements.saveBtn.addEventListener('click', () => this.saveCurrentRecording());
        this.elements.searchInput.addEventListener('input', () => this.renderRecordings());
        this.elements.sortSelect.addEventListener('change', () => this.renderRecordings());
        this.elements.exportAllBtn.addEventListener('click', () => this.exportAll());
        this.elements.clearAllBtn.addEventListener('click', () => this.clearAll());
        
        // Modal events
        document.querySelector('.close-modal').addEventListener('click', () => this.closeModal());
        this.elements.modalPlayBtn.addEventListener('click', () => this.toggleModalPlay());
        this.elements.progressSlider.addEventListener('input', (e) => this.seekAudio(e.target.value));
        this.elements.modalFavoriteBtn.addEventListener('click', () => this.toggleFavorite());
        this.elements.modalDownloadBtn.addEventListener('click', () => this.downloadCurrent());
        
        // Menu items
        this.menuItems.forEach(item => {
            item.addEventListener('click', () => this.switchView(item.dataset.view));
        });
    }
    
    showLoading(show) {
        this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    
    updateStatus(message, isError = false) {
        this.elements.statusMessage.innerHTML = `
            <i class="fas ${isError ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        if (!isError) {
            setTimeout(() => {
                if (this.elements.statusMessage.innerHTML.includes(message)) {
                    this.elements.statusMessage.innerHTML = `
                        <i class="fas fa-info-circle"></i>
                        <span>جاهز للتسجيل</span>
                    `;
                }
            }, 3000);
        }
    }
    
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const quality = this.elements.qualitySelect.value;
            let options = { mimeType: 'audio/webm' };
            
            if (quality === 'high') {
                options = { mimeType: 'audio/webm', audioBitsPerSecond: 192000 };
            } else if (quality === 'medium') {
                options = { mimeType: 'audio/webm', audioBitsPerSecond: 128000 };
            } else {
                options = { mimeType: 'audio/webm', audioBitsPerSecond: 64000 };
            }
            
            this.mediaRecorder = new MediaRecorder(stream, options);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecording();
                stream.getTracks().forEach(track => track.stop());
                this.stopVisualizerAnimation();
            };
            
            this.mediaRecorder.start(1000);
            this.isRecording = true;
            this.startTime = Date.now();
            
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);
            this.startVisualizerAnimation(stream);
            
            this.elements.recordBtn.disabled = true;
            this.elements.stopBtn.disabled = false;
            this.elements.playLatestBtn.disabled = true;
            this.elements.saveBtn.disabled = true;
            this.elements.recordingIndicator.classList.add('active');
            
            this.updateStatus('جاري التسجيل... تحدث الآن');
            
        } catch (error) {
            console.error('Recording error:', error);
            this.updateStatus('خطأ: لا يمكن الوصول إلى الميكروفون', true);
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            clearInterval(this.timerInterval);
            
            this.elements.recordBtn.disabled = false;
            this.elements.stopBtn.disabled = true;
            this.elements.recordingIndicator.classList.remove('active');
            
            this.updateStatus('تم إيقاف التسجيل');
        }
    }
    
    processRecording() {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const duration = this.calculateDuration();
        
        this.currentRecording = {
            id: Date.now(),
            name: `تسجيل ${new Date().toLocaleString('ar-EG')}`,
            blob: blob,
            url: url,
            duration: duration,
            date: new Date().toISOString(),
            size: blob.size,
            favorite: false,
            deleted: false
        };
        
        this.elements.playLatestBtn.disabled = false;
        this.elements.saveBtn.disabled = false;
        
        this.updateStatus('تم التسجيل بنجاح! يمكنك الآن الحفظ');
    }
    
    saveCurrentRecording() {
        if (this.currentRecording) {
            this.recordings.unshift(this.currentRecording);
            this.saveToStorage();
            this.renderRecordings();
            this.updateStats();
            
            this.elements.saveBtn.disabled = true;
            this.currentRecording = null;
            
            this.updateStatus('تم حفظ التسجيل بنجاح');
        }
    }
    
    playLatest() {
        if (this.currentRecording) {
            this.playRecording(this.currentRecording);
        } else if (this.recordings.length > 0) {
            this.playRecording(this.recordings[0]);
        }
    }
    
    playRecording(recording) {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        
        this.currentAudio = new Audio(recording.url);
        this.currentAudio.play();
        this.updateStatus(`جاري تشغيل: ${recording.name}`);
        
        this.currentAudio.onended = () => {
            this.updateStatus('انتهى التشغيل');
            this.currentAudio = null;
        };
    }
    
    async openModal(recording) {
        this.currentPlayingId = recording.id;
        
        if (this.modalAudio) {
            this.modalAudio.pause();
            this.modalAudio = null;
        }
        
        this.modalAudio = new Audio(recording.url);
        
        this.modalAudio.addEventListener('loadedmetadata', () => {
            const duration = this.modalAudio.duration;
            this.elements.totalDuration.textContent = this.formatTime(duration);
            this.elements.progressSlider.max = duration;
        });
        
        this.modalAudio.addEventListener('timeupdate', () => {
            const current = this.modalAudio.currentTime;
            this.elements.currentTime.textContent = this.formatTime(current);
            this.elements.progress