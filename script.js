// Pro Audio Studio - Application Class
class ProAudioStudio {
    constructor() {
        this.recordings = [];
        this.currentRecording = null;
        this.currentView = 'all';
        this.currentViewMode = 'grid';
        this.currentAudio = null;
        this.currentPlayingId = null;
        this.modalAudio = null;
        
        // Recording variables
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.timerInterval = null;
        this.animationId = null;
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.loadFromStorage();
        this.bindEvents();
        this.updateStats();
        this.renderRecordings();
        this.initVisualizer();
        this.hideLoading();
    }
    
    cacheElements() {
        this.elements = {
            // Buttons
            recordBtn: document.getElementById('recordBtn'),
            stopBtn: document.getElementById('stopBtn'),
            playLatestBtn: document.getElementById('playLatestBtn'),
            saveBtn: document.getElementById('saveBtn'),
            clearAllBtn: document.getElementById('clearAllBtn'),
            exportAllBtn: document.getElementById('exportAllBtn'),
            menuToggle: document.getElementById('menuToggle'),
            
            // Display
            timerDisplay: document.getElementById('timerDisplay'),
            visualizer: document.getElementById('visualizer'),
            previewWaveform: document.getElementById('previewWaveform'),
            waveformPreview: document.getElementById('waveformPreview'),
            recordingStatus: document.getElementById('recordingStatus'),
            statusText: document.getElementById('statusText'),
            
            // Stats
            totalRecordings: document.getElementById('totalRecordings'),
            totalDuration: document.getElementById('totalDuration'),
            totalSize: document.getElementById('totalSize'),
            storageBar: document.getElementById('storageBar'),
            storageText: document.getElementById('storageText'),
            allCount: document.getElementById('allCount'),
            favCount: document.getElementById('favCount'),
            recentCount: document.getElementById('recentCount'),
            
            // Inputs
            searchInput: document.getElementById('searchInput'),
            sortSelect: document.getElementById('sortSelect'),
            qualitySelect: document.getElementById('qualitySelect'),
            
            // Containers
            recordingsContainer: document.getElementById('recordingsContainer'),
            pageTitle: document.getElementById('pageTitle'),
            
            // Modal
            modal: document.getElementById('playerModal'),
            modalTitle: document.getElementById('modalTitle'),
            modalPlayBtn: document.getElementById('modalPlayBtn'),
            modalPrevBtn: document.getElementById('modalPrevBtn'),
            modalNextBtn: document.getElementById('modalNextBtn'),
            modalProgress: document.getElementById('modalProgress'),
            modalCurrentTime: document.getElementById('modalCurrentTime'),
            modalDuration: document.getElementById('modalDuration'),
            modalFavoriteBtn: document.getElementById('modalFavoriteBtn'),
            modalDownloadBtn: document.getElementById('modalDownloadBtn'),
            modalDeleteBtn: document.getElementById('modalDeleteBtn'),
            modalWaveform: document.getElementById('modalWaveform'),
            modalClose: document.querySelector('.modal-close')
        };
        
        this.viewBtns = document.querySelectorAll('.view-btn');
        this.navItems = document.querySelectorAll('.nav-item');
    }
    
