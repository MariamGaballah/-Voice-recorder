// تأكد من أن الصفحة تعمل في بيئة آمنة (https أو localhost) وإلا لن يعمل الميكروفون
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let startTime;
let timerInterval;
let currentAudioBlob = null;
let recordingsArray = [];

// عناصر DOM
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const playBtn = document.getElementById('playBtn');
const timerDisplay = document.getElementById('timerDisplay');
const statusMsg = document.getElementById('statusMsg');
const recordingsListDiv = document.getElementById('recordingsList');
const waveformCanvas = document.getElementById('waveform');
let canvasCtx = waveformCanvas.getContext('2d');
let audioContext;
let analyser;
let source;
let animationId;

// تحميل التسجيلات المخزنة من localStorage عند بدء التشغيل
function loadRecordingsFromStorage() {
    const stored = localStorage.getItem('voiceRecordings');
    if (stored) {
        recordingsArray = JSON.parse(stored);
        renderRecordingsList();
    }
}

// حفظ التسجيلات في localStorage
function saveRecordingsToStorage() {
    localStorage.setItem('voiceRecordings', JSON.stringify(recordingsArray));
}

// عرض قائمة التسجيلات
function renderRecordingsList() {
    if (recordingsArray.length === 0) {
        recordingsListDiv.innerHTML = `
            <div class="empty-message">
                <i class="fas fa-box-open"></i>
                <p>لا توجد تسجيلات بعد. ابدأ بالتسجيل الآن!</p>
            </div>
        `;
        return;
    }

    recordingsListDiv.innerHTML = '';
    recordingsArray.forEach((rec, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('recording-item');
        
        // تاريخ readable
        const dateObj = new Date(rec.date);
        const formattedDate = `${dateObj.toLocaleDateString('ar-EG')} - ${dateObj.toLocaleTimeString('ar-EG')}`;
        
        itemDiv.innerHTML = `
            <div class="recording-info">
                <div class="recording-name">${escapeHtml(rec.name)}</div>
                <div class="recording-date">${formattedDate}</div>
            </div>
            <div class="recording-actions">
                <button class="action-btn play-rec-btn" data-index="${index}" title="تشغيل">
                    <i class="fas fa-play"></i>
                </button>
                <button class="action-btn delete-btn" data-index="${index}" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        recordingsListDiv.appendChild(itemDiv);
    });
    
    // إضافة أحداث للأزرار الجديدة
    document.querySelectorAll('.play-rec-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = btn.getAttribute('data-index');
            playRecordingFromArray(idx);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = btn.getAttribute('data-index');
            deleteRecording(idx);
        });
    });
}

// تشغيل تسجيل محفوظ
function playRecordingFromArray(index) {
    const rec = recordingsArray[index];
    if (!rec || !rec.blobData) return;
    
    // تحويل base64 إلى Blob
    const byteCharacters = atob(rec.blobData.split(',')[1]);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    const blob = new Blob(byteArrays, { type: rec.type });
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audio.play();
    audio.onended = () => URL.revokeObjectURL(audioUrl);
    statusMsg.innerText = 'جاري التشغيل...';
    audio.onended = () => {
        statusMsg.innerText = 'جاهز للتسجيل';
        URL.revokeObjectURL(audioUrl);
    };
}

// حذف تسجيل
function deleteRecording(index) {
    recordingsArray.splice(index, 1);
    saveRecordingsToStorage();
    renderRecordingsList();
    statusMsg.innerText = 'تم الحذف بنجاح';
    setTimeout(() => {
        if (statusMsg.innerText === 'تم الحذف بنجاح') statusMsg.innerText = 'جاهز للتسجيل';
    }, 1500);
}

// وظيفة مساعدة لتجنب XSS
function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// تحديث المؤقت
function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    timerDisplay.innerText = `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
}

// رسم موجة صوتية حية
function setupWaveform(stream) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (analyser) {
        source?.disconnect();
        analyser?.disconnect();
    }
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        if (!isRecording) {
            // رسم خط مسطح إذا لم يكن تسجيل
            canvasCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
            canvasCtx.fillStyle = '#0a0e14';
            canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
            canvasCtx.beginPath();
            canvasCtx.strokeStyle = '#4affb5';
            canvasCtx.lineWidth = 2;
            const centerY = waveformCanvas.height / 2;
            canvasCtx.moveTo(0, centerY);
            canvasCtx.lineTo(waveformCanvas.width, centerY);
            canvasCtx.stroke();
            return;
        }
        
        requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);
        
        canvasCtx.fillStyle = '#0a0e14';
        canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        canvasCtx.beginPath();
        canvasCtx.strokeStyle = '#4affb5';
        canvasCtx.lineWidth = 2;
        
        const sliceWidth = waveformCanvas.width / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * (waveformCanvas.height / 2);
            
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        canvasCtx.stroke();
    }
    draw();
}

