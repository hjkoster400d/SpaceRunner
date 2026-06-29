// === AUDIO ENGINE (procedural, no external files) ===
let audioCtx = null;
let musicGain = null;
let sfxGain = null;
let musicPlaying = false;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  musicGain = audioCtx.createGain();
  musicGain.gain.value = 0.3;
  musicGain.connect(audioCtx.destination);
  sfxGain = audioCtx.createGain();
  sfxGain.gain.value = 0.5;
  sfxGain.connect(audioCtx.destination);
}

// === SFX ===
function playCoinSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

function playJumpSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(250, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.2);
}

function playHitSound() {
  if (!audioCtx) return;
  // Noise burst + low thud
  const bufferSize = audioCtx.sampleRate * 0.2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
  noise.connect(noiseGain);
  noiseGain.connect(sfxGain);
  noise.start();

  // Low thud
  const osc = audioCtx.createOscillator();
  const oscGain = audioCtx.createGain();
  osc.connect(oscGain);
  oscGain.connect(sfxGain);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.15);
  oscGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  oscGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.2);
}

function playGameOverSound() {
  if (!audioCtx) return;
  const notes = [400, 350, 300, 200];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.15 + 0.14);
    osc.start(audioCtx.currentTime + i * 0.15);
    osc.stop(audioCtx.currentTime + i * 0.15 + 0.15);
  });
}

// === MUSIC (simple looping melody) ===
let musicInterval = null;

function startMusic() {
  if (!audioCtx || musicPlaying) return;
  musicPlaying = true;

  // Simple chiptune-style loop
  const bpm = 128;
  const beatDuration = 60 / bpm;
  const melody = [
    523, 587, 659, 784, 659, 587, 523, 440,
    523, 587, 659, 784, 880, 784, 659, 523
  ];
  const bass = [262, 262, 330, 330, 220, 220, 262, 262];

  let beatIndex = 0;

  function playBeat() {
    if (!musicPlaying || !audioCtx) return;

    // Melody
    const melodyNote = melody[beatIndex % melody.length];
    const osc1 = audioCtx.createOscillator();
    const g1 = audioCtx.createGain();
    osc1.connect(g1);
    g1.connect(musicGain);
    osc1.type = 'square';
    osc1.frequency.value = melodyNote;
    g1.gain.setValueAtTime(0.12, audioCtx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + beatDuration * 0.8);
    osc1.start();
    osc1.stop(audioCtx.currentTime + beatDuration * 0.8);

    // Bass (every 2 beats)
    if (beatIndex % 2 === 0) {
      const bassNote = bass[(beatIndex / 2) % bass.length];
      const osc2 = audioCtx.createOscillator();
      const g2 = audioCtx.createGain();
      osc2.connect(g2);
      g2.connect(musicGain);
      osc2.type = 'triangle';
      osc2.frequency.value = bassNote;
      g2.gain.setValueAtTime(0.15, audioCtx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + beatDuration * 1.8);
      osc2.start();
      osc2.stop(audioCtx.currentTime + beatDuration * 1.9);
    }

    // Hi-hat (every beat)
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.03, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.3));
    const hat = audioCtx.createBufferSource();
    hat.buffer = buf;
    const hg = audioCtx.createGain();
    hg.gain.value = 0.06;
    hat.connect(hg);
    hg.connect(musicGain);
    hat.start();

    beatIndex++;
  }

  musicInterval = setInterval(playBeat, beatDuration * 1000);
  playBeat();
}

function stopMusic() {
  musicPlaying = false;
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
}
