export class AudioManager {
    constructor() {
        this.ctx = null;
        // Driving hum node references
        this.moveOsc = null;
        this.moveGain = null;
        // Space Bass chiptune loops references
        this.musicInterval = null;
        this.bassNotes = [65.41, 73.42, 58.27, 87.31]; // C2, D2, A#1, F2
        this.bassIndex = 0;
    }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    /**
     * Starts playing a procedural low-frequency ambient retro space synth bassline.
     */
    startMusic() {
        this.init();
        if (!this.ctx || this.musicInterval)
            return;
        this.musicInterval = setInterval(() => {
            this.playBassNote(this.bassNotes[this.bassIndex]);
            this.bassIndex = (this.bassIndex + 1) % this.bassNotes.length;
        }, 1100);
    }
    stopMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
    }
    playBassNote(freq) {
        if (!this.ctx)
            return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        // Deep lowpass filtering for retro sci-fi space drone feel
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, this.ctx.currentTime);
        filter.Q.setValueAtTime(3.5, this.ctx.currentTime);
        // Gain envelope (soft attack, long fadeout)
        gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.07, this.ctx.currentTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.0);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.05);
    }
    /**
     * Synthesizes a clean firing thud.
     */
    playFire() {
        this.init();
        if (!this.ctx)
            return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }
    /**
     * Synthesizes a metallic clink bounce sound.
     */
    playBounce() {
        this.init();
        if (!this.ctx)
            return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        // High-pitched short ping
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
    }
    /**
     * Synthesizes a deep rumbling explosion.
     */
    playExplosion(radius) {
        this.init();
        if (!this.ctx)
            return;
        const duration = radius * 0.02 + 0.5;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        const initialFreq = Math.max(100, 700 - radius * 4);
        filter.frequency.setValueAtTime(initialFreq, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + duration);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.7, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noiseSource.start();
        noiseSource.stop(this.ctx.currentTime + duration);
    }
    /**
     * Plays a continuous low triangle hum.
     */
    startMove() {
        this.init();
        if (!this.ctx || this.moveOsc)
            return;
        this.moveOsc = this.ctx.createOscillator();
        this.moveGain = this.ctx.createGain();
        this.moveOsc.type = 'triangle';
        this.moveOsc.frequency.setValueAtTime(55, this.ctx.currentTime);
        const modOsc = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        modOsc.frequency.setValueAtTime(10, this.ctx.currentTime);
        modGain.gain.setValueAtTime(3, this.ctx.currentTime);
        modOsc.connect(modGain);
        modGain.connect(this.moveOsc.frequency);
        this.moveGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
        this.moveGain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 0.1);
        this.moveOsc.connect(this.moveGain);
        this.moveGain.connect(this.ctx.destination);
        modOsc.start();
        this.moveOsc.start();
    }
    stopMove() {
        if (!this.ctx || !this.moveOsc || !this.moveGain)
            return;
        const osc = this.moveOsc;
        const gainNode = this.moveGain;
        this.moveOsc = null;
        this.moveGain = null;
        gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, this.ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        setTimeout(() => {
            try {
                osc.stop();
            }
            catch (e) { }
        }, 200);
    }
    /**
     * Plays a clean arpeggiated chirp.
     */
    playCollect() {
        this.init();
        if (!this.ctx)
            return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(now + 0.3);
    }
}
//# sourceMappingURL=audio.js.map