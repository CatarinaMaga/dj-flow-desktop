const MidiController = {
    midiAccess: null,
    
    // mapeamentos salvos no formato: "comando-nota": { targetId: "id-do-html", type: "knob" | "button" }
    mappings: {}, 
    
    isLearning: false,
    currentTarget: null, // Elemento DOM esperando o sinal do USB

    init: async function() {
        this.loadMappings();
        this.setupMappableElements();
        this.setupLearnUI();
        
        try {
            this.midiAccess = await navigator.requestMIDIAccess();
            this.onMIDISuccess(this.midiAccess);
            this.midiAccess.onstatechange = (e) => {
                const indicator = document.getElementById('midi-status');
                if (e.port.state === 'connected') {
                    if (indicator) {
                        indicator.textContent = e.port.name;
                        indicator.className = 'status-indicator online';
                    }
                } else {
                    if (indicator) {
                        indicator.textContent = 'Desconectado';
                        indicator.className = 'status-indicator offline';
                    }
                }
            };
        } catch (err) {
            console.log('MIDI não suportado pelo navegador ou acesso negado:', err);
        }
    },

    loadMappings: function() {
        const saved = localStorage.getItem('djflow_midi_mappings');
        if (saved) {
            try { this.mappings = JSON.parse(saved); } catch(e) {}
        }
    },

    saveMappings: function() {
        localStorage.setItem('djflow_midi_mappings', JSON.stringify(this.mappings));
    },

    onMIDISuccess: function(midiAccess) {
        const inputs = Array.from(midiAccess.inputs.values());
        
        const indicator = document.getElementById('midi-status');
        if (inputs.length > 0) {
            if (indicator) {
                indicator.textContent = inputs[0].name;
                indicator.className = 'status-indicator online';
            }
        }
        
        inputs.forEach(input => {
            input.onmidimessage = this.handleMIDIMessage.bind(this);
        });
    },

    handleMIDIMessage: function(message) {
        if (message.data.length < 3) return;
        
        // Isolar o tipo principal de comando ignorando o canal midi exato
        const command = message.data[0] & 0xf0; 
        const note = message.data[1];
        const velocity = message.data[2];

        // Ignorar Note Off (128) ou Note On com velo 0 (que as vezes atua como Off)
        if (command === 128 || (command === 144 && velocity === 0)) return;

        // Chave universal única para este botão do hardware do usuário
        const codeKey = `${command}-${note}`;

        // -------------------------
        // MODO APRENDIZADO LIGADO
        // -------------------------
        if (this.isLearning && this.currentTarget) {
            const targetId = this.currentTarget.id || this.currentTarget.getAttribute('data-action-id');
            if (targetId) {
                // Remover qualquer mapeamento velho que apontava pra este target virtual
                Object.keys(this.mappings).forEach(k => {
                    if (this.mappings[k].targetId === targetId) delete this.mappings[k];
                });

                const isKnob = this.currentTarget.tagName === 'INPUT' && this.currentTarget.type === 'range';
                
                this.mappings[codeKey] = {
                    targetId: targetId,
                    type: isKnob ? 'knob' : 'button'
                };
                
                this.saveMappings();
                
                this.currentTarget.classList.remove('midi-learning-active');
                this.currentTarget.classList.add('midi-mapped');
                
                console.log(`MIDI LEARN: Placa ${codeKey} <=> Elemento ${targetId}`);
                this.currentTarget = null;
            }
            return;
        }

        // -------------------------
        // MODO PLAY (Operação Real)
        // -------------------------
        const map = this.mappings[codeKey];
        if (map) {
            let el = document.getElementById(map.targetId);
            if (!el) el = document.querySelector(`[data-action-id="${map.targetId}"]`);
            if (!el) return;

            if (map.type === 'knob') {
                // Controladoras geram Velocidade de 0 até 127
                // Nós traduzimos (Normalizamos) para a escala virtual min/max do input HTML
                const min = parseFloat(el.min) || 0;
                const max = parseFloat(el.max) || 1;
                const normalized = (velocity / 127) * (max - min) + min;
                
                el.value = normalized;
                // Avisamos a WebAudio API que o input arrastou para atualizar o áudio!
                el.dispatchEvent(new Event('input', { bubbles: true })); 
                
            } else if (map.type === 'button') {
                if (velocity > 0) {
                    el.click(); // Invoca o clique físico no software!
                }
            }
        }
    },

    setupMappableElements: function() {
        // Puxar todos os elementos fisicamente mapeáveis
        const elements = document.querySelectorAll('.play-btn, .pause-btn, .cue-btn, .fx-slider, .volume-fader, .fx-btn');
        let counter = 1;
        
        elements.forEach(el => {
            // Dar um ID único caso não tenha, para referenciarmos no Banco de Dados
            if (!el.id) {
                if (el.className.includes('play')) el.setAttribute('data-action-id', 'play-' + el.getAttribute('data-deck'));
                else if (el.className.includes('pause')) el.setAttribute('data-action-id', 'pause-' + el.getAttribute('data-deck'));
                else if (el.className.includes('cue')) el.setAttribute('data-action-id', 'cue-' + el.getAttribute('data-deck'));
                else el.setAttribute('data-action-id', 'mappable-' + (counter++));
            } else {
                el.setAttribute('data-action-id', el.id);
            }
            
            el.classList.add('midi-mappable'); // Transforma o cursor para "Copy"
            
            // Listener de Clique no modo Learn
            el.addEventListener('click', (e) => {
                if (this.isLearning) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (this.currentTarget) this.currentTarget.classList.remove('midi-learning-active');
                    
                    this.currentTarget = el;
                    el.classList.add('midi-learning-active');
                }
            }, true);
        });
    },

    setupLearnUI: function() {
        const btnLearn = document.getElementById('btn-midi-learn');
        if (btnLearn) {
            btnLearn.addEventListener('click', () => {
                this.isLearning = !this.isLearning;
                btnLearn.classList.toggle('active', this.isLearning);
                document.body.classList.toggle('midi-learn-mode', this.isLearning);
                
                if (!this.isLearning && this.currentTarget) {
                    this.currentTarget.classList.remove('midi-learning-active');
                    this.currentTarget = null;
                }
                
                if (this.isLearning) {
                    console.log("Modo MIDI LEARN Ativado");
                    alert("✅ MODO MIDI LEARN ATIVADO!\n\n1. Clique em um botão (ou barrinha) aqui na tela.\n2. Ele vai ficar com a borda PISCANDO.\n3. Aperte/Gire o botão correspondente físico na sua DDJ.\n4. A borda ficará Verde (Mapeado com Sucesso).\n\nQuando acabar, clique no Mapear MIDI novamente para destrancar a tela.");
                } else {
                    alert("🔒 Mapeamento concluído e Salvo!");
                }
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    MidiController.init();
});