    bindEvents() {
        this.elements.recordBtn.addEventListener('click', () => this.startRecording());
        this.elements.stopBtn.addEventListener('click', () => this.stopRecording());
        this.elements.playLatestBtn.addEventListener('click', () => this.playLatest());
        this.elements.saveBtn.addEventListener('click', () => this.saveCurrentRecording());
        this.elements.clearAllBtn.addEventListener('click', () => this.clearAllConfirm());
        this.elements.exportAllBtn.addEventListener('click', () => this.exportAll());
        this.elements.searchInput.addEventListener('input', () => this.renderRecordings());
        this.elements.sortSelect.addEventListener('change', () => this.renderRecordings());
        this.elements.menuToggle.addEventListener('click', () => this.toggleSidebar());
        
        this.viewBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchViewMode(btn.dataset.view));
        });
        
        this.navItems.forEach(item => {
            item.addEventListener('click', () => this.switchView(item.dataset.view));
        });
        
        // Modal events
        this.elements.modalClose.addEventListener('click', () => this.closeModal());
        this.elements.modalPlayBtn.addEventListener('click', () => this.toggleModalPlay());
        this.elements.modalProgress.addEventListener('input', (e) => this.seekModalAudio(e.target.value));
        this.elements.modalFavoriteBtn.addEventListener('click', () => this.toggleCurrentFavorite());
        this.elements.modalDownloadBtn.addEventListener('click', () => this.downloadCurrentRecording());
        this.elements.modalDeleteBtn.addEventListener('click', () => this.deleteCurrentRecording());
        
        // Close modal on outside click
        this.elements.modal.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) this.closeModal();
        });
    }
    
    hideLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        setTimeout(() => {
            loadingScreen.classList.add('hide');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }, 1000);
    }
    
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        toast.className = `toast ${type} show`;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    updateStats() {
        const total = this.recordings.length;
        let totalSeconds = 0;
        let totalBytes = 0;
        
        this.recordings.forEach(rec => {
            totalSeconds += rec.duration || 0;
            totalBytes += rec.size || 0;
        });
        
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        this.elements.totalRecordings.textContent = total;
        this.elements.totalDuration.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        this.elements.totalSize.textContent = (totalBytes / (1024 * 1024)).toFixed(2) + ' MB';
        
        // Storage calculation (max 50MB)
        const maxStorage = 50 * 1024 * 1024;
        const percentage = Math.min((totalBytes / maxStorage) * 100, 100);
        this.elements.storageBar.style.width = `${percentage}%`;
        this.elements.storageText.textContent = `${percentage.toFixed(1)}% مستخدم`;
        
        // Update badges
        this.elements.allCount.textContent = total;
        this.elements.favCount.textContent = this.recordings.filter(r => r.favorite).length;
        this.elements.recentCount.textContent = this.recordings.slice(0, 5).length;
    }
    
    updateTimer() {
        if (this.isRecording && this.recordingStartTime) {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            const hours = Math.floor(elapsed / 3600);
            const minutes = Math.floor((elapsed % 3600) / 60);
            const seconds = elapsed % 60;
            this.elements.timerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    // Reset timer to zero
    resetTimer() {
        this.elements.timerDisplay.textContent = '00:00:00';
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
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
            this.recordingStartTime = Date.now();
            
            // Reset timer to zero and start fresh
            this.resetTimer();
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);
            this.startVisualizerAnimation(stream);
            
            // Update UI
            this.elements.recordBtn.disabled = true;
            this.elements.stopBtn.disabled = false;
            this.elements.playLatestBtn.disabled = true;
            this.elements.saveBtn.disabled = true;
            this.elements.recordingStatus.classList.add('recording');
            this.elements.statusText.textContent = 'جاري التسجيل...';
            
            this.showToast('بدأ التسجيل، تحدث الآن', 'success');
            
        } catch (error) {
            console.error('Recording error:', error);
            this.showToast('لا يمكن الوصول إلى الميكروفون', 'error');
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            // Stop timer and reset
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            
            // Update UI
            this.elements.recordBtn.disabled = false;
            this.elements.stopBtn.disabled = true;
            this.elements.recordingStatus.classList.remove('recording');
            this.elements.statusText.textContent = 'تم الإيقاف';
            
            this.showToast('تم إيقاف التسجيل', 'success');
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
        
        // Show waveform preview
        this.showWaveformPreview(blob);
        
        this.elements.statusText.textContent = 'جاهز للحفظ';
        this.showToast('تم التسجيل بنجاح! اضغط حفظ', 'success');
    }
    
    calculateDuration() {
        // Estimate duration based on file size (approx)
        const size = this.audioChunks.reduce((acc, chunk) => acc + chunk.size, 0);
        const quality = this.elements.qualitySelect.value;
        let bitrate = 128000;
        if (quality === 'high') bitrate = 192000;
        if (quality === 'low') bitrate = 64000;
        return Math.floor(size / (bitrate / 8));
    }
    
    async showWaveformPreview(blob) {
        this.elements.waveformPreview.style.display = 'block';
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const data = audioBuffer.getChannelData(0);
        
        const canvas = this.elements.previewWaveform;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        
        const step = Math.floor(data.length / canvas.width);
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < canvas.width; i++) {
            const sample = data[Math.floor(i * step)];
            const y = (sample * 0.5 + 0.5) * canvas.height;
            ctx.lineTo(i, y);
        }
        ctx.stroke();
        
        audioContext.close();
    }
    
    saveCurrentRecording() {
        if (this.currentRecording) {
            this.recordings.unshift(this.currentRecording);
            this.saveToStorage();
            this.renderRecordings();
            this.updateStats();
            
            this.elements.saveBtn.disabled = true;
            this.elements.playLatestBtn.disabled = false;
            this.elements.waveformPreview.style.display = 'none';
            this.currentRecording = null;
            
            this.showToast('تم حفظ التسجيل بنجاح', 'success');
            this.elements.statusText.textContent = 'جاهز للتسجيل';
            
            // Reset timer display to zero
            this.resetTimer();
        }
    }
    
    playLatest() {
        if (this.currentRecording) {
            this.openModal(this.currentRecording);
        } else if (this.recordings.length > 0) {
            this.openModal(this.recordings[0]);
        } else {
            this.showToast('لا يوجد تسجيلات للتشغيل', 'error');
        }
    }
    
    openModal(recording) {
        this.currentPlayingId = recording.id;
        this.elements.modalTitle.textContent = recording.name;
        
        if (this.modalAudio) {
            this.modalAudio.pause();
            this.modalAudio = null;
        }
        
        this.modalAudio = new Audio(recording.url);
        
        this.modalAudio.addEventListener('loadedmetadata', () => {
            const duration = this.modalAudio.duration;
            this.elements.modalDuration.textContent = this.formatTime(duration);
            this.elements.modalProgress.max = duration;
            this.drawModalWaveform(recording);
        });
        
        this.modalAudio.addEventListener('timeupdate', () => {
            const current = this.modalAudio.currentTime;
            this.elements.modalCurrentTime.textContent = this.formatTime(current);
            this.elements.modalProgress.value = current;
        });
        
        this.modalAudio.addEventListener('ended', () => {
            this.elements.modalPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
        });
        
        // Update favorite button
        this.updateModalFavoriteButton(recording.favorite);
        
        this.elements.modal.classList.add('active');
    }
    
    async drawModalWaveform(recording) {
        try {
            const arrayBuffer = await recording.blob.arrayBuffer();
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const data = audioBuffer.getChannelData(0);
            
            const canvas = this.elements.modalWaveform;
            const ctx = canvas.getContext('2d');
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            
            const step = Math.floor(data.length / canvas.width);
            ctx.fillStyle = '#0a0a0f';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            
            for (let i = 0; i < canvas.width; i++) {
                const sample = data[Math.floor(i * step)];
                const y = (sample * 0.5 + 0.5) * canvas.height;
                ctx.lineTo(i, y);
            }
            ctx.stroke();
            
            audioContext.close();
        } catch (error) {
            console.error('Waveform error:', error);
        }
    }
    
    toggleModalPlay() {
        if (!this.modalAudio) return;
        
        if (this.modalAudio.paused) {
            this.modalAudio.play();
            this.elements.modalPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            this.modalAudio.pause();
            this.elements.modalPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    }
    
    seekModalAudio(value) {
        if (this.modalAudio) {
            this.modalAudio.currentTime = value;
        }
    }
    
    toggleCurrentFavorite() {
        const recording = this.recordings.find(r => r.id === this.currentPlayingId);
        if (recording) {
            recording.favorite = !recording.favorite;
            this.saveToStorage();
            this.renderRecordings();
            this.updateStats();
            this.updateModalFavoriteButton(recording.favorite);
            this.showToast(recording.favorite ? 'أضيف إلى المفضلة' : 'تم الإزالة من المفضلة', 'success');
        }
    }
    
    updateModalFavoriteButton(isFavorite) {
        if (isFavorite) {
            this.elements.modalFavoriteBtn.innerHTML = '<i class="fas fa-heart"></i><span>المفضلة</span>';
            this.elements.modalFavoriteBtn.style.color = '#f59e0b';
        } else {
            this.elements.modalFavoriteBtn.innerHTML = '<i class="far fa-heart"></i><span>المفضلة</span>';
            this.elements.modalFavoriteBtn.style.color = '';
        }
    }
    
    downloadCurrentRecording() {
        const recording = this.recordings.find(r => r.id === this.currentPlayingId);
        if (recording) {
            const a = document.createElement('a');
            a.href = recording.url;
            a.download = `${recording.name}.webm`;
            a.click();
            this.showToast('جاري تحميل التسجيل...', 'success');
        }
    }
    
    deleteCurrentRecording() {
        if (confirm('هل أنت متأكد من حذف هذا التسجيل؟')) {
            const index = this.recordings.findIndex(r => r.id === this.currentPlayingId);
            if (index !== -1) {
                this.recordings.splice(index, 1);
                this.saveToStorage();
                this.renderRecordings();
                this.updateStats();
                this.closeModal();
                this.showToast('تم حذف التسجيل', 'success');
            }
        }
    }
    
    closeModal() {
        if (this.modalAudio) {
            this.modalAudio.pause();
            this.modalAudio = null;
        }
        this.elements.modal.classList.remove('active');
        this.currentPlayingId = null;
    }
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    switchViewMode(mode) {
        this.currentViewMode = mode;
        const container = this.elements.recordingsContainer;
        container.className = `recordings-container ${mode}-view`;
        
        this.viewBtns.forEach(btn => {
            if (btn.dataset.view === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        this.renderRecordings();
    }
    
    switchView(view) {
        this.currentView = view;
        this.navItems.forEach(item => {
            if (item.dataset.view === view) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        const titles = {
            all: 'جميع التسجيلات',
            favorites: 'المفضلة',
            recent: 'آخر التسجيلات'
        };
        
        this.elements.pageTitle.textContent = titles[view];
        this.renderRecordings();
    }
    
    getFilteredRecordings() {
        let filtered = [...this.recordings];
        const searchTerm = this.elements.searchInput.value.toLowerCase();
        
        // Filter by view
        if (this.currentView === 'favorites') {
            filtered = filtered.filter(r => r.favorite);
        } else if (this.currentView === 'recent') {
            filtered = filtered.slice(0, 5);
        }
        
        // Filter by search
        if (searchTerm) {
            filtered = filtered.filter(r => r.name.toLowerCase().includes(searchTerm));
        }
        
        // Sort
        const sortBy = this.elements.sortSelect.value;
        switch(sortBy) {
            case 'date-desc':
                filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
                break;
            case 'date-asc':
                filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
                break;
            case 'name-asc':
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                filtered.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'duration-asc':
                filtered.sort((a, b) => (a.duration || 0) - (b.duration || 0));
                break;
            case 'duration-desc':
                filtered.sort((a, b) => (b.duration || 0) - (a.duration || 0));
                break;
        }
        
        return filtered;
    }
    
    renderRecordings() {
        const filtered = this.getFilteredRecordings();
        const container = this.elements.recordingsContainer;
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-microphone-slash"></i>
                    <p>لا توجد تسجيلات</p>
                    <small>اضغط على زر التسجيل لبدء أول تسجيل لك</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filtered.map(rec => this.createRecordingCard(rec)).join('');
        
        // Add event listeners to new cards
        container.querySelectorAll('.recording-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.card-action') && !e.target.closest('.fav-btn')) {
                    const id = parseInt(card.dataset.id);
                    const recording = this.recordings.find(r => r.id === id);
                    if (recording) this.openModal(recording);
                }
            });
        });
        
        container.querySelectorAll('.fav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const recording = this.recordings.find(r => r.id === id);
                if (recording) {
                    recording.favorite = !recording.favorite;
                    this.saveToStorage();
                    this.renderRecordings();
                    this.updateStats();
                    this.showToast(recording.favorite ? 'أضيف إلى المفضلة' : 'تم الإزالة من المفضلة', 'success');
                }
            });
        });
        
        container.querySelectorAll('.play-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const recording = this.recordings.find(r => r.id === id);
                if (recording) this.openModal(recording);
            });
        });
        
        container.querySelectorAll('.delete-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                if (confirm('هل أنت متأكد من حذف هذا التسجيل؟')) {
                    const index = this.recordings.findIndex(r => r.id === id);
                    if (index !== -1) {
                        this.recordings.splice(index, 1);
                        this.saveToStorage();
                        this.renderRecordings();
                        this.updateStats();
                        this.showToast('تم حذف التسجيل', 'success');
                    }
                }
            });
        });
    }
    
    createRecordingCard(rec) {
        const date = new Date(rec.date);
        const formattedDate = `${date.toLocaleDateString('ar-EG')} ${date.toLocaleTimeString('ar-EG')}`;
        const duration = this.formatTime(rec.duration || 0);
        const size = (rec.size / (1024 * 1024)).toFixed(2);
        
        return `
            <div class="recording-card ${rec.favorite ? 'favorite' : ''}" data-id="${rec.id}">
                <div class="card-header">
                    <div class="recording-title">${this.escapeHtml(rec.name)}</div>
                    <button class="fav-btn ${rec.favorite ? 'active' : ''}" data-id="${rec.id}">
                        <i class="fas ${rec.favorite ? 'fa-heart' : 'fa-heart'}"></i>
                    </button>
                </div>
                <div class="card-details">
                    <span><i class="fas fa-clock"></i> ${duration}</span>
                    <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
                    <span><i class="fas fa-database"></i> ${size} MB</span>
                </div>
                <div class="card-actions">
                    <button class="card-action play-card" data-id="${rec.id}">
                        <i class="fas fa-play"></i> تشغيل
                    </button>
                    <button class="card-action delete-card" data-id="${rec.id}">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </div>
            </div>
        `;
    }
    
    escapeHtml(str) {
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    async initVisualizer() {
        this.elements.visualizer.width = this.elements.visualizer.clientWidth;
        this.elements.visualizer.height = this.elements.visualizer.clientHeight;
    }
    
    startVisualizerAnimation(stream) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (this.analyser) {
            this.source?.disconnect();
            this.analyser?.disconnect();
        }
        
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.source = this.audioContext.createMediaStreamSource(stream);
        this.source.connect(this.analyser);
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            if (!this.isRecording) {
                this.drawFlatVisualizer();
                return;
            }
            
            this.animationId = requestAnimationFrame(draw);
            this.analyser.getByteTimeDomainData(dataArray);
            
            const canvas = this.elements.visualizer;
            const ctx = canvas.getContext('2d');
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            
            ctx.fillStyle = '#0a0a0f';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            
            const sliceWidth = canvas.width / bufferLength;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * (canvas.height / 2);
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                x += sliceWidth;
            }
            ctx.stroke();
        };
        
        draw();
    }
    
    drawFlatVisualizer() {
        const canvas = this.elements.visualizer;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        
        const centerY = canvas.height / 2;
        ctx.moveTo(0, centerY);
        ctx.lineTo(canvas.width, centerY);
        ctx.stroke();
    }
    
    stopVisualizerAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.drawFlatVisualizer();
    }
    
    clearAllConfirm() {
        if (confirm('⚠️ تحذير: هل أنت متأكد من حذف جميع التسجيلات؟ لا يمكن التراجع عن هذا الإجراء.')) {
            this.recordings = [];
            this.saveToStorage();
            this.renderRecordings();
            this.updateStats();
            this.showToast('تم حذف جميع التسجيلات', 'success');
        }
    }
    
    exportAll() {
        if (this.recordings.length === 0) {
            this.showToast('لا توجد تسجيلات للتصدير', 'error');
            return;
        }
        
        const exportData = this.recordings.map(rec => ({
            name: rec.name,
            date: rec.date,
            duration: rec.duration,
            size: rec.size,
            favorite: rec.favorite
        }));
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `pro-studio-export-${new Date().toISOString()}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        this.showToast('تم تصدير البيانات بنجاح', 'success');
    }
    
    saveToStorage() {
        const recordingsToStore = this.recordings.map(rec => ({
            id: rec.id,
            name: rec.name,
            blobData: rec.blob ? URL.revokeObjectURL(rec.url) : null,
            duration: rec.duration,
            date: rec.date,
            size: rec.size,
            favorite: rec.favorite
        }));
        
        // For actual storage, we need to store blobs as base64
        // This is a simplified version - in production, consider IndexedDB
        localStorage.setItem('proAudioRecordings', JSON.stringify(recordingsToStore));
    }
    
    loadFromStorage() {
        const stored = localStorage.getItem('proAudioRecordings');
        if (stored) {
            const parsed = JSON.parse(stored);
            this.recordings = parsed.map(rec => ({
                ...rec,
                url: null // Will need to recreate blobs in production
            }));
        }
    }
    
    toggleSidebar() {
        document.querySelector('.sidebar').classList.toggle('open');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ProAudioStudio();
});