class VoiceRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentRecording = null;
        this.isRecording = false;
        this.timer = 0;
        this.timerInterval = null;
        
        this.initializeElements();
        this.loadRecordings();
        this.bindEvents();
    }

    initializeElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.playBtn = document.getElementById('playBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.timerEl = document.getElementById('timer');
        this.levelMeter = document.getElementById('levelMeter');
        this.fileInput = document.getElementById('fileInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.recordingsList = document.getElementById('recordingsList');
        
        // Modal elements
        this.confirmModal = document.getElementById('confirmModal');
        this.confirmDeleteBtn = document.getElementById('confirmDelete');
        this.cancelDeleteBtn = document.getElementById('cancelDelete');
        
        this.currentDeletingId = null;
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.playBtn.addEventListener('click', () => this.playRecording());
        this.downloadBtn.addEventListener('click', () => this.downloadRecording());
        
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.uploadBtn.addEventListener('click', () => this.uploadFile());
        
        this.confirmDeleteBtn.addEventListener('click', () => this.deleteRecording());
        this.cancelDeleteBtn.addEventListener('click', () => this.closeModal());
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                this.currentRecording = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.updateUIAfterRecording();
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            this.startTimer();
            this.updateUI('recording');
            
            // Audio level meter
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            source.connect(analyser);
            
            this.updateAudioLevel(analyser);
            
        } catch (err) {
            alert('خطأ في الوصول للميكروفون: ' + err.message);
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.stopTimer();
            this.updateUI('stopped');
        }
    }

    playRecording() {
        if (this.currentRecording) {
            const audio = new Audio(URL.createObjectURL(this.currentRecording));
            audio.play();
        }
    }

    downloadRecording() {
        if (this.currentRecording) {
            const url = URL.createObjectURL(this.currentRecording);
            const a = document.createElement('a');
            a.href = url;
            a.download = `recording_${Date.now()}.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    startTimer() {
        this.timer = 0;
        this.timerInterval = setInterval(() => {
            this.timer++;
            this.timerEl.textContent = this.formatTime(this.timer);
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    formatTime(seconds) {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    updateAudioLevel(analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const updateLevel = () => {
            if (!this.isRecording) return;
            
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            const percentage = Math.min((average / 255) * 100, 100);
            
            this.levelMeter.style.setProperty('--level', `${percentage}%`);
            
            requestAnimationFrame(updateLevel);
        };
        updateLevel();
    }

    updateUI(state) {
        this.startBtn.disabled = state === 'recording';
        this.stopBtn.disabled = state !== 'recording';
        this.playBtn.disabled = state !== 'stopped';
        this.downloadBtn.disabled = state !== 'stopped';
        
        if (state === 'recording') {
            this.startBtn.innerHTML = '<i class="fas fa-pause"></i> تسجيل...';
        } else {
            this.startBtn.innerHTML = '<i class="fas fa-microphone"></i> ابدأ التسجيل';
        }
    }

    updateUIAfterRecording() {
        this.saveRecording();
        this.renderRecordings();
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('audio/')) {
            this.currentRecording = file;
            this.uploadBtn.disabled = false;
        } else {
            alert('يرجى اختيار ملف صوتي');
            this.uploadBtn.disabled = true;
        }
    }

    uploadFile() {
        if (this.currentRecording) {
            this.saveRecording(this.currentRecording);
            this.renderRecordings();
            this.fileInput.value = '';
            this.uploadBtn.disabled = true;
            this.currentRecording = null;
        }
    }

    saveRecording(blobOrFile = null) {
        const recording = {
            id: Date.now(),
            name: `تسجيل_${new Date().toLocaleString('ar-EG')}`,
            blob: blobOrFile || this.currentRecording,
            duration: this.timer