// بدء التسجيل
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            currentAudioBlob = audioBlob;
            
            // تحويل إلى base64 لتخزينه
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => {
                const base64data = reader.result;
                const newRecording = {
                    id: Date.now(),
                    name: `تسجيل ${new Date().toLocaleString('ar-EG')}`,
                    date: new Date().toISOString(),
                    blobData: base64data,
                    type: 'audio/webm'
                };
                recordingsArray.unshift(newRecording);
                saveRecordingsToStorage();
                renderRecordingsList();
                statusMsg.innerText = 'تم حفظ التسجيل بنجاح!';
                setTimeout(() => {
                    if (statusMsg.innerText === 'تم حفظ التسجيل بنجاح!') statusMsg.innerText = 'جاهز للتسجيل';
                }, 2000);
            };
            
            // إيقاف مسارات الستريم
            stream.getTracks().forEach(track => track.stop());
            if (animationId) cancelAnimationFrame(animationId);
        };
        
        mediaRecorder.start();
        isRecording = true;
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
        
        // إعداد الموجة الصوتية
        setupWaveform(stream);
        
        // تبديل حالة الأزرار
        recordBtn.disabled = true;
        stopBtn.disabled = false;
        playBtn.disabled = true;
        statusMsg.innerText = 'جاري التسجيل... تحدث الآن';
        
    } catch (err) {
        console.error('خطأ في الوصول للميكروفون:', err);
        statusMsg.innerText = 'خطأ: لا يمكن الوصول للميكروفون. تأكد من السماح بالوصول.';
        recordBtn.disabled = false;
    }
}

// إيقاف التسجيل
function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        clearInterval(timerInterval);
        
        recordBtn.disabled = false;
        stopBtn.disabled = true;
        if (currentAudioBlob) {
            playBtn.disabled = false;
        }
        
        statusMsg.innerText = 'تم إيقاف التسجيل. جاهز للتشغيل أو حفظ جديد.';
        
        // إغلاق الـ AudioContext إن وجد
        if (audioContext) {
            audioContext.close().then(() => {
                audioContext = null;
            });
        }
    }
}

// تشغيل آخر تسجيل تم تسجيله
function playLatestRecording() {
    if (currentAudioBlob) {
        const url = URL.createObjectURL(currentAudioBlob);
        const audio = new Audio(url);
        audio.play();
        statusMsg.innerText = 'جاري تشغيل التسجيل...';
        audio.onended = () => {
            statusMsg.innerText = 'جاهز للتسجيل';
            URL.revokeObjectURL(url);
        };
    } else {
        statusMsg.innerText = 'لا يوجد تسجيل حديث لتشغيله';
    }
}

// إضافة المستمعين للأزرار
recordBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
playBtn.addEventListener('click', playLatestRecording);

// تحميل البيانات المخزنة
loadRecordingsFromStorage();

// رسم خط ثابت في البداية
canvasCtx.fillStyle = '#0a0e14';
canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
canvasCtx.beginPath();
canvasCtx.strokeStyle = '#4affb5';
canvasCtx.lineWidth = 2;
canvasCtx.moveTo(0, waveformCanvas.height/2);
canvasCtx.lineTo(waveformCanvas.width, waveformCanvas.height/2);
canvasCtx.stroke();