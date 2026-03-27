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