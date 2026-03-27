class VoiceRecorderPro {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentRecording = null;
        this.recordings = JSON.parse(localStorage.getItem('voiceRecordings')) || [];
        this.isRecording = false;
        this.startTime = 0;
        this.timerInterval = null;
        
        this.initElements();
        this.bindEvents();
        this.loadRecordings();
        this.requestMicPermission();
    }

    initElements() {
        this.recordBtn = document.getElementById('recordBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.playBtn = document.getElementById('playBtn');
        this