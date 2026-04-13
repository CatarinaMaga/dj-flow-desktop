// Audio Engine Lida com Tocar/Pausar os Áudios na Web
const AudioEngine = {
    contexts: { A: null, B: null },
    fxNodes: { A: null, B: null },
    
    init: function() {
        this.players = {
            A: document.getElementById('audio-player-a'),
            B: document.getElementById('audio-player-b')
        };
        
        // Habilita Cors para que Node backend streams funcionem com Web Audio API FXs
        if(this.players.A) this.players.A.crossOrigin = "anonymous";
        if(this.players.B) this.players.B.crossOrigin = "anonymous";

        this.setupControls();
        this.setupMixer();
        this.setupFX();
        this.setupAudioRouting();
        this.setupTimers();
    },

    initWebAudio: function(deckName) {
        if (this.contexts[deckName]) {
            if(this.contexts[deckName].state === 'suspended') this.contexts[deckName].resume();
            return;
        }
        
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.contexts[deckName] = ctx;
            const player = this.players[deckName];
            
            // 1. Fonte Originária
            const source = ctx.createMediaElementSource(player);
            
            // 2. Filtro Color FX (Low-Pass e High-Pass)
            const biquad = ctx.createBiquadFilter();
            biquad.type = "allpass"; 
            
            // 3. Efeito Delay (Echo)
            const delay = ctx.createDelay();
            delay.delayTime.value = 0.5; // 500ms de echo
            
            const delayGain = ctx.createGain();
            delayGain.gain.value = 0; // Inicia Desligado
            
            const feedback = ctx.createGain();
            feedback.gain.value = 0.5; // Quantidade da cauda do eco (Feedback)
            
            // Roteamento
            // Sinal Seco: Source -> Biquad -> Master Destino
            source.connect(biquad);
            biquad.connect(ctx.destination);
            
            // Sinal Efeito (Wet): Biquad -> Delay -> DelayGain -> Master Destino
            biquad.connect(delay);
            delay.connect(delayGain);
            delayGain.connect(feedback);
            feedback.connect(delay); // Volta para criar o loop
            delayGain.connect(ctx.destination);
            
            this.fxNodes[deckName] = { biquad, delayGain };
        } catch(e) {
            console.error(`Falha em Instanciar Web Audio API (${deckName}):`, e);
        }
    },
    
    setupFX: function() {
        ['a', 'b'].forEach(suffix => {
            const deckName = suffix.toUpperCase();
            
            // Controle de FILTRO
            const filterKnob = document.getElementById(`filter-${suffix}`);
            if (filterKnob) {
                filterKnob.addEventListener('input', (e) => {
                    this.initWebAudio(deckName);
                    const val = parseFloat(e.target.value);
                    const biquad = this.fxNodes[deckName]?.biquad;
                    if(!biquad) return;

                    if (val < -0.05) { // Low Pass
                        biquad.type = 'lowpass';
                        // Escala: -1 (200Hz) até 0 (20000Hz)
                        biquad.frequency.value = 200 + ((1 - Math.abs(val)) * 19800);
                    } else if (val > 0.05) { // High Pass
                        biquad.type = 'highpass';
                        // Escala: 0 (10Hz) até 1 (8000Hz)
                        biquad.frequency.value = 10 + (val * 8000);
                    } else {
                        biquad.type = 'allpass';
                    }
                });

                // Reset no duplo clique
                filterKnob.addEventListener('dblclick', (e) => {
                    e.target.value = 0;
                    e.target.dispatchEvent(new Event('input'));
                });
            }

            // Controle de ECHO
            const echoSlider = document.getElementById(`echo-lvl-${suffix}`);
            const echoBtn = document.getElementById(`btn-echo-${suffix}`);
            let isEchoOn = false;

            const applyEcho = () => {
                const gainNode = this.fxNodes[deckName]?.delayGain;
                if(!gainNode) return;
                
                if (isEchoOn) {
                    gainNode.gain.value = parseFloat(echoSlider.value);
                } else {
                    gainNode.gain.value = 0;
                }
            };

            if (echoBtn) {
                echoBtn.addEventListener('click', () => {
                    this.initWebAudio(deckName);
                    isEchoOn = !isEchoOn;
                    echoBtn.classList.toggle('active', isEchoOn);
                    applyEcho();
                });
            }

            if (echoSlider) {
                echoSlider.addEventListener('input', () => {
                    if (isEchoOn) applyEcho();
                });
            }
        });
    },

    setupControls: function() {
        document.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deckName = e.target.getAttribute('data-deck');
                this.play(deckName);
            });
        });
        
        document.querySelectorAll('.pause-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deckName = e.target.getAttribute('data-deck');
                this.pause(deckName);
            });
        });
        
        document.querySelectorAll('.cue-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deckName = e.target.getAttribute('data-deck');
                const player = this.players[deckName];
                player.currentTime = 0;
                player.pause();
                console.log(`CUE btn presionado no Deck ${deckName}`);
            });
        });
    },

    setupMixer: function() {
        const volA = document.getElementById('vol-a');
        const volB = document.getElementById('vol-b');

        if(volA && this.players.A) {
            volA.addEventListener('input', (e) => {
                this.players.A.volume = e.target.value;
            });
        }
        if(volB && this.players.B) {
            volB.addEventListener('input', (e) => {
                this.players.B.volume = e.target.value;
            });
        }
    },

    setupTimers: function() {
        const attachTimer = (deckName) => {
            const player = this.players[deckName];
            const timeDisplay = document.querySelector(`#deck-${deckName.toLowerCase()} .time-remaining`);
            
            if (player && timeDisplay) {
                player.addEventListener('timeupdate', () => {
                    if (isNaN(player.currentTime)) return;
                    
                    const formatTime = (secs) => {
                        const m = Math.floor(secs / 60);
                        const s = Math.floor(secs % 60);
                        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
                    };
                    
                    timeDisplay.textContent = formatTime(player.currentTime);
                });
            }
        };
        attachTimer('A');
        attachTimer('B');
    },

    setupAudioRouting: async function() {
        // Popula as opções do modal
        const selectA = document.getElementById('output-select-A');
        const selectB = document.getElementById('output-select-B');
        
        try {
            // Requisitar permissão
            await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
            
            const populate = (selectElem) => {
                if(!selectElem) return;
                selectElem.innerHTML = '';
                audioOutputs.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.text = device.label || `Device ${device.deviceId.substring(0, 5)}...`;
                    selectElem.appendChild(option);
                });
            };

            populate(selectA);
            populate(selectB);

            // Ao mudar a placa de som: Aplicamos no AudioContext se já instanciou, ou no AudioPlayer simples.
            if(selectA) {
                selectA.addEventListener('change', async (e) => {
                    if (this.contexts.A && this.contexts.A.setSinkId) {
                        await this.contexts.A.setSinkId(e.target.value);
                    } else if (this.players.A.setSinkId) {
                        await this.players.A.setSinkId(e.target.value);
                    }
                });
            }

            if(selectB) {
                selectB.addEventListener('change', async (e) => {
                    if (this.contexts.B && this.contexts.B.setSinkId) {
                        await this.contexts.B.setSinkId(e.target.value);
                    } else if (this.players.B.setSinkId) {
                        await this.players.B.setSinkId(e.target.value);
                    }
                });
            }
        } catch (err) {
            console.warn("Roteamento de Áudio não suportado (setSinkId):", err);
        }

        const btnSettings = document.getElementById('btn-settings');
        const modalSettings = document.getElementById('audio-settings-modal');
        const btnCloseSettings = document.getElementById('btn-close-settings');

        if (btnSettings && modalSettings && btnCloseSettings) {
            btnSettings.addEventListener('click', () => {
                modalSettings.style.display = 'flex';
                this.setupAudioRouting(); 
            });
            btnCloseSettings.addEventListener('click', () => {
                modalSettings.style.display = 'none';
            });
        }
    },
    
    loadTrack: function(deckName, trackObj) {
        if (!this.players) this.init(); 
        
        const player = this.players[deckName];
        if (player) {
            player.src = trackObj.url;
            player.load();
        }
    },
    
    play: function(deckName) {
        this.initWebAudio(deckName); // Garante que o WebAudio tá preparado e "desperto" (resume) antes de tocar 
        
        const player = this.players[deckName];
        if (player && player.src) {
            player.play().catch(e => console.error("Erro ao tocar:", e));
        }
    },
    
    pause: function(deckName) {
        const player = this.players[deckName];
        if (player) {
            player.pause();
        }
    }
};

window.AudioEngine = AudioEngine;

document.addEventListener('DOMContentLoaded', () => {
    AudioEngine.init();
});
