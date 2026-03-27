class VoiceRecorderPro {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentAudioBlob = null;
        this.recordings = [];
        this.isRecording = false;
        this.isPaused = false;
        this.startTime = 0;
        this.timer = 0;
        this.animationId = null;
        
        this.initElements();
        this.loadSettings();
        this.loadRecordings();
        this.bindEvents();
        this.hideLoading();
    }

    initElements() {
        // Recorder elements
        this.recordBtn = document.getElementById('recordBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.playBtn = document.getElementById('playBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.currentTimeEl = document.getElementById('currentTime');
        this.maxTimeEl = document.getElementById('maxTime');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.waveformCanvas = document.getElementById('waveformCanvas');
        this.qualitySelect = document.getElementById('qualitySelect');
        this.recordingsGrid = document.getElementById('recordingsGrid');

        // Modals
        this.settingsModal = document.getElementById('settingsModal');
        this.audioModal = document.getElementById('audioModal');
        this.confirmModal = document.getElementById('confirmModal');
        this.modalPlayer = document.getElementById('modalPlayer');

        // Other elements
        this.userNameEl = document.getElementById('userName');
        this.userNameInput = document.getElementById('userNameInput');
        this.searchInput = document.getElementById('searchInput');
    }

    async requestMicPermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (err) {
            console.error('Mic permission denied:', err);
            this.showNotification('❌ يرجى السماح بالوصول للميكروفون', 'error');
            return false;
        }
    }

    bindEvents() {
        // Recorder buttons
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.playBtn.addEventListener('click', () => this.playRecording());
        this.downloadBtn.addEventListener('click', () => this.downloadRecording());

        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.querySelectorAll('.modal-close').forEach(close => 
            close.addEventListener('click', () => this.closeModal(close.closest('.modal')))
        );

        // Recordings
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllRecordings());
        document.getElementById('exportAllBtn').addEventListener('click', () => this.exportAllRecordings());
        this.searchInput.addEventListener('input', (e) => this.filterRecordings(e.target.value));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.toggleRecording();
            }
            if (e.code === 'Escape') {
                this.closeAllModals();
            }
        });

        // Canvas resize
        window.addEventListener('resize', () => this.resizeWaveform());
    }

    async toggleRecording() {
        if (!this.isRecording) {
            await this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });

            const options = { 
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: parseInt(this.qualitySelect.value) * 1000
            };

            this.mediaRecorder = new MediaRecorder(stream, options);
            this.audioChunks = [];
            this.startTime = Date.now();
            this.isRecording = true;
            this.isPaused = false;

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.audioChunks.push(e.data);
            };

            this.mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                this.currentAudioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.updateUIAfterStop();
            };

            this.mediaRecorder.start(100); // Collect data every 100ms for smooth waveform
            this.updateRecordingUI();
            this.animateWaveform(stream);
            
            this.showNotification('🎙️ بدأ التسجيل بنجاح!', 'success');
        } catch (err) {
            console.error('Recording error:', err);
            this.showNotification('❌ خطأ في بدء التسجيل', 'error');
        }
    }

    togglePause() {
        if (!this.mediaRecorder || !this.isRecording) return;

        if (this.isPaused) {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.statusText.textContent = 'جاري التسجيل...';
            this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            this.showNotification('▶️ استئناف التسجيل', 'success');
        } else {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.statusText.textContent = 'متوقف مؤقتاً';
            this.pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            this.showNotification('⏸️ توقف مؤقت', 'info');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.isPaused = false;
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
            }
        }
    }

    updateUIAfterStop() {
        this.updateRecordingUI();
        if (this.currentAudioBlob) {
            this.enablePlayback();
            this.addRecordingToList();
        }
    }

    updateRecordingUI() {
        if (this.isRecording) {
            this.recordBtn.classList.add('recording');
            this.recordBtn.innerHTML = '<i class="fas fa-stop"></i>';
            this.pauseBtn.disabled = false;
            this.stopBtn.disabled = false;
            this.statusIndicator.classList.add('recording');
            this.statusText.textContent = this.isPaused ? 'متوقف مؤقتاً' : 'جاري التسجيل...';
        } else {
            this.recordBtn.classList.remove('recording');
            this.recordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            this.pauseBtn.disabled = true;
            this.stopBtn.disabled = true;
            this.playBtn.disabled = !this.currentAudioBlob;
            this.downloadBtn.disabled = !this.currentAudioBlob;
            this.statusIndicator.classList.remove('recording');
            this.statusText.textContent = 'جاهز للتسجيل';
        }
    }

    updateTimer() {
        if (!this.isRecording) return;

        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
        const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
        const s = (elapsed % 60).toString().padStart(2, '0');
        
        this.currentTimeEl.textContent = `${h}:${m}:${s}`;
    }

    animateWaveform(stream) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        analyser.fftSize = 2048;

        microphone.connect(analyser);

        const draw = () => {
            this.animationId = requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(dataArray);
            this.drawWaveform(dataArray);
            this.updateTimer();
        };
        draw();
    }

    drawWaveform(dataArray) {
        const canvas = this.waveformCanvas;
        const ctx = canvas.getContext('2d');
        
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const sliceWidth = canvas.width / dataArray.length;
                let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * canvas.height) / 2;

            ctx.lineWidth = 2;
            ctx.strokeStyle = this.isRecording 
                ? `hsl(${50 + Math.random() * 30}, 100%, 60%)`
                : '#4ecdc4';
            
            ctx.beginPath();
            ctx.moveTo(x, canvas.height / 2);
            ctx.lineTo(x, y);
            ctx.stroke();

            x += sliceWidth;
        }
    }

    resizeWaveform() {
        const canvas = this.waveformCanvas;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }

    enablePlayback() {
        this.playBtn.disabled = false;
        this.downloadBtn.disabled = false;
        this.maxTimeEl.textContent = this.formatTime(Math.floor(this.currentAudioBlob.size / (parseInt(this.qualitySelect.value) * 125)));
    }

    playRecording() {
        if (this.currentAudioBlob) {
            const audioUrl = URL.createObjectURL(this.currentAudioBlob);
            const audio = new Audio(audioUrl);
            audio.play();
            this.showNotification('▶️ جاري التشغيل...', 'success');
        }
    }

    downloadRecording() {
        if (this.currentAudioBlob) {
            const url = URL.createObjectURL(this.currentAudioBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showNotification('📥 تم التحميل بنجاح!', 'success');
        }
    }

    addRecordingToList() {
        if (!this.currentAudioBlob) return;

        const duration = Math.floor(this.currentAudioBlob.size / (parseInt(this.qualitySelect.value) * 125));
        const recording = {
            id: Date.now(),
            title: `تسجيل ${this.formatDate(new Date())}`,
            duration: this.formatTime(duration),
            size: this.formatSize(this.currentAudioBlob.size),
            date: new Date().toISOString(),
            blob: this.currentAudioBlob,
            quality: this.qualitySelect.value
        };

        this.recordings.unshift(recording);
        this.saveRecordings();
        this.renderRecordings();
        this.currentAudioBlob = null;
        this.updateRecordingUI();

        // Auto play if setting enabled
        if (localStorage.getItem('autoPlay') === 'true') {
            this.openRecordingModal(recording);
        }
    }

    renderRecordings(filteredRecordings = this.recordings) {
        if (filteredRecordings.length === 0) {
            this.recordingsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-microphone-slash"></i>
                    <h4>لا توجد تسجيلات</h4>
                    <p>ابدأ تسجيلك الأول الآن!</p>
                </div>
            `;
            return;
        }

        this.recordingsGrid.innerHTML = filteredRecordings.map(recording => `
            <div class="recording-card" data-id="${recording.id}">
                <div class="recording-header">
                    <div>
                        <div class="recording-title">${recording.title}</div>
                        <div class="recording-meta">
                            <span>${recording.duration}</span>
                            <span>•</span>
                            <span>${recording.size}</span>
                            <span>•</span>
                            <span>${this.formatDate(new Date(recording.date))}</span>
                        </div>
                    </div>
                    <div class="quality-badge">${recording.quality}kbps</div>
                </div>
                <div class="recording-actions">
                    <button class="btn-play-small" onclick="app.openRecordingModalById(${recording.id})">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn-delete-small" onclick="app.deleteRecording(${recording.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    filterRecordings(query) {
        const filtered = this.recordings.filter(recording => 
            recording.title.toLowerCase().includes(query.toLowerCase()) ||
            this.formatDate(new Date(recording.date)).includes(query)
        );
        this.renderRecordings(filtered);
    }

    openRecordingModalById(id) {
        const recording = this.recordings.find(r => r.id === id);
        if (recording) {
            this.openRecordingModal(recording);
        }
    }

    openRecordingModal(recording) {
        document.getElementById('modalTitle').textContent = recording.title;
        const url = URL.createObjectURL(recording.blob);
        this.modalPlayer.src = url;
        this.modalPlayer.play();
        this.audioModal.style.display = 'flex';
        this.currentModalRecording = recording;
    }

    // Settings
    openSettings() {
        this.userNameInput.value = localStorage.getItem('userName') || '';
        document.getElementById('defaultQuality').value = localStorage.getItem('defaultQuality') || '128';
        document.getElementById('autoPlay').checked = localStorage.getItem('autoPlay') !== 'false';
        document.getElementById('saveToCloud').checked = localStorage.getItem('saveToCloud') !== 'false';
        this.settingsModal.style.display = 'flex';
    }

    saveSettings() {
        localStorage.setItem('userName', this.userNameInput.value || 'المستخدم');
        localStorage.setItem('defaultQuality', document.getElementById('defaultQuality').value);
        localStorage.setItem('autoPlay', document.getElementById('autoPlay').checked);
        localStorage.setItem('saveToCloud', document.getElementById('saveToCloud').checked);
        
        this.userNameEl.textContent = this.userNameInput.value || 'المستخدم';
        this.qualitySelect.value = document.getElementById('defaultQuality').value;
        
        this.closeModal(this.settingsModal);
        this.showNotification('✅ تم حفظ الإعدادات', 'success');
    }

    loadSettings() {
        const userName = localStorage.getItem('userName') || 'المستخدم';
        this.userNameEl.textContent = userName;
        this.qualitySelect.value = localStorage.getItem('defaultQuality') || '128';
    }

    // Storage
    loadRecordings() {
        const saved = localStorage.getItem('voiceRecordings');
        if (saved) {
            try {
                this.recordings = JSON.parse(saved).map(r => ({
                    ...r,
                    blob: null // Will reload blobs when needed
                }));
            } catch (e) {
                console.error('Error loading recordings:', e);
            }
        }
        this.renderRecordings();
    }

    saveRecordings() {
        // Save metadata only (blobs are too big for localStorage)
        const recordingsData = this.recordings.map(r => ({
            id: r.id,
            title: r.title,
            duration: r.duration,
            size: r.size,
            date: r.date,
            quality: r.quality
        }));
        localStorage.setItem('voiceRecordings', JSON.stringify(recordingsData));
    }

    // Delete functions
    deleteRecording(id) {
        this.showConfirmDelete(() => {
            this.recordings = this.recordings.filter(r => r.id !== id);
            this.saveRecordings();
            this.renderRecordings();
            this.showNotification('🗑️ تم الحذف بنجاح', 'success');
        });
    }

    clearAllRecordings() {
        if (this.recordings.length === 0) return;
        this.showConfirmDelete(() => {
            this.recordings = [];
            this.saveRecordings();
            this.renderRecordings();
            this.showNotification('🗑️ تم حذف جميع التسجيلات', 'success');
        }, 'هل تريد حذف جميع التسجيلات؟');
    }

    showConfirmDelete(onConfirm, message = 'هل تريد حذف هذا التسجيل؟') {
        document.querySelector('#confirmModal .modal-body p').innerHTML = 
            message + '<br><small>هذا الإجراء لا يمكن التراجع عنه</small>';
        this.confirmModal.style.display = 'flex';
        document.getElementById('confirmDelete').onclick = onConfirm;
    }

    // Export
    async exportAllRecordings() {
        if (this.recordings.length === 0) {
            this.showNotification('لا توجد تسجيلات للتصدير', 'info');
            return;
        }

        this.showNotification('📦 جاري التصدير...', 'info');
        const zip = new JSZip();
        
        for (let i = 0; i < this.recordings.length; i++) {
            // Note: This is metadata only. Full export would need server
            zip.file(`${this.recordings[i].title}.json`, JSON.stringify(this.recordings[i]));
        }
        
        const content = await zip.generateAsync({type: 'blob'});
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voice-recordings-${new Date().toISOString().slice(0,10)}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('📦 تم تصدير جميع التسجيلات!', 'success');
    }

    // Utilities
    formatTime(seconds) {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return h === '00' ? `${m}:${s}` : `${h}:${m}:${s}`;
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('ar-EG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showNotification(message, type = 'info') {
        // Simple notification (can be enhanced with toast library)
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
            ${message}
        `;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            color: white;
            padding: 15px 25px;
            border-radius: 50px;
            font-weight: 600;
            z-index: 10001;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            animation: slideDown 0.3s ease;
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    closeModal(modal) {
        modal.style.display = 'none';
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    hideLoading() {
        setTimeout(() => {
            document.getElementById('loadingScreen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loadingScreen').style.display = 'none';
            }, 500);
        }, 2000);
    }
}

// Global app instance
const app = new VoiceRecorderPro();

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    .quality-badge {
        background: rgba(102, 126, 234, 0.3);
        color: #667eea;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    .btn-play-small, .btn-delete-small {
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
    }
    .btn-play-small { background: #27ae60; }
    .btn-delete-small { background: #e74c3c; }
    .btn-play-small:hover, .btn-delete-small:hover {
        transform: scale(1.1);
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    }
`;
document.head.appendChild(style);

// Auto-request mic permission on first interaction
document.addEventListener('click', function initMic() {
    app.requestMicPermission();
    document.removeEventListener('click', initMic);
}, { once: true });